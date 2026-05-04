import { getStatusColor, getStatusDotColor } from "./helpers";

export default function StatusCell({ status }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(status)}`} />
      <span className={`font-medium ${getStatusColor(status)}`}>{label}</span>
    </div>
  );
}
