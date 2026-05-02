// client/src/components/map/flood/FloodForecastPanel.dev.jsx
// DEV MODE ONLY — swap import in HazardMapPage.jsx to test locally.

import { Waves, X, MapPin, TriangleAlert, Siren } from "lucide-react";

// ── Fake barangay alerts ──────────────────────────────────────────────────────
// Set to [] to see the empty state.
const DEV_BARANGAY_ALERTS = [
  {
    name: "San Roque",
    severity: "evacuate",
    elevation: 6,
    reason:
      "All 3 factors active: heavy rain 4+ hrs, lowest elevation (6m), soil at 72% saturation.",
  },
  {
    name: "Munting Dilaw",
    severity: "warning",
    elevation: 7,
    reason:
      "Heavy rain ongoing + low elevation (7m). Prepare evacuation teams now.",
  },
  {
    name: "Bagong Nayon",
    severity: "warning",
    elevation: 8,
    reason: "Heavy rain ongoing + low elevation (8m). Notify barangay captain.",
  },
  {
    name: "Dela Paz",
    severity: "watch",
    elevation: 9,
    reason:
      "Low elevation + saturated soil. Monitor closely — no heavy rain yet.",
  },
  {
    name: "Mayamot",
    severity: "watch",
    elevation: 14,
    reason:
      "Heavy rain forecast next 3 hrs. Elevation is 14m but soil near threshold.",
  },
];

const SEVERITY_ORDER = { evacuate: 0, critical: 1, warning: 2, watch: 3 };

function getOverallSeverity(list) {
  if (!list.length) return "normal";
  return list.reduce((worst, b) =>
    (SEVERITY_ORDER[b.severity] ?? 99) < (SEVERITY_ORDER[worst.severity] ?? 99)
      ? b
      : worst,
  ).severity;
}

const HEADER_STYLE = {
  normal: {
    bg: "bg-white",
    border: "border-gray-200",
    text: "text-gray-600",
    label: "Flood Monitor",
    sub: "Open-Meteo forecast · Phil-LiDAR elevation",
    icon: <Waves className="w-4 h-4 text-blue-400" />,
    btn: "bg-white border-gray-300",
    wave: "text-blue-400",
  },
  watch: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    label: "Flood Watch",
    sub: "Open-Meteo forecast · Phil-LiDAR elevation",
    icon: <Waves className="w-4 h-4 text-blue-500" />,
    btn: "bg-blue-50 border-blue-300",
    wave: "text-blue-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    label: "Flood Warning",
    sub: "Open-Meteo forecast · Phil-LiDAR elevation",
    icon: <TriangleAlert className="w-4 h-4 text-amber-500" />,
    btn: "bg-amber-50 border-amber-400",
    wave: "text-amber-500",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    label: "High Flood Risk",
    sub: "Open-Meteo forecast · Phil-LiDAR elevation",
    icon: <Siren className="w-4 h-4 text-red-500" />,
    btn: "bg-red-50 border-red-400",
    wave: "text-red-500",
  },
  evacuate: {
    bg: "bg-red-100",
    border: "border-red-500",
    text: "text-red-800",
    label: "EVACUATE",
    sub: "Open-Meteo forecast · Phil-LiDAR elevation",
    icon: <Siren className="w-4 h-4 text-red-700" />,
    btn: "bg-red-100 border-red-500",
    wave: "text-red-600",
  },
};

const SEVERITY_BADGE = {
  evacuate: {
    bg: "bg-red-600",
    text: "text-white",
    label: "EVACUATE",
    dot: "bg-red-600",
    cardBorder: "border-red-200",
    cardBg: "bg-red-50",
    nameCls: "text-red-800",
    descCls: "text-red-500",
    pulse: true,
  },
  critical: {
    bg: "bg-red-100",
    text: "text-red-800",
    label: "CRITICAL",
    dot: "bg-red-500",
    cardBorder: "border-red-200",
    cardBg: "bg-red-50",
    nameCls: "text-red-800",
    descCls: "text-red-500",
    pulse: true,
  },
  warning: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    label: "WARNING",
    dot: "bg-amber-500",
    cardBorder: "border-amber-200",
    cardBg: "bg-amber-50",
    nameCls: "text-amber-800",
    descCls: "text-amber-600",
    pulse: false,
  },
  watch: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    label: "WATCH",
    dot: "bg-blue-500",
    cardBorder: "border-blue-200",
    cardBg: "bg-blue-50",
    nameCls: "text-blue-800",
    descCls: "text-blue-500",
    pulse: false,
  },
};

