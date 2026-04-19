import express from "express";

const router = express.Router();

// ── PAGASA rainfall classification ────────────────────────────────────────
function classifyPAGASA(mmPerHour) {
  if (mmPerHour >= 60)
    return { label: "Torrential", level: 5, color: "#7c3aed" };
  if (mmPerHour >= 30) return { label: "Intense", level: 4, color: "#dc2626" };
  if (mmPerHour >= 15) return { label: "Heavy", level: 3, color: "#f97316" };
  if (mmPerHour >= 7.5)
    return { label: "Moderate", level: 2, color: "#f59e0b" };
  if (mmPerHour > 0) return { label: "Light", level: 1, color: "#3b82f6" };
  return { label: "None", level: 0, color: "#9ca3af" };
}

// ── Antipolo river monitoring points ─────────────────────────────────────
const MONITORING_POINTS = [
  {
    id: "marikina_river_antipolo",
    name: "Marikina River (Antipolo)",
    lat: 14.605,
    lon: 121.12,
  },
  {
    id: "manggahan_floodway",
    name: "Manggahan Floodway",
    lat: 14.582,
    lon: 121.1,
  },
  {
    id: "hinulugang_taktak",
    name: "Hinulugang Taktak River",
    lat: 14.59,
    lon: 121.175,
  },
];

// Danger thresholds in m³/s — based on PAGASA river capacity estimates
const THRESHOLDS = {
  marikina_river_antipolo: { warning: 300, critical: 600 },
  manggahan_floodway: { warning: 200, critical: 450 },
  hinulugang_taktak: { warning: 80, critical: 150 },
};

// ── Antipolo flood risk zones ─────────────────────────────────────────────
const ANTIPOLO_ZONES = [
  { lat: 14.5855, lng: 121.158, risk: 3, name: "Brgy. San Roque, Antipolo" },
  { lat: 14.591, lng: 121.163, risk: 3, name: "Brgy. Dela Paz, Antipolo" },
  { lat: 14.578, lng: 121.152, risk: 3, name: "Brgy. San Jose, Antipolo" },
  { lat: 14.572, lng: 121.148, risk: 2, name: "Brgy. Cupang, Antipolo" },
  { lat: 14.566, lng: 121.142, risk: 2, name: "Brgy. Mayamot, Antipolo" },
  { lat: 14.601, lng: 121.171, risk: 2, name: "Brgy. Mambugan, Antipolo" },
  { lat: 14.595, lng: 121.165, risk: 1, name: "Brgy. Inarawan, Antipolo" },
  { lat: 14.583, lng: 121.17, risk: 3, name: "Hinulugang Taktak Corridor" },
  { lat: 14.576, lng: 121.139, risk: 2, name: "Brgy. San Isidro, Antipolo" },
  { lat: 14.608, lng: 121.18, risk: 1, name: "Brgy. Dalig, Antipolo" },
];

