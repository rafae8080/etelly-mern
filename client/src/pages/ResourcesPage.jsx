import { useState, useEffect, useCallback, useRef } from "react";
import {
  Package, Plus, SquarePen, Search, X, CircleAlert,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ChevronUp, Loader2, Trash2,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const BARANGAYS = [
  { value: "bagongnayon",  label: "Brgy. Bagong Nayon" },
  { value: "beverlyhills", label: "Brgy. Beverly Hills" },
  { value: "calawis",      label: "Brgy. Calawis" },
  { value: "cupang",       label: "Brgy. Cupang" },
  { value: "dalig",        label: "Brgy. Dalig" },
  { value: "delapaz",      label: "Brgy. Dela Paz" },
  { value: "inarawan",     label: "Brgy. Inarawan" },
  { value: "mambugan",     label: "Brgy. Mambugan" },
  { value: "mayamot",      label: "Brgy. Mayamot" },
  { value: "muntindilaw",  label: "Brgy. Muntindilaw" },
  { value: "sanisidro",    label: "Brgy. San Isidro" },
  { value: "sanjose",      label: "Brgy. San Jose" },
  { value: "sanjuan",      label: "Brgy. San Juan" },
  { value: "sanluis",      label: "Brgy. San Luis" },
  { value: "sanroque",     label: "Brgy. San Roque" },
  { value: "santacruz",    label: "Brgy. Santa Cruz" },
];

const CATEGORIES     = ["All", "Food & Water", "Medical", "Rescue Equipment", "Shelter", "Communication", "Other"];
const ITEM_CATEGORIES = CATEGORIES.slice(1);

const EMPTY_FORM  = { name: "", category: "Food & Water", quantity: "", unit: "pcs", minQuantity: "", expiryDate: "" };
const PAGE_SIZE   = 7;

// ── API helpers ────────────────────────────────────────────────────────────────
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

// ── Status ─────────────────────────────────────────────────────────────────────
function statusOf(item) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (item.expiryDate) {
    const exp = new Date(item.expiryDate);
    exp.setHours(0, 0, 0, 0);
    if (exp < today) return { label: "Expired",       cls: "bg-red-100 text-red-700"      };
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 30);
    if (exp <= soon)  return { label: "Expiring Soon", cls: "bg-orange-100 text-orange-700" };
  }

  if (item.quantity === 0)              return { label: "Out of Stock", cls: "bg-red-100 text-red-700"    };
  if (item.quantity <= item.minQuantity) return { label: "Low Stock",   cls: "bg-yellow-100 text-yellow-700" };
  return                                        { label: "In Stock",    cls: "bg-green-100 text-green-700"   };
}

function isExpiringSoon(item) {
  if (!item.expiryDate) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp   = new Date(item.expiryDate); exp.setHours(0, 0, 0, 0);
  if (exp < today) return false; // already expired — not "expiring soon"
  const soon  = new Date(today); soon.setDate(soon.getDate() + 30);
  return exp <= soon;
}

const ALERT_TILES = [
  { key: "expired",    label: "items expired",       tileCls: "hover:bg-red-50 text-red-700",    badgeCls: "bg-red-100 text-red-700"    },
  { key: "expiring",   label: "items expiring soon", tileCls: "hover:bg-orange-50 text-orange-700", badgeCls: "bg-orange-100 text-orange-700" },
  { key: "lowstock",   label: "items low on stock",  tileCls: "hover:bg-yellow-50 text-yellow-700", badgeCls: "bg-yellow-100 text-yellow-700" },
  { key: "outofstock", label: "items out of stock",  tileCls: "hover:bg-red-50 text-red-700",    badgeCls: "bg-red-100 text-red-700"    },
];

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
  });
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function describeLog(log) {
  const actor = log.user?.name ?? "Unknown";
  switch (log.action) {
    case "item_created":
      return { actor, text: `added "${log.itemName}"`,      detail: `qty: ${log.newValue}`                         };
    case "item_deleted":
      return { actor, text: `removed "${log.itemName}"`,    detail: `was ${log.previousValue}`                     };
    case "item_updated":
      return { actor, text: `updated ${log.field ?? "field"} of "${log.itemName}"`,
               detail: `${log.previousValue ?? "—"} → ${log.newValue ?? "—"}` };
    default:
      return { actor, text: `modified "${log.itemName}"`,   detail: ""                                             };
  }
}

