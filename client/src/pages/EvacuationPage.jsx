import { Settings } from "lucide-react";

export default function EvacuationCentersPage() {
  const evacuationCenters = [
    {
      id: 1,
      name: "Multipurpose Hall II",
      address: "Tanza 1, 70 Camia St, Navotas, Metro Manila",
      status: "Available",
      statusColor: "text-green-600",
      dotColor: "bg-green-600",
      currentCapacity: 15,
      totalCapacity: 200,
      capacityBgColor: "bg-green-50",
      capacityTextColor: "text-green-600",
      image: "src/images/building.png",
    },
    {
      id: 2,
      name: "Multipurpose Hall II",
      address: "Tanza 1, 70 Camia St, Navotas, Metro Manila",
      status: "Available",
      statusColor: "text-orange-600",
      dotColor: "bg-orange-600",
      currentCapacity: 190,
      totalCapacity: 250,
      capacityBgColor: "bg-orange-50",
      capacityTextColor: "text-orange-600",
      image: "src/images/building.png",
    },
    {
      id: 3,
      name: "Annex Hall",
      address: "Tanza 1, 70 Camia St, Navotas, Metro Manila",
      status: "Full",
      statusColor: "text-red-600",
      dotColor: "bg-red-600",
      currentCapacity: 250,
      totalCapacity: 255,
      capacityBgColor: "bg-red-50",
      capacityTextColor: "text-red-600",
      image: "src/images/building.png",
    },
    {
      id: 4,
      name: "Annex Hall II",
      address: "Tanza 1, 70 Camia St, Navotas, Metro Manila",
      status: "Full",
      statusColor: "text-red-600",
      dotColor: "bg-red-600",
      currentCapacity: 250,
      totalCapacity: 255,
      capacityBgColor: "bg-red-50",
      capacityTextColor: "text-red-600",
      image: "src/images/building.png",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Evacuation Centers
        </h1>
        <div className="mb-8">
          <button className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
            + Add New Evacuation
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {evacuationCenters.map((center) => (
          <div
            key={center.id}
            className="bg-white rounded-xl border border-gray-400 hover:border-red-500 cursor-pointer hover:shadow-md transition-all p-4 relative"
          >
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings size={18} />
            </button>

            <div className="flex items-start gap-4 pr-8">
              {/* Image */}
              <div className="w-20 h-20 bg-gray-200 rounded-lg shrink-0 overflow-hidden">
                {center.image ? (
                  <img
                    src={center.image}
                    alt={center.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {center.name}
                </h3>
                <p className="text-gray-600 text-sm mb-2">{center.address}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${center.dotColor}`}
                    />
                    <span
                      className={`text-sm font-medium ${center.statusColor}`}
                    >
                      {center.status}
                    </span>
                  </div>
                  <div
                    className={`${center.capacityBgColor} ${center.capacityTextColor} px-2 py-1 rounded-lg font-semibold text-xs`}
                  >
                    {center.currentCapacity}/{center.totalCapacity}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