// ── GET /api/hazard/flood-zones ───────────────────────────────────────────
router.get("/flood-zones", async (req, res) => {
  try {
    res.json({ zones: ANTIPOLO_ZONES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/flood ─────────────────────────────────────────────────
// Single point Open-Meteo flood API proxy
router.get("/flood", async (req, res) => {
  try {
    const { lat = 14.5882, lon = 121.1763 } = req.query;

    const url =
      `https://flood-api.open-meteo.com/v1/flood` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=river_discharge_max` +
      `&forecast_days=7` +
      `&models=seamless_v4`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Open-Meteo fetch failed");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Flood API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/flood-forecast ───────────────────────────────────────
// GloFAS river discharge + rainfall forecast combined
router.get("/flood-forecast", async (req, res) => {
  try {
    const alertPriority = { normal: 0, warning: 1, critical: 2 };

    // 1. Fetch river discharge for all monitoring points in parallel
    const dischargeResults = await Promise.all(
      MONITORING_POINTS.map(async (point) => {
        try {
          const url =
            `https://flood-api.open-meteo.com/v1/flood` +
            `?latitude=${point.lat}&longitude=${point.lon}` +
            `&daily=river_discharge,river_discharge_max,river_discharge_p75` +
            `&forecast_days=7` +
            `&models=seamless_v4`;

          const r = await fetch(url);
          if (!r.ok) throw new Error(`flood-api returned ${r.status}`);
          const data = await r.json();

          const threshold = THRESHOLDS[point.id];
          const today = data.daily?.river_discharge?.[0] ?? 0;
          const maxNext7 = Math.max(
            ...(data.daily?.river_discharge_max ?? [0]),
          );

          let alertLevel = "normal";
          if (today >= threshold.critical || maxNext7 >= threshold.critical) {
            alertLevel = "critical";
          } else if (
            today >= threshold.warning ||
            maxNext7 >= threshold.warning
          ) {
            alertLevel = "warning";
          }

          return {
            id: point.id,
            name: point.name,
            lat: point.lat,
            lon: point.lon,
            today,
            maxNext7,
            forecast: data.daily?.river_discharge ?? [],
            forecastMax: data.daily?.river_discharge_max ?? [],
            dates: data.daily?.time ?? [],
            threshold,
            alertLevel,
          };
        } catch {
          return {
            id: point.id,
            name: point.name,
            lat: point.lat,
            lon: point.lon,
            today: 0,
            maxNext7: 0,
            forecast: [],
            forecastMax: [],
            dates: [],
            threshold: THRESHOLDS[point.id],
            alertLevel: "normal",
          };
        }
      }),
    );

    // 2. Fetch rainfall forecast for Antipolo City center
    const rainfallUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=14.5882&longitude=121.1763` +
      `&daily=precipitation_sum,precipitation_probability_max` +
      `&forecast_days=7` +
      `&timezone=Asia%2FManila`;

    const rainfallRes = await fetch(rainfallUrl);
    if (!rainfallRes.ok)
      throw new Error(`Open-Meteo rainfall returned ${rainfallRes.status}`);
    const rainfallData = await rainfallRes.json();

    // 3. Overall alert = highest level across all rivers
    const overallAlert = dischargeResults.reduce(
      (worst, r) =>
        alertPriority[r.alertLevel] > alertPriority[worst]
          ? r.alertLevel
          : worst,
      "normal",
    );

    res.json({
      rivers: dischargeResults,
      rainfall: {
        dates: rainfallData.daily?.time ?? [],
        precipitation_sum: rainfallData.daily?.precipitation_sum ?? [],
        probability_max:
          rainfallData.daily?.precipitation_probability_max ?? [],
      },
      overallAlert,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Flood forecast error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/rainfall-hourly ──────────────────────────────────────
// 12-hour hourly rainfall with PAGASA classification — Antipolo
router.get("/rainfall-hourly", async (req, res) => {
  try {
    // Allow override via query params, default to Antipolo City center
    const { lat = 14.5882, lon = 121.1763 } = req.query;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=precipitation,precipitation_probability,weathercode` +
      `&forecast_days=2` +
      `&timezone=Asia%2FManila`;

    const r = await fetch(url);
    if (!r.ok) throw new Error("Open-Meteo weather fetch failed");
    const data = await r.json();

    // Get current hour in Manila time
    const nowManila = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
    );
    const currentHour = nowManila.getHours();

    const times = data.hourly?.time ?? [];
    const precip = data.hourly?.precipitation ?? [];
    const prob = data.hourly?.precipitation_probability ?? [];
    const codes = data.hourly?.weathercode ?? [];

    // Find the index for the current hour today
    const todayStr = nowManila.toISOString().slice(0, 10);
    const startIdx = times.findIndex(
      (t) =>
        t.startsWith(todayStr) && parseInt(t.slice(11, 13)) === currentHour,
    );

    // Fallback if index not found — use 0
    const safeStart = startIdx >= 0 ? startIdx : 0;

    // Build 12-hour array
    const hours = Array.from({ length: 12 }, (_, i) => {
      const idx = safeStart + i;
      const time = times[idx] ?? "";
      const hour = time ? parseInt(time.slice(11, 13)) : (currentHour + i) % 24;
      const mm = precip[idx] ?? 0;

      return {
        time,
        hour,
        precipitation: mm,
        probability: prob[idx] ?? 0,
        weathercode: codes[idx] ?? 0,
        pagasa: classifyPAGASA(mm),
      };
    });

    // Overall status = highest PAGASA level in next 12 hours
    const maxLevel = Math.max(...hours.map((h) => h.pagasa.level));
    const overallPagasa =
      hours.find((h) => h.pagasa.level === maxLevel)?.pagasa ??
      classifyPAGASA(0);

    res.json({
      hours,
      overallPagasa,
      currentHour,
      location: { lat: parseFloat(lat), lon: parseFloat(lon) },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Rainfall hourly error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/flood-combined ───────────────────────────────────────
// Combined static zones + live discharge for heatmap (if needed later)
router.get("/flood-combined", async (req, res) => {
  try {
    const highRisk = ANTIPOLO_ZONES.filter((z) => z.risk === 3).slice(0, 5);

    const enriched = await Promise.all(
      highRisk.map(async (zone) => {
        try {
          const url =
            `https://flood-api.open-meteo.com/v1/flood` +
            `?latitude=${zone.lat}&longitude=${zone.lng}` +
            `&daily=river_discharge_max&forecast_days=7&models=seamless_v4`;
          const r = await fetch(url);
          const data = await r.json();
          const vals = data?.daily?.river_discharge_max ?? [];
          return { ...zone, discharge: Math.max(...vals.filter(Boolean)) };
        } catch {
          return { ...zone, discharge: null };
        }
      }),
    );

    const enrichedNames = new Set(enriched.map((z) => z.name));
    const merged = [
      ...enriched,
      ...ANTIPOLO_ZONES.filter((z) => !enrichedNames.has(z.name)),
    ];

    res.json({ zones: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ── Helpers: parse GDACS RSS XML without external deps ───────────────────
// The GDACS GeoJSON API (geteventlist + geteventdata) consistently returns
// maxwind=0/null even for Cat-5 storms — a known upstream data quality issue.
// The RSS feed (/xml/rss_tc_7d.xml) is updated every 6 minutes and reliably
// carries wind speed in gdacs:severity[value] (knots) + gdacs:severity[unit].

function xmlText(xml, tag) {
  // Extract inner text of first matching tag (handles namespaced tags)
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function xmlAttr(xml, tag, attr) {
  // Extract attribute value from first matching opening tag
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseRssItems(xml) {
  // Split into <item>...</item> blocks
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) items.push(m[1]);
  return items;
}

// ── GET /api/hazard/typhoon ───────────────────────────────────────────────
// Primary source: GDACS RSS feed (reliable wind speed via gdacs:severity)
// Updated every 6 minutes. Falls back to GeoJSON API if RSS is unavailable.
router.get("/typhoon", async (req, res) => {
  try {
    // PAR bounding box — Western Pacific / near Philippines
    const PH_PAR = { minLat: 3, maxLat: 30, minLon: 110, maxLon: 145 };

    // ── Step 1: Fetch GDACS RSS TC feed (most reliable wind data source) ──
    const rssUrl = "https://www.gdacs.org/xml/rss_tc_7d.xml";
    const rssRes = await fetch(rssUrl, {
      headers: { Accept: "application/xml, text/xml" },
    });
    if (!rssRes.ok) throw new Error(`GDACS RSS responded ${rssRes.status}`);
    const rssXml = await rssRes.text();

    const items = parseRssItems(rssXml);

    const storms = items
      .map((item) => {
        // Only TC events
        const eventType = xmlText(item, "gdacs:eventtype");
        if (eventType !== "TC") return null;

        // Position from georss:point ("lat lon") or geo:lat / geo:long
        let lat = 0,
          lon = 0;
        const georssPoint = xmlText(item, "georss:point");
        if (georssPoint) {
          const parts = georssPoint.split(/\s+/);
          lat = parseFloat(parts[0]);
          lon = parseFloat(parts[1]);
        } else {
          lat = parseFloat(xmlText(item, "geo:lat") ?? "0");
          lon = parseFloat(xmlText(item, "geo:long") ?? "0");
        }

        // Filter to Western Pacific / PAR region
        if (
          lat < PH_PAR.minLat ||
          lat > PH_PAR.maxLat ||
          lon < PH_PAR.minLon ||
          lon > PH_PAR.maxLon
        )
          return null;

        // Wind speed: gdacs:severity value attribute is in knots
        // e.g. <gdacs:severity value="100" unit="kn">Wind speed: 185 km/h</gdacs:severity>
        const severityValueRaw = xmlAttr(item, "gdacs:severity", "value");
        const severityUnit = xmlAttr(item, "gdacs:severity", "unit") ?? "kn";
        let windKph = 0;
        if (severityValueRaw) {
          const severityNum = parseFloat(severityValueRaw);
          if (!isNaN(severityNum) && severityNum > 0) {
            // Convert knots → km/h if unit is knots; already km/h if unit is "km/h"
            windKph =
              severityUnit === "km/h"
                ? severityNum
                : Math.round(severityNum * 1.852);
          }
        }
        // Fallback: try to parse km/h from the severity text itself
        // e.g. "Wind speed: 185 km/h"
        if (windKph === 0) {
          const severityText = xmlText(item, "gdacs:severity") ?? "";
          const kmhMatch = severityText.match(/([\d.]+)\s*km\/h/i);
          if (kmhMatch) windKph = Math.round(parseFloat(kmhMatch[1]));
        }

        const windKnots = Math.round(windKph / 1.852);

        // Wind radius — gdacs:severity doesn't carry this; use estimate
        const windRadiusKm = estimateWindRadius(windKph);

        const alertLevel = (
          xmlText(item, "gdacs:alertlevel") ?? "green"
        ).toLowerCase();
        const eventId = xmlText(item, "gdacs:eventid") ?? "unknown";
        const eventName = xmlText(item, "gdacs:eventname") ?? "Unnamed Storm";
        const toDate = xmlText(item, "gdacs:todate") ?? null;

        return {
          id: eventId,
          name: eventName,
          lat,
          lon,
          alertLevel,
          windKph: Math.round(windKph),
          windKnots,
          category: classifyTyphoon(windKph),
          movement: null, // RSS doesn't carry movement speed
          direction: null,
          updatedAt: toDate,
          windRadiusKm,
          windRadiusSource: "estimated",
          forecastTrack: [],
        };
      })
      .filter(Boolean);

    // Always respond — empty array means no active storms near PH
    res.json({
      storms,
      hasActiveStorm: storms.length > 0,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Typhoon API error:", err.message);
    // Return empty rather than hard error — frontend offline cache will handle it
    res.json({
      storms: [],
      hasActiveStorm: false,
      fetchedAt: new Date().toISOString(),
      error: err.message,
    });
  }
});

// PAGASA typhoon classification by 10-minute sustained wind in km/h
function classifyTyphoon(windKph) {
  if (windKph >= 220)
    return { label: "Super Typhoon", color: "#7c3aed", level: 5 };
  if (windKph >= 185)
    return { label: "Typhoon (TY)", color: "#dc2626", level: 4 };
  if (windKph >= 118)
    return { label: "Typhoon (TY)", color: "#ef4444", level: 4 };
  if (windKph >= 89)
    return { label: "Severe Tropical Storm", color: "#f97316", level: 3 };
  if (windKph >= 62)
    return { label: "Tropical Storm", color: "#f59e0b", level: 2 };
  if (windKph >= 35)
    return { label: "Tropical Depression", color: "#3b82f6", level: 1 };
  return { label: "Tropical Disturbance", color: "#9ca3af", level: 0 };
}

// Estimate wind radius from wind speed — rough approximation
// Average Western Pacific typhoon wind radii from JTWC historical data
function estimateWindRadius(windKph) {
  if (windKph >= 220) return 150;
  if (windKph >= 185) return 130;
  if (windKph >= 118) return 100;
  if (windKph >= 89) return 75;
  if (windKph >= 62) return 55;
  return 40;
}

// ── Antipolo landslide susceptibility zones ───────────────────────────────
// Based on MGB (Mines and Geosciences Bureau) high/moderate susceptibility
// areas in Antipolo City, Rizal. Risk: 3 = High, 2 = Moderate, 1 = Low.
const LANDSLIDE_ZONES = [
  { lat: 14.622, lng: 121.198, risk: 3, name: "Brgy. Dalig (upper slope)" },
  { lat: 14.631, lng: 121.205, risk: 3, name: "Brgy. Calawis, Antipolo" },
  { lat: 14.615, lng: 121.187, risk: 3, name: "Brgy. San Jose (hillside)" },
  { lat: 14.607, lng: 121.182, risk: 3, name: "Brgy. Mambugan (ridge)" },
  { lat: 14.598, lng: 121.175, risk: 2, name: "Brgy. Inarawan (slope)" },
  { lat: 14.591, lng: 121.168, risk: 2, name: "Brgy. Dela Paz (hillside)" },
  { lat: 14.583, lng: 121.172, risk: 3, name: "Hinulugang Taktak escarpment" },
  { lat: 14.576, lng: 121.162, risk: 2, name: "Brgy. San Roque (mid-slope)" },
  { lat: 14.568, lng: 121.155, risk: 2, name: "Brgy. Cupang (elevated)" },
  { lat: 14.639, lng: 121.212, risk: 3, name: "Brgy. Binubusan ridge" },
];

// Rainfall thresholds (mm/day) for landslide trigger — based on
// PHIVOLCS/MGB rainfall-induced landslide warning thresholds for Rizal
const LANDSLIDE_RAINFALL_THRESHOLDS = {
  low: { day1: 50, day3: 100 }, // Low susceptibility zones
  moderate: { day1: 35, day3: 70 }, // Moderate susceptibility zones
  high: { day1: 20, day3: 50 }, // High susceptibility zones (most sensitive)
};

// Soil moisture saturation threshold (m³/m³) — above this, slope stability drops sharply
const SOIL_SATURATION_THRESHOLD = 0.35;

// ── Rule-based landslide risk classifier ─────────────────────────────────
function classifyLandslideRisk(
  rainfall24h,
  rainfall72h,
  soilMoisture,
  slopeRisk,
) {
  const threshold =
    slopeRisk === 3
      ? LANDSLIDE_RAINFALL_THRESHOLDS.high
      : slopeRisk === 2
        ? LANDSLIDE_RAINFALL_THRESHOLDS.moderate
        : LANDSLIDE_RAINFALL_THRESHOLDS.low;

  const soilSaturated = soilMoisture >= SOIL_SATURATION_THRESHOLD;
  const rainfallTrigger =
    rainfall24h >= threshold.day1 || rainfall72h >= threshold.day3;

  // Critical: both rainfall threshold AND soil saturation exceeded on high-risk slope
  if (slopeRisk === 3 && rainfallTrigger && soilSaturated) {
    return { label: "Critical", level: 3, color: "#dc2626" };
  }
  // Warning: rainfall threshold exceeded OR soil saturated on moderate/high slope
  if (slopeRisk >= 2 && (rainfallTrigger || soilSaturated)) {
    return { label: "Warning", level: 2, color: "#f97316" };
  }
  // Watch: some rainfall on any susceptible slope
  if (slopeRisk >= 1 && rainfall24h >= threshold.day1 * 0.5) {
    return { label: "Watch", level: 1, color: "#f59e0b" };
  }
  return { label: "Low", level: 0, color: "#22c55e" };
}

// ── GET /api/hazard/landslide-zones ──────────────────────────────────────
router.get("/landslide-zones", async (req, res) => {
  try {
    res.json({ zones: LANDSLIDE_ZONES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hazard/landslide ─────────────────────────────────────────────
// Real-time landslide risk using Open-Meteo rainfall + soil moisture
// Combined with static MGB susceptibility zones — rule-based, no ML needed
router.get("/landslide", async (req, res) => {
  try {
    const { lat = 14.5882, lon = 121.1763 } = req.query;

    // Fetch rainfall (past 3 days + 7-day forecast) and soil moisture
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=precipitation_sum,precipitation_probability_max` +
      `&hourly=soil_moisture_0_to_7cm,soil_moisture_7_to_28cm` +
      `&past_days=3` +
      `&forecast_days=7` +
      `&timezone=Asia%2FManila`;

    const r = await fetch(url);
    if (!r.ok) throw new Error("Open-Meteo fetch failed");
    const data = await r.json();

    const dailyDates = data.daily?.time ?? [];
    const precipSum = data.daily?.precipitation_sum ?? [];
    const precipProb = data.daily?.precipitation_probability_max ?? [];
    const soilTop = data.hourly?.soil_moisture_0_to_7cm ?? [];
    const soilDeep = data.hourly?.soil_moisture_7_to_28cm ?? [];

    // Latest soil moisture = most recent hourly value available
    const latestSoilTop = soilTop.filter(Boolean).at(-1) ?? 0;
    const latestSoilDeep = soilDeep.filter(Boolean).at(-1) ?? 0;
    const avgSoilMoisture = (latestSoilTop + latestSoilDeep) / 2;

    // past_days=3 means index 0,1,2 are past; index 3 = today
    const todayIdx = 3;
    const rainfall24h = precipSum[todayIdx] ?? 0;
    const rainfall72h = (
      precipSum.slice(todayIdx - 2, todayIdx + 1) ?? []
    ).reduce((a, b) => a + (b ?? 0), 0);

    // 7-day forecast slice (after today)
    const forecastDates = dailyDates.slice(todayIdx);
    const forecastPrecip = precipSum.slice(todayIdx);
    const forecastProb = precipProb.slice(todayIdx);

    // Assess risk for each zone
    const zones = LANDSLIDE_ZONES.map((zone) => {
      const risk = classifyLandslideRisk(
        rainfall24h,
        rainfall72h,
        avgSoilMoisture,
        zone.risk,
      );
      return { ...zone, riskAssessment: risk };
    });

    // Overall alert = highest risk level across all zones
    const maxLevel = Math.max(...zones.map((z) => z.riskAssessment.level));
    const overallRisk = zones.find((z) => z.riskAssessment.level === maxLevel)
      ?.riskAssessment ?? { label: "Low", level: 0, color: "#22c55e" };

    res.json({
      overallRisk,
      zones,
      current: {
        rainfall24h,
        rainfall72h,
        soilMoisture: parseFloat(avgSoilMoisture.toFixed(4)),
        soilSaturated: avgSoilMoisture >= SOIL_SATURATION_THRESHOLD,
      },
      forecast: {
        dates: forecastDates,
        precipitation_sum: forecastPrecip,
        precipitation_probability_max: forecastProb,
      },
      thresholds: LANDSLIDE_RAINFALL_THRESHOLDS,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Landslide API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
