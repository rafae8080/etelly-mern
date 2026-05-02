import { useState, useEffect, useCallback } from "react";
import { X, AlertTriangle, TriangleAlert } from "lucide-react";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-PH", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function splitDateTime(dateStr) {
  if (!dateStr) return { date: "", time: "" };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
  };
}

// ─── Status helpers (original style) ─────────────────────────────────────────

function getStatusColor(status) {
  switch (status) {
    case "pending":   return "text-orange-500";
    case "approved":  return "text-blue-500";
    case "fulfilled": return "text-green-500";
    case "rejected":  return "text-red-500";
    case "cancelled": return "text-red-400";
    case "offered":   return "text-orange-500";
    case "scheduled": return "text-blue-500";
    case "received":  return "text-green-500";
    default:          return "text-gray-500";
  }
}

function getStatusDotColor(status) {
  switch (status) {
    case "pending":   return "bg-orange-500";
    case "approved":  return "bg-blue-500";
    case "fulfilled": return "bg-green-500";
    case "rejected":  return "bg-red-500";
    case "cancelled": return "bg-red-400";
    case "offered":   return "bg-orange-500";
    case "scheduled": return "bg-blue-500";
    case "received":  return "bg-green-500";
    default:          return "bg-gray-500";
  }
}

function StatusCell({ status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(status)}`} />
      <span className={`font-medium ${getStatusColor(status)}`}>{label}</span>
    </div>
  );
}

// ─── Log Modal ────────────────────────────────────────────────────────────────

function LogModal({ item, onClose }) {
  const log = item.actionLog ?? [];
  const isRequest = "requesterName" in item;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col overflow-hidden">
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
                    by <span className="font-medium">{entry.by}</span> · <span className="font-mono">{formatDate(entry.at)}</span>
                  </p>
                  {entry.note && <p className="text-xs text-gray-400 mt-1 italic">"{entry.note}"</p>}
                </div>
              </div>
            );
          })}
          {log.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No actions recorded yet.</p>
          )}
        </div>
        <div className="p-6 border-t border-gray-200">
          <button onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Detail Modal ─────────────────────────────────────────────────────

function RequestDetailModal({ req, onClose, onRefresh }) {
  const [action,     setAction]     = useState(null);
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [showLog,    setShowLog]    = useState(false);

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
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900 capitalize">{req.category} Request</h2>
            <div className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium`}>
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
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={action === "reject"
                  ? "Explain why this request is rejected…"
                  : "Optional note for the record…"}
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
          <button onClick={() => setShowLog(true)}
            className="w-full py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            View action log
          </button>

          {isPending && !action && (
            <div className="flex gap-3">
              <button onClick={() => setAction("reject")}
                className="flex-1 px-4 py-2 border border-red-500 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors text-sm">
                Reject
              </button>
              <button onClick={() => setAction("approve")}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm">
                Approve
              </button>
            </div>
          )}

          {isApproved && !action && (
            <div className="flex gap-3">
              <button onClick={() => setAction("cancel")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Cancel Request
              </button>
              <button onClick={() => setAction("fulfill")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                Mark Fulfilled
              </button>
            </div>
          )}

          {action && (
            <div className="flex gap-3">
              <button onClick={resetAction}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Back
              </button>
              <button onClick={handleAction} disabled={submitting}
                className={`flex-1 px-4 py-2 font-semibold rounded-lg text-white transition-colors text-sm disabled:opacity-50
                  ${action === "approve" || action === "fulfill"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"}`}>
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

// ─── Donation Detail Modal ────────────────────────────────────────────────────

function DonationDetailModal({ don, onClose, onRefresh }) {
  const [mode,            setMode]            = useState(null);
  const [dropOffPoint,    setDropOffPoint]    = useState(don.dropOffPoint || "");
  const [scheduledWindow, setScheduledWindow] = useState(don.scheduledWindow || "");
  const [note,            setNote]            = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");
  const [showLog,         setShowLog]         = useState(false);

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
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
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
                <input type="text" value={dropOffPoint} onChange={(e) => setDropOffPoint(e.target.value)}
                  placeholder="e.g. Barangay San Roque Hall"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Collection Window</label>
                <input type="text" value={scheduledWindow} onChange={(e) => setScheduledWindow(e.target.value)}
                  placeholder="e.g. Saturday, May 4 — 9am to 12pm"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700" />
              </div>
            </div>
          )}

          {(mode === "receive" || mode === "cancel") && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Note (optional)</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
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
          <button onClick={() => setShowLog(true)}
            className="w-full py-1.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            View action log
          </button>

          {isOffered && !mode && (
            <div className="flex gap-3">
              <button onClick={() => setMode("cancel")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={() => setMode("schedule")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                Assign Drop-off
              </button>
            </div>
          )}

          {isScheduled && !mode && (
            <div className="flex gap-3">
              <button onClick={() => setMode("cancel")}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={() => setMode("receive")}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm">
                Mark Received
              </button>
            </div>
          )}

          {mode === "schedule" && (
            <div className="flex gap-3">
              <button onClick={resetMode}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Back
              </button>
              <button onClick={handleSchedule} disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50">
                {submitting ? "Saving…" : "Confirm Drop-off"}
              </button>
            </div>
          )}

          {(mode === "receive" || mode === "cancel") && (
            <div className="flex gap-3">
              <button onClick={resetMode}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Back
              </button>
              <button onClick={() => handleAction(mode)} disabled={submitting}
                className={`flex-1 px-4 py-2 font-semibold rounded-lg text-white transition-colors text-sm disabled:opacity-50
                  ${mode === "receive" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
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
      </div>
    </div>
  );
}

// ─── Requests View ────────────────────────────────────────────────────────────

const REQUEST_TABS = ["Pending", "Approved", "Fulfilled", "Rejected", "Cancelled"];

function RequestsView({ requests, loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState("Pending");
  const [selected,  setSelected]  = useState(null);
  const [search,    setSearch]    = useState("");

  const filtered = requests.filter((r) => r.status === activeTab.toLowerCase());

  const displayed = search.trim()
    ? filtered.filter((r) => {
        const term = search.toLowerCase();
        const { date, time } = splitDateTime(r.createdAt);
        return (
          r.requesterName?.toLowerCase().includes(term) ||
          r.requesterEmail?.toLowerCase().includes(term) ||
          r.barangay?.toLowerCase().includes(term) ||
          r.address?.toLowerCase().includes(term) ||
          r.itemDescription?.toLowerCase().includes(term) ||
          r.category?.toLowerCase().includes(term) ||
          date.toLowerCase().includes(term) ||
          time.toLowerCase().includes(term)
        );
      })
    : filtered;

  return (
    <div>
      {/* Tabs row + search bar */}
      <div className="flex items-end justify-between mb-6 border-b border-gray-200 bg-white px-2 py-2.5">
        <div className="flex gap-6">
          {REQUEST_TABS.map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-b-2 border-red-500 text-red-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, address, date…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: "320px" }}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Requested By</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Address</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500 text-sm">
                    {search.trim()
                      ? `No results for "${search}" in ${activeTab.toLowerCase()} requests.`
                      : `No ${activeTab.toLowerCase()} requests.`}
                  </td>
                </tr>
              ) : (
                displayed.map((req) => {
                  const { date, time } = splitDateTime(req.createdAt);
                  return (
                    <tr key={req._id} onClick={() => setSelected(req)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{req.itemDescription}</div>
                        <div className="text-xs text-gray-400 capitalize mt-0.5">{req.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {req.quantity} {req.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className={req.householdFlag ? "text-amber-600 font-semibold" : ""}>
                          {req.requesterName}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{req.barangay}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[180px]">
                        <span className="block truncate">{req.address}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{time}</td>
                      <td className="px-6 py-4 text-sm">
                        <StatusCell status={req.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <RequestDetailModal
          req={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { onRefresh(); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ─── Donations View ───────────────────────────────────────────────────────────

const DONATION_TABS = ["Offered", "Scheduled", "Received", "Cancelled"];

function DonationsView({ donations, loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState("Offered");
  const [selected,  setSelected]  = useState(null);
  const [search,    setSearch]    = useState("");

  const filtered = donations.filter((d) => d.status === activeTab.toLowerCase());

  const displayed = search.trim()
    ? filtered.filter((d) => {
        const term = search.toLowerCase();
        const { date, time } = splitDateTime(d.createdAt);
        return (
          d.donorName?.toLowerCase().includes(term) ||
          d.donorEmail?.toLowerCase().includes(term) ||
          d.barangay?.toLowerCase().includes(term) ||
          d.itemDescription?.toLowerCase().includes(term) ||
          d.category?.toLowerCase().includes(term) ||
          d.referenceCode?.toLowerCase().includes(term) ||
          d.dropOffPoint?.toLowerCase().includes(term) ||
          date.toLowerCase().includes(term) ||
          time.toLowerCase().includes(term)
        );
      })
    : filtered;

  return (
    <div>
      {/* Tabs row + search bar */}
      <div className="flex items-end justify-between mb-6 border-b border-gray-200 bg-white px-2 py-2.5">
        <div className="flex gap-6">
          {DONATION_TABS.map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-b-2 border-green-500 text-green-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ref code, date…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: "320px" }}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Donated By</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Barangay</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ref Code</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Drop-off</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-gray-500 text-sm">
                    {search.trim()
                      ? `No results for "${search}" in ${activeTab.toLowerCase()} donations.`
                      : `No ${activeTab.toLowerCase()} donations.`}
                  </td>
                </tr>
              ) : (
                displayed.map((don) => {
                  const { date, time } = splitDateTime(don.createdAt);
                  return (
                    <tr key={don._id} onClick={() => setSelected(don)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{don.itemDescription}</div>
                        <div className="text-xs text-gray-400 capitalize mt-0.5">{don.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {don.quantity} {don.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{don.donorName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{don.barangay}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">{don.referenceCode}</td>
                      <td className="px-6 py-4 text-sm">
                        {don.dropOffPoint
                          ? <span className="text-blue-600">{don.dropOffPoint}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{time}</td>
                      <td className="px-6 py-4 text-sm">
                        <StatusCell status={don.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DonationDetailModal
          don={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { onRefresh(); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA — DELETE THIS BLOCK WHEN BACKEND IS READY
// (everything from here down to the closing bracket of SAMPLE_DONATIONS)
const SAMPLE_REQUESTS = [
  {
    _id: "req001",
    requesterName: "Kenneth Bulan",
    requesterEmail: "kenneth.bulan@email.com",
    barangay: "Dela Paz",
    address: "123 Sampaguita St., Dela Paz",
    category: "food",
    itemDescription: "Rice 5kg sack",
    quantity: 2,
    unit: "sacks",
    reason: "Lost all food supply during flooding",
    status: "pending",
    householdFlag: true,
    actionLog: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    _id: "req002",
    requesterName: "Maria Santos",
    requesterEmail: "maria.santos@email.com",
    barangay: "San Roque",
    address: "45 Rizal Ave., San Roque",
    category: "water",
    itemDescription: "Bottled water 1L",
    quantity: 24,
    unit: "bottles",
    reason: "Water supply contaminated",
    status: "pending",
    householdFlag: false,
    actionLog: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    _id: "req003",
    requesterName: "Juan Dela Cruz",
    requesterEmail: "juan.delacruz@email.com",
    barangay: "Mayamot",
    address: "78 Mabini St., Mayamot",
    category: "clothing",
    itemDescription: "Adult clothing assorted sizes",
    quantity: 5,
    unit: "sets",
    reason: "Clothes swept away by flood",
    status: "approved",
    householdFlag: false,
    actionLog: [
      { action: "approved", by: "Admin Rafael", note: "Verified with barangay captain", at: new Date(Date.now() - 1000 * 60 * 20).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    _id: "req004",
    requesterName: "Ana Reyes",
    requesterEmail: "ana.reyes@email.com",
    barangay: "Bagong Nayon",
    address: "12 Maliksi St., Bagong Nayon",
    category: "medicine",
    itemDescription: "First aid kit",
    quantity: 1,
    unit: "kit",
    reason: "Needed for elderly family member",
    status: "fulfilled",
    householdFlag: false,
    actionLog: [
      { action: "approved", by: "Admin Rafael", note: "", at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
      { action: "fulfilled", by: "Admin Rafael", note: "Delivered by barangay tanod", at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    _id: "req005",
    requesterName: "Roberto Tan",
    requesterEmail: "roberto.tan@email.com",
    barangay: "Cupang",
    address: "99 Aguinaldo St., Cupang",
    category: "shelter",
    itemDescription: "Tarpaulin 8x10ft",
    quantity: 2,
    unit: "pcs",
    reason: "Roof damaged",
    status: "rejected",
    householdFlag: false,
    actionLog: [
      { action: "rejected", by: "Admin Rafael", note: "Insufficient stock — refer to DSWD for tarpaulin assistance", at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    _id: "req006",
    requesterName: "Lisa Garcia",
    requesterEmail: "lisa.garcia@email.com",
    barangay: "Mambugan",
    address: "34 Kalayaan St., Mambugan",
    category: "hygiene",
    itemDescription: "Hygiene kit (soap, toothbrush, shampoo)",
    quantity: 3,
    unit: "kits",
    reason: "",
    status: "cancelled",
    householdFlag: false,
    actionLog: [
      { action: "cancelled", by: "Admin Rafael", note: "Requester picked up from relief center instead", at: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
];

const SAMPLE_DONATIONS = [
  {
    _id: "don001",
    donorName: "Pedro Cruz",
    donorEmail: "pedro.cruz@email.com",
    barangay: "San Juan",
    category: "food",
    itemDescription: "Canned goods assorted",
    quantity: 50,
    unit: "cans",
    referenceCode: "DON-AB3XY",
    status: "offered",
    dropOffPoint: "",
    scheduledWindow: "",
    actionLog: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    _id: "don002",
    donorName: "Carla Mendoza",
    donorEmail: "carla.mendoza@email.com",
    barangay: "San Luis",
    category: "clothing",
    itemDescription: "Used clothing — children sizes",
    quantity: 30,
    unit: "pcs",
    referenceCode: "DON-QR7WZ",
    status: "scheduled",
    dropOffPoint: "Barangay San Luis Hall",
    scheduledWindow: "Sat, May 10 — 9am to 12pm",
    actionLog: [
      { action: "scheduled", by: "Admin Rafael", note: "", at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    _id: "don003",
    donorName: "Jose Bautista",
    donorEmail: "jose.bautista@email.com",
    barangay: "Inarawan",
    category: "water",
    itemDescription: "Mineral water 1.5L",
    quantity: 100,
    unit: "bottles",
    referenceCode: "DON-KP4NM",
    status: "received",
    dropOffPoint: "CDRRMO Office, Antipolo City Hall",
    scheduledWindow: "Fri, May 9 — 1pm to 5pm",
    actionLog: [
      { action: "scheduled", by: "Admin Rafael", note: "", at: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString() },
      { action: "received", by: "Admin Rafael", note: "All 100 bottles received in good condition", at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    _id: "don004",
    donorName: "Elena Villanueva",
    donorEmail: "elena.villanueva@email.com",
    barangay: "Dalig",
    category: "other",
    itemDescription: "Sleeping mats",
    quantity: 10,
    unit: "pcs",
    referenceCode: "DON-HT2VB",
    status: "cancelled",
    dropOffPoint: "",
    scheduledWindow: "",
    actionLog: [
      { action: "cancelled", by: "Admin Rafael", note: "Donor could not make it to drop-off", at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
  },
];
// END SAMPLE DATA ─────────────────────────────────────────────────────────────

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunitySharingPage() {
  const [activeTab,  setActiveTab]  = useState("requests");
  const [requests,   setRequests]   = useState(SAMPLE_REQUESTS);   // TODO: change back to useState([])
  const [donations,  setDonations]  = useState(SAMPLE_DONATIONS);  // TODO: change back to useState([])
  const [reqLoading, setReqLoading] = useState(true);
  const [donLoading, setDonLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/community/requests`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch { } finally { setReqLoading(false); }
  }, []);

  const fetchDonations = useCallback(async () => {
    setDonLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/community/donations`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setDonations(data.donations);
    } catch { } finally { setDonLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); fetchDonations(); }, [fetchRequests, fetchDonations]);

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Community Sharing</h1>
      </div>

      {/* Requests / Donations toggle */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: "requests",  label: "Requests"  },
          { key: "donations", label: "Donations" },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "requests"
        ? <RequestsView  requests={requests}   loading={reqLoading} onRefresh={fetchRequests}  />
        : <DonationsView donations={donations} loading={donLoading} onRefresh={fetchDonations} />
      }
    </div>
  );
}
