const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const { runScan } = require("./scanner/filesystemScanner");
const { analyzeTrackers } = require("./scanner/trackerAnalyzer");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PrivyScan backend running" });
});

// Start a scan
app.post("/api/scan", async (req, res) => {
  try {
    let paths = req.body?.paths;

    if (!paths || paths.length === 0) {
      paths = [`${process.env.USERPROFILE}\\Downloads`];
    }

    const sessionId = await runScan(paths);
    res.json({ sessionId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get results for a session
app.get("/api/results/:sessionId", (req, res) => {
  try {
    const session = db
      .prepare("SELECT * FROM scan_sessions WHERE id = ?")
      .get(req.params.sessionId);

    const findings = db
      .prepare(
        "SELECT * FROM findings WHERE session_id = ? ORDER BY severity DESC",
      )
      .all(req.params.sessionId);

    const browserData = db
      .prepare("SELECT * FROM browser_data WHERE session_id = ?")
      .all(req.params.sessionId);

    const metadataHits = db
      .prepare("SELECT * FROM metadata_hits WHERE session_id = ?")
      .all(req.params.sessionId);

    res.json({ session, findings, browserData, metadataHits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/exif/:sessionId", (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    const total = db
      .prepare("SELECT COUNT(*) AS count FROM metadata_hits WHERE session_id = ?")
      .get(sessionId).count;

    const withGps = db
      .prepare("SELECT COUNT(*) AS count FROM metadata_hits WHERE session_id = ? AND has_gps = 1")
      .get(sessionId).count;

    const locations = db
      .prepare(
        "SELECT id, file_path, lat, lon, device_model, software, has_gps FROM metadata_hits WHERE session_id = ? AND has_gps = 1"
      )
      .all(sessionId)
      .map((row) => ({
        ...row,
        filename: path.basename(row.file_path),
      }));

    res.json({ locations, total, with_gps: withGps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sessions
app.get("/api/sessions", (req, res) => {
  const sessions = db
    .prepare("SELECT * FROM scan_sessions ORDER BY started_at DESC")
    .all();
  res.json(sessions);
});

// Tracker fingerprint map graph data
app.get("/api/trackers/:sessionId", async (req, res) => {
  try {
    const summary = await analyzeTrackers(req.params.sessionId);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`PrivyScan backend running on http://localhost:${PORT}`);
});
