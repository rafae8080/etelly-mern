import { useEffect, useState } from "react";
import { Mountain, MapPin, TriangleAlert, Siren, X } from "lucide-react";
import RainfallStrip from "../flood/RainfallStrip";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";

const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

// Fake alerts for dev mode — first sentence of description becomes the zone row reason
const DEV_FAKE_ZONE_ALERTS = [
  {
    type: "landslide",
    isActive: true,
    severity: "warning",
    description:
      "Landslide risk elevated — intense rain has fallen continuously for 3h (≥30 mm/hr), soil saturation at 78%. " +
      "Prepare for possible evacuation near steep slopes. " +
      "Prior 24h: 42 mm, 72h: 88 mm. Source: Open-Meteo forecast, MGB susceptibility data. " +
      "Affected: Brgy. Calawis, Antipolo, Brgy. Mambugan (ridge), Brgy. Dalig (upper slope).",
    barangays: [
      "Brgy. Calawis, Antipolo",
      "Brgy. Mambugan (ridge)",
      "Brgy. Dalig (upper slope)",
    ],
  },
  {
    type: "landslide",
    isActive: true,
    severity: "watch",
    description:
      "Landslide conditions possible — 35 mm of recent rain has raised soil moisture to 68%. " +
      "Residents near slopes should stay alert and monitor for instability. " +
      "Prior 24h: 35 mm, 72h: 71 mm. Source: Open-Meteo forecast, MGB susceptibility data.",
    barangays: [
      "Brgy. Inarawan (slope)",
      "Brgy. San Jose (hillside)",
      "Hinulugang Taktak escarpment",
    ],
  },
];

// Slope risk per zone name — used for sort order (higher = steeper = more dangerous)
const SLOPE_MAP = {
  "Brgy. Dalig (upper slope)": 3,
  "Brgy. Calawis, Antipolo": 3,
  "Brgy. San Jose (hillside)": 3,
  "Brgy. Mambugan (ridge)": 3,
  "Hinulugang Taktak escarpment": 3,
  "Brgy. Inarawan (slope)": 2,
  "Brgy. Dela Paz (hillside)": 2,
  "Brgy. San Roque (mid-slope)": 2,
  "Brgy. Cupang (elevated)": 2,
  "Brgy. San Isidro (steep slope)": 2,
};

const SEVERITY_ORDER = { evacuate: 0, critical: 1, warning: 2, watch: 3 };

const HEADER_STYLE = {
  normal: {
    bg: "bg-white",
    border: "border-gray-200",
    text: "text-gray-600",
    label: "Landslide Monitor",
    sub: "Open-Meteo · MGB susceptibility zones",
    icon: <Mountain className="w-4 h-4 text-amber-400" />,
    btn: "bg-white border-gray-300",
    iconColor: "text-amber-400",
  },
  watch: {
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-700",
    label: "Landslide Watch",
    sub: "Open-Meteo · MGB susceptibility zones",
    icon: <Mountain className="w-4 h-4 text-yellow-500" />,
    btn: "bg-yellow-50 border-yellow-300",
    iconColor: "text-yellow-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    label: "Landslide Warning",
    sub: "Open-Meteo · MGB susceptibility zones",
    icon: <TriangleAlert className="w-4 h-4 text-amber-500" />,
    btn: "bg-amber-50 border-amber-400",
    iconColor: "text-amber-500",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    label: "High Landslide Risk",
    sub: "Open-Meteo · MGB susceptibility zones",
    icon: <Siren className="w-4 h-4 text-red-500" />,
    btn: "bg-red-50 border-red-400",
    iconColor: "text-red-500",
  },
  evacuate: {
    bg: "bg-red-100",
    border: "border-red-500",
    text: "text-red-800",
    label: "EVACUATE",
    sub: "Open-Meteo · MGB susceptibility zones",
    icon: <Siren className="w-4 h-4 text-red-700" />,
    btn: "bg-red-100 border-red-500",
    iconColor: "text-red-600",
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
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    label: "WATCH",
    dot: "bg-yellow-500",
    cardBorder: "border-yellow-200",
    cardBg: "bg-yellow-50",
    nameCls: "text-yellow-800",
    descCls: "text-yellow-600",
    pulse: false,
  },
};

function getOverallSeverity(list) {
  if (!list.length) return "normal";
  return list.reduce((worst, b) =>
    (SEVERITY_ORDER[b.severity] ?? 99) < (SEVERITY_ORDER[worst.severity] ?? 99)
      ? b
      : worst,
  ).severity;
}

function buildZoneList(alerts) {
  const map = {};
  for (const alert of alerts) {
    const { severity, barangays = [], description = "" } = alert;
    const sevOrder = SEVERITY_ORDER[severity] ?? 99;
    const firstSentence = description.split(".")[0]?.trim() ?? "";
    const reason =
      firstSentence.length > 100
        ? firstSentence.slice(0, 97) + "…"
        : firstSentence;
    for (const zone of barangays) {
      const existing = map[zone];
      if (!existing || sevOrder < (SEVERITY_ORDER[existing.severity] ?? 99)) {
        map[zone] = { severity, reason };
      }
    }
  }
  return Object.entries(map)
    .map(([name, { severity, reason }]) => ({
      name,
      severity,
      reason,
      slopeRisk: SLOPE_MAP[name] ?? 1,
    }))
    .sort((a, b) => {
      const sevDiff =
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      return sevDiff !== 0 ? sevDiff : b.slopeRisk - a.slopeRisk;
    });
}

