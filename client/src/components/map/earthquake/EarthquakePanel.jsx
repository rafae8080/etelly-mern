// client/src/components/map/earthquake/EarthquakePanel.jsx
import { useState } from "react";
import { Activity, ChevronDown, Settings, RefreshCw } from "lucide-react";

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

export default function EarthquakePanel({
  visible,
  isOpen,
  onToggle,
  onFilterChange,
  onRefresh,
  lastUpdated,
}) {
  const [filters, setFilters] = useState({
    timeRange: "week",
    minMagnitude: 2.5,
    region: "philippines",
    limit: 100,
  });

  const [showSettings, setShowSettings] = useState(false);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Convert timeRange to actual date
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

  return (
    <>
      {/* Main Button */}
      <button
        onClick={onToggle}
        className="absolute z-[1000] w-[30px] h-[30px] bg-white border border-gray-300 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
        style={{ left: 10, top: "210px", position: "absolute" }}
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
          className="absolute z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-4"
          style={{ left: 50, top: "210px", minWidth: "280px" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-orange-500" />
              <h3 className="font-semibold text-gray-900">
                Earthquake Tracker
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onRefresh?.();
                  onFilterChange?.(filters);
                }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Refresh data"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 hover:bg-gray-100 rounded"
                title="Settings"
              >
                {showSettings ? (
                  <ChevronDown size={14} />
                ) : (
                  <Settings size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-orange-50 rounded-lg p-2">
              <p className="text-xs text-orange-600">Source</p>
              <p className="text-sm font-semibold">USGS</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-xs text-blue-600">Region</p>
              <p className="text-sm font-semibold">
                {filters.region === "philippines" ? "Philippines" : "Global"}
              </p>
            </div>
          </div>

          {lastUpdated && (
            <p className="text-xs text-gray-500 mb-3">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="space-y-3 pt-3 border-t border-gray-200">
              {/* Time Range */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Time Range
                </label>
                <select
                  value={filters.timeRange}
                  onChange={(e) =>
                    handleFilterChange("timeRange", e.target.value)
                  }
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  {TIME_RANGES.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Minimum Magnitude */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Minimum Magnitude
                </label>
                <select
                  value={filters.minMagnitude}
                  onChange={(e) =>
                    handleFilterChange(
                      "minMagnitude",
                      parseFloat(e.target.value),
                    )
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

              {/* Region Toggle */}
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
                    Limit to Philippines only
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Magnitude Scale
            </p>
            <div className="space-y-1">
              <LegendItem color="#b91c1c" label="7.0+ (Major)" />
              <LegendItem color="#ef4444" label="6.0-6.9 (Strong)" />
              <LegendItem color="#f97316" label="5.0-5.9 (Moderate)" />
              <LegendItem color="#eab308" label="4.0-4.9 (Light)" />
              <LegendItem color="#06b6d4" label="3.0-3.9 (Minor)" />
              <LegendItem color="#6b7280" label="<3.0 (Micro)" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}
