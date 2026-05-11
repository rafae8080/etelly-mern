import { useEffect } from "react";
import { Polyline, Popup, Circle, Marker, CircleMarker } from "react-leaflet";
import { Wind, X, FlaskConical, WifiOff } from "lucide-react";
import L from "leaflet";
import { useOfflineCache } from "../../../hooks/useOfflineCache";

// ── Dev test mode ─────────────────────────────────────────────────────────
const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

const DEV_FAKE_STORM = {
  id: "dev-test-001",
  name: "TEST STORM (Dev Mode)",
  lat: 14.5,
  lon: 120.8,
  windKph: 150,
  windKnots: 81,
  category: { label: "Typhoon (TY)", color: "#dc2626", level: 4 },
  movement: 20,
  direction: 315,
  updatedAt: new Date().toISOString(),
  windRadiusKm: 100,
  forecastTrack: [
    { lat: 12.5, lon: 124.8, label: "previous position", trackdate: null, windKph: null, windGusts: null, category: null },
    { lat: 13.2, lon: 123.5, label: "previous position", trackdate: null, windKph: null, windGusts: null, category: null },
    { lat: 14.5, lon: 120.8, label: "07/05/2026 06:00:00", trackdate: "07/05/2026 06:00:00", windKph: 150, windGusts: 175, category: { label: "Typhoon (TY)", color: "#dc2626", level: 4 } },
    { lat: 15.2, lon: 119.0, label: "08/05/2026 06:00:00", trackdate: "08/05/2026 06:00:00", windKph: 130, windGusts: 155, category: { label: "Typhoon (TY)", color: "#dc2626", level: 4 } },
    { lat: 16.0, lon: 117.5, label: "09/05/2026 06:00:00", trackdate: "09/05/2026 06:00:00", windKph: 100, windGusts: 120, category: { label: "Severe Tropical Storm (STS)", color: "#f97316", level: 3 } },
  ],
};

// PAGASA 2022 category → Tailwind bg/text classes for UI cards
const CATEGORY_STYLE = {
  5: { bg: "bg-purple-50", text: "text-purple-700" },
  4: { bg: "bg-red-50",    text: "text-red-700"    },
  3: { bg: "bg-orange-50", text: "text-orange-700" },
  2: { bg: "bg-amber-50",  text: "text-amber-700"  },
  1: { bg: "bg-blue-50",   text: "text-blue-700"   },
  0: { bg: "bg-gray-50",   text: "text-gray-500"   },
};

// PAGASA 2022 category level → hex color for map primitives
const CATEGORY_COLORS = {
  5: "#7c3aed",
  4: "#dc2626",
  3: "#f97316",
  2: "#f59e0b",
  1: "#3b82f6",
  0: "#9ca3af",
};

// trackdate from GDACS is "DD/MM/YYYY HH:MM:SS" UTC — convert to Manila local time
function fmtDate(trackdate) {
  if (!trackdate) return "";
  const [datePart, timePart] = trackdate.split(" ");
  const [dd, mm, yyyy] = datePart.split("/");
  const d = new Date(`${yyyy}-${mm}-${dd}T${timePart}Z`);
  if (isNaN(d.getTime())) return trackdate;
  return (
    d.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short", month: "short", day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit", minute: "2-digit",
    })
  );
}

