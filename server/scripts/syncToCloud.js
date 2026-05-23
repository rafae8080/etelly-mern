import mongoose from "mongoose";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const CLOUD_SYNC_URL = process.env.CLOUD_SYNC_URL;
const BARANGAY_NAME = process.env.BARANGAY_NAME || "unknown";

async function checkInternet() {
  try {
    const res = await fetch("https://dns.google", {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Called from the server's setInterval (mongoose is already connected to local DB)
// Also supports standalone execution — see bottom of file
export async function syncReports() {
  const hasInternet = await checkInternet();
  if (!hasInternet) {
    console.log("[Sync] No internet. Skipping.");
    return;
  }

  if (!CLOUD_SYNC_URL || CLOUD_SYNC_URL.includes("your-deployed-server")) {
    console.warn("[Sync] CLOUD_SYNC_URL not configured. Skipping.");
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    console.warn("[Sync] DB not ready. Skipping.");
    return;
  }

  try {
    const col = mongoose.connection.db.collection("emergency_reports");
    const unsynced = await col
      .find({ syncedToCloud: { $ne: true } })
      .toArray();

    if (unsynced.length === 0) {
      console.log("[Sync] Nothing to sync.");
      return;
    }

    console.log(
      `[Sync] Found ${unsynced.length} unsynced reports. Pushing to cloud...`
    );

    const response = await fetch(CLOUD_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: unsynced, barangayName: BARANGAY_NAME }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error(`Cloud returned ${response.status}`);

    const data = await response.json();

    if (data.success) {
      const ids = unsynced.map((r) => r._id);
      await col.updateMany(
        { _id: { $in: ids } },
        { $set: { syncedToCloud: true } }
      );
      console.log(
        `[Sync] Done. ${data.inserted} synced, ${data.skipped} duplicates skipped.`
      );
    }
  } catch (err) {
    console.error("[Sync] Push failed:", err.message);
  }
}

// Standalone execution: node scripts/syncToCloud.js
if (process.argv[1] === __filename) {
  const LOCAL_MONGO =
    process.env.LOCAL_MONGO_URI || "mongodb://localhost:27017/etelly_local";

  mongoose
    .connect(LOCAL_MONGO)
    .then(() => syncReports())
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
