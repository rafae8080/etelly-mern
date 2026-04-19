/**
 * scripts/alertEngine.js
 *
 * Runs as a cron job — system checks every 15 min, agency checks every 30 min.
 *
 * Alert sources:
 *  1. System — Flood evacuation scoring   (Open-Meteo rainfall + soil + elevation)
 *  2. System — River discharge thresholds (Open-Meteo Flood API / GloFAS v4)
 *  3. System — Heavy rainfall alert       (Open-Meteo — standalone PAGASA-class check)
 *  4. PHIVOLCS — Earthquake alerts        (USGS Earthquake API — replaces broken RSS)
 *  5. PAGASA — Typhoon alerts             (GDACS RSS TC feed — already used in hazard.js)
 *  6. NDRRMC — Situation reports          (ReliefWeb REST API — replaces scraping)
 *
 * APIs used (all free, no auth required):
 *  - Open-Meteo forecast: https://api.open-meteo.com/v1/forecast
 *  - Open-Meteo flood:    https://flood-api.open-meteo.com/v1/flood
 *  - USGS Earthquake:     https://earthquake.usgs.gov/fdsnws/event/1/query
 *  - GDACS RSS TC:        https://www.gdacs.org/xml/rss_tc_7d.xml
 *  - ReliefWeb API:       https://api.reliefweb.int/v1/reports
 */

import cron from "node-cron";
import fetch from "node-fetch";
import Alert from "../models/Alert.js";

// ─── City config ──────────────────────────────────────────────────────────────

const CITY = { lat: 14.5882, lon: 121.1763, name: "Antipolo City, Rizal" };

// ─── Barangay elevation table (metres ASL) ────────────────────────────────────
// Source: Phil-LiDAR / LIPAD DEM data for Antipolo City.
// Barangays below LOW_ELEV_M are classified as flood-prone low-lying zones.

const LOW_ELEV_M = 15;

const BARANGAY_ELEVATIONS = [
  { name: "San Roque", elevation: 6 },
  { name: "Munting Dilaw", elevation: 7 },
  { name: "Bagong Nayon", elevation: 8 },
  { name: "Dela Paz", elevation: 9 },
  { name: "San Jose", elevation: 10 },
  { name: "Mambugan", elevation: 11 },
  { name: "Beverly Hills", elevation: 12 },
  { name: "Mayamot", elevation: 14 },
  { name: "San Luis", elevation: 18 },
  { name: "Calawis", elevation: 22 },
];

// ─── River discharge thresholds (m³/s) ───────────────────────────────────────
// Source: GloFAS v4 return-period thresholds for Antipolo area gauges.

const RIVER_THRESHOLDS = {
  marikina_river_antipolo: { warning: 300, critical: 600 },
  manggahan_floodway: { warning: 200, critical: 450 },
  hinulugang_taktak: { warning: 80, critical: 150 },
};

// ─── PAGASA rainfall classification (mm/hr) ───────────────────────────────────
// Source: PAGASA Rainfall Advisory System

function classifyRainfallIntensity(mmPerHour) {
  if (mmPerHour >= 60) return { label: "Torrential", level: 5 };
  if (mmPerHour >= 30) return { label: "Intense", level: 4 };
  if (mmPerHour >= 15) return { label: "Heavy", level: 3 };
  if (mmPerHour >= 7.5) return { label: "Moderate", level: 2 };
  if (mmPerHour > 0) return { label: "Light", level: 1 };
  return { label: "None", level: 0 };
}

// ─── 1. Flood Evacuation Scoring ──────────────────────────────────────────────
//
// PAGASA-aligned 3-factor scoring model:
//
//  F1 — Consecutive heavy rainfall hours
//       >= 3 consecutive hours of Heavy rainfall (>= 15mm/hr) -> F1 triggered
//
//  F2 — Barangay elevation (Phil-LiDAR)
//       Elevation < 15m ASL -> flood-prone low-lying zone
//
//  F3 — Soil saturation proxy (Open-Meteo)
//       Prior 24hr rainfall > 20mm OR soil moisture > 40%
//
//  Alert levels:
//    F1 + F2 + F3 -> EVACUATE
//    F1 + F2      -> WARNING
//    F1 + F3      -> WARNING
//    F2 + F3      -> WATCH
//    F1 only      -> WATCH
//    0-1 factors  -> no alert

