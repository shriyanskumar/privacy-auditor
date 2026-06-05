const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");
const db = require("../db");
const scoreScan = require("../scorer");

const QUARANTINE_DIR = path.join(__dirname, "../quarantine");

/**
 * Strips GPS metadata from an image after backing it up to quarantine.
 * @param {number} sessionId 
 * @param {string} filePath 
 */
async function stripGpsMetadata(sessionId, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Target image not found on disk: ${filePath}`);
  }

  // 1. Gather original database row from metadata_hits
  const originalRow = db
    .prepare("SELECT * FROM metadata_hits WHERE session_id = ? AND file_path = ?")
    .get(sessionId, filePath);

  if (!originalRow) {
    throw new Error(`No metadata record found in database for image: ${filePath}`);
  }

  // 2. Backup the original file to quarantine
  if (!fs.existsSync(QUARANTINE_DIR)) {
    fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
  }

  const filename = path.basename(filePath);
  const backupName = `backup_gps_${Date.now()}_${filename}`;
  const quarantinePath = path.join(QUARANTINE_DIR, backupName);
  
  fs.copyFileSync(filePath, quarantinePath);

  // 3. Record in quarantined_files
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO quarantined_files 
    (session_id, original_path, quarantine_path, filename, category, action_taken, quarantined_at, status, metadata)
    VALUES (?, ?, ?, ?, 'gps_metadata', 'metadata_stripped', ?, 'quarantined', ?)
  `).run(
    sessionId,
    filePath,
    quarantinePath,
    filename,
    now,
    JSON.stringify({ type: "metadata_hits", data: originalRow })
  );

  // 4. Strip metadata from the file on disk using Jimp
  try {
    const image = await Jimp.read(filePath);
    await image.write(filePath); // Jimp automatically strips EXIF metadata on write
  } catch (err) {
    console.error(`Jimp metadata stripping failed for ${filePath}:`, err.message);
    // If Jimp fails, delete quarantine backup and propagate error to prevent DB inconsistency
    if (fs.existsSync(quarantinePath)) {
      fs.unlinkSync(quarantinePath);
    }
    throw new Error(`Failed to clean image metadata: ${err.message}`);
  }

  // 5. Update metadata_hits in database (set has_gps to 0)
  db.prepare(`
    UPDATE metadata_hits 
    SET has_gps = 0, lat = NULL, lon = NULL 
    WHERE session_id = ? AND file_path = ?
  `).run(sessionId, filePath);

  // 6. Recalculate score and update session table
  const scoreResult = scoreScan(sessionId);
  db.prepare(`
    UPDATE scan_sessions 
    SET risk_score = ?, risk_level = ? 
    WHERE id = ?
  `).run(scoreResult.score, scoreResult.level, sessionId);

  return { success: true };
}

module.exports = {
  stripGpsMetadata,
};
