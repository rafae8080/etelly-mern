import { useEffect, useState, useCallback } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { connectSocket } from "../../../utils/socket";

const TOKEN = () => localStorage.getItem("token");

async function apiFetch(path) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${TOKEN()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Approximate coordinates for each center (lat, lng)
const COORDS = {
  // ── Muntindilaw ──────────────────────────────────────────────────────────
  "Puno Multipurpose Hall – Rescue Bldg.":        [14.6232, 121.1640],
  "Muntindilaw National High School":              [14.6218, 121.1672],
  "Barangay Covered Court":                        [14.6238, 121.1645],
  "Area 4B Basketball Open Court":                 [14.6288, 121.1708],
  "Skylark St. Vista Verde Bldg.":                 [14.6178, 121.1663],
  "Saint Martin De Porres":                        [14.6255, 121.1658],
  "Sitio Mahayahay Open Court BC":                 [14.6298, 121.1718],
  "Muntindilaw Daycare Center":                    [14.6230, 121.1643],
  "Muntindilaw Elementary School":                 [14.6235, 121.1650],
  "KB 4 Open Area Basketball Court":               [14.6283, 121.1703],
  "Village East Clubhouse Basketball Court":       [14.6162, 121.1628],
  "Vista Verde Executive Basketball Court":        [14.6173, 121.1668],
  // ── Mayamot ──────────────────────────────────────────────────────────────
  "Kingsville Evacuation Center (City Manage)":   [14.6005, 121.1885],
  "Mayamot Elementary School Covered Court":       [14.5975, 121.1848],
  "Mayamot Daycare Center":                        [14.5968, 121.1840],
};

function statusOf(center) {
  if (!center.capacity || center.occupancy === 0) return "vacant";
  const pct = center.occupancy / center.capacity;
  if (pct >= 1)   return "full";
  if (pct >= 0.8) return "nearFull";
  return "active";
}

const STATUS_COLOR = {
  full:     "#ef4444", // red
  nearFull: "#f97316", // orange
  active:   "#22c55e", // green
  vacant:   "#94a3b8", // slate
};

const STATUS_LABEL = {
  full:     "Full",
  nearFull: "Near Full",
  active:   "Active",
  vacant:   "Vacant",
};

export default function EvacuationCentersLayer({ visible }) {
  const [centers, setCenters] = useState([]);

  const load = useCallback(async () => {
    try {
      const [muntindilaw, mayamot] = await Promise.all([
        apiFetch("/api/evacuation/centers?barangay=muntindilaw"),
        apiFetch("/api/evacuation/centers?barangay=mayamot"),
      ]);
      setCenters([...muntindilaw, ...mayamot]);
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
    const coords = COORDS[center.name];
    if (!coords) return null;

    const status = statusOf(center);
    const color  = STATUS_COLOR[status];
    const pct    = center.capacity
      ? Math.round((center.occupancy / center.capacity) * 100)
      : 0;

    return (
      <CircleMarker
        key={center._id}
        center={coords}
        radius={10}
        pathOptions={{
          color:       color,
          fillColor:   color,
          fillOpacity: 0.85,
          weight:      2,
        }}
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
                display:        "inline-block",
                padding:        "2px 8px",
                borderRadius:   12,
                background:     color,
                color:          "#fff",
                fontSize:       11,
                fontWeight:     600,
                marginBottom:   6,
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
      </CircleMarker>
    );
  });
}
