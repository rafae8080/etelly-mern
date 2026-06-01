import { useState, useCallback, useEffect } from "react";
import { API_BASE, authHeaders } from "../components/community/helpers";
import { connectSocket } from "../utils/socket";

// ── IndexedDB requests cache ──────────────────────────────────────────────────
// A separate DB from the alerts cache so the two never collide.
const IDB_NAME = "etelly-community-cache";
const IDB_STORE = "requests";

function openCommunityDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject();
  });
}

async function readRequestsCache() {
  try {
    const db = await openCommunityDB();
    return await new Promise((resolve) => {
      const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get("latest");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function writeRequestsCache(requests) {
  try {
    const db = await openCommunityDB();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ requests, cachedAt: Date.now() }, "latest");
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch { /* non-critical */ }
}

export function useCommunitySharing() {
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/requests`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
        setIsStale(false);
        setReqError(null);
        writeRequestsCache(data.requests); // fire-and-forget
      }
    } catch (err) {
      // Network failed — fall back to the local cache so the user still sees data
      const cached = await readRequestsCache();
      if (cached?.requests?.length) {
        setRequests(cached.requests);
        setIsStale(true);
        setReqError(null);
      } else {
        setReqError(err.message);
      }
    } finally {
      setReqLoading(false);
    }
  }, []);

  useEffect(() => {
    // Show cached requests immediately while the fresh fetch is in flight
    readRequestsCache().then((cached) => {
      if (cached?.requests?.length) {
        setRequests(cached.requests);
        setIsStale(true);
        setReqLoading(false);
      }
    });

    fetchRequests();

    // Real-time: keep the admin view in sync without a manual refresh.
    // community_request_updated covers matched / fulfilled / cancelled /
    // released / withdrawn; new_pledge (admin-room) updates offer counts.
    const socket = connectSocket();
    const joinAdmin = () => socket.emit("join_admin");
    joinAdmin();
    socket.on("connect", joinAdmin); // re-join after a reconnect

    socket.on("new_community_request", fetchRequests);
    socket.on("community_request_updated", fetchRequests);
    socket.on("new_pledge", fetchRequests);

    // Reconnect: refresh immediately when coming back online.
    // Mark stale immediately on disconnect so the UI reflects it right away.
    const handleOnline = () => fetchRequests();
    const handleOffline = () => setIsStale(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      socket.off("connect", joinAdmin);
      socket.off("new_community_request", fetchRequests);
      socket.off("community_request_updated", fetchRequests);
      socket.off("new_pledge", fetchRequests);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchRequests]);

  return {
    requests,
    reqLoading,
    reqError,
    isStale,
    fetchRequests,
  };
}
