import InventoryItem from "../models/InventoryItem.js";
import { sendPushToAll } from "../routes/push.js";

const BARANGAY_LABELS = {
  bagongnayon:  "Brgy. Bagong Nayon",
  beverlyhills: "Brgy. Beverly Hills",
  calawis:      "Brgy. Calawis",
  cupang:       "Brgy. Cupang",
  dalig:        "Brgy. Dalig",
  delapaz:      "Brgy. Dela Paz",
  inarawan:     "Brgy. Inarawan",
  mambugan:     "Brgy. Mambugan",
  mayamot:      "Brgy. Mayamot",
  muntindilaw:  "Brgy. Muntindilaw",
  sanisidro:    "Brgy. San Isidro",
  sanjose:      "Brgy. San Jose",
  sanjuan:      "Brgy. San Juan",
  sanluis:      "Brgy. San Luis",
  sanroque:     "Brgy. San Roque",
  santacruz:    "Brgy. Santa Cruz",
};

// Returns "expired" | "expiring" | "outofstock" | "lowstock" | "ok"
export function getItemStatus(item) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (item.expiryDate) {
    const exp = new Date(item.expiryDate); exp.setHours(0, 0, 0, 0);
    if (exp < today) return "expired";
    const soon = new Date(today); soon.setDate(soon.getDate() + 30);
    if (exp <= soon) return "expiring";
  }
  if (item.quantity === 0)               return "outofstock";
  if (item.quantity <= item.minQuantity) return "lowstock";
  return "ok";
}

export const STATUS_SEVERITY = { ok: 0, expiring: 1, lowstock: 2, outofstock: 3, expired: 4 };

// Fire an instant push for a single item that has a bad status.
export async function pushItemAlert(item) {
  const status = getItemStatus(item);
  if (status === "ok") return;

  const brgyLabel = BARANGAY_LABELS[item.barangay] ?? item.barangay;
  const messages = {
    expired:    `"${item.name}" has expired`,
    expiring:   `"${item.name}" is expiring soon`,
    outofstock: `"${item.name}" is out of stock`,
    lowstock:   `"${item.name}" is low on stock`,
  };

  await sendPushToAll({
    title: `📦 Inventory Alert — ${brgyLabel}`,
    body:  messages[status],
    url:   "/resources",
    tag:   `inventory-item-${item._id}-${status}`,
  });
}

// Daily 8 AM summary: one push per barangay that has issues.
export async function runInventoryAlertCheck() {
  try {
    console.log("[InventoryAlerts] Running daily inventory check…");
    const items = await InventoryItem.find({}).lean();

    const byBarangay = {};
    for (const item of items) {
      const status = getItemStatus(item);
      if (status === "ok") continue;
      if (!byBarangay[item.barangay]) {
        byBarangay[item.barangay] = { expired: 0, expiring: 0, lowstock: 0, outofstock: 0 };
      }
      byBarangay[item.barangay][status]++;
    }

    for (const [brgy, counts] of Object.entries(byBarangay)) {
      const parts = [];
      if (counts.expired > 0)    parts.push(`${counts.expired} expired`);
      if (counts.expiring > 0)   parts.push(`${counts.expiring} expiring soon`);
      if (counts.outofstock > 0) parts.push(`${counts.outofstock} out of stock`);
      if (counts.lowstock > 0)   parts.push(`${counts.lowstock} low on stock`);

      const total     = Object.values(counts).reduce((a, b) => a + b, 0);
      const brgyLabel = BARANGAY_LABELS[brgy] ?? brgy;

      await sendPushToAll({
        title: `📦 Daily Inventory Report — ${brgyLabel}`,
        body:  `${total} item${total !== 1 ? "s" : ""} need attention: ${parts.join(", ")}`,
        url:   "/resources",
        tag:   `inventory-daily-${brgy}`,
      }).catch((err) => console.error("[InventoryAlerts] Push failed:", err.message));
    }

    console.log(`[InventoryAlerts] Done — ${Object.keys(byBarangay).length} barangay(s) with issues`);
  } catch (err) {
    console.error("[InventoryAlerts] Daily check failed:", err.message);
  }
}
