/**
 * Typhoon alerts via GDACS RSS TC feed (routed through the cached hazard.js endpoint).
 *
 * Severity (PAGASA PSWS aligned):
 *   wind >= 220 kph OR (red + wind >= 185) → evacuate
 *   (red/orange) + wind >= 118 kph         → critical  (PSWS #3)
 *   (red/orange) + wind >=  62 kph         → warning   (PSWS #2)
 *   otherwise                              → watch
 *
 * Expiry: 6 hours — matches PAGASA bulletin issuance cycle.
 */

import { upsertAlert, toHourKey } from "./alertHelpers.js";

const TYPHOON_URL =
  `${process.env.SERVER_BASE_URL ?? "http://localhost:5000"}/api/hazard/typhoon`;

export async function runTyphoonCheck() {
  try {
    const res = await fetch(TYPHOON_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`/api/hazard/typhoon returned ${res.status}`);
    const data = await res.json();

    const storms = data.storms ?? [];
    if (storms.length === 0) {
      console.log("[AlertEngine] Typhoon — No active storms in PAR");
      return;
    }

    for (const storm of storms) {
      const windKph    = storm.windKph ?? 0;
      const gdacsLevel = (storm.alertLevel ?? "green").toLowerCase();

      let severity;
      if ((gdacsLevel === "red" || gdacsLevel === "orange") && windKph >= 118) {
        severity = "critical";
      } else if ((gdacsLevel === "red" || gdacsLevel === "orange") && windKph >= 62) {
        severity = "warning";
      } else {
        severity = "watch";
      }

      if (windKph >= 220 || (windKph >= 185 && gdacsLevel === "red")) {
        severity = "evacuate";
      }

      const category = storm.category?.label ?? "Tropical Cyclone";

      await upsertAlert({
        source: "GDACS",
        _dedupeKey: `typhoon_${storm.id}_${toHourKey()}`,
        type: "typhoon",
        severity,
        title: `${category} ${storm.name} — Active Near Philippines`,
        description:
          `${storm.name} (${category}) is active in the Western Pacific with ` +
          `sustained winds of ${windKph} km/h. ` +
          `GDACS alert level: ${gdacsLevel.toUpperCase()}. ` +
          `Monitor PAGASA advisories for PSWS signal assignments. ` +
          `Current position: ${storm.lat?.toFixed(1)}°N, ${storm.lon?.toFixed(1)}°E.`,
        location: `${storm.lat?.toFixed(2)}°N, ${storm.lon?.toFixed(2)}°E`,
        barangays: [],
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });

      console.log(
        `[AlertEngine] Typhoon — ${storm.name} (${windKph} kph, GDACS: ${gdacsLevel}, severity: ${severity})`,
      );
    }
  } catch (err) {
    console.error("[AlertEngine] Typhoon check failed:", err.message);
  }
}
