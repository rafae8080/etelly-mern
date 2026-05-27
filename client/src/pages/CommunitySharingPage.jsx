import { useCommunitySharing } from "../hooks/useCommunitySharing";
import RequestsView from "../components/community/RequestsView";

export default function CommunitySharingPage() {
  const { requests, reqLoading, fetchRequests } = useCommunitySharing();

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Community Sharing</h1>
      </div>

      <RequestsView requests={requests} loading={reqLoading} onRefresh={fetchRequests} />
    </div>
  );
}
