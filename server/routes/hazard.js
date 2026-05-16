import express from "express";
import {
  getCached, getCachedStale, setCached, TTL,
  fetchRainfallHourly,
  classifyRainfallIntensity, findCurrentHourIndex,
} from "../services/openMeteoCache.js";

const router = express.Router();

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

        const updatedAt = xmlText(item, "gdacs:todate") ?? null;

        // rss_tc_7d.xml retains storms for 7 days after dissipation.
        // GDACS updates active storms every ~6 min — a todate older than
        // 12 h means the storm has ended or left PAR.
        if (updatedAt) {
          const ageMs = Date.now() - new Date(updatedAt).getTime();
          if (ageMs > 12 * 60 * 60 * 1000) return null;
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
          updatedAt,
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
    const stale = getCachedStale(CACHE_KEY);
    if (stale) return res.json({ ...stale, stale: true });
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
  if (windKph >= 87)  return { label: "Severe Tropical Storm (STS)",color: "#f97316", level: 3 };
  if (windKph >= 62)  return { label: "Tropical Storm (TS)",        color: "#f59e0b", level: 2 };
  return                     { label: "Tropical Depression (TD)",   color: "#3b82f6", level: 1 };
}

function estimateWindRadius(windKph) {
  if (windKph >= 220) return 150;
  if (windKph >= 185) return 130;
  if (windKph >= 118) return 100;
  if (windKph >= 87)  return  75;
  if (windKph >= 62)  return  55;
  return 40;
}


export default router;
