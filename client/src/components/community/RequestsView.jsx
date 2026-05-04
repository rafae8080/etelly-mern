import { useState } from "react";
import { splitDateTime } from "./helpers";
import StatusCell from "./StatusCell";
import RequestDetailModal from "./RequestDetailModal";

const TABS = ["Pending", "Approved", "Fulfilled", "Rejected", "Cancelled"];

export default function RequestsView({ requests, loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState("Pending");
  const [selected,  setSelected]  = useState(null);
  const [search,    setSearch]    = useState("");

  const filtered = requests.filter((r) => r.status === activeTab.toLowerCase());

  const displayed = search.trim()
    ? filtered.filter((r) => {
        const term = search.toLowerCase();
        const { date, time } = splitDateTime(r.createdAt);
        return (
          r.requesterName?.toLowerCase().includes(term) ||
          r.requesterEmail?.toLowerCase().includes(term) ||
          r.barangay?.toLowerCase().includes(term) ||
          r.address?.toLowerCase().includes(term) ||
          r.itemDescription?.toLowerCase().includes(term) ||
          r.category?.toLowerCase().includes(term) ||
          date.toLowerCase().includes(term) ||
          time.toLowerCase().includes(term)
        );
      })
    : filtered;

  return (
    <div>
      <div className="flex items-end justify-between mb-6 border-b border-gray-200 bg-white px-2 py-2.5">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-b-2 border-red-500 text-red-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, address, date…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-700 placeholder-gray-400"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: "320px" }}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Quantity</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Requested By</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Address</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-500 text-sm">
                    {search.trim()
                      ? `No results for "${search}" in ${activeTab.toLowerCase()} requests.`
                      : `No ${activeTab.toLowerCase()} requests.`}
                  </td>
                </tr>
              ) : (
                displayed.map((req) => {
                  const { date, time } = splitDateTime(req.createdAt);
                  return (
                    <tr
                      key={req._id}
                      onClick={() => setSelected(req)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{req.itemDescription}</div>
                        <div className="text-xs text-gray-400 capitalize mt-0.5">{req.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {req.quantity} {req.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className={req.householdFlag ? "text-amber-600 font-semibold" : ""}>
                          {req.requesterName}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{req.barangay}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[180px]">
                        <span className="block truncate">{req.address}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{time}</td>
                      <td className="px-6 py-4 text-sm">
                        <StatusCell status={req.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <RequestDetailModal
          req={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { onRefresh(); setSelected(null); }}
        />
      )}
    </div>
  );
}
