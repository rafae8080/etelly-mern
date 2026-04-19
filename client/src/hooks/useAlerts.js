/**
 * useAlerts.js
 * Shared React hook — polls /api/alerts every 60 seconds.
 * Works in both the web app and the React Native mobile app
 * (replace the fetch URL with your production API base if needed).
 *
 * Usage:
 *   const { alerts, loading, error, dismiss, refresh } = useAlerts();
 */

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";
const POLL_INTERVAL = 60_000; // 60 seconds

// Severity order for sorting (most critical first)
const SEVERITY_ORDER = { evacuate: 0, critical: 1, warning: 2, watch: 3 };

// Source badge colors (matches AlertsPage UI)
export const SOURCE_CONFIG = {
  system: {
    label: "System",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  PAGASA: {
    label: "PAGASA",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  PHIVOLCS: {
    label: "PHIVOLCS",
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

// Severity badge colors
export const SEVERITY_CONFIG = {
  evacuate: {
    label: "EVACUATE",
    bg: "bg-red-600",
    text: "text-white",
    border: "border-red-600",
    leftBorder: "border-red-600",
    icon: "🚨",
  },
  critical: {
    label: "Critical",
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-300",
    leftBorder: "border-red-500",
    icon: "⚠️",
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

export function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const timerRef = useRef(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      // Sort by severity then by time (newest first within same severity)
      const sorted = (data.alerts ?? []).sort((a, b) => {
        const severityDiff =
          (SEVERITY_ORDER[a.severity] ?? 99) -
          (SEVERITY_ORDER[b.severity] ?? 99);
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

  // Initial fetch + polling
  useEffect(() => {
    fetchAlerts();
    timerRef.current = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchAlerts]);

  // Dismiss an alert (soft-delete via PATCH)
  const dismiss = useCallback(
    async (alertId) => {
      // Optimistic update
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      try {
        await fetch(`${API_BASE}/api/alerts/${alertId}/dismiss`, {
          method: "PATCH",
        });
      } catch {
        // If it fails, refetch to restore correct state
        fetchAlerts();
      }
    },
    [fetchAlerts],
  );

  // Manual refresh
  const refresh = useCallback(() => {
    setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  // Counts by severity (useful for the HazardMapPage badge)
  const counts = alerts.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] ?? 0) + 1;
      acc.total += 1;
      return acc;
    },
    { evacuate: 0, critical: 0, warning: 0, watch: 0, total: 0 },
  );

  return { alerts, loading, error, lastFetched, dismiss, refresh, counts };
}
