import { WifiOff, RefreshCw } from "lucide-react";

const timeAgo = (ts) => {
  if (!ts) return "unknown";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs !== 1 ? "s" : ""} ago`;
};

const OfflineBanner = ({ cachedAt, onRefresh }) => {
  return (
    <div
      className="absolute top-[70px] left-2 right-2 z-[1050]
                    sm:left-[60px] sm:right-[220px]
                    bg-amber-50 border border-amber-300 rounded-xl
                    px-3 py-2 flex items-center gap-2 shadow-sm"
    >
      <WifiOff size={13} className="text-amber-600 flex-shrink-0" />
      <p className="text-[11px] text-amber-700 flex-1">
        <span className="font-semibold">Offline</span> — showing cached
        predictions from {timeAgo(cachedAt)}
      </p>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1 text-[10px] text-amber-700
                   font-medium hover:text-amber-900 transition-colors"
      >
        <RefreshCw size={11} />
        Retry
      </button>
    </div>
  );
};

export default OfflineBanner;
