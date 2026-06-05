const express = require("express");
const router = express.Router();
const { generateCleanupPlan } = require("../services/cleanupPlanner");
const {
  quarantineFile,
  getQuarantinedFiles,
} = require("../services/quarantineService");
const { stripGpsMetadata } = require("../services/metadataCleanupService");
const {
  restoreItem,
  restoreAllItems,
  deleteItemPermanently,
} = require("../services/restoreService");
// 1. Preview Cleanup
router.post("/preview", (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const plan = generateCleanupPlan(Number(sessionId));
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Execute Cleanup (Nuke)
router.post("/execute", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const plan = generateCleanupPlan(Number(sessionId));
    let quarantinedCount = 0;
    let metadataStrippedCount = 0;
    const errors = [];

    for (const cat of plan.categories) {
      for (const file of cat.files) {
        try {
          if (cat.action === "Move to Quarantine") {
            let categoryType = "sensitive_file";
            if (cat.name === "Duplicate Files") {
              categoryType = "duplicate";
            } else if (cat.name === "Shadow Copies") {
              categoryType = "shadow_copy";
            }
            quarantineFile(Number(sessionId), file.filePath, categoryType);
            quarantinedCount++;
          } else if (cat.action === "Strip GPS Metadata") {
            await stripGpsMetadata(Number(sessionId), file.filePath);
            metadataStrippedCount++;
          }
        } catch (err) {
          console.error(`Remediation error for ${file.filePath}:`, err.message);
          errors.push({ filePath: file.filePath, error: err.message });
        }
      }
    }

    res.json({
      success: true,
      quarantinedCount,
      metadataStrippedCount,
      errors: errors.length > 0 ? errors : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Active Quarantine Items
router.get("/quarantine", (req, res) => {
  try {
    const { sessionId } = req.query;
    const items = getQuarantinedFiles(sessionId ? Number(sessionId) : null);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Restore Quarantined Item
router.post("/restore/:id", (req, res) => {
  try {
    const { id } = req.params;
    const result = restoreItem(Number(id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4B. Restore ALL Quarantined Items
router.post("/restore-all", (req, res) => {
  try {
    const result = restoreAllItems();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// 5. Permanently Delete Quarantined Item
router.delete("/delete/:id", (req, res) => {
  try {
    const { id } = req.params;
    const result = deleteItemPermanently(Number(id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/quarantine-count", (req, res) => {
  const db = require("../db");

  const active = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM quarantined_files
    WHERE status='quarantined'
  `,
    )
    .get();

  const restored = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM quarantined_files
    WHERE status='restored'
  `,
    )
    .get();

  res.json({
    quarantined: active.count,
    restored: restored.count,
  });
});

module.exports = router;
