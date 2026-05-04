import { useState, useEffect, useCallback } from "react";
import {
  Settings, Users, Building2, X, Check, RotateCcw,
  ChevronDown, ClipboardList, ChevronUp, Loader2,
} from "lucide-react";
import { connectSocket } from "../utils/socket";
import buildingImg from "../images/building.png";

// ── Facility image map ────────────────────────────────────────────────────────
// Keys are facility types detected from the center name.
// Swap any value for a real import once the asset is ready.
const FACILITY_IMAGES = {
  school:   buildingImg,
  court:    buildingImg,
  hall:     buildingImg,
  daycare:  buildingImg,
  clubhouse:buildingImg,
  default:  buildingImg,
};

function getFacilityImage(centerName = "") {
  const n = centerName.toLowerCase();
  if (n.includes("school"))            return FACILITY_IMAGES.school;
  if (n.includes("court"))             return FACILITY_IMAGES.court;
  if (n.includes("hall") || n.includes("covered court")) return FACILITY_IMAGES.hall;
  if (n.includes("daycare"))           return FACILITY_IMAGES.daycare;
  if (n.includes("clubhouse"))         return FACILITY_IMAGES.clubhouse;
  return FACILITY_IMAGES.default;
}

// ── Barangay list ─────────────────────────────────────────────────────────────
const BARANGAYS = [
  { value: "muntindilaw", label: "Brgy. Muntindilaw" },
  { value: "mayamot",     label: "Brgy. Mayamot"     },
];

// ── API helpers ───────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
  };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Status helpers ────────────────────────────────────────────────────────────
