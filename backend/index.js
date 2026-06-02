const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const { runScan } = require("./scanner/filesystemScanner");
const { analyzeTrackers } = require("./scanner/trackerAnalyzer");

const FOLDER_WEIGHTS = {
  credit_card: 30,
  aadhaar: 25,
  pan_card: 20,
  api_key: 20,
  password_keyword: 15,
  shadow_copy: 12,
  suspicious_filename: 10,
  phone: 5,
  email: 3,
};

const DOCUMENT_EXTENSIONS = [
  ".doc",
  ".docx",
  ".pdf",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".md",
];

const getRiskLevel = (score) =>
  score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";

const FINDING_CATEGORY_MAP = {
  email: "Email Addresses",
  phone: "Phone Numbers",
  screenshot: "Screenshots",
  password_keyword: "Passwords",
  api_key: "API Keys",
  credit_card: "Credit Cards",
  pan_card: "PAN Cards",
  aadhaar: "Aadhaar",
};

const getCategoryRiskLevel = (rank) =>
  rank >= 3 ? "HIGH" : rank === 2 ? "MEDIUM" : "LOW";

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Unknown";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
};

const getFolderName = (filePath) => {
  if (!filePath) return "Other";
  const normalized = filePath.replace(/\//g, "\\");
  const match = normalized.match(/^[a-zA-Z]:\\Users\\[^\\]+\\([^\\]+)/i);
  if (!match) {
    return "Other";
  }

  const rootFolder = match[1].toLowerCase();
  switch (rootFolder) {
    case "downloads":
      return "Downloads";
    case "documents":
      return "Documents";
    case "desktop":
      return "Desktop";
    case "pictures":
    case "my pictures":
      return "Pictures";
    case "projects":
      return "Projects";
    default:
      return "Other";
  }
};

const getDocumentCount = (filePath) => {
  const ext = path.extname(filePath || "").toLowerCase();
  return DOCUMENT_EXTENSIONS.includes(ext) ? 1 : 0;
};

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PrivyScan backend running" });
});

