import express from "express";
import EvacuationCenter from "../models/EvacuationCenter.js";
import EvacuationLog from "../models/EvacuationLog.js";
import User from "../models/user.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED = [
  // Barangay Bagong Nayon
  {
    barangay: "bagongnayon",
    name: "Bagong Nayon Elementary School",
    location: "Bagong Nayon",
    capacity: 400,
  },
  {
    barangay: "bagongnayon",
    name: "Barangay Hall",
    location: "Bagong Nayon",
    capacity: 150,
  },
  {
    barangay: "bagongnayon",
    name: "Barangay Covered Court",
    location: "Bagong Nayon",
    capacity: 200,
  },
  {
    barangay: "bagongnayon",
    name: "Bagong Nayon National High School",
    location: "Bagong Nayon",
    capacity: 500,
  },

  // Barangay Beverly Hills
  {
    barangay: "beverlyhills",
    name: "Beverly Hills Elementary School",
    location: "Beverly Hills",
    capacity: 350,
  },
  {
    barangay: "beverlyhills",
    name: "Barangay Hall",
    location: "Beverly Hills",
    capacity: 150,
  },
  {
    barangay: "beverlyhills",
    name: "Barangay Covered Court",
    location: "Beverly Hills",
    capacity: 200,
  },

  // Barangay Calawis
  {
    barangay: "calawis",
    name: "Calawis Elementary School",
    location: "Calawis",
    capacity: 300,
  },
  {
    barangay: "calawis",
    name: "Barangay Hall",
    location: "Calawis",
    capacity: 100,
  },
  {
    barangay: "calawis",
    name: "Barangay Covered Court",
    location: "Calawis",
    capacity: 150,
  },

  // Barangay Cupang
  {
    barangay: "cupang",
    name: "Cupang National High School",
    location: "Cupang",
    capacity: 500,
  },
  {
    barangay: "cupang",
    name: "Cupang Elementary School",
    location: "Cupang",
    capacity: 400,
  },
  {
    barangay: "cupang",
    name: "Barangay Hall",
    location: "Cupang",
    capacity: 150,
  },
  {
    barangay: "cupang",
    name: "Barangay Covered Court",
    location: "Cupang",
    capacity: 200,
  },
  {
    barangay: "cupang",
    name: "Cupang Daycare Center",
    location: "Cupang",
    capacity: 80,
  },

  // Barangay Dalig
  {
    barangay: "dalig",
    name: "Dalig Elementary School",
    location: "Dalig",
    capacity: 350,
  },
  {
    barangay: "dalig",
    name: "Barangay Hall",
    location: "Dalig",
    capacity: 150,
  },
  {
    barangay: "dalig",
    name: "Barangay Covered Court",
    location: "Dalig",
    capacity: 200,
  },

  // Barangay Dela Paz
  {
    barangay: "delapaz",
    name: "Dela Paz National High School",
    location: "Dela Paz",
    capacity: 600,
  },
  {
    barangay: "delapaz",
    name: "Dela Paz Elementary School",
    location: "Dela Paz",
    capacity: 400,
  },
  {
    barangay: "delapaz",
    name: "Barangay Hall",
    location: "Dela Paz",
    capacity: 150,
  },
  {
    barangay: "delapaz",
    name: "Barangay Covered Court",
    location: "Dela Paz",
    capacity: 200,
  },
  {
    barangay: "delapaz",
    name: "Dela Paz Daycare Center",
    location: "Dela Paz",
    capacity: 80,
  },

  // Barangay Inarawan
  {
    barangay: "inarawan",
    name: "Inarawan Elementary School",
    location: "Inarawan",
    capacity: 300,
  },
  {
    barangay: "inarawan",
    name: "Barangay Hall",
    location: "Inarawan",
    capacity: 100,
  },
  {
    barangay: "inarawan",
    name: "Barangay Covered Court",
    location: "Inarawan",
    capacity: 150,
  },

  // Barangay Mambugan
  {
    barangay: "mambugan",
    name: "Mambugan Elementary School",
    location: "Mambugan",
    capacity: 350,
  },
  {
    barangay: "mambugan",
    name: "Mambugan National High School",
    location: "Mambugan",
    capacity: 500,
  },
  {
    barangay: "mambugan",
    name: "Barangay Hall",
    location: "Mambugan",
    capacity: 150,
  },
  {
    barangay: "mambugan",
    name: "Barangay Covered Court",
    location: "Mambugan",
    capacity: 200,
  },

  // Barangay Mayamot
  {
    barangay: "mayamot",
    name: "Kingsville Evacuation Center (City Manage)",
    location: "Kingsville Subd.",
    capacity: 200,
  },
  {
    barangay: "mayamot",
    name: "Mayamot Elementary School Covered Court",
    location: "147 Sumulong Hi-way",
    capacity: 300,
  },
  {
    barangay: "mayamot",
    name: "Mayamot Daycare Center",
    location: "Sumulong Hi-way",
    capacity: 80,
  },

  // Barangay Muntindilaw
  {
    barangay: "muntindilaw",
    name: "Puno Multipurpose Hall – Rescue Bldg.",
    location: "Barangay Compound",
    capacity: 300,
  },
  {
    barangay: "muntindilaw",
    name: "Muntindilaw National High School",
    location: "Duluth Brookside Subdivision",
    capacity: 500,
  },
  {
    barangay: "muntindilaw",
    name: "Barangay Covered Court",
    location: "Barangay Covered Court",
    capacity: 200,
  },
  {
    barangay: "muntindilaw",
    name: "Area 4B Basketball Open Court",
    location: "Palm Drive Country Homes",
    capacity: 150,
  },
  {
    barangay: "muntindilaw",
    name: "Skylark St. Vista Verde Bldg.",
    location: "Skylark St., Country Homes",
    capacity: 100,
  },
  {
    barangay: "muntindilaw",
    name: "Saint Martin De Porres",
    location: "San Martin de Porres",
    capacity: 200,
  },
  {
    barangay: "muntindilaw",
    name: "Sitio Mahayahay Open Court BC",
    location: "Sitio Mahayahay, Country Homes",
    capacity: 150,
  },
  {
    barangay: "muntindilaw",
    name: "Muntindilaw Daycare Center",
    location: "Barangay Compound",
    capacity: 80,
  },
  {
    barangay: "muntindilaw",
    name: "Muntindilaw Elementary School",
    location: "Barangay Compound",
    capacity: 400,
  },
  {
    barangay: "muntindilaw",
    name: "KB 4 Open Area Basketball Court",
    location: "Woodpeaker St., Country Homes",
    capacity: 150,
  },
  {
    barangay: "muntindilaw",
    name: "Village East Clubhouse Basketball Court",
    location: "L'Village East Avenue",
    capacity: 200,
  },
  {
    barangay: "muntindilaw",
    name: "Vista Verde Executive Basketball Court",
    location: "Alfonso St., Vista Verde",
    capacity: 150,
  },

  // Private Centers
  {
    barangay: "private",
    name: "La Colina Sports Complex",
    location: "La Colina",
    capacity: 500,
  },
  {
    barangay: "private",
    name: "Robinsons Place Antipolo",
    location: "Sumulong Hi-way",
    capacity: 1000,
  },
  {
    barangay: "private",
    name: "SM Masinag",
    location: "Masinag, Antipolo",
    capacity: 1200,
  },

  // Barangay San Isidro
  {
    barangay: "sanisidro",
    name: "San Isidro Elementary School",
    location: "San Isidro",
    capacity: 350,
  },
  {
    barangay: "sanisidro",
    name: "San Isidro National High School",
    location: "San Isidro",
    capacity: 500,
  },
  {
    barangay: "sanisidro",
    name: "Barangay Hall",
    location: "San Isidro",
    capacity: 150,
  },
  {
    barangay: "sanisidro",
    name: "Barangay Covered Court",
    location: "San Isidro",
    capacity: 200,
  },

  // Barangay San Jose
  {
    barangay: "sanjose",
    name: "San Jose National High School",
    location: "San Jose",
    capacity: 600,
  },
  {
    barangay: "sanjose",
    name: "San Jose Elementary School",
    location: "San Jose",
    capacity: 400,
  },
  {
    barangay: "sanjose",
    name: "Barangay Hall",
    location: "San Jose",
    capacity: 150,
  },
  {
    barangay: "sanjose",
    name: "Barangay Covered Court",
    location: "San Jose",
    capacity: 200,
  },
  {
    barangay: "sanjose",
    name: "San Jose Daycare Center",
    location: "San Jose",
    capacity: 80,
  },

  // Barangay San Juan
  {
    barangay: "sanjuan",
    name: "San Juan Elementary School",
    location: "San Juan",
    capacity: 350,
  },
  {
    barangay: "sanjuan",
    name: "Barangay Hall",
    location: "San Juan",
    capacity: 150,
  },
  {
    barangay: "sanjuan",
    name: "Barangay Covered Court",
    location: "San Juan",
    capacity: 200,
  },

  // Barangay San Luis
  {
    barangay: "sanluis",
    name: "San Luis National High School",
    location: "San Luis",
    capacity: 600,
  },
  {
    barangay: "sanluis",
    name: "San Luis Elementary School",
    location: "San Luis",
    capacity: 400,
  },
  {
    barangay: "sanluis",
    name: "Barangay Hall",
    location: "San Luis",
    capacity: 150,
  },
  {
    barangay: "sanluis",
    name: "Barangay Covered Court",
    location: "San Luis",
    capacity: 200,
  },
  {
    barangay: "sanluis",
    name: "San Luis Daycare Center",
    location: "San Luis",
    capacity: 80,
  },

  // Barangay San Roque
  {
    barangay: "sanroque",
    name: "San Roque Elementary School",
    location: "San Roque",
    capacity: 350,
  },
  {
    barangay: "sanroque",
    name: "San Roque National High School",
    location: "San Roque",
    capacity: 500,
  },
  {
    barangay: "sanroque",
    name: "Barangay Hall",
    location: "San Roque",
    capacity: 150,
  },
  {
    barangay: "sanroque",
    name: "Barangay Covered Court",
    location: "San Roque",
    capacity: 200,
  },

  // Barangay Santa Cruz
  {
    barangay: "santacruz",
    name: "Santa Cruz National High School",
    location: "Santa Cruz",
    capacity: 600,
  },
  {
    barangay: "santacruz",
    name: "Santa Cruz Elementary School",
    location: "Santa Cruz",
    capacity: 400,
  },
  {
    barangay: "santacruz",
    name: "Barangay Hall",
    location: "Santa Cruz",
    capacity: 150,
  },
  {
    barangay: "santacruz",
    name: "Barangay Covered Court",
    location: "Santa Cruz",
    capacity: 200,
  },
  {
    barangay: "santacruz",
    name: "Santa Cruz Daycare Center",
    location: "Santa Cruz",
    capacity: 80,
  },
];

