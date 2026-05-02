import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { SEVERITY_CONFIG } from "../../hooks/useAlerts";
import LocationPicker from "./LocationPicker/LocationPicker";

// ─── Create Alert Modal ────────────────────────────────────────────────────────

export default function CreateAlertModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    source: "CDRRMO",
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
        },
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
                <option value="CDRRMO">CDRRMO</option>
                <option value="residents">Residents</option>
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

          {/* Location picker */}
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
