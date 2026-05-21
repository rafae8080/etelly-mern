/**
 * Earthquake alerts via USGS FDSN Event Service.
 *
 * Parameters: M4.5+ within 500 km of Antipolo, past 24 hours.
 * Severity (PHIVOLCS PEIS aligned):
 *   M7.0+ → evacuate | M6.0+ → critical | M5.0+ → warning | M4.5+ → watch
 * Expiry: 24 hours (PHIVOLCS aftershock monitoring window).
 */

import Alert from "../models/Alert.js";
import { CITY } from "../config/alertConfig.js";
import { haversineKm } from "./alertHelpers.js";

const USGS_EQ_URL       = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const EQ_SEARCH_RADIUS_KM = 500;

export async function runEarthquakeCheck() {
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
      const mag    = props.mag ?? 0;
      const place  = props.place ?? "Near Philippines";
      const time   = new Date(props.time);
      const usgsId = feature.id;

      let severity;
      if (mag >= 7.0)      severity = "evacuate";
      else if (mag >= 6.0) severity = "critical";
      else if (mag >= 5.0) severity = "warning";
      else                 severity = "watch";

      const distKm = haversineKm(CITY.lat, CITY.lon, lat, lon);
      const rawKey = `usgs_eq_${usgsId}`;

      const existing = await Alert.findOne({ rawKey });
      if (existing) continue;

      const title = `M${mag.toFixed(1)} Earthquake — ${place}`;
      const description =
        `Magnitude ${mag.toFixed(1)} earthquake detected ${distKm.toFixed(0)} km ` +
        `from ${CITY.name}. Depth: ${depthKm?.toFixed(1) ?? "unknown"} km. ` +
        `Time: ${time.toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT.` +
        `${mag >= 5.5 ? " Drop, cover, and hold on. Check for structural damage after shaking stops." : ""}`;

      await Alert.create({
        source: "USGS",
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
