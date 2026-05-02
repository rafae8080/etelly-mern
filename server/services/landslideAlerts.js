/**
 * Landslide early warning — MGB-aligned 3-factor scoring per susceptibility zone.
 *
 *  L1: >= 2 consecutive Intense+ (>=30 mm/hr) hours
 *      OR prior 24h accumulation > zone threshold (risk 3: 20 mm, risk 2: 35 mm)
 *  L2: zone.risk === 3 (steep / unstable slope in MGB data)
 *  L3: soil moisture > 0.35 OR prior 72h rain > 50 mm
 *
 * Alert levels: L1+L2+L3 → EVACUATE | L1+L2 or L1+L3 → WARNING
 *               L2+L3 or L1 only → WATCH | 0-1 factors → no alert
 *
 * L1 uses tiered look-ahead windows matching forecast confidence to severity:
 *   2h → EVACUATE | 4h → WARNING | 6h → WATCH
 *
 * Cache is warm from runFloodEvacuationCheck which always runs first.
 */

import {
  fetchRainfallHourly,
  fetchLandslideData,
  findCurrentHourIndex,
} from "./openMeteoCache.js";
import { CITY } from "../config/alertConfig.js";
import { toDateKey, upsertSystemAlert } from "./alertHelpers.js";

// Mirrors LANDSLIDE_ZONES in hazard.js — keep in sync when zones change.
// Uses `lng` (not `lon`) to match hazard.js convention.
const LANDSLIDE_ZONES_ENGINE = [
  { lat: 14.622, lng: 121.198, risk: 3, name: "Brgy. Dalig (upper slope)" },
  { lat: 14.565, lng: 121.210, risk: 3, name: "Brgy. Calawis, Antipolo" },
  { lat: 14.615, lng: 121.187, risk: 3, name: "Brgy. San Jose (hillside)" },
  { lat: 14.607, lng: 121.182, risk: 3, name: "Brgy. Mambugan (ridge)" },
  { lat: 14.598, lng: 121.175, risk: 2, name: "Brgy. Inarawan (slope)" },
  { lat: 14.591, lng: 121.168, risk: 2, name: "Brgy. Dela Paz (hillside)" },
  { lat: 14.583, lng: 121.172, risk: 3, name: "Hinulugang Taktak escarpment" },
  { lat: 14.576, lng: 121.162, risk: 2, name: "Brgy. San Roque (mid-slope)" },
  { lat: 14.568, lng: 121.155, risk: 2, name: "Brgy. Cupang (elevated)" },
  { lat: 14.574, lng: 121.141, risk: 2, name: "Brgy. San Isidro (steep slope)" },
];

function centroid(zones) {
  if (!zones.length) return { lat: CITY.lat, lon: CITY.lon };
  const lat = zones.reduce((s, z) => s + z.lat, 0) / zones.length;
  const lon = zones.reduce((s, z) => s + z.lng, 0) / zones.length;
  return { lat, lon };
}

