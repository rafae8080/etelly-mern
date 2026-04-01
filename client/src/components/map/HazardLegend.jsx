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

const HazardLegend = ({ activeLayers }) => {
  if (!activeLayers?.flood) return null;

  return (
    <div
      className="absolute bottom-12 left-4 z-[1000]
                    bg-white/95 backdrop-blur border border-gray-200
                    rounded-2xl shadow-lg px-4 py-3 min-w-[190px]"
    >
      <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
        Flood Hazard
      </p>
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
      <p className="text-[9px] text-gray-300 mt-2 border-t border-gray-100 pt-2">
        Source: Phil-LiDAR 1 / UP DREAM · LiPAD FMC
      </p>
    </div>
  );
};

export default HazardLegend;
