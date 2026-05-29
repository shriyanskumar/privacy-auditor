const fs = require("fs");
const { glob } = require("glob");
const db = require("../db");

const SHADOW_PATTERNS = [
  /final/i,
  /backup/i,
  /copy/i,
  /old/i,
  /v\d+/i,
  /\(\d+\)/,
  /_\d{8}/,
  /archive/i,
];

const SENSITIVE_EXTENSIONS = [
  ".env",
  ".csv",
  ".json",
  ".txt",
  ".pdf",
  ".xls",
  ".xlsx",
];

function detectShadowCopies(directories, sessionId) {
  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;

    let files = [];
    try {
      files = fs.readdirSync(dir, { recursive: true });
    } catch (e) {
      continue;
    }

    for (const file of files) {
      const ext = require("path").extname(file).toLowerCase();
      const name = require("path").basename(file);

      const isSensitiveExt = SENSITIVE_EXTENSIONS.includes(ext);
      const isShadowName = SHADOW_PATTERNS.some((r) => r.test(name));

      if (isSensitiveExt && isShadowName) {
        const fullPath = require("path").join(dir, file);
        db.prepare(
          `INSERT INTO findings 
           (session_id, file_path, finding_type, severity, snippet) 
           VALUES (?, ?, ?, ?, ?)`,
        ).run(sessionId, fullPath, "shadow_copy", "medium", name);
      }
    }
  }
}

module.exports = { detectShadowCopies };
