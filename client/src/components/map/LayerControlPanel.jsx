import { Waves, Mountain, Flame, MapPin, CircleDot } from "lucide-react";

const LAYERS = [
  {
    key: "flood",
    label: "Flood Hazard",
    Icon: Waves,
    activeColor: "bg-blue-500",
    ring: "ring-blue-400",
  },
  {
    key: "earthquake",
    label: "Earthquake",
    Icon: CircleDot,
    activeColor: "bg-red-500",
    ring: "ring-red-400",
    disabled: true,
  },
  {
    key: "fire",
    label: "Fire Hotspots",
    Icon: Flame,
    activeColor: "bg-orange-500",
    ring: "ring-orange-400",
    disabled: true,
  },
  {
    key: "landslide",
    label: "Landslide",
    Icon: Mountain,
    activeColor: "bg-yellow-600",
    ring: "ring-yellow-400",
    disabled: true,
  },
  {
    key: "reports",
    label: "Live Reports",
    Icon: MapPin,
    activeColor: "bg-purple-500",
    ring: "ring-purple-400",
    disabled: true,
  },
];

const BASEMAPS = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "satellite", label: "Satellite" },
  { key: "topo", label: "Topo" },
];

const LayerControlPanel = ({
  layers,
  onToggleLayer,
  basemap,
  onBasemapChange,
}) => {
  return (
    <div
      className="absolute top-[72px] right-4 z-[1000] w-52
                    bg-white/95 backdrop-blur border border-gray-200
                    rounded-2xl shadow-lg overflow-hidden"
    >
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
          Layers
        </p>
      </div>

      <div className="px-3 py-2 flex flex-col gap-1">
        {LAYERS.map(({ key, label, Icon, activeColor, ring, disabled }) => {
          const isOn = layers[key];
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => !disabled && onToggleLayer(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl
                          text-left transition-all duration-150
                          ${
                            disabled
                              ? "opacity-40 cursor-not-allowed"
                              : isOn
                                ? `bg-gray-100 ring-1 ${ring}`
                                : "hover:bg-gray-50 cursor-pointer"
                          }`}
            >
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 transition-all
                              ${!disabled && isOn ? activeColor : "bg-gray-300"}`}
              />

              {/* ← Render Icon as a component, not a value */}
              <Icon
                size={13}
                strokeWidth={1.8}
                className={`flex-shrink-0 ${
                  !disabled && isOn ? "text-gray-700" : "text-gray-400"
                }`}
              />

              <span className="flex-1 text-gray-600 text-xs font-medium">
                {label}
              </span>

              {disabled && (
                <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-100 px-4 pt-2 pb-3">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
          Basemap
        </p>
        <div className="grid grid-cols-2 gap-1">
          {BASEMAPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onBasemapChange(key)}
              className={`text-xs py-1.5 rounded-lg transition-all font-medium
                          ${
                            basemap === key
                              ? "bg-gray-200 text-gray-800"
                              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LayerControlPanel;