const BarangayRow = ({ name, severity, elevation, reason }) => {
  const s = SEVERITY_BADGE[severity] ?? SEVERITY_BADGE.watch;
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${s.cardBg} ${s.cardBorder}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${s.pulse ? "animate-pulse" : ""}`}
          />
          <span className={`text-[11px] font-bold truncate ${s.nameCls}`}>
            {name}
          </span>
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            {elevation}m
          </span>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.bg} ${s.text}`}
        >
          {s.label}
        </span>
      </div>
      {reason && (
        <p className={`text-[9px] leading-snug mt-1.5 ${s.descCls}`}>
          {reason}
        </p>
      )}
    </div>
  );
};

const FloodForecastPanel = ({
  visible,
  isOpen,
  onToggle,
  topStyle = null,
  topPosition = "top-[170px]",
}) => {
  if (!visible) return null;

  const alerts = DEV_BARANGAY_ALERTS;
  const overallSev = getOverallSeverity(alerts);
  const h = HEADER_STYLE[overallSev] ?? HEADER_STYLE.normal;
  const hasAlerts = alerts.length > 0;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        title="Flood Risk Monitor [DEV]"
        style={topStyle ?? undefined}
        className={`absolute ${topStyle ? "" : topPosition} left-[10px] z-[1000]
                    w-[30px] h-[30px] border flex items-center justify-center
                    shadow-sm hover:brightness-95 transition-all ${h.btn}
                    ${isOpen ? "ring-1 ring-offset-1 ring-current" : ""}`}
      >
        {/* Small yellow dot — only indicator of dev mode, no floating badge */}
        <span
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400 border border-white"
          title="Dev mode"
        />
        <Waves size={15} strokeWidth={1.8} className={h.wave} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className={`absolute top-[90px] left-[50px] z-[1050] bg-white border rounded-2xl shadow-xl flex flex-col ${h.border}`}
          style={{ width: "272px", maxHeight: "calc(100vh - 120px)" }}
        >
          {/* Header — fixed, never scrolls */}
          <div
            className={`flex items-center justify-between px-4 py-3 ${h.bg} border-b ${h.border} flex-shrink-0 rounded-t-2xl`}
          >
            <div className="flex items-center gap-2">
              {h.icon}
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold ${h.text}`}>{h.label}</p>
                  <span className="text-[8px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">
                    DEV
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">{h.sub}</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 mb-10">
            {hasAlerts ? (
              <>
                <div className="flex items-center gap-1.5">
                  <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Affected Barangays
                  </p>
                  <span className="ml-auto text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">
                    {alerts.length}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {alerts.map((b) => (
                    <BarangayRow
                      key={b.name}
                      name={b.name}
                      severity={b.severity}
                      elevation={b.elevation}
                      reason={b.reason}
                    />
                  ))}
                </div>

                <p className="text-[8px] text-gray-300 leading-tight">
                  Sorted by severity, then elevation — lowest areas flood first.
                </p>
              </>
            ) : (
              <div className="py-8 flex flex-col items-center gap-2 text-center">
                <Waves size={22} className="text-gray-200" />
                <p className="text-xs font-semibold text-gray-400">
                  No active flood alerts
                </p>
                <p className="text-[10px] text-gray-300 leading-snug max-w-[180px]">
                  Barangays will appear here when flood watch, warning, or
                  evacuation conditions are triggered.
                </p>
              </div>
            )}
          </div>

          {/* Footer — fixed at bottom, never scrolls */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 flex flex-col gap-0.5 rounded-b-2xl">
            <p className="text-[9px] text-gray-400 font-medium">
              🌧 Open-Meteo forecast · Phil-LiDAR elevation
            </p>
            <p className="text-[9px] text-gray-300 leading-tight">
              System flood prediction · updated every 15 min
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default FloodForecastPanel;
