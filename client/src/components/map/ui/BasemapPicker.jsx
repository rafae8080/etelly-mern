import { Map, X } from "lucide-react";

const BASEMAPS = [
  { key: "light", label: "Light", description: "Clean street map" },
  { key: "dark", label: "Dark", description: "Dark contrast" },
  { key: "satellite", label: "Satellite", description: "Aerial imagery" },
  { key: "topo", label: "Topo", description: "Topographic" },
];

const PREVIEW_STYLES = {
  light: { bg: "#f1f5f9", road: "#cbd5e1", water: "#bfdbfe" },
  dark: { bg: "#1e293b", road: "#334155", water: "#1d4ed8" },
  satellite: { bg: "#166534", road: "#15803d", water: "#1e40af" },
  topo: { bg: "#fef9c3", road: "#a16207", water: "#7dd3fc" },
};

const BasemapPicker = ({ active, onChange, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-[1090]" onClick={onClose} />

      {/* Popup — z-[1100] puts it above everything including legend */}
      <div
        className="absolute top-[90px] left-[50px] z-[1100]
                   bg-white/98 backdrop-blur border border-gray-200
                   rounded-2xl shadow-2xl overflow-hidden w-52"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5
                        border-b border-gray-100"
        >
          <div className="flex items-center gap-1.5">
            <Map size={12} className="text-gray-400" />
            <span
              className="text-[10px] font-bold tracking-widest
                             text-gray-400 uppercase"
            >
              Basemap
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Grid of basemap options */}
        <div className="p-2 grid grid-cols-2 gap-1.5">
          {BASEMAPS.map(({ key, label, description }) => {
            const style = PREVIEW_STYLES[key];
            const isActive = active === key;

            return (
              <button
                key={key}
                onClick={() => onChange(key)}
                className={`flex flex-col rounded-xl overflow-hidden
                            border-2 transition-all text-left
                            ${
                              isActive
                                ? "border-blue-500 ring-1 ring-blue-300"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
              >
                {/* Mini map preview */}
                <div
                  className="h-12 w-full relative"
                  style={{ background: style.bg }}
                >
                  <div
                    className="absolute top-1/2 left-0 right-0 h-px"
                    style={{ background: style.road }}
                  />
                  <div
                    className="absolute top-0 bottom-0 left-1/3 w-px"
                    style={{ background: style.road }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-3 opacity-60"
                    style={{ background: style.water }}
                  />
                  {isActive && (
                    <div
                      className="absolute top-1 right-1 w-4 h-4
                                    bg-blue-500 rounded-full flex items-center
                                    justify-center"
                    >
                      <span className="text-white text-[8px]">✓</span>
                    </div>
                  )}
                </div>

                {/* Label */}
                <div className="px-2 py-1.5 bg-white">
                  <p className="text-[10px] font-semibold text-gray-700 leading-none">
                    {label}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-none">
                    {description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default BasemapPicker;
