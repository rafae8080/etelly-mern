// client/src/components/map/reports/ReportsLayer.jsx
import { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { connectSocket } from "../../../utils/socket";

// Custom marker icons based on report type
const createReportIcon = (type) => {
  const icons = {
    flood: { emoji: "🌊", color: "#06b6d4" },
    rescue: { emoji: "🆘", color: "#ef4444" },
    medical: { emoji: "🏥", color: "#ec4899" },
    earthquake: { emoji: "🏚️", color: "#f97316" },
    landslide: { emoji: "⛰️", color: "#8b5cf6" },
    fire: { emoji: "🔥", color: "#dc2626" },
    other: { emoji: "⚠️", color: "#6b7280" },
  };

  const { emoji, color } = icons[type?.toLowerCase()] || icons.other;

  return L.divIcon({
    className: "custom-report-marker",
    html: `
      <div style="
        background: white;
        border: 3px solid ${color};
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        font-size: 18px;
        transition: all 0.2s;
      ">
        ${emoji}
      </div>
      ${
        type === "rescue"
          ? `
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 12px;
          height: 12px;
          background: #ef4444;
          border: 2px solid white;
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
      `
          : ""
      }
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

// Add pulse animation
const style = document.createElement("style");
style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  .report-popup {
    font-family: system-ui, -apple-system, sans-serif;
  }
  .report-popup img {
    cursor: pointer;
    transition: transform 0.2s;
  }
  .report-popup img:hover {
    transform: scale(1.05);
  }
`;
document.head.appendChild(style);

export default function ReportsLayer({ visible, filters = {} }) {
  const map = useMap();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const markersLayerRef = useRef(null);
  const socketRef = useRef(null);

  // Fetch approved reports from API
  const fetchApprovedReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "http://localhost:5000/api/reports/approved",
      );
      const data = await response.json();

      if (data.success && data.reports) {
        console.log(`📋 Fetched ${data.reports.length} approved reports`);
        setReports(data.reports);
      }
    } catch (error) {
      console.error("Error fetching approved reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on selected types
  const filteredReports = reports.filter((report) => {
    // If no filters or "all" is selected, show all
    if (
      !filters.types ||
      filters.types.length === 0 ||
      filters.types.includes("all")
    ) {
      return true;
    }

    // Filter by emergency type
    const reportType = report.emergencyType?.toLowerCase();
    return filters.types.includes(reportType);
  });

  // Initialize markers layer
  useEffect(() => {
    if (!map) return;

    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current);
      }
    };
  }, [map]);

  // Update markers when visibility, reports, or filters change
  useEffect(() => {
    if (!markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // If layer is not visible or no reports, stop here
    if (!visible || !filteredReports.length) return;

    console.log(`🗺️ Rendering ${filteredReports.length} report markers`);

    // Add markers for each filtered report
    filteredReports.forEach((report) => {
      const coords = extractCoordinates(report);
      if (!coords) return;

      const marker = L.marker(coords, {
        icon: createReportIcon(report.emergencyType),
      });

      const popupContent = createPopupContent(report);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        minWidth: 250,
      });

      marker.addTo(markersLayerRef.current);
    });
  }, [visible, filteredReports, map]);

  // Socket connection and real-time updates
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    // Initial fetch
    fetchApprovedReports();

    // Listen for new emergency reports
    socket.on("new_emergency_report", (newReport) => {
      console.log("🆕 New report received via socket:", newReport);

      // Only add if it's already approved (rare for new reports)
      if (newReport.status === "approved") {
        setReports((prev) => {
          // Check if report already exists
          const exists = prev.some((r) => r._id === newReport._id);
          if (exists) return prev;
          return [...prev, newReport];
        });
      }
    });

    // Listen for report status updates (approvals/rejections)
    socket.on("report_status_updated", (data) => {
      console.log("📝 Report status updated:", data);

      const { reportId, status, report } = data;

      setReports((prev) => {
        if (status === "approved") {
          // Add or update the report
          const exists = prev.some((r) => r._id === reportId);
          if (exists) {
            return prev.map((r) => (r._id === reportId ? report : r));
          } else {
            return [...prev, report];
          }
        } else {
          // Remove if status changed from approved to something else
          return prev.filter((r) => r._id !== reportId);
        }
      });
    });

    // Auto-refresh every 2 minutes (ideal for emergencies)
    const refreshInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing reports...");
      fetchApprovedReports();
    }, 120000); // 2 minutes

    return () => {
      socket.off("new_emergency_report");
      socket.off("report_status_updated");
      clearInterval(refreshInterval);
    };
  }, []);

  return null;
}

