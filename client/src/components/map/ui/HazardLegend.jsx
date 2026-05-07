import { useState, useEffect } from "react";
import {
  Droplets,
  Wind,
  Mountain,
  Activity,
  MapPin,
  FileWarning,
} from "lucide-react";

// ── Legend definitions ────────────────────────────────────────────────────

const FLOOD_LEGEND = {
  key: "flood",
  label: "Flood",
  Icon: Droplets,
  iconColor: "text-blue-500",
  note: "Phil-LiDAR terrain-based flood susceptibility",
  rows: [
    { color: "#dc2626", label: "High susceptibility zone" },
    { color: "#f97316", label: "Moderate susceptibility zone" },
    { color: "#3b82f6", label: "Low susceptibility zone" },
  ],
};

const TYPHOON_LEGEND = {
  key: "typhoon",
  label: "Typhoon",
  Icon: Wind,
  iconColor: "text-cyan-500",
  note: "GDACS data · PAGASA 2022 classification",
  rows: [
    { color: "#7c3aed", label: "Super Typhoon (STY) ≥185 km/h" },
    { color: "#dc2626", label: "Typhoon (TY) 118–184 km/h" },
    { color: "#f97316", label: "Severe Tropical Storm (STS) 89–117 km/h" },
    { color: "#f59e0b", label: "Tropical Storm (TS) 62–88 km/h" },
    { color: "#3b82f6", label: "Tropical Depression (TD) <62 km/h" },
  ],
};

const LANDSLIDE_LEGEND = {
  key: "landslide",
  label: "Landslide",
  Icon: Mountain,
  iconColor: "text-amber-500",
  note: "MGB susceptibility + Open-Meteo rainfall",
  rows: [
    { color: "#dc2626", label: "Critical — high susceptibility" },
    { color: "#f97316", label: "Warning — elevated risk" },
    { color: "#f59e0b", label: "Watch — monitor conditions" },
    { color: "#22c55e", label: "Low — below risk thresholds" },
  ],
};

const EARTHQUAKE_LEGEND = {
  key: "earthquake",
  label: "Earthquake",
  Icon: Activity,
  iconColor: "text-orange-500",
  note: "USGS Earthquake Hazards Program",
  rows: [
    { color: "#b91c1c", label: "M7.0+ Major" },
    { color: "#ef4444", label: "M6.0–6.9 Strong" },
    { color: "#f97316", label: "M5.0–5.9 Moderate" },
    { color: "#eab308", label: "M4.0–4.9 Light" },
    { color: "#06b6d4", label: "M3.0–3.9 Minor" },
    { color: "#6b7280", label: "M<3.0 Micro" },
  ],
};

const REPORTS_LEGEND = {
  key: "reports",
  label: "Reports",
  Icon: FileWarning,
  iconColor: "text-red-500",
  note: "Community emergency reports",
  rows: [
    { color: "#ef4444", label: "Rescue" },
    { color: "#06b6d4", label: "Flood" },
    { color: "#dc2626", label: "Fire" },
    { color: "#f97316", label: "Earthquake" },
    { color: "#8b5cf6", label: "Landslide" },
    { color: "#ec4899", label: "Medical" },
    { color: "#6b7280", label: "Other" },
  ],
};

const EVACUATION_LEGEND = {
  key: "evacuation",
  label: "Evacuation",
  Icon: MapPin,
  iconColor: "text-green-500",
  note: "Evacuation center occupancy status",
  rows: [
    { color: "#22c55e", label: "Active — accepting evacuees" },
    { color: "#f97316", label: "Near Full — 80%+ capacity" },
    { color: "#ef4444", label: "Full — at max capacity" },
    { color: "#94a3b8", label: "Vacant — not activated" },
  ],
};

const ALL_LEGENDS = [
  FLOOD_LEGEND,
  TYPHOON_LEGEND,
  LANDSLIDE_LEGEND,
  EARTHQUAKE_LEGEND,
  REPORTS_LEGEND,
  EVACUATION_LEGEND,
];

// ── HazardLegend ──────────────────────────────────────────────────────────
export default function HazardLegend({ activeLayers }) {
  const active = ALL_LEGENDS.filter((l) => activeLayers[l.key]);
  const [selectedKey, setSelectedKey] = useState(null);

  const activeKeyString = active.map((l) => l.key).join(",");
  useEffect(() => {
    if (active.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!active.find((l) => l.key === selectedKey))
      setSelectedKey(active[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeyString]);

  if (active.length === 0) return null;

  const compact = active.length >= 3;
  const selected = active.find((l) => l.key === selectedKey) ?? active[0];
  const isReports = selected.key === "reports";

  return (
    <div
      className="absolute bottom-6 left-3 z-[1000] pointer-events-auto"
      style={{ width: 224 }}
    >
      {/* Fixed-height box — tabs + scrollable content */}
      <div
        className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-md overflow-hidden flex flex-col"
        style={{ height: 160 }}
      >
        {/* Tab row */}
        <div className="flex border-b border-gray-100 shrink-0">
          {active.map(({ key, label, Icon, iconColor }) => {
            const isSelected = key === (selectedKey ?? active[0].key);
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                title={label}
                className={`flex-1 flex items-center justify-center gap-1
                            py-2 text-[10px] font-semibold transition-colors
                            border-b-2 -mb-px
                            ${
                              isSelected
                                ? "border-blue-500 text-gray-700 bg-white"
                                : "border-transparent text-gray-400 bg-gray-50 hover:text-gray-600 hover:bg-white"
                            }`}
              >
                <Icon
                  size={12}
                  strokeWidth={2}
                  className={isSelected ? iconColor : "text-gray-400"}
                />
                {!compact && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </div>

        {/* Scrollable legend body */}
        <div className="flex-1 overflow-y-auto px-3 py-2.5">
          {/* Layer header */}
          <div className="flex items-center gap-1.5 mb-1">
            <selected.Icon
              size={11}
              strokeWidth={2}
              className={selected.iconColor}
            />
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
              {selected.label}
            </p>
          </div>

          {selected.note && (
            <p className="text-[9px] text-gray-400 mb-2 leading-tight">
              {selected.note}
            </p>
          )}

          {/* Rows — 2-column for Reports, single-column for everything else */}
          <div
            className={
              isReports
                ? "grid grid-cols-2 gap-x-3 gap-y-1.5"
                : "flex flex-col gap-1.5"
            }
          >
            {selected.rows.map((row) => (
              <div key={row.label} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-[10px] text-gray-600 leading-snug">
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
