import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  List,
  BriefcaseMedical,
  Stone,
  Flame,
  Waves,
  Mountain,
  Wind,
} from "lucide-react";
import { SAFETY_TIPS } from "../data/safetyTipsData";

const ICON_MAP = { BriefcaseMedical, Stone, Flame, Waves, Mountain, Wind };

const PHASE_CONFIG = {
  before: {
    label: "Before",
    Icon: Clock,
    sectionBg: "bg-amber-50",
    sectionBorder: "border-amber-200",
    iconBg: "bg-amber-400",
    badgeBg: "bg-amber-400",
    labelBg: "bg-amber-400",
    dot: "bg-amber-400",
  },
  during: {
    label: "During",
    Icon: AlertTriangle,
    sectionBg: "bg-red-50",
    sectionBorder: "border-red-200",
    iconBg: "bg-red-500",
    badgeBg: "bg-red-500",
    labelBg: "bg-red-500",
    dot: "bg-red-500",
  },
  after: {
    label: "After",
    Icon: CheckCircle2,
    sectionBg: "bg-emerald-50",
    sectionBorder: "border-emerald-200",
    iconBg: "bg-emerald-500",
    badgeBg: "bg-emerald-500",
    labelBg: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
};

function PhaseCard({ phase, phaseData }) {
  const cfg = PHASE_CONFIG[phase];
  const PhaseIcon = cfg.Icon;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 ${cfg.sectionBg} border-b ${cfg.sectionBorder}`}
      >
        <div className={`${cfg.iconBg} p-1.5 rounded-lg`}>
          <PhaseIcon size={13} className="text-white" />
        </div>
        <span className="font-semibold text-gray-800 text-sm">{cfg.label}</span>
        {phaseData.label && (
          <span className="text-gray-400 text-xs">— {phaseData.label}</span>
        )}
      </div>
      <div className="p-4">
        <ol className="space-y-3">
          {phaseData.steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <div
                className={`w-5 h-5 rounded-full ${cfg.badgeBg} text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5`}
              >
                {i + 1}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function SafetyTipDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const tip = SAFETY_TIPS.find((t) => t.slug === slug);

  if (!tip) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Safety tip not found.</p>
        <button
          onClick={() => navigate("/safety-tips")}
          className="text-blue-500 hover:underline text-sm"
        >
          Back to Safety Tips
        </button>
      </div>
    );
  }

  const Icon = ICON_MAP[tip.iconName];
  const totalSteps = Object.values(tip.phases).reduce(
    (sum, p) => sum + p.steps.length,
    0
  );

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Back */}
      <button
        onClick={() => navigate("/safety-tips")}
        className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 mb-4 transition-colors text-sm"
      >
        <ArrowLeft size={15} />
        Back to Safety Tips
      </button>

      {/* Hero */}
      <div
        className={`${tip.headerBg} rounded-2xl p-5 text-white mb-5 relative overflow-hidden`}
      >
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute right-4 bottom-0 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="bg-white/20 rounded-xl p-3.5 shrink-0">
            {Icon && <Icon size={28} />}
          </div>
          <div>
            <h1 className="text-xl font-bold leading-snug">{tip.title}</h1>
            <p className="text-white/75 text-xs mt-1 leading-relaxed">
              {tip.description}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-1">
              <List size={11} />
              <span className="text-xs font-medium">
                {totalSteps} steps across 3 phases
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase cards */}
      <div className="space-y-3 mb-5">
        {["before", "during", "after"].map((phase) => (
          <PhaseCard key={phase} phase={phase} phaseData={tip.phases[phase]} />
        ))}
      </div>

      {/* Officials */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 mb-6">
        <div className="bg-slate-800 px-4 py-3.5 flex items-center gap-2.5">
          <div className="bg-slate-600 p-1.5 rounded-lg">
            <Building2 size={13} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm">
            For CDRRMO &amp; Barangay Officials
          </span>
          <span className="ml-auto bg-slate-700 text-slate-300 text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
            Official Duties
          </span>
        </div>
        <div className="bg-white divide-y divide-gray-100">
          {["before", "during", "after"].map((phase) => {
            const cfg = PHASE_CONFIG[phase];
            return (
              <div key={phase} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`${cfg.labelBg} text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <ol className="space-y-2.5">
                  {tip.officialDuties[phase].map((duty, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {duty}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sources */}
      {tip.sources?.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2.5">
            Sources &amp; References
          </p>
          <div className="flex flex-col gap-1.5">
            {tip.sources.map((src, i) => (
              <p key={i} className="text-xs text-gray-400 leading-relaxed">
                {src}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
