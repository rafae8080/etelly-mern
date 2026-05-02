/**
 * Flood alert checks — two independent checks that share one warm cache fetch:
 *
 *  1. runFloodEvacuationCheck — PAGASA-aligned 3-factor scoring per barangay
 *     F1: >= 3 consecutive Heavy (>=15 mm/hr) hours
 *     F2: elevation < 15 m ASL (Phil-LiDAR)
 *     F3: prior 24h rain > 20 mm OR soil moisture > 0.4
 *
 *  2. runHeavyRainfallCheck — standalone burst detection for the next 6 hours,
 *     catches intense peaks that the consecutive-hour model may miss.
 *
 * F1 uses tiered look-ahead windows so severity tracks forecast confidence:
 *   2h → EVACUATE | 4h → WARNING | 6h → WATCH
 */

import {
  fetchRainfallHourly,
  fetchLandslideData,
  classifyRainfallIntensity,
  findCurrentHourIndex,
} from "./openMeteoCache.js";
import { CITY } from "../config/alertConfig.js";
import { toDateKey, upsertSystemAlert } from "./alertHelpers.js";

const LOW_ELEV_M = 15;

// elevation: metres ASL from Phil-LiDAR / LIPAD DEM data for Antipolo City.
// lat/lon: approximate centroid coordinates for map marker placement.
const BARANGAY_ELEVATIONS = [
  { name: "San Roque",     elevation: 6,  lat: 14.576, lon: 121.180 },
  { name: "Munting Dilaw", elevation: 7,  lat: 14.572, lon: 121.175 },
  { name: "Bagong Nayon",  elevation: 8,  lat: 14.585, lon: 121.190 },
  { name: "Dela Paz",      elevation: 9,  lat: 14.580, lon: 121.185 },
  { name: "San Jose",      elevation: 10, lat: 14.590, lon: 121.178 },
  { name: "Mambugan",      elevation: 11, lat: 14.568, lon: 121.182 },
  { name: "Beverly Hills", elevation: 12, lat: 14.595, lon: 121.170 },
  { name: "Mayamot",       elevation: 14, lat: 14.602, lon: 121.176 },
  { name: "San Luis",      elevation: 18, lat: 14.583, lon: 121.195 },
  { name: "Calawis",       elevation: 22, lat: 14.565, lon: 121.210 },
];

function centroid(coords) {
  if (!coords.length) return { lat: CITY.lat, lon: CITY.lon };
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lon = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
  return { lat, lon };
}

