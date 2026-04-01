import express from "express";

const router = express.Router();

// Flood prediction — combines GloFAS river discharge + rainfall forecast
router.get("/flood-forecast", async (req, res) => {
  try {
    // Key monitoring points for Navotas/Metro Manila rivers
    const MONITORING_POINTS = [
      {
        id: "navotas_river",
        name: "Navotas River",
        lat: 14.6698,
        lon: 120.9387,
      },
      {
        id: "malabon_river",
        name: "Malabon River",
        lat: 14.668,
        lon: 120.9571,
      },
      {
        id: "polo_river",
        name: "Polo River, Valenzuela",
        lat: 14.7,
        lon: 120.983,
      },
    ];

    // Known danger thresholds (m³/s) — based on PAGASA river capacity data
    // These are conservative estimates for urban Metro Manila rivers
    const THRESHOLDS = {
      navotas_river: { warning: 45, critical: 80 },
      malabon_river: { warning: 60, critical: 100 },
      polo_river: { warning: 120, critical: 200 },
    };

    // Fetch river discharge forecast for all monitoring points in parallel
    const dischargeResults = await Promise.all(
      MONITORING_POINTS.map(async (point) => {
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
        const maxNext7 = Math.max(...(data.daily?.river_discharge_max ?? [0]));

        // Determine alert level
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
      }),
    );

    // Fetch rainfall forecast for Navotas center
    const rainfallUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=14.664&longitude=120.9422` +
      `&daily=precipitation_sum,precipitation_probability_max` +
      `&forecast_days=7` +
      `&timezone=Asia%2FManila`;

    const rainfallRes = await fetch(rainfallUrl);
    const rainfallData = await rainfallRes.json();

    // Overall alert = highest level across all rivers
    const alertPriority = { normal: 0, warning: 1, critical: 2 };
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
export default router;
