const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "audit.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS scan_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT,
    finished_at TEXT,
    total_files INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    file_path TEXT,
    finding_type TEXT,
    severity TEXT,
    snippet TEXT,
    FOREIGN KEY(session_id) REFERENCES scan_sessions(id)
  );

  CREATE TABLE IF NOT EXISTS browser_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    browser TEXT,
    cookie_count INTEGER DEFAULT 0,
    history_entries INTEGER DEFAULT 0,
    tracker_domains INTEGER DEFAULT 0,
    cache_size_mb REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS metadata_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    file_path TEXT,
    has_gps INTEGER DEFAULT 0,
    lat REAL,
    lon REAL,
    device_model TEXT,
    software TEXT
  );

  CREATE TABLE IF NOT EXISTS tracker_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    company TEXT,
    category TEXT,
    matched_domain TEXT,
    browser TEXT,
    risk_level TEXT
  );

  CREATE TABLE IF NOT EXISTS shadow_copies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    file_path TEXT,
    filename TEXT,
    file_size INTEGER DEFAULT 0,
    detected_pattern TEXT,
    file_extension TEXT,
    severity TEXT DEFAULT 'medium',
    detected_at TEXT,
    FOREIGN KEY(session_id) REFERENCES scan_sessions(id)
  );
`);

console.log("Database initialized");
module.exports = db;
