import { AlertTriangle, CheckCircle } from "lucide-react";
import AlertTile from "./AlertTile";

// ─── Alert List ────────────────────────────────────────────────────────────────

export default function AlertList({
  alerts,
  loading,
  error,
  activeFilter,
  onDismissRequest,
  onRetry,
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
      {/* Skeleton */}
      {loading && alerts.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-gray-50 rounded-xl h-24 animate-pulse border-l-4 border-gray-200"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-gray-500">Could not load alerts</p>
          <p className="text-xs text-gray-400">{error}</p>
          <button
            onClick={onRetry}
            className="text-sm text-blue-500 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={32} className="text-green-400" />
          <p className="text-sm font-semibold text-gray-600">
            {activeFilter === "all"
              ? "No active alerts"
              : `No ${activeFilter} alerts`}
          </p>
          <p className="text-xs text-gray-400">
            {activeFilter === "all"
              ? "All systems normal. Alerts will appear here automatically."
              : "Switch to All to see other alert levels."}
          </p>
        </div>
      )}

      {/* Tiles */}
      {alerts.map((alert) => (
        <AlertTile
          key={alert._id}
          alert={alert}
          onDismissRequest={onDismissRequest}
        />
      ))}
    </div>
  );
}
