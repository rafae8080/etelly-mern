import { WifiOff } from "lucide-react";
import { useCommunitySharing } from "../hooks/useCommunitySharing";
import RequestsView from "../components/community/RequestsView";

export default function CommunitySharingPage() {
  const { requests, reqLoading, isStale, fetchRequests } = useCommunitySharing();

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Community Sharing</h1>
        {isStale && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-600 font-medium">
            <WifiOff size={14} className="shrink-0" />
            Showing saved data — you appear to be offline
          </p>
        )}
      </div>

      <RequestsView requests={requests} loading={reqLoading} onRefresh={fetchRequests} />
    </div>
  );
}
