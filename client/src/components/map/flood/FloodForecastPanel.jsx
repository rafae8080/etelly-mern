import { useCallback, useEffect } from "react";
import {
  Waves,
  Droplets,
  X,
  WifiOff,
  FlaskConical,
  TriangleAlert,
} from "lucide-react";
import { useOfflineCache } from "../../../hooks/useOfflineCache";

// ── Dev test mode ─────────────────────────────────────────────────────────
// Add ?dev=true to your localhost URL to see the panel with fake data.
// Verifies: alert colors, spark bars, river gauges, rainfall summary.
const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

// Fake data simulates a warning-level flood situation
const DEV_FAKE_DATA = {
  overallAlert: "warning",
  generatedAt: new Date().toISOString(),
  rivers: [
    {
      id: "marikina_river_antipolo",
      name: "Marikina River (Antipolo)",
      lat: 14.605,
      lon: 121.12,
      today: 340,
      maxNext7: 580,
      forecast: [340, 380, 520, 480, 310, 200, 150],
      forecastMax: [380, 430, 580, 510, 340, 220, 160],
      dates: Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
      threshold: { warning: 300, critical: 600 },
      alertLevel: "warning",
    },
    {
      id: "manggahan_floodway",
      name: "Manggahan Floodway",
      lat: 14.582,
      lon: 121.1,
      today: 90,
      maxNext7: 185,
      forecast: [90, 100, 185, 160, 110, 70, 55],
      forecastMax: [100, 115, 200, 170, 120, 80, 60],
      dates: Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
      threshold: { warning: 200, critical: 450 },
      alertLevel: "normal",
    },
    {
      id: "hinulugang_taktak",
      name: "Hinulugang Taktak River",
      lat: 14.59,
      lon: 121.175,
      today: 95,
      maxNext7: 140,
      forecast: [95, 120, 140, 130, 100, 65, 50],
      forecastMax: [110, 135, 155, 145, 115, 75, 55],
      dates: Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
      threshold: { warning: 80, critical: 150 },
      alertLevel: "warning",
    },
  ],
  rainfall: {
    dates: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    }),
    precipitation_sum: [18.4, 32.1, 55.3, 44.0, 21.2, 8.5, 3.0],
    probability_max: [75, 85, 95, 90, 70, 40, 20],
  },
};

const ALERT_CONFIG = {
  normal: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    label: "Normal Levels",
    icon: <Droplets className="w-4 h-4 text-blue-600" />,
    buttonBg: "bg-white",
    buttonBorder: "border-gray-300",
    iconColor: "text-blue-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    label: "Elevated — Watch",
    icon: <TriangleAlert className="w-4 h-4 text-amber-500" />,
    buttonBg: "bg-amber-50",
    buttonBorder: "border-amber-400",
    iconColor: "text-amber-500",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    label: "Flood Risk — High",
    icon: "🚨",
    buttonBg: "bg-red-50",
    buttonBorder: "border-red-400",
    iconColor: "text-red-500",
  },
};

const SparkBar = ({ values, max }) => (
  <div className="flex items-end gap-0.5 h-8">
    {values.slice(0, 7).map((v, i) => {
      const pct = max > 0 ? (v / max) * 100 : 0;
      const color =
        pct > 75 ? "bg-red-400" : pct > 45 ? "bg-amber-400" : "bg-blue-400";
      return (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className={`${color} rounded-sm min-h-[2px]`}
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`Day ${i + 1}: ${v.toFixed(1)}`}
          />
        </div>
      );
    })}
  </div>
);

