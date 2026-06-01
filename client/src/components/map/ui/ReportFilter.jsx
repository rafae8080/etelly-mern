import { useState } from "react";
import {
  Filter,
  X,
  LayoutList,
  Waves,
  AlertOctagon,
  Cross,
  Building2,
  MountainSnow,
  Flame,
  AlertTriangle,
} from "lucide-react";

const REPORT_TYPES = [
  { id: "all", label: "All Reports", icon: LayoutList, color: "#6b7280" },
  { id: "flood", label: "Flood", icon: Waves, color: "#06b6d4" },
  { id: "rescue", label: "Rescue", icon: AlertOctagon, color: "#ef4444" },
  { id: "medical", label: "Medical", icon: Cross, color: "#ec4899" },
  { id: "earthquake", label: "Earthquake", icon: Building2, color: "#f97316" },
  { id: "landslide", label: "Landslide", icon: MountainSnow, color: "#8b5cf6" },
  { id: "fire", label: "Fire", icon: Flame, color: "#dc2626" },
  { id: "other", label: "Other", icon: AlertTriangle, color: "#64748b" },
];

export default function ReportFilter({ onFilterChange, isOpen, onToggle }) {
  const [selectedTypes, setSelectedTypes] = useState(["all"]);

  const handleTypeToggle = (typeId) => {
    let newSelected;

    if (typeId === "all") {
      newSelected = ["all"];
    } else {
      const withoutAll = selectedTypes.filter((t) => t !== "all");

      if (withoutAll.includes(typeId)) {
        newSelected = withoutAll.filter((t) => t !== typeId);
        if (newSelected.length === 0) {
          newSelected = ["all"];
        }
      } else {
        newSelected = [...withoutAll, typeId];
      }
    }

    setSelectedTypes(newSelected);
    onFilterChange({ types: newSelected });
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-4 top-[140px] z-[1000] bg-white border border-gray-300 rounded-lg p-2 shadow-sm hover:bg-gray-50"
        title="Filter reports"
      >
        <Filter size={18} />
      </button>
    );
  }

  return (
    <div className="absolute right-4 top-[140px] z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[200px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Filter Reports</h3>
        <button onClick={onToggle} className="p-1 hover:bg-gray-100 rounded">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {REPORT_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <label
              key={type.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded"
            >
              <input
                type="checkbox"
                checked={selectedTypes.includes(type.id)}
                onChange={() => handleTypeToggle(type.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Icon size={18} color={type.color} strokeWidth={2} />
              <span className="text-sm text-gray-700">{type.label}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={() => {
            setSelectedTypes(["all"]);
            onFilterChange({ types: ["all"] });
          }}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
