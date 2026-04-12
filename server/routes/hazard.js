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
// ── GET /api/hazard/typhoon ───────────────────────────────────────────────
// GDACS Tropical Cyclone API — Western Pacific active storms
router.get("/typhoon", async (req, res) => {
  try {
    // GDACS event list — TC = Tropical Cyclone, filtered to Western Pacific
    const url =
      "https://www.gdacs.org/gdacsapi/api/events/geteventlist/TC" +
      "?limit=5&alertlevel=Green,Orange,Red";

    const r = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!r.ok) throw new Error(`GDACS responded ${r.status}`);
    const data = await r.json();

    const events = data?.features ?? [];

    // Filter to Western Pacific / near Philippines only
    // PAR bounding box: roughly 115°E–135°E, 5°N–25°N
    const PH_PAR = {
      minLat: 3,
      maxLat: 30,
      minLon: 110,
      maxLon: 145,
    };

    const storms = events
      .filter((f) => {
        const [lon, lat] = f.geometry?.coordinates ?? [0, 0];
        return (
          lat >= PH_PAR.minLat &&
          lat <= PH_PAR.maxLat &&
          lon >= PH_PAR.minLon &&
          lon <= PH_PAR.maxLon
        );
      })
      .map((f) => {
        const props = f.properties ?? {};
        const [lon, lat] = f.geometry?.coordinates ?? [0, 0];

        // GDACS wind speed is in km/h
        const windKph = props.maxwind ?? 0;
        const windKnots = Math.round(windKph / 1.852);

        return {
          id: props.eventid ?? "unknown",
          name: props.eventname ?? "Unnamed Storm",
          lat,
          lon,
          alertLevel: props.alertlevel?.toLowerCase() ?? "green",
          windKph: Math.round(windKph),
          windKnots,
          category: classifyTyphoon(windKph),
          movement: props.movementspeed ?? null,
          direction: props.movementdir ?? null,
          updatedAt: props.todate ?? null,
          // Wind radius: use GDACS value when available (km), fall back to
          // statistical estimate only when GDACS returns null/0.
          // GDACS field is props.maxwindradius (km) — not always populated.
          windRadiusKm:
            props.maxwindradius && props.maxwindradius > 0
              ? Math.round(props.maxwindradius)
              : estimateWindRadius(windKph),
          windRadiusSource:
            props.maxwindradius && props.maxwindradius > 0
              ? "gdacs"
              : "estimated",
          // Forecast track — GDACS provides this in episodelist
          forecastTrack: props.forecasttrack ?? [],
        };
      });

    // Always respond — empty array means no active storms near PH
    res.json({
      storms,
      hasActiveStorm: storms.length > 0,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Typhoon API error:", err.message);
    // Return empty rather than error — offline cache will handle it
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
export default router;