const timeAgo = (ts) => {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const fetchForecast = async () => {
  const res = await fetch("/api/hazard/flood-forecast");
  if (!res.ok) throw new Error("Failed to fetch forecast");
  return res.json();
};

const FloodForecastPanel = ({
  visible,
  isOpen,
  onToggle,
  topPosition = "top-[170px]",
  topStyle = null,
  onOfflineChange,
}) => {
  const {
    data: liveData,
    loading: liveLoading,
    isOffline,
    cachedAt,
    error,
  } = useOfflineCache("flood-forecast", fetchForecast, 10 * 60 * 1000);

  // In dev mode, swap in fake data so you can verify the panel renders correctly
  const data = IS_DEV_MODE ? DEV_FAKE_DATA : liveData;
  const loading = IS_DEV_MODE ? false : liveLoading;

  // Notify parent of offline state changes
  useEffect(() => {
    if (typeof onOfflineChange === "function") {
      onOfflineChange({ isOffline, cachedAt });
    }
  }, [isOffline, cachedAt, onOfflineChange]);

  if (!visible) return null;

  const alertKey = data?.overallAlert ?? "normal";
  const alert = ALERT_CONFIG[alertKey];
  const rain = data?.rainfall;
  const rivers = data?.rivers ?? [];

  return (
    <>
      {/* ── Icon button ── */}
      <button
        onClick={onToggle}
        title="River Forecast"
        style={topStyle ?? undefined}
        className={`absolute ${topStyle ? "" : topPosition} left-[10px] z-[1000]
                    w-[30px] h-[30px] border flex items-center justify-center
                    shadow-sm hover:brightness-95 transition-all
                    ${
                      isOpen
                        ? `${alert.buttonBg} ${alert.buttonBorder}
                         ring-1 ring-offset-1 ${alert.buttonBorder}`
                        : `${alert.buttonBg} ${alert.buttonBorder}`
                    }`}
      >
        {IS_DEV_MODE && (
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400 border border-white"
            title="Dev mode — fake flood data injected"
          />
        )}
        <Waves size={15} strokeWidth={1.8} className={alert.iconColor} />
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div
          className={`absolute top-[90px] left-[50px] z-[1050]
                      w-64 bg-white border rounded-2xl shadow-xl
                      overflow-hidden ${alert.border}`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-3
                           ${alert.bg} border-b ${alert.border}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{alert.icon}</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold ${alert.text}`}>
                    {alert.label}
                  </p>
                  {IS_DEV_MODE && (
                    <span className="text-[8px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">
                      DEV
                    </span>
                  )}
                  {isOffline && !IS_DEV_MODE && (
                    <WifiOff
                      size={10}
                      className="text-amber-500"
                      title={`Cached ${timeAgo(cachedAt)}`}
                    />
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  7-day river forecast
                  {isOffline && !IS_DEV_MODE && cachedAt && (
                    <span className="text-amber-500 ml-1">
                      · cached {timeAgo(cachedAt)}
                    </span>
                  )}
                  {IS_DEV_MODE && (
                    <span className="text-yellow-600 ml-1">
                      · fake test data
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="px-4 py-4 flex items-center gap-2">
              <div
                className="w-3 h-3 border border-blue-400
                              border-t-transparent rounded-full animate-spin"
              />
              <span className="text-xs text-gray-400">Loading forecast…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="px-4 py-3 text-xs text-red-500">
              ⚠️ No data available — check your connection
            </div>
          )}

          {/* Content */}
          {!loading && data && (
            <div className="px-4 py-3 flex flex-col gap-3">
              {/* Today rainfall summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Droplets size={12} className="text-blue-400" />
                  Rain today
                </div>
                <span className="text-xs font-semibold text-gray-700">
                  {rain?.precipitation_sum?.[0]?.toFixed(1) ?? "—"} mm
                  <span className="text-gray-400 font-normal ml-1">
                    ({rain?.probability_max?.[0] ?? "—"}% chance)
                  </span>
                </span>
              </div>

              {/* Rivers */}
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                {rivers.map((river) => {
                  const cfg = ALERT_CONFIG[river.alertLevel];
                  const pct = (river.today / river.threshold.critical) * 100;
                  const allVals = river.forecastMax;
                  const maxVal = Math.max(...allVals, river.threshold.critical);

                  return (
                    <div key={river.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-600">
                          {river.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5
                                          rounded-full ${cfg.bg} ${cfg.text}`}
                        >
                          {river.today.toFixed(1)} m³/s
                        </span>
                      </div>

                      <SparkBar values={allVals} max={maxVal} />

                      <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all
                                      ${
                                        pct >= 100
                                          ? "bg-red-500"
                                          : pct >= 60
                                            ? "bg-amber-400"
                                            : "bg-blue-400"
                                      }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[8px] text-gray-300">0</span>
                        <span className="text-[8px] text-gray-300">
                          Critical: {river.threshold.critical} m³/s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 7-day rainfall sparkline */}
              <div className="border-t border-gray-100 pt-2">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">
                  7-Day Rainfall (mm)
                </p>
                <SparkBar
                  values={rain?.precipitation_sum ?? []}
                  max={Math.max(...(rain?.precipitation_sum ?? [1]), 1)}
                />
                <div className="flex justify-between mt-0.5">
                  {(rain?.dates ?? []).slice(0, 7).map((d, i) => (
                    <span key={i} className="text-[8px] text-gray-300">
                      {new Date(d).toLocaleDateString("en-PH", {
                        weekday: "narrow",
                      })}
                    </span>
                  ))}
                </div>
              </div>

              <p
                className="text-[9px] text-gray-300 text-center
                            border-t border-gray-100 pt-2"
              >
                GloFAS v4 · Open-Meteo
                {!isOffline && data.generatedAt && (
                  <span>
                    {" "}
                    · Updated{" "}
                    {new Date(data.generatedAt).toLocaleTimeString("en-PH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FloodForecastPanel;
