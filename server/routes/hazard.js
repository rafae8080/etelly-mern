import express from "express";
import {
  getCached, getCachedStale, setCached, TTL,
  fetchOpenMeteo, fetchRainfallHourly, fetchLandslideData,
  classifyRainfallIntensity, findCurrentHourIndex,
} from "../services/openMeteoCache.js";

const router = express.Router();

// ── Antipolo flood risk zones ─────────────────────────────────────────────────
const ANTIPOLO_ZONES = [
  { lat: 14.5855, lng: 121.158, risk: 3, name: "Brgy. San Roque, Antipolo" },
  { lat: 14.591,  lng: 121.163, risk: 3, name: "Brgy. Dela Paz, Antipolo" },
  { lat: 14.578,  lng: 121.152, risk: 3, name: "Brgy. San Jose, Antipolo" },
  { lat: 14.572,  lng: 121.148, risk: 2, name: "Brgy. Cupang, Antipolo" },
  { lat: 14.566,  lng: 121.142, risk: 2, name: "Brgy. Mayamot, Antipolo" },
  { lat: 14.601,  lng: 121.171, risk: 2, name: "Brgy. Mambugan, Antipolo" },
  { lat: 14.595,  lng: 121.165, risk: 1, name: "Brgy. Inarawan, Antipolo" },
  { lat: 14.583,  lng: 121.17,  risk: 3, name: "Hinulugang Taktak Corridor" },
  { lat: 14.576,  lng: 121.139, risk: 2, name: "Brgy. San Isidro, Antipolo" },
  { lat: 14.608,  lng: 121.18,  risk: 1, name: "Brgy. Dalig, Antipolo" },
];

// ── GET /api/hazard/flood-zones ───────────────────────────────────────────────
router.get("/flood-zones", (_req, res) => {
  res.json({ zones: ANTIPOLO_ZONES });
});

