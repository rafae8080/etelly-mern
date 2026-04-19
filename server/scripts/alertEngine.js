/**
 * scripts/alertEngine.js
 *
 * Runs as a cron job — system checks every 15 min, agency checks every 30 min.
 *
 * Alert sources:
 *  1. System — Flood evacuation scoring   (Open-Meteo rainfall + soil + elevation)
 *  2. System — River discharge thresholds (Open-Meteo Flood API / GloFAS v4)
 *  3. System — Heavy rainfall alert       (Open-Meteo — standalone PAGASA-class check)
 *  4. PHIVOLCS — Earthquake alerts        (USGS Earthquake API)
 *  5. PAGASA — Typhoon alerts             (GDACS RSS TC feed — already used in hazard.js)
 *  6. GDACS — Flood & volcano alerts       (GDACS RSS FL/VO feeds — replaces broken NDRRMC/ReliefWeb)
 *
 * APIs used (all free, no auth required):
 *  - Open-Meteo forecast: https://api.open-meteo.com/v1/forecast
 *  - Open-Meteo flood:    https://flood-api.open-meteo.com/v1/flood
 *  - USGS Earthquake:     https://earthquake.usgs.gov/fdsnws/event/1/query
 *  - GDACS RSS TC:        https://www.gdacs.org/xml/rss_tc_7d.xml
 *  - GDACS RSS FL/EQ/VO: https://www.gdacs.org/xml/rss_{fl|eq|vo}_7d.xml
 */

