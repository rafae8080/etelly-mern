import { useEffect } from "react";
import { Mountain, Droplets, X, WifiOff } from "lucide-react";
import { useOfflineCache } from "../../../hooks/useOfflineCache";

// ── Dev test mode ─────────────────────────────────────────────────────────
const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

// Fake data for dev mode
const DEV_FAKE_DATA = {
  overallRisk: { label: "Warning", level: 2, color: "#f97316" },
  generatedAt: new Date().toISOString(),
  current: {
    rainfall24h: 38.5,
    rainfall72h: 82.3,
    soilMoisture: 0.372,
    soilSaturated: true,
  },
  zones: [
    {
      lat: 14.622,
      lng: 121.198,
      risk: 3,
      name: "Brgy. Dalig (upper slope)",
      riskAssessment: { label: "Warning", level: 2, color: "#f97316" },
    },
    {
      lat: 14.631,
      lng: 121.205,
      risk: 3,
      name: "Brgy. Calawis, Antipolo",
      riskAssessment: { label: "Warning", level: 2, color: "#f97316" },
    },
    {
      lat: 14.583,
      lng: 121.172,
      risk: 3,
      name: "Hinulugang Taktak escarpment",
      riskAssessment: { label: "Watch", level: 1, color: "#f59e0b" },
    },
    {
      lat: 14.598,
      lng: 121.175,
      risk: 2,
      name: "Brgy. Inarawan (slope)",
      riskAssessment: { label: "Watch", level: 1, color: "#f59e0b" },
    },
  ],
  forecast: {
    dates: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    }),
    precipitation_sum: [38.5, 55.2, 21.0, 8.5, 3.0, 1.2, 0.5],
    precipitation_probability_max: [85, 90, 65, 40, 20, 10, 5],
  },
};

const ALERT_CONFIG = {
  Low: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    label: "Low Risk",
    icon: "🟢",
    buttonBg: "bg-white",
    buttonBorder: "border-gray-300",
    iconColor: "text-green-500",
  },
  Watch: {
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
    label: "Watch — Monitor",
    icon: "🟡",
    buttonBg: "bg-yellow-50",
    buttonBorder: "border-yellow-400",
    iconColor: "text-yellow-500",
  },
  Warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    label: "Warning — Elevated",
    icon: "⚠️",
    buttonBg: "bg-amber-50",
    buttonBorder: "border-amber-400",
    iconColor: "text-amber-500",
  },
  Critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    label: "Critical — High Risk",
    icon: "🚨",
    buttonBg: "bg-red-50",
    buttonBorder: "border-red-400",
    iconColor: "text-red-500",
  },
};

const DEFAULT_ALERT = ALERT_CONFIG.Low;

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
            title={`Day ${i + 1}: ${v.toFixed(1)} mm`}
          />
        </div>
      );
    })}
  </div>
);

