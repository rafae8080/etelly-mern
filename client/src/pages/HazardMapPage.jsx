import { useState, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { Crosshair } from "lucide-react";
import BaseMap from "../components/map/BaseMap";
import MapStatusBar from "../components/map/MapStatusBar";
import FloodLayer, { UserLocationMarker } from "../components/map/FloodLayer";
import FloodHazardLayer from "../components/map/FloodHazardLayer";
import FloodForecastPanel from "../components/map/FloodForecastPanel";
import LayerControlPanel from "../components/map/LayerControlPanel";
import HazardLegend from "../components/map/HazardLegend";

const CITY_CENTER = [14.664, 120.9422];
const CITY_NAME = "Navotas, Metro Manila";
const CITY_ZOOM = 14;

function MapReadyHandler({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const t = setTimeout(onReady, 800);
    return () => clearTimeout(t);
  }, [map, onReady]);
  return null;
}

function FlyToUser({ trigger, userPos }) {
  const map = useMap();
  const prevTrigger = useRef(0);

  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    if (userPos) map.flyTo(userPos, 17, { duration: 1.2 });
  }, [trigger, userPos, map]);

  return null;
}

const INITIAL_LAYERS = {
  flood: true,
  earthquake: false,
  fire: false,
  landslide: false,
  reports: false,
};

export default function HazardMapPage() {
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [basemap, setBasemap] = useState("light");
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState(null);
  const [flyTrigger, setFlyTrigger] = useState(0);

  const toggleLayer = (key) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleRecenter = () => {
    if (userPos) setFlyTrigger((n) => n + 1);
  };

  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hazard Map</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {CITY_NAME} — Disaster Preparedness Viewer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-slate-600">
            {activeCount} layer{activeCount !== 1 ? "s" : ""} active
          </span>
        </div>
      </div>

      {/* Map wrapper */}
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-gray-200 shadow-lg min-h-[500px]">
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-[2000] bg-white flex flex-col
                          items-center justify-center gap-3"
          >
            <div
              className="w-10 h-10 border-2 border-blue-500
                            border-t-transparent rounded-full animate-spin"
            />
            <p className="text-gray-400 text-sm font-medium">
              Loading hazard map…
            </p>
          </div>
        )}

        {/* Leaflet map */}
        <BaseMap tileVariant={basemap} center={CITY_CENTER} zoom={CITY_ZOOM}>
          {/* Flood WMS hazard layer */}
          <FloodHazardLayer visible={layers.flood} />

          {/* Crowdsourced report circles — future use */}
          <FloodLayer visible={false} />

          {/* User location dot */}
          <UserLocationMarker onLocated={setUserPos} />

          {/* Fly to user on recenter press */}
          <FlyToUser trigger={flyTrigger} userPos={userPos} />

          <MapStatusBar />
          <MapReadyHandler onReady={() => setLoading(false)} />
        </BaseMap>

        {/* ── Floating UI panels ── */}

        {/* Top-left city badge */}
        <div
          className="absolute top-4 right-4 z-[1000]
                        bg-white/90 backdrop-blur border border-gray-200
                        rounded-xl px-3 py-2 flex items-center gap-2
                        shadow-sm pointer-events-none"
        >
          <span className="text-lg">🇵🇭</span>
          <div>
            <p className="text-gray-800 text-xs font-bold leading-none">
              {CITY_NAME}
            </p>
            <p className="text-gray-400 text-[10px] mt-0.5 leading-none">
              PAGASA · NOAH · USGS
            </p>
          </div>
        </div>

        {/* Recenter button — below zoom controls top-left */}
        <button
          onClick={handleRecenter}
          title="Go to my location"
          className={`absolute top-[90px] left-[10px] z-[1000]
                      w-[30px] h-[30px] bg-white border border-gray-300
                      flex items-center justify-center shadow-sm
                      hover:bg-gray-50 transition-colors
                      ${
                        userPos
                          ? "cursor-pointer"
                          : "opacity-40 cursor-not-allowed"
                      }`}
        >
          <Crosshair
            size={16}
            className={userPos ? "text-blue-500" : "text-gray-400"}
            strokeWidth={1.8}
          />
        </button>

        {/* Layer control panel — top right */}
        <LayerControlPanel
          layers={layers}
          onToggleLayer={toggleLayer}
          basemap={basemap}
          onBasemapChange={setBasemap}
        />

        {/* Flood legend — bottom left */}
        <HazardLegend activeLayers={layers} />

        {/* Flood forecast panel — bottom right */}
        <FloodForecastPanel visible={layers.flood} />
      </div>
    </div>
  );
}
