import { Polyline, Popup, Circle, Marker } from "react-leaflet";
import { Wind, X, Info, FlaskConical } from "lucide-react";
import L from "leaflet";
import { useOfflineCache } from "../../../hooks/useOfflineCache";

// ── Dev test mode ─────────────────────────────────────────────────────────
// Add ?dev=true to your localhost URL to inject a fake storm on the map.
// This lets you verify the marker, wind circle, track line, and popup
// all render correctly without needing a real active typhoon.
const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

// Fake storm based on Typhoon Odette (2021) track — real PAR coordinates
const DEV_FAKE_STORM = {
  id: "dev-test-001",
  name: "TEST STORM (Dev Mode)",
  lat: 12.5,
  lon: 124.8,
  alertLevel: "orange",
  windKph: 150,
  windKnots: 81,
  category: { label: "Typhoon (TY)", color: "#dc2626", level: 4 },
  movement: 20,
  direction: 315,
  updatedAt: new Date().toISOString(),
  windRadiusKm: 100,
  forecastTrack: [
    { lat: 12.5, lon: 124.8 },
    { lat: 13.2, lon: 123.5 },
    { lat: 14.1, lon: 122.0 },
    { lat: 14.8, lon: 120.5 },
  ],
};

// ── PAGASA typhoon season info ────────────────────────────────────────────
const SEASON_DEFS = {
  active: {
    months: [6, 7, 8, 9, 10, 11],
    label: "Peak Season",
    color: "text-red-600",
    bg: "bg-red-50",
    dot: "bg-red-500",
  },
  shoulder: {
    months: [5, 12],
    label: "Active Season",
    color: "text-amber-600",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
  },
  quiet: {
    months: [1, 2, 3, 4],
    label: "Quiet Season",
    color: "text-blue-600",
    bg: "bg-blue-50",
    dot: "bg-blue-400",
  },
};

function getSeasonStatus() {
  const month = new Date().getMonth() + 1;
  if (SEASON_DEFS.active.months.includes(month)) return SEASON_DEFS.active;
  if (SEASON_DEFS.shoulder.months.includes(month)) return SEASON_DEFS.shoulder;
  return SEASON_DEFS.quiet;
}

// PAGASA wind signal reference
const PAGASA_SIGNALS = [
  {
    signal: "Signal #4",
    wind: "≥ 185 km/h",
    color: "#7c3aed",
    desc: "Destructive typhoon force winds",
  },
  {
    signal: "Signal #3",
    wind: "100–184 km/h",
    color: "#dc2626",
    desc: "Damaging typhoon force winds",
  },
  {
    signal: "Signal #2",
    wind: "61–99 km/h",
    color: "#f97316",
    desc: "Moderate tropical storm winds",
  },
  {
    signal: "Signal #1",
    wind: "30–60 km/h",
    color: "#3b82f6",
    desc: "Tropical cyclone nearby",
  },
];