const SoilMoistureBar = ({ value, threshold = 0.35 }) => {
  const pct = Math.min((value / 0.5) * 100, 100);
  const saturated = value >= threshold;
  return (
    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          saturated ? "bg-red-400" : pct > 55 ? "bg-amber-400" : "bg-blue-400"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

const RISK_BADGE = {
  Critical: "bg-red-100 text-red-700",
  Warning: "bg-amber-100 text-amber-700",
  Watch: "bg-yellow-100 text-yellow-700",
  Low: "bg-green-100 text-green-700",
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const fetchLandslide = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch("/api/hazard/landslide", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn("Landslide API fetch failed:", error.message);
    throw error;
  }
};

// ── FIX: hooks are ALWAYS called — no conditional hook calls ──────────────
const LandslideForecastPanelContent = ({
  visible,
  isOpen,
  onToggle,
  topStyle,
  onOfflineChange,
}) => {
  // Always call the hook unconditionally — satisfies Rules of Hooks.
  // In dev mode we still call it but ignore its return value.
  const cacheResult = useOfflineCache(
    "landslide-forecast",
    fetchLandslide,
    10 * 60 * 1000,
  );

  // Pick data source: dev fake data OR real cache result
  const data = IS_DEV_MODE ? DEV_FAKE_DATA : cacheResult.data;
  const loading = IS_DEV_MODE ? false : cacheResult.loading;
  const isOffline = IS_DEV_MODE ? false : cacheResult.isOffline;
  const cachedAt = IS_DEV_MODE ? null : cacheResult.cachedAt;
  const error = IS_DEV_MODE ? null : cacheResult.error;

  // FIX: notify parent via useEffect, not inline during render
  useEffect(() => {
    if (IS_DEV_MODE) return;
    if (typeof onOfflineChange === "function") {
      onOfflineChange({ isOffline, cachedAt });
    }
  }, [isOffline, cachedAt, onOfflineChange]);

  const alertKey = data?.overallRisk?.label ?? "Low";
  const alert = ALERT_CONFIG[alertKey] ?? DEFAULT_ALERT;
  const current = data?.current;
  const forecast = data?.forecast;
  const zones = (data?.zones ?? [])
    .filter((z) => z.riskAssessment?.level > 0)
    .slice(0, 4);

  return (
    <>
      {/* Icon button */}
      <button
        onClick={onToggle}
        title="Landslide Risk"
        style={topStyle ?? undefined}
        className={`absolute left-[10px] z-[1000]
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
            title="Dev mode — fake landslide data injected"
          />
        )}
        <Mountain size={15} strokeWidth={1.8} className={alert.iconColor} />
      </button>

      {/* Panel */}
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
                      DEV MODE
                    </span>
                  )}
                  {!IS_DEV_MODE && isOffline && (
                    <WifiOff
                      size={10}
                      className="text-amber-500"
                      title={`Cached ${timeAgo(cachedAt)}`}
                    />
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  Landslide risk · Antipolo
                  {IS_DEV_MODE && (
                    <span className="text-yellow-600 ml-1">
                      · fake test data
                    </span>
                  )}
                  {!IS_DEV_MODE && isOffline && cachedAt && (
                    <span className="text-amber-500 ml-1">
                      · cached {timeAgo(cachedAt)}
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
          {loading && !IS_DEV_MODE && (
            <div className="px-4 py-4 flex items-center gap-2">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Loading risk data…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && !IS_DEV_MODE && (
            <div className="px-4 py-3 text-xs text-red-500">
              ⚠️ Unable to load landslide data
            </div>
          )}

          {/* Content */}
          {!loading && data && (
            <div className="px-4 py-3 flex flex-col gap-3">
              {/* Dev mode banner */}
              {IS_DEV_MODE && (
                <div className="mb-1 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-[10px] text-yellow-700 text-center">
                    🧪 DEV MODE — Using fake landslide data
                  </p>
                </div>
              )}

              {/* Rainfall summary row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Droplets size={12} className="text-blue-400" />
                  Rain (24 h / 72 h)
                </div>
                <span className="text-xs font-semibold text-gray-700">
                  {current?.rainfall24h?.toFixed(1) ?? "—"} mm
                  <span className="text-gray-400 font-normal ml-1">
                    / {current?.rainfall72h?.toFixed(1) ?? "—"} mm
                  </span>
                </span>
              </div>

              {/* Soil moisture row */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500">Soil moisture</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      current?.soilSaturated
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {current?.soilSaturated ? "Saturated" : "Normal"}
                    {" · "}
                    {current?.soilMoisture?.toFixed(3) ?? "—"} m³/m³
                  </span>
                </div>
                <SoilMoistureBar value={current?.soilMoisture ?? 0} />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[8px] text-gray-300">Dry</span>
                  <span className="text-[8px] text-gray-300">Sat. ≥ 0.35</span>
                </div>
              </div>

              {/* At-risk zones */}
              {zones.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                  <p className="text-[10px] font-semibold text-gray-500">
                    At-Risk Zones
                  </p>
                  {zones.map((zone, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-600 truncate max-w-[160px]">
                        {zone.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                          RISK_BADGE[zone.riskAssessment.label] ??
                          RISK_BADGE.Low
                        }`}
                      >
                        {zone.riskAssessment.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 7-day rainfall sparkline */}
              <div className="border-t border-gray-100 pt-2">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">
                  7-Day Rainfall Forecast (mm)
                </p>
                <SparkBar
                  values={forecast?.precipitation_sum ?? []}
                  max={Math.max(...(forecast?.precipitation_sum ?? [1]), 1)}
                />
                {/* Sparkbar color legend */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-blue-400" />
                    <span className="text-[8px] text-gray-400">Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-400" />
                    <span className="text-[8px] text-gray-400">Moderate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-red-400" />
                    <span className="text-[8px] text-gray-400">Heavy</span>
                  </div>
                </div>
                <div className="flex justify-between mt-0.5">
                  {(forecast?.dates ?? []).slice(0, 7).map((d, i) => (
                    <span key={i} className="text-[8px] text-gray-300">
                      {new Date(d).toLocaleDateString("en-PH", {
                        weekday: "narrow",
                      })}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[9px] text-gray-300 text-center border-t border-gray-100 pt-2">
                Open-Meteo · MGB susceptibility zones
                {!IS_DEV_MODE && !isOffline && data.generatedAt && (
                  <span>
                    {" · Updated "}
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

// Main component — guard on visible only; hooks inside always run
const LandslideForecastPanel = (props) => {
  if (!props.visible) return null;
  return <LandslideForecastPanelContent {...props} />;
};

export default LandslideForecastPanel;