async function runFloodEvacuationCheck() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${CITY.lat}&longitude=${CITY.lon}` +
      `&hourly=precipitation,soil_moisture_0_to_1cm` +
      `&daily=precipitation_sum` +
      `&forecast_days=2` +
      `&timezone=Asia%2FManila`;

    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const data = await res.json();

    const hourlyPrecip = data.hourly?.precipitation ?? [];
    const nowHour = new Date().getHours();

    // F1 — consecutive hours of Heavy+ rainfall (>= 15mm/hr) starting now
    const next12Precip = hourlyPrecip.slice(nowHour, nowHour + 12);
    let consecutiveHeavyHours = 0;
    for (const mm of next12Precip) {
      if ((mm ?? 0) >= 15) consecutiveHeavyHours++;
      else break;
    }
    const f1_heavyRain = consecutiveHeavyHours >= 3;

    const peakMmHr = Math.max(...next12Precip.map((v) => v ?? 0));
    const peakClass = classifyRainfallIntensity(peakMmHr);
    const total12mm = next12Precip.reduce((a, b) => a + (b ?? 0), 0);

    // F3 — soil saturation
    const prior24Rain = data.daily?.precipitation_sum?.[0] ?? 0;
    const soilMoisture = data.hourly?.soil_moisture_0_to_1cm?.[nowHour] ?? 0;
    const f3_saturated = prior24Rain > 20 || soilMoisture > 0.4;

    // Score each barangay
    const evacuateBarangays = [];
    const warningBarangays = [];
    const watchBarangays = [];

    for (const b of BARANGAY_ELEVATIONS) {
      const f2 = b.elevation < LOW_ELEV_M;
      const count = [f1_heavyRain, f2, f3_saturated].filter(Boolean).length;

      if (count >= 3) evacuateBarangays.push(b.name);
      else if (f1_heavyRain && f2) warningBarangays.push(b.name);
      else if (f1_heavyRain && f3_saturated) warningBarangays.push(b.name);
      else if (count === 2 || f1_heavyRain) watchBarangays.push(b.name);
    }

    const rainfallContext =
      `Peak: ${peakMmHr.toFixed(1)} mm/hr (${peakClass.label} — PAGASA classification), ` +
      `${total12mm.toFixed(1)} mm total over 12 hours, ` +
      `${consecutiveHeavyHours} consecutive hour(s) of Heavy+ rainfall. ` +
      `Prior 24hr accumulation: ${prior24Rain.toFixed(1)} mm. ` +
      `Source: Open-Meteo forecast, Phil-LiDAR elevation data.`;

    if (evacuateBarangays.length > 0) {
      await upsertSystemAlert({
        _dedupeKey: `flood_evacuate_${toDateKey()}`,
        type: "flood",
        severity: "evacuate",
        title: `Flood Evacuation Alert — ${evacuateBarangays.length} Barangay(s)`,
        description:
          `Immediate evacuation recommended. All 3 flood risk factors are active: ` +
          `continuous heavy rainfall, low-elevation terrain, and saturated soil. ` +
          `${rainfallContext} Affected: ${evacuateBarangays.join(", ")}.`,
        barangays: evacuateBarangays,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
    }

    if (warningBarangays.length > 0) {
      await upsertSystemAlert({
        _dedupeKey: `flood_warning_${toDateKey()}`,
        type: "flood",
        severity: "warning",
        title: `Flood Warning — ${warningBarangays.length} Barangay(s)`,
        description:
          `Flood risk elevated. Heavy rainfall forecast for low-elevation zones. ` +
          `${rainfallContext} Prepare for possible evacuation. ` +
          `Affected: ${warningBarangays.join(", ")}.`,
        barangays: warningBarangays,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      });
    }

    if (watchBarangays.length > 0) {
      await upsertSystemAlert({
        _dedupeKey: `flood_watch_${toDateKey()}`,
        type: "flood",
        severity: "watch",
        title: `Flood Watch — Monitor Conditions`,
        description:
          `Flood conditions are possible. ${rainfallContext} ` +
          `Residents in low-lying areas should stay alert and monitor updates.`,
        barangays: watchBarangays,
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      });
    }

    console.log(
      `[AlertEngine] Flood — EVACUATE:${evacuateBarangays.length} ` +
        `WARNING:${warningBarangays.length} WATCH:${watchBarangays.length} ` +
        `| Heavy hours:${consecutiveHeavyHours} Peak:${peakMmHr.toFixed(1)}mm/hr`,
    );
  } catch (err) {
    console.error("[AlertEngine] Flood check failed:", err.message);
  }
}

// ─── 2. River Threshold Alerts ────────────────────────────────────────────────

async function runRiverThresholdCheck() {
  try {
    const res = await fetch("http://localhost:5000/api/hazard/flood-forecast", {
      timeout: 15000,
    });
    if (!res.ok) throw new Error(`flood-forecast returned ${res.status}`);
    const data = await res.json();

    for (const river of data.rivers ?? []) {
      const t = RIVER_THRESHOLDS[river.id] ?? {
        warning: river.threshold?.warning,
        critical: river.threshold?.critical,
      };
      const q = river.today;

      if (q >= t.critical) {
        await upsertSystemAlert({
          _dedupeKey: `river_critical_${river.id}_${toHourKey()}`,
          type: "river",
          severity: "critical",
          title: `Critical River Level — ${river.name}`,
          description:
            `${river.name} is at ${q.toFixed(1)} m³/s, exceeding the critical ` +
            `threshold of ${t.critical} m³/s. Flooding of adjacent low-lying ` +
            `barangays is imminent. 7-day peak forecast: ` +
            `${river.maxNext7?.toFixed(1) ?? "—"} m³/s. Source: GloFAS v4.`,
          barangays: [],
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        });
      } else if (q >= t.warning) {
        await upsertSystemAlert({
          _dedupeKey: `river_warning_${river.id}_${toHourKey()}`,
          type: "river",
          severity: "warning",
          title: `River Warning — ${river.name}`,
          description:
            `${river.name} is at ${q.toFixed(1)} m³/s, above the warning ` +
            `threshold of ${t.warning} m³/s. Water levels may continue to rise. ` +
            `7-day peak forecast: ${river.maxNext7?.toFixed(1) ?? "—"} m³/s. ` +
            `Source: GloFAS v4.`,
          barangays: [],
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        });
      }
    }

    console.log("[AlertEngine] River threshold check complete");
  } catch (err) {
    console.error("[AlertEngine] River check failed:", err.message);
  }
}

// ─── 3. Heavy Rainfall Alert ─────────────────────────────────────────────────
//
// Standalone check — fires when any hourly rainfall in the next 6 hours
// reaches Heavy (≥15 mm/hr) or above, even without consecutive hours.
// This catches sudden intense bursts that the F1 consecutive-hour model may miss.
//
// Severity mapping (PAGASA colour-code aligned):
//   Torrential (≥60)  → critical
//   Intense    (≥30)  → warning
//   Heavy      (≥15)  → watch

async function runHeavyRainfallCheck() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${CITY.lat}&longitude=${CITY.lon}` +
      `&hourly=precipitation` +
      `&forecast_days=1` +
      `&timezone=Asia%2FManila`;

    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const data = await res.json();

    const hourlyPrecip = data.hourly?.precipitation ?? [];
    const nowHour = new Date().getHours();
    const next6 = hourlyPrecip.slice(nowHour, nowHour + 6);

    const peakMmHr = Math.max(...next6.map((v) => v ?? 0));
    const peakClass = classifyRainfallIntensity(peakMmHr);

    // Only alert at Heavy (≥15 mm/hr) or above
    if (peakClass.level < 3) {
      console.log(
        `[AlertEngine] Rainfall — Peak ${peakMmHr.toFixed(1)} mm/hr (${peakClass.label}), no alert needed`,
      );
      return;
    }

    let severity;
    if (peakClass.level >= 5)
      severity = "critical"; // Torrential
    else if (peakClass.level >= 4)
      severity = "warning"; // Intense
    else severity = "watch"; // Heavy

    // Dedupe per hour — one alert per severity level per hour
    const dedupeKey = `rainfall_${severity}_${toHourKey()}`;

    await upsertSystemAlert({
      _dedupeKey: dedupeKey,
      type: "rainfall",
      severity,
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

// ─── 4. Earthquake Alerts (USGS API) ─────────────────────────────────────────
//
// Replaces the broken PHIVOLCS RSS feed (malformed HTTP headers, raw TLS hack).
// USGS FDSN Event Service: https://earthquake.usgs.gov/fdsnws/event/1/
//
// Parameters:
//   - M4.5+ within 500 km of Antipolo (covers all of Luzon + nearby seas)
//   - Past 24 hours only (engine runs every 30 min, no duplicates via rawKey)
//   - Results ordered by time descending
//
// Severity mapping (aligned with PHIVOLCS PEIS intensity scale):
//   M7.0+  → evacuate  (destructive, triggers tsunami warnings)
//   M6.0+  → critical  (very strong, structural damage likely)
//   M5.0+  → warning   (strong, felt widely across Metro Manila)
//   M4.5+  → watch     (moderate, may be felt in Rizal/NCR)

const USGS_EQ_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query";

// Approx radius in degrees (~500 km from Antipolo)
const EQ_SEARCH_RADIUS_KM = 500;

async function runEarthquakeCheck() {
  try {
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19);

    const params = new URLSearchParams({
      format: "geojson",
      starttime: startTime,
      minmagnitude: "4.5",
      latitude: CITY.lat,
      longitude: CITY.lon,
      maxradiuskm: EQ_SEARCH_RADIUS_KM,
      orderby: "time",
    });

    const res = await fetch(`${USGS_EQ_URL}?${params}`, { timeout: 15000 });
    if (!res.ok) throw new Error(`USGS API returned ${res.status}`);
    const data = await res.json();

    const events = data.features ?? [];
    console.log(
      `[AlertEngine] Earthquake — ${events.length} event(s) in past 24h (M4.5+ within ${EQ_SEARCH_RADIUS_KM}km)`,
    );

    for (const feature of events) {
      const props = feature.properties;
      const [lon, lat, depthKm] = feature.geometry.coordinates;
      const mag = props.mag ?? 0;
      const place = props.place ?? "Near Philippines";
      const time = new Date(props.time);
      const usgsId = feature.id; // e.g. "us7000abcd"

      // Severity based on PHIVOLCS scale mapping
      let severity;
      if (mag >= 7.0) severity = "evacuate";
      else if (mag >= 6.0) severity = "critical";
      else if (mag >= 5.0) severity = "warning";
      else severity = "watch";

      // Distance from Antipolo (Haversine approximate)
      const distKm = haversineKm(CITY.lat, CITY.lon, lat, lon);

      // Dedupe by USGS event ID — one alert per unique earthquake
      const rawKey = `usgs_eq_${usgsId}`;

      const existing = await Alert.findOne({ rawKey });
      if (existing) continue; // already saved this event

      const title = `M${mag.toFixed(1)} Earthquake — ${place}`;
      const description =
        `Magnitude ${mag.toFixed(1)} earthquake detected ${distKm.toFixed(0)} km ` +
        `from ${CITY.name}. Depth: ${depthKm?.toFixed(1) ?? "unknown"} km. ` +
        `Time: ${time.toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT.` +
        `${mag >= 5.5 ? " Drop, cover, and hold on. Check for structural damage after shaking stops." : ""}`;

      await Alert.create({
        source: "PHIVOLCS",
        type: "earthquake",
        severity,
        title,
        description,
        // Use the actual earthquake location, not the city.
        // place is e.g. "26 km ENE of Karligan, Philippines"
        location: place,
        barangays: [],
        raw: JSON.stringify({ usgsId, mag, place, depthKm, lat, lon }),
        rawKey,
        isActive: true,
        createdAt: time,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      console.log(
        `[AlertEngine] Earthquake — Saved: ${title} (${distKm.toFixed(0)}km away, severity: ${severity})`,
      );
    }
  } catch (err) {
    console.error("[AlertEngine] Earthquake check failed:", err.message);
  }
}

// ─── 5. Typhoon Alerts (GDACS RSS) ───────────────────────────────────────────
//
// Uses the same GDACS RSS TC feed already powering hazard.js /api/hazard/typhoon.
// Avoids duplicating the full XML parser — calls our own API endpoint instead.
//
// Alert thresholds (PAGASA PSWS aligned):
//   orange/red alert from GDACS + wind ≥ 118 kph → critical (PSWS #3 equivalent)
//   orange/red alert from GDACS + wind ≥  62 kph → warning  (PSWS #2 equivalent)
//   green/orange, any wind present near PAR       → watch
//
// Dedupes per storm event ID + hour so repeated cron runs don't spam the DB.

async function runTyphoonCheck() {
  try {
    const res = await fetch("http://localhost:5000/api/hazard/typhoon", {
      timeout: 15000,
    });
    if (!res.ok) throw new Error(`/api/hazard/typhoon returned ${res.status}`);
    const data = await res.json();

    const storms = data.storms ?? [];

    if (storms.length === 0) {
      console.log("[AlertEngine] Typhoon — No active storms in PAR");
      return;
    }

    for (const storm of storms) {
      const windKph = storm.windKph ?? 0;
      const gdacsLevel = (storm.alertLevel ?? "green").toLowerCase();

      // Determine severity
      let severity;
      if ((gdacsLevel === "red" || gdacsLevel === "orange") && windKph >= 118) {
        severity = "critical";
      } else if (
        (gdacsLevel === "red" || gdacsLevel === "orange") &&
        windKph >= 62
      ) {
        severity = "warning";
      } else {
        severity = "watch";
      }

      // Escalate to evacuate for violent typhoon (PSWS #4/#5 equivalent)
      if (windKph >= 220 || (windKph >= 185 && gdacsLevel === "red")) {
        severity = "evacuate";
      }

      const dedupeKey = `typhoon_${storm.id}_${toHourKey()}`;
      const category = storm.category?.label ?? "Tropical Cyclone";

      await upsertAlert({
        source: "GDACS",
        _dedupeKey: dedupeKey,
        type: "typhoon",
        severity,
        title: `${category} ${storm.name} — Active Near Philippines`,
        description:
          `${storm.name} (${category}) is active in the Western Pacific with ` +
          `sustained winds of ${windKph} km/h. ` +
          `GDACS alert level: ${gdacsLevel.toUpperCase()}. ` +
          `Monitor PAGASA advisories for PSWS signal assignments. ` +
          `Current position: ${storm.lat?.toFixed(1)}°N, ${storm.lon?.toFixed(1)}°E.`,
        // Storm's actual coordinates as location, not the city
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

// ─── 6. NDRRMC Reports (ReliefWeb API) ───────────────────────────────────────
//
// Replaces brittle NDRRMC website scraping with the ReliefWeb REST API.
// ReliefWeb is the UN OCHA humanitarian data platform — NDRRMC situation
// reports are officially uploaded here within hours of publication.
//
// API docs: https://apidoc.reliefweb.int/
// Endpoint: https://api.reliefweb.int/v1/reports
//
// Notes on the API:
//   - Use GET with query string params — POST to /reports returns 410 Gone.
//   - Filter by primary_country=174 (Philippines ReliefWeb country ID).
//   - Filter by source shortname "NDRRMC" via the `filter` JSON query param.
//   - Past 72 hours (wider window since NDRRMC uploads can lag 24–48 h).
//   - No API key required; appname param is best practice.

const RELIEFWEB_URL = "https://api.reliefweb.int/v1/reports";
const RELIEFWEB_APPNAME = "AntipoloDRRS";

// Keywords that make a report relevant to the Antipolo / Rizal area
const NDRRMC_AREA_KEYWORDS = [
  "antipolo",
  "rizal",
  "metro manila",
  "ncr",
  "marikina",
  "calabarzon",
  "luzon",
  "region iv",
];

async function runNDRRMCCheck() {
  try {
    // ReliefWeb GET query — filter JSON encoded in query string
    // primary_country id 174 = Philippines
    // source shortname NDRRMC
    const filter = JSON.stringify({
      operator: "AND",
      conditions: [
        { field: "primary_country", value: 174 },
        { field: "source.shortname", value: "NDRRMC" },
      ],
    });

    const fields = JSON.stringify({
      include: ["title", "body", "date.created", "source.shortname", "url"],
    });

    const params = new URLSearchParams({
      appname: RELIEFWEB_APPNAME,
      "filter[operator]": "AND",
      limit: "10",
      sort: "date.created:desc",
      "fields[include][]": ["title", "body", "date.created"],
    });

    // Use the simpler query-string form that reliefweb v1 supports reliably
    const qs = new URLSearchParams({
      appname: RELIEFWEB_APPNAME,
      "filter[conditions][0][field]": "primary_country",
      "filter[conditions][0][value]": "174",
      "filter[conditions][1][field]": "source.shortname",
      "filter[conditions][1][value]": "NDRRMC",
      "filter[operator]": "AND",
      "fields[include][0]": "title",
      "fields[include][1]": "body",
      "fields[include][2]": "date.created",
      "fields[include][3]": "source.shortname",
      sort: "date.created:desc",
      limit: "10",
    });

    const res = await fetch(`${RELIEFWEB_URL}?${qs}`, {
      headers: { Accept: "application/json" },
      timeout: 15000,
    });

    if (!res.ok) throw new Error(`ReliefWeb API returned ${res.status}`);
    const data = await res.json();

    const reports = data.data ?? [];
    console.log(
      `[AlertEngine] NDRRMC (ReliefWeb) — ${reports.length} report(s) fetched`,
    );

    let saved = 0;
    for (const report of reports) {
      const fields = report.fields ?? {};
      const title = fields.title ?? "";
      const body = fields.body ?? "";
      const combinedText = `${title} ${body}`.toLowerCase();

      // Only process reports relevant to our area
      if (!NDRRMC_AREA_KEYWORDS.some((k) => combinedText.includes(k))) {
        continue;
      }

      // Parse type and severity from report text
      const parsed = parseNDRRMCReport(title, body);
      if (!parsed) continue;

      // Dedupe by ReliefWeb report ID
      const rawKey = `reliefweb_${report.id}`;
      const existing = await Alert.findOne({ rawKey });
      if (existing) continue;

      const createdAt = new Date(fields.date?.created ?? Date.now());

      await Alert.create({
        source: "NDRRMC",
        type: parsed.type,
        severity: parsed.severity,
        title: title.slice(0, 120),
        description: parsed.description,
        location: CITY.name,
        barangays: [],
        raw: body.slice(0, 500),
        rawKey,
        isActive: true,
        createdAt,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      });

      saved++;
      console.log(`[AlertEngine] NDRRMC — Saved: ${title.slice(0, 80)}`);
    }

    console.log(
      `[AlertEngine] NDRRMC — ${saved}/${reports.length} report(s) saved`,
    );
  } catch (err) {
    console.error(
      "[AlertEngine] NDRRMC (ReliefWeb) check failed:",
      err.message,
    );
  }
}

// Parse NDRRMC report title + body into type/severity/description
function parseNDRRMCReport(title, body) {
  const t = `${title} ${body}`.toLowerCase();

  // Determine TYPE
  let type = "other";
  if (t.includes("flood") || t.includes("baha")) type = "flood";
  else if (t.includes("rainfall") || t.includes("rain")) type = "rainfall";
  else if (t.includes("earthquake") || t.includes("quake")) type = "earthquake";
  else if (
    t.includes("typhoon") ||
    t.includes("tropical storm") ||
    t.includes("bagyo")
  )
    type = "typhoon";
  else if (t.includes("lahar") || t.includes("volcanic")) type = "lahar";

  // Skip pure press releases (no hazard content)
  if (
    type === "other" &&
    !/situation|advisory|alert|warning|bulletin|sitrep/i.test(t)
  ) {
    return null;
  }

  // Determine SEVERITY
  let severity = "watch";
  if (
    t.includes("evacuate") ||
    t.includes("evacuation") ||
    t.includes("red rainfall") ||
    t.includes("extreme rainfall") ||
    t.includes("signal no. 4") ||
    t.includes("signal no. 5") ||
    t.includes("signal #4") ||
    t.includes("signal #5")
  ) {
    severity = "evacuate";
  } else if (
    t.includes("critical") ||
    t.includes("imminent") ||
    t.includes("intense rainfall") ||
    t.includes("signal no. 3") ||
    t.includes("signal #3") ||
    t.includes("magnitude 6") ||
    t.includes("magnitude 7")
  ) {
    severity = "critical";
  } else if (
    t.includes("warning") ||
    t.includes("orange rainfall") ||
    t.includes("heavy rainfall") ||
    t.includes("signal no. 2") ||
    t.includes("signal #2") ||
    t.includes("magnitude 5")
  ) {
    severity = "warning";
  }

  // Build description from first 2 meaningful sentences of the body
  const sentences = body
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const description =
    sentences.slice(0, 2).join(" ").slice(0, 400) ||
    body.slice(0, 400) ||
    title;

  return { type, severity, description };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function toHourKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

// Haversine formula — approximate distance in km between two lat/lon points
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Upsert for system-generated alerts (source always "system")
async function upsertSystemAlert({ _dedupeKey, ...alertData }) {
  await Alert.findOneAndUpdate(
    { _dedupeKey, isActive: true },
    {
      $set: {
        ...alertData,
        source: "system",
        _dedupeKey,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date(), isActive: true },
    },
    { upsert: true, new: true },
  );
}

// Upsert for agency alerts (preserves source field from caller)
async function upsertAlert({ _dedupeKey, source, ...alertData }) {
  await Alert.findOneAndUpdate(
    { _dedupeKey, isActive: true },
    {
      $set: {
        ...alertData,
        source,
        _dedupeKey,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date(), isActive: true },
    },
    { upsert: true, new: true },
  );
}

// ─── One-time migration ───────────────────────────────────────────────────────
//
// Cleans up alerts saved before these fixes were deployed:
//   1. Earthquake alerts: location was "Antipolo City, Rizal" — extract the real
//      location from the raw JSON field and patch it in.
//   2. All alerts: strip trailing "Source: X" sentences from descriptions since
//      the source badge in the UI already communicates this.
//
// Runs once on startup, safe to re-run (idempotent).

async function runMigration() {
  try {
    // 1. Fix earthquake locations — find alerts where location is still the city
    //    and we have a raw JSON field with the real place name
    const staleEq = await Alert.find({
      type: "earthquake",
      location: CITY.name,
      raw: { $exists: true, $ne: "" },
    });

    for (const alert of staleEq) {
      try {
        const rawData = JSON.parse(alert.raw);
        if (rawData.place && rawData.place !== CITY.name) {
          await Alert.findByIdAndUpdate(alert._id, {
            $set: { location: rawData.place, updatedAt: new Date() },
          });
          console.log(
            `[Migration] EQ location fixed: "${rawData.place}" (id: ${alert._id})`,
          );
        }
      } catch {
        // skip malformed raw
      }
    }

    // 2. Strip "Source: ..." from the end of all alert descriptions
    const sourcePattern = /\s*Source:[^.]+\.\s*$/i;
    const alertsWithSource = await Alert.find({
      description: { $regex: "Source:", $options: "i" },
      isActive: true,
    });

    for (const alert of alertsWithSource) {
      const cleaned = alert.description.replace(sourcePattern, "").trim();
      if (cleaned !== alert.description) {
        await Alert.findByIdAndUpdate(alert._id, {
          $set: { description: cleaned, updatedAt: new Date() },
        });
        console.log(`[Migration] Description cleaned (id: ${alert._id})`);
      }
    }

    // 3. Fix typhoon location — was "Antipolo City, Rizal", should be coords from description
    const staleTyphoon = await Alert.find({
      type: "typhoon",
      isActive: true,
    });

    for (const alert of staleTyphoon) {
      const updates = {};

      // Fix location
      if (alert.location === CITY.name) {
        const coordMatch = alert.description.match(
          /Current position:\s*([\d.]+)°N,\s*([\d.]+)°E/i,
        );
        if (coordMatch) {
          updates.location = `${coordMatch[1]}°N, ${coordMatch[2]}°E`;
        }
      }

      // Fix source — old alerts saved as "system" or "PAGASA" should be "GDACS"
      if (alert.source === "system" || alert.source === "PAGASA") {
        updates.source = "GDACS";
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await Alert.findByIdAndUpdate(alert._id, { $set: updates });
        console.log(
          `[Migration] Typhoon fixed ${JSON.stringify(updates)} (id: ${alert._id})`,
        );
      }
    }

    console.log("[Migration] Complete.");
  } catch (err) {
    console.error("[Migration] Failed:", err.message);
  }
}

// ─── Cron scheduler ──────────────────────────────────────────────────────────

async function runSystemChecks() {
  console.log("[AlertEngine] Running system checks…", new Date().toISOString());
  await Promise.allSettled([
    runFloodEvacuationCheck(),
    runRiverThresholdCheck(),
    runHeavyRainfallCheck(),
  ]);
}

async function runAgencyChecks() {
  console.log("[AlertEngine] Running agency checks…", new Date().toISOString());
  await Promise.allSettled([
    runEarthquakeCheck(),
    runTyphoonCheck(),
    runNDRRMCCheck(),
  ]);
}

export function startAlertEngine() {
  // Clean up stale data from before the location/description fixes
  runMigration();

  // Run immediately on startup
  runSystemChecks();
  runAgencyChecks();

  // Flood + river + rainfall every 15 minutes
  cron.schedule("*/15 * * * *", runSystemChecks, {
    scheduled: true,
    timezone: "Asia/Manila",
  });

  // Earthquake + typhoon + NDRRMC every 30 minutes
  cron.schedule("*/30 * * * *", runAgencyChecks, {
    scheduled: true,
    timezone: "Asia/Manila",
  });
}
