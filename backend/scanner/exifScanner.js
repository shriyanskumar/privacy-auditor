const exifr = require("exifr");
const db = require("../db");

async function scanExif(filePath, sessionId) {
  try {
    const data = await exifr.parse(filePath, {
      gps: true,
      pick: ["Make", "Model", "Software", "latitude", "longitude"],
    });

    if (!data) return;

    const hasGps = !!(data.latitude && data.longitude);

    db.prepare(
      `INSERT INTO metadata_hits 
       (session_id, file_path, has_gps, lat, lon, device_model, software) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sessionId,
      filePath,
      hasGps ? 1 : 0,
      data.latitude ?? null,
      data.longitude ?? null,
      [data.Make, data.Model].filter(Boolean).join(" ") || null,
      data.Software ?? null,
    );
  } catch (e) {
    // corrupt or unreadable EXIF — skip
  }
}

module.exports = { scanExif };
