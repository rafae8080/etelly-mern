import { AlertTriangle, CheckCircle } from "lucide-react";
import AlertTile from "./AlertTile";

const SECTION_ORDER = ["evacuate", "critical", "warning", "watch"];

export default function AlertList({ alerts, loading, error, activeFilter, onDismissRequest, onRetry }) {
  const sorted =
    activeFilter === "all"
      ? SECTION_ORDER.flatMap((sev) => alerts.filter((a) => a.severity === sev))
      : alerts;

  return (
    <div className="space-y-2">
      {/* Skeleton */}
      {loading && alerts.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-gray-50 rounded-xl h-24 animate-pulse border border-gray-200" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={28} className="text-red-400" />
          <p className="text-sm font-semibold text-gray-600">Could not load alerts</p>
          <p className="text-xs text-gray-400">{error}</p>
          <button onClick={onRetry} className="text-xs font-semibold text-blue-500 hover:underline mt-1">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={28} className="text-green-400" />
          <p className="text-sm font-semibold text-gray-700">
            {activeFilter === "all" ? "No active alerts" : `No ${activeFilter} alerts`}
          </p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            {activeFilter === "all"
              ? "All systems normal. Alerts will appear here automatically."
              : "Switch to All to see other alert levels."}
          </p>
        </div>
      )}

      {/* Alert tiles */}
      {!loading && !error && sorted.map((alert) => (
        <AlertTile key={alert._id} alert={alert} onDismissRequest={onDismissRequest} />
      ))}
    </div>
  );
}
