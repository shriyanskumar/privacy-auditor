const fs = require("fs");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");
const db = require("../db");

const RISK_BY_CATEGORY = {
  Advertising: "high",
  Fingerprinting: "high",
  Analytics: "medium",
  Social: "medium",
  Disconnect: "low",
};

function normalizeHostname(hostname) {
  if (!hostname || typeof hostname !== "string") {
    return null;
  }

  let host = hostname.trim().toLowerCase();

  // Strip URL schemes and paths
  const schemeIndex = host.indexOf("//");
  if (schemeIndex !== -1) {
    host = host.slice(schemeIndex + 2);
  }

  const pathIndex = host.indexOf("/");
  if (pathIndex !== -1) {
    host = host.slice(0, pathIndex);
  }

  const portIndex = host.indexOf(":");
  if (portIndex !== -1) {
    host = host.slice(0, portIndex);
  }

  if (host.startsWith(".")) {
    host = host.slice(1);
  }
  if (host.endsWith(".")) {
    host = host.slice(0, -1);
  }

  return host || null;
}

function buildTrackerIndex() {
  const trackerFile = path.join(__dirname, "..", "data", "trackers.json");
  if (!fs.existsSync(trackerFile)) {
    throw new Error("Tracker database not found: backend/data/trackers.json");
  }

  const raw = fs.readFileSync(trackerFile, "utf8");
  const json = JSON.parse(raw);
  const categories = json.categories || {};
  const domainMap = new Map();

  for (const [category, companies] of Object.entries(categories)) {
    if (!companies || typeof companies !== "object") continue;

    const companyEntries = Array.isArray(companies) ? companies : [companies];

    for (const companyEntry of companyEntries) {
      if (!companyEntry || typeof companyEntry !== "object") continue;

      for (const [company, domains] of Object.entries(companyEntry)) {
        if (!domains) continue;

        const seenDomains = new Set();

        if (Array.isArray(domains)) {
          domains.forEach((domainValue) => {
            const normalized = normalizeHostname(domainValue);
            if (normalized) seenDomains.add(normalized);
          });
        } else if (typeof domains === "object") {
          for (const [domainKey, domainValue] of Object.entries(domains)) {
            const normalized = normalizeHostname(domainKey);
            if (normalized) {
              seenDomains.add(normalized);
            }

            if (Array.isArray(domainValue)) {
              domainValue.forEach((nestedDomain) => {
                const normalizedNested = normalizeHostname(nestedDomain);
                if (normalizedNested) {
                  seenDomains.add(normalizedNested);
                }
              });
            } else if (domainValue && typeof domainValue === "object") {
              for (const nestedDomain of Object.keys(domainValue)) {
                const normalizedNested = normalizeHostname(nestedDomain);
                if (normalizedNested) {
                  seenDomains.add(normalizedNested);
                }
              }
            }
          }
        }

        const risk = RISK_BY_CATEGORY[category] || "low";
        for (const domain of seenDomains) {
          const existing = domainMap.get(domain) || [];
          existing.push({ company, category, risk });
          domainMap.set(domain, existing);
        }
      }
    }
  }

  return domainMap;
}

function getBrowserPaths() {
  const home = os.homedir();
  const platform = process.platform;

  if (platform === "win32") {
    return {
      chrome: path.join(
        home,
        "AppData",
        "Local",
        "Google",
        "Chrome",
        "User Data",
        "Default",
      ),
      firefox: path.join(
        home,
        "AppData",
        "Roaming",
        "Mozilla",
        "Firefox",
        "Profiles",
      ),
      brave: path.join(
        home,
        "AppData",
        "Local",
        "BraveSoftware",
        "Brave-Browser",
        "User Data",
        "Default",
      ),
    };
  }

  if (platform === "darwin") {
    return {
      chrome: path.join(
        home,
        "Library",
        "Application Support",
        "Google",
        "Chrome",
        "Default",
      ),
      firefox: path.join(
        home,
        "Library",
        "Application Support",
        "Firefox",
        "Profiles",
      ),
      brave: path.join(
        home,
        "Library",
        "Application Support",
        "BraveSoftware",
        "Brave-Browser",
        "Default",
      ),
    };
  }

  return {
    chrome: path.join(home, ".config", "google-chrome", "Default"),
    firefox: path.join(home, ".mozilla", "firefox"),
    brave: path.join(
      home,
      ".config",
      "BraveSoftware",
      "Brave-Browser",
      "Default",
    ),
  };
}

