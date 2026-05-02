// client/src/pages/ReportPage.jsx
import ReportTile from "../components/admin/ReportTile";
import { useState, useEffect } from "react";
import { connectSocket } from "../utils/socket";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState("All");
  const [error, setError] = useState(null);

  // Fetch reports when page loads
  useEffect(() => {
    fetchReports();

    const socket = connectSocket();

    socket.on("new_emergency_report", (newReport) => {
      console.log("New report received:", newReport);
      fetchReports(); // Refresh the list when new report comes
    });

    socket.on("report_updated", (data) => {
      console.log("Report updated:", data);
      fetchReports(); // Refresh the list when status changes
    });

    return () => {
      socket.off("new_emergency_report");
      socket.off("report_updated");
    };
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use localhost instead of 192.168.1.20
      const response = await fetch("http://localhost:5000/api/reports", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Data received:", data);

      if (data.success && data.reports) {
        console.log("Number of reports:", data.reports.length);

        const formattedReports = data.reports.map((report) => ({
          id: report._id || report.id,
          type:
            report.emergencyType?.charAt(0).toUpperCase() +
            report.emergencyType?.slice(1),
          severity: report.severity?.toLowerCase(),
          rescue: report.emergencyType === "rescue",
          description: report.description || "No description provided",
          location:
            report.location?.exactAddress ||
            report.location ||
            "Unknown location",
          timestamp: new Date(report.timestamp).toLocaleString(),
          reportedBy:
            report.userData?.fullName || report.userName || "Anonymous",
          hasImage: report.images?.length > 0,
          imageUrl: report.images?.[0] || null,
          status: report.status || "pending",
          adminNotes: report.adminNotes || null,
        }));

        setReports(formattedReports);
      } else {
        console.log("No reports found");
        setReports([]);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId, status, adminNotes) => {
    try {
      console.log("Updating report:", reportId, "to:", status);

      const response = await fetch(
        "http://localhost:5000/api/reports/update-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reportId,
            status,
            adminNotes,
            adminEmail: "admin@navotas.gov.ph",
          }),
        },
      );

      const data = await response.json();
      console.log("Update response:", data);

      if (data.success) {
        alert(`Report ${status} successfully!`);
        await fetchReports(); // Refresh the list after update
        return true;
      } else {
        alert("Failed to update report status");
        return false;
      }
    } catch (error) {
      console.error("Error updating report:", error);
      alert("Failed to update report");
      return false;
    }
  };

  const totalReports = reports.length;
  const highPriorityCount = reports.filter((r) => r.severity === "high").length;
  const rescueNeededCount = reports.filter((r) => r.rescue === true).length;
  const newTodayCount = reports.filter((r) => {
    if (!r.timestamp) return false;
    const today = new Date().toDateString();
    return new Date(r.timestamp).toDateString() === today;
  }).length;

  const filteredReports = reports.filter(
    (alert) => selectedType === "All" || alert.type === selectedType,
  );

  const getUniqueTypes = () => {
    const types = reports.map((r) => r.type).filter(Boolean);
    return ["All", ...new Set(types)];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500 text-center">
          <p>Error loading reports: {error}</p>
          <button
            onClick={fetchReports}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Report Monitoring
          </h1>
          <p className="text-gray-600 mt-2">
            Active disaster emergency reports
          </p>
        </div>
        <div>
          <button
            onClick={fetchReports}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
          >
            Refresh Reports
          </button>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Total Reports</p>
          <p className="text-3xl font-bold text-gray-900">{totalReports}</p>
          {newTodayCount > 0 && (
            <p className="text-sm text-blue-600 mt-2">
              ↑ {newTodayCount} new today
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">High Priority</p>
          <p className="text-3xl font-bold text-red-600">{highPriorityCount}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-1">Rescue Needed</p>
          <p className="text-3xl font-bold text-orange-600">
            {rescueNeededCount}
          </p>
        </div>
      </div>

      {/* Alert Tiles */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Alerts</h2>
          <div className="w-48">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {getUniqueTypes().map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All Categories" : type}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No reports found</p>
              <p className="text-sm text-gray-400 mt-2">
                Submit a report from the mobile app to see it here
              </p>
            </div>
          ) : (
            filteredReports.map((alert) => (
              <ReportTile
                key={alert.id}
                {...alert}
                onApprove={updateReportStatus}
                onReject={updateReportStatus}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