// ── GET /api/hazard/flood ─────────────────────────────────────────────────────
// Single-point Open-Meteo flood API proxy (river discharge forecast).
router.get("/flood", async (req, res) => {
  try {
    const { lat = 14.5882, lon = 121.1763 } = req.query;
    const url =
      `https://flood-api.open-meteo.com/v1/flood` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=river_discharge_max&forecast_days=7&models=seamless_v4`;

    const result = await fetchOpenMeteo(url, `flood_${lat}_${lon}`, TTL.FLOOD);
    if (!result) return res.status(503).json({ error: "Rate limited by upstream API. Try again shortly." });
    res.json(result.data);
  } catch (err) {
    console.error("❌ Flood API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/flood-forecast ────────────────────────────────────────────
// 7-day rainfall forecast for Antipolo City — feeds FloodForecastPanel.
// Reuses the rainfall-hourly cache key so both routes share one upstream fetch.
router.get("/flood-forecast", async (req, res) => {
  try {
    const CACHE_KEY = "flood_forecast";
    const cached = getCached(CACHE_KEY);
    if (cached) return res.json(cached);

    const result = await fetchRainfallHourly(14.5882, 121.1763);
    if (!result) {
      const stale = getCachedStale(CACHE_KEY);
      if (stale) return res.json({ ...stale, stale: true });
      return res.status(503).json({ error: "Rate limited by upstream API. Try again shortly." });
    }

    const { data: rainfallData, stale: isStale } = result;
    const shaped = {
      rainfall: {
        dates:             rainfallData.daily?.time                          ?? [],
        precipitation_sum: rainfallData.daily?.precipitation_sum             ?? [],
        probability_max:   rainfallData.daily?.precipitation_probability_max ?? [],
      },
      generatedAt: new Date().toISOString(),
    };

    if (!isStale) setCached(CACHE_KEY, shaped, TTL.FLOOD_FORECAST);
    res.json({ ...shaped, ...(isStale && { stale: true }) });
  } catch (err) {
    console.error("❌ Flood forecast error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/rainfall-hourly ──────────────────────────────────────────
// 12-hour hourly rainfall with PAGASA classification for Antipolo.
router.get("/rainfall-hourly", async (req, res) => {
  try {
    const { lat = 14.5882, lon = 121.1763 } = req.query;

    const result = await fetchRainfallHourly(lat, lon);
    if (!result) return res.status(503).json({ error: "Rate limited by upstream API. Try again shortly." });
    const { data, stale: isStale } = result;

    const times  = data.hourly?.time                          ?? [];
    const precip = data.hourly?.precipitation                 ?? [];
    const prob   = data.hourly?.precipitation_probability     ?? [];
    const codes  = data.hourly?.weathercode                   ?? [];

    const nowManila   = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const currentHour = nowManila.getHours();
    const safeStart   = findCurrentHourIndex(times);

    const hours = Array.from({ length: 12 }, (_, i) => {
      const idx  = safeStart + i;
      const time = times[idx] ?? "";
      const hour = time ? parseInt(time.slice(11, 13)) : (currentHour + i) % 24;
      const mm   = precip[idx] ?? 0;
      return {
        time,
        hour,
        precipitation: mm,
        probability:   prob[idx]  ?? 0,
        weathercode:   codes[idx] ?? 0,
        pagasa:        classifyRainfallIntensity(mm),
      };
    });

    const maxLevel     = Math.max(...hours.map((h) => h.pagasa.level));
    const overallPagasa =
      hours.find((h) => h.pagasa.level === maxLevel)?.pagasa ?? classifyRainfallIntensity(0);

    res.json({
      hours,
      overallPagasa,
      currentHour,
      location:    { lat: parseFloat(lat), lon: parseFloat(lon) },
      generatedAt: new Date().toISOString(),
      ...(isStale && { stale: true }),
    });
  } catch (err) {
    console.error("❌ Rainfall hourly error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/flood-combined ────────────────────────────────────────────
// Static Antipolo flood risk zones (no river discharge enrichment).
router.get("/flood-combined", (_req, res) => {
  try {
    const CACHE_KEY = "flood_combined";
    let cached = getCached(CACHE_KEY);
    if (cached) return res.json(cached);
    const result = { zones: ANTIPOLO_ZONES };
    setCached(CACHE_KEY, result, TTL.FLOOD_COMBINED);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GDACS RSS helpers ─────────────────────────────────────────────────────────
// The GDACS GeoJSON API consistently returns maxwind=0/null even for Cat-5
// storms — a known upstream data quality issue. The RSS feed is updated every
// 6 minutes and reliably carries wind speed in gdacs:severity[value] (knots).

function xmlText(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const m  = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, "i");
  const m  = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseRssItems(xml) {
  const items = [];
  const re    = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

// ── GET /api/hazard/typhoon ───────────────────────────────────────────────────
// Primary source: GDACS RSS TC feed (reliable wind speed via gdacs:severity).
// GDACS cache is managed here rather than in openMeteoCache since it doesn't
// go through Open-Meteo — keeping the shared module focused on Open-Meteo only.
router.get("/typhoon", async (req, res) => {
  try {
    const CACHE_KEY = "typhoon";
    const cached = getCached(CACHE_KEY);
    if (cached) return res.json(cached);

    const PH_PAR = { minLat: 3, maxLat: 30, minLon: 110, maxLon: 145 };

    const rssRes = await fetch("https://www.gdacs.org/xml/rss_tc_7d.xml", {
      headers: { Accept: "application/xml, text/xml" },
      signal:  AbortSignal.timeout(15000),
    });
    if (!rssRes.ok) throw new Error(`GDACS RSS responded ${rssRes.status}`);
    const rssXml = await rssRes.text();

    const rawStorms = parseRssItems(rssXml)
      .map((item) => {
        if (xmlText(item, "gdacs:eventtype") !== "TC") return null;

        let lat = 0, lon = 0;
        const georssPoint = xmlText(item, "georss:point");
        if (georssPoint) {
          const parts = georssPoint.split(/\s+/);
          lat = parseFloat(parts[0]);
          lon = parseFloat(parts[1]);
        } else {
          lat = parseFloat(xmlText(item, "geo:lat")   ?? "0");
          lon = parseFloat(xmlText(item, "geo:long")  ?? "0");
        }

        if (lat < PH_PAR.minLat || lat > PH_PAR.maxLat ||
            lon < PH_PAR.minLon || lon > PH_PAR.maxLon) return null;

        const severityValueRaw = xmlAttr(item, "gdacs:severity", "value");
        const severityUnit     = xmlAttr(item, "gdacs:severity", "unit") ?? "kn";
        let windKph = 0;
        if (severityValueRaw) {
          const n = parseFloat(severityValueRaw);
          if (!isNaN(n) && n > 0)
            windKph = severityUnit === "km/h" ? n : Math.round(n * 1.852);
        }
        if (windKph === 0) {
          const severityText = xmlText(item, "gdacs:severity") ?? "";
          const m = severityText.match(/([\d.]+)\s*km\/h/i);
          if (m) windKph = Math.round(parseFloat(m[1]));
        }

        return {
          id:              xmlText(item, "gdacs:eventid")   ?? "unknown",
          episodeid:       xmlText(item, "gdacs:episodeid") ?? null,
          name:            xmlText(item, "gdacs:eventname") ?? "Unnamed Storm",
          lat, lon,
          alertLevel:      (xmlText(item, "gdacs:alertlevel") ?? "green").toLowerCase(),
          windKph:         Math.round(windKph),
          windKnots:       Math.round(windKph / 1.852),
          category:        classifyTyphoon(windKph),
          updatedAt:       xmlText(item, "gdacs:todate") ?? null,
          windRadiusKm:    estimateWindRadius(windKph),
          windRadiusSource:"estimated",
          movement:        null,
          direction:       null,
          forecastTrack:   [],
        };
      })
      .filter(Boolean);

    // Enrich each storm with forecast track from GDACS GeoJSON API (parallel)
    const storms = await Promise.all(
      rawStorms.map(async (storm) => ({
        ...storm,
        forecastTrack: await fetchForecastTrack(storm.id, storm.episodeid),
      })),
    );

    const result = { storms, hasActiveStorm: storms.length > 0, fetchedAt: new Date().toISOString() };
    setCached(CACHE_KEY, result, TTL.TYPHOON);
    res.json(result);
  } catch (err) {
    console.error("❌ Typhoon API error:", err.message);
    res.json({ storms: [], hasActiveStorm: false, fetchedAt: new Date().toISOString(), error: err.message });
  }
});

// ── GDACS per-event forecast track ───────────────────────────────────────────
// Track data is cached separately (6-hour TTL) so a single successful fetch
// survives many typhoon cache misses — GDACS in Europe is slow/unreliable from PH.
async function fetchForecastTrack(eventId, episodeId) {
  const trackCacheKey = `track_${eventId}_${episodeId}`;

  // Return cached track if still fresh (avoids hitting GDACS on every 5-min miss)
  const cachedTrack = getCached(trackCacheKey);
  if (cachedTrack) return cachedTrack;

  if (!episodeId) return [];

  try {
    const url =
      `https://www.gdacs.org/contentdata/resources/TC/${eventId}` +
      `/geojson_${eventId}_${episodeId}.geojson`;
    const res = await fetch(url, {
      headers: { Accept: "*/*" },
      signal: AbortSignal.timeout(22000),
    });

    if (!res.ok) {
      console.warn(`[Track] GeoJSON status ${res.status} for ${eventId}`);
      return getCachedStale(trackCacheKey) ?? [];
    }

    const geojson = await res.json();
    const features = geojson.features ?? [];

    const pts = features
      .filter((f) => {
        if (f.geometry?.type !== "Point") return false;
        const cls = f.properties?.Class ?? "";
        return /^Point_\d+$/.test(cls);
      })
      .sort((a, b) => {
        const n = (f) => parseInt(f.properties.Class.replace("Point_", ""), 10);
        return n(a) - n(b);
      })
      .map((f) => {
        const p = f.properties ?? {};
        const isPast = p.polygonlabel === "previous position";
        const windKph = p.windspeed ? Math.round(parseFloat(p.windspeed)) : null;
        return {
          lat:       f.geometry.coordinates[1],
          lon:       f.geometry.coordinates[0],
          label:     p.polygonlabel ?? "",
          trackdate: isPast ? null : (p.trackdate ?? null),
          windKph:   isPast ? null : windKph,
          windGusts: isPast ? null : (p.windgusts ? Math.round(parseFloat(p.windgusts)) : null),
          category:  isPast ? null : classifyTyphoon(windKph ?? 0),
        };
      })
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));

    if (pts.length >= 2) {
      setCached(trackCacheKey, pts, 6 * 60 * 60 * 1000);
      return pts;
    }
  } catch (err) {
    console.warn(`[Track] Fetch failed (${err.message}) — using stale cache if available`);
    return getCachedStale(trackCacheKey) ?? [];
  }

  return [];
}

