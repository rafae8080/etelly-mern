import { useState } from "react";
import { Activity, RefreshCw, WifiOff, X } from "lucide-react";
import { useOfflineCache } from "../../../hooks/useOfflineCache";

const TIME_RANGES = [
  { value: "day", label: "Past 24 Hours" },
  { value: "week", label: "Past 7 Days" },
  { value: "month", label: "Past 30 Days" },
];

const MAGNITUDE_OPTIONS = [
  { value: 1.0, label: "M1.0+ (All)" },
  { value: 2.5, label: "M2.5+ (Significant)" },
  { value: 4.5, label: "M4.5+ (Moderate)" },
  { value: 6.0, label: "M6.0+ (Strong)" },
];

const fetchEarthquakeDefault = () => {
  const starttime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    format: "geojson",
    starttime,
    endtime: new Date().toISOString(),
    minmagnitude: "2.5",
    limit: "100",
    orderby: "magnitude",
    minlatitude: "4.5",
    maxlatitude: "21.5",
    minlongitude: "116.0",
    maxlongitude: "127.0",
  });
  return fetch(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`,
  ).then((r) => {
    if (!r.ok) throw new Error(`USGS ${r.status}`);
    return r.json();
  });
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

export default function EarthquakePanel({
  visible,
  isOpen,
  onToggle,
  onFilterChange,
  onRefresh,
  topStyle,
}) {
  const [filters, setFilters] = useState({
    timeRange: "week",
    minMagnitude: 2.5,
    region: "philippines",
    limit: 100,
  });
  const { isOffline, cachedAt } = useOfflineCache(
    "earthquake",
    fetchEarthquakeDefault,
    5 * 60 * 1000,
  );

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (key === "timeRange") {
      const date = new Date();
      if (value === "day") date.setDate(date.getDate() - 1);
      if (value === "week") date.setDate(date.getDate() - 7);
      if (value === "month") date.setDate(date.getDate() - 30);
      newFilters.starttime = date.toISOString();
    }
    onFilterChange?.(newFilters);
  };

  if (!visible) return null;

  const updatedAt = cachedAt
    ? new Date(cachedAt).toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <>
      {/* Button */}
      <button
        onClick={onToggle}
        className="absolute z-[1000] w-[30px] h-[30px] bg-white border border-gray-300 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
        style={{ left: 10, position: "absolute", ...topStyle }}
        title="Earthquake Tracker"
      >
        <Activity
          size={16}
          strokeWidth={1.8}
          className={isOpen ? "text-orange-500" : "text-gray-500"}
        />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute top-[90px] left-[50px] z-[1050] bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col"
          style={{ width: "272px", maxHeight: "calc(100vh - 120px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-orange-500" />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-gray-700">
                    Earthquake Tracker
                  </p>
                  {isOffline && (
                    <WifiOff
                      size={10}
                      className="text-amber-500"
                      title={`Cached ${timeAgo(cachedAt)}`}
                    />
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  USGS Earthquake API
                  {isOffline && cachedAt && (
                    <span className="text-amber-500 ml-1">
                      · cached {timeAgo(cachedAt)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRefresh?.()}
                className="p-1 hover:bg-gray-100 rounded"
                title="Refresh data"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={onToggle}
                className="p-1 hover:bg-gray-100 rounded text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filters — always visible */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => handleFilterChange("timeRange", e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                {TIME_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Minimum Magnitude
              </label>
              <select
                value={filters.minMagnitude}
                onChange={(e) =>
                  handleFilterChange("minMagnitude", parseFloat(e.target.value))
                }
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                {MAGNITUDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.region === "philippines"}
                  onChange={(e) =>
                    handleFilterChange(
                      "region",
                      e.target.checked ? "philippines" : "global",
                    )
                  }
                  className="rounded border-gray-300 text-orange-600"
                />
                <span className="text-sm text-gray-700">
                  Philippines only
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 flex flex-col gap-0.5 rounded-b-2xl">
            <p className="text-[9px] text-gray-400 font-medium">
              USGS Earthquake Hazards Program
            </p>
            <p className="text-[9px] text-gray-300 leading-tight">
              updated every 5 min
              {updatedAt && !isOffline && (
                <span className="ml-1">· last run {updatedAt}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