// ── Color maps ────────────────────────────────────────────────────────────
const ALERT_COLORS = {
  green: {
    stroke: "#16a34a",
    fill: "#22c55e",
    text: "text-green-700",
    bg: "bg-green-50",
  },
  orange: {
    stroke: "#d97706",
    fill: "#f59e0b",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  red: {
    stroke: "#dc2626",
    fill: "#ef4444",
    text: "text-red-700",
    bg: "bg-red-50",
  },
};

const CATEGORY_COLORS = {
  5: "#7c3aed",
  4: "#dc2626",
  3: "#f97316",
  2: "#f59e0b",
  1: "#3b82f6",
  0: "#9ca3af",
};

// ── Typhoon eye icon ──────────────────────────────────────────────────────
const createTyphoonIcon = (color, size = 28) =>
  new L.DivIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 0 0 2px ${color},0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          width:${size * 0.35}px;height:${size * 0.35}px;
          border-radius:50%;
          background:white;
          opacity:0.9;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

// ── Storm map layer ───────────────────────────────────────────────────────
function StormMapLayer({ storm }) {
  const catColor = CATEGORY_COLORS[storm.category?.level ?? 0];
  const alertCfg = ALERT_COLORS[storm.alertLevel] ?? ALERT_COLORS.green;
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
      {storm.forecastTrack?.length >= 2 && (
        <Polyline
          positions={storm.forecastTrack.map((p) => [p.lat, p.lon])}
          pathOptions={{
            color: catColor,
            weight: 2.5,
            opacity: 0.7,
            dashArray: "8 4",
          }}
        />
      )}
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
              className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg ${alertCfg.bg}`}
            >
              <span className="text-base">🌀</span>
              <div>
                <p className={`text-sm font-bold ${alertCfg.text}`}>
                  {storm.name}
                </p>
                <p className={`text-[10px] ${alertCfg.text}`}>
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
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Alert</span>
                <span
                  className="font-bold capitalize px-1.5 py-0.5 rounded text-[9px] text-white"
                  style={{ background: alertCfg.stroke }}
                >
                  {storm.alertLevel}
                </span>
              </div>
              {storm.updatedAt && (
                <p className="text-[9px] text-gray-400 mt-1 border-t border-gray-100 pt-1">
                  Updated {timeAgo(storm.updatedAt)} · GDACS / PAGASA
                </p>
              )}
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

// ── No-storm panel ────────────────────────────────────────────────────────
function NoStormContent() {
  const season = getSeasonStatus();

  return (
    <div className="flex flex-col">
      {/* Season status badge */}
      <div className={`mx-3 mt-3 mb-2.5 rounded-xl px-3 py-2.5 ${season.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${season.dot}`}
          />
          <p
            className={`text-[10px] font-bold uppercase tracking-wider ${season.color}`}
          >
            {season.label}
          </p>
        </div>
        <p className="text-[10px] text-gray-500 leading-snug">
          No tropical cyclone currently within the Philippine Area of
          Responsibility (PAR).
        </p>
      </div>

      {/* PAGASA signal reference */}
      <div className="px-3 pb-1">
        <div className="flex items-center gap-1 mb-2">
          <Info size={9} className="text-gray-400" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
            PAGASA Wind Signals
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {PAGASA_SIGNALS.map(({ signal, wind, color, desc }) => (
            <div key={signal} className="flex items-start gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm mt-0.5 flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-[10px] font-bold text-gray-700">
                    {signal}
                  </p>
                  <p className="text-[9px] text-gray-400 font-mono flex-shrink-0">
                    {wind}
                  </p>
                </div>
                <p className="text-[9px] text-gray-400 leading-none">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div className="mx-3 mt-2.5 mb-3 border-t border-gray-100 pt-2 flex flex-col gap-1">
        <p className="text-[9px] font-semibold text-gray-400 mb-0.5">
          Data Sources
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">Storm tracking</span>
          <a
            href="https://www.gdacs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-blue-500 hover:underline"
          >
            GDACS
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">PH classification</span>
          <a
            href="https://www.pagasa.dost.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-blue-500 hover:underline"
          >
            PAGASA–DOST
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">Regional alerts</span>
          <a
            href="https://www.jma.go.jp/en/typh/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-blue-500 hover:underline"
          >
            JMA RSMC Tokyo
          </a>
        </div>
        <p className="text-[9px] text-gray-300 mt-1">
          Updates every 30 min · PAR monitor
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
const TyphoonLayer = ({
  visible,
  isOpen,
  onToggle,
  topPosition = "top-[210px]",
  topStyle = null,
  // When true, the button is omitted — the parent renders it instead.
  // Use this to place the button in a shared stack without gaps.
  hideButton = false,
}) => {
  const { data, loading, isOffline, cachedAt } = useOfflineCache(
    "typhoon",
    fetchTyphoon,
    30 * 60 * 1000,
  );

  if (!visible) return null;

  // Dev mode overrides real API data with fake storm
  const realStorms = data?.storms ?? [];
  const storms = IS_DEV_MODE ? [DEV_FAKE_STORM] : realStorms;
  const hasActiveStorm = IS_DEV_MODE ? true : (data?.hasActiveStorm ?? false);

  const highestAlert = storms.reduce((worst, s) => {
    const priority = { red: 3, orange: 2, green: 1 };
    return (priority[s.alertLevel] ?? 0) > (priority[worst] ?? 0)
      ? s.alertLevel
      : worst;
  }, "green");

  const btnColors = {
    red: "bg-red-50 border-red-400",
    orange: "bg-amber-50 border-amber-400",
    green: hasActiveStorm
      ? "bg-green-50 border-green-400"
      : "bg-white border-gray-300",
  };

  const iconColors = {
    red: "text-red-500",
    orange: "text-amber-500",
    green: hasActiveStorm ? "text-green-600" : "text-gray-400",
  };

  const timeAgo = (ts) => {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <>
      {/* ── Storm map layers ── */}
      {storms.map((storm) => (
        <StormMapLayer key={storm.id} storm={storm} />
      ))}

      {/* ── Icon button — hidden when parent manages the button position ── */}
      {!hideButton && (
        <button
          onClick={onToggle}
          title="Typhoon Tracker"
          style={topStyle ?? undefined}
          className={`absolute ${topStyle ? "" : topPosition} left-[10px] z-[1000]
                      w-[30px] h-[30px] border flex items-center justify-center
                      shadow-sm hover:brightness-95 transition-all
                      ${
                        isOpen
                          ? `${btnColors[hasActiveStorm ? highestAlert : "green"]} ring-1 ring-offset-1`
                          : `${hasActiveStorm ? btnColors[highestAlert] : "bg-white border-gray-300"}`
                      }`}
        >
          {IS_DEV_MODE && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400 border border-white"
              title="Dev mode — fake storm injected"
            />
          )}
          <span
            className={`text-sm ${
              isOpen || hasActiveStorm
                ? iconColors[highestAlert]
                : "text-gray-400"
            }`}
            style={{ fontSize: 15, lineHeight: 1 }}
          >
            🌀
          </span>
        </button>
      )}

      {/* ── Info panel ── */}
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
              <span className="text-sm">🌀</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p
                    className={`text-xs font-bold ${hasActiveStorm ? "text-red-700" : "text-gray-600"}`}
                  >
                    {hasActiveStorm
                      ? `${storms.length} Active Storm${storms.length > 1 ? "s" : ""}`
                      : "No Active Typhoon"}
                  </p>
                  {IS_DEV_MODE && (
                    <span className="text-[8px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">
                      DEV
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">
                  Western Pacific · PAR Monitor
                  {isOffline && cachedAt && (
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

          {/* No active storm — PAGASA info */}
          {!loading && !hasActiveStorm && <NoStormContent />}

          {/* Active storms */}
          {!loading && hasActiveStorm && (
            <div className="px-3 py-3 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {storms.map((storm) => {
                const alertCfg =
                  ALERT_COLORS[storm.alertLevel] ?? ALERT_COLORS.green;
                return (
                  <div
                    key={storm.id}
                    className="border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <div
                      className={`${alertCfg.bg} px-3 py-2 flex items-center justify-between`}
                    >
                      <div>
                        <p className={`text-xs font-bold ${alertCfg.text}`}>
                          {storm.name}
                        </p>
                        <p className={`text-[10px] ${alertCfg.text}`}>
                          {storm.category?.label}
                        </p>
                      </div>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white capitalize"
                        style={{ background: alertCfg.stroke }}
                      >
                        {storm.alertLevel} alert
                      </span>
                    </div>
                    <div className="px-3 py-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Wind size={10} />
                          Max winds
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

              {/* Sources */}
              <div className="border-t border-gray-100 pt-2 flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-400">
                    Storm tracking
                  </span>
                  <a
                    href="https://www.gdacs.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-blue-500 hover:underline"
                  >
                    GDACS
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-400">
                    PH classification
                  </span>
                  <a
                    href="https://www.pagasa.dost.gov.ph"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-blue-500 hover:underline"
                  >
                    PAGASA–DOST
                  </a>
                </div>
                <p className="text-[9px] text-gray-300 mt-0.5">
                  Updated every 6 hours
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

// Needed at module level but defined outside component to avoid re-creation
const fetchTyphoon = async () => {
  const res = await fetch("/api/hazard/typhoon");
  if (!res.ok) throw new Error("Failed to fetch typhoon data");
  return res.json();
};

export default TyphoonLayer;