const ZoneRow = ({ name, severity, slopeRisk, reason }) => {
  const s = SEVERITY_BADGE[severity] ?? SEVERITY_BADGE.watch;
  const riskLabel =
    slopeRisk === 3 ? "Steep" : slopeRisk === 2 ? "Mod." : "Low";
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${s.cardBg} ${s.cardBorder}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot} ${
              s.pulse ? "animate-pulse" : ""
            }`}
          />
          <span className={`text-[11px] font-bold truncate ${s.nameCls}`}>
            {name}
          </span>
          <span className="text-[9px] text-gray-400 flex-shrink-0">
            {riskLabel}
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

// ── Hooks always called unconditionally (Rules of Hooks) ─────────────────────
const LandslideForecastPanelContent = ({ isOpen, onToggle, topStyle }) => {
  const [zoneList, setZoneList] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Fetch active landslide alerts; refresh every 2 min while panel is open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setAlertsLoading(true);
      try {
        if (IS_DEV_MODE) {
          if (!cancelled) setZoneList(buildZoneList(DEV_FAKE_ZONE_ALERTS));
          return;
        }
        const res = await fetch(`${API_BASE}/api/alerts`);
        if (!res.ok) throw new Error("fetch failed");
        const { alerts = [] } = await res.json();
        const ls = alerts.filter((a) => a.type === "landslide" && a.isActive);
        if (!cancelled) setZoneList(buildZoneList(ls));
      } catch (_) {
        // silent — show last loaded list
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen]);

  const overallSev = getOverallSeverity(zoneList);
  const h = HEADER_STYLE[overallSev] ?? HEADER_STYLE.normal;
  const hasAlerts = zoneList.length > 0;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        title="Landslide Risk"
        style={topStyle ?? undefined}
        className={`absolute left-[10px] z-[1000]
                    w-[30px] h-[30px] border flex items-center justify-center
                    shadow-sm hover:brightness-95 transition-all ${h.btn}
                    ${isOpen ? "ring-1 ring-offset-1 ring-current" : ""}`}
      >
        {IS_DEV_MODE && (
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-400 border border-white"
            title="Dev mode"
          />
        )}
        <Mountain size={15} strokeWidth={1.8} className={h.iconColor} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className={`absolute top-[90px] left-[50px] z-[1050] bg-white border rounded-2xl shadow-xl flex flex-col ${h.border}`}
          style={{ width: "272px", maxHeight: "calc(100vh - 120px)" }}
        >
          {/* Header — fixed */}
          <div
            className={`flex items-center justify-between px-4 py-3 ${h.bg} border-b ${h.border} flex-shrink-0 rounded-t-2xl`}
          >
            <div className="flex items-center gap-2">
              {h.icon}
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-bold ${h.text}`}>{h.label}</p>
                  {IS_DEV_MODE && (
                    <span className="text-[8px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded">
                      DEV
                    </span>
                  )}
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
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-4 py-3 flex flex-col gap-2">
              {/* Alert zone list */}
              {alertsLoading && !hasAlerts ? (
                <div className="py-4 flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-400">
                    Checking alerts…
                  </span>
                </div>
              ) : hasAlerts ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      Affected Zones
                    </p>
                    <span className="ml-auto text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">
                      {zoneList.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {zoneList.map((z) => (
                      <ZoneRow
                        key={z.name}
                        name={z.name}
                        severity={z.severity}
                        slopeRisk={z.slopeRisk}
                        reason={z.reason}
                      />
                    ))}
                  </div>
                  <p className="text-[8px] text-gray-300 leading-tight">
                    Sorted by severity, then slope steepness.
                  </p>
                </>
              ) : (
                <div className="py-6 flex flex-col items-center gap-2 text-center">
                  <Mountain size={22} className="text-gray-200" />
                  <p className="text-xs font-semibold text-gray-400">
                    No active landslide alerts
                  </p>
                  <p className="text-[10px] text-gray-300 leading-snug max-w-[180px]">
                    Zones appear here when watch, warning, or evacuation
                    conditions are triggered.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer — fixed */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 rounded-b-2xl">
            <p className="text-[9px] text-gray-400 font-medium">
              System landslide prediction
            </p>
            <p className="text-[9px] text-gray-300">updated every 15 min</p>
          </div>
        </div>
      )}
    </>
  );
};

// Main component — guard on visible; hooks inside always run
const LandslideForecastPanel = (props) => {
  if (!props.visible) return null;
  return <LandslideForecastPanelContent {...props} />;
};

export default LandslideForecastPanel;
