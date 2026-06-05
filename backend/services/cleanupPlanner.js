const path = require("path");
const db = require("../db");

const WEIGHTS = {
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

/**
 * Formats a file size in bytes to a human-readable string.
 */
function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return "0 KB";
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(2)} MB`;
  }
  return `${kb.toFixed(1)} KB`;
}

/**
 * Analyzes findings for a session and generates a cleanup plan.
 * @param {number} sessionId 
 */
function generateCleanupPlan(sessionId) {
  const session = db.prepare("SELECT * FROM scan_sessions WHERE id = ?").get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const currentScore = session.risk_score || 0;

  // 1. Fetch raw findings
  const shadowCopies = db
    .prepare("SELECT * FROM shadow_copies WHERE session_id = ?")
    .all(sessionId);

  const gpsHits = db
    .prepare("SELECT * FROM metadata_hits WHERE session_id = ? AND has_gps = 1")
    .all(sessionId);

  const findings = db
    .prepare("SELECT * FROM findings WHERE session_id = ?")
    .all(sessionId);

  // Keep track of which files are assigned to which categories
  const processedPaths = new Set();
  const duplicateFiles = [];
  const shadowCopiesList = [];
  const gpsMetadataList = [];
  const sensitiveFilesList = [];

  // Category 1: Duplicate Files
  for (const item of shadowCopies) {
    if (item.detected_pattern === "duplicate") {
      duplicateFiles.push({
        id: item.id,
        filePath: item.file_path,
        filename: item.filename,
        size: formatSize(item.file_size),
        extension: item.file_extension,
      });
      processedPaths.add(item.file_path);
    }
  }

  // Category 2: Shadow Copies (name-based)
  for (const item of shadowCopies) {
    if (item.detected_pattern !== "duplicate") {
      shadowCopiesList.push({
        id: item.id,
        filePath: item.file_path,
        filename: item.filename,
        size: formatSize(item.file_size),
        extension: item.file_extension,
        pattern: item.detected_pattern,
      });
      processedPaths.add(item.file_path);
    }
  }

  // Category 3: Sensitive Files (from findings table, not already quarantined)
  for (const item of findings) {
    if (!processedPaths.has(item.file_path)) {
      let fileSize = 0;
      try {
        const stats = require("fs").statSync(item.file_path);
        fileSize = stats.size;
      } catch (e) {}

      sensitiveFilesList.push({
        id: item.id,
        filePath: item.file_path,
        filename: path.basename(item.file_path),
        size: formatSize(fileSize),
        type: item.finding_type,
        severity: item.severity,
      });
      processedPaths.add(item.file_path);
    }
  }

  // Category 4: GPS Metadata (remaining items with GPS data)
  for (const item of gpsHits) {
    if (!processedPaths.has(item.file_path)) {
      let fileSize = 0;
      try {
        const stats = require("fs").statSync(item.file_path);
        fileSize = stats.size;
      } catch (e) {}

      gpsMetadataList.push({
        id: item.id,
        filePath: item.file_path,
        filename: path.basename(item.file_path),
        size: formatSize(fileSize),
        lat: item.lat,
        lon: item.lon,
        device: item.device_model || "Unknown Device",
      });
    }
  }

  // Build category objects
  const categories = [];

  if (duplicateFiles.length > 0) {
    categories.push({
      name: "Duplicate Files",
      action: "Move to Quarantine",
      count: duplicateFiles.length,
      files: duplicateFiles,
    });
  }

  if (shadowCopiesList.length > 0) {
    categories.push({
      name: "Shadow Copies",
      action: "Move to Quarantine",
      count: shadowCopiesList.length,
      files: shadowCopiesList,
    });
  }

  if (sensitiveFilesList.length > 0) {
    categories.push({
      name: "Sensitive Files",
      action: "Move to Quarantine",
      count: sensitiveFilesList.length,
      files: sensitiveFilesList,
    });
  }

  if (gpsMetadataList.length > 0) {
    categories.push({
      name: "GPS Metadata",
      action: "Strip GPS Metadata",
      count: gpsMetadataList.length,
      files: gpsMetadataList,
    });
  }

  const affectedFilesCount =
    duplicateFiles.length +
    shadowCopiesList.length +
    sensitiveFilesList.length +
    gpsMetadataList.length;

  // 2. Projected Score Calculation
  // We assume all planned remediations are executed.
  // Quarantined files will have their findings deleted, and stripped GPS will have has_gps = 0.
  // Find which active findings will remain:
  const quarantinedFilePaths = new Set([
    ...duplicateFiles.map((f) => f.filePath),
    ...shadowCopiesList.map((f) => f.filePath),
    ...sensitiveFilesList.map((f) => f.filePath),
  ]);

  const strippedGpsFilePaths = new Set(gpsMetadataList.map((f) => f.filePath));

  // Calculate projected score using scorer formula
  let projectedScore = 0;

  // Remaining findings
  for (const f of findings) {
    if (!quarantinedFilePaths.has(f.file_path)) {
      projectedScore += WEIGHTS[f.finding_type] ?? 5;
    }
  }

  // Remaining GPS hits
  let remainingGpsCount = 0;
  for (const h of gpsHits) {
    if (!quarantinedFilePaths.has(h.file_path) && !strippedGpsFilePaths.has(h.file_path)) {
      remainingGpsCount++;
    }
  }

  if (remainingGpsCount > 0) {
    projectedScore += remainingGpsCount * 8;
  }

  projectedScore = Math.min(projectedScore, 100);
  const scoreReduction = Math.max(0, currentScore - projectedScore);

  return {
    currentScore,
    projectedScore,
    scoreReduction,
    affectedFilesCount,
    affectedCategoriesCount: categories.length,
    categories,
  };
}

module.exports = {
  generateCleanupPlan,
};
