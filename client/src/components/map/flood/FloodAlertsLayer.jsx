// client/src/components/map/flood/FloodAlertsLayer.jsx
//
// Renders active system-generated flood alerts as Waves icon markers on the map.
// Each marker is placed at the centroid of its affected barangays (stored in
// alert.location as "lat,lon"). Severity drives the color:
//   watch    → blue   (#3b82f6)
//   warning  → amber  (#f59e0b)
//   evacuate → red    (#dc2626)
//
// Mirrors ReportsLayer.jsx pattern — uses L.divIcon with inline SVG,
// no React-Leaflet Marker needed, runs entirely in a L.layerGroup.
//
// ── Dev mode ──────────────────────────────────────────────────────────────────
// Add ?dev=true to your localhost URL (same flag used by FloodForecastPanel).
// Four fake markers will be placed at real Antipolo barangay centroids, one
// per severity level (watch / warning / critical / evacuate), so you can verify
// icon colors, pulse animations, and popup content without a live API.
// A small orange "DEV" badge is also pinned to the top-left corner of the map
// while dev mode is active.

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";

// ── Dev mode flag (matches FloodForecastPanel convention) ─────────────────────
const IS_DEV_MODE =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("dev") === "true";

// Fake alerts placed at real Antipolo barangay centroids.
// One per severity so every icon variant / animation is visible at once.
const DEV_FAKE_ALERTS = [
  {
    _id: "dev-watch-1",
    type: "flood",
    isActive: true,
    severity: "watch",
    title: "Flood Watch — Dela Paz",
    description:
      "[DEV] Simulated watch-level alert. Soil moisture rising above baseline; light rainfall expected over the next 6 hours. No immediate action needed — continue monitoring.",
    location: "14.5950,121.1650", // Dela Paz centroid
    barangays: ["Dela Paz", "Bagong Nayon"],
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "dev-warning-1",
    type: "flood",
    isActive: true,
    severity: "warning",
    title: "Flood Warning — San Roque",
    description:
      "[DEV] Simulated warning-level alert. Two flood scoring factors active: F1 heavy rain (22 mm/hr, 4 consecutive hours) and F3 saturated soil (72%). CDRRMO should prepare evacuation teams.",
    location: "14.5880,121.1900", // San Roque centroid
    barangays: ["San Roque", "Munting Dilaw", "Mambugan"],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hrs ago
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "dev-critical-1",
    type: "flood",
    isActive: true,
    severity: "critical",
    title: "Critical Flood Risk — Mayamot",
    description:
      "[DEV] Simulated critical-level alert. All three scoring factors approaching thresholds. Pre-position rescue assets and begin voluntary evacuation of low-lying sitios.",
    location: "14.6050,121.1780", // Mayamot centroid
    barangays: ["Mayamot", "Beverly Hills", "San Jose"],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    _id: "dev-evacuate-1",
    type: "flood",
    isActive: true,
    severity: "evacuate",
    title: "EVACUATE NOW — Sta. Cruz",
    description:
      "[DEV] Simulated evacuate-level alert. All 3 flood risk factors fully active. Mandatory evacuation recommended for all flood-prone barangays below 15m ASL. Deploy all available response units immediately.",
    location: "14.5780,121.1820", // Sta. Cruz / lower Antipolo centroid
    barangays: ["Sta. Cruz", "Calawis", "Dalig"],
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
    expiresAt: null, // no expiry — mandatory evacuation stays until cleared
  },
];

