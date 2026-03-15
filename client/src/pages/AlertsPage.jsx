import { useState } from "react";

function AlertTile({ title, description, timestamp }) {
  return (
    <div className="bg-white p-4 rounded-xl border-l-4 hover:border-red-500 border-gray-400 hover:shadow-md transition-all">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-2">{description}</p>
      <p className="text-xs text-gray-400">{timestamp}</p>
    </div>
  );
}

export default function AlertsPage() {
  const alerts = [
    {
      id: 1,
      title: "NDRRMC",
      description:
        "Orange Rainfall Warning sa Navotas. Nagbabanta ang malinding pag-ulan, pagigiha at paggulo ng lupa.",
      timestamp: "2026-01-17 14:30:00",
    },
    {
      id: 2,
      title: "NDRRMC",
      description:
        "Orange Rainfall Warning sa Navotas. Nagbabanta ang malinding pag-ulan, pagigiha at paggulo ng lupa.",
      timestamp: "2026-01-17 14:30:00",
    },
    {
      id: 3,
      title: "NDRRMC",
      description:
        "Orange Rainfall Warning sa Navotas. Nagbabanta ang malinding pag-ulan, pagigiha at paggulo ng lupa.",
      timestamp: "2026-01-17 14:30:00",
    },
    {
      id: 4,
      title: "NDRRMC",
      description:
        "Orange Rainfall Warning sa Navotas. Nagbabanta ang malinding pag-ulan, pagigiha at paggulo ng lupa.",
      timestamp: "2026-01-17 14:30:00",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
        <button className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
          <span>+</span>
          <span>Create Alert</span>
        </button>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <AlertTile
            key={alert.id}
            title={alert.title}
            description={alert.description}
            timestamp={alert.timestamp}
          />
        ))}
      </div>
    </div>
  );
}
