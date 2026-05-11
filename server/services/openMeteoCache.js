/**
 * services/openMeteoCache.js
 *
 * Shared Open-Meteo cache and fetch layer used by both hazard.js (route
 * handlers) and alertEngine.js (cron jobs).
 *
 * Previously both files maintained their own cache Maps and rate-limit
 * cooldowns independently, causing:
 *   - alertEngine making HTTP round-trips to localhost just to read cached data
 *     that was already in the same process's memory
 *   - Two cooldown timers that didn't communicate — hazard.js could be
 *     rate-limited while alertEngine kept firing requests (and vice versa)
 *   - classifyRainfallIntensity duplicated in both files with slightly
 *     different signatures
 *
 * Now both share one cache Map, one cooldown, and call fetchRainfallHourly /
 * fetchLandslideData directly — no HTTP round-trip, no duplicate upstream
 * requests, no split rate-limit state.
 */

// ── Cache singleton ───────────────────────────────────────────────────────────

const _cache    = new Map();
const _inflight = new Map(); // deduplicates concurrent fetches for the same key
let   _cooldownUntil = 0;

export const TTL = {
  RAINFALL_HOURLY: 10 * 60 * 1000,
  FLOOD_FORECAST:  10 * 60 * 1000,
  LANDSLIDE:       10 * 60 * 1000,
  TYPHOON:          5 * 60 * 1000,
};

export function getCached(key) {
  const e = _cache.get(key);
  return e && Date.now() <= e.expiresAt ? e.data : null;
}

export function getCachedStale(key) {
  return _cache.get(key)?.data ?? null;
}

export function setCached(key, data, ttlMs) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Rate-limit cooldown ───────────────────────────────────────────────────────

export function isCoolingDown() {
  return Date.now() < _cooldownUntil;
}

export function setCooldown(minutes = 60) {
  _cooldownUntil = Date.now() + minutes * 60 * 1000;
  const at = new Date(_cooldownUntil).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" });
  console.warn(
    `⚠️ Open-Meteo rate-limited — all fetches paused ${minutes} min (resumes ~${at} Manila time)`,
  );
}

// ── Core fetch ────────────────────────────────────────────────────────────────
// Returns { data, stale: boolean } or null (rate-limited with no stale fallback).
// Concurrent calls for the same cacheKey share one in-flight promise so
// Open-Meteo is never called twice for the same data within the same tick.

export async function fetchOpenMeteo(url, cacheKey, ttlMs) {
  const fresh = getCached(cacheKey);
  if (fresh) return { data: fresh, stale: false };

  if (isCoolingDown()) {
    const stale = getCachedStale(cacheKey);
    return stale ? { data: stale, stale: true } : null;
  }

  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

  const promise = (async () => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (r.status === 429 || !r.ok) {
        setCooldown(60);
        const stale = getCachedStale(cacheKey);
        return stale ? { data: stale, stale: true } : null;
      }
      const data = await r.json();
      setCached(cacheKey, data, ttlMs);
      return { data, stale: false };
    } catch (err) {
      const stale = getCachedStale(cacheKey);
      if (stale) return { data: stale, stale: true };
      throw err;
    } finally {
      _inflight.delete(cacheKey);
    }
  })();

  _inflight.set(cacheKey, promise);
  return promise;
}

// ── Named fetchers ────────────────────────────────────────────────────────────
// Canonical cache keys ensure hazard.js routes and alertEngine.js cron jobs
// always read from and write to the same cache entries.

export function fetchRainfallHourly(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=precipitation,precipitation_probability,weathercode` +
    `&daily=precipitation_sum,precipitation_probability_max` +
    `&forecast_days=7&timezone=Asia%2FManila`;
  return fetchOpenMeteo(url, `rainfall_hourly_${lat}_${lon}`, TTL.RAINFALL_HOURLY);
}

export function fetchLandslideData(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,precipitation_probability_max` +
    `&hourly=soil_moisture_0_to_7cm,soil_moisture_7_to_28cm` +
    `&past_days=3&forecast_days=7&timezone=Asia%2FManila`;
  return fetchOpenMeteo(url, `landslide_${lat}_${lon}`, TTL.LANDSLIDE);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

// Single PAGASA rainfall classifier — previously classifyPAGASA in hazard.js
// and classifyRainfallIntensity in alertEngine.js (same thresholds, alertEngine
// version just omitted the color field).
export function classifyRainfallIntensity(mmPerHour) {
  if (mmPerHour >= 60)  return { label: "Torrential", level: 5, color: "#7c3aed" };
  if (mmPerHour >= 30)  return { label: "Intense",    level: 4, color: "#dc2626" };
  if (mmPerHour >= 15)  return { label: "Heavy",      level: 3, color: "#f97316" };
  if (mmPerHour >= 7.5) return { label: "Moderate",   level: 2, color: "#f59e0b" };
  if (mmPerHour > 0)    return { label: "Light",      level: 1, color: "#3b82f6" };
  return                       { label: "None",       level: 0, color: "#9ca3af" };
}

// Find the index in Open-Meteo's hourly time array that matches the current
// Manila hour — used by both the /rainfall-hourly route and alertEngine flood checks.
export function findCurrentHourIndex(hourlyTimes) {
  const nowManila   = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const todayStr    = nowManila.toISOString().slice(0, 10);
  const currentHour = nowManila.getHours();
  const idx = hourlyTimes.findIndex(
    (t) => t.startsWith(todayStr) && parseInt(t.slice(11, 13)) === currentHour,
  );
  return idx >= 0 ? idx : 0;
}
