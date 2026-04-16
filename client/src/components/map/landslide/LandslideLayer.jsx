import { useEffect, useState } from "react";
import { CircleMarker, Popup, WMSTileLayer } from "react-leaflet";

const PHIL_GEOPORTAL_WMS_URL =
  "https://geoserver.geoportal.gov.ph/geoserver/geoportal/wms";

const RISK_CONFIG = {
  Critical: {
    color: "#dc2626",
    fillColor: "#ef4444",
    label: "Critical Risk",
    radius: 20,
  },
  Warning: {
    color: "#d97706",
    fillColor: "#f97316",
    label: "Warning — Elevated",
    radius: 16,
  },
  Watch: {
    color: "#ca8a04",
    fillColor: "#f59e0b",
    label: "Watch — Monitor",
    radius: 12,
  },
  Low: { color: "#15803d", fillColor: "#22c55e", label: "Low Risk", radius: 9 },
};

// ── LandslideHazardLayer — ONLY the WMS tile (lives inside MapContainer) ─
// Keep this separate from LandslideLayer so WMS tile updates never trigger
// a re-render of the CircleMarkers and vice versa.
export const LandslideHazardLayer = ({ visible }) => {
  if (!visible) return null;

  return (
    <WMSTileLayer
      url={PHIL_GEOPORTAL_WMS_URL}
      layers="landslide10ksusceptibility"
      format="image/png"
      transparent={true}
      opacity={0.4}
      version="1.1.1"
      attribution='&copy; <a href="https://geoportal.gov.ph">Philippine Geoportal / MGB</a>'
    />
  );
};

// ── LandslideLayer — ONLY the live CircleMarkers (lives inside MapContainer)
const LandslideLayer = ({ visible }) => {
  const [zones, setZones] = useState([]);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    fetch("/api/hazard/landslide")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setZones(data.zones ?? []);
          setCurrent(data.current ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn("LandslideLayer:", err.message); // ← add the guard here
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {zones.map((zone, idx) => {
        const riskLabel = zone.riskAssessment?.label ?? "Low";
        const cfg = RISK_CONFIG[riskLabel] ?? RISK_CONFIG.Low;

        if (riskLabel === "Low") return null;

        return (
          <CircleMarker
            key={idx}
            center={[zone.lat, zone.lng]}
            radius={cfg.radius}
            pathOptions={{
              color: cfg.color,
              fillColor: cfg.fillColor,
              fillOpacity: 0.55,
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[180px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span>⛰️</span>
                  <span className="font-semibold text-sm text-gray-800">
                    {zone.name}
                  </span>
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: cfg.fillColor }}
                >
                  {cfg.label}
                </span>

                {current && (
                  <div className="mt-2 flex flex-col gap-0.5 text-xs text-gray-500">
                    <p>
                      🌧️ Rainfall (24h):{" "}
                      <span className="font-semibold text-gray-700">
                        {current.rainfall24h?.toFixed(1)} mm
                      </span>
                    </p>
                    <p>
                      🌧️ Rainfall (72h):{" "}
                      <span className="font-semibold text-gray-700">
                        {current.rainfall72h?.toFixed(1)} mm
                      </span>
                    </p>
                    <p>
                      💧 Soil moisture:{" "}
                      <span
                        className={`font-semibold ${current.soilSaturated ? "text-red-600" : "text-gray-700"}`}
                      >
                        {current.soilMoisture?.toFixed(3)} m³/m³
                        {current.soilSaturated ? " — Saturated" : ""}
                      </span>
                    </p>
                    <p>
                      🗺️ MGB susceptibility:{" "}
                      <span className="font-semibold text-gray-700">
                        {zone.risk === 3
                          ? "High"
                          : zone.risk === 2
                            ? "Moderate"
                            : "Low"}
                      </span>
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-gray-400 mt-2">
                  Open-Meteo · MGB / Philippine Geoportal
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default LandslideLayer;
