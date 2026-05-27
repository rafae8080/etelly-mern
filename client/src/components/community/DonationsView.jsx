import { useState } from "react";
import { splitDateTime } from "./helpers";
import StatusCell from "./StatusCell";
import DonationDetailModal from "./DonationDetailModal";

const TABS = ["Offered", "Scheduled", "Received", "Cancelled"];

export default function DonationsView({ donations, loading, onRefresh }) {
  const [activeTab, setActiveTab] = useState("Offered");
  const [selected,  setSelected]  = useState(null);
  const [search,    setSearch]    = useState("");

  const filtered = donations.filter((d) => d.status === activeTab.toLowerCase());

  const displayed = search.trim()
    ? filtered.filter((d) => {
        const term = search.toLowerCase();
        const { date, time } = splitDateTime(d.createdAt);
        return (
          d.donorName?.toLowerCase().includes(term) ||
          d.donorEmail?.toLowerCase().includes(term) ||
          d.pickupAddress?.toLowerCase().includes(term) ||
          d.barangay?.toLowerCase().includes(term) ||
          d.itemDescription?.toLowerCase().includes(term) ||
          d.category?.toLowerCase().includes(term) ||
          d.referenceCode?.toLowerCase().includes(term) ||
          d.dropOffPoint?.toLowerCase().includes(term) ||
          date.toLowerCase().includes(term) ||
          time.toLowerCase().includes(term)
        );
      })
    : filtered;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6 border-b border-gray-200 bg-white px-2 py-2.5">
        <div className="flex gap-4 overflow-x-auto pb-0.5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab
                  ? "border-b-2 border-green-500 text-green-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="pb-0 sm:pb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ref code, date…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-green-300 text-gray-700 placeholder-gray-400"
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Donor</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Address</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Ref Code</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Drop-off</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-gray-500 text-sm">
                    {search.trim()
                      ? `No results for "${search}" in ${activeTab.toLowerCase()} donations.`
                      : `No ${activeTab.toLowerCase()} donations.`}
                  </td>
                </tr>
              ) : (
                displayed.map((don) => {
                  const { date, time } = splitDateTime(don.createdAt);
                  return (
                    <tr
                      key={don._id}
                      onClick={() => setSelected(don)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{don.itemDescription}</div>
                        <div className="text-xs text-gray-400 capitalize mt-0.5">{don.category}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {don.quantity} {don.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{don.donorName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{don.pickupAddress || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-mono">{don.referenceCode}</td>
                      <td className="px-6 py-4 text-sm">
                        {don.dropOffPoint
                          ? <span className="text-blue-600">{don.dropOffPoint}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{date}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">{time}</td>
                      <td className="px-6 py-4 text-sm">
                        <StatusCell status={don.status} />
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
        <DonationDetailModal
          don={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { onRefresh(); setSelected(null); }}
        />
      )}
    </div>
  );
}
