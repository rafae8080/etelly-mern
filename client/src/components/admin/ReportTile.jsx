// client/src/components/admin/ReportTile.jsx
import { useState } from "react";
import { X, CheckCircle, XCircle, Clock } from "lucide-react";

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
  onApprove,
  onReject,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  // Extract location string - handle both string and object
  const getLocationString = () => {
    if (typeof location === "string") {
      return location;
    }
    if (location && typeof location === "object") {
      return (
        location.exactAddress ||
        location.barangay ||
        location.city ||
        "Unknown location"
      );
    }
    return "Unknown location";
  };

  const getIconColor = () => {
    if (type === "Flood") return "text-cyan-600 bg-cyan-50";
    if (type === "Fire") return "text-red-600 bg-red-50";
    if (type === "Earthquake") return "text-orange-600 bg-orange-50";
    return "text-blue-600 bg-blue-50";
  };

  const iconColor = getIconColor();

  const severityClass =
    severity === "high"
      ? "bg-red-100 text-red-700"
      : severity === "medium"
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";

  const getStatusDisplay = () => {
    if (currentStatus === "approved") {
      return {
        icon: CheckCircle,
        text: "Approved",
        class: "bg-green-100 text-green-700",
      };
    } else if (currentStatus === "rejected") {
      return {
        icon: XCircle,
        text: "Rejected",
        class: "bg-red-100 text-red-700",
      };
    } else {
      return {
        icon: Clock,
        text: "Pending",
        class: "bg-yellow-100 text-yellow-700",
      };
    }
  };

  const StatusIcon = getStatusDisplay().icon;
  const statusDisplay = getStatusDisplay();

  const handleApprove = async (e) => {
    e.stopPropagation();
    if (onApprove && currentStatus === "pending") {
      setIsUpdating(true);
      try {
        await onApprove(id, "approved", "Approved by admin");
        setCurrentStatus("approved");
        alert("Report approved successfully!");
      } catch (error) {
        console.error("Error approving:", error);
        alert("Failed to approve report");
      }
      setIsUpdating(false);
      setIsModalOpen(false);
    }
  };

  const handleReject = async (e) => {
    e.stopPropagation();
    if (onReject && currentStatus === "pending") {
      setIsUpdating(true);
      try {
        await onReject(id, "rejected", "Rejected by admin");
        setCurrentStatus("rejected");
        alert("Report rejected successfully!");
      } catch (error) {
        console.error("Error rejecting:", error);
        alert("Failed to reject report");
      }
      setIsUpdating(false);
      setIsModalOpen(false);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const locationString = getLocationString();

  return (
    <>
      {/* Alert Tile */}
      <div
        onClick={openModal}
        className={`bg-white p-4 rounded-xl border ${
          currentStatus === "approved"
            ? "border-green-300 hover:border-green-500"
            : currentStatus === "rejected"
              ? "border-red-300 hover:border-red-500"
              : "border-gray-200 hover:border-red-500"
        } cursor-pointer hover:shadow-md transition-all`}
      >
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <span className="text-lg">📋</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900">
                    {type}
                  </h3>
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${statusDisplay.class}`}
                  >
                    <StatusIcon size={12} />
                    <span>{statusDisplay.text}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {description}
                </p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${severityClass}`}
              >
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
                <div
                  className={`mt-1 inline-flex px-2 py-0.5 rounded text-xs font-medium items-center gap-1 ${statusDisplay.class}`}
                >
                  <StatusIcon size={12} />
                  <span>Status: {statusDisplay.text}</span>
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
                <img
                  src={imageUrl}
                  alt={`${type} incident`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Severity Level
                </p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${severityClass}`}
                >
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
                <p className="text-sm font-medium text-gray-700">
                  Rescue Needed
                </p>
                <p className="text-sm mt-1">{rescue ? "Yes" : "No"}</p>
              </div>

              {/* Admin Notes */}
              {adminNotes && (
                <div
                  className={`p-3 rounded-lg ${
                    currentStatus === "rejected"
                      ? "bg-red-50 border border-red-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {currentStatus === "rejected"
                      ? "Rejection Reason"
                      : "Admin Notes"}
                    :
                  </p>
                  <p className="text-sm mt-1">{adminNotes}</p>
                </div>
              )}
            </div>

            {/* Actions - Only show for pending reports */}
            {currentStatus === "pending" && (
              <div className="flex gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={handleReject}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 border border-red-500 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? "Processing..." : "Reject Report"}
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

            {/* Status message for already processed reports */}
            {currentStatus !== "pending" && (
              <div className="p-6 border-t border-gray-200">
                <div
                  className={`w-full text-center py-2 rounded-lg text-sm font-medium ${
                    currentStatus === "approved"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  This report has been {currentStatus}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
