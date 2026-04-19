// routes/alerts.js
import express from "express";
import Alert from "../models/Alert.js";

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

// POST /api/alerts — create a manual alert (OCD field report / admin entry)
router.post("/", async (req, res) => {
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
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours default
    });

    res.status(201).json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: "Failed to create alert" });
  }
});

// PATCH /api/alerts/:id/dismiss — soft-delete (hide) an alert
router.patch("/:id/dismiss", async (req, res) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, {
      isActive: false,
      updatedAt: new Date(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

export default router;
