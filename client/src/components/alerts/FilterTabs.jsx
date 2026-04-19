// ─── Filter tabs ───────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "evacuate", label: "Evacuate" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "watch", label: "Watch" },
];

export default function FilterTabs({ activeFilter, onFilterChange, counts }) {
  return (
    <div className="flex gap-1 mb-4 flex-shrink-0">
      {FILTER_TABS.map((tab) => {
        const count = tab.key === "all" ? counts.total : (counts[tab.key] ?? 0);
        const isActive = activeFilter === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
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
  );
}
