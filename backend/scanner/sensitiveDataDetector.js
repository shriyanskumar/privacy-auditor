const PATTERNS = [
  {
    type: "email",
    severity: "low",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g,
    redact: (m) => m.slice(0, 2) + "••••@" + m.split("@")[1],
  },
  {
    type: "phone",
    severity: "low",
    regex: /(\+91[\-\s]?)?[6-9]\d{9}/g,
    redact: (m) => m.slice(0, 3) + "•••••" + m.slice(-2),
  },
  {
    type: "credit_card",
    severity: "high",
    regex: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    redact: (m) => "•••• •••• •••• " + m.replace(/\D/g, "").slice(-4),
  },
  {
    type: "pan_card",
    severity: "high",
    regex: /[A-Z]{5}[0-9]{4}[A-Z]/g,
    redact: (m) => m.slice(0, 3) + "•••••" + m.slice(-2),
  },
  {
    type: "aadhaar",
    severity: "high",
    regex: /\b[2-9]{1}[0-9]{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b/g,
    redact: (m) => "•••• •••• " + m.replace(/\D/g, "").slice(-4),
  },
  {
    type: "api_key",
    severity: "high",
    regex: /(sk-|ghp_|AIza|AKIA|xoxb-|ya29\.)[A-Za-z0-9\-_]{10,}/g,
    redact: (m) => m.slice(0, 6) + "••••••••",
  },
  {
    type: "password_keyword",
    severity: "medium",
    regex: /(password|passwd|pwd)\s*[:=]\s*\S+/gi,
    redact: (m) => m.split(/[:=]/)[0] + "=••••••",
  },
];

function detectSensitiveData(content) {
  const hits = [];
  for (const p of PATTERNS) {
    const matches = [...content.matchAll(p.regex)];
    for (const match of matches.slice(0, 5)) {
      hits.push({
        type: p.type,
        severity: p.severity,
        snippet: p.redact(match[0]),
      });
    }
  }
  return hits;
}

module.exports = { detectSensitiveData };
