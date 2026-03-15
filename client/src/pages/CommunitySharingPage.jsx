import { useState } from "react";

const requestsData = {
  Requests: [
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
  ],
  "In Progress": [
    {
      itemName: "Rice 5kg",
      quantity: 2,
      requestedBy: "Maria Santos",
      date: "2026-01-16",
      time: "10:15:00",
      status: "In Progress",
    },
  ],
  Completed: [
    {
      itemName: "Canned Goods",
      quantity: 10,
      requestedBy: "Juan Dela Cruz",
      date: "2026-01-15",
      time: "09:00:00",
      status: "Completed",
    },
  ],
  Cancelled: [
    {
      itemName: "Medicine Kit",
      quantity: 1,
      requestedBy: "Ana Reyes",
      date: "2026-01-14",
      time: "16:45:00",
      status: "Cancelled",
    },
  ],
};

const donationData = {
  Donation: [
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
    {
      itemName: "Water 1L",
      quantity: 3,
      requestedBy: "Kenneth Bulan",
      date: "2026-01-17",
      time: "14:30:00",
      status: "Pending",
    },
  ],
  "To Receive": [
    {
      itemName: "Blankets",
      quantity: 5,
      requestedBy: "Pedro Cruz",
      date: "2026-01-16",
      time: "11:20:00",
      status: "In Progress",
    },
  ],
  Completed: [
    {
      itemName: "Food Packs",
      quantity: 20,
      requestedBy: "Lisa Garcia",
      date: "2026-01-15",
      time: "13:30:00",
      status: "Completed",
    },
  ],
  Cancelled: [
    {
      itemName: "Tents",
      quantity: 2,
      requestedBy: "Roberto Tan",
      date: "2026-01-14",
      time: "15:00:00",
      status: "Cancelled",
    },
  ],
};

const getStatusColor = (status) => {
  switch (status) {
    case "Pending":
      return "text-orange-500";
    case "In Progress":
      return "text-blue-500";
    case "Completed":
      return "text-green-500";
    case "Cancelled":
      return "text-red-500";
    default:
      return "text-gray-500";
  }
};

const getStatusDotColor = (status) => {
  switch (status) {
    case "Pending":
      return "bg-orange-500";
    case "In Progress":
      return "bg-blue-500";
    case "Completed":
      return "bg-green-500";
    case "Cancelled":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

// Reusable table component to avoid repeating JSX
function RequestTable({ data }) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 overflow-hidden"
      style={{ minHeight: "320px" }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Item Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Requested by
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Date
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Time
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((req, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <td className="px-6 py-4 text-sm text-gray-900">
                  {req.itemName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {req.quantity}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {req.requestedBy}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{req.date}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{req.time}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getStatusDotColor(req.status)}`}
                    />
                    <span
                      className={`font-medium ${getStatusColor(req.status)}`}
                    >
                      {req.status}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CommunitySharingPage() {
  const [activeRequestTab, setActiveRequestTab] = useState("Requests");
  const [activeDonationTab, setActiveDonationTab] = useState("Donation");

  const requestTabs = ["Requests", "In Progress", "Completed", "Cancelled"];
  const donationTabs = ["Donation", "To Receive", "Completed", "Cancelled"];

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Community Sharing</h1>
      </div>

      {/* REQUESTS SECTION */}
      <div>
        <div className="flex justify-between mb-6 border-b border-gray-200 bg-white px-2 py-2.5">
          {requestTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveRequestTab(tab)}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeRequestTab === tab
                  ? "border-b-2 border-red-500 text-red-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <RequestTable data={requestsData[activeRequestTab] || []} />
      </div>

      {/* DONATION SECTION */}
      <div>
        <div className="flex justify-between mb-6 border-b border-gray-200 px-2 py-3 bg-white">
          {donationTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveDonationTab(tab)}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeDonationTab === tab
                  ? "border-b-2 border-green-500 text-green-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <RequestTable data={donationData[activeDonationTab] || []} />
      </div>
    </div>
  );
}
