/**
 * AlertsPage.jsx
 * Upgraded Alerts page — pulls live alerts from /api/alerts via useAlerts hook.
 *
 * Location picker works like Angkas / Lalamove:
 *  - Search any street, landmark, or place in Antipolo
 *  - Nominatim (OSM) returns real address suggestions, restricted to Antipolo
 *  - Pick one → map zooms in and drops a pin at exact coordinates
 *  - Tap anywhere on the map to reposition the pin (reverse geocodes automatically)
 *  - The full address string is saved as `location` — one pin per alert
 */

import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Plus,
  RefreshCw,
  Search,
  X,
  Zap,
  Eye,
  MapPin,
  Clock,
  Navigation,
  Trash2,
} from "lucide-react";
import { useAlerts, SOURCE_CONFIG, SEVERITY_CONFIG } from "../hooks/useAlerts";

// ─── Relative time ─────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

// Forward-looking: how long until a future date
function timeUntil(dateStr) {
  if (!dateStr) return "";
  const mins = Math.floor((new Date(dateStr) - Date.now()) / 60000);
  if (mins <= 0) return "expired";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

// ─── Severity icon ─────────────────────────────────────────────────────────────

function SeverityIcon({ severity, size = 16 }) {
  if (severity === "evacuate" || severity === "critical")
    return <AlertTriangle size={size} />;
  if (severity === "warning") return <Zap size={size} />;
  return <Eye size={size} />;
}

// ─── Dismiss Confirmation Modal ────────────────────────────────────────────────

function DismissConfirmModal({ alert, onConfirm, onCancel }) {
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.watch;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${sev.bg} ${sev.text}`}
            >
              <Trash2 size={13} />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">
              Remove Alert
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            Are you sure you want to remove this alert?
          </p>
          {/* Alert preview */}
          <div
            className={`px-3 py-2.5 rounded-lg border-l-4 ${sev.leftBorder} bg-gray-50 border border-gray-100`}
          >
            <p className="text-xs font-semibold text-gray-800 leading-snug">
              {alert.title}
            </p>
            {alert.location && (
              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin size={9} />
                {alert.location}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            This will hide the alert for all users. It cannot be undone from
            this page.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single Alert Tile ─────────────────────────────────────────────────────────

function AlertTile({ alert, onDismissRequest }) {
  const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.watch;
  const src = SOURCE_CONFIG[alert.source] ?? SOURCE_CONFIG.system;

  return (
    <div
      className={`bg-white rounded-xl border-l-4 ${sev.leftBorder}
                  border border-gray-100 shadow-sm
                  hover:shadow-md transition-all overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <div
            className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center
                        justify-center ${sev.bg} ${sev.text}`}
          >
            <SeverityIcon severity={alert.severity} size={15} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row: severity · source · type — all on the same line */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.bg} ${sev.text}`}
              >
                {sev.label}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${src.bg} ${src.text} ${src.border}`}
              >
                {src.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                {alert.type}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">
              {alert.title}
            </h3>

            {/* Full description — no expand/collapse */}
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
              {alert.description}
            </p>

            {/* Location — shows actual alert location, not just city */}
            {alert.location && (
              <div className="flex items-center gap-1 mt-1.5">
                <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-400 truncate">
                  {alert.location}
                </span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-1 mt-2">
              <Clock size={10} className="text-gray-300" />
              <span className="text-[11px] text-gray-400">
                {timeAgo(alert.createdAt)}
                {alert.expiresAt &&
                  timeUntil(alert.expiresAt) !== "expired" && (
                    <span className="ml-2 text-gray-300">
                      · expires in {timeUntil(alert.expiresAt)}
                    </span>
                  )}
              </span>
            </div>
          </div>

          {/* Dismiss button — triggers confirmation modal */}
          <button
            onClick={() => onDismissRequest(alert)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                       text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Remove alert"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Leaflet loader (singleton) ────────────────────────────────────────────────

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);

  if (!document.querySelector("#leaflet-css")) {
    const css = document.createElement("link");
    css.id = "leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
  }

  return new Promise((resolve) => {
    if (document.querySelector("#leaflet-js")) {
      const wait = setInterval(() => {
        if (window.L) {
          clearInterval(wait);
          resolve(window.L);
        }
      }, 80);
      return;
    }
    const js = document.createElement("script");
    js.id = "leaflet-js";
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => resolve(window.L);
    document.head.appendChild(js);
  });
}

// ─── Nominatim helpers ─────────────────────────────────────────────────────────

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "AntipoloDRRS/1.0",
};
// Antipolo City bounding box (lon_min, lat_min, lon_max, lat_max)
const VIEWBOX = "121.08,14.52,121.26,14.70";

async function geocode(query) {
  const params = new URLSearchParams({
    q: `${query}, Antipolo, Rizal`,
    format: "json",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ph",
    bounded: "1",
    viewbox: VIEWBOX,
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: OSM_HEADERS,
  });
  return res.json();
}

async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ lat, lon, format: "json" });
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
    headers: OSM_HEADERS,
  });
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// ─── Location Picker ───────────────────────────────────────────────────────────

function LocationPicker({ location, onLocationChange, required = false }) {
  const [query, setQuery] = useState(location ?? "");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [confirmed, setConfirmed] = useState(location ?? "");
  const [showMap, setShowMap] = useState(false);

  const debounceRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const pendingRef = useRef(null);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();

    if (!q || q.length < 3 || q === confirmed) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocode(q);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 420);
  }, [query, confirmed]);

  // ── Pick suggestion ────────────────────────────────────────────────────────
  const pickSuggestion = (item) => {
    const addr = item.display_name;
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    setQuery(addr);
    setConfirmed(addr);
    setSuggestions([]);
    onLocationChange(addr);

    if (mapInstanceRef.current) {
      dropPin(mapInstanceRef.current, lat, lon, addr);
      mapInstanceRef.current.flyTo([lat, lon], 17, { duration: 0.7 });
    } else {
      pendingRef.current = { lat, lon, addr };
      setShowMap(true);
    }
  };

  // ── Drop / move marker ─────────────────────────────────────────────────────
  const dropPin = (map, lat, lon, label) => {
    const L = window.L;
    const pinHtml = `
      <div style="position:relative;width:32px;height:42px">
        <div style="
          width:28px;height:28px;background:#dc2626;border:3px solid #fff;
          border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          box-shadow:0 2px 10px rgba(0,0,0,0.4);position:absolute;top:0;left:2px
        "></div>
        <div style="
          width:6px;height:6px;background:#fff;border-radius:50%;
          position:absolute;top:8px;left:13px
        "></div>
      </div>`;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      const icon = L.divIcon({
        className: "",
        html: pinHtml,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -44],
      });
      markerRef.current = L.marker([lat, lon], { icon, draggable: true }).addTo(
        map,
      );

      markerRef.current.on("dragend", async (e) => {
        const pos = e.target.getLatLng();
        const addr = await reverseGeocode(pos.lat, pos.lng);
        setQuery(addr);
        setConfirmed(addr);
        onLocationChange(addr);
        markerRef.current?.setPopupContent(
          `<div style="font-size:12px;max-width:200px;line-height:1.4">${addr}</div>`,
        );
      });
    }

    if (label) {
      markerRef.current
        .bindPopup(
          `<div style="font-size:12px;max-width:200px;line-height:1.4">${label}</div>`,
          { closeButton: false },
        )
        .openPopup();
    }
  };

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView(
        [14.5882, 121.1763],
        14,
      );
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([14.52, 121.08], [14.7, 121.26]);
      map.setMaxBounds(bounds.pad(0.05));

      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        dropPin(map, lat, lng, null);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.4 });
        const addr = await reverseGeocode(lat, lng);
        setQuery(addr);
        setConfirmed(addr);
        onLocationChange(addr);
        markerRef.current
          ?.bindPopup(
            `<div style="font-size:12px;max-width:200px;line-height:1.4">${addr}</div>`,
            { closeButton: false },
          )
          .openPopup();
      });

      if (pendingRef.current) {
        const { lat, lon, addr } = pendingRef.current;
        pendingRef.current = null;
        dropPin(map, lat, lon, addr);
        map.flyTo([lat, lon], 17, { duration: 0.7 });
      }
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showMap]);

  const clear = () => {
    setQuery("");
    setConfirmed("");
    setSuggestions([]);
    onLocationChange("");
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  };

  const shortLabel = (displayName) => {
    const parts = displayName.split(", ");
    return { primary: parts[0], secondary: parts.slice(1, 4).join(", ") };
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 block">
        Affected Location {required && <span className="text-red-500">*</span>}
      </label>

      {/* Search input */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) {
              setConfirmed("");
              onLocationChange("");
            }
          }}
          placeholder="Search street, landmark, or place in Antipolo…"
          autoComplete="off"
          className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-8 py-2.5
                     text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400
                     focus:border-transparent transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={13} />
          </button>
        )}

        {/* Spinner */}
        {searching && (
          <div
            className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border
                          border-gray-200 rounded-xl shadow-xl px-3 py-3 flex items-center gap-2"
          >
            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-gray-400">Searching Antipolo…</span>
          </div>
        )}

        {/* Suggestions */}
        {!searching && suggestions.length > 0 && (
          <div
            className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border
                          border-gray-200 rounded-xl shadow-xl overflow-hidden"
          >
            {suggestions.map((item, i) => {
              const { primary, secondary } = shortLabel(item.display_name);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickSuggestion(item)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors
                             border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <MapPin
                      size={11}
                      className="text-red-400 flex-shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-800">
                        {primary}
                      </p>
                      <p className="text-[11px] text-gray-400">{secondary}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* No results */}
        {!searching &&
          query.length >= 3 &&
          query !== confirmed &&
          suggestions.length === 0 && (
            <div
              className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border
                          border-gray-200 rounded-xl shadow-xl px-3 py-3"
            >
              <p className="text-xs text-gray-400">
                No results in Antipolo. Try a different name.
              </p>
            </div>
          )}
      </div>

      {/* Confirmed location pill */}
      {confirmed && (
        <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <Navigation
            size={11}
            className="text-green-600 flex-shrink-0 mt-0.5"
          />
          <span className="text-[11px] text-green-700 leading-relaxed">
            {confirmed}
          </span>
        </div>
      )}

      {/* Map toggle */}
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800
                   font-medium transition-colors"
      >
        <MapPin size={12} />
        {showMap ? "Hide map" : "Or pin directly on map"}
      </button>

      {/* Leaflet map */}
      {showMap && (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <div className="bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100 flex items-center gap-1.5">
            <MapPin size={10} className="text-red-400 flex-shrink-0" />
            Tap anywhere to drop a pin · Drag pin to fine-tune · Limited to
            Antipolo City
          </div>
          <div ref={mapRef} style={{ height: 240 }} />
        </div>
      )}
    </div>
  );
}

// ─── Create Alert Modal ────────────────────────────────────────────────────────

function CreateAlertModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    source: "OCD",
    type: "flood",
    severity: "warning",
    title: "",
    description: "",
    location: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setFormError("Title and description are required.");
      return;
    }
    if (!form.location.trim()) {
      setFormError(
        "Affected location is required. Search or pin a location on the map.",
      );
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const API_BASE =
        import.meta.env?.VITE_API_BASE ?? "http://localhost:5000";
      const res = await fetch(`${API_BASE}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: form.source,
          type: form.type,
          severity: form.severity,
          title: form.title.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          barangays: [],
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      } else setFormError("Failed to create alert. Please try again.");
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-gray-100
                      overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            Create Manual Alert
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Source + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Source
              </label>
              <select
                value={form.source}
                onChange={(e) =>
                  setForm((f) => ({ ...f, source: e.target.value }))
                }
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                           text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="OCD">OCD</option>
                <option value="NDRRMC">NDRRMC</option>
                <option value="PAGASA">PAGASA</option>
                <option value="PHIVOLCS">PHIVOLCS</option>
                <option value="Residents">Residents</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                           text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="flood">Flood</option>
                <option value="river">River</option>
                <option value="rainfall">Rainfall</option>
                <option value="earthquake">Earthquake</option>
                <option value="lahar">Lahar</option>
                <option value="typhoon">Typhoon</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Severity
            </label>
            <div className="flex gap-2">
              {["watch", "warning", "critical", "evacuate"].map((s) => {
                const cfg = SEVERITY_CONFIG[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, severity: s }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all
                                ${
                                  form.severity === s
                                    ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                                    : "bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300"
                                }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Orange Rainfall Warning — Sumulong Highway"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5
                         text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400
                         focus:border-transparent transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              placeholder="Plain-language description for residents…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5
                         text-gray-700 resize-none focus:outline-none focus:ring-2
                         focus:ring-blue-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Location picker — required, no silent fallback */}
          <LocationPicker
            location={form.location}
            onLocationChange={(loc) =>
              setForm((f) => ({ ...f, location: loc }))
            }
            required
          />

          {/* Form error */}
          {formError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle size={11} /> {formError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700
                       rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.title.trim()}
            className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg
                       hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ counts }) {
  const items = [
    { key: "evacuate", label: "Evacuate", color: "bg-red-600 text-white" },
    { key: "critical", label: "Critical", color: "bg-red-100 text-red-700" },
    { key: "warning", label: "Warning", color: "bg-amber-100 text-amber-700" },
    { key: "watch", label: "Watch", color: "bg-blue-50 text-blue-700" },
  ].filter((i) => counts[i.key] > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((i) => (
        <span
          key={i.key}
          className={`text-xs font-bold px-3 py-1 rounded-full ${i.color}`}
        >
          {counts[i.key]} {i.label}
        </span>
      ))}
    </div>
  );
}

