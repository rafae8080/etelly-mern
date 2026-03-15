import {
  List,
  Settings,
  BriefcaseMedical,
  Stone,
  Flame,
  Waves,
} from "lucide-react";

export default function SafetyTipPage() {
  const safetyTips = [
    {
      id: 1,
      title: "Basic first aid for common emergencies",
      description: "Essential medical response procedures",
      steps: 10,
      icon: <BriefcaseMedical />,
      borderColor: "border-red-500",
      iconBgColor: "bg-red-100",
      iconColor: "text-red-500",
    },
    {
      id: 2,
      title: "Earthquake Safety",
      description: "Drop, cover, and hold procedures",
      steps: 10,
      icon: <Stone />,
      borderColor: "border-gray-600",
      iconBgColor: "bg-gray-100",
      iconColor: "text-gray-600",
    },
    {
      id: 3,
      title: "Fire Emergency Guide",
      description: "Prevention and response to fire hazards",
      steps: 10,
      icon: <Flame />,
      borderColor: "border-orange-500",
      iconBgColor: "bg-orange-100",
      iconColor: "text-orange-500",
    },
    {
      id: 4,
      title: "Flood Safety Guide",
      description: "Essential steps before, during, and after floods",
      steps: 10,
      icon: <Waves />,
      borderColor: "border-blue-500",
      iconBgColor: "bg-blue-100",
      iconColor: "text-blue-500",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Safety Tips</h1>
        <div className="mb-8">
          <button className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
            + Create Tips
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {safetyTips.map((tip) => (
          <div
            key={tip.id}
            className={`bg-white rounded-xl border-l-4 ${tip.borderColor} p-4 shadow-sm hover:shadow-md transition-shadow relative`}
          >
            <button className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings size={18} />
            </button>

            <div className="flex items-start gap-4">
              <div
                className={`${tip.iconBgColor} ${tip.iconColor} w-12 h-12 rounded-lg flex items-center justify-center shrink-0`}
              >
                {tip.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {tip.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3">{tip.description}</p>
                <div className="flex items-center gap-1 text-gray-500 text-sm">
                  <List size={18} />
                  <span>{tip.steps} steps</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