function classifyTyphoon(windKph) {
  if (windKph >= 185) return { label: "Super Typhoon (STY)",        color: "#7c3aed", level: 5 };
  if (windKph >= 118) return { label: "Typhoon (TY)",               color: "#dc2626", level: 4 };
  if (windKph >= 89)  return { label: "Severe Tropical Storm (STS)",color: "#f97316", level: 3 };
  if (windKph >= 62)  return { label: "Tropical Storm (TS)",        color: "#f59e0b", level: 2 };
  return                     { label: "Tropical Depression (TD)",   color: "#3b82f6", level: 1 };
}

function estimateWindRadius(windKph) {
  if (windKph >= 220) return 150;
  if (windKph >= 185) return 130;
  if (windKph >= 118) return 100;
  if (windKph >= 89)  return  75;
  if (windKph >= 62)  return  55;
  return 40;
}

// ── Antipolo landslide susceptibility zones ───────────────────────────────────
const LANDSLIDE_ZONES = [
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

const LANDSLIDE_RAINFALL_THRESHOLDS = {
  low:      { day1:  50, day3: 100 },
  moderate: { day1:  35, day3:  70 },
  high:     { day1:  20, day3:  50 },
};

const SOIL_SATURATION_THRESHOLD = 0.35;

function classifyLandslideRisk(rainfall24h, rainfall72h, soilMoisture, slopeRisk) {
  const threshold =
    slopeRisk === 3 ? LANDSLIDE_RAINFALL_THRESHOLDS.high :
    slopeRisk === 2 ? LANDSLIDE_RAINFALL_THRESHOLDS.moderate :
                     LANDSLIDE_RAINFALL_THRESHOLDS.low;

  const soilSaturated  = soilMoisture >= SOIL_SATURATION_THRESHOLD;
  const rainfallTrigger = rainfall24h >= threshold.day1 || rainfall72h >= threshold.day3;

  if (slopeRisk === 3 && rainfallTrigger && soilSaturated)
    return { label: "Critical", level: 3, color: "#dc2626" };
  if (slopeRisk >= 2 && (rainfallTrigger || soilSaturated))
    return { label: "Warning",  level: 2, color: "#f97316" };
  if (slopeRisk >= 1 && rainfall24h >= threshold.day1 * 0.5)
    return { label: "Watch",    level: 1, color: "#f59e0b" };
  return               { label: "Low",     level: 0, color: "#22c55e" };
}

// ── GET /api/hazard/landslide-zones ──────────────────────────────────────────
router.get("/landslide-zones", (_req, res) => {
  res.json({ zones: LANDSLIDE_ZONES });
});

// ── GET /api/hazard/landslide ─────────────────────────────────────────────────
router.get("/landslide", async (req, res) => {
  try {
    const { lat = 14.5882, lon = 121.1763 } = req.query;

    const result = await fetchLandslideData(lat, lon);
    if (!result) return res.status(503).json({ error: "Rate limited by upstream API. Try again shortly." });
    const { data, stale: isStale } = result;

    const dailyDates = data.daily?.time                          ?? [];
    const precipSum  = data.daily?.precipitation_sum             ?? [];
    const precipProb = data.daily?.precipitation_probability_max ?? [];
    const soilTop    = data.hourly?.soil_moisture_0_to_7cm       ?? [];
    const soilDeep   = data.hourly?.soil_moisture_7_to_28cm      ?? [];

    const latestSoilTop   = soilTop.filter(Boolean).at(-1)  ?? 0;
    const latestSoilDeep  = soilDeep.filter(Boolean).at(-1) ?? 0;
    const avgSoilMoisture = (latestSoilTop + latestSoilDeep) / 2;

    const todayIdx   = 3; // past_days=3
    const rainfall24h = precipSum[todayIdx] ?? 0;
    const rainfall72h = (precipSum.slice(todayIdx - 2, todayIdx + 1) ?? [])
      .reduce((a, b) => a + (b ?? 0), 0);

    const zones = LANDSLIDE_ZONES.map((zone) => ({
      ...zone,
      riskAssessment: classifyLandslideRisk(rainfall24h, rainfall72h, avgSoilMoisture, zone.risk),
    }));

    const maxLevel   = Math.max(...zones.map((z) => z.riskAssessment.level));
    const overallRisk =
      zones.find((z) => z.riskAssessment.level === maxLevel)?.riskAssessment ??
      { label: "Low", level: 0, color: "#22c55e" };

    res.json({
      overallRisk,
      zones,
      current: {
        rainfall24h,
        rainfall72h,
        soilMoisture:  parseFloat(avgSoilMoisture.toFixed(4)),
        soilSaturated: avgSoilMoisture >= SOIL_SATURATION_THRESHOLD,
      },
      forecast: {
        dates:                       dailyDates.slice(todayIdx),
        precipitation_sum:           precipSum.slice(todayIdx),
        precipitation_probability_max: precipProb.slice(todayIdx),
      },
      thresholds:  LANDSLIDE_RAINFALL_THRESHOLDS,
      generatedAt: new Date().toISOString(),
      ...(isStale && { stale: true }),
    });
  } catch (err) {
    console.error("❌ Landslide API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
