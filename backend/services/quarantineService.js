const fs = require("fs");
const path = require("path");
const db = require("../db");
const scoreScan = require("../scorer");

const QUARANTINE_DIR = path.join(__dirname, "../quarantine");

/**
 * Ensures the quarantine directory exists.
 */
function ensureQuarantineDir() {
  if (!fs.existsSync(QUARANTINE_DIR)) {
    fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
  }
}

/**
 * Moves a file to quarantine, records it in the DB, and removes active finding.
 * @param {number} sessionId 
 * @param {string} filePath 
 * @param {string} category - 'duplicate' | 'shadow_copy' | 'sensitive_file'
 */
function quarantineFile(sessionId, filePath, category) {
  ensureQuarantineDir();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Target file not found on disk: ${filePath}`);
  }

  const filename = path.basename(filePath);
  const targetName = `q_${Date.now()}_${filename}`;
  const quarantinePath = path.join(QUARANTINE_DIR, targetName);

  // 1. Gather original database rows to preserve on restore
  let originalMetadata = {};
  if (category === "duplicate" || category === "shadow_copy") {
    const row = db
      .prepare("SELECT * FROM shadow_copies WHERE session_id = ? AND file_path = ?")
      .get(sessionId, filePath);
    if (row) originalMetadata = { type: "shadow_copy", data: row };
  } else if (category === "sensitive_file") {
    const rows = db
      .prepare("SELECT * FROM findings WHERE session_id = ? AND file_path = ?")
      .all(sessionId, filePath);
    if (rows && rows.length > 0) {
      originalMetadata = { type: "findings", data: rows };
    }
  }

  // If no specific metadata was matched but we still have findings, grab whatever is available
  if (!originalMetadata.type) {
    const findingsRows = db
      .prepare("SELECT * FROM findings WHERE session_id = ? AND file_path = ?")
      .all(sessionId, filePath);
    const shadowRows = db
      .prepare("SELECT * FROM shadow_copies WHERE session_id = ? AND file_path = ?")
      .all(sessionId, filePath);
    
    originalMetadata = {
      type: "hybrid",
      findings: findingsRows || [],
      shadow_copies: shadowRows || [],
    };
  }

  // 2. Perform the physical move
  try {
    fs.renameSync(filePath, quarantinePath);
  } catch (err) {
    // Fallback for cross-device moves
    fs.copyFileSync(filePath, quarantinePath);
    fs.unlinkSync(filePath);
  }

  // 3. Record in quarantined_files
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO quarantined_files 
    (session_id, original_path, quarantine_path, filename, category, action_taken, quarantined_at, status, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'quarantined', ?)
  `).run(
    sessionId,
    filePath,
    quarantinePath,
    filename,
    category,
    "quarantined",
    now,
    JSON.stringify(originalMetadata)
  );

  // 4. Remove active records from findings and shadow_copies
  db.prepare("DELETE FROM findings WHERE session_id = ? AND file_path = ?").run(sessionId, filePath);
  db.prepare("DELETE FROM shadow_copies WHERE session_id = ? AND file_path = ?").run(sessionId, filePath);

  // 5. Recalculate score and update session table
  const scoreResult = scoreScan(sessionId);
  db.prepare(`
    UPDATE scan_sessions 
    SET risk_score = ?, risk_level = ? 
    WHERE id = ?
  `).run(scoreResult.score, scoreResult.level, sessionId);

  return { success: true, quarantinePath };
}

/**
 * Returns active quarantined files.
 */
function getQuarantinedFiles(sessionId = null) {
  if (sessionId) {
    return db
      .prepare("SELECT * FROM quarantined_files WHERE session_id = ? AND status = 'quarantined' ORDER BY quarantined_at DESC")
      .all(sessionId);
  }
  return db
    .prepare("SELECT * FROM quarantined_files WHERE status = 'quarantined' ORDER BY quarantined_at DESC")
    .all();
}

module.exports = {
  quarantineFile,
  getQuarantinedFiles,
};
