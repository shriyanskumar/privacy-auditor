// (Duplicate top block removed to avoid redeclarations)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const glob = require("glob").sync;
const db = require("../db");

// Name-based shadow patterns (keeps original behavior)
const SHADOW_PATTERNS = [
  { regex: /final/i, name: "final" },
  { regex: /backup/i, name: "backup" },
  { regex: /copy/i, name: "copy" },
  { regex: /old/i, name: "old" },
  { regex: /v\d+/i, name: "version" },
  { regex: /\(\d+\)/, name: "numbered_copy" },
  { regex: /_\d{8}/, name: "date_suffix" },
  { regex: /archive/i, name: "archive" },
];

// Targeted extensions: include documents, images, archives, media, configs
const TARGET_EXTENSIONS = [
  // configs / text
  ".env",
  ".txt",
  ".csv",
  ".json",
  ".md",
  ".log",
  ".xml",
  ".yml",
  ".yaml",
  // office
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".rtf",
  // images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".tiff",
  ".bmp",
  ".heic",
  // media
  ".mp4",
  ".mov",
  ".avi",
  // archives
  ".zip",
  ".tar",
  ".gz",
  ".7z",
];

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".tiff", ".bmp", ".heic"]);

function getDetectedPattern(filename) {
  for (const pattern of SHADOW_PATTERNS) {
    if (pattern.regex.test(filename)) {
      return pattern.name;
    }
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

// Scans directories for shadow copies and content duplicates across target extensions
function detectShadowCopies(directories, sessionId) {
  // Collect candidate files
  const candidates = [];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;

    let files = [];
    try {
      files = glob(`${dir.replace(/\\$/,'')}/**/*`, { nodir: true, ignore: ["**/node_modules/**", "**/.git/**"] });
    } catch (e) {
      continue;
    }

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!TARGET_EXTENSIONS.includes(ext)) continue;

      const name = path.basename(file);

      candidates.push({ path: file, name, ext });
    }
  }

  // First: name-based detection (shadow naming patterns)
  for (const item of candidates) {
    const isShadowName = SHADOW_PATTERNS.some((p) => p.regex.test(item.name));
    if (!isShadowName) continue;

    const detectedPattern = getDetectedPattern(item.name);
    const detectedAt = new Date().toISOString();

    // get size if possible
    let fileSize = 0;
    try {
      const stats = fs.statSync(item.path);
      fileSize = stats.size;
    } catch (e) {}

    // avoid duplicate DB entries for same session and path
    const exists = db.prepare(`SELECT id FROM shadow_copies WHERE session_id = ? AND file_path = ?`).get(sessionId, item.path);
    if (exists) continue;

    db.prepare(
      `INSERT INTO shadow_copies (session_id, file_path, filename, file_size, detected_pattern, file_extension, severity, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sessionId, item.path, item.name, fileSize, detectedPattern, item.ext, "medium", detectedAt);
  }

  // Second: content-based duplicate detection using hashes
  const hashMap = Object.create(null);

  for (const item of candidates) {
    let h = computeHash(item.path);
    if (!h) continue;
    if (!hashMap[h]) hashMap[h] = [];
    hashMap[h].push(item);
  }

  for (const [hash, list] of Object.entries(hashMap)) {
    if (list.length < 2) continue; // not a duplicate set

    // For duplicate groups, insert each file as a shadow copy with detected_pattern 'duplicate'
    for (const item of list) {
      const detectedAt = new Date().toISOString();
      let fileSize = 0;
      try {
        const stats = fs.statSync(item.path);
        fileSize = stats.size;
      } catch (e) {}

      // avoid double-insert
      const exists = db.prepare(`SELECT id FROM shadow_copies WHERE session_id = ? AND file_path = ?`).get(sessionId, item.path);
      if (exists) continue;

      const severity = IMAGE_EXTENSIONS.has(item.ext) ? "high" : "medium";

      db.prepare(
        `INSERT INTO shadow_copies (session_id, file_path, filename, file_size, detected_pattern, file_extension, severity, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(sessionId, item.path, item.name, fileSize, "duplicate", item.ext, severity, detectedAt);
    }
  }
}

module.exports = { detectShadowCopies };
