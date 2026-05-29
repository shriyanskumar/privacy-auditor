const fs = require("fs");
const path = require("path");
const { glob } = require("glob");
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
  ".txt",
  ".csv",
  ".json",
  ".md",
  ".log",
  ".env",
  ".yml",
  ".yaml",
  ".xml",
  ".js",
  ".py",
  ".html",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tiff", ".heic"];

const MAX_FILES = 10000;

async function runScan(directories) {
  const info = db
    .prepare(`INSERT INTO scan_sessions (started_at) VALUES (?)`)
    .run(new Date().toISOString());

  const sessionId = info.lastInsertRowid;
  let totalFiles = 0;

  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;

    const files = await glob(`${dir}/**/*`, {
      nodir: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
      absolute: true,
    });

    const limited = files.slice(0, MAX_FILES);

    for (const filePath of limited) {
      totalFiles++;

      try {
        const ext = path.extname(filePath).toLowerCase();
        const name = path.basename(filePath);

        // Suspicious filename check
        const isSuspicious = SUSPICIOUS_NAMES.some((r) => r.test(name));

        if (isSuspicious) {
          db.prepare(
            `INSERT INTO findings 
             (session_id, file_path, finding_type, severity, snippet) 
             VALUES (?, ?, ?, ?, ?)`,
          ).run(sessionId, filePath, "suspicious_filename", "medium", name);
        }

        // Text scan
        if (TEXT_EXTENSIONS.includes(ext)) {
          const content = fs.readFileSync(filePath, "utf8").slice(0, 50000);

          const hits = detectSensitiveData(content);

          for (const hit of hits) {
            db.prepare(
              `INSERT INTO findings 
               (session_id, file_path, finding_type, severity, snippet) 
               VALUES (?, ?, ?, ?, ?)`,
            ).run(sessionId, filePath, hit.type, hit.severity, hit.snippet);
          }
        }

        // EXIF scan
        if (IMAGE_EXTENSIONS.includes(ext)) {
          await scanExif(filePath, sessionId);
        }
      } catch (e) {
        // silently skip unreadable files
      }
    }
  }

  // Shadow copies
  detectShadowCopies(directories, sessionId);

  // Browser audit
  auditBrowsers(sessionId);

  // ✅ FINAL SCORE (this is where your error was)
  const score = scoreScan(sessionId);

  db.prepare(
    `UPDATE scan_sessions 
     SET finished_at = ?, total_files = ?, risk_score = ?, risk_level = ? 
     WHERE id = ?`,
  ).run(
    new Date().toISOString(),
    totalFiles,
    score.score,
    score.level,
    sessionId,
  );

  return sessionId;
}

module.exports = { runScan };
