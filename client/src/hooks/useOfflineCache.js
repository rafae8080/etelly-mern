import { useState, useEffect, useCallback } from "react";

const DB_NAME = "etelly-hazard-cache";
const DB_VERSION = 1;
const STORE_NAME = "predictions";

// Open IndexedDB once
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

/**
 * useOfflineCache — wraps a fetch function with IndexedDB fallback
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const fresh = await fetchFn();
      setData(fresh);
      setIsOffline(false);
      setCachedAt(Date.now());
      setError(null);
      // Save to IndexedDB for offline use
      await idbSet(cacheKey, fresh);
    } catch (err) {
      // Fetch failed — try IndexedDB
      try {
        const cached = await idbGet(cacheKey);
        if (cached) {
          setData(cached.value);
          setCachedAt(cached.cachedAt);
          setIsOffline(true);
        } else {
          setError("No data available offline");
          setIsOffline(true);
        }
      } catch {
        setError("Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fetchFn]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh when online
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) load();
    }, refreshMs);
    return () => clearInterval(interval);
  }, [load, refreshMs]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => load();
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