// Lucide Waves SVG path (matches the icon used in FloodForecastPanel)
const WAVES_SVG = (color, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
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
    border: "#f59e0b",
    bg: "#fffbeb",
    icon: "#f59e0b",
    badge: { bg: "#fef3c7", text: "#92400e", label: "WARNING" },
    pulse: false,
  },
  watch: {
    border: "#3b82f6",
    bg: "#eff6ff",
    icon: "#3b82f6",
    badge: { bg: "#dbeafe", text: "#1e40af", label: "WATCH" },
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

// Inject pulse animation + dev badge style once
let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes flood-pulse {
      0%   { transform: scale(1);   opacity: 1; }
      50%  { transform: scale(1.35); opacity: 0.6; }
      100% { transform: scale(1);   opacity: 1; }
    }
    .flood-alert-pulse { animation: flood-pulse 1.8s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

function createFloodAlertIcon(severity) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.watch;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:42px;height:42px;">
        ${
          s.pulse
            ? `<div class="flood-alert-pulse" style="
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
          ${WAVES_SVG(s.icon, 20)}
        </div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],
  });
}

function createFloodAlertPopup(alert) {
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

  const barangayList =
    alert.barangays?.length > 0
      ? alert.barangays
          .map(
            (b) =>
              `<span style="display:inline-block;background:#f3f4f6;
               color:#374151;font-size:10px;font-weight:600;
               padding:1px 6px;border-radius:999px;margin:2px 2px 0 0;">${b}</span>`,
          )
          .join("")
      : '<span style="font-size:11px;color:#9ca3af;">No specific barangays listed</span>';

  // Dev-mode banner shown inside the popup so it's obvious this is fake data
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

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${s.bg};border:2px solid ${s.border};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${WAVES_SVG(s.icon, 16)}
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

      <!-- Description -->
      <p style="font-size:12px;color:#4b5563;line-height:1.5;margin:0 0 10px 0;">
        ${alert.description.length > 200 ? alert.description.slice(0, 197) + "…" : alert.description}
      </p>

      <!-- Affected barangays -->
      <div style="margin-bottom:10px;">
        <p style="font-size:10px;font-weight:700;color:#6b7280;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.05em;">
          Affected Barangays
        </p>
        <div>${barangayList}</div>
      </div>

      <!-- Footer -->
      <div style="
        border-top:1px solid #f3f4f6;
        padding-top:8px;
        display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#9ca3af;">
          Issued: ${time}
        </span>
        ${
          expiresAt
            ? `<span style="font-size:10px;color:#9ca3af;">Expires: ${expiresAt}</span>`
            : `<span style="font-size:10px;color:#dc2626;font-weight:600;">No expiry set</span>`
        }
      </div>
    </div>
  `;
}

// Parse "lat,lon" location string — returns null if not a coordinate pair
function parseLatLon(location) {
  if (!location) return null;
  const parts = location.split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  return [lat, lon];
}

// ── Dev badge — pinned inside the Leaflet container ───────────────────────────
// Attaches a small "DEV · FloodAlerts" pill to the map DOM so it's visible
// without opening a popup. Removed when the component unmounts.
function attachDevBadge(map) {
  const container = map.getContainer();
  const badge = document.createElement("div");
  badge.id = "flood-alerts-dev-badge";

  container.style.position = "relative"; // ensure stacking context
  container.appendChild(badge);
  return () => badge.remove();
}

export default function FloodAlertsLayer({ visible }) {
  const map = useMap();
  const layerRef = useRef(null);

  injectStyle();

  // Mount the layer group once
  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [map]);

  // Attach the orange DEV badge while in dev mode
  useEffect(() => {
    if (!IS_DEV_MODE) return;
    const remove = attachDevBadge(map);
    return remove;
  }, [map]);

  // Render markers — real API or dev fake data
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();
    if (!visible) return;

    // ── Dev mode: skip the API and use local fake alerts ──────────────────────
    if (IS_DEV_MODE) {
      console.info(
        "[FloodAlertsLayer] DEV MODE — rendering fake alerts, API skipped",
      );
      DEV_FAKE_ALERTS.forEach((alert) => {
        const coords = parseLatLon(alert.location);
        if (!coords) return;

        const marker = L.marker(coords, {
          icon: createFloodAlertIcon(alert.severity),
          zIndexOffset: 500,
        });

        marker.bindPopup(createFloodAlertPopup(alert), {
          maxWidth: 300,
          minWidth: 240,
        });

        marker.addTo(layerRef.current);
      });

      console.log(
        `[FloodAlertsLayer] DEV: rendered ${DEV_FAKE_ALERTS.length} fake marker(s)`,
      );
      return; // bail — don't hit the real API
    }

    // ── Production: fetch real alerts from the backend ────────────────────────
    fetch(`${API_BASE}/api/alerts`)
      .then((r) => r.json())
      .then(({ alerts = [] }) => {
        const floodAlerts = alerts.filter(
          (a) => a.type === "flood" && a.isActive,
        );

        floodAlerts.forEach((alert) => {
          const coords = parseLatLon(alert.location);
          if (!coords) return; // skip if no parseable coordinates

          const marker = L.marker(coords, {
            icon: createFloodAlertIcon(alert.severity),
            zIndexOffset: 500, // render above flood zone circles
          });

          marker.bindPopup(createFloodAlertPopup(alert), {
            maxWidth: 300,
            minWidth: 240,
          });

          marker.addTo(layerRef.current);
        });

        console.log(
          `[FloodAlertsLayer] Rendered ${floodAlerts.length} flood alert marker(s)`,
        );
      })
      .catch((err) =>
        console.warn("[FloodAlertsLayer] Failed to fetch alerts:", err.message),
      );
  }, [visible]);

  return null;
}
