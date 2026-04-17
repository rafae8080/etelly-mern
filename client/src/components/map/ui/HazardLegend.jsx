import { useState, useEffect } from "react";
import { Droplets, Wind, Mountain } from "lucide-react";

// ── Legend definitions ────────────────────────────────────────────────────

const FLOOD_LEGEND = {
  key: "flood",
  label: "Flood",
  Icon: Droplets,
  iconColor: "text-blue-500",
  rows: [
    { color: "#dc2626", label: "High risk" },
    { color: "#f97316", label: "Moderate risk" },
    { color: "#3b82f6", label: "Low risk" },
  ],
};

const TYPHOON_LEGEND = {
  key: "typhoon",
  label: "Typhoon",
  Icon: Wind,
  iconColor: "text-cyan-500",
  rows: [
    { color: "#7c3aed", label: "Super Typhoon (≥220 km/h)" },
    { color: "#dc2626", label: "Typhoon (≥118 km/h)" },
    { color: "#f97316", label: "Severe Tropical Storm" },
    { color: "#f59e0b", label: "Tropical Storm" },
    { color: "#3b82f6", label: "Tropical Depression" },
  ],
};

const LANDSLIDE_LEGEND = {
  key: "landslide",
  label: "Landslide",
  Icon: Mountain,
  iconColor: "text-amber-500",
  rows: [
    {
      color: "#dc2626",
      label: "Critical — heavy rain + saturated soil on high-risk slope",
    },
    {
      color: "#f97316",
      label: "Warning — rain threshold or soil saturation exceeded",
    },
    { color: "#f59e0b", label: "Watch — some rainfall on susceptible slope" },
    { color: "#22c55e", label: "Low — below trigger threshold" },
  ],
};

const ALL_LEGENDS = [FLOOD_LEGEND, TYPHOON_LEGEND, LANDSLIDE_LEGEND];

// ── HazardLegend ──────────────────────────────────────────────────────────
export default function HazardLegend({ activeLayers }) {
  const active = ALL_LEGENDS.filter((l) => activeLayers[l.key]);
  const [selectedKey, setSelectedKey] = useState(null);

  // Keep selected tab valid: snap to first active whenever the set changes
  const activeKeyString = active.map((l) => l.key).join(",");
  useEffect(() => {
    if (active.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!active.find((l) => l.key === selectedKey)) {
      setSelectedKey(active[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKeyString]);

  if (active.length === 0) return null;

  const compact = active.length >= 3;
  const selected = active.find((l) => l.key === selectedKey) ?? active[0];

  return (
    <div
      className="absolute bottom-6 left-3 z-[1000] pointer-events-auto"
      style={{ width: 185 }}
    >
      <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-md overflow-hidden">
        {/* ── Tab row ── */}
        <div className="flex border-b border-gray-100">
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
                  size={11}
                  strokeWidth={2}
                  className={isSelected ? iconColor : "text-gray-400"}
                />
                {/* Show text label only when fewer than 3 layers active */}
                {!compact && <span className="truncate">{label}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Legend body for selected tab ── */}
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
            <selected.Icon
              size={9}
              strokeWidth={2}
              className={selected.iconColor}
            />
            {selected.label} Legend
          </p>
          {selected.rows.map((row) => (
            <div key={row.label} className="flex items-start gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 mt-[1px]"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-[9px] text-gray-500 leading-snug">
                {row.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
