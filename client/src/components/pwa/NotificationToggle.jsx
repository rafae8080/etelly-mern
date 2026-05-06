import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

export default function NotificationToggle() {
  const { permission, subscribed, loading, isSupported, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) return null;

  const handleClick = () => {
    if (subscribed) unsubscribe();
    else subscribe();
  };

  const title = subscribed
    ? "Disable push notifications"
    : permission === "denied"
      ? "Notifications blocked — enable in browser settings"
      : "Enable push notifications";

  return (
    <button
      onClick={handleClick}
      disabled={loading || permission === "denied"}
      title={title}
      className={[
        "relative flex items-center justify-center w-10 h-10 rounded-full transition-colors",
        subscribed
          ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
          : "text-gray-500 hover:bg-gray-100",
        (loading || permission === "denied") && "opacity-50 cursor-not-allowed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {subscribed ? <Bell size={18} /> : <BellOff size={18} />}

      {/* Green dot when subscribed */}
      {subscribed && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-500 rounded-full" />
      )}

      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </span>
      )}
    </button>
  );
}
