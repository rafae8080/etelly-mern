/**
 * Landslide early warning — forecast-window + soil moisture model for Antipolo City.
 *
 * Two factors combine to determine severity:
 *   1. Forecast rainfall intensity (PAGASA thresholds) and WHEN it arrives
 *   2. Current soil moisture (Open-Meteo model — encodes antecedent rainfall)
 *
 * The time window defines lead time; soil moisture defines susceptibility.
 * A dry slope can handle more rain than a saturated one — hence soil moisture
 * is required for Watch/Critical/Evacuate but not Warning (heavy rain alone
 * warrants preparation regardless of prior conditions).
 *
 *   EVACUATE : PAGASA Red (≥30 mm/hr) within 1 h AND soil saturated (>35%)
 *   CRITICAL : PAGASA Red (≥30 mm/hr) within 1–3 h AND soil elevated (>25%)
 *   WARNING  : PAGASA Orange (≥15 mm/hr) within 3–6 h
 *   WATCH    : PAGASA Yellow (≥7.5 mm/hr) within 6–12 h AND soil rising (>20%)
 *
 * Sources:
 *   Open-Meteo: Zippenfenig, P. (2023). doi:10.5281/zenodo.7970649
 *   PAGASA Color-Coded Rainfall Advisory System
 *   MGB Geohazard Assessment criteria (MGB, DENR, 2014)
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
  "thresholds: PAGASA Color-Coded Rainfall Advisory and MGB geohazard assessment criteria (MGB, 2014).";

// PAGASA thresholds (mm/hr)
const YELLOW = 7.5;
const ORANGE = 15;
const RED    = 30;

export async function runLandslideCheck() {
  try {
    const rainfallResult  = await fetchRainfallHourly(CITY.lat, CITY.lon);
    if (!rainfallResult) return;

    const landslideResult = await fetchLandslideData(CITY.lat, CITY.lon);
    if (!landslideResult) return;

    const { data: rainfallRaw }  = rainfallResult;
    const { data: landslideRaw } = landslideResult;

    const times    = rainfallRaw.hourly?.time          ?? [];
    const precip   = rainfallRaw.hourly?.precipitation ?? [];
    const startIdx = findCurrentHourIndex(times);

    const peakIn = (from, to) => {
      let peak = 0;
      for (let i = from; i <= to; i++) {
        const mm = precip[startIdx + i] ?? 0;
        if (mm > peak) peak = mm;
      }
      return peak;
    };

    const peak_0_1h  = peakIn(0, 0);
    const peak_1_3h  = peakIn(1, 2);
    const peak_3_6h  = peakIn(3, 5);
    const peak_6_12h = peakIn(6, 11);

    // Soil moisture — primary slope instability indicator (MGB 2014)
    const soilTop  = (landslideRaw.hourly?.soil_moisture_0_to_7cm  ?? []).filter(Boolean);
    const soilDeep = (landslideRaw.hourly?.soil_moisture_7_to_28cm ?? []).filter(Boolean);
    const soilMoisture  = ((soilTop.at(-1) ?? 0) + (soilDeep.at(-1) ?? 0)) / 2;
    const soilPct       = Math.round(soilMoisture * 100);
    const soilSaturated = soilMoisture > 0.35;
    const soilElevated  = soilMoisture > 0.25;
    const soilRising    = soilMoisture > 0.20;

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

    const soilLine = soilSaturated
      ? `Soil is fully saturated (${soilPct}%), leaving slopes with near-zero resistance to failure.`
      : soilElevated
        ? `Soil moisture is elevated (${soilPct}%), reducing slope stability.`
        : `Soil moisture is at ${soilPct}%.`;

    if (peak_0_1h >= RED && soilSaturated) {
      const cls = classifyRainfallIntensity(peak_0_1h);
      await upsertSystemAlert({
        _dedupeKey: `landslide_evacuate_${toDateKey()}`,
        type: "landslide", severity: "evacuate",
        title: `Landslide Evacuation Alert — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak_0_1h.toFixed(1)} mm/hr, PAGASA ${cls.label}) is ` +
          `imminent. ${soilLine} Intense rain on saturated slopes is the primary trigger ` +
          `for debris flows and shallow landslides. Immediate evacuation of all residents ` +
          `near slopes and mountainous areas in eastern Antipolo City ` +
          `(Calawis, Dalig, San Jose, Mambugan) is required. ${SOURCE_CITATION}`,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    } else if ((peak_0_1h >= RED || peak_1_3h >= RED) && soilElevated) {
      const peak = Math.max(peak_0_1h, peak_1_3h);
      const cls  = classifyRainfallIntensity(peak);
      const win  = peak_0_1h >= RED ? windowLabel(0, 0) : windowLabel(1, 2);
      await upsertSystemAlert({
        _dedupeKey: `landslide_critical_${toDateKey()}`,
        type: "landslide", severity: "critical",
        title: `High Landslide Risk — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak.toFixed(1)} mm/hr, PAGASA ${cls.label}) is forecast ` +
          `${win}. ${soilLine} Elevated saturation combined with intense rainfall creates ` +
          `high probability of slope failure and debris flow. Residents near slopes in ` +
          `eastern Antipolo should evacuate to safe ground immediately. ${SOURCE_CITATION}`,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    } else if (peak_3_6h >= ORANGE) {
      const cls = classifyRainfallIntensity(peak_3_6h);
      const win = windowLabel(3, 5);
      await upsertSystemAlert({
        _dedupeKey: `landslide_warning_${toDateKey()}`,
        type: "landslide", severity: "warning",
        title: `Landslide Warning — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak_3_6h.toFixed(1)} mm/hr, PAGASA ${cls.label}) is forecast ` +
          `${win}. ${soilLine} Prolonged heavy rainfall on the Sierra Madre foothills ` +
          `increases the risk of shallow landslides and debris flow. Residents near slopes ` +
          `and ravines should prepare to evacuate and avoid hillside areas. ${SOURCE_CITATION}`,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    } else if (peak_6_12h >= YELLOW && soilRising) {
      const cls = classifyRainfallIntensity(peak_6_12h);
      const win = windowLabel(6, 11);
      await upsertSystemAlert({
        _dedupeKey: `landslide_watch_${toDateKey()}`,
        type: "landslide", severity: "watch",
        title: `Landslide Watch — Antipolo City`,
        description:
          `${cls.label} rainfall (${peak_6_12h.toFixed(1)} mm/hr, PAGASA ${cls.label}) is forecast ` +
          `${win}. ${soilLine} Gradual soil saturation on the Sierra Madre foothills may ` +
          `increase slope vulnerability if rainfall persists or intensifies. Residents near ` +
          `slopes in eastern Antipolo City should stay informed and monitor updates. ${SOURCE_CITATION}`,
        barangays: [],
        location: CITY_LOCATION,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    }

    console.log(
      `[AlertEngine] Landslide — 0-1h: ${peak_0_1h.toFixed(1)} mm/hr | ` +
      `1-3h: ${peak_1_3h.toFixed(1)} | 3-6h: ${peak_3_6h.toFixed(1)} | ` +
      `6-12h: ${peak_6_12h.toFixed(1)} | Soil: ${soilPct}%`,
    );
  } catch (err) {
    console.error("[AlertEngine] Landslide check failed:", err.message);
  }
}