function getFirefoxCookieFiles(profileDir) {
  if (!fs.existsSync(profileDir)) return [];
  const entries = fs.readdirSync(profileDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const candidate = path.join(profileDir, entry.name, "cookies.sqlite");
      if (fs.existsSync(candidate)) {
        files.push(candidate);
      }
    }
  }

  const directPath = path.join(profileDir, "cookies.sqlite");
  if (fs.existsSync(directPath)) {
    files.push(directPath);
  }

  return files;
}

function openDatabaseFile(cookieFile) {
  try {
    return {
      db: new Database(cookieFile, {
        readonly: true,
        fileMustExist: true,
        timeout: 500,
      }),
      tempPath: null,
    };
  } catch (err) {
    try {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "privyscan-"));
      const tempCopy = path.join(tempDir, path.basename(cookieFile));
      fs.copyFileSync(cookieFile, tempCopy);
      return {
        db: new Database(tempCopy, {
          readonly: true,
          fileMustExist: true,
          timeout: 500,
        }),
        tempPath: tempCopy,
      };
    } catch {
      return { db: null, tempPath: null };
    }
  }
}

function readCookieHosts(cookieFile) {
  const hosts = new Set();
  let rawDb;
  let tempPath = null;

  try {
    const result = openDatabaseFile(cookieFile);
    rawDb = result.db;
    tempPath = result.tempPath;
    if (!rawDb) {
      return hosts;
    }

    const availableTables = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name.toLowerCase());

    let rows = [];
    if (availableTables.includes("cookies")) {
      const columns = rawDb
        .prepare("PRAGMA table_info(cookies)")
        .all()
        .map((row) => row.name.toLowerCase());
      if (columns.includes("host_key")) {
        rows = rawDb
          .prepare("SELECT DISTINCT host_key AS host FROM cookies")
          .all();
      } else if (columns.includes("host")) {
        rows = rawDb.prepare("SELECT DISTINCT host FROM cookies").all();
      }
    } else if (availableTables.includes("moz_cookies")) {
      rows = rawDb
        .prepare("SELECT DISTINCT host AS host FROM moz_cookies")
        .all();
    }

    for (const row of rows) {
      const host = normalizeHostname(row.host);
      if (host) {
        hosts.add(host);
      }
    }
  } catch (err) {
    return hosts;
  } finally {
    if (rawDb) {
      try {
        rawDb.close();
      } catch {
        // ignore
      }
    }
    if (tempPath) {
      try {
        fs.unlinkSync(tempPath);
        fs.rmdirSync(path.dirname(tempPath));
      } catch {
        // ignore cleanup errors
      }
    }
  }

  return hosts;
}

