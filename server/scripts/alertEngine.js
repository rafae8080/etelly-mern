/**
 * scripts/alertEngine.js
 *
 * Runs as a cron job every 15 minutes (agency feeds every 30 min).
 *
 * Alert sources:
 *  1. System — flood evacuation score (Open-Meteo rainfall + elevation + soil)
 *  2. System — river discharge thresholds (GloFAS via your existing API)
 *  3. PAGASA — RSS weather bulletins (keyword parsed)
 *  4. PHIVOLCS — RSS seismicity feed (keyword parsed)
 *  5. NDRRMC — scraped situation reports (keyword parsed)
 *
 * Install dependencies (if not already installed):
 *   npm install node-cron node-fetch cheerio
 */

import cron from "node-cron";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Alert from "../models/Alert.js";

// ─── City config ──────────────────────────────────────────────────────────────

const CITY = { lat: 14.5882, lon: 121.1763, name: "Antipolo City, Rizal" };

// ─── Barangay elevation table (metres ASL) ────────────────────────────────────
// Source: Phil-LiDAR / LIPAD DEM data for Antipolo City barangays.
// Barangays below LOW_ELEV_M are classified as flood-prone low-lying zones.
// Add or adjust values using your actual LIPAD WMS query results.

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

// ─── Agency feed URLs ─────────────────────────────────────────────────────────

// PAGASA: no working public RSS feed exists as of 2026 — scrape their daily
//         public weather forecast text file from pubfiles (plain text, always live)
// PHIVOLCS: official seismicity RSS (malformed headers handled by raw TLS fetcher below)
// NDRRMC: scrape their situation reports listing page instead of a static article
const PAGASA_FORECAST_URL =
  "https://pubfiles.pagasa.dost.gov.ph/tamss/weather/pf.txt";
const PAGASA_ADVISORY_URL =
  "https://pubfiles.pagasa.dost.gov.ph/tamss/weather/wad.txt";
const PHIVOLCS_RSS_URL =
  "https://www.phivolcs.dost.gov.ph/index.php?option=com_rssfeed&view=rssfeed&type=seismicity&Itemid=8";
const NDRRMC_SCRAPE_URL = "https://ndrrmc.gov.ph/index.php/alerts-warnings";

// ─── 1. Flood Evacuation Scoring ──────────────────────────────────────────────
//
// PAGASA-aligned 3-factor scoring model:
//
//  F1 — Consecutive heavy rainfall hours
//       >= 3 consecutive hours of Heavy rainfall (>= 15mm/hr) -> F1 triggered
//       Matches PAGASA's operational flood warning criteria.
//
//  F2 — Barangay elevation (Phil-LiDAR)
//       Elevation < 15m ASL -> flood-prone low-lying zone
//
//  F3 — Soil saturation proxy (Open-Meteo)
//       Prior 24hr rainfall > 20mm OR soil moisture > 40%
//       Saturated soil means rain causes surface flooding faster.
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

    // Peak mm/hr and total accumulation for description text
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
            `${river.name} is at ${q.toFixed(1)} m\u00b3/s, exceeding the critical ` +
            `threshold of ${t.critical} m\u00b3/s. Flooding of adjacent low-lying ` +
            `barangays is imminent. 7-day peak forecast: ` +
            `${river.maxNext7?.toFixed(1) ?? "—"} m\u00b3/s. Source: GloFAS v4.`,
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
            `${river.name} is at ${q.toFixed(1)} m\u00b3/s, above the warning ` +
            `threshold of ${t.warning} m\u00b3/s. Water levels may continue to rise. ` +
            `7-day peak forecast: ${river.maxNext7?.toFixed(1) ?? "—"} m\u00b3/s. ` +
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

// ─── 3. Agency Feed Parsing — keyword-based, no AI ───────────────────────────
//
// Uses standardised PAGASA / PHIVOLCS / NDRRMC terminology.
// References:
//   PAGASA Rainfall Advisory: pagasa.dost.gov.ph/information/rainfall-advisory
//   PAGASA Flood Advisory:    pagasa.dost.gov.ph/flood/flood-advisory
//   PHIVOLCS EQ scale:        phivolcs.dost.gov.ph (PEIS)

