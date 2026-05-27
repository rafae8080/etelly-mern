import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { API_BASE, authHeaders, formatDate, getStatusColor, getStatusDotColor } from "./helpers";
import LogModal from "./LogModal";

export default function DonationDetailModal({ don, onClose, onRefresh }) {
  const [mode,      setMode]      = useState(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [note,      setNote]      = useState("");
  const [matchedRequestId, setMatchedRequestId] = useState("");
  const [boardRequests,    setBoardRequests]    = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]     = useState("");
  const [showLog,    setShowLog]   = useState(false);

  const stored = localStorage.getItem("user");
  const isAdmin = stored ? ["admin", "barangay_official"].includes(JSON.parse(stored).role) : false;

  // Fetch open requests from the board when schedule mode opens, to allow linking
  useEffect(() => {
    if (mode !== "schedule") return;
    const barangay = don.barangay;
    const qs = barangay ? `?barangay=${encodeURIComponent(barangay)}` : "";
    fetch(`${API_BASE}/api/community/board${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setBoardRequests(data.requests || []);
      })
      .catch(() => {});
  }, [mode, don.barangay]);

  const handleSchedule = async () => {
    if (!schedDate) { setError("Please select a date."); return; }
    const scheduledWindow = schedTime.trim()
      ? `${schedDate} — ${schedTime.trim()}`
      : schedDate;
    setSubmitting(true); setError("");
    try {
      const body = { scheduledWindow, note };
      if (matchedRequestId) body.matchedRequestId = matchedRequestId;
      const res = await fetch(`${API_BASE}/api/community/donations/${don._id}/schedule`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
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

  const resetMode = () => {
    setMode(null);
    setSchedDate(""); setSchedTime(""); setNote("");
    setMatchedRequestId(""); setBoardRequests([]);
    setError("");
  };

  if (showLog) return <LogModal item={don} onClose={() => setShowLog(false)} />;

  const isOffered   = don.status === "offered";
  const isScheduled = don.status === "scheduled";
  const isTerminal  = ["received", "cancelled"].includes(don.status);
  const lastEntry   = don.actionLog?.[don.actionLog.length - 1];

  return (
    <ModalShell onClose={onClose} size="xl">
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 capitalize">
              {don.category} Donation
              {don.isOfficial && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 align-middle">
                  CDRRMO Official
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusDotColor(don.status)}`} />
              <span className={`text-xs font-medium ${getStatusColor(don.status)}`}>
                {don.status.charAt(0).toUpperCase() + don.status.slice(1)}
              </span>
              <span className="text-xs text-gray-400 font-mono">{don.referenceCode}</span>
              {don.matchedRequestId && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                  Linked to request
                </span>
              )}
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
            <p className="text-sm font-medium text-gray-700">Drop-off Barangay</p>
            <p className="text-gray-900 text-sm mt-1 capitalize">{don.barangay || "—"}</p>
          </div>

          {don.pickupAddress && (
            <div>
              <p className="text-sm font-medium text-gray-700">Donor Address</p>
              <p className="text-gray-900 text-sm mt-1">{don.pickupAddress}</p>
            </div>
          )}

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
                  Drop-off Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Time Window</label>
                <input
                  type="text"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  placeholder="e.g. 9am to 12pm"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                />
              </div>
              {boardRequests.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Link to Open Request <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={matchedRequestId}
                    onChange={(e) => setMatchedRequestId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                  >
                    <option value="">— None —</option>
                    {boardRequests.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.requesterName} · {r.itemDescription} ({r.quantity} {r.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