function resolveBrowserCookieFiles(browser, profilePath) {
  if (browser === "firefox") {
    return getFirefoxCookieFiles(profilePath);
  }

  const candidates = [
    path.join(profilePath, "Cookies"),
    path.join(profilePath, "Network", "Cookies"),
  ];

  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function makeGraphId(value, prefix) {
  return `${prefix}-${value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")}`;
}

function capGraph(nodes, edges) {
  if (nodes.length <= 100) {
    return { nodes, edges };
  }

  const riskOrder = { high: 1, medium: 2, low: 3 };
  const trackerNodes = nodes.filter((node) => node.type === "tracker");
  const domainNodes = nodes.filter((node) => node.type === "domain");

  trackerNodes.sort((a, b) => {
    const order = riskOrder[a.risk] - riskOrder[b.risk];
    if (order !== 0) return order;
    return (b.domainCount || 0) - (a.domainCount || 0);
  });

  const selectedTrackerIds = new Set();
  const selectedDomainIds = new Set();
  const selectedNodes = [];
  let availableSlots = 100;

  for (const tracker of trackerNodes) {
    const associatedDomains = domainNodes.filter((domain) => {
      return edges.some(
        (edge) => edge.source === tracker.id && edge.target === domain.id,
      );
    });

    const projected = 1 + associatedDomains.length;
    if (projected <= availableSlots) {
      selectedTrackerIds.add(tracker.id);
      selectedNodes.push(tracker);
      associatedDomains.forEach((node) => {
        selectedDomainIds.add(node.id);
        selectedNodes.push(node);
      });
      availableSlots -= projected;
    } else if (availableSlots > 1) {
      selectedTrackerIds.add(tracker.id);
      selectedNodes.push(tracker);
      let remainingDomains = availableSlots - 1;
      for (const node of associatedDomains) {
        if (remainingDomains <= 0) break;
        selectedDomainIds.add(node.id);
        selectedNodes.push(node);
        remainingDomains -= 1;
      }
      availableSlots = 0;
      break;
    } else {
      break;
    }
  }

  const selectedEdges = edges.filter(
    (edge) =>
      selectedTrackerIds.has(edge.source) && selectedDomainIds.has(edge.target),
  );

  return { nodes: selectedNodes, edges: selectedEdges };
}

async function analyzeTrackers(sessionId) {
  const sessionKey = Number(sessionId);
  if (Number.isNaN(sessionKey)) {
    throw new Error("Invalid sessionId");
  }

  const trackerIndex = buildTrackerIndex();
  const browserPaths = getBrowserPaths();
  const matches = [];
  const seen = new Set();

  for (const [browser, profilePath] of Object.entries(browserPaths)) {
    if (!fs.existsSync(profilePath)) continue;

    const cookieFiles = resolveBrowserCookieFiles(browser, profilePath);
    for (const cookieFile of cookieFiles) {
      if (!fs.existsSync(cookieFile)) continue;
      const cookieHosts = readCookieHosts(cookieFile);
      for (const cookieHost of cookieHosts) {
        for (const [trackerDomain, trackerEntries] of trackerIndex.entries()) {
          if (
            cookieHost === trackerDomain ||
            cookieHost.endsWith(`.${trackerDomain}`)
          ) {
            for (const tracker of trackerEntries) {
              const cacheKey = `${tracker.company}|${tracker.category}|${trackerDomain}|${browser}|${tracker.risk}`;
              if (seen.has(cacheKey)) continue;
              seen.add(cacheKey);
              matches.push({
                company: tracker.company,
                category: tracker.category,
                matched_domain: trackerDomain,
                browser,
                risk_level: tracker.risk,
              });
            }
          }
        }
      }
    }
  }

  db.prepare("DELETE FROM tracker_findings WHERE session_id = ?").run(
    sessionKey,
  );

  const insert = db.prepare(
    `INSERT INTO tracker_findings
      (session_id, company, category, matched_domain, browser, risk_level)
      VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const item of matches) {
    insert.run(
      sessionKey,
      item.company,
      item.category,
      item.matched_domain,
      item.browser,
      item.risk_level,
    );
  }

  const summaryByCategory = {};
  const summaryByBrowser = {};
  const trackerGroups = {};
  const domainGroups = {};

  for (const match of matches) {
    summaryByCategory[match.category] =
      (summaryByCategory[match.category] || 0) + 1;
    summaryByBrowser[match.browser] =
      (summaryByBrowser[match.browser] || 0) + 1;

    const companyId = makeGraphId(match.company, "tracker");
    if (!trackerGroups[companyId]) {
      trackerGroups[companyId] = {
        id: companyId,
        label: match.company,
        type: "tracker",
        category: match.category,
        risk: match.risk_level,
        domainCount: 0,
      };
    }

    const domainId = makeGraphId(match.matched_domain, "domain");
    if (!domainGroups[domainId]) {
      domainGroups[domainId] = {
        id: domainId,
        label: match.matched_domain,
        type: "domain",
        browser: match.browser,
      };
    } else {
      const existing = domainGroups[domainId];
      const browserList = new Set(
        existing.browser
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
      browserList.add(match.browser);
      existing.browser = Array.from(browserList).join(", ");
    }

    const key = `${companyId}|${domainId}`;
    const edgeKey = `edge-${key}`;
    if (!trackerGroups[companyId].edges) {
      trackerGroups[companyId].edges = new Set();
    }
    if (!trackerGroups[companyId].edges.has(edgeKey)) {
      trackerGroups[companyId].edges.add(edgeKey);
      trackerGroups[companyId].domainCount += 1;
    }
  }

  const trackerNodes = Object.values(trackerGroups).map((node) => ({
    id: node.id,
    label: node.label,
    type: node.type,
    category: node.category,
    risk: node.risk,
    domainCount: node.domainCount,
  }));

  const domainNodes = Object.values(domainGroups);
  const edges = [];

  for (const match of matches) {
    const source = makeGraphId(match.company, "tracker");
    const target = makeGraphId(match.matched_domain, "domain");
    const edgeId = `${source}|${target}`;
    if (
      !edges.some((edge) => edge.source === source && edge.target === target)
    ) {
      edges.push({ source, target });
    }
  }

  const capped = capGraph([...trackerNodes, ...domainNodes], edges);

  return {
    nodes: capped.nodes,
    edges: capped.edges,
    summary: {
      totalTrackers: matches.length,
      byCategory: summaryByCategory,
      byBrowser: summaryByBrowser,
    },
  };
}

module.exports = { analyzeTrackers };
