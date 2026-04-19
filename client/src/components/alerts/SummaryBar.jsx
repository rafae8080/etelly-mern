// ─── Summary bar ───────────────────────────────────────────────────────────────

const SUMMARY_ITEMS = [
  { key: "evacuate", label: "Evacuate", color: "bg-red-600 text-white" },
  { key: "critical", label: "Critical", color: "bg-red-100 text-red-700" },
  { key: "warning",  label: "Warning",  color: "bg-amber-100 text-amber-700" },
  { key: "watch",    label: "Watch",    color: "bg-blue-50 text-blue-700" },
];

export default function SummaryBar({ counts }) {
  const items = SUMMARY_ITEMS.filter((i) => counts[i.key] > 0);
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
