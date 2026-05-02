// Renders active system-generated landslide alerts as Mountain icon markers.
// Each marker is placed at the centroid of its affected zones (alert.location
// stored as "lat,lon"). Severity drives the color:
//   watch    → yellow  (#f59e0b)
//   warning  → amber   (#f97316)
//   evacuate → red     (#dc2626)
//
// Add ?dev=true to localhost URL to render 4 fake markers for testing.

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";

const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

const DEV_FAKE_ALERTS = [
  {
    _id: "ls-dev-watch-1",
    type: "landslide",
    isActive: true,
    severity: "watch",
    title: "Landslide Watch — Inarawan",
    description:
      "[DEV] Soil moisture rising above baseline. Moderate rainfall expected. Residents near slopes should stay alert.",
    location: "14.5980,121.1750",
    barangays: ["Brgy. Inarawan (slope)", "Brgy. San Roque (mid-slope)"],
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "ls-dev-warning-1",
    type: "landslide",
    isActive: true,
    severity: "warning",
    title: "Landslide Warning — Mambugan Ridge",
    description:
      "[DEV] Two landslide risk factors active: L1 intense rainfall (34 mm/hr, 3 consecutive hours) and L2 steep slope terrain. Pre-position CDRRMO response teams.",
    location: "14.6070,121.1820",
    barangays: ["Brgy. Mambugan (ridge)", "Brgy. San Jose (hillside)"],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "ls-dev-critical-1",
    type: "landslide",
    isActive: true,
    severity: "critical",
    title: "Critical Landslide Risk — Dalig Upper Slope",
    description:
      "[DEV] All three scoring factors approaching thresholds. Steep terrain, intense rainfall, and 82% soil saturation. Pre-evacuation recommended.",
    location: "14.6220,121.1980",
    barangays: ["Brgy. Dalig (upper slope)", "Hinulugang Taktak escarpment"],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "ls-dev-evacuate-1",
    type: "landslide",
    isActive: true,
    severity: "evacuate",
    title: "EVACUATE — Calawis Landslide Alert",
    description:
      "[DEV] All 3 landslide risk factors fully active: L1+L2+L3. Mandatory evacuation of Calawis and nearby zones. Deploy response units immediately.",
    location: "14.5650,121.2100",
    barangays: ["Brgy. Calawis, Antipolo"],
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    expiresAt: null,
  },
];

// Lucide Mountain SVG paths
const MOUNTAIN_SVG = (color, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    <path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/>
  </svg>`;

const SEVERITY_STYLE = {
  evacuate: {
    border: "#dc2626",
    bg: "#fef2f2",
    icon: "#dc2626",
    badge: { bg: "#dc2626", text: "#ffffff", label: "EVACUATE" },
    pulse: true,
  },
  warning: {
    border: "#f97316",
    bg: "#fff7ed",
    icon: "#f97316",
    badge: { bg: "#ffedd5", text: "#9a3412", label: "WARNING" },
    pulse: false,
  },
  watch: {
    border: "#f59e0b",
    bg: "#fffbeb",
    icon: "#f59e0b",
    badge: { bg: "#fef3c7", text: "#92400e", label: "WATCH" },
    pulse: false,
  },
  critical: {
    border: "#dc2626",
    bg: "#fef2f2",
    icon: "#dc2626",
    badge: { bg: "#fee2e2", text: "#991b1b", label: "CRITICAL" },
    pulse: true,
  },
};

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes landslide-pulse {
      0%   { transform: scale(1);    opacity: 1; }
      50%  { transform: scale(1.35); opacity: 0.6; }
      100% { transform: scale(1);    opacity: 1; }
    }
    .landslide-alert-pulse { animation: landslide-pulse 1.8s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

function createLandslideAlertIcon(severity) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.watch;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:42px;height:42px;">
        ${
          s.pulse
            ? `<div class="landslide-alert-pulse" style="
                position:absolute;inset:0;border-radius:50%;
                border:2px solid ${s.border};opacity:0.4;"></div>`
            : ""
        }
        <div style="
          position:absolute;inset:0;
          background:${s.bg};
          border:2.5px solid ${s.border};
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 10px rgba(0,0,0,0.15);
        ">
          ${MOUNTAIN_SVG(s.icon, 20)}
        </div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

