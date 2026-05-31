const exifr = require("exifr");
const db = require("../db");
const path = require("path");

async function scanExif(filePath, sessionId) {
  try {
    const data = await exifr.parse(filePath, {
      gps: true,
      tiff: true,
      exif: true,
    });

    if (!data) return;

    const lat = data.latitude ?? null;
    const lon = data.longitude ?? null;
    const hasGps = lat !== null && lon !== null ? 1 : 0;

    db.prepare(
      `INSERT INTO metadata_hits 
       (session_id, file_path, has_gps, lat, lon, device_model, software) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sessionId,
      filePath,
      hasGps,
      lat,
      lon,
      [data.Make, data.Model].filter(Boolean).join(" ") || null,
      data.Software ?? null,
    );
  } catch (e) {
    // skip unreadable files
  }
}

module.exports = { scanExif };
