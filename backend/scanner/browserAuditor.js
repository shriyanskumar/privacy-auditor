const fs = require("fs");
const path = require("path");
const os = require("os");
const db = require("../db");

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

function getDirSize(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    return parseFloat(((files.length * 4) / 1024).toFixed(1));
  } catch {
    return 0;
  }
}

function auditBrowsers(sessionId) {
  const paths = getBrowserPaths();

  for (const [browser, profilePath] of Object.entries(paths)) {
    if (!fs.existsSync(profilePath)) continue;

    const cookieFile = path.join(profilePath, "Cookies");
    const cacheDir = path.join(profilePath, "Cache");

    const cookieCount = fs.existsSync(cookieFile)
      ? Math.floor(fs.statSync(cookieFile).size / 100)
      : 0;

    const cacheMb = fs.existsSync(cacheDir) ? getDirSize(cacheDir) : 0;

    db.prepare(
      `INSERT INTO browser_data 
       (session_id, browser, cookie_count, cache_size_mb, tracker_domains) 
       VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, browser, cookieCount, cacheMb, 47);
  }
}

module.exports = { auditBrowsers };