// Extract coordinates from report
function extractCoordinates(report) {
  // Check for latitude/longitude fields directly
  if (report.latitude && report.longitude) {
    const lat = parseFloat(report.latitude);
    const lng = parseFloat(report.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }

  // Check location object
  if (report.location) {
    if (report.location.lat && report.location.lng) {
      return [report.location.lat, report.location.lng];
    }
    if (report.location.latitude && report.location.longitude) {
      return [report.location.latitude, report.location.longitude];
    }
  }

  console.warn("⚠️ Report missing valid coordinates:", report._id);
  return null;
}

// Create popup content
function createPopupContent(report) {
  const time = new Date(report.timestamp).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const location =
    report.location?.exactAddress ||
    report.location?.barangay ||
    "Location not specified";

  const userName = report.userData?.fullName || report.userName || "Anonymous";

  const images = report.images || [];
  const hasImages = images.length > 0;

  const severityBadge = {
    high: '<span style="background: #fee2e2; color: #991b1b;">🔴 HIGH</span>',
    medium:
      '<span style="background: #fef3c7; color: #92400e;">🟡 MEDIUM</span>',
    low: '<span style="background: #dbeafe; color: #1e40af;">🔵 LOW</span>',
  };

  const severityHtml = severityBadge[report.severity?.toLowerCase()] || "";

  return `
    <div class="report-popup">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="
          font-weight: 700;
          font-size: 16px;
          margin: 0;
          color: #1f2937;
        ">
          ${report.emergencyType?.toUpperCase() || "REPORT"}
        </h3>
        ${severityHtml}
      </div>
      
      ${
        hasImages
          ? `
        <div style="margin-bottom: 12px;">
          <img 
            src="${images[0]}" 
            alt="Report" 
            onclick="window.open('${images[0]}', '_blank')"
            style="
              width: 100%;
              max-height: 150px;
              object-fit: cover;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            "
          />
          ${
            images.length > 1
              ? `
            <p style="
              font-size: 11px;
              color: #6b7280;
              margin-top: 4px;
              text-align: center;
            ">
              +${images.length - 1} more image(s)
            </p>
          `
              : ""
          }
        </div>
      `
          : ""
      }
      
      <p style="
        font-size: 14px;
        margin: 12px 0;
        color: #374151;
        line-height: 1.5;
      ">
        ${report.description || "No description provided"}
      </p>
      
      <div style="
        background: #f9fafb;
        padding: 8px 12px;
        border-radius: 6px;
        margin: 12px 0;
        font-size: 12px;
      ">
        <div style="display: flex; gap: 8px; margin-bottom: 4px;">
          <span style="color: #6b7280; min-width: 70px;">📍 Location:</span>
          <span style="color: #1f2937; font-weight: 500;">${location}</span>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 4px;">
          <span style="color: #6b7280; min-width: 70px;">🕐 Time:</span>
          <span style="color: #1f2937;">${time}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <span style="color: #6b7280; min-width: 70px;">👤 Reported by:</span>
          <span style="color: #1f2937;">${userName}</span>
        </div>
      </div>
      
      ${
        report.emergencyType === "rescue"
          ? `
        <div style="
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 8px 12px;
          border-radius: 4px;
          margin-top: 12px;
        ">
          <p style="
            margin: 0;
            font-size: 13px;
            color: #991b1b;
            font-weight: 600;
          ">
            🚨 RESCUE NEEDED - Urgent response required
          </p>
        </div>
      `
          : ""
      }
      
      <p style="
        font-size: 10px;
        color: #9ca3af;
        margin-top: 12px;
        margin-bottom: 0;
        text-align: right;
      ">
        Report ID: ${report._id?.slice(-6) || "N/A"}
      </p>
    </div>
  `;
}
