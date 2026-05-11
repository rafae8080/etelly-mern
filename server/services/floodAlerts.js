/**
 * Flood early warning — forecast-window model for Antipolo City.
 *
 * Severity is determined by WHEN the threshold-exceeding rainfall arrives
 * in the Open-Meteo hourly forecast, giving residents maximum lead time.
 *
 *   EVACUATE : PAGASA Red   (≥30 mm/hr) within the next 1 h AND soil saturated (>35%)
 *   CRITICAL : PAGASA Red   (≥30 mm/hr) within 1–3 hours
 *   WARNING  : PAGASA Orange (≥15 mm/hr) within 3–6 hours
 *   WATCH    : PAGASA Yellow  (≥7.5 mm/hr) within 6–12 hours
 *
 * Soil moisture is used only at the Evacuate tier — fully saturated ground +
 * intense rainfall = flash flooding is near-certain (not a prediction but a
 * physical inevitability given the terrain).
 *
 * Sources:
 *   Open-Meteo: Zippenfenig, P. (2023). doi:10.5281/zenodo.7970649
 *   PAGASA Color-Coded Rainfall Advisory System thresholds
 */

import {
  fetchRainfallHourly,
  fetchLandslideData,
  classifyRainfallIntensity,
  findCurrentHourIndex,
} from "./openMeteoCache.js";
import { CITY } from "../config/alertConfig.js";
import { toDateKey, upsertSystemAlert } from "./alertHelpers.js";

const CITY_LOCATION = `${CITY.lat},${CITY.lon}`;
const SOURCE_CITATION =
  "Source: Open-Meteo forecast (doi:10.5281/zenodo.7970649); " +
  "thresholds: PAGASA Color-Coded Rainfall Advisory System.";

// PAGASA hourly intensity thresholds (mm/hr)
const YELLOW = 7.5;
const ORANGE = 15;
const RED    = 30;

