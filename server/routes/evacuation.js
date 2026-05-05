import express from "express";
import EvacuationCenter from "../models/EvacuationCenter.js";
import EvacuationLog from "../models/EvacuationLog.js";
import User from "../models/user.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED = [
  // Barangay Muntindilaw
  { barangay: "muntindilaw", name: "Puno Multipurpose Hall – Rescue Bldg.", location: "Barangay Compound",              capacity: 300 },
  { barangay: "muntindilaw", name: "Muntindilaw National High School",       location: "Duluth Brookside Subdivision",   capacity: 500 },
  { barangay: "muntindilaw", name: "Barangay Covered Court",                 location: "Barangay Covered Court",         capacity: 200 },
  { barangay: "muntindilaw", name: "Area 4B Basketball Open Court",          location: "Palm Drive Country Homes",       capacity: 150 },
  { barangay: "muntindilaw", name: "Skylark St. Vista Verde Bldg.",          location: "Skylark St., Country Homes",     capacity: 100 },
  { barangay: "muntindilaw", name: "Saint Martin De Porres",                 location: "San Martin de Porres",           capacity: 200 },
  { barangay: "muntindilaw", name: "Sitio Mahayahay Open Court BC",          location: "Sitio Mahayahay, Country Homes", capacity: 150 },
  { barangay: "muntindilaw", name: "Muntindilaw Daycare Center",             location: "Barangay Compound",              capacity: 80  },
  { barangay: "muntindilaw", name: "Muntindilaw Elementary School",          location: "Barangay Compound",              capacity: 400 },
  { barangay: "muntindilaw", name: "KB 4 Open Area Basketball Court",        location: "Woodpeaker St., Country Homes",  capacity: 150 },
  { barangay: "muntindilaw", name: "Village East Clubhouse Basketball Court",location: "L'Village East Avenue",          capacity: 200 },
  { barangay: "muntindilaw", name: "Vista Verde Executive Basketball Court", location: "Alfonso St., Vista Verde",       capacity: 150 },

  // Barangay Mayamot
  { barangay: "mayamot", name: "Kingsville Evacuation Center (City Manage)", location: "Kingsville Subd.",      capacity: 200 },
  { barangay: "mayamot", name: "Mayamot Elementary School Covered Court",    location: "147 Sumulong Hi-way",   capacity: 300 },
  { barangay: "mayamot", name: "Mayamot Daycare Center",                     location: "Sumulong Hi-way",       capacity: 80  },
];

async function seedIfEmpty(barangay) {
  const count = await EvacuationCenter.countDocuments({ barangay });
  if (count === 0) {
    await EvacuationCenter.insertMany(SEED.filter((s) => s.barangay === barangay));
    console.log(`[Evacuation] Seeded ${barangay} centers`);
  }
}

// Resolve the caller's display name from JWT (may include name after our auth update)
// or fall back to a DB lookup so existing sessions still get a real name.
async function resolveUserName(req) {
  if (req.user.name) return req.user.name;
  const user = await User.findById(req.user.id).select("name").lean();
  return user?.name ?? "Unknown";
}

// ── GET /api/evacuation/centers?barangay=... ─────────────────────────────────
router.get("/centers", protect, async (req, res) => {
  try {
    const { barangay = "muntindilaw" } = req.query;
    await seedIfEmpty(barangay);
    const centers = await EvacuationCenter.find({ barangay }).sort({ name: 1 });
    res.json(centers);
  } catch (err) {
    console.error("❌ Evacuation centers fetch:", err.message);
    res.status(500).json({ message: "Failed to fetch centers" });
  }
});

// ── PUT /api/evacuation/centers/:id/occupancy ────────────────────────────────
router.put("/centers/:id/occupancy", protect, async (req, res) => {
  try {
    const userName = await resolveUserName(req);
    const center = await EvacuationCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ message: "Center not found" });

    const prev = center.occupancy;
    const next = Math.max(0, Math.min(center.capacity, parseInt(req.body.occupancy, 10)));
    if (isNaN(next)) return res.status(400).json({ message: "Invalid occupancy value" });

    center.occupancy  = next;
    center.updatedBy  = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId:      center._id,
      centerName:    center.name,
      barangay:      center.barangay,
      action:        "occupancy_update",
      previousValue: prev,
      newValue:      next,
      delta:         next - prev,
      user:          { id: req.user.id, name: userName },
    });

    req.app.get("io").emit("evacuation_updated", { center, log });
    res.json({ center, log });
  } catch (err) {
    console.error("❌ Occupancy update:", err.message);
    res.status(500).json({ message: "Failed to update occupancy" });
  }
});