import cron from "node-cron";
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

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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
      signal: AbortSignal.timeout(15000),
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

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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

    const res = await fetch(`${USGS_EQ_URL}?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
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
      signal: AbortSignal.timeout(15000),
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

// ─── 6. GDACS Multi-Hazard Check (Flood · Earthquake · Volcano) ───────────────
//
// Replaces the broken NDRRMC/ReliefWeb integration with direct GDACS RSS feeds.
// GDACS is the same source already used for typhoon alerts — just different feeds.
// Covers the same disaster types NDRRMC reports on, with faster (≤6 min) updates.
//
// Feeds (all free, no auth, same domain as typhoon RSS):
//   FL — https://www.gdacs.org/xml/rss_fl_7d.xml  (floods,   past 7 days)
//   EQ — https://www.gdacs.org/xml/rss_eq_7d.xml  (earthquakes, past 7 days)
//   VO — https://www.gdacs.org/xml/rss_vo_7d.xml  (volcanoes,   past 7 days)
//
// GeoRSS fields used per item:
//   gdacs:eventtype   — FL | EQ | VO | TC
//   gdacs:alertlevel  — Green | Orange | Red
//   gdacs:eventid     — stable numeric ID for deduplication
//   gdacs:severity    — human-readable magnitude string (e.g. "Ms 5.5")
//   gdacs:country     — affected country name(s)
//   geo:lat / geo:long — event coordinates
//   title / description / pubDate — standard RSS fields
//
// Filtering:
//   - Country must include "Philippines" OR event coords within 800 km of Antipolo
//   - Green alerts included — GDACS Green can still be significant for PH context

const GDACS_FEEDS = {
  flood: "https://www.gdacs.org/xml/rss_fl_7d.xml",
  volcano: "https://www.gdacs.org/xml/rss_vo_7d.xml",
  // earthquake omitted — covered by USGS with better magnitude/depth detail
};

// Maximum distance from Antipolo to include an event (km)
const GDACS_RADIUS_KM = 800;

async function runGDACSCheck() {
  let totalSaved = 0;

  for (const [hazardType, feedUrl] of Object.entries(GDACS_FEEDS)) {
    try {
      const res = await fetch(feedUrl, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok)
        throw new Error(`GDACS ${hazardType} feed returned ${res.status}`);
      const xml = await res.text();

      const items = parseGDACSFeed(xml);
      let saved = 0;

      for (const item of items) {
        // Filter — must be Philippines or within radius
        const inPhilippines = /philippines/i.test(item.country ?? "");
        const distKm =
          item.lat != null && item.lon != null
            ? haversineKm(CITY.lat, CITY.lon, item.lat, item.lon)
            : Infinity;

        if (!inPhilippines && distKm > GDACS_RADIUS_KM) continue;

        // Dedupe by GDACS event ID
        const rawKey = `gdacs_${item.eventType}_${item.eventId}`;
        const existing = await Alert.findOne({ rawKey });
        if (existing) continue;

        const { severity, title, description } = buildGDACSAlert(item, distKm);

        await Alert.create({
          source: "GDACS",
          type: hazardType,
          severity,
          title,
          description,
          location: item.country
            ? item.country.split(";")[0].trim()
            : `${item.lat?.toFixed(2)}°N, ${item.lon?.toFixed(2)}°E`,
          barangays: [],
          raw: JSON.stringify({
            eventId: item.eventId,
            alertLevel: item.alertLevel,
            severityText: item.severityText,
            country: item.country,
          }),
          rawKey,
          isActive: true,
          createdAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        saved++;
        totalSaved++;
        console.log(`[AlertEngine] GDACS ${hazardType} — Saved: ${title}`);
      }

      console.log(
        `[AlertEngine] GDACS ${hazardType} — ${items.length} item(s) fetched, ${saved} saved`,
      );
    } catch (err) {
      console.error(
        `[AlertEngine] GDACS ${hazardType} check failed:`,
        err.message,
      );
    }
  }

  console.log(`[AlertEngine] GDACS — ${totalSaved} new alert(s) total`);
}

// Parse a GDACS RSS feed XML string into a plain array of event objects.
// Uses regex extraction — no XML parser dependency needed.
function parseGDACSFeed(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const get = (tag) => {
      const m = block.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
      );
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1").trim() : null;
    };
    const lat = parseFloat(
      get("geo:lat") ?? get("georss:point")?.split(" ")[0],
    );
    const lon = parseFloat(
      get("geo:long") ?? get("georss:point")?.split(" ")[1],
    );

    items.push({
      title: get("title"),
      description: get("description"),
      pubDate: get("pubDate"),
      eventType: get("gdacs:eventtype"),
      eventId: get("gdacs:eventid"),
      alertLevel: get("gdacs:alertlevel"), // Green | Orange | Red
      severityText: get("gdacs:severity"), // e.g. "Ms 5.5" or "Rf 120mm"
      country: get("gdacs:country"),
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
    });
  }

  return items;
}

// Map a parsed GDACS item to severity / title / description strings.
function buildGDACSAlert(item, distKm) {
  const level = (item.alertLevel ?? "green").toLowerCase();
  const proximityNote =
    distKm < Infinity ? ` — ${distKm.toFixed(0)} km from ${CITY.name}` : "";

  // Severity mapping
  // Red   → critical (escalate to evacuate for very close events)
  // Orange → warning
  // Green  → watch
  let severity = "watch";
  if (level === "red") {
    severity = distKm < 150 ? "evacuate" : "critical";
  } else if (level === "orange") {
    severity = "warning";
  }

  const typeLabel =
    {
      FL: "Flood",
      EQ: "Earthquake",
      VO: "Volcanic Activity",
      TC: "Tropical Cyclone",
    }[item.eventType ?? ""] ?? "Hazard";

  const title = `GDACS ${level.toUpperCase()} — ${typeLabel} in ${
    item.country?.split(";")[0].trim() ?? "Philippines Region"
  }${proximityNote}`;

  // Build description from RSS description field, trimmed to 400 chars
  const rawDesc = (item.description ?? item.title ?? "")
    .replace(/<[^>]+>/g, " ") // strip any embedded HTML
    .replace(/\s+/g, " ")
    .trim();

  const severityNote = item.severityText
    ? ` Severity: ${item.severityText}.`
    : "";
  const description =
    (rawDesc.length > 10 ? rawDesc.slice(0, 380) : title) + severityNote;

  return { severity, title, description };
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

// ─── One-time migration (retired) ────────────────────────────────────────────
//
// Previously fixed stale earthquake locations, stripped "Source:" suffixes from
// descriptions, and patched typhoon source/location fields. All existing alerts
// have been corrected. Function removed — safe to delete this comment too.

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
    runGDACSCheck(),
  ]);
}

export function startAlertEngine() {
  // Run immediately on startup
  runSystemChecks();
  runAgencyChecks();

  // Flood + river + rainfall every 15 minutes
  cron.schedule("*/15 * * * *", runSystemChecks, {
    scheduled: true,
    timezone: "Asia/Manila",
  });

  // Earthquake + typhoon + GDACS multi-hazard every 30 minutes
  cron.schedule("*/30 * * * *", runAgencyChecks, {
    scheduled: true,
    timezone: "Asia/Manila",
  });
}