async function runAgencyFeedCheck() {
  const feeds = [
    { source: "PAGASA", fetch: fetchPAGASARSS },
    { source: "PHIVOLCS", fetch: fetchPHIVOLCSRSS },
    { source: "NDRRMC", fetch: fetchNDRRMCScrape },
  ];

  for (const feed of feeds) {
    try {
      const bulletins = await feed.fetch();

      // Debug: log raw item count so we can tell fetch vs filter failures apart
      console.log(
        `[AlertEngine] ${feed.source} — fetched ${bulletins.length} raw item(s)`,
      );
      if (bulletins.length > 0) {
        console.log(
          `[AlertEngine] ${feed.source} sample:`,
          bulletins[0].slice(0, 120),
        );
      }

      let saved = 0;
      for (const raw of bulletins) {
        // PHIVOLCS bulletins cover all of Luzon — don't filter by area keyword
        // since a strong quake anywhere nearby is relevant to Antipolo.
        if (feed.source !== "PHIVOLCS" && !isRelevantToArea(raw)) continue;

        const parsed = parseBulletinByKeyword(feed.source, raw);
        if (!parsed) continue;

        const rawKey = raw.slice(0, 120).replace(/\s+/g, " ").trim();

        await Alert.findOneAndUpdate(
          { rawKey, isActive: true },
          {
            $set: {
              source: feed.source,
              type: parsed.type,
              severity: parsed.severity,
              title: parsed.title,
              description: parsed.description,
              location: CITY.name,
              barangays: [],
              raw,
              rawKey,
              updatedAt: new Date(),
              expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
            },
            $setOnInsert: { createdAt: new Date(), isActive: true },
          },
          { upsert: true, new: true },
        );
        saved++;
      }

      console.log(
        `[AlertEngine] ${feed.source} — ${saved}/${bulletins.length} item(s) saved`,
      );
    } catch (err) {
      console.error(
        `[AlertEngine] ${feed.source} failed:`,
        err.message,
        err.cause ?? "",
      );
    }
  }
}

// ── Keyword bulletin parser ───────────────────────────────────────────────────

function parseBulletinByKeyword(source, rawText) {
  if (!rawText?.trim()) return null;
  const t = rawText.toLowerCase();

  // Determine TYPE
  let type = "other";
  if (t.includes("flood") || t.includes("baha")) type = "flood";
  else if (t.includes("rainfall") || t.includes("ulan") || t.includes("rain"))
    type = "rainfall";
  else if (
    t.includes("quake") ||
    t.includes("earthquake") ||
    t.includes("lindol") ||
    t.includes("seismic")
  )
    type = "earthquake";
  else if (
    t.includes("lahar") ||
    t.includes("volcanic") ||
    t.includes("bulkan")
  )
    type = "lahar";
  else if (
    t.includes("typhoon") ||
    t.includes("tropical") ||
    t.includes("bagyo")
  )
    type = "typhoon";

  // Determine SEVERITY using PAGASA / PHIVOLCS standard terms
  let severity = "watch";

  if (
    t.includes("evacuate") ||
    t.includes("evacuation") ||
    t.includes("likas") ||
    t.includes("red rainfall") ||
    t.includes("extreme rainfall") ||
    t.includes("torrential") ||
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
    t.includes("magnitude 7") ||
    t.includes("magnitude 8")
  ) {
    severity = "critical";
  } else if (
    t.includes("warning") ||
    t.includes("babala") ||
    t.includes("orange rainfall") ||
    t.includes("heavy rainfall") ||
    t.includes("moderate to heavy") ||
    t.includes("signal no. 2") ||
    t.includes("signal #2") ||
    t.includes("magnitude 5")
  ) {
    severity = "warning";
  } else if (
    t.includes("watch") ||
    t.includes("yellow rainfall") ||
    t.includes("moderate rainfall") ||
    t.includes("signal no. 1") ||
    t.includes("signal #1") ||
    t.includes("low pressure") ||
    t.includes("magnitude 4")
  ) {
    severity = "watch";
  } else if (type === "other") {
    return null; // skip non-hazard bulletins (press releases, etc.)
  }

  // Title from first line, capped at 80 chars
  const firstLine = rawText.split("\n")[0].trim().slice(0, 80);
  const title = firstLine || `${source} ${type} advisory`;

  // Description from first 2 meaningful sentences
  const sentences = rawText
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const description =
    sentences.slice(0, 2).join(" ").slice(0, 300) || rawText.slice(0, 300);

  return { type, severity, title, description };
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchPAGASARSS() {
  // PAGASA no longer maintains a public RSS feed. Instead we fetch their
  // plain-text daily public forecast and weather advisory files which are
  // updated multiple times a day at pubfiles.pagasa.dost.gov.ph.
  const items = [];

  for (const url of [PAGASA_FORECAST_URL, PAGASA_ADVISORY_URL]) {
    try {
      const res = await fetch(url, { timeout: 10000 });
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.trim().length > 50) items.push(text.trim());
    } catch {
      // skip individual file failures
    }
  }

  return items;
}