async function seedIfEmpty(barangay) {
  const count = await EvacuationCenter.countDocuments({ barangay });
  if (count === 0) {
    await EvacuationCenter.insertMany(
      SEED.filter((s) => s.barangay === barangay),
    );
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
    if (barangay === "all") {
      const allBarangays = [...new Set(SEED.map((s) => s.barangay))];
      await Promise.all(allBarangays.map(seedIfEmpty));
    } else {
      await seedIfEmpty(barangay);
    }
    const filter = barangay === "all" ? {} : { barangay };
    const centers = await EvacuationCenter.find(filter).sort({ barangay: 1, name: 1 });
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
    const next = Math.max(
      0,
      Math.min(center.capacity, parseInt(req.body.occupancy, 10)),
    );
    if (isNaN(next))
      return res.status(400).json({ message: "Invalid occupancy value" });

    center.occupancy = next;
    center.updatedBy = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId: center._id,
      centerName: center.name,
      barangay: center.barangay,
      action: "occupancy_update",
      previousValue: prev,
      newValue: next,
      delta: next - prev,
      user: { id: req.user.id, name: userName },
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
    if (isNaN(next))
      return res.status(400).json({ message: "Invalid capacity value" });

    center.capacity = next;
    center.occupancy = Math.min(center.occupancy, next);
    center.updatedBy = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId: center._id,
      centerName: center.name,
      barangay: center.barangay,
      action: "capacity_update",
      previousValue: prev,
      newValue: next,
      delta: next - prev,
      user: { id: req.user.id, name: userName },
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
    center.occupancy = 0;
    center.updatedBy = { userId: req.user.id, userName };
    await center.save();

    const log = await EvacuationLog.create({
      centerId: center._id,
      centerName: center.name,
      barangay: center.barangay,
      action: "reset",
      previousValue: prev,
      newValue: 0,
      delta: -prev,
      user: { id: req.user.id, name: userName },
    });

    req.app.get("io").emit("evacuation_updated", { center, log });
    res.json({ center, log });
  } catch (err) {
    console.error("❌ Reset:", err.message);
    res.status(500).json({ message: "Failed to reset occupancy" });
  }
});

