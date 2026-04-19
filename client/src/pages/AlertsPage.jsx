import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useAlerts } from "../hooks/useAlerts";
import { timeAgo } from "../utils/timeHelpers";
import AlertList from "../components/alerts/AlertList";
import SummaryBar from "../components/alerts/SummaryBar";
import FilterTabs from "../components/alerts/FilterTabs";
import CreateAlertModal from "../components/alerts/CreateAlertModal";
import DismissConfirmModal from "../components/alerts/DismissConfirmModal";

// ─── Main AlertsPage ───────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { alerts, loading, error, lastFetched, dismiss, refresh, counts } =
    useAlerts();

  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [pendingDismiss, setPendingDismiss] = useState(null);

  const filtered =
    activeFilter === "all"
      ? alerts
      : alerts.filter((a) => a.severity === activeFilter);

  const handleDismissConfirm = () => {
    if (pendingDismiss) {
      dismiss(pendingDismiss._id);
      setPendingDismiss(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Antipolo City — live hazard & evacuation alerts
          </p>
          {lastFetched && (
            <p className="text-xs text-gray-400 mt-1">
              Updated {timeAgo(lastFetched)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refresh}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center
                       text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl
                       hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Plus size={15} />
            Create Alert
          </button>
        </div>
      </div>

      {/* Summary */}
      {counts.total > 0 && (
        <div className="mb-4 flex-shrink-0">
          <SummaryBar counts={counts} />
        </div>
      )}

      {/* Filter tabs */}
      <FilterTabs
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={counts}
      />

      {/* Alert list */}
      <AlertList
        alerts={filtered}
        loading={loading}
        error={error}
        activeFilter={activeFilter}
        onDismissRequest={setPendingDismiss}
        onRetry={refresh}
      />

      {/* Create Alert Modal */}
      {showModal && (
        <CreateAlertModal
          onClose={() => setShowModal(false)}
          onCreated={refresh}
        />
      )}

      {/* Dismiss Confirmation Modal */}
      {pendingDismiss && (
        <DismissConfirmModal
          alert={pendingDismiss}
          onConfirm={handleDismissConfirm}
          onCancel={() => setPendingDismiss(null)}
        />
      )}
    </div>
  );
}
