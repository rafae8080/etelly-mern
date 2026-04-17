import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMap } from "react-leaflet";
import { Crosshair, Map, Droplets } from "lucide-react";

// core
import BaseMap from "../components/map/core/BaseMap";
import LayerControlPanel from "../components/map/core/LayerControlPanel";
import MapStatusBar from "../components/map/core/MapStatusBar";

// flood
import FloodLayer, {
  UserLocationMarker,
} from "../components/map/flood/FloodLayer";
import FloodHazardLayer from "../components/map/flood/FloodHazardLayer";
import FloodForecastPanel from "../components/map/flood/FloodForecastPanel";

// typhoon
import TyphoonLayer, {
  TyphoonPanel,
} from "../components/map/typhoon/TyphoonLayer";

import LandslideForecastPanel from "../components/map/landslide/LandslideForecastPanel";
import LandslideLayer, {
  LandslideHazardLayer,
} from "../components/map/landslide/LandslideLayer";

// ui
import HazardLegend from "../components/map/ui/HazardLegend";
import BasemapPicker from "../components/map/ui/BasemapPicker";
import OfflineBanner from "../components/map/ui/OfflineBanner";

const CITY_CENTER = [14.5882, 121.1763];
const CITY_NAME = "Antipolo City, Rizal";
const CITY_ZOOM = 13;

// Each button slot is 30px tall + 10px gap = 40px step
const STACK_TOP = 90; // px from map top where stack starts (below leaflet +/- zoom)
const STACK_STEP = 40; // px per button slot

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

    if (userPos) {
      map.flyTo(userPos, 17, { duration: 1.2 });

      // Force Leaflet to refresh tiles/vectors after the flight begins
      // and again once it finishes to ensure nothing "disappears"
      map.invalidateSize();

      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 1300); // slightly longer than the 1.2s duration

      return () => clearTimeout(timer);
    }
  }, [trigger, userPos, map]);

  return null;
}

const INITIAL_LAYERS = {
  flood: false,
  earthquake: false,
  typhoon: false,
  fire: false,
  landslide: false,
  reports: false,
};

function buildAttribution(layers) {
  // Use a Set to store unique sources automatically
  const sources = new Set();

  if (layers.flood) {
    sources.add("Open-Meteo");
    sources.add("GloFAS");
  }

  if (layers.typhoon) {
    sources.add("PAGASA");
    sources.add("GDACS");
  }

  if (layers.landslide) {
    sources.add("Open-Meteo");
    sources.add("MGB");
  }

  // Convert Set back to array and join with dots
  return Array.from(sources).join(" · ");
}

