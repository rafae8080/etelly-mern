import { Clock, MapPin, X } from "lucide-react";
import { SOURCE_CONFIG } from "../../hooks/useAlerts";
import { timeAgo, timeUntil } from "../../utils/timeHelpers";

const SEV_STYLE = {
  evacuate: { badge: "bg-red-50 text-red-600", label: "EVACUATE" },
  critical: { badge: "bg-red-50 text-red-800", label: "Critical" },
  warning: { badge: "bg-amber-50 text-amber-700", label: "Warning" },
  watch: { badge: "bg-blue-50 text-blue-700", label: "Watch" },
};

const SEV_EXPIRY = {
  evacuate: "text-red-500",
  critical: "text-red-500",
  warning: "text-amber-500",
  watch: "text-blue-500",
};

export default function AlertTile({ alert, onDismissRequest }) {
  const style = SEV_STYLE[alert.severity] ?? SEV_STYLE.watch;
  const src = SOURCE_CONFIG[alert.source] ?? SOURCE_CONFIG.system;
  const until = alert.expiresAt ? timeUntil(alert.expiresAt) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-4">
      {/* Title + severity badge + dismiss */}
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">
            {alert.title}
          </h3>
          {alert.location && (
            <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPin size={10} className="text-gray-300 flex-shrink-0" />
              <span className="truncate max-w-[200px]">{alert.location}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}
          >
            {style.label}
          </span>
          <button
            onClick={() => onDismissRequest(alert)}
            className="text-gray-300 hover:text-red-400 transition-colors"
            title="Dismiss alert"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mt-1.5">
        {alert.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${src.bg} ${src.text} ${src.border}`}
          >
            {src.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 capitalize">
            {alert.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono shrink-0">
          <Clock size={10} className="text-gray-300 flex-shrink-0" />
          <span>{timeAgo(alert.createdAt)}</span>
          {until && until !== "expired" && (
            <span className={SEV_EXPIRY[alert.severity] ?? "text-gray-400"}>
              · expires {until}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
