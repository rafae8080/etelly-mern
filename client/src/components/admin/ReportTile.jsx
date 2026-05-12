import { useState } from "react";
import {
  X,
  Droplets, Flame, Activity, Mountain, Heart, LifeBuoy, FileText,
} from "lucide-react";

export default function ReportTile({
  id,
  type,
  severity,
  rescue,
  description,
  location,
  timestamp,
  reportedBy,
  hasImage,
  imageUrl,
  status = "pending",
  adminNotes = null,
  resolvedBy = null,
  resolvedAt = null,
  resolutionNotes = null,
  logs = [],
  onApprove,
  onReject,
  onResolve,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [resolveBy, setResolveBy] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const stored = localStorage.getItem("user");
  const isAdmin = stored ? JSON.parse(stored).role === "admin" : false;

  const getLocationString = () => {
    if (typeof location === "string") return location;
    if (location && typeof location === "object")
      return location.exactAddress || location.barangay || location.city || "Unknown location";
    return "Unknown location";
  };

  const getIconColor = () => {
    if (type === "Flood")      return "text-cyan-600 bg-cyan-50";
    if (type === "Fire")       return "text-red-600 bg-red-50";
    if (type === "Earthquake") return "text-orange-600 bg-orange-50";
    if (type === "Landslide")  return "text-amber-600 bg-amber-50";
    if (type === "Rescue")     return "text-red-600 bg-red-50";
    if (type === "Medical")    return "text-pink-600 bg-pink-50";
    return "text-blue-600 bg-blue-50";
  };

  const getTypeIcon = () => {
    if (type === "Flood")      return Droplets;
    if (type === "Fire")       return Flame;
    if (type === "Earthquake") return Activity;
    if (type === "Landslide")  return Mountain;
    if (type === "Rescue")     return LifeBuoy;
    if (type === "Medical")    return Heart;
    return FileText;
  };

  const iconColor = getIconColor();
  const TypeIcon = getTypeIcon();

  const severityClass =
    severity === "high"
      ? "bg-red-100 text-red-700"
      : severity === "medium"
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";

  const getStatusDisplay = () => {
    if (currentStatus === "approved")
      return { dot: "bg-blue-500 animate-pulse",   text: "Ongoing",  textClass: "text-blue-600" };
    if (currentStatus === "rejected")
      return { dot: "bg-red-500",                   text: "Rejected", textClass: "text-red-600" };
    if (currentStatus === "resolved")
      return { dot: "bg-green-500",                 text: "Resolved", textClass: "text-green-600" };
    return   { dot: "bg-orange-400 animate-pulse",  text: "Pending",  textClass: "text-orange-500" };
  };

  const statusDisplay = getStatusDisplay();

  const handleApprove = async (e) => {
    e.stopPropagation();
    if (!onApprove || currentStatus !== "pending") return;
    setIsUpdating(true);
    try {
      await onApprove(id, "approved", "Approved by admin");
      setCurrentStatus("approved");
    } catch {}
    setIsUpdating(false);
    setIsModalOpen(false);
  };

  const handleReject = async (e) => {
    e.stopPropagation();
    if (!onReject || currentStatus !== "pending") return;
    setIsUpdating(true);
    try {
      await onReject(id, "rejected", rejectReason.trim() || "Rejected by admin");
      setCurrentStatus("rejected");
      setShowRejectForm(false);
      setRejectReason("");
    } catch {}
    setIsUpdating(false);
    setIsModalOpen(false);
  };

  const handleResolve = async (e) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      const ok = await onResolve?.(id, resolveBy.trim(), resolveNotes.trim());
      if (ok) {
        setCurrentStatus("resolved");
        setIsModalOpen(false);
      }
    } catch {}
    setIsUpdating(false);
  };

  const locationString = getLocationString();

  return (
    <>
      {/* Tile */}
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-white p-4 rounded-xl border border-gray-200 hover:border-gray-400 cursor-pointer hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <TypeIcon size={18} strokeWidth={1.8} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900">{type}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDisplay.dot}`} />
                    <span className={`text-xs font-semibold ${statusDisplay.textClass}`}>{statusDisplay.text}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${severityClass}`}>
                {severity?.toUpperCase() || "MEDIUM"}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span className="truncate">{locationString}</span>
              <span>{timestamp}</span>
              {rescue && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  Rescue needed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{type}</h2>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDisplay.dot}`} />
                  <span className={`text-sm font-semibold ${statusDisplay.textClass}`}>{statusDisplay.text}</span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Image */}
            {hasImage && imageUrl && (
              <div className="relative w-full h-64 overflow-hidden bg-gray-100">
                <img src={imageUrl} alt={`${type} incident`} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Details */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Severity Level</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${severityClass}`}>
                  {severity?.toUpperCase() || "MEDIUM"}
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Description</p>
                <p className="text-gray-900 text-sm mt-1">{description}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Location</p>
                <p className="text-gray-900 text-sm mt-1">{locationString}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Reported At</p>
                <p className="text-gray-900 text-sm mt-1">{timestamp}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Reported By</p>
                <p className="text-gray-900 text-sm mt-1">{reportedBy}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Rescue Needed</p>
                <p className="text-sm mt-1">{rescue ? "Yes" : "No"}</p>
              </div>

              {adminNotes && (
                <div className={`p-3 rounded-lg ${currentStatus === "rejected" ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"}`}>
                  <p className="text-sm font-medium">
                    {currentStatus === "rejected" ? "Rejection Reason" : "Admin Notes"}:
                  </p>
                  <p className="text-sm mt-1">{adminNotes}</p>
                </div>
              )}

              {/* Activity Log — admin only */}
              {isAdmin && logs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Activity Log</p>
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center pt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                          {i < logs.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1 mb-0.5" />}
                        </div>
                        <div className="pb-2">
                          <span className="font-semibold text-gray-700 capitalize">{log.action}</span>
                          <span className="text-gray-500"> by {log.by}</span>
                          {log.notes && <p className="text-gray-500 mt-0.5">{log.notes}</p>}
                          <p className="text-gray-400 mt-0.5">
                            {new Date(log.at).toLocaleString("en-PH", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            {currentStatus === "pending" && (
              <div className="p-6 border-t border-gray-200">
                {showRejectForm ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Reason for Rejection</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this report is being rejected…"
                      rows={3}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowRejectForm(false); setRejectReason(""); }}
                        disabled={isUpdating}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={isUpdating}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                      >
                        {isUpdating ? "Processing..." : "Confirm Rejection"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowRejectForm(true); }}
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2 border border-red-500 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                    >
                      Reject Report
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdating ? "Processing..." : "Approve Report"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentStatus === "approved" && (
              <div className="p-6 border-t border-gray-200 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Mark as Resolved</p>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Responded by</label>
                  <input
                    type="text"
                    value={resolveBy}
                    onChange={(e) => setResolveBy(e.target.value)}
                    placeholder="Name or team who responded"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Resolution notes</label>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="What actions were taken? What was the outcome?"
                    rows={3}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>
                <button
                  onClick={handleResolve}
                  disabled={isUpdating}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? "Processing..." : "Mark as Resolved"}
                </button>
              </div>
            )}

            {currentStatus === "rejected" && (
              <div className="p-6 border-t border-gray-200">
                <div className="w-full text-center py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700">
                  This report has been rejected
                </div>
              </div>
            )}

            {currentStatus === "resolved" && (
              <div className="p-6 border-t border-gray-200">
                <div className="w-full text-center py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700">
                  Resolved{resolvedBy ? ` by ${resolvedBy}` : ""}
                  {resolvedAt ? ` · ${new Date(resolvedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </div>
                {resolutionNotes && (
                  <p className="text-xs text-gray-500 text-center mt-2">{resolutionNotes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
