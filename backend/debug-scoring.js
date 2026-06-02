const Database = require("better-sqlite3");
const db = new Database("audit.db");

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

// Get latest session
const latestSession = db
  .prepare("SELECT id FROM scan_sessions ORDER BY started_at DESC LIMIT 1")
  .get();
const sessionId = latestSession.id;
console.log("=== SESSION", sessionId, "===\n");

// Get all findings for this session
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

// Helper to extract folder - using single backslash in regex
const getFolderName = (filePath) => {
  if (!filePath) return "Other";
  // This regex has single backslashes for matching against single backslash paths
  const match = filePath.match(/^[a-zA-Z]:\\Users\\[^\\]+\\([^\\]+)/i);
  if (!match) {
    return "Other";
  }
  const rootFolder = match[1].toLowerCase();
  const folderNameMap = {
    downloads: "Downloads",
    documents: "Documents",
    desktop: "Desktop",
    pictures: "Pictures",
    "my pictures": "Pictures",
    projects: "Projects",
  };
  return folderNameMap[rootFolder] || "Other";
};

// Test on first few
console.log("Testing regex match on first 5 findings:");
for (let i = 0; i < Math.min(5, findings.length); i++) {
  const f = findings[i];
  const folder = getFolderName(f.file_path);
  console.log("  Path:", f.file_path);
  console.log("  => Folder:", folder);
  console.log();
}

// Process findings
for (const finding of findings) {
  const folder = getFolderName(finding.file_path);
  if (!folderMap.has(folder)) {
    folderMap.set(folder, {
      findingsCount: 0,
      gpsCount: 0,
      emails: 0,
      phones: 0,
      screenshots: 0,
      rawScore: 0,
    });
  }
  const stats = folderMap.get(folder);
  stats.findingsCount++;
  stats.rawScore += FOLDER_WEIGHTS[finding.finding_type] ?? 5;
  if (finding.finding_type === "email") stats.emails++;
  if (finding.finding_type === "phone") stats.phones++;
  if (finding.finding_type === "screenshot") stats.screenshots++;
}

// Process GPS hits
for (const hit of gpsHits) {
  const folder = getFolderName(hit.file_path);
  if (!folderMap.has(folder)) {
    folderMap.set(folder, {
      findingsCount: 0,
      gpsCount: 0,
      emails: 0,
      phones: 0,
      screenshots: 0,
      rawScore: 0,
    });
  }
  const stats = folderMap.get(folder);
  stats.gpsCount++;
  stats.rawScore += 8;
}

// Display results
console.log("\n\nFOLDER SCORING BREAKDOWN:");
console.log("=========================\n");

const sortedFolders = Array.from(folderMap.entries()).sort(
  (a, b) => b[1].rawScore - a[1].rawScore,
);

for (const [folder, stats] of sortedFolders) {
  const cappedScore = Math.min(stats.rawScore, 100);
  console.log("Folder: " + folder);
  console.log("  findingsCount: " + stats.findingsCount);
  console.log("  gpsCount: " + stats.gpsCount);
  console.log("  emails: " + stats.emails);
  console.log("  phones: " + stats.phones);
  console.log("  screenshots: " + stats.screenshots);
  console.log("  rawScore (sum of weights + GPS*8): " + stats.rawScore);
  console.log("  cappedScore (Math.min(rawScore, 100)): " + cappedScore);
  console.log("  STATUS: " + (cappedScore >= 100 ? "⚠️ CAPPED AT 100" : "OK"));
  console.log();
}

console.log("\nFOLDER_WEIGHTS configuration:");
console.log(JSON.stringify(FOLDER_WEIGHTS, null, 2));
