import { MapPin, Trash2, X } from "lucide-react";
import { SEVERITY_CONFIG } from "../../hooks/useAlerts";

// ─── Dismiss Confirmation Modal ────────────────────────────────────────────────

export default function DismissConfirmModal({ alert, onConfirm, onCancel }) {
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.watch;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${sev.bg} ${sev.text}`}
            >
              <Trash2 size={13} />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              Remove Alert
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Are you sure you want to remove this alert?
          </p>
          {/* Alert preview */}
          <div
            className={`px-3 py-2.5 rounded-lg border-l-4 ${sev.leftBorder} bg-gray-50 border border-gray-100`}
          >
            <p className="text-xs font-semibold text-gray-800 leading-snug">
              {alert.title}
            </p>
            {alert.location && (
              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin size={9} />
                {alert.location}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            This will hide the alert for all users. It cannot be undone from
            this page.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
