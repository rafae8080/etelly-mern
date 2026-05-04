// client/src/components/map/reports/ReportsLayer.jsx
import { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { connectSocket } from "../../../utils/socket";

// Lucide icon SVG paths for use inside Leaflet divIcon HTML strings
const ICON_SVGS = {
  flood: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 12h20"/><path d="M2 18h20"/><path d="M6 6c0-1 1-2 3-2s3 1 3 2-1 2-3 2-3-1-3-2z"/>
      <path d="M16 6c0-1 1-2 3-2s3 1 3 2-1 2-3 2-3-1-3-2z"/>
    </svg>`,
    color: "#06b6d4",
  },
  rescue: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 18v-6a5 5 0 1 1 10 0v6"/>
      <path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/>
      <path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>
    </svg>`,
    color: "#ef4444",
  },
  medical: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
      <path d="M12 8v8m-4-4h8"/>
    </svg>`,
    color: "#ec4899",
  },
  earthquake: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
    color: "#f97316",
  },
  landslide: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    </svg>`,
    color: "#8b5cf6",
  },
  fire: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>`,
    color: "#dc2626",
  },
  other: {
    path: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
    color: "#6b7280",
  },
};

// Custom marker icons based on report type
const createReportIcon = (type) => {
  const iconDef = ICON_SVGS[type?.toLowerCase()] || ICON_SVGS.other;
  const { path: svgPath, color } = iconDef;

  // Color the SVG stroke to match the type color
  const coloredSvg = svgPath.replace(
    'stroke="currentColor"',
    `stroke="${color}"`,
  );

  return L.divIcon({
    className: "custom-report-marker",
    html: `
      <div style="
        background: white;
        border: 3px solid ${color};
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        transition: all 0.2s;
      ">
        ${coloredSvg}
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
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
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

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";

