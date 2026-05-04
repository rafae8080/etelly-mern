import { useState } from "react";
import { X, AlertTriangle, TriangleAlert } from "lucide-react";
import { API_BASE, authHeaders, formatDate, getStatusColor, getStatusDotColor } from "./helpers";
import LogModal from "./LogModal";

export default function RequestDetailModal({ req, onClose, onRefresh }) {
  const [action,     setAction]     = useState(null);
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [showLog,    setShowLog]    = useState(false);

  const stored = localStorage.getItem("user");
  const isAdmin = stored ? JSON.parse(stored).role === "admin" : false;

  const handleAction = async () => {
    if (action === "reject" && !note.trim()) {
      setError("A reason is required when rejecting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/community/requests/${req._id}/${action}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Action failed.");
      onRefresh();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const resetAction = () => { setAction(null); setNote(""); setError(""); };

  if (showLog) return <LogModal item={req} onClose={() => setShowLog(false)} />;

  const isPending  = req.status === "pending";
  const isApproved = req.status === "approved";
  const isTerminal = ["fulfilled", "rejected", "cancelled"].includes(req.status);
  const lastEntry  = req.actionLog?.[req.actionLog.length - 1];

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 capitalize">{req.category} Request</h2>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium">
              <div className={`w-2 h-2 rounded-full ${getStatusDotColor(req.status)}`} />
              <span className={getStatusColor(req.status)}>
                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {req.householdFlag && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <TriangleAlert size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Another person at this address already has an active request for the same category.
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700">Requester</p>
            <p className="text-gray-900 text-sm mt-1 font-semibold">{req.requesterName}</p>
            <p className="text-gray-500 text-xs mt-0.5">{req.requesterEmail}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Address</p>
            <p className="text-gray-900 text-sm mt-1">{req.address}</p>
            <p className="text-gray-500 text-xs mt-0.5">{req.barangay}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Item Requested</p>
            <p className="text-gray-900 text-sm mt-1">{req.itemDescription}</p>
            <p className="text-gray-500 text-xs mt-0.5 font-mono">{req.quantity} {req.unit}</p>
          </div>

          {req.reason && (
            <div>
              <p className="text-sm font-medium text-gray-700">Reason</p>
              <p className="text-gray-900 text-sm mt-1">{req.reason}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700">Submitted</p>
            <p className="text-gray-900 text-sm mt-1">{formatDate(req.createdAt)}</p>
          </div>

          {lastEntry && (
            <div className={`p-3 rounded-lg border ${
              ["rejected", "cancelled"].includes(req.status)
                ? "bg-red-50 border-red-200"
                : "bg-green-50 border-green-200"
            }`}>
              <p className="text-sm font-medium capitalize">
                {lastEntry.action} by {lastEntry.by}
              </p>
              {lastEntry.note && (
                <p className="text-sm mt-1 text-gray-700">"{lastEntry.note}"</p>
              )}
            </div>
          )}

          {action && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                {action === "reject"
                  ? <span>Reason <span className="text-red-500">*</span></span>
                  : "Note (optional)"}
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  action === "reject"
                    ? "Explain why this request is rejected…"
                    : "Optional note for the record…"
                }
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle size={11} /> {error}
            </p>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 space-y-3">
          {isAdmin && (
            <button
              onClick={() => setShowLog(true)}
              className="w-full py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              View action log
            </button>
          )}

          {isPending && !action && (
            <div className="flex gap-3">
              <button
                onClick={() => setAction("reject")}
                className="flex-1 px-4 py-2 border border-red-500 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors text-sm"
              >
                Reject
              </button>
              <button
                onClick={() => setAction("approve")}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Approve
              </button>
            </div>
          )}

          {isApproved && !action && (
            <div className="flex gap-3">
              <button
                onClick={() => setAction("cancel")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel Request
              </button>
              <button
                onClick={() => setAction("fulfill")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Mark Fulfilled
              </button>
            </div>
          )}

          {action && (
            <div className="flex gap-3">
              <button
                onClick={resetAction}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={handleAction}
                disabled={submitting}
                className={`flex-1 px-4 py-2 font-semibold rounded-lg text-white transition-colors text-sm disabled:opacity-50
                  ${action === "approve" || action === "fulfill"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"}`}
              >
                {submitting
                  ? "Saving…"
                  : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
              </button>
            </div>
          )}

          {isTerminal && (
            <div className={`w-full text-center py-2 rounded-lg text-sm font-medium ${
              req.status === "fulfilled" ? "bg-blue-50 text-blue-700"
              : req.status === "rejected" ? "bg-red-50 text-red-700"
              : "bg-gray-100 text-gray-500"
            }`}>
              This request has been {req.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
