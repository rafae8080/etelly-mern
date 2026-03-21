import AlertTile from "../components/admin/ReportTile";
import { useState } from "react";

export default function ReportsPage() {
  const alerts = [
    {
      id: "ALT-001",
      type: "Flood",
      severity: "high",
      rescue: true,
      description: "Heavy flooding reported. Water level rising rapidly.",
      location: "Barangay Santo Niño, Zone 3",
      timestamp: "2025-01-17 14:30:00",
      reportedBy: "Juan Dela Cruz",
      hasImage: true,
      imageUrl: "src/images/flood.jpg",
    },
    {
      id: "ALT-002",
      type: "Fire",
      severity: "high",
      rescue: false,
      description: "Fire outbreak in Barangay San Isidro.",
      location: "Barangay San Isidro",
      timestamp: "2025-01-17 13:15:00",
      reportedBy: "Josephine Reyes",
      hasImage: false,
    },
    {
      id: "ALT-003",
      type: "Earthquake",
      severity: "medium",
      rescue: false,
      description: "Fallen tree blocking main road near the public market.",
      location: "Main Street, near Public Market",
      timestamp: "2025-01-17 12:45:00",
      reportedBy: "Maria Santos",
      hasImage: false,
    },
  ];
  const [selectedType, setSelectedType] = useState("All");

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Report Monitoring</h1>
        <p className="text-gray-600 mt-2">Active disaster emergency reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl ">
          <p className="text-sm text-gray-600 mb-1">Total Reports</p>
          <p className="text-3xl font-bold text-gray-900">{alerts.length}</p>
          <p className="text-sm text-blue-600 mt-2">↑ 2 new today</p>
        </div>

        <div className="bg-white p-6 rounded-xl ">
          <p className="text-sm text-gray-600 mb-1">High Priority</p>
          <p className="text-3xl font-bold text-gray-900">
            {alerts.filter((a) => a.severity === "high").length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl ">
          <p className="text-sm text-gray-600 mb-1">Rescue Needed</p>
          <p className="text-3xl font-bold text-gray-900">
            {alerts.filter((a) => a.rescue === true).length}
          </p>
        </div>
      </div>

      {/* Alert Tiles */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Recent Alerts
            </h2>
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-transparent bg-white "
            >
              {["All", ...new Set(alerts.map((a) => a.type))].map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All Categories" : type}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {alerts
            .filter((a) => selectedType === "All" || a.type === selectedType)
            .map((alert) => (
              <AlertTile key={alert.id} {...alert} />
            ))}
        </div>
      </div>
    </div>
  );
}
