// ─── Summary Bar Redesign ─────────────────────────────────────────────────────

const SUMMARY_ITEMS = [
  {
    key: "evacuate",
    label: "Evacuate",
    color: "bg-red-600 text-white",
    border: "border-red-700",
  },
  {
    key: "critical",
    label: "Critical",
    color: "bg-red-100 text-red-800",
    border: "border-red-200",
  },
  {
    key: "warning",
    label: "Warning",
    color: "bg-amber-100 text-amber-800",
    border: "border-amber-200",
  },
  {
    key: "watch",
    label: "Watch",
    color: "bg-blue-100 text-blue-800",
    border: "border-blue-200",
  },
];

export default function SummaryBar({ counts }) {
  const items = SUMMARY_ITEMS.filter((i) => counts[i.key] > 0);
  if (items.length === 0) return null;

  return (
    <div
      className="grid gap-2 w-full"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((i) => (
        <div
          key={i.key}
          className={`flex flex-col items-center justify-center py-3 px-2 rounded-md border ${i.color} ${i.border} shadow-sm`}
        >
          {/* Large count on top */}
          <span className="text-xl font-black leading-none">
            {counts[i.key]}
          </span>

          {/* Label on bottom */}
          <span className="text-[10px] uppercase tracking-wider font-bold mt-1 opacity-90">
            {i.label}
          </span>
        </div>
      ))}
    </div>
  );
}