// ── PUT /api/evacuation/centers/:id/availability ─────────────────────────────
router.put(
  "/centers/:id/availability",
  protect,
  requireAdmin,
  async (req, res) => {
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
        centerId: center._id,
        centerName: center.name,
        barangay: center.barangay,
        action: "availability_update",
        previousValue: prev ? 1 : 0,
        newValue: next ? 1 : 0,
        delta: 0,
        user: { id: req.user.id, name: userName },
      });

      req.app.get("io").emit("evacuation_updated", { center, log });
      res.json({ center, log });
    } catch (err) {
      console.error("❌ Availability update:", err.message);
      res.status(500).json({ message: "Failed to update availability" });
    }
  },
);

// ── POST /api/evacuation/centers (admin) ─────────────────────────────────────
router.post("/centers", protect, requireAdmin, async (req, res) => {
  try {
    const userName = await resolveUserName(req);
    const { name, location, barangay, capacity, lat, lng } = req.body;
    if (!name?.trim() || !location?.trim() || !barangay || !capacity) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const cap = Math.max(1, parseInt(capacity, 10));
    if (isNaN(cap))
      return res.status(400).json({ message: "Invalid capacity" });

    const center = await EvacuationCenter.create({
      name: name.trim(),
      location: location.trim(),
      barangay,
      capacity: cap,
      lat: lat != null ? parseFloat(lat) : null,
      lng: lng != null ? parseFloat(lng) : null,
    });

    await EvacuationLog.create({
      centerId: center._id,
      centerName: center.name,
      barangay: center.barangay,
      action: "center_created",
      previousValue: 0,
      newValue: cap,
      delta: 0,
      user: { id: req.user.id, name: userName },
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