export default function HazardMapPage() {
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [basemap, setBasemap] = useState("light");
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState(null);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const [activePopup, setActivePopup] = useState(null);
  const [offlineInfo, setOfflineInfo] = useState({
    isOffline: false,
    cachedAt: null,
  });

  const togglePopup = (name) =>
    setActivePopup((cur) => (cur === name ? null : name));

  const toggleLayer = (key) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleRecenter = () => {
    if (userPos) setFlyTrigger((n) => n + 1);
  };

  const handleOfflineChange = useCallback(({ isOffline, cachedAt }) => {
    setOfflineInfo((prev) => {
      if (prev.isOffline === isOffline && prev.cachedAt === cachedAt)
        return prev;
      return { isOffline, cachedAt };
    });
  }, []);

  // Live clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (d) =>
    d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const formatDateTime = (ts) => {
    if (!ts) return "unknown";
    const d = new Date(ts);
    return (
      d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
    );
  };

  // ── Dynamic button stack ──────────────────────────────────────────────────
  const buttonStack = useMemo(() => {
    const stack = ["basemap", "recenter"];
    if (layers.flood) stack.push("forecast");
    if (layers.typhoon) stack.push("typhoon");
    if (layers.landslide) stack.push("landslide");
    return stack;
  }, [layers.flood, layers.typhoon, layers.landslide]);

  const btnStyle = useCallback(
    (key) => {
      const idx = buttonStack.indexOf(key);
      if (idx === -1) return { display: "none" };
      return { top: `${STACK_TOP + idx * STACK_STEP}px` };
    },
    [buttonStack],
  );

  // Dynamic attribution string based on active layers
  const attribution = useMemo(() => buildAttribution(layers), [layers]);

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
          {offlineInfo.isOffline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-sm text-amber-600">
                Last update:{" "}
                <span className="font-semibold">
                  {formatDateTime(offlineInfo.cachedAt)}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm text-slate-600 tabular-nums">
                {formatTime(now)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Map wrapper */}
      <div
        className="relative flex-1 rounded-2xl overflow-hidden
                      border border-gray-200 shadow-lg min-h-[500px]"
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[2000] bg-white flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm font-medium">
              Loading hazard map…
            </p>
          </div>
        )}

        {/* ── Leaflet map ── */}
        <BaseMap tileVariant={basemap} center={CITY_CENTER} zoom={CITY_ZOOM}>
          <FloodHazardLayer key="flood-haz" visible={layers.flood} />
          <TyphoonLayer key="typhoon" visible={layers.typhoon} />
          <LandslideHazardLayer
            key="landslide-haz"
            visible={layers.landslide}
          />
          <LandslideLayer key="landslide" visible={layers.landslide} />
          <UserLocationMarker onLocated={setUserPos} />
          <FlyToUser trigger={flyTrigger} userPos={userPos} />
          <MapStatusBar />
          <MapReadyHandler onReady={() => setLoading(false)} />
        </BaseMap>

        {/* ── Floating UI ── */}

        {/* Offline banner */}
        {offlineInfo.isOffline && (
          <OfflineBanner
            cachedAt={offlineInfo.cachedAt}
            onRefresh={() => window.location.reload()}
          />
        )}

        {/* City badge — top right — attribution updates with active layers */}
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
              {attribution}
            </p>
          </div>
        </div>

        {/* ── LEFT BUTTON STACK ── */}

        {/* 1. Basemap picker — always visible */}
        <button
          onClick={() => togglePopup("basemap")}
          title="Change basemap"
          style={{ ...btnStyle("basemap"), left: 10, position: "absolute" }}
          className={`z-[1000] w-[30px] h-[30px] border flex items-center justify-center
                      shadow-sm hover:bg-gray-50 transition-colors
                      ${activePopup === "basemap" ? "bg-blue-50 border-blue-400" : "bg-white border-gray-300"}`}
        >
          <Map
            size={15}
            strokeWidth={1.8}
            className={
              activePopup === "basemap" ? "text-blue-500" : "text-gray-500"
            }
          />
        </button>

        {/* 2. Recenter — always visible, disabled until location found */}
        <button
          onClick={handleRecenter}
          title="Go to my location"
          style={{ ...btnStyle("recenter"), left: 10, position: "absolute" }}
          className={`z-[1000] w-[30px] h-[30px] bg-white border border-gray-300
                      flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors
                      ${userPos ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
        >
          <Crosshair
            size={16}
            strokeWidth={1.8}
            className={userPos ? "text-blue-500" : "text-gray-400"}
          />
        </button>

        {/* 3. Flood forecast */}
        {layers.flood && (
          <FloodForecastPanel
            visible={layers.flood}
            isOpen={activePopup === "forecast"}
            onToggle={() => togglePopup("forecast")}
            topStyle={btnStyle("forecast")}
            onOfflineChange={handleOfflineChange}
          />
        )}

        {/* 4. Typhoon tracker */}
        {layers.typhoon && (
          <TyphoonPanel
            visible={layers.typhoon}
            isOpen={activePopup === "typhoon"}
            onToggle={() => togglePopup("typhoon")}
            topStyle={btnStyle("typhoon")}
            onOfflineChange={handleOfflineChange}
          />
        )}

        {/* 5. Landslide forecast */}
        {layers.landslide && (
          <LandslideForecastPanel
            visible={layers.landslide}
            isOpen={activePopup === "landslide"}
            onToggle={() => togglePopup("landslide")}
            topStyle={btnStyle("landslide")}
            onOfflineChange={handleOfflineChange}
          />
        )}

        {/* Basemap picker popup */}
        {activePopup === "basemap" && (
          <BasemapPicker
            active={basemap}
            onChange={(key) => {
              setBasemap(key);
              setActivePopup(null);
            }}
            onClose={() => setActivePopup(null)}
          />
        )}

        {/* Layer control panel — top right */}
        <LayerControlPanel layers={layers} onToggleLayer={toggleLayer} />

        {/* Hazard legend — bottom left */}
        <HazardLegend activeLayers={layers} />
      </div>
    </div>
  );
}