export async function runLandslideCheck() {
  try {
    const rainfallResult  = await fetchRainfallHourly(CITY.lat, CITY.lon);
    if (!rainfallResult) return;

    const landslideResult = await fetchLandslideData(CITY.lat, CITY.lon);
    if (!landslideResult) return;

    const { data: rainfallRaw }  = rainfallResult;
    const { data: landslideRaw } = landslideResult;

    const times  = rainfallRaw.hourly?.time          ?? [];
    const precip = rainfallRaw.hourly?.precipitation ?? [];
    const startIdx = findCurrentHourIndex(times);

    const maxConsecIntense = (hours) => {
      let max = 0, run = 0;
      for (let i = 0; i < hours; i++) {
        const mm = precip[startIdx + i] ?? 0;
        if (mm >= 30) { run++; if (run > max) max = run; } else run = 0;
      }
      return max;
    };
    const li_evacuate = maxConsecIntense(2) >= 2;
    const li_warning  = maxConsecIntense(4) >= 2;
    const li_watch    = maxConsecIntense(6) >= 2;
    const consecutiveIntenseHours = maxConsecIntense(6);

    const todayIdx    = 3;
    const prior24Rain = landslideRaw.daily?.precipitation_sum?.[todayIdx] ?? 0;
    const prior72Rain = (landslideRaw.daily?.precipitation_sum ?? [])
      .slice(Math.max(0, todayIdx - 2), todayIdx + 1)
      .reduce((a, b) => a + (b ?? 0), 0);

    const soilTop  = (landslideRaw.hourly?.soil_moisture_0_to_7cm  ?? []).filter(Boolean);
    const soilDeep = (landslideRaw.hourly?.soil_moisture_7_to_28cm ?? []).filter(Boolean);
    const soilMoisture = ((soilTop.at(-1) ?? 0) + (soilDeep.at(-1) ?? 0)) / 2;

    const l3_saturated = soilMoisture > 0.35 || prior72Rain > 50;

    const evacuateZones = [], warningZones = [], watchZones = [];

    for (const zone of LANDSLIDE_ZONES_ENGINE) {
      const rainfallThreshold = zone.risk === 3 ? 20 : 35;
      const l1_prior    = prior24Rain >= rainfallThreshold;
      const l2_slope    = zone.risk === 3;
      const l1_evacuate = li_evacuate || l1_prior;
      const l1_warning  = li_warning  || l1_prior;
      const l1_watch    = li_watch    || l1_prior;

      if (l1_evacuate && l2_slope && l3_saturated) {
        evacuateZones.push(zone);
      } else if (l1_warning && (l2_slope || l3_saturated)) {
        warningZones.push(zone);
      } else if ((l2_slope && l3_saturated) || l1_watch) {
        watchZones.push(zone);
      }
    }

    const soilPct  = (soilMoisture * 100).toFixed(0);
    const rainDesc = consecutiveIntenseHours >= 2
      ? `intense rain falling continuously for ${consecutiveIntenseHours}h (≥30 mm/hr)`
      : `${prior24Rain.toFixed(0)} mm accumulated in the past 24 hours`;
    const sourceNote =
      `Prior 24h: ${prior24Rain.toFixed(0)} mm, 72h: ${prior72Rain.toFixed(0)} mm. ` +
      `Source: Open-Meteo forecast, MGB susceptibility data.`;

    if (evacuateZones.length > 0) {
      const { lat, lon } = centroid(evacuateZones);
      await upsertSystemAlert({
        _dedupeKey: `landslide_evacuate_${toDateKey()}`,
        type: "landslide", severity: "evacuate",
        title: `Landslide Evacuation Alert — ${evacuateZones.length} Zone(s)`,
        description:
          `Soil is fully saturated (${soilPct}%) and cannot absorb more water — ` +
          `${rainDesc} over steep, high-risk slopes. ` +
          `Immediate evacuation recommended. ` +
          `${sourceNote} ` +
          `Affected: ${evacuateZones.map((z) => z.name).join(", ")}.`,
        barangays: evacuateZones.map((z) => z.name),
        location: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    }

    if (warningZones.length > 0) {
      const { lat, lon } = centroid(warningZones);
      await upsertSystemAlert({
        _dedupeKey: `landslide_warning_${toDateKey()}`,
        type: "landslide", severity: "warning",
        title: `Landslide Warning — ${warningZones.length} Zone(s)`,
        description:
          `Landslide risk elevated — ${rainDesc}, soil saturation at ${soilPct}%. ` +
          `Prepare for possible evacuation near steep slopes. ` +
          `${sourceNote} ` +
          `Affected: ${warningZones.map((z) => z.name).join(", ")}.`,
        barangays: warningZones.map((z) => z.name),
        location: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    }

    if (watchZones.length > 0) {
      const { lat, lon } = centroid(watchZones);
      await upsertSystemAlert({
        _dedupeKey: `landslide_watch_${toDateKey()}`,
        type: "landslide", severity: "watch",
        title: `Landslide Watch — Monitor Conditions`,
        description:
          `Landslide conditions possible — ${prior24Rain.toFixed(0)} mm of recent rain ` +
          `has raised soil moisture to ${soilPct}%. ` +
          `Residents near slopes should stay alert and monitor for instability. ` +
          `${sourceNote}`,
        barangays: watchZones.map((z) => z.name),
        location: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      });
    }

    console.log(
      `[AlertEngine] Landslide — EVACUATE:${evacuateZones.length} ` +
        `WARNING:${warningZones.length} WATCH:${watchZones.length} ` +
        `| Intense hours:${consecutiveIntenseHours} Prior24h:${prior24Rain.toFixed(1)}mm ` +
        `| Soil: ${(soilMoisture * 100).toFixed(0)}%`,
    );
  } catch (err) {
    console.error("[AlertEngine] Landslide check failed:", err.message);
  }
}
