import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";
const POLL_INTERVAL = 60_000;
const REFRESH_COOLDOWN = 60; // seconds

// rescue type always sorts first, then by severity
const SEVERITY_ORDER = { evacuate: 0, warning: 1, watch: 2, critical: 3 };

export const SOURCE_CONFIG = {
  system: {
    label: "System",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  CDRRMO: {
    label: "CDRRMO",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  Barangay: {
    label: "Barangay",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  USGS: {
    label: "USGS",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  PAGASA: {
    label: "PAGASA",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  GDACS: {
    label: "GDACS",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  PHIVOLCS: {
    label: "PHIVOLCS / USGS",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  NDRRMC: {
    label: "NDRRMC",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
  OCD: {
    label: "OCD",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
  },
};

export const SEVERITY_CONFIG = {
  evacuate: {
    label: "EVACUATE",
    bg: "bg-red-600",
    text: "text-white",
    border: "border-red-600",
    leftBorder: "border-red-600",
    icon: "🚨",
  },
  warning: {
    label: "Warning",
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-300",
    leftBorder: "border-amber-500",
    icon: "⚡",
  },
  watch: {
    label: "Watch",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    leftBorder: "border-blue-400",
    icon: "👁",
  },
};

export const RESCUE_CONFIG = {
  label: "RESCUE",
  bg: "bg-red-600",
  text: "text-white",
  border: "border-red-600",
  leftBorder: "border-red-600",
};

export function useAlerts() {
  const [alerts,      setAlerts]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const timerRef    = useRef(null);
  const cooldownRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      const sorted = (data.alerts ?? []).sort((a, b) => {
        // Rescue type always floats to the top
        if (a.type === "rescue" && b.type !== "rescue") return -1;
        if (b.type === "rescue" && a.type !== "rescue") return  1;
        const severityDiff =
          (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      setAlerts(sorted);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    timerRef.current = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchAlerts]);

  const dismiss = useCallback(
    async (alertId) => {
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      try {
        await fetch(`${API_BASE}/api/alerts/${alertId}/dismiss`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        });
      } catch {
        fetchAlerts();
      }
    },
    [fetchAlerts],
  );

  const refresh = useCallback(() => {
    if (cooldownSecs > 0) return;
    setLoading(true);
    fetchAlerts();

    // Start cooldown countdown
    clearInterval(cooldownRef.current);
    setCooldownSecs(REFRESH_COOLDOWN);
    let remaining = REFRESH_COOLDOWN;
    cooldownRef.current = setInterval(() => {
      remaining -= 1;
      setCooldownSecs(remaining);
      if (remaining <= 0) clearInterval(cooldownRef.current);
    }, 1000);
  }, [fetchAlerts, cooldownSecs]);

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const counts = alerts.reduce(
    (acc, a) => {
      if (a.type === "rescue") acc.rescue = (acc.rescue ?? 0) + 1;
      else acc[a.severity] = (acc[a.severity] ?? 0) + 1;
      acc.total += 1;
      return acc;
    },
    { evacuate: 0, warning: 0, watch: 0, rescue: 0, total: 0 },
  );

  return { alerts, loading, error, lastFetched, dismiss, refresh, cooldownSecs, counts };
}
