import { Link } from "react-router-dom";
import {
  ChevronRight,
  BriefcaseMedical,
  Stone,
  Flame,
  Waves,
  Mountain,
  Wind,
} from "lucide-react";
import { SAFETY_TIPS } from "../data/safetyTipsData";

const ICON_MAP = {
  BriefcaseMedical: <BriefcaseMedical size={20} />,
  Stone: <Stone size={20} />,
  Flame: <Flame size={20} />,
  Waves: <Waves size={20} />,
  Mountain: <Mountain size={20} />,
  Wind: <Wind size={20} />,
};

export default function SafetyTipsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">Safety Tips</h1>
      <p className="text-gray-400 text-sm mb-6">
        Step-by-step disaster preparedness and response guides.
      </p>

      <div className="space-y-3">
        {SAFETY_TIPS.map((tip) => {
          const totalSteps = Object.values(tip.phases).reduce(
            (sum, p) => sum + p.steps.length,
            0
          );
          return (
            <Link
              key={tip.slug}
              to={`/safety-tips/${tip.slug}`}
              className={`flex items-center gap-4 bg-white rounded-2xl border-l-4 ${tip.borderColor} px-4 py-3.5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group`}
            >
              <div
                className={`${tip.iconBgColor} ${tip.iconColor} w-11 h-11 rounded-xl flex items-center justify-center shrink-0`}
              >
                {ICON_MAP[tip.iconName]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                  {tip.title}
                </h3>
                <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">
                  {tip.description}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-gray-400 text-xs">{totalSteps} steps</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full" />
                  <span className="text-gray-400 text-xs">
                    Before · During · After
                  </span>
                </div>
              </div>
              <ChevronRight
                size={16}
                className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
