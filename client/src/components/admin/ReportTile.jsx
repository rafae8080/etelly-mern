import { useState } from "react";
import { Info, X, Waves, Stone, Flame, BrickWall } from "lucide-react";

export default function AlertTile({
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
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getReportIcon = () => {
    if (type === "Flood") return Waves;
    if (type === "Fire") return Flame;
    if (type === "Earthquake") return Stone;
    return Info;
  };

  const getReportColor = () => {
    if (type === "Flood") return "text-red-600 bg-red-50";
    if (type === "Fire") return "text-red-600 bg-red-50";
    if (type === "Earthquake") return "text-orange-600 bg-orange-50";
    return "text-blue-600 bg-blue-50";
  };

  const Icon = getReportIcon();
  const iconColor = getReportColor();

  const severityClass =
    severity === "high"
      ? "bg-red-100 text-red-700"
      : severity === "medium"
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";

  const handleApprove = () => {
    alert(`Alert ${id} approved!`);
    setIsModalOpen(false);
    // TODO: Call API PATCH /api/alerts/:id { status: "approved" }
  };

  const handleReject = () => {
    alert(`Alert ${id} rejected!`);
    setIsModalOpen(false);
    // TODO: Call API PATCH /api/alerts/:id { status: "rejected" }
  };

  return (
    <>
      {/* Alert Tile */}
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-white p-4 rounded-xl border border-gray-400 hover:border-red-500 cursor-pointer hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">
                  {type}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${severityClass}`}
              >
                {severity.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>{location}</span>
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
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${iconColor}`}>
                  <Icon size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{type}</h2>
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
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Severity Level
                </p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${severityClass}`}
                >
                  {severity.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Description
                </p>
                <p className="text-gray-900 text-xs">{description}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Location
                </p>
                <p className="text-gray-900 text-xs">{location}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Reported At
                </p>
                <p className="text-gray-900 text-xs">{timestamp}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Reported By
                </p>
                <p className="text-gray-900 text-xs">{reportedBy}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Rescue Needed
                </p>
                {rescue ? (
                  <span className="text-red-700 font-medium">Yes</span>
                ) : (
                  <span className="text-gray-700 font-medium">No</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6">
              <button
                onClick={handleReject}
                className="flex-1 px-1 py-1 border border-red-500 opacity-85 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors text-sm"
              >
                Reject Report
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 px-1 py-2 border-2 border-green-600 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                Approve Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
