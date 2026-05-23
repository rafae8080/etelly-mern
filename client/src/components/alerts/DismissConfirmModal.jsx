import { X } from "lucide-react";
import ModalShell from "../ui/ModalShell";

export default function DismissConfirmModal({ alert, onConfirm, onCancel }) {
  return (
    <ModalShell onClose={onCancel} size="sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Dismiss Alert</h2>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-2">
          <p className="text-sm text-gray-700">
            Are you sure you want to dismiss this alert?
          </p>
          <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
          <p className="text-xs text-gray-400 pt-1">
            This will hide the alert from all users including the mobile app.
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
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
    </ModalShell>
  );
}
