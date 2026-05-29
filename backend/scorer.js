const db = require("./db");

const WEIGHTS = {
  credit_card: 30,
  aadhaar: 25,
  pan_card: 20,
  api_key: 20,
  password_keyword: 15,
  shadow_copy: 12,
  suspicious_filename: 10,
  phone: 5,
  email: 3,
};

function scoreScan(sessionId) {
  const findings = db
    .prepare("SELECT finding_type FROM findings WHERE session_id = ?")
    .all(sessionId);

  const gpsHits = db
    .prepare(
      "SELECT COUNT(*) as c FROM metadata_hits WHERE session_id = ? AND has_gps = 1",
    )
    .get(sessionId);

  let score = 0;
  for (const f of findings) {
    score += WEIGHTS[f.finding_type] ?? 5;
  }

  if (gpsHits.c > 0) score += gpsHits.c * 8;
  score = Math.min(score, 100);

  const level = score >= 70 ? "High" : score >= 35 ? "Moderate" : "Low";
  return { score, level };
}

module.exports = scoreScan;
