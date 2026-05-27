import express from "express";
import ResourceRequest  from "../models/ResourceRequest.js";
import ResourceDonation from "../models/ResourceDonation.js";
import InventoryItem    from "../models/InventoryItem.js";
import InventoryLog     from "../models/InventoryLog.js";
import Alert            from "../models/Alert.js";
import User             from "../models/user.js";
import { protect, requireAdminOrBarangay, optionalProtect } from "../middleware/auth.js";
import { pushItemAlert } from "../services/inventoryAlerts.js";
import { sendAdminNotification } from "./push.js";

const DONATION_CATEGORY_MAP = {
  food:     "Food & Water",
  water:    "Food & Water",
  clothing: "Other",
  medicine: "Medical",
  hygiene:  "Medical",
  shelter:  "Shelter",
  other:    "Other",
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

// GET /api/community/requests/mine — mobile: returns the logged-in user's own requests
router.get("/requests/mine", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email").lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    const requests = await ResourceRequest.find({
      $or: [{ requesterEmail: user.email }, { userId: req.user.id }],
    }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/community/donations/mine — mobile: returns the logged-in user's own donations
router.get("/donations/mine", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email").lean();
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    const donations = await ResourceDonation.find({
      $or: [{ donorEmail: user.email }, { userId: req.user.id }],
    }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, donations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/community/requests
// Accepts two formats:
//   Web form  — sends requesterName/requesterEmail/barangay/address/category/itemDescription (no auth)
//   Mobile    — sends JWT + resourceId/resourceName/quantity/requestType/urgent/gps (auth required)
// Layer 1: one active request per category per requester email.
router.post("/requests", optionalProtect, async (req, res) => {
  try {
    let {
      requesterName, requesterEmail, barangay, address, category,
      itemDescription, quantity, unit, reason,
      // Mobile-only fields
      resourceId, resourceName, requestType, urgent, gpsLat, gpsLng, phone,
    } = req.body;

    // Mobile: backfill identity from the authenticated user's profile
    if (req.user && (!requesterName || !requesterEmail)) {
      const profile = await User.findById(req.user.id).select("name email").lean();
      if (!profile) return res.status(404).json({ success: false, error: "User not found." });
      requesterName  = requesterName  || profile.name;
      requesterEmail = requesterEmail || profile.email;
    }

    // Map mobile resourceName → itemDescription when web field is absent
    if (!itemDescription && resourceName) itemDescription = resourceName;

    // Defaults for fields mobile may not supply
    barangay = barangay || "unknown";
    address  = address  || "";
    category = category || "other";

    if (!requesterName || !requesterEmail || !itemDescription || !quantity) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    // Layer 1 — one active request per category per requester
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

    const request = await ResourceRequest.create({
      requesterName, requesterEmail, barangay, address,
      category, itemDescription,
      quantity: Number(quantity),
      unit: unit || "pcs",
      reason: reason || "",
      userId:      req.user ? req.user.id : null,
      resourceId:  resourceId  || null,
      requestType: requestType || "standard",
      urgent:      urgent      || false,
      gpsLat:      gpsLat      ?? null,
      gpsLng:      gpsLng      ?? null,
      phone:       phone        || null,
    });

    const io = req.app.get("io");
    if (io) io.emit("new_community_request", { request });

    sendAdminNotification({
      title: `New Resource Request — ${category}`,
      body: `${requesterName} from ${barangay} is requesting ${quantity} ${unit || "pcs"} of ${itemDescription}.`,
      url: "/community",
      tag: `request-${request._id}`,
      urgent: urgent || false,
    }).catch((err) => console.error("[Push] Request notification failed:", err));

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/approve
router.patch("/requests/:id/approve", protect, requireAdminOrBarangay, async (req, res) => {
  try {
    const { note } = req.body;
    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Only pending requests can be approved." });

    request.status = "approved";
    request.actionLog.push({ action: "approved", by: req.user.name, byId: req.user.id, note: note || "" });
    await request.save();

    const io = req.app.get("io");
    if (io) io.emit("community_request_updated", { id: request._id, status: request.status });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/reject
router.patch("/requests/:id/reject", protect, requireAdminOrBarangay, async (req, res) => {
  try {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, error: "A reason is required when rejecting a request." });

    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, error: "Only pending requests can be rejected." });

    request.status = "rejected";
    request.actionLog.push({ action: "rejected", by: req.user.name, byId: req.user.id, note });
    await request.save();

    const io = req.app.get("io");
    if (io) io.emit("community_request_updated", { id: request._id, status: request.status });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/requests/:id/fulfill
router.patch("/requests/:id/fulfill", protect, requireAdminOrBarangay, async (req, res) => {
  try {
    const { note } = req.body;
    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: "Request not found." });
    if (request.status !== "approved") return res.status(400).json({ success: false, error: "Only approved requests can be marked fulfilled." });

    // Atomic inventory deduction — runs only when request has a linked inventory item
    if (request.resourceId) {
      const deducted = await InventoryItem.findOneAndUpdate(
        { _id: request.resourceId, quantity: { $gte: request.quantity } },
        { $inc: { quantity: -request.quantity } },
        { new: true },
      );
      if (!deducted) {
        return res.status(409).json({ success: false, error: "Insufficient stock to fulfill this request." });
      }
    }

    request.status = "fulfilled";
    request.actionLog.push({ action: "fulfilled", by: req.user.name, byId: req.user.id, note: note || "" });
    await request.save();

    const io = req.app.get("io");
    if (io) io.emit("community_request_updated", { id: request._id, status: request.status });

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

    const io = req.app.get("io");
    if (io) io.emit("community_request_updated", { id: request._id, status: request.status });

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

// POST /api/community/donations
// Accepts two formats:
//   Web form  — sends donorName/donorEmail/barangay/category/itemDescription (no auth)
//   Mobile    — sends JWT + resourceId/resourceName/quantity/gps/phone (auth required)
router.post("/donations", optionalProtect, async (req, res) => {
  try {
    let {
      donorName, donorEmail, barangay, category, itemDescription, quantity, unit,
      // Mobile-only fields
      resourceId, resourceName, phone, dob, gpsLat, gpsLng, pickupAddress, isAnonymous,
    } = req.body;

    // Mobile: backfill identity from authenticated user (unless anonymous donation)
    if (req.user && (!donorName || !donorEmail)) {
      if (isAnonymous) {
        donorName  = "Anonymous";
        donorEmail = `anonymous+${req.user.id}@etelly.local`;
      } else {
        const profile = await User.findById(req.user.id).select("name email").lean();
        if (!profile) return res.status(404).json({ success: false, error: "User not found." });
        donorName  = donorName  || profile.name;
        donorEmail = donorEmail || profile.email;
      }
    }

    // Map mobile resourceName → itemDescription when web field is absent
    if (!itemDescription && resourceName) itemDescription = resourceName;

    // Defaults for fields mobile may not supply
    barangay = barangay || "unknown";
    category = category || "other";

    if (!donorName || !donorEmail || !itemDescription || !quantity) {
      return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    const donation = await ResourceDonation.create({
      donorName, donorEmail, barangay,
      category, itemDescription,
      quantity: Number(quantity),
      unit: unit || "pcs",
      userId:        req.user ? req.user.id : null,
      resourceId:    resourceId    || null,
      phone:         phone         || null,
      dob:           dob           || null,
      gpsLat:        gpsLat        ?? null,
      gpsLng:        gpsLng        ?? null,
      pickupAddress: pickupAddress || null,
      isAnonymous:   isAnonymous   || false,
    });

    const io = req.app.get("io");
    if (io) io.emit("new_community_donation", { donation });

    sendAdminNotification({
      title: `New Donation Offer — ${category}`,
      body: `${isAnonymous ? "Anonymous donor" : donorName} from ${barangay} is offering ${quantity} ${unit || "pcs"} of ${itemDescription}.`,
      url: "/community",
      tag: `donation-${donation._id}`,
      urgent: false,
    }).catch((err) => console.error("[Push] Donation notification failed:", err));

    res.status(201).json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/donations/:id/schedule
router.patch("/donations/:id/schedule", protect, requireAdminOrBarangay, async (req, res) => {
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

    const io = req.app.get("io");
    if (io) io.emit("community_donation_updated", { id: donation._id, status: donation.status });

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/community/donations/:id/receive
router.patch("/donations/:id/receive", protect, requireAdminOrBarangay, async (req, res) => {
  try {
    const { note } = req.body;
    const donation = await ResourceDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, error: "Donation not found." });
    if (donation.status !== "scheduled") return res.status(400).json({ success: false, error: "Only scheduled donations can be marked received." });

    donation.status = "received";
    donation.actionLog.push({ action: "received", by: req.user.name, byId: req.user.id, note: note || "" });
    await donation.save();

    const io = req.app.get("io");
    if (io) io.emit("community_donation_updated", { id: donation._id, status: donation.status });

    // ── Auto-transfer to inventory ──────────────────────────────────────────
    try {
      const donorLabel      = donation.donorName?.trim() || "Anonymous";
      const inventoryCat    = DONATION_CATEGORY_MAP[donation.category] ?? "Other";
      const nameRegex       = new RegExp(`^${escapeRegex(donation.itemDescription)}$`, "i");

      const existing = await InventoryItem.findOne({ barangay: donation.barangay, name: nameRegex });

      if (existing) {
        const prevQty = existing.quantity;
        existing.quantity  += donation.quantity;
        existing.donatedBy  = [...(existing.donatedBy ?? []), donorLabel];
        await existing.save();

        await InventoryLog.create({
          itemId:        existing._id,
          itemName:      existing.name,
          barangay:      existing.barangay,
          action:        "item_updated",
          field:         "quantity (donation)",
          previousValue: prevQty,
          newValue:      existing.quantity,
          user: { id: req.user.id, name: req.user.name },
        });

        pushItemAlert(existing).catch(() => {});
      } else {
        const created = await InventoryItem.create({
          name:        donation.itemDescription,
          category:    inventoryCat,
          quantity:    donation.quantity,
          unit:        donation.unit,
          minQuantity: 0,
          barangay:    donation.barangay,
          expiryDate:  null,
          donatedBy:   [donorLabel],
        });

        await InventoryLog.create({
          itemId:   created._id,
          itemName: created.name,
          barangay: created.barangay,
          action:   "item_created",
          newValue: donation.quantity,
          user: { id: req.user.id, name: req.user.name },
        });

        pushItemAlert(created).catch(() => {});
      }
    } catch (invErr) {
      console.error("[Community] Inventory transfer failed:", invErr.message);
      // Non-fatal — donation was already marked received
    }

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

    const io = req.app.get("io");
    if (io) io.emit("community_donation_updated", { id: donation._id, status: donation.status });

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
