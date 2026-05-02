import { useState, useEffect, useCallback, useRef } from "react";

const DB_NAME = "etelly-hazard-cache";
const DB_VERSION = 1;
const STORE_NAME = "predictions";

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

let dbPromise = null;
const getDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
};

const idbGet = async (key) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
};

const idbSet = async (key, value) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx
      .objectStore(STORE_NAME)
      .put({ key, value, cachedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

// ── In-flight deduplication ───────────────────────────────────────────────────
//
// Problem: React StrictMode double-invokes effects, and multiple components can
// share the same cacheKey. Without deduplication, two simultaneous callers both
// fire fetchFn at the same moment — doubling the Open-Meteo request count and
// making the 429 burst worse, not better.
//
// Fix: a module-level Map of in-flight Promises keyed by cacheKey. The second
// caller attaches to the same Promise instead of starting a new fetch.

const _inFlight = new Map();

// ── Jittered delay helper ─────────────────────────────────────────────────────
//
// Adds a small random offset (0–jitterMs) before a network call.
// Prevents all components from hitting the server at the exact same millisecond
// when the online event fires or when the interval ticks simultaneously.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (maxMs = 2000) => sleep(Math.random() * maxMs);

/**
 * useOfflineCache — wraps a fetch function with IndexedDB fallback.
 *
 * Improvements over v1:
 *  - In-flight deduplication: concurrent callers with the same key share one fetch.
 *  - Stale-while-revalidate: cached data is shown immediately; refresh happens in
 *    the background without a loading spinner flash.
 *  - Jittered online-reconnect retry: prevents all hooks from hammering the server
 *    at the exact same millisecond when connectivity is restored.
 *
 * @param {string}   cacheKey   - unique key for this data in IndexedDB
 * @param {Function} fetchFn    - async function that fetches fresh data
 * @param {number}   refreshMs  - how often to refresh when online (ms)
 */
export const useOfflineCache = (
  cacheKey,
  fetchFn,
  refreshMs = 10 * 60 * 1000,
) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [cachedAt, setCachedAt] = useState(null);
  const [error, setError] = useState(null);

  // Track whether the very first load has resolved so we can distinguish
  // "initial load" (show spinner) from "background refresh" (keep stale data).
  const initialised = useRef(false);

  // Keep a ref to the latest fetchFn so load() doesn't need it as a dependency.
  // Without this, an inline fetchFn would recreate load on every render, causing
  // the useEffect below to re-run → setLoading → re-render → infinite loop.
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => { fetchFnRef.current = fetchFn; });

  // ── Core load function ──────────────────────────────────────────────────────

  const load = useCallback(
    async ({ background = false } = {}) => {
      // For background refreshes show no loading state — the stale data stays
      // visible while the new data arrives silently.
      if (!background) setLoading(true);

      try {
        // ── Stale-while-revalidate: serve IndexedDB immediately ──────────────
        // On the very first call, check IndexedDB before the network so the UI
        // renders instantly with cached data rather than waiting for the fetch.
        if (!initialised.current) {
          try {
            const cached = await idbGet(cacheKey);
            if (cached) {
              setData(cached.value);
              setCachedAt(cached.cachedAt);
              setLoading(false); // unblock the UI immediately
            }
          } catch {
            // IndexedDB unavailable — fall through to network
          }
        }

        // ── Deduplicated network fetch ────────────────────────────────────────
        if (!_inFlight.has(cacheKey)) {
          const promise = fetchFnRef.current().finally(() => _inFlight.delete(cacheKey));
          _inFlight.set(cacheKey, promise);
        }

        const fresh = await _inFlight.get(cacheKey);

        // If fetchFn resolved with a server-error body instead of throwing
        // (raw fetch() doesn't throw on 4xx/5xx), treat it as a failure so
        // we fall back to IndexedDB rather than storing the error as data.
        if (fresh && typeof fresh === "object" && typeof fresh.error === "string") {
          throw new Error(fresh.error);
        }

        setData(fresh);
        setIsOffline(false);
        setCachedAt(Date.now());
        setError(null);

        // Persist to IndexedDB for next offline session
        await idbSet(cacheKey, fresh);
      } catch (err) {
        // Network failed — fall back to IndexedDB if not already shown
        try {
          const cached = await idbGet(cacheKey);
          if (cached) {
            // Only overwrite if we don't already have data (avoids flicker on
            // background refresh failures — stale data stays in place).
            if (!initialised.current || !data) {
              setData(cached.value);
              setCachedAt(cached.cachedAt);
            }
            setIsOffline(true);
            setError(null);
          } else {
            setIsOffline(true);
            setError("No data available offline");
          }
        } catch {
          setError("Failed to load data");
        }
      } finally {
        initialised.current = true;
        setLoading(false);
      }
    },
    [cacheKey],
  );

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    load();
  }, [load]);

  // ── Auto-refresh interval ───────────────────────────────────────────────────
  // Runs as a background refresh — stale data stays on screen while new data
  // arrives, so users see no loading flash during routine polling.
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) load({ background: true });
    }, refreshMs);
    return () => clearInterval(interval);
  }, [load, refreshMs]);

  // ── Online / offline event listeners ───────────────────────────────────────
  // On reconnect: add a small jitter (0–2 s) so that all mounted hooks don't
  // simultaneously hammer the server the instant Wi-Fi comes back.
  useEffect(() => {
    const handleOnline = async () => {
      await jitter(2000);
      load({ background: true });
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [load]);

  return { data, loading, isOffline, cachedAt, error, refresh: load };
};
