import { useEffect, useState } from "react";
import { CircleMarker, Popup, useMap, Marker } from "react-leaflet";
import L from "leaflet";

const RISK_CONFIG = {
  3: { color: "#dc2626", fillColor: "#ef4444", label: "High Risk", radius: 18 },
  2: {
    color: "#d97706",
    fillColor: "#f59e0b",
    label: "Medium Risk",
    radius: 14,
  },
  1: { color: "#15803d", fillColor: "#22c55e", label: "Low Risk", radius: 10 },
};

const userDotIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;border-radius:50%;
                  background:#3b82f6;opacity:0.25;
                  animation:pulse-ring 1.5s ease-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                  width:12px;height:12px;border-radius:50%;
                  background:#3b82f6;border:2px solid white;
                  box-shadow:0 0 6px rgba(59,130,246,0.6);"></div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%   { transform: scale(0.5); opacity: 0.4; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    </style>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export const UserLocationMarker = ({ onLocated }) => {
  const [position, setPosition] = useState(null);
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        onLocated?.(coords);
      },
      (err) => console.warn("Geolocation:", err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map]);

  if (!position) return null;

  return (
    <Marker position={position} icon={userDotIcon}>
      <Popup>
        <div className="text-sm">
          <p className="font-semibold text-gray-800">📍 Your Location</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {position[0].toFixed(5)}°N, {position[1].toFixed(5)}°E
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

const FloodLayer = ({ visible }) => {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    fetch("/api/hazard/flood-zones")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setZones(data.zones ?? []);
      })
      .catch((err) => console.warn("FloodLayer:", err.message));

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible || zones.length === 0) return null;

  return (
    <>
      {zones.map((zone, idx) => {
        const cfg = RISK_CONFIG[zone.risk] ?? RISK_CONFIG[1];
        return (
          <CircleMarker
            key={idx}
            center={[zone.lat, zone.lng]}
            radius={cfg.radius}
            pathOptions={{
              color: cfg.color,
              fillColor: cfg.fillColor,
              fillOpacity: 0.5,
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <div className="flex items-center gap-2 mb-1">
                  <span>🌊</span>
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
                <p className="text-xs text-gray-400 mt-1">
                  Flood susceptibility zone — PAGASA/NOAH
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default FloodLayer;