export default function ReportsLayer({ visible, filters = {} }) {
  const map = useMap();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const markersLayerRef = useRef(null);
  const socketRef = useRef(null);

  const fetchApprovedReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/reports/approved`);
      const data = await response.json();
      if (data.success && data.reports) setReports(data.reports);
    } catch (error) {
      console.error("Error fetching approved reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on selected types
  const filteredReports = reports.filter((report) => {
    if (
      !filters.types ||
      filters.types.length === 0 ||
      filters.types.includes("all")
    ) {
      return true;
    }

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

    markersLayerRef.current.clearLayers();

    if (!visible || !filteredReports.length) return;

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

      // Stop the raw DOM click from reaching the map container after Leaflet
      // processes it. Without this, map.closePopupOnClick fires on the same
      // click that opened the popup, making it appear to close immediately.
      // e.originalEvent is the underlying DOM event — stopping it here doesn't
      // touch Leaflet's own event dispatch, so the popup still opens normally.
      marker.on("click", (e) => e.originalEvent?.stopPropagation());

      marker.addTo(markersLayerRef.current);
    });
  }, [visible, filteredReports, map]);

  // Socket connection and real-time updates
  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    fetchApprovedReports();

    socket.on("new_emergency_report", (newReport) => {
      if (newReport.status === "approved") {
        setReports((prev) => {
          const exists = prev.some((r) => r._id === newReport._id);
          if (exists) return prev;
          return [...prev, newReport];
        });
      }
    });

    socket.on("report_status_updated", (data) => {
      const { reportId, status, report } = data;

      setReports((prev) => {
        if (status === "approved") {
          const exists = prev.some((r) => r._id === reportId);
          if (exists) {
            return prev.map((r) => (r._id === reportId ? report : r));
          } else {
            return [...prev, report];
          }
        } else {
          return prev.filter((r) => r._id !== reportId);
        }
      });
    });

    const refreshInterval = setInterval(fetchApprovedReports, 120000);

    return () => {
      socket.off("new_emergency_report");
      socket.off("report_status_updated");
      clearInterval(refreshInterval);
    };
  }, []);

  return null;
}

// Extract coordinates from report.
// Handles multiple shapes sent by Flutter/mobile clients:
//   1. Top-level latitude / longitude  (number or numeric string)
//   2. location.lat / location.lng
//   3. location.latitude / location.longitude
//   4a. location.coordinates { latitude, longitude }  (object — Nominatim/mobile shape)
//   4b. location.coordinates [lng, lat]               (GeoJSON array — note reversed order)
//   5. location as a [lat, lng] array
//   6. coords.latitude / coords.longitude  (Flutter geolocator package)
function extractCoordinates(report) {
  const toNum = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const valid = (lat, lng) =>
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  // 1. Top-level latitude / longitude
  {
    const lat = toNum(report.latitude);
    const lng = toNum(report.longitude);
    if (valid(lat, lng)) return [lat, lng];
  }

  if (report.location) {
    const loc = report.location;

    // 2. location.lat / location.lng
    {
      const lat = toNum(loc.lat);
      const lng = toNum(loc.lng);
      if (valid(lat, lng)) return [lat, lng];
    }

    // 3. location.latitude / location.longitude
    {
      const lat = toNum(loc.latitude);
      const lng = toNum(loc.longitude);
      if (valid(lat, lng)) return [lat, lng];
    }

    // 4a. location.coordinates as object { latitude, longitude }
    if (loc.coordinates && !Array.isArray(loc.coordinates)) {
      const lat = toNum(loc.coordinates.latitude);
      const lng = toNum(loc.coordinates.longitude);
      if (valid(lat, lng)) return [lat, lng];
    }

    // 4b. GeoJSON coordinates array [lng, lat]
    if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
      const lng = toNum(loc.coordinates[0]);
      const lat = toNum(loc.coordinates[1]);
      if (valid(lat, lng)) return [lat, lng];
    }

    // 5. location is itself a [lat, lng] array
    if (Array.isArray(loc) && loc.length >= 2) {
      const lat = toNum(loc[0]);
      const lng = toNum(loc[1]);
      if (valid(lat, lng)) return [lat, lng];
    }
  }

  // 6. coords object (Flutter geolocator package)
  if (report.coords) {
    const lat = toNum(report.coords.latitude);
    const lng = toNum(report.coords.longitude);
    if (valid(lat, lng)) return [lat, lng];
  }

  console.warn(
    "Report missing valid coordinates:",
    report._id,
    "| received location data:",
    JSON.stringify({
      latitude: report.latitude,
      longitude: report.longitude,
      location: report.location,
      coords: report.coords,
    }),
  );
  return null;
}

// Inline SVG strings for popup metadata icons (no emoji)
const PIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const CLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const USER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const SIREN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#991b1b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2a1 1 0 0 1 2 0v1a1 1 0 0 1-2 0z"/><path d="m5.2 5.2-.8-.8a1 1 0 0 1 1.4-1.4l.8.8a1 1 0 0 1-1.4 1.4z"/><path d="M2 11h1a1 1 0 0 1 0 2H2a1 1 0 0 1 0-2z"/><path d="m19.6 4.4.8-.8a1 1 0 0 1 1.4 1.4l-.8.8a1 1 0 0 1-1.4-1.4z"/><path d="M21 11h1a1 1 0 0 1 0 2h-1a1 1 0 0 1 0-2z"/><path d="M7 17h10"/><path d="M9 17V9a3 3 0 0 1 6 0v8"/><path d="M5 21h14a2 2 0 0 0 0-4H5a2 2 0 0 0 0 4z"/></svg>`;

// Returns true for Android/iOS local file paths that are unreachable from a browser.
// The mobile app sometimes stores the on-device cache path instead of a server URL.
function isLocalDevicePath(src) {
  if (!src || typeof src !== "string") return false;
  return (
    src.startsWith("/data/") ||
    src.startsWith("/storage/") ||
    src.startsWith("/var/mobile/") ||
    src.startsWith("content://") ||
    src.startsWith("file:///data/")
  );
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
  const remoteImages = images.filter((src) => !isLocalDevicePath(src));
  const hasLocalOnlyImages = images.length > 0 && remoteImages.length === 0;
  const hasImages = remoteImages.length > 0;

  const severityColors = {
    high: { bg: "#fee2e2", color: "#991b1b", dot: "#ef4444", label: "HIGH" },
    medium: {
      bg: "#fef3c7",
      color: "#92400e",
      dot: "#f59e0b",
      label: "MEDIUM",
    },
    low: { bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6", label: "LOW" },
  };

  const sev = severityColors[report.severity?.toLowerCase()];
  const severityHtml = sev
    ? `<span style="
        background: ${sev.bg};
        color: ${sev.color};
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      ">
        <span style="width:8px;height:8px;border-radius:50%;background:${sev.dot};display:inline-block;"></span>
        ${sev.label}
      </span>`
    : "";

  return `
    <div class="report-popup">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="font-weight: 700; font-size: 16px; margin: 0; color: #1f2937;">
          ${report.emergencyType?.toUpperCase() || "REPORT"}
        </h3>
        ${severityHtml}
      </div>
      
      ${
        hasImages
          ? `
        <div style="margin-bottom: 12px;">
          <img
            src="${remoteImages[0]}"
            alt="Report"
            onclick="window.open('${remoteImages[0]}', '_blank')"
            style="
              width: 100%;
              max-height: 150px;
              object-fit: cover;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            "
          />
          ${
            remoteImages.length > 1
              ? `<p style="font-size: 11px; color: #6b7280; margin-top: 4px; text-align: center;">
                  +${remoteImages.length - 1} more image(s)
                </p>`
              : ""
          }
        </div>
      `
          : hasLocalOnlyImages
          ? `
        <div style="
          background: #f3f4f6;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p style="margin:0;">Image saved on device only — not uploaded to server</p>
        </div>
      `
          : ""
      }
      
      <p style="font-size: 14px; margin: 12px 0; color: #374151; line-height: 1.5;">
        ${report.description || "No description provided"}
      </p>
      
      <div style="background: #f9fafb; padding: 8px 12px; border-radius: 6px; margin: 12px 0; font-size: 12px;">
        <div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: center;">
          ${PIN_ICON}
          <span style="color: #6b7280; min-width: 65px;">Location:</span>
          <span style="color: #1f2937; font-weight: 500;">${location}</span>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: center;">
          ${CLOCK_ICON}
          <span style="color: #6b7280; min-width: 65px;">Time:</span>
          <span style="color: #1f2937;">${time}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${USER_ICON}
          <span style="color: #6b7280; min-width: 65px;">Reported by:</span>
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
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          ${SIREN_ICON}
          <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 600;">
            RESCUE NEEDED — Urgent response required
          </p>
        </div>
      `
          : ""
      }
      
      <p style="font-size: 10px; color: #9ca3af; margin-top: 12px; margin-bottom: 0; text-align: right;">
        Report ID: ${report._id?.slice(-6) || "N/A"}
      </p>
    </div>
  `;
}
