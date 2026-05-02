const SUMMARY_ITEMS = [
  { key: "evacuate", label: "Evacuate", countColor: "text-red-600",   labelColor: "text-red-500",   bg: "bg-red-50",   border: "border-red-100",   dot: "bg-red-500"   },
  { key: "critical", label: "Critical", countColor: "text-red-800",   labelColor: "text-red-600",   bg: "bg-red-50",   border: "border-red-100",   dot: "bg-red-700"   },
  { key: "warning",  label: "Warning",  countColor: "text-amber-800", labelColor: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", dot: "bg-amber-500" },
  { key: "watch",    label: "Watch",    countColor: "text-blue-800",  labelColor: "text-blue-600",  bg: "bg-blue-50",  border: "border-blue-100",  dot: "bg-blue-500"  },
];

export default function SummaryBar({ counts }) {
  const items = SUMMARY_ITEMS.filter((i) => counts[i.key] > 0);
  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {items.map((i) => (
        <div
          key={i.key}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border ${i.bg} ${i.border}`}
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i.dot}`} />
          <span className={`text-lg font-bold font-mono leading-none ${i.countColor}`}>
            {counts[i.key]}
          </span>
          <span className={`text-xs font-semibold uppercase tracking-widest ${i.labelColor}`}>
            {i.label}
          </span>
        </div>
      ))}
    </div>
  );
}
