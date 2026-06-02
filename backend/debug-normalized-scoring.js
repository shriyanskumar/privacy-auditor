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

// Process findings
for (const finding of findings) {
  const folder = getFolderName(finding.file_path);
  if (!folderMap.has(folder)) {
    folderMap.set(folder, { rawScore: 0 });
  }
  folderMap.get(folder).rawScore += FOLDER_WEIGHTS[finding.finding_type] ?? 5;
}

// Process GPS hits
for (const hit of gpsHits) {
  const folder = getFolderName(hit.file_path);
  if (!folderMap.has(folder)) {
    folderMap.set(folder, { rawScore: 0 });
  }
  folderMap.get(folder).rawScore += 8;
}

// Find max raw score
const maxRawScore = Math.max(
  ...Array.from(folderMap.values()).map((s) => s.rawScore),
  1,
);

console.log("FOLDER SCORING BREAKDOWN:");
console.log("=========================\n");
console.log("Maximum raw score (baseline for normalization):", maxRawScore);
console.log();

const sortedFolders = Array.from(folderMap.entries())
  .sort((a, b) => b[1].rawScore - a[1].rawScore)
  .map(([folder, stats]) => {
    const normalizedScore = Math.round((stats.rawScore / maxRawScore) * 100);
    const riskLevel =
      normalizedScore >= 70 ? "HIGH" : normalizedScore >= 35 ? "MEDIUM" : "LOW";
    return { folder, rawScore: stats.rawScore, normalizedScore, riskLevel };
  });

sortedFolders.forEach((r) => {
  console.log("Folder: " + r.folder);
  console.log("  rawScore: " + r.rawScore);
  console.log(
    "  formula: Math.round((" + r.rawScore + " / " + maxRawScore + ") * 100)",
  );
  console.log("  debtScore (normalized): " + r.normalizedScore);
  console.log("  riskLevel: " + r.riskLevel);
  console.log(
    "  STATUS: " +
      (r.normalizedScore >= 100 ? "100 (max)" : "preserved ranking ✓"),
  );
  console.log();
});
