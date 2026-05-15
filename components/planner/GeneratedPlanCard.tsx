import React from 'react';
import type { GeneratedPlan } from '../../types/planner';

interface GeneratedPlanCardProps {
  plan: GeneratedPlan;
  index: number;
  isSelected?: boolean; // Kept for logic if needed
  isMapped: boolean;
  onClick: (plan: GeneratedPlan) => void;
}

const GeneratedPlanCard: React.FC<GeneratedPlanCardProps> = ({ plan, index, isMapped, onClick }) => {
  return (
    <div
      onClick={() => onClick(plan)}
      className={`group cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${
        isMapped
          ? 'border-emerald-400 bg-emerald-50 shadow-[0_12px_36px_rgba(16,185,129,0.16)]'
          : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50 hover:shadow-lg'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
            isMapped ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Option {index + 1}
        </span>
        <span className="text-sm font-semibold text-slate-500">{plan.days} days</span>
      </div>

      <h4
        className={`mt-5 text-2xl font-bold tracking-tight transition ${
          isMapped ? 'text-emerald-900' : 'text-slate-900'
        }`}
      >
        {plan.title}
      </h4>

      <p className="mt-4 text-base leading-relaxed text-slate-600 font-medium">{plan.summary}</p>

      <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
        <span className="font-semibold">{plan.activities.length} activities</span>
        <span className={`font-bold ${isMapped ? 'text-emerald-600' : ''}`}>
          {isMapped ? 'Currently Mapped' : 'Ready to map'}
        </span>
      </div>

      <div className="mt-6">
        <button
          type="button"
          className={`w-full rounded-full px-5 py-4 text-base font-bold transition-all duration-300 pointer-events-none ${
            isMapped
              ? 'bg-emerald-200 text-emerald-800'
              : 'bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700'
          }`}
        >
          {isMapped ? 'Mapped' : 'Send to Map'}
        </button>
      </div>
    </div>
  );
};

export default GeneratedPlanCard;