const createTyphoonIcon = (color, size = 28) =>
  new L.DivIcon({
    className: "",
    html: `
      <div style="width:${size}px;height:${size}px;border-radius:50%;
                  background:${color};border:3px solid white;
                  box-shadow:0 0 0 2px ${color},0 2px 8px rgba(0,0,0,0.4);
                  display:flex;align-items:center;justify-content:center;">
        <div style="width:${size * 0.35}px;height:${size * 0.35}px;border-radius:50%;
                    background:white;opacity:0.9;"></div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

// ── StormMapLayer — ONLY Leaflet primitives, no DOM UI ───────────────────
function StormMapLayer({ storm }) {
  const catColor = CATEGORY_COLORS[storm.category?.level ?? 0];
  const catStyle = CATEGORY_STYLE[storm.category?.level ?? 0];
  const icon = createTyphoonIcon(catColor);

  const timeAgo = (ts) => {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <>
      <Circle
        center={[storm.lat, storm.lon]}
        radius={storm.windRadiusKm * 1000}
        pathOptions={{
          color: catColor,
          fillColor: catColor,
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "6 4",
        }}
      />

      {storm.forecastTrack?.length >= 2 && (() => {
        const track = storm.forecastTrack;
        const splitIdx = track.findIndex((p) => p.label !== "previous position");
        const pastPts     = splitIdx > 0 ? track.slice(0, splitIdx + 1) : [];
        const forecastPts = splitIdx >= 0 ? track.slice(splitIdx) : track;

        return (
          <>
            {/* Past track — solid, dim */}
            {pastPts.length >= 2 && (
              <Polyline
                positions={pastPts.map((p) => [p.lat, p.lon])}
                pathOptions={{ color: "#9ca3af", weight: 2, opacity: 0.5 }}
              />
            )}

            {/* Forecast track — dashed, colored */}
            {forecastPts.length >= 2 && (
              <Polyline
                positions={forecastPts.map((p) => [p.lat, p.lon])}
                pathOptions={{ color: catColor, weight: 2.5, opacity: 0.9, dashArray: "8 4" }}
              />
            )}

            {/* Past position dots — small gray, clickable */}
            {track
              .filter((p) => p.label === "previous position")
              .map((p, i) => (
                <CircleMarker
                  key={`past-${i}`}
                  center={[p.lat, p.lon]}
                  radius={4}
                  pathOptions={{ color: "#6b7280", fillColor: "#9ca3af", fillOpacity: 0.8, weight: 1 }}
                >
                  <Popup>
                    <div className="min-w-[150px]">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Previous Position
                      </p>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Position</span>
                        <span className="font-mono text-gray-600 text-[10px]">
                          {p.lat.toFixed(1)}°N {p.lon.toFixed(1)}°E
                        </span>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

            {/* Forecast position dots — colored, clickable with popup */}
            {forecastPts.map((p, i) => {
              if (!p.trackdate) return null;
              const dotColor = p.category?.color ?? catColor;
              return (
                <CircleMarker
                  key={`fc-${i}`}
                  center={[p.lat, p.lon]}
                  radius={6}
                  pathOptions={{ color: "#fff", fillColor: dotColor, fillOpacity: 1, weight: 1.5 }}
                >
                  <Popup>
                    <div className="min-w-[170px]">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Forecast Position
                      </p>
                      <p className="text-xs font-bold text-gray-800 mb-2">
                        {fmtDate(p.trackdate)}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Category</span>
                          <span
                            className="font-bold text-[10px] px-1.5 py-0.5 rounded text-white"
                            style={{ background: dotColor }}
                          >
                            {p.category?.label ?? p.label}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Wind speed</span>
                          <span className="font-semibold text-gray-800">
                            {p.windKph} km/h ({Math.round(p.windKph / 1.852)} kt)
                          </span>
                        </div>
                        {p.windGusts && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Wind gusts</span>
                            <span className="text-gray-700">{p.windGusts} km/h</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Position</span>
                          <span className="font-mono text-gray-600 text-[10px]">
                            {p.lat}°N {p.lon}°E
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </>
        );
      })()}
      <Marker position={[storm.lat, storm.lon]} icon={icon}>
        <Popup>
          <div className="min-w-[200px]">
            {IS_DEV_MODE && (
              <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2 flex items-center gap-1.5">
                <FlaskConical size={10} className="text-yellow-600" />
                <span className="text-[9px] text-yellow-700 font-bold">
                  DEV TEST — Not a real storm
                </span>
              </div>
            )}
            <div
              className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg ${catStyle.bg}`}
            >
              <Wind size={14} className={catStyle.text} />
              <div>
                <p className={`text-sm font-bold ${catStyle.text}`}>
                  {storm.name}
                </p>
                <p className={`text-[10px] ${catStyle.text}`}>
                  {storm.category?.label ?? "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 px-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Wind speed</span>
                <span className="font-semibold text-gray-800">
                  {storm.windKph} km/h ({storm.windKnots} kt)
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Position</span>
                <span className="font-mono text-gray-700 text-[10px]">
                  {storm.lat.toFixed(1)}°N {storm.lon.toFixed(1)}°E
                </span>
              </div>
              {storm.movement && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Moving</span>
                  <span className="text-gray-700">
                    {storm.direction}° at {storm.movement} km/h
                  </span>
                </div>
              )}
              {storm.updatedAt && (
                <p className="text-[9px] text-gray-400 mt-1 border-t border-gray-100 pt-1">
                  GDACS advisory: {timeAgo(storm.updatedAt)} · PAGASA 2022
                </p>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

// ── NoStormContent — pure DOM, used inside TyphoonPanel ──────────────────
function NoStormContent() {
  return (
    <div className="flex flex-col">
      <div className="mx-3 mt-3 mb-2.5 rounded-xl px-3 py-2.5 bg-blue-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-blue-400" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            No Active Storms
          </p>
        </div>
        <p className="text-[10px] text-gray-500 leading-snug">
          No tropical cyclone currently within the Philippine Area of
          Responsibility (PAR).
        </p>
      </div>
      <div className="mx-3 mt-1 mb-3 border-t border-gray-100 pt-2 flex flex-col gap-1">
        <p className="text-[9px] font-semibold text-gray-400 mb-0.5">
          Data Sources
        </p>
        {[
          {
            label: "Storm data",
            href: "https://www.gdacs.org",
            text: "GDACS",
          },
          {
            label: "Classification",
            href: "https://bagong.pagasa.dost.gov.ph/tropical-cyclone/",
            text: "PAGASA 2022",
          },
        ].map(({ label, href, text }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[9px] text-gray-400">{label}</span>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-blue-500 hover:underline"
            >
              {text}
            </a>
          </div>
        ))}
        <p className="text-[9px] text-gray-300 mt-1">
          Updates every 30 min · PAR monitor
        </p>
      </div>
    </div>
  );
}

// ── TyphoonLayer — ONLY map primitives (lives inside MapContainer) ────────
const TyphoonLayer = ({ visible }) => {
  const { data } = useOfflineCache("typhoon", fetchTyphoon, 30 * 60 * 1000);

  if (!visible) return null;

  const storms = IS_DEV_MODE ? [DEV_FAKE_STORM] : (data?.storms ?? []);

  return (
    <>
      {storms.map((storm) => (
        <StormMapLayer key={storm.id} storm={storm} />
      ))}
    </>
  );
};

// ── TyphoonPanel — DOM UI with offline cache indicator ───────────────────
export const TyphoonPanel = ({
  visible,
  isOpen,
  onToggle,
  topStyle = null,
  topPosition = "top-[210px]",
  onOfflineChange,
  onFlyTo,
}) => {
  const { data, loading, isOffline, cachedAt } = useOfflineCache(
    "typhoon",
    fetchTyphoon,
    30 * 60 * 1000,
  );

  // Notify parent of offline state — same pattern as LandslideForecastPanel
  useEffect(() => {
    if (IS_DEV_MODE) return;
    if (typeof onOfflineChange === "function") {
      onOfflineChange({ isOffline, cachedAt });
    }
  }, [isOffline, cachedAt, onOfflineChange]);

  if (!visible) return null;

  const realStorms = data?.storms ?? [];
  const storms = IS_DEV_MODE ? [DEV_FAKE_STORM] : realStorms;
  const hasActiveStorm = IS_DEV_MODE ? true : (data?.hasActiveStorm ?? false);

  // Derive button accent color from the highest PAGASA category level among active storms
  const highestLevel = storms.reduce((max, s) => Math.max(max, s.category?.level ?? 0), 0);
  const btnBorderClass =
    highestLevel >= 5 ? "bg-purple-50 border-purple-400" :
    highestLevel >= 4 ? "bg-red-50 border-red-400" :
    highestLevel >= 3 ? "bg-orange-50 border-orange-400" :
    highestLevel >= 2 ? "bg-amber-50 border-amber-400" :
    highestLevel >= 1 ? "bg-blue-50 border-blue-400" :
    hasActiveStorm    ? "bg-green-50 border-green-400" :
                        "bg-white border-gray-300";

  const timeAgo = (ts) => {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <>
      {/* Button */}
      <button
        onClick={onToggle}
        title="Typhoon Tracker"
        style={topStyle ?? undefined}
        className={`absolute ${topStyle ? "" : topPosition} left-[10px] z-[1000]
                    w-[30px] h-[30px] border flex items-center justify-center
                    shadow-sm hover:brightness-95 transition-all
                    ${
                      isOpen
                        ? `${btnBorderClass} ring-1 ring-offset-1`
                        : `${hasActiveStorm ? btnBorderClass : "bg-white border-gray-300"}`
                    }`}
      >
        {IS_DEV_MODE && (
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400 border border-white"
            title="Dev mode — fake storm injected"
          />
        )}
        <Wind
          size={15}
          strokeWidth={1.8}
          className={
            isOpen || hasActiveStorm ? "text-amber-500" : "text-gray-400"
          }
        />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute top-[90px] left-[50px] z-[1050]
                        w-64 bg-white border border-gray-200
                        rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-b border-gray-100
                           ${hasActiveStorm ? "bg-red-50" : "bg-gray-50"}`}
          >
            <div className="flex items-center gap-2">
              <Wind
                size={14}
                className={hasActiveStorm ? "text-red-500" : "text-gray-400"}
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <p
                    className={`text-xs font-bold ${hasActiveStorm ? "text-red-700" : "text-gray-600"}`}
                  >
                    Storm Tracker
                  </p>
                  {hasActiveStorm && (
                    <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                      {storms.length} ACTIVE
                    </span>
                  )}
                  {IS_DEV_MODE && (
                    <span className="text-[8px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">
                      DEV
                    </span>
                  )}
                  {!IS_DEV_MODE && isOffline && (
                    <WifiOff
                      size={10}
                      className="text-amber-500"
                      title={`Cached ${timeAgo(cachedAt)}`}
                    />
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  GDACS · PAGASA 2022
                  {!IS_DEV_MODE && isOffline && cachedAt && (
                    <span className="text-amber-500 ml-1">
                      · cached {timeAgo(cachedAt)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Loading */}
          {loading && !IS_DEV_MODE && (
            <div className="px-4 py-4 flex items-center gap-2">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400">
                Checking storm activity…
              </span>
            </div>
          )}

          {/* No storm */}
          {!loading && !hasActiveStorm && <NoStormContent />}

          {/* Active storms */}
          {!loading && hasActiveStorm && (
            <div className="px-3 py-3 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {storms.map((storm) => {
                const catStyle = CATEGORY_STYLE[storm.category?.level ?? 0];
                return (
                  <div
                    key={storm.id}
                    className="border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => onFlyTo?.(storm.lat, storm.lon)}
                      className={`w-full ${catStyle.bg} px-3 py-2 flex items-center justify-between
                                  hover:brightness-95 active:brightness-90 transition-all text-left`}
                      title="Click to locate on map"
                    >
                      <div>
                        <p className={`text-xs font-bold ${catStyle.text}`}>
                          {storm.name}
                        </p>
                        <p
                          className={`text-[10px] ${catStyle.text} opacity-75`}
                        >
                          Tap to locate on map
                        </p>
                      </div>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{
                          background:
                            CATEGORY_COLORS[storm.category?.level ?? 0],
                        }}
                      >
                        {storm.category?.label ?? "Unknown"}
                      </span>
                    </button>
                    <div className="px-3 py-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Wind size={10} /> Max winds
                        </div>
                        <span className="text-[10px] font-semibold text-gray-700">
                          {storm.windKph} km/h
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">
                          Wind radius
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-gray-700">
                            {storm.windRadiusSource === "gdacs" ? "" : "~"}
                            {storm.windRadiusKm} km
                          </span>
                          <span
                            className={`text-[8px] px-1 py-0.5 rounded font-bold
                                          ${
                                            storm.windRadiusSource === "gdacs"
                                              ? "bg-green-50 text-green-600"
                                              : "bg-gray-100 text-gray-400"
                                          }`}
                          >
                            {storm.windRadiusSource === "gdacs"
                              ? "GDACS"
                              : "est."}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">
                          Position
                        </span>
                        <span className="text-[10px] font-mono text-gray-600">
                          {storm.lat.toFixed(1)}°N {storm.lon.toFixed(1)}°E
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-gray-100 pt-2 flex flex-col gap-0.5">
                {[
                  {
                    label: "Storm data",
                    href: "https://www.gdacs.org",
                    text: "GDACS",
                  },
                  {
                    label: "Classification",
                    href: "https://www.pagasa.dost.gov.ph/information/about-tropical-cyclone",
                    text: "PAGASA 2022",
                  },
                ].map(({ label, href, text }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[9px] text-gray-400">{label}</span>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-blue-500 hover:underline"
                    >
                      {text}
                    </a>
                  </div>
                ))}
                <p className="text-[9px] text-gray-300 mt-0.5">
                  {data?.fetchedAt
                    ? `Last fetched: ${timeAgo(data.fetchedAt)}`
                    : "Updates every 30 min"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

const fetchTyphoon = async () => {
  const res = await fetch("/api/hazard/typhoon");
  if (!res.ok) throw new Error("Failed to fetch typhoon data");
  return res.json();
};

export default TyphoonLayer;
