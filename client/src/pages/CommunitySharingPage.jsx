import { useState } from "react";
import { useCommunitySharing } from "../hooks/useCommunitySharing";
import RequestsView from "../components/community/RequestsView";
import DonationsView from "../components/community/DonationsView";

const TABS = [
  { key: "requests",  label: "Requests"  },
  { key: "donations", label: "Donations" },
];

export default function CommunitySharingPage() {
  const [tab, setTab] = useState("requests");
  const { requests, donations, reqLoading, donLoading, fetchRequests, fetchDonations } =
    useCommunitySharing();

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Community Sharing</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requests"
        ? <RequestsView  requests={requests}   loading={reqLoading} onRefresh={fetchRequests}  />
        : <DonationsView donations={donations} loading={donLoading} onRefresh={fetchDonations} />
      }
    </div>
  );
}
