const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const { runScan } = require("./scanner/filesystemScanner");

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
    const { paths } = req.body;
    if (!paths || paths.length === 0) {
      return res.status(400).json({ error: "No paths provided" });
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

// Get all sessions
app.get("/api/sessions", (req, res) => {
  const sessions = db
    .prepare("SELECT * FROM scan_sessions ORDER BY started_at DESC")
    .all();
  res.json(sessions);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`PrivyScan backend running on http://localhost:${PORT}`);
});
