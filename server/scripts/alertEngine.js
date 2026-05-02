/**
 * scripts/alertEngine.js
 *
 * Cron orchestrator — schedules and sequences all hazard checks.
 *
 *  System checks (every 15 min):  flood evacuation → heavy rainfall → landslide
 *  Agency checks (every 30 min):  earthquake + typhoon + GDACS (run in parallel)
 *
 * Each check lives in its own service module under server/services/.
 * Open-Meteo calls share the cache in openMeteoCache.js — no duplicate fetches.
 */

import cron from "node-cron";
import Alert from "../models/Alert.js";
import { runFloodEvacuationCheck, runHeavyRainfallCheck } from "../services/floodAlerts.js";
import { runLandslideCheck }  from "../services/landslideAlerts.js";
import { runEarthquakeCheck } from "../services/earthquakeAlerts.js";
import { runTyphoonCheck }    from "../services/typhoonAlerts.js";
import { runGDACSCheck }      from "../services/gdacsAlerts.js";

async function runExpiryCleanup() {
  try {
    const result = await Alert.updateMany(
      { isActive: true, expiresAt: { $lt: new Date() } },
      { $set: { isActive: false, updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      console.log(`[AlertEngine] Expiry cleanup — deactivated ${result.modifiedCount} expired alert(s)`);
    }
  } catch (err) {
    console.error("[AlertEngine] Expiry cleanup failed:", err.message);
  }
}

async function runSystemChecks() {
  console.log("[AlertEngine] Running system checks…", new Date().toISOString());
  // Expiry cleanup runs first so stale alerts are gone before new ones are scored.
  await runExpiryCleanup();
  await runFloodEvacuationCheck(); // warms rainfall-hourly + landslide cache
  await runHeavyRainfallCheck();   // reuses warm cache
  await runLandslideCheck();       // reuses warm cache from flood check above
}

async function runAgencyChecks() {
  console.log("[AlertEngine] Running agency checks…", new Date().toISOString());
  await Promise.allSettled([
    runEarthquakeCheck(),
    runTyphoonCheck(),
    runGDACSCheck(),
  ]);
}

export function startAlertEngine() {
  // Short startup delays let Express finish binding before the first upstream fetch.
  setTimeout(runSystemChecks, 2000); // cache-backed — safe on startup
  setTimeout(runAgencyChecks, 7000); // staggered so cache is warm first

  cron.schedule("*/15 * * * *", runSystemChecks, { scheduled: true, timezone: "Asia/Manila" });
  cron.schedule("*/30 * * * *", runAgencyChecks, { scheduled: true, timezone: "Asia/Manila" });
}