export async function runFloodEvacuationCheck() {
  try {
    const rainfallResult  = await fetchRainfallHourly(CITY.lat, CITY.lon);
    if (!rainfallResult) return;

    const landslideResult = await fetchLandslideData(CITY.lat, CITY.lon);
    if (!landslideResult) return;

    const { data: rainfallRaw } = rainfallResult;
    const times    = rainfallRaw.hourly?.time          ?? [];
    const precip   = rainfallRaw.hourly?.precipitation ?? [];
    const startIdx = findCurrentHourIndex(times);

    // Peak intensity inside each forecast window
    const peakIn = (from, to) => {
      let peak = 0;
      for (let i = from; i <= to; i++) {
        const mm = precip[startIdx + i] ?? 0;
        if (mm > peak) peak = mm;
      }
      return peak;
    };

    const peak_0_1h  = peakIn(0, 0);    // this hour
    const peak_1_3h  = peakIn(1, 2);    // 1–3 h ahead
    const peak_3_6h  = peakIn(3, 5);    // 3–6 h ahead
    const peak_6_12h = peakIn(6, 11);   // 6–12 h ahead

    // Soil moisture — Evacuate tier only
    const { data: landslideRaw } = landslideResult;
    const soilTop  = (landslideRaw.hourly?.soil_moisture_0_to_7cm  ?? []).filter(Boolean);
    const soilDeep = (landslideRaw.hourly?.soil_moisture_7_to_28cm ?? []).filter(Boolean);
    const soilMoisture    = ((soilTop.at(-1) ?? 0) + (soilDeep.at(-1) ?? 0)) / 2;
    const soilMoisturePct = Math.round(soilMoisture * 100);
    const soilSaturated   = soilMoisture > 0.35;

    // Human-readable Manila-time label for the triggering window
    const fmt = { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true };
    const timeAt = (offset) => {
      const t = times[startIdx + offset];
      return t ? new Date(t).toLocaleTimeString("en-PH", fmt) : null;
    };
    const windowLabel = (from, to) => {
      const t1 = timeAt(from);
      const t2 = timeAt(to + 1) ?? timeAt(to);
      if (!t1) return from === 0 ? "within the hour" : `in ${from}–${to + 1} hours`;
      return t2 ? `between ${t1} and ${t2}` : `around ${t1}`;
    };

    if (peak_0_1h >= RED && soilSaturated) {
      const cls = classifyRainfallIntensity(peak_0_1h);
      await upsertSystemAlert({
        _dedupeKey: `flood_evacuate_${toDateKey()}`,
        type: "flood", severity: "evacuate",
        title: `Flood Evacuation Alert — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak_0_1h.toFixed(1)} mm/hr, PAGASA ${cls.label}) is ` +
          `imminent. Soil is fully saturated (${soilMoisturePct}%), meaning runoff is ` +
          `instant — flash flooding in low-lying areas is near-certain. ` +
          `Immediate evacuation of all low-lying areas in Antipolo City is strongly recommended. ` +
          SOURCE_CITATION,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    } else if (peak_0_1h >= RED || peak_1_3h >= RED) {
      const peak = Math.max(peak_0_1h, peak_1_3h);
      const cls  = classifyRainfallIntensity(peak);
      const win  = peak_0_1h >= RED ? windowLabel(0, 0) : windowLabel(1, 2);
      await upsertSystemAlert({
        _dedupeKey: `flood_critical_${toDateKey()}`,
        type: "flood", severity: "critical",
        title: `Flash Flood Alert — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak.toFixed(1)} mm/hr, PAGASA ${cls.label}) is forecast ` +
          `${win}. At this intensity, surface runoff exceeds drainage capacity — flash flooding ` +
          `in low-lying areas is likely. Residents should move to higher ground immediately. ` +
          SOURCE_CITATION,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    } else if (peak_3_6h >= ORANGE) {
      const cls = classifyRainfallIntensity(peak_3_6h);
      const win = windowLabel(3, 5);
      await upsertSystemAlert({
        _dedupeKey: `flood_warning_${toDateKey()}`,
        type: "flood", severity: "warning",
        title: `Flood Warning — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak_3_6h.toFixed(1)} mm/hr, PAGASA ${cls.label}) is forecast ` +
          `${win}. Heavy rainfall at this rate can overwhelm drainage systems and cause ` +
          `localized flooding in low-lying and drainage-adjacent areas. Residents should ` +
          `begin preparations and stay alert. ` +
          SOURCE_CITATION,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    } else if (peak_6_12h >= YELLOW) {
      const cls = classifyRainfallIntensity(peak_6_12h);
      const win = windowLabel(6, 11);
      await upsertSystemAlert({
        _dedupeKey: `flood_watch_${toDateKey()}`,
        type: "flood", severity: "watch",
        title: `Flood Watch — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak_6_12h.toFixed(1)} mm/hr, PAGASA ${cls.label}) is forecast ` +
          `${win}. Conditions are developing that could lead to flooding in low-lying areas ` +
          `of Antipolo City. Residents should monitor updates and avoid flood-prone areas. ` +
          SOURCE_CITATION,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    }

    console.log(
      `[AlertEngine] Flood — 0-1h: ${peak_0_1h.toFixed(1)} mm/hr | ` +
      `1-3h: ${peak_1_3h.toFixed(1)} | 3-6h: ${peak_3_6h.toFixed(1)} | ` +
      `6-12h: ${peak_6_12h.toFixed(1)} | Soil: ${soilMoisturePct}%`,
    );
  } catch (err) {
    console.error("[AlertEngine] Flood check failed:", err.message);
  }
}

export async function runHeavyRainfallCheck() {
  try {
    const result = await fetchRainfallHourly(CITY.lat, CITY.lon);
    if (!result) return;

    const { data } = result;
    const times    = data.hourly?.time          ?? [];
    const precip   = data.hourly?.precipitation ?? [];
    const startIdx = findCurrentHourIndex(times);
    const next6    = Array.from({ length: 6 }, (_, i) => precip[startIdx + i] ?? 0);
    const peakMmHr  = Math.max(...next6, 0);
    const peakClass = classifyRainfallIntensity(peakMmHr);

    if (peakClass.level < 3) {
      console.log(`[AlertEngine] Rainfall — Peak ${peakMmHr.toFixed(1)} mm/hr (${peakClass.label}), no alert needed`);
      return;
    }

    const severity =
      peakClass.level >= 5 ? "critical" :
      peakClass.level >= 4 ? "warning"  : "watch";

    await upsertSystemAlert({
      _dedupeKey: `rainfall_${severity}_${toDateKey()}`,
      type: "rainfall", severity,
      title: `${peakClass.label} Rainfall — ${CITY.name}`,
      description:
        `${peakClass.label} rainfall (${peakMmHr.toFixed(1)} mm/hr, PAGASA ${peakClass.label}) ` +
        `is forecast within the next 6 hours. At this intensity, urban drainage may be ` +
        `overwhelmed. Residents in low-lying and flood-prone areas should take precautions. ` +
        SOURCE_CITATION,
      barangays: [],
      location: CITY_LOCATION,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });

    console.log(`[AlertEngine] Rainfall — ${peakClass.label} alert (${peakMmHr.toFixed(1)} mm/hr, severity: ${severity})`);
  } catch (err) {
    console.error("[AlertEngine] Heavy rainfall check failed:", err.message);
  }
}
