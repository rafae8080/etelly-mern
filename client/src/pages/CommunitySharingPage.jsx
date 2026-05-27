import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useCommunitySharing } from "../hooks/useCommunitySharing";
import RequestsView from "../components/community/RequestsView";
import DonationsView from "../components/community/DonationsView";
import { API_BASE, authHeaders } from "../components/community/helpers";

const TABS = [
  { key: "requests",  label: "Requests"        },
  { key: "donations", label: "Donations"        },
  { key: "board",     label: "Community Board"  },
];

const PRIORITY_BADGE = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  normal:   "bg-gray-100 text-gray-500",
};

const CATEGORIES = ["food","water","clothing","medicine","hygiene","shelter","other"];

// Inline form to post an official CDRRMO supply offer
function OfficialOfferForm({ onSuccess, onCancel }) {
  const [category,     setCategory]     = useState("food");
  const [item,         setItem]         = useState("");
  const [quantity,     setQuantity]     = useState("");
  const [unit,         setUnit]         = useState("pcs");
  const [barangay,     setBarangay]     = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!item.trim() || !quantity || !barangay.trim()) {
      setError("Item, quantity, and barangay are required.");
      return;
    }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/community/donations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          category, itemDescription: item.trim(),
          quantity: Number(quantity), unit: unit || "pcs",
          barangay: barangay.trim(), isOfficial: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to post offer.");
      onSuccess();
    } catch (err) { setError(err.message); setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-green-200 rounded-xl p-5 space-y-3 shadow-sm">
      <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
        <ShieldCheck size={15} /> Post Official CDRRMO Supply Offer
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400">
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Barangay</label>
          <input type="text" value={barangay} onChange={(e) => setBarangay(e.target.value)}
            placeholder="e.g. Bagong Nayon"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Item Description</label>
        <input type="text" value={item} onChange={(e) => setItem(e.target.value)}
          placeholder="e.g. Bottled Water 500ml"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Unit</label>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle size={11} /> {error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
          {submitting ? "Posting…" : "Post Offer"}
        </button>
      </div>
    </form>
  );
}

function CommunityBoardView({ board, boardLoading, onRefresh }) {
  const stored = localStorage.getItem("user");
  const role = stored ? JSON.parse(stored).role : null;
  const isAdmin = ["admin", "barangay_official"].includes(role);

  const [showOfficialForm, setShowOfficialForm] = useState(false);

  const openNeeds    = board.requests;
  const officialOffers  = board.donations.filter((d) => d.isOfficial);
  const communityOffers = board.donations.filter((d) => !d.isOfficial);

  if (boardLoading) {
    return (
      <div className="space-y-3 py-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 italic">
        This is what residents see on their mobile app.
      </p>

      {isAdmin && (
        showOfficialForm ? (
          <OfficialOfferForm
            onSuccess={() => { setShowOfficialForm(false); onRefresh(); }}
            onCancel={() => setShowOfficialForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowOfficialForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            <ShieldCheck size={15} /> Post CDRRMO Offer
          </button>
        )
      )}

      {/* Open Needs */}
      <section>
        <h3 className="text-base font-semibold text-gray-800 mb-3">
          Open Needs ({openNeeds.length})
        </h3>
        {openNeeds.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No open needs right now.</p>
        ) : (
          <div className="space-y-2">
            {openNeeds.map((r) => (
              <div key={r._id} className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{r.itemDescription}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.requesterName} · {r.barangay} · {r.quantity} {r.unit}
                  </p>
                  {r.pledgeCount > 0 && (
                    <p className="text-xs text-purple-600 mt-0.5 font-medium">
                      {r.pledgeCount} {r.pledgeCount === 1 ? "person offered" : "people offered"} to help
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {r.urgent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Urgent</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_BADGE[r.priority] || PRIORITY_BADGE.normal}`}>
                    {r.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CDRRMO Official Supplies */}
      {officialOffers.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ShieldCheck size={16} className="text-green-600" />
            CDRRMO Supplies ({officialOffers.length})
          </h3>
          <div className="space-y-2">
            {officialOffers.map((d) => (
              <div key={d._id} className="flex items-start justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{d.itemDescription}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {d.barangay} · {d.quantity} {d.unit}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Official</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Community Offers (donations) */}
      {communityOffers.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-gray-800 mb-3">
            Available to Give ({communityOffers.length})
          </h3>
          <div className="space-y-2">
            {communityOffers.map((d) => (
              <div key={d._id} className="flex items-start justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{d.itemDescription}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {d.donorName} · {d.barangay} · {d.quantity} {d.unit}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 capitalize">{d.category}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {openNeeds.length === 0 && officialOffers.length === 0 && communityOffers.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">The community board is empty.</p>
      )}
    </div>
  );
}

export default function CommunitySharingPage() {
  const [tab, setTab] = useState("requests");
  const {
    requests, donations,
    reqLoading, donLoading,
    fetchRequests, fetchDonations,
    board, boardLoading, fetchBoard,
  } = useCommunitySharing();

  const handleTabChange = (key) => {
    setTab(key);
    if (key === "board") fetchBoard();
  };

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Community Sharing</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <RequestsView requests={requests} loading={reqLoading} onRefresh={fetchRequests} />
      )}
      {tab === "donations" && (
        <DonationsView donations={donations} loading={donLoading} onRefresh={fetchDonations} />
      )}
      {tab === "board" && (
        <CommunityBoardView
          board={board}
          boardLoading={boardLoading}
          onRefresh={fetchBoard}
        />
      )}
    </div>
  );
}
