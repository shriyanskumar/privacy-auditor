const fs = require("fs");
const path = require("path");
const db = require("../db");
const scoreScan = require("../scorer");

/**
 * Restores a file or metadata from quarantine back to its original location.
 * @param {number} id - Quarantine record ID
 */
function restoreItem(id) {
  const item = db
    .prepare("SELECT * FROM quarantined_files WHERE id = ?")
    .get(id);
  if (!item) {
    throw new Error(`Quarantine record not found for ID: ${id}`);
  }

  const {
    session_id,
    original_path,
    quarantine_path,
    category,
    action_taken,
    metadata,
  } = item;

  if (!fs.existsSync(quarantine_path)) {
    throw new Error(
      `Quarantined backup file not found on disk: ${quarantine_path}`,
    );
  }

  // 1. Handle physical restore
  if (action_taken === "quarantined") {
    // Check if the target directory exists
    const targetDir = path.dirname(original_path);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      fs.renameSync(quarantine_path, original_path);
    } catch (err) {
      // Fallback for cross-device moves
      fs.copyFileSync(quarantine_path, original_path);
      fs.unlinkSync(quarantine_path);
    }
  } else if (action_taken === "metadata_stripped") {
    // GPS restore: overwrite the stripped file with the backup original
    try {
      fs.copyFileSync(quarantine_path, original_path);
      fs.unlinkSync(quarantine_path);
    } catch (err) {
      throw new Error(`Failed to restore original file: ${err.message}`);
    }
  }

  // 2. Handle database restore
  const meta = JSON.parse(metadata || "{}");

  if (action_taken === "quarantined") {
    if (meta.type === "shadow_copy" && meta.data) {
      const d = meta.data;
      db.prepare(
        `
        INSERT INTO shadow_copies 
        (session_id, file_path, filename, file_size, detected_pattern, file_extension, severity, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        d.session_id,
        d.file_path,
        d.filename,
        d.file_size,
        d.detected_pattern,
        d.file_extension,
        d.severity,
        d.detected_at,
      );
    } else if (meta.type === "findings" && meta.data) {
      const rows = Array.isArray(meta.data) ? meta.data : [meta.data];
      for (const r of rows) {
        db.prepare(
          `
          INSERT INTO findings 
          (session_id, file_path, finding_type, severity, snippet)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(r.session_id, r.file_path, r.finding_type, r.severity, r.snippet);
      }
    } else if (meta.type === "hybrid") {
      if (meta.findings) {
        for (const r of meta.findings) {
          db.prepare(
            `
            INSERT INTO findings 
            (session_id, file_path, finding_type, severity, snippet)
            VALUES (?, ?, ?, ?, ?)
          `,
          ).run(
            r.session_id,
            r.file_path,
            r.finding_type,
            r.severity,
            r.snippet,
          );
        }
      }
      if (meta.shadow_copies) {
        for (const d of meta.shadow_copies) {
          db.prepare(
            `
            INSERT INTO shadow_copies 
            (session_id, file_path, filename, file_size, detected_pattern, file_extension, severity, detected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          ).run(
            d.session_id,
            d.file_path,
            d.filename,
            d.file_size,
            d.detected_pattern,
            d.file_extension,
            d.severity,
            d.detected_at,
          );
        }
      }
    }
  } else if (action_taken === "metadata_stripped") {
    if (meta.type === "metadata_hits" && meta.data) {
      const d = meta.data;
      db.prepare(
        `
        UPDATE metadata_hits 
        SET has_gps = 1, lat = ?, lon = ? 
        WHERE session_id = ? AND file_path = ?
      `,
      ).run(d.lat, d.lon, session_id, original_path);
    }
  }

  // 3. Update quarantine record status
  db.prepare(
    "UPDATE quarantined_files SET status = 'restored' WHERE id = ?",
  ).run(id);

  // 4. Recalculate score and update session
  const scoreResult = scoreScan(session_id);
  db.prepare(
    `
    UPDATE scan_sessions 
    SET risk_score = ?, risk_level = ? 
    WHERE id = ?
  `,
  ).run(scoreResult.score, scoreResult.level, session_id);

  return { success: true };
}

function restoreAllItems() {
  const items = db
    .prepare(
      `
    SELECT id
    FROM quarantined_files
    WHERE status = 'quarantined'
  `,
    )
    .all();

  const results = [];

  for (const item of items) {
    try {
      restoreItem(item.id);
      results.push({
        id: item.id,
        success: true,
      });
    } catch (err) {
      results.push({
        id: item.id,
        success: false,
        error: err.message,
      });
    }
  }

  return {
    restored: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Permanently deletes a quarantined item from disk and the quarantine registry.
 * @param {number} id - Quarantine record ID
 */
function deleteItemPermanently(id) {
  const item = db
    .prepare("SELECT * FROM quarantined_files WHERE id = ?")
    .get(id);
  if (!item) {
    throw new Error(`Quarantine record not found for ID: ${id}`);
  }

  // Delete quarantined file from disk
  if (fs.existsSync(item.quarantine_path)) {
    fs.unlinkSync(item.quarantine_path);
  }

  // Update status to 'deleted'
  db.prepare(
    "UPDATE quarantined_files SET status = 'deleted' WHERE id = ?",
  ).run(id);

  return { success: true };
}

module.exports = {
  restoreItem,
  restoreAllItems,
  deleteItemPermanently,
};
