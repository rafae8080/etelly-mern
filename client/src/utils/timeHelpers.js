// ─── Relative time ─────────────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

// Forward-looking: how long until a future date
export function timeUntil(dateStr) {
  if (!dateStr) return "";
  const mins = Math.floor((new Date(dateStr) - Date.now()) / 60000);
  if (mins <= 0) return "expired";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}
