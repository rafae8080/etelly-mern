import { X } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { formatDate } from "./helpers";

export default function LogModal({ item, onClose }) {
  const log = item.actionLog ?? [];
  const isRequest = "requesterName" in item;

  return (
    <ModalShell onClose={onClose} size="md" flex>
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Action Log</h2>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">
              {isRequest ? item.requesterName : item.donorName} — {item.category}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex gap-3 pb-4">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
              {log.length > 0 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Submitted</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{formatDate(item.createdAt)}</p>
            </div>
          </div>

          {log.map((entry, i) => {
            const dotColor =
              ["approved", "fulfilled", "received", "scheduled"].includes(entry.action)
                ? "bg-green-500"
                : ["rejected", "cancelled"].includes(entry.action)
                ? "bg-red-500"
                : "bg-blue-500";
            return (
              <div key={i} className="flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                  {i < log.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 capitalize">{entry.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    by <span className="font-medium">{entry.by}</span>{" "}
                    · <span className="font-mono">{formatDate(entry.at)}</span>
                  </p>
                  {entry.note && (
                    <p className="text-xs text-gray-400 mt-1 italic">"{entry.note}"</p>
                  )}
                </div>
              </div>
            );
          })}

          {log.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No actions recorded yet.</p>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
    </ModalShell>
  );
}
