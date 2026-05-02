import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Trash2,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle,
} from "lucide-react";

const CATEGORIES = [
  "All",
  "Food & Water",
  "Medical",
  "Rescue Equipment",
  "Shelter",
  "Communication",
  "Other",
];
const ITEM_CATEGORIES = CATEGORIES.slice(1);

const STORAGE_KEY = "etelly-inventory";

const DEFAULT_ITEMS = [
  { id: "d1", name: "Bottled Water (500ml)", category: "Food & Water", quantity: 240, unit: "pcs", minQuantity: 100 },
  { id: "d2", name: "Emergency Rations", category: "Food & Water", quantity: 15, unit: "packs", minQuantity: 50 },
  { id: "d3", name: "First Aid Kits", category: "Medical", quantity: 8, unit: "kits", minQuantity: 20 },
  { id: "d4", name: "Stretchers", category: "Rescue Equipment", quantity: 5, unit: "pcs", minQuantity: 5 },
  { id: "d5", name: "Life Vests", category: "Rescue Equipment", quantity: 0, unit: "pcs", minQuantity: 10 },
  { id: "d6", name: "Emergency Blankets", category: "Shelter", quantity: 60, unit: "pcs", minQuantity: 50 },
  { id: "d7", name: "Two-Way Radios", category: "Communication", quantity: 3, unit: "units", minQuantity: 5 },
];

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

function statusOf(quantity, minQuantity) {
  if (quantity === 0)
    return { label: "Out of Stock", cls: "bg-red-100 text-red-700" };
  if (quantity <= minQuantity)
    return { label: "Low Stock", cls: "bg-yellow-100 text-yellow-700" };
  return { label: "In Stock", cls: "bg-green-100 text-green-700" };
}

const EMPTY_FORM = {
  name: "",
  category: "Food & Water",
  quantity: "",
  unit: "pcs",
  minQuantity: "",
};

export default function ResourcesPage() {
  const [items, setItems] = useState(loadItems);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const lowStockCount = items.filter(
    (i) => i.quantity > 0 && i.quantity <= i.minQuantity,
  ).length;
  const outOfStockCount = items.filter((i) => i.quantity === 0).length;
  const inStockCount = items.filter((i) => i.quantity > i.minQuantity).length;
  const categoryCount = new Set(items.map((i) => i.category)).size;

  const visible = items.filter((item) => {
    const matchCat =
      activeCategory === "All" || item.category === activeCategory;
    const matchSearch = item.name
      .toLowerCase()
      .includes(search.toLowerCase().trim());
    return matchCat && matchSearch;
  });

  const adjustQty = (id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item,
      ),
    );
  };

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const submitForm = () => {
    const name = form.name.trim();
    const qty = parseInt(form.quantity, 10);
    const min = parseInt(form.minQuantity, 10);

    if (!name) return setFormError("Item name is required.");
    if (isNaN(qty) || qty < 0)
      return setFormError("Quantity must be a non-negative number.");
    if (isNaN(min) || min < 0)
      return setFormError("Minimum stock must be a non-negative number.");

    setItems((prev) => [
      {
        id: Date.now().toString(),
        name,
        category: form.category,
        quantity: qty,
        unit: form.unit.trim() || "pcs",
        minQuantity: min,
      },
      ...prev,
    ]);
    setShowModal(false);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Resource Inventory
          </h1>
          <p className="text-gray-600 mt-2">
            Track disaster relief supplies and equipment
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Items"
          value={items.length}
          sub={`${categoryCount} categor${categoryCount === 1 ? "y" : "ies"}`}
        />
        <StatCard label="In Stock" value={inStockCount} color="text-green-600" />
        <StatCard
          label="Low Stock"
          value={lowStockCount}
          color="text-yellow-600"
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockCount}
          color="text-red-600"
        />
      </div>

      {/* Search + Category Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-red-600 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <Package size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No items found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Category
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">
                  Quantity
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">
                  Min. Stock
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((item) => {
                const status = statusOf(item.quantity, item.minQuantity);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => adjustQty(item.id, -1)}
                          disabled={item.quantity === 0}
                          className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Decrease"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <span className="w-16 text-center font-semibold text-gray-900">
                          {item.quantity}{" "}
                          <span className="text-xs font-normal text-gray-400">
                            {item.unit}
                          </span>
                        </span>
                        <button
                          onClick={() => adjustQty(item.id, 1)}
                          className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                          title="Increase"
                        >
                          <ChevronUp size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {item.minQuantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Low / out-of-stock banner */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="mt-6 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            {outOfStockCount > 0 && (
              <strong>
                {outOfStockCount} item{outOfStockCount > 1 ? "s" : ""} out of
                stock
              </strong>
            )}
            {outOfStockCount > 0 && lowStockCount > 0 && " and "}
            {lowStockCount > 0 && (
              <strong>
                {lowStockCount} item{lowStockCount > 1 ? "s" : ""} below
                minimum stock
              </strong>
            )}
            {" — consider restocking before the next disaster event."}
          </span>
        </div>
      )}

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Add Inventory Item
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Item Name *">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Bottled Water"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
              </Field>

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {ITEM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Current Quantity *">
                  <input
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </Field>
                <Field label="Unit">
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    placeholder="pcs, kits, packs…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </Field>
              </div>

              <Field
                label="Minimum Stock Threshold *"
                hint="Status turns 'Low Stock' when quantity reaches this number"
              >
                <input
                  type="number"
                  min="0"
                  value={form.minQuantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minQuantity: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </Field>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-gray-900", sub }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
