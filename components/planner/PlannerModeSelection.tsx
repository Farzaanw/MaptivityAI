import React from 'react';

interface PlannerModeSelectionProps {
  onNavigate: (path: '/planner/generate' | '/planner/manual') => void;
}

const cardBaseClass =
  'group relative overflow-hidden rounded-[34px] border border-white/60 bg-white/80 p-8 text-left shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_36px_110px_rgba(15,23,42,0.18)] focus:outline-none focus:ring-4 focus:ring-sky-200';

const PlannerModeSelection: React.FC<PlannerModeSelectionProps> = ({ onNavigate }) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#e2f0ff_52%,#f8fafc_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="rounded-[38px] border border-white/60 bg-white/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-white">
            Planner
          </div>
          <h2 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Choose how you want to build your next itinerary.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Start with AI-generated ideas or build the whole trip yourself using live activities
            from Google Places around a real destination.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => onNavigate('/planner/generate')}
            className={`${cardBaseClass} bg-[linear-gradient(160deg,rgba(14,165,233,0.16),rgba(255,255,255,0.92),rgba(59,130,246,0.12))]`}
          >
            <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-sky-200/50 blur-3xl transition duration-300 group-hover:scale-110" />
            <div className="relative">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364 6.364-2.121-2.121M8.757 8.757 6.636 6.636m11.728 0-2.121 2.121M8.757 15.243l-2.121 2.121" />
                </svg>
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-sky-700">AI Planning</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Generate Plan</h3>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                Let AI create a personalized itinerary from your prompt, then review polished
                plan options and map the stops you like.
              </p>
              <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-bold text-slate-900">
                Open AI planner
                <span className="text-sky-600 transition-transform duration-300 group-hover:translate-x-1">→</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/planner/manual')}
            className={`${cardBaseClass} bg-[linear-gradient(160deg,rgba(34,197,94,0.16),rgba(255,255,255,0.92),rgba(251,191,36,0.12))]`}
          >
            <div className="absolute bottom-0 left-0 h-44 w-44 -translate-x-10 translate-y-10 rounded-full bg-emerald-200/50 blur-3xl transition duration-300 group-hover:scale-110" />
            <div className="relative">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z" />
                </svg>
              </div>
              <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Manual Planning</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Build Your Own</h3>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                Create your own plan by selecting activities. Search a destination, pull in real
                places from Google Maps, and drag them into your itinerary.
              </p>
              <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/85 px-5 py-3 text-sm font-bold text-slate-900">
                Start building
                <span className="text-emerald-600 transition-transform duration-300 group-hover:translate-x-1">→</span>
              </div>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
};

export default PlannerModeSelection;
