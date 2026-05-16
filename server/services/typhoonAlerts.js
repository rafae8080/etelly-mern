/**
 * Typhoon alerts via GDACS RSS TC feed (routed through the cached hazard.js endpoint).
 *
 * Severity — PAGASA 2022 wind thresholds (no GDACS alert level):
 *   wind >= 185 kph → evacuate  (Super Typhoon)
 *   wind >= 118 kph → critical  (Typhoon)
 *   wind >=  89 kph → warning   (Severe Tropical Storm)
 *   otherwise       → watch
 *
 * Expiry: 6 hours — matches PAGASA bulletin issuance cycle.
 */

import Alert from "../models/Alert.js";
import { upsertAlert } from "./alertHelpers.js";

const TYPHOON_URL =
  `${process.env.SERVER_BASE_URL ?? `http://localhost:${process.env.PORT || 5000}`}/api/hazard/typhoon`;

export async function runTyphoonCheck() {
  try {
    const res = await fetch(TYPHOON_URL, { signal: AbortSignal.timeout(35000) });
    if (!res.ok) throw new Error(`/api/hazard/typhoon returned ${res.status}`);
    const data = await res.json();

    // Deactivate all old hourly-keyed duplicates (legacy format: typhoon_id_YYYY-M-D-H).
    // Runs unconditionally so leftovers are cleaned even when no storms are active.
    await Alert.updateMany(
      { type: "typhoon", isActive: true, _dedupeKey: { $regex: "^typhoon_.+_\\d{4}-" } },
      { $set: { isActive: false } },
    );

    const storms = data.storms ?? [];
    if (storms.length === 0) {
      console.log("[AlertEngine] Typhoon — No active storms in PAR");
      return;
    }

    for (const storm of storms) {
      const windKph = storm.windKph ?? 0;

      // Severity derived purely from PAGASA 2022 wind thresholds — no GDACS alert level
      let severity;
      if      (windKph >= 185) severity = "evacuate"; // Super Typhoon (STY)
      else if (windKph >= 118) severity = "critical";  // Typhoon (TY)
      else if (windKph >= 87)  severity = "warning";   // Severe Tropical Storm (STS)
      else                     severity = "watch";     // TS (62-88) or TD (≤61)

      // PAGASA 2022 category label for display
      const pagasaLabel =
        windKph >= 185 ? "Super Typhoon (STY)"
        : windKph >= 118 ? "Typhoon (TY)"
        : windKph >= 87  ? "Severe Tropical Storm (STS)"
        : windKph >= 62  ? "Tropical Storm (TS)"
        :                  "Tropical Depression (TD)";

      await upsertAlert({
        source: "GDACS",
        _dedupeKey: `typhoon_${storm.id}`,
        type: "typhoon",
        severity,
        title: `${pagasaLabel} ${storm.name} — Active Near Philippines`,
        description:
          `${storm.name} is currently classified as a ${pagasaLabel} under the PAGASA 2022 ` +
          `wind scale with maximum sustained winds of ${windKph} km/h. ` +
          `Monitor PAGASA advisories for Public Storm Warning Signal (PSWS) assignments. ` +
          `Current position: ${storm.lat?.toFixed(1)}°N, ${storm.lon?.toFixed(1)}°E.`,
        location: `${storm.lat?.toFixed(2)}°N, ${storm.lon?.toFixed(2)}°E`,
        barangays: [],
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });

      console.log(
        `[AlertEngine] Typhoon — ${storm.name} (${windKph} kph, ${pagasaLabel}, severity: ${severity})`,
      );
    }
  } catch (err) {
    console.error("[AlertEngine] Typhoon check failed:", err.message);
  }
}
