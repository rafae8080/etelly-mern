import { useState, useEffect } from "react";

const FLOOD_LEVELS = [
  {
    color: "#d73027",
    label: "High",
    description: "Depth > 1.5m — danger zone",
  },
  {
    color: "#fc8d59",
    label: "Medium",
    description: "Depth 0.5–1.5m — caution",
  },
  {
    color: "#fee090",
    label: "Low",
    description: "Depth 0.1–0.5m — watch area",
  },
];

const TYPHOON_LEVELS = [
  { color: "#7c3aed", label: "Super Typhoon", description: "Wind ≥ 220 km/h" },
  { color: "#dc2626", label: "Typhoon (TY)", description: "Wind 118–220 km/h" },
  {
    color: "#f97316",
    label: "Severe Tropical Storm",
    description: "Wind 89–117 km/h",
  },
  { color: "#f59e0b", label: "Tropical Storm", description: "Wind 62–88 km/h" },
  {
    color: "#3b82f6",
    label: "Tropical Depression",
    description: "Wind 35–61 km/h",
  },
];

const FloodContent = () => (
  <div>
    <div className="flex flex-col gap-2">
      {FLOOD_LEVELS.map(({ color, label, description }) => (
        <div key={label} className="flex items-start gap-2.5">
          <div
            className="w-3.5 h-3.5 rounded-sm mt-0.5 flex-shrink-0 border border-black/10"
            style={{ backgroundColor: color }}
          />
          <div>
            <p className="text-xs font-semibold text-gray-700 leading-none">
              {label}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
      ))}
    </div>
    <p className="text-[9px] text-gray-300 mt-3 border-t border-gray-100 pt-2">
      Source: Phil-LiDAR 1 / UP DREAM · LiPAD FMC
    </p>
  </div>
);

const TyphoonContent = () => (
  <div>
    <div className="flex flex-col gap-2">
      {TYPHOON_LEVELS.map(({ color, label, description }) => (
        <div key={label} className="flex items-start gap-2.5">
          <div
            className="w-3.5 h-3.5 rounded-full mt-0.5 flex-shrink-0 border-2 border-white"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 0 1px ${color}`,
            }}
          />
          <div>
            <p className="text-xs font-semibold text-gray-700 leading-none">
              {label}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
      ))}
    </div>
    <p className="text-[9px] text-gray-300 mt-3 border-t border-gray-100 pt-2">
      Source: GDACS · PAGASA classification
    </p>
  </div>
);

const HazardLegend = ({ activeLayers }) => {
  const hasFlood = activeLayers?.flood;
  const hasTyphoon = activeLayers?.typhoon;
  const bothActive = hasFlood && hasTyphoon;

  // Default active tab: whichever layer is on, flood takes priority
  const [activeTab, setActiveTab] = useState("flood");

  // When layers change, reset tab to a valid active one
  useEffect(() => {
    if (bothActive) return; // keep current tab
    if (hasFlood) setActiveTab("flood");
    else if (hasTyphoon) setActiveTab("typhoon");
  }, [hasFlood, hasTyphoon, bothActive]);

  if (!hasFlood && !hasTyphoon) return null;

  return (
    <div
      className="absolute bottom-12 left-4 z-[1000]
                    bg-white/95 backdrop-blur border border-gray-200
                    rounded-2xl shadow-lg overflow-hidden w-[210px]"
    >
      {/* Tab header — only shown when both layers active */}
      {bothActive && (
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("flood")}
            className={`flex-1 flex items-center justify-center gap-1.5
                        px-3 py-2.5 text-[10px] font-bold tracking-wider
                        uppercase transition-all duration-150
                        ${
                          activeTab === "flood"
                            ? "text-blue-600 bg-blue-50 border-b-2 border-blue-500"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        }`}
          >
            Flood
          </button>
          <button
            onClick={() => setActiveTab("typhoon")}
            className={`flex-1 flex items-center justify-center gap-1.5
                        px-3 py-2.5 text-[10px] font-bold tracking-wider
                        uppercase transition-all duration-150
                        ${
                          activeTab === "typhoon"
                            ? "text-purple-600 bg-purple-50 border-b-2 border-purple-500"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        }`}
          >
            <span>🌀</span> Typhoon
          </button>
        </div>
      )}

      {/* Single-layer header — shown when only one layer active */}
      {!bothActive && (
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            {hasFlood ? "🌊 Flood Hazard" : "🌀 Typhoon"}
          </p>
        </div>
      )}

      {/* Content — fixed height, scrollable, identical for both tabs */}
      <div className="px-4 py-3 overflow-y-auto h-[150px]">
        {bothActive && activeTab === "flood" && <FloodContent />}
        {bothActive && activeTab === "typhoon" && <TyphoonContent />}
        {!bothActive && hasFlood && <FloodContent />}
        {!bothActive && hasTyphoon && <TyphoonContent />}
      </div>
    </div>
  );
};

export default HazardLegend;
