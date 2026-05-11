import express from "express";
import InventoryItem from "../models/InventoryItem.js";
import InventoryLog  from "../models/InventoryLog.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import { getItemStatus, STATUS_SEVERITY, pushItemAlert } from "../services/inventoryAlerts.js";

const router = express.Router();

// ── Seed data ──────────────────────────────────────────────────────────────────
const BAGONG_NAYON_SEED = [
  { name: "Bottled Water (500ml)",    category: "Food & Water",     quantity: 240, unit: "pcs",     minQuantity: 100, expiryDate: new Date("2025-08-01") },
  { name: "Instant Rice Packs",       category: "Food & Water",     quantity: 12,  unit: "packs",   minQuantity: 50,  expiryDate: new Date("2025-06-30") },
  { name: "Canned Sardines",          category: "Food & Water",     quantity: 85,  unit: "cans",    minQuantity: 60,  expiryDate: new Date("2026-03-15") },
  { name: "Emergency Biscuits",       category: "Food & Water",     quantity: 0,   unit: "packs",   minQuantity: 40,  expiryDate: new Date("2025-05-01") },
  { name: "First Aid Kits",           category: "Medical",          quantity: 8,   unit: "kits",    minQuantity: 20,  expiryDate: null },
  { name: "Oral Rehydration Salts",   category: "Medical",          quantity: 30,  unit: "sachets", minQuantity: 50,  expiryDate: new Date("2026-01-20") },
  { name: "Paracetamol Tablets",      category: "Medical",          quantity: 4,   unit: "boxes",   minQuantity: 10,  expiryDate: new Date("2025-07-10") },
  { name: "Life Vests",               category: "Rescue Equipment", quantity: 0,   unit: "pcs",     minQuantity: 10,  expiryDate: null },
  { name: "Rescue Ropes (20m)",       category: "Rescue Equipment", quantity: 5,   unit: "rolls",   minQuantity: 5,   expiryDate: null },
  { name: "Stretchers",               category: "Rescue Equipment", quantity: 3,   unit: "pcs",     minQuantity: 4,   expiryDate: null },
  { name: "Emergency Blankets",       category: "Shelter",          quantity: 60,  unit: "pcs",     minQuantity: 50,  expiryDate: null },
  { name: "Waterproof Tarpaulins",    category: "Shelter",          quantity: 18,  unit: "pcs",     minQuantity: 20,  expiryDate: null },
  { name: "Two-Way Radios",           category: "Communication",    quantity: 3,   unit: "units",   minQuantity: 5,   expiryDate: null },
  { name: "Megaphone",                category: "Communication",    quantity: 2,   unit: "units",   minQuantity: 2,   expiryDate: null },
  { name: "Flashlights",              category: "Other",            quantity: 10,  unit: "pcs",     minQuantity: 8,   expiryDate: null },
  { name: "AA Batteries",             category: "Other",            quantity: 24,  unit: "pcs",     minQuantity: 40,  expiryDate: null },
];

const BEVERLY_HILLS_SEED = [
  { name: "Bottled Water (1L)",         category: "Food & Water",     quantity: 180, unit: "pcs",     minQuantity: 80,  expiryDate: new Date("2026-12-10") },
  { name: "Instant Noodles",            category: "Food & Water",     quantity: 45,  unit: "packs",   minQuantity: 60,  expiryDate: new Date("2026-09-01") },
  { name: "Canned Goods (Tuna)",        category: "Food & Water",     quantity: 90,  unit: "cans",    minQuantity: 60,  expiryDate: new Date("2027-02-28") },
  { name: "Energy Biscuits",            category: "Food & Water",     quantity: 0,   unit: "packs",   minQuantity: 30,  expiryDate: new Date("2025-11-30") },
  { name: "Infant Formula",             category: "Food & Water",     quantity: 6,   unit: "cans",    minQuantity: 10,  expiryDate: new Date("2025-12-15") },
  { name: "First Aid Kits",             category: "Medical",          quantity: 10,  unit: "kits",    minQuantity: 15,  expiryDate: null },
  { name: "Paracetamol Tablets",        category: "Medical",          quantity: 18,  unit: "boxes",   minQuantity: 10,  expiryDate: new Date("2026-06-05") },
  { name: "Antiseptic Solution",        category: "Medical",          quantity: 4,   unit: "bottles", minQuantity: 6,   expiryDate: new Date("2026-03-01") },
  { name: "Oral Rehydration Salts",     category: "Medical",          quantity: 0,   unit: "sachets", minQuantity: 30,  expiryDate: new Date("2025-10-20") },
  { name: "Life Vests",                 category: "Rescue Equipment", quantity: 14,  unit: "pcs",     minQuantity: 10,  expiryDate: null },
  { name: "Rescue Ropes (20m)",         category: "Rescue Equipment", quantity: 3,   unit: "rolls",   minQuantity: 5,   expiryDate: null },
  { name: "Emergency Stretchers",       category: "Rescue Equipment", quantity: 2,   unit: "pcs",     minQuantity: 3,   expiryDate: null },
  { name: "Emergency Blankets",         category: "Shelter",          quantity: 55,  unit: "pcs",     minQuantity: 40,  expiryDate: null },
  { name: "Waterproof Tarpaulins",      category: "Shelter",          quantity: 28,  unit: "pcs",     minQuantity: 20,  expiryDate: null },
  { name: "Nylon Ropes",                category: "Shelter",          quantity: 10,  unit: "rolls",   minQuantity: 8,   expiryDate: null },
  { name: "Two-Way Radios",             category: "Communication",    quantity: 4,   unit: "units",   minQuantity: 4,   expiryDate: null },
  { name: "Megaphone",                  category: "Communication",    quantity: 1,   unit: "units",   minQuantity: 2,   expiryDate: null },
  { name: "Flashlights",                category: "Other",            quantity: 14,  unit: "pcs",     minQuantity: 10,  expiryDate: null },
  { name: "AA Batteries",               category: "Other",            quantity: 20,  unit: "pcs",     minQuantity: 40,  expiryDate: null },
  { name: "Generator Fuel (Diesel)",    category: "Other",            quantity: 25,  unit: "liters",  minQuantity: 15,  expiryDate: null },
];