function statusOf(occupancy, capacity) {
  if (capacity <= 0) return { label: "Unknown",   badge: "bg-gray-100 text-gray-500",    bar: "bg-gray-300"   };
  const p = occupancy / capacity;
  if (occupancy === 0) return { label: "Vacant",   badge: "bg-gray-100 text-gray-600",    bar: "bg-gray-300"   };
  if (p >= 1)          return { label: "Full",      badge: "bg-red-50 text-red-600",       bar: "bg-red-500"    };
  if (p >= 0.8)        return { label: "Near Full", badge: "bg-orange-50 text-orange-600", bar: "bg-orange-500" };
  return                      { label: "Active",    badge: "bg-green-50 text-green-700",   bar: "bg-green-500"  };
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function describeLog(log) {
  const name   = log.user?.name ?? "Unknown";
  const delta  = log.delta > 0 ? `+${log.delta}` : `${log.delta}`;
  switch (log.action) {
    case "occupancy_update":
      return { actor: name, text: `updated occupancy at "${log.centerName}"`, detail: `${log.previousValue} → ${log.newValue} (${delta})` };
    case "capacity_update":
      return { actor: name, text: `changed capacity at "${log.centerName}"`,  detail: `${log.previousValue} → ${log.newValue}`             };
    case "reset":
      return { actor: name, text: `reset "${log.centerName}"`,                detail: `was ${log.previousValue}`                           };
    default:
      return { actor: name, text: `modified "${log.centerName}"`,             detail: ""                                                   };
  }
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ center, onClose, onSaveCapacity, onReset }) {
  const [cap, setCap] = useState(String(center.capacity));

  function submit() {
    const n = parseInt(cap, 10);
    if (!isNaN(n) && n > 0) onSaveCapacity(center._id, n);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900">Edit Facility</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-5 leading-snug">{center.name}</p>

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Total Capacity
        </label>
        <input
          type="number" min={1} value={cap}
          onChange={(e) => setCap(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-5"
        />

        <div className="flex gap-2">
          <button
            onClick={submit}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Save Changes
          </button>
          <button
            onClick={() => onReset(center._id)}
            title="Reset occupancy to 0"
            className="px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EvacuationPage() {
  const [barangay, setBarangay]   = useState("muntindilaw");
  const [centers,  setCenters]    = useState([]);
  const [logs,     setLogs]       = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [editId,   setEditId]     = useState(null);
  const [inputId,  setInputId]    = useState(null);
  const [inputVal, setInputVal]   = useState("");
  const [logsOpen, setLogsOpen]   = useState(false);
  const [brgyOpen, setBrgyOpen]   = useState(false);

  // ── Fetch centers + logs ────────────────────────────────────────────────────
  const fetchCenters = useCallback(async (brgy) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/evacuation/centers?barangay=${brgy}`);
      setCenters(data);
    } catch {
      setError("Failed to load evacuation centers. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (brgy) => {
    try {
      const data = await apiFetch(`/api/evacuation/logs?barangay=${brgy}&limit=50`);
      setLogs(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchCenters(barangay);
    fetchLogs(barangay);
  }, [barangay, fetchCenters, fetchLogs]);

  // ── Real-time Socket.IO ─────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();

    function onUpdate({ center, log }) {
      // Update matching center regardless of barangay (server filters by barangay)
      setCenters((prev) =>
        prev.map((c) => (c._id === center._id ? { ...c, ...center } : c)),
      );
      if (log && log.barangay === barangay) {
        setLogs((prev) => [log, ...prev].slice(0, 50));
      }
    }

    socket.on("evacuation_updated", onUpdate);
    return () => socket.off("evacuation_updated", onUpdate);
  }, [barangay]);

  // ── Occupancy adjustment ────────────────────────────────────────────────────
  async function adjust(id, delta) {
    const c = centers.find((x) => x._id === id);
    if (!c) return;
    const next = Math.max(0, Math.min(c.capacity, c.occupancy + delta));
    if (next === c.occupancy) return;

    // Optimistic update
    setCenters((prev) => prev.map((x) => x._id === id ? { ...x, occupancy: next } : x));

    try {
      await apiFetch(`/api/evacuation/centers/${id}/occupancy`, {
        method: "PUT",
        body: JSON.stringify({ occupancy: next }),
      });
      fetchLogs(barangay);
    } catch {
      fetchCenters(barangay); // revert on failure
    }
  }

  function openInput(id, current) {
    setInputId(id);
    setInputVal(String(current));
  }

  async function commitInput(id) {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n)) {
      const c = centers.find((x) => x._id === id);
      const next = c ? Math.max(0, Math.min(c.capacity, n)) : n;

      setCenters((prev) => prev.map((x) => x._id === id ? { ...x, occupancy: next } : x));

      try {
        await apiFetch(`/api/evacuation/centers/${id}/occupancy`, {
          method: "PUT",
          body: JSON.stringify({ occupancy: next }),
        });
        fetchLogs(barangay);
      } catch {
        fetchCenters(barangay);
      }
    }
    setInputId(null);
    setInputVal("");
  }

  async function handleSaveCapacity(id, capacity) {
    try {
      await apiFetch(`/api/evacuation/centers/${id}/capacity`, {
        method: "PUT",
        body: JSON.stringify({ capacity }),
      });
      fetchLogs(barangay);
    } catch {
      fetchCenters(barangay);
    }
    setEditId(null);
  }

  async function handleReset(id) {
    try {
      await apiFetch(`/api/evacuation/centers/${id}/reset`, { method: "POST" });
      fetchLogs(barangay);
    } catch {
      fetchCenters(barangay);
    }
    setEditId(null);
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalCap    = centers.reduce((s, c) => s + c.capacity, 0);
  const totalOcc    = centers.reduce((s, c) => s + c.occupancy, 0);
  const activeCount = centers.filter((c) => c.occupancy > 0).length;
  const vacantCount = centers.filter((c) => c.occupancy === 0).length;

  // Sort: Active (1) → Near Full (2) → Full (3) → Vacant (4)
  function sortPriority(c) {
    if (c.occupancy === 0 || c.capacity <= 0) return 4;
    const p = c.occupancy / c.capacity;
    if (p >= 1)   return 3;
    if (p >= 0.8) return 2;
    return 1;
  }
  const sortedCenters = [...centers].sort((a, b) => sortPriority(a) - sortPriority(b));

  const editCenter = centers.find((c) => c._id === editId) ?? null;
  const brgyLabel  = BARANGAYS.find((b) => b.value === barangay)?.label ?? barangay;

  const stored = localStorage.getItem("user");
  const isAdmin = stored ? JSON.parse(stored).role === "admin" : false;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evacuation Centers</h1>
          <p className="text-sm text-gray-500 mt-1">Antipolo City — {brgyLabel} Pilot Tracking</p>
        </div>

        {/* Barangay selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setBrgyOpen((o) => !o)}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 shadow-sm transition-colors"
          >
            {brgyLabel}
            <ChevronDown size={14} className={`transition-transform ${brgyOpen ? "rotate-180" : ""}`} />
          </button>

          {brgyOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
              {BARANGAYS.map((b) => (
                <button
                  key={b.value}
                  onClick={() => { setBarangay(b.value); setBrgyOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                    ${barangay === b.value
                      ? "bg-red-50 text-red-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Capacity", value: totalCap.toLocaleString(), color: "text-gray-900"  },
          { label: "Occupied",       value: totalOcc.toLocaleString(), color: "text-blue-600"  },
          { label: "Active Centers", value: activeCount,               color: "text-green-600" },
          { label: "Vacant Centers", value: vacantCount,               color: "text-gray-500"  },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading centers…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Center cards */}
      {!loading && !error && (
        <div className="space-y-3">
          {sortedCenters.map((c) => {
            const s = statusOf(c.occupancy, c.capacity);
            const p = c.capacity > 0 ? Math.min(100, Math.round((c.occupancy / c.capacity) * 100)) : 0;
            const isEditing = inputId === c._id;

            return (
              <div
                key={c._id}
                className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Image */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    <img
                      src={c.imageUrl || getFacilityImage(c.name)}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = getFacilityImage(c.name); }}
                    />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    {/* Name + status + settings */}
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{c.name}</h3>
                        <p className="text-xs text-gray-400">{c.location}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
                          {s.label}
                        </span>
                        <button
                          onClick={() => setEditId(c._id)}
                          className="text-gray-300 hover:text-gray-500 transition-colors"
                        >
                          <Settings size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2.5 mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400">Occupancy</span>
                        <span className="text-[10px] text-gray-500 font-semibold">{p}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${s.bar}`} style={{ width: `${p}%` }} />
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-400">Evacuees:</span>

                        {/* − */}
                        <button
                          onClick={() => adjust(c._id, -1)}
                          disabled={c.occupancy <= 0}
                          className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors leading-none"
                        >−</button>

                        {/* Count — click to type */}
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min={0} max={c.capacity}
                              value={inputVal} autoFocus
                              onChange={(e) => setInputVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")  commitInput(c._id);
                                if (e.key === "Escape") { setInputId(null); setInputVal(""); }
                              }}
                              className="w-16 text-center text-sm font-bold border border-blue-400 rounded-md px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <button onClick={() => commitInput(c._id)} className="text-green-600 hover:text-green-700">
                              <Check size={14} />
                            </button>
                            <button onClick={() => { setInputId(null); setInputVal(""); }} className="text-gray-400 hover:text-gray-600">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openInput(c._id, c.occupancy)}
                            title="Click to type a number"
                            className="text-sm font-bold text-gray-800 hover:text-blue-600 hover:underline min-w-[2rem] text-center"
                          >
                            {c.occupancy}
                          </button>
                        )}

                        <span className="text-xs text-gray-400 font-medium">/ {c.capacity}</span>

                        {/* + */}
                        <button
                          onClick={() => adjust(c._id, +1)}
                          disabled={c.occupancy >= c.capacity}
                          className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors leading-none"
                        >+</button>
                      </div>

                      <span className="text-[10px] text-gray-400 shrink-0">
                        {c.updatedAt ? `Updated ${fmtTime(c.updatedAt)}` : "Not yet updated"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity log panel — admin only */}
      {isAdmin && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setLogsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <ClipboardList size={15} className="text-gray-400" />
            Activity Log
            {logs.length > 0 && (
              <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </div>
          {logsOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {logsOpen && (
          <div className="border-t border-gray-100 divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No activity recorded yet.</p>
            ) : (
              logs.map((log) => {
                const { actor, text, detail } = describeLog(log);
                return (
                  <div key={log._id} className="px-4 py-2.5 flex items-start gap-3">
                    <div className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-red-500">
                        {actor.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700">
                        <span className="font-semibold">{actor}</span>{" "}
                        <span className="text-gray-500">{text}</span>
                        {detail && <span className="font-mono text-gray-600"> — {detail}</span>}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtTime(log.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>}

      {/* Edit modal */}
      {editCenter && (
        <EditModal
          center={editCenter}
          onClose={() => setEditId(null)}
          onSaveCapacity={handleSaveCapacity}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