// Start a scan
app.post("/api/scan", async (req, res) => {
  try {
    let paths = req.body?.paths;

    if (!paths || paths.length === 0) {
      const userProfile = process.env.USERPROFILE;
      paths = [
        `${userProfile}\\Downloads`,
        `${userProfile}\\Documents`,
        `${userProfile}\\Desktop`,
        `${userProfile}\\Pictures`,
      ];
    }

    const sessionId = await runScan(paths);
    res.json({ sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get results for a session
app.get("/api/results/:sessionId", (req, res) => {
  try {
    const session = db
      .prepare("SELECT * FROM scan_sessions WHERE id = ?")
      .get(req.params.sessionId);

    const findings = db
      .prepare(
        "SELECT * FROM findings WHERE session_id = ? ORDER BY severity DESC",
      )
      .all(req.params.sessionId);

    const browserData = db
      .prepare("SELECT * FROM browser_data WHERE session_id = ?")
      .all(req.params.sessionId);

    const metadataHits = db
      .prepare("SELECT * FROM metadata_hits WHERE session_id = ?")
      .all(req.params.sessionId);

    res.json({ session, findings, browserData, metadataHits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/exif/:sessionId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    const total = db
      .prepare(
        "SELECT COUNT(*) AS count FROM metadata_hits WHERE session_id = ?",
      )
      .get(sessionId).count;

    const withGps = db
      .prepare(
        "SELECT COUNT(*) AS count FROM metadata_hits WHERE session_id = ? AND has_gps = 1",
      )
      .get(sessionId).count;

    const locations = db
      .prepare(
        "SELECT id, file_path, lat, lon, device_model, software, has_gps FROM metadata_hits WHERE session_id = ? AND has_gps = 1",
      )
      .all(sessionId)
      .map((row) => ({
        ...row,
        filename: path.basename(row.file_path),
      }));

    res.json({ locations, total, with_gps: withGps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sessions
app.get("/api/sessions", (req, res) => {
  const sessions = db
    .prepare("SELECT * FROM scan_sessions ORDER BY started_at DESC")
    .all();
  res.json(sessions);
});

app.get("/api/dashboard/latest", (req, res) => {
  try {
    const latestSession = db
      .prepare("SELECT * FROM scan_sessions ORDER BY id DESC LIMIT 1")
      .get();

    if (!latestSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.redirect(`/api/dashboard/${latestSession.id}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard/:sessionId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    const session = db
      .prepare(
        "SELECT id, started_at, finished_at, total_files, risk_score, risk_level FROM scan_sessions WHERE id = ?",
      )
      .get(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const findings = db
      .prepare(
        "SELECT file_path, finding_type, severity FROM findings WHERE session_id = ?",
      )
      .all(sessionId);

    const gpsHits = db
      .prepare(
        "SELECT file_path FROM metadata_hits WHERE session_id = ? AND has_gps = 1",
      )
      .all(sessionId);

    const folderMap = new Map();

    const addFolder = (folder) => {
      if (!folderMap.has(folder)) {
        folderMap.set(folder, {
          folder,
          debtScore: 0,
          screenshots: 0,
          emails: 0,
          documents: 0,
          sensitiveFiles: 0,
          gpsCount: 0,
          findingsCount: 0,
          categories: {},
          categoryRisk: {},
        });
      }
      return folderMap.get(folder);
    };

    for (const finding of findings) {
      const folder = getFolderName(finding.file_path);
      const stats = addFolder(folder);
      stats.findingsCount += 1;
      stats.debtScore += FOLDER_WEIGHTS[finding.finding_type] ?? 5;

      const documentCount = getDocumentCount(finding.file_path);
      if (documentCount > 0) {
        stats.documents += documentCount;
        stats.categories["Documents"] =
          (stats.categories["Documents"] || 0) + documentCount;
        stats.categoryRisk["Documents"] = Math.max(
          stats.categoryRisk["Documents"] || 0,
          2,
        );
      }

      const category = FINDING_CATEGORY_MAP[finding.finding_type];
      if (category) {
        stats.categories[category] = (stats.categories[category] || 0) + 1;
        const severityRank =
          finding.severity === "high"
            ? 3
            : finding.severity === "medium"
              ? 2
              : 1;
        stats.categoryRisk[category] = Math.max(
          stats.categoryRisk[category] || 0,
          severityRank,
        );
      }

      if (finding.finding_type === "email") stats.emails += 1;
      if (finding.finding_type === "screenshot") stats.screenshots += 1;
      if (finding.severity === "high" || finding.severity === "medium") {
        stats.sensitiveFiles += 1;
        stats.categories["Sensitive Files"] =
          (stats.categories["Sensitive Files"] || 0) + 1;
        stats.categoryRisk["Sensitive Files"] = Math.max(
          stats.categoryRisk["Sensitive Files"] || 0,
          finding.severity === "high" ? 3 : 2,
        );
      }
    }

    for (const hit of gpsHits) {
      const folder = getFolderName(hit.file_path);
      const stats = addFolder(folder);
      stats.gpsCount += 1;
      stats.debtScore += 8;
      stats.categories["GPS Metadata"] =
        (stats.categories["GPS Metadata"] || 0) + 1;
      stats.categoryRisk["GPS Metadata"] = Math.max(
        stats.categoryRisk["GPS Metadata"] || 0,
        3,
      );
    }

    // Find max raw score for normalization
    const maxRawScore = Math.max(
      ...Array.from(folderMap.values()).map((s) => s.debtScore),
      1, // avoid division by zero
    );

    const folderStats = Array.from(folderMap.values()).map((stats) => {
      // Normalize to 0-100 based on max raw score
      const normalizedScore = Math.round((stats.debtScore / maxRawScore) * 100);
      return {
        ...stats,
        rawScore: stats.debtScore,
        debtScore: normalizedScore,
        riskLevel: getRiskLevel(normalizedScore),
      };
    });

    const folderBreakdown = folderStats
      .sort((a, b) => b.debtScore - a.debtScore)
      .map((stats) => ({
        name: stats.folder,
        rawScore: stats.rawScore,
        debtScore: stats.debtScore,
        riskLevel: stats.riskLevel,
        screenshots: stats.screenshots,
        emails: stats.emails,
        documents: stats.documents,
        sensitiveFiles: stats.sensitiveFiles,
        gpsCount: stats.gpsCount,
        findingsCount: stats.findingsCount,
      }));

    const treemapData = folderStats
      .map((stats) => ({
        name: stats.folder,
        value: stats.debtScore,
        riskLevel: stats.riskLevel,
        children: Object.entries(stats.categories)
          .filter(([, value]) => value > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({
            name,
            value,
            folder: stats.folder,
            riskLevel: getCategoryRiskLevel(stats.categoryRisk[name]),
          })),
      }))
      .filter((node) => node.children.length > 0);

    const topFolder = folderBreakdown[0] || {
      name: "Downloads",
      rawScore: 0,
      debtScore: 0,
      riskLevel: "LOW",
      screenshots: 0,
      emails: 0,
      documents: 0,
      sensitiveFiles: 0,
      gpsCount: 0,
      findingsCount: 0,
    };

    const topFolderStats =
      folderStats.find((row) => row.folder === topFolder.name) || topFolder;

    const summary = (() => {
      const { screenshots, emails, gpsCount, sensitiveFiles } = topFolderStats;

      if (screenshots > 0 && emails > 0) {
        return "Sensitive screenshots and email addresses detected.";
      }

      if (screenshots > 0 && gpsCount > 0) {
        return "Images containing location metadata detected.";
      }

      if (emails > 10) {
        return "Large number of email addresses detected.";
      }

      if (sensitiveFiles > 10) {
        return "Multiple sensitive files detected.";
      }

      if (screenshots > 0) {
        return "Screenshot files containing personal content detected.";
      }

      if (gpsCount > 0) {
        return "GPS metadata detected in images.";
      }

      if (emails > 0) {
        return "Email addresses found in this folder.";
      }

      if (sensitiveFiles > 0) {
        return "Sensitive items found in this folder.";
      }

      return "Potential privacy risk found in this folder.";
    })();

    const recommendedAction =
      topFolder.riskLevel === "HIGH"
        ? "Review and purge exposed files"
        : topFolder.riskLevel === "MEDIUM"
          ? "Review sensitive files"
          : "No immediate action required";

    const response = {
      privacyDebt: session.risk_score,
      riskLevel:
        session.risk_level?.toUpperCase() || getRiskLevel(session.risk_score),
      foldersScanned: folderBreakdown.length,
      highRiskFolders: folderBreakdown.filter(
        (folder) => folder.riskLevel === "HIGH",
      ).length,
      topRiskFolder: topFolder.name,
      folderInsights: {
        folder: topFolder.name,
        rawScore: topFolderStats.rawScore,
        debtScore: topFolder.debtScore,
        screenshots: topFolderStats.screenshots,
        emails: topFolderStats.emails,
        documents: topFolderStats.documents,
        sensitiveFiles: topFolderStats.sensitiveFiles,
        lastScanned: formatRelativeTime(
          session.finished_at || session.started_at,
        ),
        riskLevel: topFolder.riskLevel,
        summary,
        recommendedAction,
      },
      folderBreakdown,
      treemapData,
    };

    console.log(JSON.stringify(folderBreakdown, null, 2));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tracker fingerprint map graph data
app.get("/api/trackers/:sessionId", async (req, res) => {
  try {
    const summary = await analyzeTrackers(req.params.sessionId);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`PrivyScan backend running on http://localhost:${PORT}`);
});
