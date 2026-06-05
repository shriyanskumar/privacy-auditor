const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { globSync } = require("glob");
const db = require("../db");

// Name-based shadow patterns
const SHADOW_PATTERNS = [
  { regex: /final/i, name: "final" },
  { regex: /backup/i, name: "backup" },
  { regex: /\bcopy\b/i, name: "copy" },
  { regex: /\bold\b/i, name: "old" },
  { regex: /v\d+/i, name: "version" },
  { regex: /\(\d+\)/, name: "numbered_copy" },
  { regex: /_\d{8}/, name: "date_suffix" },
  { regex: /archive/i, name: "archive" },
  { regex: /temp/i, name: "temp" },
  { regex: /draft/i, name: "draft" },
];

// Extensions to look for name-based shadows
const SHADOW_NAME_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".rtf",
  ".txt", ".csv", ".md", ".json", ".xml", ".yml", ".yaml", ".log", ".env",
  ".jpg", ".jpeg", ".png", ".gif", ".tiff", ".bmp", ".heic", ".webp",
  ".mp4", ".mov", ".avi", ".mkv",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".py", ".js", ".ts", ".html", ".css",
  ".msi", ".exe", ".dmg", ".pkg",
];

// Extensions for content-hash duplicate detection (exclude large binaries/media)
const HASH_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".rtf",
  ".txt", ".csv", ".md", ".json", ".xml", ".yml", ".yaml", ".log",
  ".jpg", ".jpeg", ".png", ".gif", ".tiff", ".bmp", ".heic", ".webp",
];

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".tiff", ".bmp", ".heic", ".webp"]);

function getDetectedPattern(filename) {
  for (const pattern of SHADOW_PATTERNS) {
    if (pattern.regex.test(filename)) return pattern.name;
  }
  return "unknown";
}

function computeHash(filePath) {
  try {
    const hash = crypto.createHash("sha256");
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest("hex");
  } catch (e) {
    return null;
  }
}

function getAllFiles(dir) {
  // Use forward slashes for glob on Windows
  const normalized = path.resolve(dir).replace(/\\/g, "/");
  try {
    return globSync(`${normalized}/**/*`, {
      nodir: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
      absolute: true,
    });
  } catch (e) {
    console.error("[shadowCopyDetector] glob error for", dir, e.message);
    return [];
  }
}

function detectShadowCopies(directories, sessionId) {
  const nameCandidates = [];
  const hashCandidates = [];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;

    const files = getAllFiles(dir);
    console.log(`[shadowCopyDetector] ${dir}: ${files.length} files found`);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const name = path.basename(file);

      if (SHADOW_NAME_EXTENSIONS.includes(ext)) {
        nameCandidates.push({ path: file, name, ext });
      }
      if (HASH_EXTENSIONS.includes(ext)) {
        hashCandidates.push({ path: file, name, ext });
      }
    }
  }

  console.log(`[shadowCopyDetector] Name candidates: ${nameCandidates.length}, Hash candidates: ${hashCandidates.length}`);

  // ── 1. Name-based shadow detection ──
  for (const item of nameCandidates) {
    const isShadow = SHADOW_PATTERNS.some((p) => p.regex.test(item.name));
    if (!isShadow) continue;

    const detectedPattern = getDetectedPattern(item.name);
    const detectedAt = new Date().toISOString();
    let fileSize = 0;
    try { fileSize = fs.statSync(item.path).size; } catch (e) {}

    const exists = db
      .prepare("SELECT id FROM shadow_copies WHERE session_id = ? AND file_path = ?")
      .get(sessionId, item.path);
    if (exists) continue;

    const severity = fileSize > 10 * 1024 * 1024 ? "high" : "medium";

    db.prepare(
      `INSERT INTO shadow_copies (session_id, file_path, filename, file_size, detected_pattern, file_extension, severity, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sessionId, item.path, item.name, fileSize, detectedPattern, item.ext, severity, detectedAt);

    // Also record in findings so heatmap picks it up
    db.prepare(
      `INSERT INTO findings (session_id, file_path, finding_type, severity, snippet)
       VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, item.path, "shadow_copy", severity, item.name);
  }

  // ── 2. Content-hash duplicate detection ──
  const hashMap = Object.create(null);
  for (const item of hashCandidates) {
    const h = computeHash(item.path);
    if (!h) continue;
    if (!hashMap[h]) hashMap[h] = [];
    hashMap[h].push(item);
  }

  for (const list of Object.values(hashMap)) {
    if (list.length < 2) continue;

    for (const item of list) {
      const detectedAt = new Date().toISOString();
      let fileSize = 0;
      try { fileSize = fs.statSync(item.path).size; } catch (e) {}

      const exists = db
        .prepare("SELECT id FROM shadow_copies WHERE session_id = ? AND file_path = ?")
        .get(sessionId, item.path);
      if (exists) continue;

      const severity = IMAGE_EXTENSIONS.has(item.ext) ? "high" : "medium";

      db.prepare(
        `INSERT INTO shadow_copies (session_id, file_path, filename, file_size, detected_pattern, file_extension, severity, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(sessionId, item.path, item.name, fileSize, "duplicate", item.ext, severity, detectedAt);

      db.prepare(
        `INSERT INTO findings (session_id, file_path, finding_type, severity, snippet)
         VALUES (?, ?, ?, ?, ?)`
      ).run(sessionId, item.path, "shadow_copy", severity, item.name);
    }
  }

  // Log totals
  const total = db.prepare("SELECT COUNT(*) as c FROM shadow_copies WHERE session_id = ?").get(sessionId);
  console.log(`[shadowCopyDetector] Session ${sessionId}: ${total.c} shadow copies recorded`);
}

module.exports = { detectShadowCopies };