// ─── Filter tabs ───────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "evacuate", label: "Evacuate" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "watch", label: "Watch" },
];

// ─── Main AlertsPage ───────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { alerts, loading, error, lastFetched, dismiss, refresh, counts } =
    useAlerts();
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  // Alert pending dismissal confirmation
  const [pendingDismiss, setPendingDismiss] = useState(null);

  const filtered =
    activeFilter === "all"
      ? alerts
      : alerts.filter((a) => a.severity === activeFilter);

  const handleDismissConfirm = () => {
    if (pendingDismiss) {
      dismiss(pendingDismiss._id);
      setPendingDismiss(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Antipolo City — live hazard & evacuation alerts
          </p>
          {lastFetched && (
            <p className="text-xs text-gray-400 mt-1">
              Updated {timeAgo(lastFetched)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refresh}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center
                       text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl
                       hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Plus size={15} />
            Create Alert
          </button>
        </div>
      </div>

      {/* Summary */}
      {counts.total > 0 && (
        <div className="mb-4 flex-shrink-0">
          <SummaryBar counts={counts} />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 flex-shrink-0">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all" ? counts.total : (counts[tab.key] ?? 0);
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5
                          ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                  ${isActive ? "bg-white/20 text-white" : "bg-white text-gray-500"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {loading && alerts.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-gray-50 rounded-xl h-24 animate-pulse border-l-4 border-gray-200"
              />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-sm text-gray-500">Could not load alerts</p>
            <p className="text-xs text-gray-400">{error}</p>
            <button
              onClick={refresh}
              className="text-sm text-blue-500 hover:underline"
            >
              Try again
            </button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle size={32} className="text-green-400" />
            <p className="text-sm font-semibold text-gray-600">
              {activeFilter === "all"
                ? "No active alerts"
                : `No ${activeFilter} alerts`}
            </p>
            <p className="text-xs text-gray-400">
              {activeFilter === "all"
                ? "All systems normal. Alerts will appear here automatically."
                : "Switch to All to see other alert levels."}
            </p>
          </div>
        )}
        {filtered.map((alert) => (
          <AlertTile
            key={alert._id}
            alert={alert}
            onDismissRequest={setPendingDismiss}
          />
        ))}
      </div>

      {/* Create Alert Modal */}
      {showModal && (
        <CreateAlertModal
          onClose={() => setShowModal(false)}
          onCreated={refresh}
        />
      )}

      {/* Dismiss Confirmation Modal */}
      {pendingDismiss && (
        <DismissConfirmModal
          alert={pendingDismiss}
          onConfirm={handleDismissConfirm}
          onCancel={() => setPendingDismiss(null)}
        />
      )}
    </div>
  );
}