// ── PUT /api/evacuation/centers/:id/capacity ─────────────────────────────────
router.put("/centers/:id/capacity", protect, async (req, res) => {
  try {
    const userName = await resolveUserName(req);
    const center = await EvacuationCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ message: "Center not found" });

    const prev = center.capacity;
    const next = Math.max(1, parseInt(req.body.capacity, 10));
    if (isNaN(next)) return res.status(400).json({ message: "Invalid capacity value" });

    center.capacity   = next;
    center.occupancy  = Math.min(center.occupancy, next);
    center.updatedBy  = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId:      center._id,
      centerName:    center.name,
      barangay:      center.barangay,
      action:        "capacity_update",
      previousValue: prev,
      newValue:      next,
      delta:         next - prev,
      user:          { id: req.user.id, name: userName },
    });

    req.app.get("io").emit("evacuation_updated", { center, log });
    res.json({ center, log });
  } catch (err) {
    console.error("❌ Capacity update:", err.message);
    res.status(500).json({ message: "Failed to update capacity" });
  }
});

// ── POST /api/evacuation/centers/:id/reset ───────────────────────────────────
router.post("/centers/:id/reset", protect, async (req, res) => {
  try {
    const userName = await resolveUserName(req);
    const center = await EvacuationCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ message: "Center not found" });

    const prev = center.occupancy;
    center.occupancy  = 0;
    center.updatedBy  = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId:      center._id,
      centerName:    center.name,
      barangay:      center.barangay,
      action:        "reset",
      previousValue: prev,
      newValue:      0,
      delta:         -prev,
      user:          { id: req.user.id, name: userName },
    });

    req.app.get("io").emit("evacuation_updated", { center, log });
    res.json({ center, log });
  } catch (err) {
    console.error("❌ Reset:", err.message);
    res.status(500).json({ message: "Failed to reset occupancy" });
  }
});

// ── PUT /api/evacuation/centers/:id/availability ─────────────────────────────
router.put("/centers/:id/availability", protect, requireAdmin, async (req, res) => {
  try {
    const userName = await resolveUserName(req);
    const center = await EvacuationCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ message: "Center not found" });

    const prev = center.available !== false;
    const next = !!req.body.available;

    center.available = next;
    center.updatedBy = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId:      center._id,
      centerName:    center.name,
      barangay:      center.barangay,
      action:        "availability_update",
      previousValue: prev ? 1 : 0,
      newValue:      next ? 1 : 0,
      delta:         0,
      user:          { id: req.user.id, name: userName },
    });

    req.app.get("io").emit("evacuation_updated", { center, log });
    res.json({ center, log });
  } catch (err) {
    console.error("❌ Availability update:", err.message);
    res.status(500).json({ message: "Failed to update availability" });
  }
});

// ── POST /api/evacuation/centers (admin) ─────────────────────────────────────
router.post("/centers", protect, requireAdmin, async (req, res) => {
  try {
    const userName = await resolveUserName(req);
    const { name, location, barangay, capacity } = req.body;
    if (!name?.trim() || !location?.trim() || !barangay || !capacity) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const cap = Math.max(1, parseInt(capacity, 10));
    if (isNaN(cap)) return res.status(400).json({ message: "Invalid capacity" });

    const center = await EvacuationCenter.create({
      name:     name.trim(),
      location: location.trim(),
      barangay,
      capacity: cap,
    });

    await EvacuationLog.create({
      centerId:      center._id,
      centerName:    center.name,
      barangay:      center.barangay,
      action:        "center_created",
      previousValue: 0,
      newValue:      cap,
      delta:         0,
      user:          { id: req.user.id, name: userName },
    });

    req.app.get("io").emit("evacuation_center_created", { center });
    res.status(201).json(center);
  } catch (err) {
    console.error("❌ Create center:", err.message);
    res.status(500).json({ message: "Failed to create center" });
  }
});

// ── GET /api/evacuation/logs?barangay=...&limit=50 ───────────────────────────
router.get("/logs", protect, async (req, res) => {
  try {
    const { barangay, limit = 50 } = req.query;
    const query = barangay ? { barangay } : {};
    const logs = await EvacuationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10), 200));
    res.json(logs);
  } catch (err) {
    console.error("❌ Logs fetch:", err.message);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

export default router;