function createLandslideAlertPopup(alert) {
  const s = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.watch;
  const time = new Date(alert.createdAt).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const expiresAt = alert.expiresAt
    ? new Date(alert.expiresAt).toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const zoneList =
    alert.barangays?.length > 0
      ? alert.barangays
          .map(
            (b) =>
              `<span style="display:inline-block;background:#f3f4f6;
               color:#374151;font-size:10px;font-weight:600;
               padding:1px 6px;border-radius:999px;margin:2px 2px 0 0;">${b}</span>`,
          )
          .join("")
      : '<span style="font-size:11px;color:#9ca3af;">No specific zones listed</span>';

  const devBanner = IS_DEV_MODE
    ? `<div style="
        background:#fff7ed;border:1px solid #fed7aa;
        border-radius:6px;padding:4px 8px;margin-bottom:8px;
        font-size:10px;font-weight:700;color:#c2410c;
        display:flex;align-items:center;gap:4px;">
        🛠 DEV MODE — Simulated alert, not real data
      </div>`
    : "";

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:280px;">
      ${devBanner}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${s.bg};border:2px solid ${s.border};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${MOUNTAIN_SVG(s.icon, 16)}
        </div>
        <div>
          <div style="font-weight:700;font-size:13px;color:#111827;line-height:1.2;">
            ${alert.title}
          </div>
          <span style="
            display:inline-block;margin-top:3px;
            background:${s.badge.bg};color:${s.badge.text};
            font-size:10px;font-weight:700;
            padding:1px 7px;border-radius:999px;">
            ${s.badge.label}
          </span>
        </div>
      </div>
      <p style="font-size:12px;color:#4b5563;line-height:1.5;margin:0 0 10px 0;">
        ${alert.description.length > 200 ? alert.description.slice(0, 197) + "…" : alert.description}
      </p>
      <div style="margin-bottom:10px;">
        <p style="font-size:10px;font-weight:700;color:#6b7280;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.05em;">
          Affected Zones
        </p>
        <div>${zoneList}</div>
      </div>
      <div style="
        border-top:1px solid #f3f4f6;
        padding-top:8px;
        display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#9ca3af;">Issued: ${time}</span>
        ${
          expiresAt
            ? `<span style="font-size:10px;color:#9ca3af;">Expires: ${expiresAt}</span>`
            : `<span style="font-size:10px;color:#dc2626;font-weight:600;">No expiry set</span>`
        }
      </div>
    </div>
  `;
}

function parseLatLon(location) {
  if (!location) return null;
  const parts = location.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  return [lat, lon];
}

export default function LandslideAlertsLayer({ visible }) {
  const map = useMap();
  const layerRef = useRef(null);

  injectStyle();

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map]);

  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();
    if (!visible) return;

    if (IS_DEV_MODE) {
      console.info("[LandslideAlertsLayer] DEV MODE — rendering fake alerts");
      DEV_FAKE_ALERTS.forEach((alert) => {
        const coords = parseLatLon(alert.location);
        if (!coords) return;
        const marker = L.marker(coords, {
          icon: createLandslideAlertIcon(alert.severity),
          zIndexOffset: 500,
        });
        marker.bindPopup(createLandslideAlertPopup(alert), {
          maxWidth: 300,
          minWidth: 240,
        });
        marker.addTo(layerRef.current);
      });
      return;
    }

    fetch(`${API_BASE}/api/alerts`)
      .then((r) => r.json())
      .then(({ alerts = [] }) => {
        const lsAlerts = alerts.filter(
          (a) => a.type === "landslide" && a.isActive,
        );
        lsAlerts.forEach((alert) => {
          const coords = parseLatLon(alert.location);
          if (!coords) return;
          const marker = L.marker(coords, {
            icon: createLandslideAlertIcon(alert.severity),
            zIndexOffset: 500,
          });
          marker.bindPopup(createLandslideAlertPopup(alert), {
            maxWidth: 300,
            minWidth: 240,
          });
          marker.addTo(layerRef.current);
        });
        console.log(
          `[LandslideAlertsLayer] Rendered ${lsAlerts.length} landslide alert marker(s)`,
        );
      })
      .catch((err) =>
        console.warn("[LandslideAlertsLayer] Failed to fetch alerts:", err.message),
      );
  }, [visible]);

  return null;
}
