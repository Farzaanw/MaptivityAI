import React from 'react';
import type { SavedPlannerPlan } from '../types/planner';

interface MyPlansPageProps {
  plans: SavedPlannerPlan[];
}

function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Saved recently';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const MyPlansPage: React.FC<MyPlansPageProps> = ({ plans }) => {
  if (plans.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.18),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-sky-500 to-emerald-400 shadow-[0_18px_40px_rgba(14,165,233,0.25)]">
          <svg viewBox="0 0 24 24" className="h-10 w-10 fill-white" aria-hidden="true">
            <path d="M7 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9.41a3 3 0 0 0-.88-2.12l-2.41-2.41A3 3 0 0 0 14.59 4H7Zm1 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z" />
          </svg>
        </div>
        <h2 className="mt-8 text-3xl font-black tracking-tight text-slate-900">My Plans</h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-500">
          Save finished generated itineraries or custom manual builds here so you can revisit them later.
        </p>
        <div className="mt-6 rounded-full bg-sky-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-sky-700">
          No saved plans yet
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.2),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(110,231,183,0.16),_transparent_26%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Saved Planner Library</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">My Plans</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Keep polished AI itineraries and manual trip builds in one place so they are easy to revisit.
            </p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
            {plans.length} saved plan{plans.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${
                  plan.kind === 'generated'
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {plan.kind === 'generated' ? 'Generated Plan' : 'Build Your Own'}
                </div>
                <span className="text-xs font-semibold text-slate-400">{formatSavedDate(plan.createdAt)}</span>
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">{plan.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{plan.subtitle}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {plan.days} day{plan.days === 1 ? '' : 's'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {plan.activityCount} stop{plan.activityCount === 1 ? '' : 's'}
                </span>
              </div>

              {plan.kind === 'generated' ? (
                <div className="mt-5 rounded-[22px] border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Prompt</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{plan.prompt}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Destination</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {plan.destination?.name ?? 'Custom manual plan'}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyPlansPage;