// GET /api/inventory?barangay=xxx
router.get("/", protect, async (req, res) => {
  try {
    const { barangay } = req.query;
    if (!barangay) return res.status(400).json({ message: "barangay is required" });

    // Auto-seed on first load per barangay
    const SEEDS = { bagongnayon: BAGONG_NAYON_SEED, beverlyhills: BEVERLY_HILLS_SEED };
    if (SEEDS[barangay]) {
      const count = await InventoryItem.countDocuments({ barangay });
      if (count === 0) {
        await InventoryItem.insertMany(SEEDS[barangay].map((item) => ({ ...item, barangay })));
      }
    }

    const items = await InventoryItem.find({ barangay }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/inventory/logs?barangay=xxx&limit=50  (admin only)
router.get("/logs", protect, requireAdmin, async (req, res) => {
  try {
    const { barangay, limit = 50 } = req.query;
    const query = barangay ? { barangay } : {};
    const logs = await InventoryLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/inventory
router.post("/", protect, async (req, res) => {
  try {
    const { name, category, quantity, unit, minQuantity, barangay, expiryDate } = req.body;
    const item = await InventoryItem.create({
      name, category, quantity, unit, minQuantity, barangay,
      expiryDate: expiryDate || null,
    });

    await InventoryLog.create({
      itemId:   item._id,
      itemName: item.name,
      barangay: item.barangay,
      action:   "item_created",
      newValue: quantity,
      user: { id: req.user.id, name: req.user.name },
    });

    pushItemAlert(item).catch((err) => console.error("[Inventory] Push failed:", err.message));

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/inventory/:id
router.put("/:id", protect, async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const { name, category, quantity, unit, minQuantity, expiryDate } = req.body;

    const FIELD_LABELS = {
      name: "name", category: "category", quantity: "quantity",
      unit: "unit", minQuantity: "min stock", expiryDate: "expiry date",
    };

    const incoming = { name, category, quantity, unit, minQuantity, expiryDate: expiryDate || null };

    const oldStatus = getItemStatus(item);

    for (const [field, newVal] of Object.entries(incoming)) {
      let oldVal = item[field];
      if (field === "expiryDate") {
        oldVal = item.expiryDate ? item.expiryDate.toISOString().split("T")[0] : null;
      }
      const normalNew = newVal instanceof Date ? newVal.toISOString().split("T")[0] : newVal;
      const normalOld = oldVal instanceof Date ? oldVal.toISOString().split("T")[0] : oldVal;

      if (String(normalNew) !== String(normalOld ?? "")) {
        await InventoryLog.create({
          itemId:        item._id,
          itemName:      item.name,
          barangay:      item.barangay,
          action:        "item_updated",
          field:         FIELD_LABELS[field] || field,
          previousValue: normalOld ?? null,
          newValue:      normalNew,
          user: { id: req.user.id, name: req.user.name },
        });
      }
    }

    Object.assign(item, incoming);
    await item.save();

    const newStatus = getItemStatus(item);
    if (STATUS_SEVERITY[newStatus] > STATUS_SEVERITY[oldStatus]) {
      pushItemAlert(item).catch((err) => console.error("[Inventory] Push failed:", err.message));
    }

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/inventory/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    await InventoryLog.create({
      itemId:        item._id,
      itemName:      item.name,
      barangay:      item.barangay,
      action:        "item_deleted",
      previousValue: item.quantity,
      user: { id: req.user.id, name: req.user.name },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
