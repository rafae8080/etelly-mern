import express from "express";
import ResourceRequest from "../models/ResourceRequest.js";
import ResourceDonation from "../models/ResourceDonation.js";
import Alert from "../models/Alert.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// ─── Priority helper ──────────────────────────────────────────────────────────
// Scores each request's barangay against currently active alerts.
// Returns { level, score } — score is used for sorting.

const SEVERITY_SCORE = { evacuate: 4, critical: 3, warning: 2, watch: 1 };

function calcPriority(barangay, activeAlerts) {
  const lower = (barangay ?? "").toLowerCase();
  const matching = activeAlerts.filter((a) =>
    a.barangays.some((b) => b.toLowerCase() === lower),
  );
  if (!matching.length) return { level: "normal", score: 0 };

  const score = Math.max(...matching.map((a) => SEVERITY_SCORE[a.severity] ?? 0));
  let level = "medium";
  if (score >= 4) level = "critical";
  else if (score >= 3) level = "high";
  else if (score >= 2) level = "high";

  return { level, score };
}

// ─── Requests ─────────────────────────────────────────────────────────────────

// GET /api/community/requests
// Returns all requests sorted by priority (desc) then createdAt (asc).
router.get("/requests", protect, async (req, res) => {
  try {
    const [requests, activeAlerts] = await Promise.all([
      ResourceRequest.find().sort({ createdAt: 1 }).lean(),
      Alert.find({ isActive: true }).select("barangays severity").lean(),
    ]);

    const withPriority = requests.map((r) => ({
      ...r,
      ...calcPriority(r.barangay, activeAlerts),
    }));

    // Sort: highest score first, FCFS tiebreaker (already sorted by createdAt asc)
    withPriority.sort((a, b) => b.score - a.score || 0);

    res.json({ success: true, requests: withPriority });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/community/requests
// Called by mobile app — no auth required yet.
// Layer 1: one active request per category per user.
// Layer 2: household flag if same address+barangay+category is already active.
router.post("/requests", async (req, res) => {
  try {
    const { requesterName, requesterEmail, barangay, address, category, itemDescription, quantity, unit, reason } = req.body;

    if (!requesterName || !requesterEmail || !barangay || !address || !category || !itemDescription || !quantity) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    // Layer 1 — one active request per category per user
    const existingActive = await ResourceRequest.findOne({
      requesterEmail,
      category,
      status: { $in: ["pending", "approved"] },
    });
    if (existingActive) {
      return res.status(409).json({
        success: false,
        error: `You already have an active ${category} request. It must be fulfilled or rejected before submitting another.`,
      });
    }

    // Layer 2 — household flag (same address + barangay + category already active)
    const householdConflict = await ResourceRequest.findOne({
      barangay,
      address,
      category,
      status: { $in: ["pending", "approved"] },
      requesterEmail: { $ne: requesterEmail },
    });

    const request = await ResourceRequest.create({
      requesterName, requesterEmail, barangay, address,
      category, itemDescription,
      quantity: Number(quantity),
      unit: unit || "pcs",
      reason: reason || "",
      householdFlag: !!householdConflict,
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/approve
router.patch("/requests/:id/approve", protect, async (req, res) => {
  try {
    const { note } = req.body;
    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Only pending requests can be approved." });

    request.status = "approved";
    request.actionLog.push({ action: "approved", by: req.user.name, byId: req.user.id, note: note || "" });
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/reject
router.patch("/requests/:id/reject", protect, async (req, res) => {
  try {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, error: "A reason is required when rejecting a request." });

    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Only pending requests can be rejected." });

    request.status = "rejected";
    request.actionLog.push({ action: "rejected", by: req.user.name, byId: req.user.id, note });
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/fulfill
router.patch("/requests/:id/fulfill", protect, async (req, res) => {
  try {
    const { note } = req.body;
    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (request.status !== "approved") return res.status(400).json({ success: false, error: "Only approved requests can be marked fulfilled." });

    request.status = "fulfilled";
    request.actionLog.push({ action: "fulfilled", by: req.user.name, byId: req.user.id, note: note || "" });
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/cancel
router.patch("/requests/:id/cancel", protect, async (req, res) => {
  try {
    const { note } = req.body;
    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (!["pending", "approved"].includes(request.status)) {
      return res.status(400).json({ success: false, error: "Cannot cancel a request that is already fulfilled or rejected." });
    }

    request.status = "cancelled";
    request.actionLog.push({ action: "cancelled", by: req.user.name, byId: req.user.id, note: note || "" });
    await request.save();

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Donations ────────────────────────────────────────────────────────────────

// GET /api/community/donations
router.get("/donations", protect, async (req, res) => {
  try {
    const donations = await ResourceDonation.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, donations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/community/donations — mobile, no auth required
router.post("/donations", async (req, res) => {
  try {
    const { donorName, donorEmail, barangay, category, itemDescription, quantity, unit } = req.body;

    if (!donorName || !donorEmail || !barangay || !category || !itemDescription || !quantity) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    const donation = await ResourceDonation.create({
      donorName, donorEmail, barangay,
      category, itemDescription,
      quantity: Number(quantity),
      unit: unit || "pcs",
    });

    res.status(201).json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/donations/:id/schedule
router.patch("/donations/:id/schedule", protect, async (req, res) => {
  try {
    const { dropOffPoint, scheduledWindow, note } = req.body;
    if (!dropOffPoint?.trim()) return res.status(400).json({ success: false, error: "Drop-off point is required." });

    const donation = await ResourceDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, error: "Donation not found." });
    if (donation.status !== "offered") return res.status(400).json({ success: false, error: "Only offered donations can be scheduled." });

    donation.status = "scheduled";
    donation.dropOffPoint = dropOffPoint;
    donation.scheduledWindow = scheduledWindow || "";
    donation.actionLog.push({ action: "scheduled", by: req.user.name, byId: req.user.id, note: note || "" });
    await donation.save();

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/donations/:id/receive
router.patch("/donations/:id/receive", protect, async (req, res) => {
  try {
    const { note } = req.body;
    const donation = await ResourceDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, error: "Donation not found." });
    if (donation.status !== "scheduled") return res.status(400).json({ success: false, error: "Only scheduled donations can be marked received." });

    donation.status = "received";
    donation.actionLog.push({ action: "received", by: req.user.name, byId: req.user.id, note: note || "" });
    await donation.save();

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/donations/:id/cancel
router.patch("/donations/:id/cancel", protect, async (req, res) => {
  try {
    const { note } = req.body;
    const donation = await ResourceDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, error: "Donation not found." });
    if (["received", "cancelled"].includes(donation.status)) {
      return res.status(400).json({ success: false, error: "Cannot cancel a donation that is already received or cancelled." });
    }

    donation.status = "cancelled";
    donation.actionLog.push({ action: "cancelled", by: req.user.name, byId: req.user.id, note: note || "" });
    await donation.save();

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