async function fetchPHIVOLCSRSS() {
  // PHIVOLCS's server sends HTTP response headers with bare \n line endings
  // instead of the required \r\n. Every Node.js HTTP parser rejects this.
  // Solution: bypass all HTTP parsers — open a raw TLS socket, collect the
  // bytes ourselves, fix the line endings, then extract the body manually.
  const { connect } = await import("tls");

  const raw = await new Promise((resolve, reject) => {
    const url = new URL(PHIVOLCS_RSS_URL);
    const socket = connect(
      { host: url.hostname, port: 443, rejectUnauthorized: false },
      () => {
        socket.write(
          `GET ${url.pathname}${url.search} HTTP/1.1\r\n` +
            `Host: ${url.hostname}\r\n` +
            `Connection: close\r\n` +
            `User-Agent: AntipoloDRRS/1.0\r\n` +
            `\r\n`,
        );
      },
    );
    const chunks = [];
    socket.on("data", (c) => chunks.push(c));
    socket.on("end", () => resolve(Buffer.concat(chunks)));
    socket.setTimeout(10000, () =>
      socket.destroy(new Error("PHIVOLCS timed out")),
    );
    socket.on("error", reject);
  });

  // Work in latin-1 so every byte maps 1-to-1 to a char
  const text = raw.toString("binary");

  // Locate header/body boundary (tolerates both \r\n\r\n and \n\n)
  const boundaryMatch = text.match(/\r?\n\r?\n/);
  if (!boundaryMatch) throw new Error("PHIVOLCS: no header boundary");
  const boundaryIdx = text.indexOf(boundaryMatch[0]);
  const headerRaw = text.slice(0, boundaryIdx);
  let body = text.slice(boundaryIdx + boundaryMatch[0].length);

  // Unchunk if Transfer-Encoding: chunked
  if (/transfer-encoding:\s*chunked/i.test(headerRaw)) {
    const parts = [];
    let pos = 0;
    while (pos < body.length) {
      const nl = body.indexOf("\r\n", pos);
      if (nl === -1) break;
      const size = parseInt(body.slice(pos, nl), 16);
      if (!size || isNaN(size)) break;
      parts.push(body.slice(nl + 2, nl + 2 + size));
      pos = nl + 2 + size + 2;
    }
    body = parts.join("");
  }

  // Re-encode as UTF-8 for XML parsing
  const xml = Buffer.from(body, "binary").toString("utf8");

  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $("item").each((_, el) => {
    const title = $(el).find("title").text().trim();
    const desc = $(el).find("description").text().trim();
    if (title || desc) items.push(`${title}\n${desc}`);
  });
  return items.slice(0, 5);
}

async function fetchNDRRMCScrape() {
  const res = await fetch(NDRRMC_SCRAPE_URL, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AntipoloDRRS/1.0)" },
  });
  if (!res.ok) throw new Error(`NDRRMC returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  // Try multiple selectors — NDRRMC has redesigned their site a few times
  $(
    [
      ".items-row .item",
      "table.category tr",
      ".catItemTitle a",
      "h2 a, h3 a",
    ].join(", "),
  ).each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) items.push(text);
  });

  // Fallback: grab all links whose text looks like a situation report
  if (items.length === 0) {
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      if (
        text.length > 20 &&
        /situation|advisory|alert|warning|bulletin/i.test(text)
      ) {
        items.push(text);
      }
    });
  }

  return items.slice(0, 5);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRelevantToArea(text) {
  const keywords = [
    "antipolo",
    "rizal",
    "metro manila",
    "ncr",
    "marikina",
    "calabarzon",
    "luzon",
  ];
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function toDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function toHourKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

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

// ─── Cron scheduler ──────────────────────────────────────────────────────────

export function startAlertEngine() {
  // Run immediately on startup
  runAllChecks();
  runAgencyFeedCheck();

  // Flood + river every 15 minutes
  cron.schedule("*/15 * * * *", runAllChecks, {
    scheduled: true,
    timezone: "Asia/Manila",
  });

  // Agency feeds every 30 minutes
  cron.schedule("*/30 * * * *", runAgencyFeedCheck, {
    scheduled: true,
    timezone: "Asia/Manila",
  });
}

async function runAllChecks() {
  console.log("[AlertEngine] Running checks…", new Date().toISOString());
  await Promise.allSettled([
    runFloodEvacuationCheck(),
    runRiverThresholdCheck(),
  ]);
}
