/**
 * HazardMapPage.jsx — updated excerpt
 *
 * Changes from original:
 *  1. Imports useAlerts hook → counts active alerts
 *  2. Adds an alert badge on the Alerts nav link / page header
 *  3. FloodForecastPanel river threshold changes now reflected immediately
 *     (the alert engine handles persistence; map just shows current state)
 *
 * Only the additions/changes are shown below — merge them into your
 * existing HazardMapPage.jsx.
 *
 * ─── ADD these imports at the top of HazardMapPage.jsx ───────────────────────
 */

// ADD to your existing imports:
import { useAlerts } from "../hooks/useAlerts";

/**
 * ─── ADD inside the HazardMapPage component body ─────────────────────────────
 *
 * Place this line alongside your other useState/useEffect declarations:
 */

//   const { counts: alertCounts } = useAlerts();

/**
 * ─── REPLACE the title bar section with this ─────────────────────────────────
 *
 * This adds a live alert badge next to the page title.
 * The badge turns red when there are evacuate/critical alerts.
 */

export function HazardMapTitleBar({
  cityName,
  offlineInfo,
  formatDateTime,
  formatTime,
  now,
  alertCounts,
}) {
  const hasCritical =
    (alertCounts?.evacuate ?? 0) + (alertCounts?.critical ?? 0) > 0;
  const hasWarning = alertCounts?.warning > 0;

  return (
    <div className="mb-4 flex items-center justify-between flex-shrink-0">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Hazard Map</h1>

          {/* Live alert badge — only shown when alerts exist */}
          {alertCounts?.total > 0 && (
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5
                          ${
                            hasCritical
                              ? "bg-red-600 text-white animate-pulse"
                              : hasWarning
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                          }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${hasCritical ? "bg-white" : "bg-current"}`}
              />
              {alertCounts.total} active alert
              {alertCounts.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-500 mt-0.5">
          {cityName} — Disaster Preparedness Viewer
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
  );
}

/**
 * ─── Full updated HazardMapPage (complete file, replaces original) ────────────
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMap } from "react-leaflet";
import { Crosshair, Map, Bell } from "lucide-react";

import BaseMap from "../components/map/core/BaseMap";
import LayerControlPanel from "../components/map/core/LayerControlPanel";
import MapStatusBar from "../components/map/core/MapStatusBar";

import FloodLayer, {
  UserLocationMarker,
} from "../components/map/flood/FloodLayer";
import FloodHazardLayer from "../components/map/flood/FloodHazardLayer";
import FloodForecastPanel from "../components/map/flood/FloodForecastPanel";

import TyphoonLayer, {
  TyphoonPanel,
} from "../components/map/typhoon/TyphoonLayer";

import LandslideForecastPanel from "../components/map/landslide/LandslideForecastPanel";
import LandslideLayer, {
  LandslideHazardLayer,
} from "../components/map/landslide/LandslideLayer";

import HazardLegend from "../components/map/ui/HazardLegend";
import BasemapPicker from "../components/map/ui/BasemapPicker";
import OfflineBanner from "../components/map/ui/OfflineBanner";

const CITY_CENTER = [14.5882, 121.1763];
const CITY_NAME = "Antipolo City, Rizal";
const CITY_ZOOM = 13;

const STACK_TOP = 90;
const STACK_STEP = 40;

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
      map.invalidateSize();
      const timer = setTimeout(() => map.invalidateSize(), 1300);
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

  // ── NEW: live alert counts for the badge ──────────────────────────────────
  const { counts: alertCounts } = useAlerts();

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

  const attribution = useMemo(() => buildAttribution(layers), [layers]);

  // Badge helpers
  const hasCritical =
    (alertCounts?.evacuate ?? 0) + (alertCounts?.critical ?? 0) > 0;
  const hasWarning = alertCounts?.warning > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ── Title bar with alert badge ── */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Hazard Map</h1>

            {/* ── NEW: Alert badge ── */}
            {alertCounts?.total > 0 && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full
                             flex items-center gap-1.5
                             ${
                               hasCritical
                                 ? "bg-red-600 text-white animate-pulse"
                                 : hasWarning
                                   ? "bg-amber-100 text-amber-700"
                                   : "bg-blue-50 text-blue-700"
                             }`}
              >
                <Bell size={11} />
                {alertCounts.total} alert{alertCounts.total !== 1 ? "s" : ""}
              </span>
            )}
          </div>

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

      {/* ── Map wrapper ── */}
      <div
        className="relative flex-1 rounded-2xl overflow-hidden
                      border border-gray-200 shadow-lg min-h-[500px]"
      >
        {loading && (
          <div className="absolute inset-0 z-[2000] bg-white flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm font-medium">
              Loading hazard map…
            </p>
          </div>
        )}

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

        {offlineInfo.isOffline && (
          <OfflineBanner
            cachedAt={offlineInfo.cachedAt}
            onRefresh={() => window.location.reload()}
          />
        )}

        {/* City badge */}
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

        {layers.flood && (
          <FloodForecastPanel
            visible={layers.flood}
            isOpen={activePopup === "forecast"}
            onToggle={() => togglePopup("forecast")}
            topStyle={btnStyle("forecast")}
            onOfflineChange={handleOfflineChange}
          />
        )}

        {layers.typhoon && (
          <TyphoonPanel
            visible={layers.typhoon}
            isOpen={activePopup === "typhoon"}
            onToggle={() => togglePopup("typhoon")}
            topStyle={btnStyle("typhoon")}
            onOfflineChange={handleOfflineChange}
          />
        )}

        {layers.landslide && (
          <LandslideForecastPanel
            visible={layers.landslide}
            isOpen={activePopup === "landslide"}
            onToggle={() => togglePopup("landslide")}
            topStyle={btnStyle("landslide")}
            onOfflineChange={handleOfflineChange}
          />
        )}

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

        <LayerControlPanel layers={layers} onToggleLayer={toggleLayer} />
        <HazardLegend activeLayers={layers} />
      </div>
    </div>
  );
}
