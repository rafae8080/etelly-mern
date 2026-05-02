// routes/alerts.js
import express from "express";
import Alert from "../models/Alert.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// GET /api/alerts — fetch all active alerts, sorted by severity then time
router.get("/", async (req, res) => {
  try {
    const alerts = await Alert.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ alerts, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /api/alerts/log — all actionLog entries across alerts, newest first
router.get("/log", async (req, res) => {
  try {
    const alerts = await Alert.find({ "actionLog.0": { $exists: true } })
      .select("title actionLog")
      .lean();

    const entries = [];
    for (const alert of alerts) {
      for (const entry of alert.actionLog) {
        entries.push({
          _id: entry._id,
          alertId: alert._id,
          alertTitle: alert.title,
          action: entry.action,
          by: entry.by,
          at: entry.at,
        });
      }
    }

    entries.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alert log" });
  }
});

// POST /api/alerts — create a manual alert
router.post("/", protect, async (req, res) => {
  try {
    const { source, type, severity, title, description, location, barangays } =
      req.body;

    if (!title || !description || !severity) {
      return res
        .status(400)
        .json({ error: "title, description, and severity are required" });
    }

    const alert = await Alert.create({
      source: source ?? "OCD",
      type: type ?? "other",
      severity,
      title,
      description,
      location: location ?? "Antipolo City, Rizal",
      barangays: barangays ?? [],
      isActive: true,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      actionLog: [{ action: "created", by: req.user.name }],
    });

    res.status(201).json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: "Failed to create alert" });
  }
});

// PATCH /api/alerts/:id/dismiss — soft-delete (hide) an alert
router.patch("/:id/dismiss", protect, async (req, res) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, {
      isActive: false,
      updatedAt: new Date(),
      $push: { actionLog: { action: "dismissed", by: req.user.name } },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

export default router;
