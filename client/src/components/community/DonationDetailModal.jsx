import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { API_BASE, authHeaders, formatDate, getStatusColor, getStatusDotColor } from "./helpers";
import LogModal from "./LogModal";

export default function DonationDetailModal({ don, onClose, onRefresh }) {
  const [mode,            setMode]            = useState(null);
  const [dropOffPoint,    setDropOffPoint]    = useState(don.dropOffPoint || "");
  const [scheduledWindow, setScheduledWindow] = useState(don.scheduledWindow || "");
  const [note,            setNote]            = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");
  const [showLog,         setShowLog]         = useState(false);

  const stored = localStorage.getItem("user");
  const isAdmin = stored ? JSON.parse(stored).role === "admin" : false;

  const handleSchedule = async () => {
    if (!dropOffPoint.trim()) { setError("Drop-off point is required."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/community/donations/${don._id}/schedule`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ dropOffPoint, scheduledWindow, note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Action failed.");
      onRefresh();
    } catch (err) { setError(err.message); setSubmitting(false); }
  };

  const handleAction = async (endpoint) => {
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/community/donations/${don._id}/${endpoint}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Action failed.");
      onRefresh();
    } catch (err) { setError(err.message); setSubmitting(false); }
  };

  const resetMode = () => { setMode(null); setNote(""); setError(""); };

  if (showLog) return <LogModal item={don} onClose={() => setShowLog(false)} />;

  const isOffered   = don.status === "offered";
  const isScheduled = don.status === "scheduled";
  const isTerminal  = ["received", "cancelled"].includes(don.status);
  const lastEntry   = don.actionLog?.[don.actionLog.length - 1];

  return (
    <ModalShell onClose={onClose} size="xl">
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 capitalize">{don.category} Donation</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusDotColor(don.status)}`} />
              <span className={`text-xs font-medium ${getStatusColor(don.status)}`}>
                {don.status.charAt(0).toUpperCase() + don.status.slice(1)}
              </span>
              <span className="text-xs text-gray-400 font-mono">{don.referenceCode}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Donor</p>
            <p className="text-gray-900 text-sm mt-1 font-semibold">{don.donorName}</p>
            <p className="text-gray-500 text-xs mt-0.5">{don.donorEmail}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Barangay</p>
            <p className="text-gray-900 text-sm mt-1">{don.barangay}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Item Donated</p>
            <p className="text-gray-900 text-sm mt-1">{don.itemDescription}</p>
            <p className="text-gray-500 text-xs mt-0.5 font-mono">{don.quantity} {don.unit}</p>
          </div>

          {don.dropOffPoint && (
            <div>
              <p className="text-sm font-medium text-gray-700">Drop-off Assignment</p>
              <p className="text-gray-900 text-sm mt-1">{don.dropOffPoint}</p>
              {don.scheduledWindow && (
                <p className="text-gray-500 text-xs mt-0.5">{don.scheduledWindow}</p>
              )}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700">Submitted</p>
            <p className="text-gray-900 text-sm mt-1">{formatDate(don.createdAt)}</p>
          </div>

          {lastEntry && (
            <div className={`p-3 rounded-lg border ${
              ["cancelled"].includes(don.status)
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

          {mode === "schedule" && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Drop-off Point <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={dropOffPoint}
                  onChange={(e) => setDropOffPoint(e.target.value)}
                  placeholder="e.g. Barangay San Roque Hall"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Collection Window
                </label>
                <input
                  type="text"
                  value={scheduledWindow}
                  onChange={(e) => setScheduledWindow(e.target.value)}
                  placeholder="e.g. Saturday, May 4 — 9am to 12pm"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                />
              </div>
            </div>
          )}

          {(mode === "receive" || mode === "cancel") && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Note (optional)</label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note for the record…"
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

          {isOffered && !mode && (
            <div className="flex gap-3">
              <button
                onClick={() => setMode("cancel")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setMode("schedule")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Assign Drop-off
              </button>
            </div>
          )}

          {isScheduled && !mode && (
            <div className="flex gap-3">
              <button
                onClick={() => setMode("cancel")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setMode("receive")}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Mark Received
              </button>
            </div>
          )}

          {mode === "schedule" && (
            <div className="flex gap-3">
              <button
                onClick={resetMode}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={handleSchedule}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Confirm Drop-off"}
              </button>
            </div>
          )}

          {(mode === "receive" || mode === "cancel") && (
            <div className="flex gap-3">
              <button
                onClick={resetMode}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={() => handleAction(mode)}
                disabled={submitting}
                className={`flex-1 px-4 py-2 font-semibold rounded-lg text-white transition-colors text-sm disabled:opacity-50
                  ${mode === "receive" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {submitting
                  ? "Saving…"
                  : mode === "receive" ? "Confirm Received" : "Confirm Cancel"}
              </button>
            </div>
          )}

          {isTerminal && (
            <div className={`w-full text-center py-2 rounded-lg text-sm font-medium ${
              don.status === "received" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              This donation has been {don.status}
            </div>
          )}
        </div>
    </ModalShell>
  );
}