export async function runFloodEvacuationCheck() {
  try {
    const rainfallResult = await fetchRainfallHourly(CITY.lat, CITY.lon);
    if (!rainfallResult) return;

    const landslideResult = await fetchLandslideData(CITY.lat, CITY.lon);
    if (!landslideResult) return;

    const { data: rainfallRaw } = rainfallResult;
    const times  = rainfallRaw.hourly?.time          ?? [];
    const precip = rainfallRaw.hourly?.precipitation ?? [];
    const startIdx = findCurrentHourIndex(times);
    const hourlyPrecip = Array.from({ length: 12 }, (_, i) => precip[startIdx + i] ?? 0);

    const maxConsecHeavy = (hours) => {
      let max = 0, run = 0;
      for (let i = 0; i < hours; i++) {
        const mm = precip[startIdx + i] ?? 0;
        if (mm >= 15) { run++; if (run > max) max = run; } else run = 0;
      }
      return max;
    };
    const f1_evacuate = maxConsecHeavy(2) >= 3;
    const f1_warning  = maxConsecHeavy(4) >= 3;
    const f1_watch    = maxConsecHeavy(6) >= 3;
    const consecutiveHeavyHours = maxConsecHeavy(6);

    const peakMmHr  = Math.max(...hourlyPrecip, 0);
    const peakClass = classifyRainfallIntensity(peakMmHr);
    const total12mm = hourlyPrecip.reduce((a, b) => a + b, 0);

    const { data: landslideRaw } = landslideResult;
    const todayIdx    = 3;
    const prior24Rain = landslideRaw.daily?.precipitation_sum?.[todayIdx] ?? 0;
    const soilTop     = (landslideRaw.hourly?.soil_moisture_0_to_7cm  ?? []).filter(Boolean);
    const soilDeep    = (landslideRaw.hourly?.soil_moisture_7_to_28cm ?? []).filter(Boolean);
    const soilMoisture    = ((soilTop.at(-1) ?? 0) + (soilDeep.at(-1) ?? 0)) / 2;
    const soilMoisturePct = Math.round(soilMoisture * 100);
    const f3_saturated = prior24Rain > 20 || soilMoisture > 0.4;

    const evacuateBarangays = [], evacuateCoords = [];
    const warningBarangays  = [], warningCoords  = [];
    const watchBarangays    = [], watchCoords    = [];

    for (const b of BARANGAY_ELEVATIONS) {
      const f2 = b.elevation < LOW_ELEV_M;
      if (f1_evacuate && f2 && f3_saturated) {
        evacuateBarangays.push(b.name); evacuateCoords.push({ lat: b.lat, lon: b.lon });
      } else if (f1_warning && (f2 || f3_saturated)) {
        warningBarangays.push(b.name);  warningCoords.push({ lat: b.lat, lon: b.lon });
      } else if ((f2 && f3_saturated) || f1_watch) {
        watchBarangays.push(b.name);    watchCoords.push({ lat: b.lat, lon: b.lon });
      }
    }

    const rainfallContext =
      `Peak: ${peakMmHr.toFixed(1)} mm/hr (${peakClass.label} — PAGASA classification), ` +
      `${total12mm.toFixed(1)} mm total over 12 hours, ` +
      `${consecutiveHeavyHours} consecutive hour(s) of Heavy+ rainfall. ` +
      `Prior 24hr accumulation: ${prior24Rain.toFixed(1)} mm. ` +
      `Soil moisture: ${soilMoisturePct}% saturation. ` +
      `Source: Open-Meteo forecast, Phil-LiDAR elevation data.`;

    if (evacuateBarangays.length > 0) {
      const { lat, lon } = centroid(evacuateCoords);
      await upsertSystemAlert({
        _dedupeKey: `flood_evacuate_${toDateKey()}`,
        type: "flood", severity: "evacuate",
        title: `Flood Evacuation Alert — ${evacuateBarangays.length} Barangay(s)`,
        description:
          `Immediate evacuation recommended. All 3 flood risk factors are active: ` +
          `continuous heavy rainfall, low-elevation terrain, and saturated soil. ` +
          `${rainfallContext} Affected: ${evacuateBarangays.join(", ")}.`,
        barangays: evacuateBarangays,
        location: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    }

    if (warningBarangays.length > 0) {
      const { lat, lon } = centroid(warningCoords);
      await upsertSystemAlert({
        _dedupeKey: `flood_warning_${toDateKey()}`,
        type: "flood", severity: "warning",
        title: `Flood Warning — ${warningBarangays.length} Barangay(s)`,
        description:
          `Flood risk elevated. Heavy rainfall forecast for low-elevation zones. ` +
          `${rainfallContext} Prepare for possible evacuation. ` +
          `Affected: ${warningBarangays.join(", ")}.`,
        barangays: warningBarangays,
        location: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    }

    if (watchBarangays.length > 0) {
      const { lat, lon } = centroid(watchCoords);
      await upsertSystemAlert({
        _dedupeKey: `flood_watch_${toDateKey()}`,
        type: "flood", severity: "watch",
        title: `Flood Watch — Monitor Conditions`,
        description:
          `Flood conditions are possible. ${rainfallContext} ` +
          `Residents in low-lying areas should stay alert and monitor updates.`,
        barangays: watchBarangays,
        location: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      });
    }

    console.log(
      `[AlertEngine] Flood — EVACUATE:${evacuateBarangays.length} ` +
        `WARNING:${warningBarangays.length} WATCH:${watchBarangays.length} ` +
        `| Heavy hours:${consecutiveHeavyHours} Peak:${peakMmHr.toFixed(1)}mm/hr ` +
        `| Soil: ${soilMoisturePct}%`,
    );
  } catch (err) {
    console.error("[AlertEngine] Flood check failed:", err.message);
  }
}

// Standalone burst detection — fires when any hour in the next 6h reaches
// Heavy (>=15 mm/hr). Catches sudden intense peaks the consecutive-hour model may miss.
// Severity: Torrential (>=60) → critical | Intense (>=30) → warning | Heavy → watch
export async function runHeavyRainfallCheck() {
  try {
    const result = await fetchRainfallHourly(CITY.lat, CITY.lon);
    if (!result) return;

    const { data } = result;
    const times  = data.hourly?.time          ?? [];
    const precip = data.hourly?.precipitation ?? [];
    const startIdx  = findCurrentHourIndex(times);
    const next6     = Array.from({ length: 6 }, (_, i) => precip[startIdx + i] ?? 0);
    const peakMmHr  = Math.max(...next6, 0);
    const peakClass = classifyRainfallIntensity(peakMmHr);

    if (peakClass.level < 3) {
      console.log(
        `[AlertEngine] Rainfall — Peak ${peakMmHr.toFixed(1)} mm/hr (${peakClass.label}), no alert needed`,
      );
      return;
    }

    let severity;
    if (peakClass.level >= 5) severity = "critical";
    else if (peakClass.level >= 4) severity = "warning";
    else severity = "watch";

    await upsertSystemAlert({
      _dedupeKey: `rainfall_${severity}_${toDateKey()}`,
      type: "rainfall", severity,
      title: `${peakClass.label} Rainfall Alert — ${CITY.name}`,
      description:
        `${peakClass.label} rainfall (${peakMmHr.toFixed(1)} mm/hr) is forecast ` +
        `within the next 6 hours over ${CITY.name}. ` +
        `PAGASA classification: ${peakClass.label}. ` +
        `Residents in low-lying and flood-prone areas should take precautions. ` +
        `Source: Open-Meteo hourly forecast.`,
      barangays: [],
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });

    console.log(
      `[AlertEngine] Rainfall — ${peakClass.label} alert raised (${peakMmHr.toFixed(1)} mm/hr, severity: ${severity})`,
    );
  } catch (err) {
    console.error("[AlertEngine] Heavy rainfall check failed:", err.message);
  }
}
