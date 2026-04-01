import { useEffect, useState } from "react";
import { Waves, ChevronDown, ChevronUp, Droplets, X } from "lucide-react";

const ALERT_CONFIG = {
  normal: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    label: "Normal Levels",
    icon: "💧",
    buttonBg: "bg-white",
    buttonBorder: "border-gray-300",
    iconColor: "text-blue-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-700",
    label: "Elevated — Watch",
    icon: "⚠️",
    buttonBg: "bg-amber-50",
    buttonBorder: "border-amber-400",
    iconColor: "text-amber-500",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    label: "Flood Risk — High",
    icon: "🚨",
    buttonBg: "bg-red-50",
    buttonBorder: "border-red-400",
    iconColor: "text-red-500",
  },
};

const SparkBar = ({ values, max }) => (
  <div className="flex items-end gap-0.5 h-8">
    {values.slice(0, 7).map((v, i) => {
      const pct = max > 0 ? (v / max) * 100 : 0;
      const color =
        pct > 75 ? "bg-red-400" : pct > 45 ? "bg-amber-400" : "bg-blue-400";
      return (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className={`${color} rounded-sm min-h-[2px]`}
            style={{ height: `${Math.max(pct, 4)}%` }}
            title={`Day ${i + 1}: ${v.toFixed(1)}`}
          />
        </div>
      );
    })}
  </div>
);

const FloodForecastPanel = ({ visible }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); // ← panel hidden by default
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/hazard/flood-forecast");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const alertKey = data?.overallAlert ?? "normal";
  const alert = ALERT_CONFIG[alertKey];
  const rain = data?.rainfall;
  const rivers = data?.rivers ?? [];

  return (
    <>
      {/* ── Icon button — same style as recenter button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="River Forecast"
        className={`absolute top-[130px] left-[10px] z-[1000]
                    w-[30px] h-[30px] border flex items-center justify-center
                    shadow-sm hover:brightness-95 transition-all
                    ${
                      open
                        ? `${alert.buttonBg} ${alert.buttonBorder} ring-1 ring-offset-1 ${alert.buttonBorder}`
                        : `${alert.buttonBg} ${alert.buttonBorder}`
                    }`}
      >
        <Waves size={15} strokeWidth={1.8} className={alert.iconColor} />
      </button>

      {/* ── Forecast panel — slides in from left when open ── */}
      {open && (
        <div
          className={`absolute top-[90px] left-[50px] z-[1000]
                      w-64 bg-white border rounded-2xl shadow-xl
                      overflow-hidden ${alert.border}
                      animate-in slide-in-from-left-2 duration-150`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-4 py-3
                           ${alert.bg} border-b ${alert.border}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{alert.icon}</span>
              <div>
                <p className={`text-xs font-bold ${alert.text}`}>
                  {alert.label}
                </p>
                <p className="text-[10px] text-gray-400">
                  7-day river forecast
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="px-4 py-4 flex items-center gap-2">
              <div
                className="w-3 h-3 border border-blue-400 border-t-transparent
                              rounded-full animate-spin"
              />
              <span className="text-xs text-gray-400">Loading forecast…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="px-4 py-3 text-xs text-red-500">
              ⚠️ Could not load forecast data
            </div>
          )}

          {/* Content */}
          {!loading && data && (
            <div className="px-4 py-3 flex flex-col gap-3">
              {/* Today summary */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Droplets size={12} className="text-blue-400" />
                    Rain today
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    {rain?.precipitation_sum?.[0]?.toFixed(1) ?? "—"} mm
                    <span className="text-gray-400 font-normal ml-1">
                      ({rain?.probability_max?.[0] ?? "—"}% chance)
                    </span>
                  </span>
                </div>
              </div>

              {/* Rivers */}
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                {rivers.map((river) => {
                  const cfg = ALERT_CONFIG[river.alertLevel];
                  const pct = (river.today / river.threshold.critical) * 100;
                  const allVals = river.forecastMax;
                  const maxVal = Math.max(...allVals, river.threshold.critical);

                  return (
                    <div key={river.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-600">
                          {river.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5
                                          rounded-full ${cfg.bg} ${cfg.text}`}
                        >
                          {river.today.toFixed(1)} m³/s
                        </span>
                      </div>

                      <SparkBar values={allVals} max={maxVal} />

                      {/* Threshold progress bar */}
                      <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all
                                      ${
                                        pct >= 100
                                          ? "bg-red-500"
                                          : pct >= 60
                                            ? "bg-amber-400"
                                            : "bg-blue-400"
                                      }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[8px] text-gray-300">0</span>
                        <span className="text-[8px] text-gray-300">
                          Critical: {river.threshold.critical} m³/s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 7-day rainfall sparkline */}
              <div className="border-t border-gray-100 pt-2">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">
                  7-Day Rainfall (mm)
                </p>
                <SparkBar
                  values={rain?.precipitation_sum ?? []}
                  max={Math.max(...(rain?.precipitation_sum ?? [1]), 1)}
                />
                <div className="flex justify-between mt-0.5">
                  {(rain?.dates ?? []).slice(0, 7).map((d, i) => (
                    <span key={i} className="text-[8px] text-gray-300">
                      {new Date(d).toLocaleDateString("en-PH", {
                        weekday: "narrow",
                      })}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[9px] text-gray-300 text-center border-t border-gray-100 pt-2">
                GloFAS v4 · Open-Meteo · Updated{" "}
                {data.generatedAt
                  ? new Date(data.generatedAt).toLocaleTimeString("en-PH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FloodForecastPanel;
