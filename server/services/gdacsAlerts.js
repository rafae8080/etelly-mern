/**
 * GDACS multi-hazard check — Flood (FL) and Volcano (VO) RSS feeds.
 *
 * Feeds (free, no auth):
 *   FL — https://www.gdacs.org/xml/rss_fl_7d.xml  (past 7 days)
 *   VO — https://www.gdacs.org/xml/rss_vo_7d.xml  (past 7 days)
 *
 * Severity: red + dist < 150 km → evacuate | red → critical | orange → warning | green → watch
 * Expiry: 24 hours — full CDRRMO monitoring window for GDACS-reported events.
 */

import Alert from "../models/Alert.js";
import { CITY } from "../config/alertConfig.js";
import { haversineKm } from "./alertHelpers.js";

const GDACS_FEEDS = {
  flood:   "https://www.gdacs.org/xml/rss_fl_7d.xml",
  volcano: "https://www.gdacs.org/xml/rss_vo_7d.xml",
};

const GDACS_RADIUS_KM = 800;

function parseGDACSFeed(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1").trim() : null;
    };
    const lat = parseFloat(get("geo:lat")  ?? get("georss:point")?.split(" ")[0]);
    const lon = parseFloat(get("geo:long") ?? get("georss:point")?.split(" ")[1]);

    items.push({
      title:        get("title"),
      description:  get("description"),
      pubDate:      get("pubDate"),
      eventType:    get("gdacs:eventtype"),
      eventId:      get("gdacs:eventid"),
      alertLevel:   get("gdacs:alertlevel"),
      severityText: get("gdacs:severity"),
      country:      get("gdacs:country"),
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
    });
  }

  return items;
}

function buildGDACSAlert(item, distKm) {
  const level = (item.alertLevel ?? "green").toLowerCase();
  const proximityNote = distKm < Infinity ? ` — ${distKm.toFixed(0)} km from ${CITY.name}` : "";

  let severity = "watch";
  if (level === "red") {
    severity = distKm < 150 ? "evacuate" : "critical";
  } else if (level === "orange") {
    severity = "warning";
  }

  const typeLabel = { FL: "Flood", EQ: "Earthquake", VO: "Volcanic Activity", TC: "Tropical Cyclone" }[item.eventType ?? ""] ?? "Hazard";
  const title = `GDACS ${level.toUpperCase()} — ${typeLabel} in ${item.country?.split(";")[0].trim() ?? "Philippines Region"}${proximityNote}`;

  const rawDesc = (item.description ?? item.title ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const severityNote = item.severityText ? ` Severity: ${item.severityText}.` : "";
  const description  = (rawDesc.length > 10 ? rawDesc.slice(0, 380) : title) + severityNote;

  return { severity, title, description };
}

export async function runGDACSCheck() {
  let totalSaved = 0;

  for (const [hazardType, feedUrl] of Object.entries(GDACS_FEEDS)) {
    try {
      const res = await fetch(feedUrl, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`GDACS ${hazardType} feed returned ${res.status}`);
      const xml = await res.text();

      const items = parseGDACSFeed(xml);
      let saved = 0;

      for (const item of items) {
        const inPhilippines = /philippines/i.test(item.country ?? "");
        const distKm = item.lat != null && item.lon != null
          ? haversineKm(CITY.lat, CITY.lon, item.lat, item.lon)
          : Infinity;

        if (!inPhilippines && distKm > GDACS_RADIUS_KM) continue;

        const rawKey  = `gdacs_${item.eventType}_${item.eventId}`;
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

      console.log(`[AlertEngine] GDACS ${hazardType} — ${items.length} item(s) fetched, ${saved} saved`);
    } catch (err) {
      console.error(`[AlertEngine] GDACS ${hazardType} check failed:`, err.message);
    }
  }

  console.log(`[AlertEngine] GDACS — ${totalSaved} new alert(s) total`);
}
