import { useEffect, useState, useCallback } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { connectSocket } from "../../../utils/socket";

const TOKEN = () => localStorage.getItem("token");

async function apiFetch(path) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Per-center coordinates for Muntindilaw and Mayamot (exact, manually set).
// All other barangays fall back to BARANGAY_COORDS below.
const CENTER_COORDS = {
  "Puno Multipurpose Hall – Rescue Bldg.":        [14.6232, 121.1640],
  "Muntindilaw National High School":              [14.6218, 121.1672],
  "Muntindilaw Daycare Center":                    [14.6230, 121.1643],
  "Muntindilaw Elementary School":                 [14.6235, 121.1650],
  "Area 4B Basketball Open Court":                 [14.6288, 121.1708],
  "Skylark St. Vista Verde Bldg.":                 [14.6178, 121.1663],
  "Saint Martin De Porres":                        [14.6255, 121.1658],
  "Sitio Mahayahay Open Court BC":                 [14.6298, 121.1718],
  "KB 4 Open Area Basketball Court":               [14.6283, 121.1703],
  "Village East Clubhouse Basketball Court":       [14.6162, 121.1628],
  "Vista Verde Executive Basketball Court":        [14.6173, 121.1668],
  "Kingsville Evacuation Center (City Manage)":   [14.6005, 121.1885],
  "Mayamot Elementary School Covered Court":       [14.5975, 121.1848],
  "Mayamot Daycare Center":                        [14.5968, 121.1840],
};

// Approximate barangay center coordinates — used as fallback for seeded centers
// that don't yet have specific lat/lng stored in the database.
const BARANGAY_COORDS = {
  bagongnayon:  [14.6340, 121.1740],
  beverlyhills: [14.5820, 121.1440],
  calawis:      [14.6480, 121.2570],
  cupang:       [14.5580, 121.1860],
  dalig:        [14.5500, 121.1750],
  delapaz:      [14.5970, 121.1530],
  inarawan:     [14.6250, 121.2340],
  mambugan:     [14.5720, 121.1820],
  mayamot:      [14.5985, 121.1860],
  muntindilaw:  [14.6235, 121.1650],
  sanisidro:    [14.6090, 121.1590],
  sanjose:      [14.6380, 121.1810],
  sanjuan:      [14.6190, 121.1980],
  sanluis:      [14.6060, 121.2040],
  sanroque:     [14.6210, 121.1730],
  santacruz:    [14.6260, 121.1900],
  private:      [14.5880, 121.1760],
};

function statusOf(center) {
  if (!center.capacity || center.occupancy === 0) return "vacant";
  const pct = center.occupancy / center.capacity;
  if (pct >= 1)   return "full";
  if (pct >= 0.8) return "nearFull";
  return "active";
}

const STATUS_COLOR = {
  full:     "#ef4444",
  nearFull: "#f97316",
  active:   "#22c55e",
  vacant:   "#94a3b8",
};

const STATUS_LABEL = {
  full:     "Full",
  nearFull: "Near Full",
  active:   "Active",
  vacant:   "Vacant",
};

const TENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15 8.5 21"/><path d="M2 21h20"/></svg>`;

function createTentIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">${TENT_SVG}</div>`,
    iconSize:    [32, 32],
    iconAnchor:  [16, 16],
    popupAnchor: [0, -20],
  });
}

export default function EvacuationCentersLayer({ visible }) {
  const [centers, setCenters] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/evacuation/centers?barangay=all");
      setCenters(data);
    } catch {
      // silently ignore — layer just won't render
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    load();
  }, [visible, load]);

  useEffect(() => {
    if (!visible) return;
    const socket = connectSocket();
    function handler({ center }) {
      setCenters((prev) =>
        prev.map((c) => (c._id === center._id ? center : c)),
      );
    }
    socket.on("evacuation_updated", handler);
    return () => socket.off("evacuation_updated", handler);
  }, [visible]);

  if (!visible) return null;

  return centers.map((center) => {
    // Priority: stored lat/lng → named lookup (exact) → barangay center (approx)
    const coords =
      center.lat != null && center.lng != null
        ? [center.lat, center.lng]
        : CENTER_COORDS[center.name]
        ?? BARANGAY_COORDS[center.barangay];

    if (!coords) return null;

    const status = statusOf(center);
    const color  = STATUS_COLOR[status];
    const pct    = center.capacity
      ? Math.round((center.occupancy / center.capacity) * 100)
      : 0;

    return (
      <Marker
        key={center._id}
        position={coords}
        icon={createTentIcon(color)}
      >
        <Popup>
          <div style={{ minWidth: 180 }}>
            <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
              {center.name}
            </p>
            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
              {center.location}
            </p>
            <div
              style={{
                display:      "inline-block",
                padding:      "2px 8px",
                borderRadius: 12,
                background:   color,
                color:        "#fff",
                fontSize:     11,
                fontWeight:   600,
                marginBottom: 6,
              }}
            >
              {STATUS_LABEL[status]}
            </div>
            <p style={{ fontSize: 12, margin: 0 }}>
              <strong>{center.occupancy}</strong> / {center.capacity} evacuees
              {center.capacity > 0 && (
                <span style={{ color: "#94a3b8" }}> ({pct}%)</span>
              )}
            </p>
            {center.barangay && (
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                Brgy. {center.barangay.charAt(0).toUpperCase() + center.barangay.slice(1)}
              </p>
            )}
          </div>
        </Popup>
      </Marker>
    );
  });
}