// ── Item Modal (Add + Edit) ────────────────────────────────────────────────────
function ItemModal({ item, onClose, onSave, onDelete }) {
  const isEdit = Boolean(item);
  const [form, setForm]               = useState(
    isEdit
      ? {
          name:        item.name,
          category:    item.category,
          quantity:    String(item.quantity),
          unit:        item.unit,
          minQuantity: String(item.minQuantity),
          expiryDate:  item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : "",
        }
      : EMPTY_FORM,
  );
  const [hasExpiry,      setHasExpiry]      = useState(isEdit ? Boolean(item.expiryDate) : false);
  const [err,            setErr]            = useState("");
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    const name = form.name.trim();
    const qty  = parseInt(form.quantity, 10);
    const min  = parseInt(form.minQuantity, 10);

    if (!name)                       return setErr("Item name is required.");
    if (isNaN(qty) || qty < 0)       return setErr("Quantity must be a non-negative number.");
    if (isNaN(min) || min < 0)       return setErr("Minimum stock must be a non-negative number.");
    if (hasExpiry && !form.expiryDate) return setErr("Please enter an expiry date.");

    setSaving(true);
    setErr("");
    try {
      await onSave({
        name,
        category:    form.category,
        quantity:    qty,
        unit:        form.unit.trim() || "pcs",
        minQuantity: min,
        expiryDate:  hasExpiry ? form.expiryDate : null,
      });
    } catch {
      setErr("Failed to save. Try again.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(item._id);
    } catch {
      setErr("Failed to delete. Try again.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? "Edit Item" : "Add Inventory Item"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Item Name *">
            <input
              type="text" autoFocus value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Bottled Water"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </Field>

          <Field label="Category">
            <select value={form.category} onChange={(e) => set("category", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
              {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity *">
              <input type="number" min="0" value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </Field>
            <Field label="Unit">
              <input type="text" value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="pcs, kits, packs…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </Field>
          </div>

          <Field label="Min. Stock Threshold *" hint="Status turns 'Low Stock' when quantity reaches this number">
            <input type="number" min="0" value={form.minQuantity}
              onChange={(e) => set("minQuantity", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
          </Field>

          {/* Expiry toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => { setHasExpiry((v) => !v); if (hasExpiry) set("expiryDate", ""); }}
                className={`relative w-9 h-5 rounded-full transition-colors ${hasExpiry ? "bg-red-500" : "bg-gray-300"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${hasExpiry ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">This item has an expiry date</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 ml-11">Enable for food, medicine, and water supplies</p>
          </div>

          {hasExpiry && (
            <Field label="Expiry Date *">
              <input type="date" value={form.expiryDate}
                onChange={(e) => set("expiryDate", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </Field>
          )}

          {isEdit && item.donatedBy?.length > 0 && (
            <Field label="Donated By">
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                {item.donatedBy.join(", ")}
              </p>
            </Field>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
          </button>
        </div>

        {/* Delete section — edit only */}
        {isEdit && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 size={14} /> Remove this item
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600 flex-1">Permanently remove this item?</p>
                <button onClick={() => setConfirmDelete(false)}
                  className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-sm font-semibold text-red-600 hover:text-red-800 disabled:opacity-50">
                  {deleting ? "Removing…" : "Yes, Remove"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ResourcesPage() {
  const [barangay,    setBarangay]   = useState("muntindilaw");
  const [items,       setItems]      = useState([]);
  const [logs,        setLogs]       = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState(null);
  const [search,      setSearch]     = useState("");
  const [activeCat,   setActiveCat]  = useState("All");
  const [modalItem,   setModalItem]  = useState(undefined); // undefined=closed, null=add, object=edit
  const [page,        setPage]       = useState(1);
  const [alertFilter, setAlertFilter] = useState(null); // null | "expired" | "expiring" | "lowstock" | "outofstock"
  const [alertOpen,   setAlertOpen]   = useState(false);
  const [logsOpen,    setLogsOpen]   = useState(false);
  const [brgyOpen,    setBrgyOpen]   = useState(false);
  const brgyBtnRef  = useRef(null);
  const alertBtnRef = useRef(null);

  const stored  = localStorage.getItem("user");
  const isAdmin = stored ? JSON.parse(stored).role === "admin" : false;
  const brgyLabel = BARANGAYS.find((b) => b.value === barangay)?.label ?? barangay;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async (brgy) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/inventory?barangay=${brgy}`);
      setItems(data);
    } catch {
      setError("Failed to load inventory. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (brgy) => {
    if (!isAdmin) return;
    try {
      const data = await apiFetch(`/api/inventory/logs?barangay=${brgy}&limit=50`);
      setLogs(data);
    } catch { /* non-critical */ }
  }, [isAdmin]);

  useEffect(() => {
    fetchItems(barangay);
    fetchLogs(barangay);
  }, [barangay, fetchItems, fetchLogs]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const todayTs         = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const outOfStockCount = items.filter((i) => i.quantity === 0).length;
  const lowStockCount   = items.filter((i) => i.quantity > 0 && i.quantity <= i.minQuantity).length;
  const expiringSoon    = items.filter(isExpiringSoon).length;
  const expiredCount    = items.filter((i) => {
    if (!i.expiryDate) return false;
    const exp = new Date(i.expiryDate); exp.setHours(0,0,0,0);
    return exp < todayTs;
  }).length;

  const ALERT_COUNTS = { expired: expiredCount, expiring: expiringSoon, lowstock: lowStockCount, outofstock: outOfStockCount };
  const totalIssues  = expiredCount + expiringSoon + lowStockCount + outOfStockCount;

  // ── Filter + pagination ────────────────────────────────────────────────────
  const visible = items.filter((item) => {
    const matchCat    = activeCat === "All" || item.category === activeCat;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase().trim());

    let matchAlert = true;
    if (alertFilter === "expired") {
      if (!item.expiryDate) return false;
      const exp = new Date(item.expiryDate); exp.setHours(0,0,0,0);
      matchAlert = exp < todayTs;
    } else if (alertFilter === "expiring") {
      matchAlert = isExpiringSoon(item);
    } else if (alertFilter === "lowstock") {
      matchAlert = item.quantity > 0 && item.quantity <= item.minQuantity;
    } else if (alertFilter === "outofstock") {
      matchAlert = item.quantity === 0;
    }

    return matchCat && matchSearch && matchAlert;
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  async function handleSave(data) {
    if (modalItem === null) {
      await apiFetch("/api/inventory", {
        method: "POST",
        body: JSON.stringify({ ...data, barangay }),
      });
    } else {
      await apiFetch(`/api/inventory/${modalItem._id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    }
    await fetchItems(barangay);
    fetchLogs(barangay);
    setModalItem(undefined);
  }

  async function handleDelete(id) {
    await apiFetch(`/api/inventory/${id}`, { method: "DELETE" });
    await fetchItems(barangay);
    fetchLogs(barangay);
    setModalItem(undefined);
  }


  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resource Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Antipolo City — {brgyLabel}</p>
        </div>

        {/* Desktop: one row. Mobile: [CircleAlert+AddItem] on top, [Barangay] below */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">

            {/* Alert popover button */}
            <div className="relative" ref={alertBtnRef}>
              <button
                onClick={() => setAlertOpen((o) => !o)}
                className={`relative p-2 rounded-xl border transition-colors ${
                  alertFilter
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
                title="View stock alerts"
              >
                <CircleAlert size={16} />
                {!alertFilter && totalIssues > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {totalIssues > 9 ? "9+" : totalIssues}
                  </span>
                )}
              </button>

              {alertOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAlertOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-52 p-1.5">
                    {ALERT_TILES.filter((t) => ALERT_COUNTS[t.key] > 0).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3 px-2">All items are in good condition.</p>
                    ) : (
                      ALERT_TILES.filter((t) => ALERT_COUNTS[t.key] > 0).map((tile) => (
                        <button
                          key={tile.key}
                          onClick={() => {
                            setAlertFilter(alertFilter === tile.key ? null : tile.key);
                            setPage(1);
                            setAlertOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            alertFilter === tile.key
                              ? tile.tileCls.replace("hover:", "") + " font-semibold"
                              : tile.tileCls
                          }`}
                        >
                          <span>{ALERT_COUNTS[tile.key]} {tile.label}</span>
                          {alertFilter === tile.key && <X size={12} />}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setModalItem(null)}
              className="flex items-center gap-1.5 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-red-700 shadow-sm transition-colors"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          {/* Barangay dropdown */}
          <div className="relative">
            <button
              ref={brgyBtnRef}
              onClick={() => setBrgyOpen((o) => !o)}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 shadow-sm transition-colors"
            >
              {brgyLabel}
              <ChevronDown size={14} className={`transition-transform ${brgyOpen ? "rotate-180" : ""}`} />
            </button>

            {brgyOpen && (() => {
              const rect = brgyBtnRef.current?.getBoundingClientRect();
              return (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBrgyOpen(false)} />
                  <div
                    className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-y-auto max-h-72"
                    style={{
                      top:      rect ? rect.bottom + 4 : 0,
                      right:    rect ? window.innerWidth - rect.right : 0,
                      minWidth: rect ? rect.width : 160,
                      maxWidth: 240,
                    }}
                  >
                    {BARANGAYS.map((b) => (
                      <button
                        key={b.value}
                        onClick={() => { setBarangay(b.value); setBrgyOpen(false); setSearch(""); setActiveCat("All"); setAlertFilter(null); setPage(1); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                          ${barangay === b.value
                            ? "bg-red-50 text-red-700 font-semibold"
                            : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Items"    value={items.length}    color="text-gray-900" />
        <StatCard label="Out of Stock"   value={outOfStockCount} color="text-red-600"  />
        <StatCard label="Low Stock"      value={lowStockCount}   color="text-yellow-600" />
        <StatCard label="Expiring Soon"  value={expiringSoon}    color="text-orange-600" />
      </div>

      {/* Search + category filter */}
      <div className="flex flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
        <select
          value={activeCat}
          onChange={(e) => { setActiveCat(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {alertFilter && (
          <button
            onClick={() => { setAlertFilter(null); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            {ALERT_COUNTS[alertFilter]} {ALERT_TILES.find((t) => t.key === alertFilter)?.label}
            <X size={12} />
          </button>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading inventory…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && visible.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <Package size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No items found</p>
        </div>
      )}

      {/* Desktop table */}
      {!loading && !error && visible.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Item</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Qty / Unit</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Min. Stock</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Expiry</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Donated By</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map((item) => {
                  const st = statusOf(item);
                  return (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.category}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">
                        {item.quantity}{" "}
                        <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {item.minQuantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">
                        {fmtDate(item.expiryDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px]">
                        <span className="line-clamp-2 leading-snug">
                          {item.donatedBy?.length > 0 ? item.donatedBy.join(", ") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setModalItem(item)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Edit item"
                        >
                          <SquarePen size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {Array.from({ length: PAGE_SIZE - paginated.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-t border-gray-50">
                    <td className="px-4 py-3">&nbsp;</td>
                    <td /><td /><td /><td /><td /><td /><td />
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-gray-500">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((item) => {
              const st = statusOf(item);
              return (
                <div key={item._id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                      <button
                        onClick={() => setModalItem(item)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <SquarePen size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                      <p className="text-gray-400 mb-0.5">Quantity</p>
                      <p className="font-semibold text-gray-800">{item.quantity} <span className="font-normal text-gray-400">{item.unit}</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                      <p className="text-gray-400 mb-0.5">Min. Stock</p>
                      <p className="font-semibold text-gray-800">{item.minQuantity} <span className="font-normal text-gray-400">{item.unit}</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                      <p className="text-gray-400 mb-0.5">Expiry</p>
                      <p className={`font-semibold ${item.expiryDate && new Date(item.expiryDate) < todayTs ? "text-red-600" : "text-gray-800"}`}>
                        {fmtDate(item.expiryDate)}
                      </p>
                    </div>
                  </div>
                  {item.donatedBy?.length > 0 && (
                    <div className="mt-2 bg-gray-50 rounded-lg px-2.5 py-2 text-xs">
                      <p className="text-gray-400 mb-0.5">Donated By</p>
                      <p className="font-semibold text-gray-800">{item.donatedBy.join(", ")}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-3 md:hidden">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold text-gray-500">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Activity log — admin only */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => { setLogsOpen((o) => !o); if (!logsOpen) fetchLogs(barangay); }}
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
            {logsOpen
              ? <ChevronUp size={15} className="text-gray-400" />
              : <ChevronDown size={15} className="text-gray-400" />}
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
        </div>
      )}

      {/* Modal */}
      {modalItem !== undefined && (
        <ItemModal
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
