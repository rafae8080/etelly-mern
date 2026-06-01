import {
  CloudRain,
  Cloud,
  Loader,
  WifiOff,
  Zap,
  Wind,
  Droplets,
} from "lucide-react";
import { useOfflineCache } from "../../../hooks/useOfflineCache";

// ── Per-level icon config ─────────────────────────────────────────────────
// Each PAGASA level maps to a distinct lucide icon + fixed size + color token.
// Icons chosen to intuitively convey intensity without needing bar height.
const LEVEL_ICON = {
  //          Icon component   size  strokeWidth
  Torrential: { Icon: Zap, sz: 20, sw: 2.2 }, // lightning bolt — extreme
  Intense: { Icon: CloudRain, sz: 18, sw: 2.2 }, // heavy cloud rain
  Heavy: { Icon: CloudRain, sz: 16, sw: 1.8 }, // same icon, smaller
  Moderate: { Icon: CloudRain, sz: 14, sw: 1.6 }, // smaller still
  Light: { Icon: Droplets, sz: 13, sw: 1.5 }, // just droplets
  None: { Icon: Cloud, sz: 13, sw: 1.4 }, // empty cloud
};

const PAGASA_CONFIG = {
  Torrential: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-300",
    iconColor: "#7c3aed",
  },
  Intense: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-300",
    iconColor: "#dc2626",
  },
  Heavy: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-300",
    iconColor: "#f97316",
  },
  Moderate: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-300",
    iconColor: "#f59e0b",
  },
  Light: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    iconColor: "#3b82f6",
  },
  None: {
    bg: "bg-gray-50",
    text: "text-gray-400",
    border: "border-gray-200",
    iconColor: "#9ca3af",
  },
};

const formatHour = (hour) => {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
};

const fetchRainfall = async () => {
  const res = await fetch("/api/hazard/rainfall-hourly");
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

const RainfallStrip = ({ visible }) => {
  const {
    data: liveData,
    loading: liveLoading,
    isOffline,
    cachedAt,
    error,
  } = useOfflineCache("rainfall-hourly", fetchRainfall, 30 * 60 * 1000);

  const data = liveData;
  const loading = liveLoading;

  if (!visible) return null;

  const overall = data?.overallPagasa;
  const overallCfg = PAGASA_CONFIG[overall?.label ?? "None"];

  const timeAgo = (ts) => {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="border-t border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <CloudRain size={12} className="text-gray-400" />
          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            12-Hour Rainfall
          </span>
          {isOffline && (
            <WifiOff size={9} className="text-amber-500" title="Cached data" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isOffline && cachedAt && (
            <span className="text-[8px] text-amber-500">
              cached {timeAgo(cachedAt)}
            </span>
          )}
          {overall && (
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${overallCfg.bg} ${overallCfg.text}`}
            >
              {overall.label}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 px-3 pb-3">
          <Loader size={12} className="text-gray-300 animate-spin" />
          <span className="text-[10px] text-gray-300">Loading rainfall…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="px-3 pb-3 text-[10px] text-red-400">⚠️ {error}</div>
      )}

      {/* ── Hourly cards ── */}
      {!loading && data && (
        <div
          className="flex gap-1.5 overflow-x-auto pb-3 px-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {data.hours.map((h, i) => {
            const isTrace = h.precipitation === 0 && h.probability >= 30;
            const effectiveLabel = isTrace ? "Light" : (h.pagasa?.label ?? "None");
            const cfg   = PAGASA_CONFIG[effectiveLabel];
            const lvl   = LEVEL_ICON[effectiveLabel] ?? LEVEL_ICON.None;
            const { Icon, sz, sw } = lvl;
            const isNow = i === 0;
            const showProb = h.precipitation > 0 || h.probability >= 30;

            return (
              <div
                key={i}
                className={`flex-shrink-0 flex flex-col items-center gap-1
                            rounded-xl px-1.5 py-2 w-[48px] border
                            ${cfg.border} ${cfg.bg}
                            ${isNow ? "ring-1 ring-offset-1 ring-blue-400" : ""}`}
              >
                {/* Hour label */}
                <span
                  className={`text-[9px] font-semibold leading-none
                                  ${isNow ? "text-blue-600" : "text-gray-400"}`}
                >
                  {isNow ? "Now" : formatHour(h.hour)}
                </span>

                {/* ── Lucide icon — fixed height container so all cards stay the same size ── */}
                <div className="h-6 flex items-center justify-center">
                  <Icon
                    size={sz}
                    strokeWidth={sw}
                    style={{ color: cfg.iconColor }}
                  />
                </div>

                {/* mm value — shows "trace" when probability≥30% but no measurable amount */}
                <span
                  className={`text-[10px] font-bold leading-none ${cfg.text}`}
                >
                  {h.precipitation > 0
                    ? <>{h.precipitation.toFixed(1)}<span className="text-[8px] font-normal"> mm</span></>
                    : isTrace
                      ? <span className="text-[9px] font-semibold italic">trace</span>
                      : "—"
                  }
                </span>

                {/* PAGASA label */}
                <span
                  className={`text-[8px] font-semibold text-center leading-tight ${cfg.text}`}
                >
                  {isTrace ? "Trace" : effectiveLabel}
                </span>

                {/* Probability — only shown when meaningful */}
                {showProb && (
                  <span className="text-[8px] text-gray-400 leading-none" title="Rain probability">
                    {h.probability}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RainfallStrip;
