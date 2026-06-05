const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");
const db = require("../db");

const { detectSensitiveData } = require("./sensitiveDataDetector");
const { scanExif } = require("./exifScanner");
const { detectShadowCopies } = require("./shadowCopyDetector");
const { auditBrowsers } = require("./browserAuditor");

const scoreScan = require("../scorer");

const SUSPICIOUS_NAMES = [
  /password/i,
  /secret/i,
  /credential/i,
  /private[-_]?key/i,
  /api[-_]?key/i,
  /\.env/,
  /backup/i,
  /dump/i,
];

const TEXT_EXTENSIONS = [
  ".txt", ".csv", ".json", ".md", ".log", ".env",
  ".yml", ".yaml", ".xml", ".js", ".py", ".html",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tiff", ".heic", ".webp", ".gif", ".bmp"];

const MAX_FILES = 15000; // increased limit

async function runScan(directories) {
  const info = db
    .prepare(`INSERT INTO scan_sessions (started_at) VALUES (?)`)
    .run(new Date().toISOString());

  const sessionId = info.lastInsertRowid;
  let totalFiles = 0;

  console.log(`[scanner] Session ${sessionId} started. Directories:`, directories);

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.log(`[scanner] Skipping (not found): ${dir}`);
      continue;
    }

    // Normalize to forward-slashes for glob (required on Windows)
    const normalizedDir = path.resolve(dir).replace(/\\/g, "/");
    const globPattern = `${normalizedDir}/**/*`;

    let files = [];
    try {
      files = globSync(globPattern, {
        nodir: true,
        ignore: ["**/node_modules/**", "**/.git/**", "**/.quarantine/**"],
        absolute: true,
      });
    } catch (e) {
      console.error(`[scanner] glob error for ${dir}:`, e.message);
      continue;
    }

    const limited = files.slice(0, MAX_FILES);
    console.log(`[scanner] ${dir}: ${files.length} files found, processing ${limited.length}`);

    for (const filePath of limited) {
      totalFiles++;

      try {
        const ext = path.extname(filePath).toLowerCase();
        const name = path.basename(filePath);

        // ── Suspicious filename check ──
        const isSuspicious = SUSPICIOUS_NAMES.some((r) => r.test(name));
        if (isSuspicious) {
          db.prepare(
            `INSERT INTO findings (session_id, file_path, finding_type, severity, snippet) VALUES (?, ?, ?, ?, ?)`
          ).run(sessionId, filePath, "suspicious_filename", "medium", name);
        }

        // ── Text / structured data scan ──
        if (TEXT_EXTENSIONS.includes(ext)) {
          const content = fs.readFileSync(filePath, "utf8").slice(0, 50000);
          const hits = detectSensitiveData(content);
          for (const hit of hits) {
            db.prepare(
              `INSERT INTO findings (session_id, file_path, finding_type, severity, snippet) VALUES (?, ?, ?, ?, ?)`
            ).run(sessionId, filePath, hit.type, hit.severity, hit.snippet);
          }
        }

        // ── Screenshot detection ──
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const isScreenshot =
            /screenshot|screen[\s_-]?shot|screen[\s_-]?capture/i.test(name) ||
            /screenshots/i.test(filePath);
          if (isScreenshot) {
            db.prepare(
              `INSERT INTO findings (session_id, file_path, finding_type, severity, snippet) VALUES (?, ?, ?, ?, ?)`
            ).run(sessionId, filePath, "screenshot", "medium", name);
          }
        }

        // ── EXIF scan (async) ──
        if (IMAGE_EXTENSIONS.includes(ext)) {
          await scanExif(filePath, sessionId);
        }
      } catch (e) {
        // silently skip unreadable/locked files
      }
    }
  }

  // ── Shadow copy detection (covers all directories) ──
  console.log("[scanner] Running shadow copy detection...");
  detectShadowCopies(directories, sessionId);

  // ── Browser audit ──
  console.log("[scanner] Running browser audit...");
  auditBrowsers(sessionId);

  // ── Final score ──
  const score = scoreScan(sessionId);

  db.prepare(
    `UPDATE scan_sessions SET finished_at = ?, total_files = ?, risk_score = ?, risk_level = ? WHERE id = ?`
  ).run(new Date().toISOString(), totalFiles, score.score, score.level, sessionId);

  console.log(`[scanner] Session ${sessionId} complete. Files: ${totalFiles}, Score: ${score.score} (${score.level})`);
  return sessionId;
}

module.exports = { runScan };
