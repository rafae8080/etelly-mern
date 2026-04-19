import { Clock, MapPin, X } from "lucide-react";
import { SEVERITY_CONFIG, SOURCE_CONFIG } from "../../hooks/useAlerts";
import SeverityIcon from "./SeverityIcon";
import { timeAgo, timeUntil } from "../../utils/timeHelpers";

// ─── Single Alert Tile ─────────────────────────────────────────────────────────

export default function AlertTile({ alert, onDismissRequest }) {
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.watch;
  const src = SOURCE_CONFIG[alert.source] ?? SOURCE_CONFIG.system;

  return (
    <div
      className={`bg-white rounded-xl border-l-4 ${sev.leftBorder}
                  border border-gray-100 shadow-sm
                  hover:shadow-md transition-all overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <div
            className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center
                        justify-center ${sev.bg} ${sev.text}`}
          >
            <SeverityIcon severity={alert.severity} size={15} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row: severity · source · type — all on the same line */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}
              >
                {sev.label}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${src.bg} ${src.text} ${src.border}`}
              >
                {src.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                {alert.type}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">
              {alert.title}
            </h3>

            {/* Full description */}
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              {alert.description}
            </p>

            {/* Location */}
            {alert.location && (
              <div className="flex items-center gap-1 mt-1.5">
                <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-400 truncate">
                  {alert.location}
                </span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-1 mt-2">
              <Clock size={10} className="text-gray-300" />
              <span className="text-[11px] text-gray-400">
                {timeAgo(alert.createdAt)}
                {alert.expiresAt &&
                  timeUntil(alert.expiresAt) !== "expired" && (
                    <span className="ml-2 text-gray-300">
                      · expires in {timeUntil(alert.expiresAt)}
                    </span>
                  )}
              </span>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => onDismissRequest(alert)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                       text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Remove alert"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
