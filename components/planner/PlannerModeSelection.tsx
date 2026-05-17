import React from 'react';

interface PlannerModeSelectionProps {
  onNavigate: (path: '/planner/generate' | '/planner/manual') => void;
}

const cardBaseClass =
  'group relative overflow-hidden rounded-[34px] border border-white/60 bg-white/80 p-8 text-left shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur transition-all duration-500 animate-float hover:animate-none hover:scale-[1.03] hover:-translate-y-2 hover:shadow-[0_40px_120px_rgba(15,23,42,0.2)] focus:outline-none focus:ring-4 focus:ring-sky-200';

const topBannerClass =
  'group relative overflow-hidden rounded-[34px] border border-white/60 bg-white/75 p-8 text-left shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur transition-all duration-500';

const PlannerModeSelection: React.FC<PlannerModeSelectionProps> = ({ onNavigate }) => {
  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-50">
      {/* Moving Background Glow Concept */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-sky-400/20 to-purple-400/20 animate-flowy-gradient bg-[length:200%_200%]"
        />
      </div>

      <div className="relative z-10 h-full overflow-y-auto px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <section className={topBannerClass}>
            <div className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg">
              Planner
            </div>
            <h2 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Plan Your Next Trip!
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Traveling somewhere new? Plan your full trip iternary with either our AI-powered trip planner
              or our manual planner, where you can organize, customize, and map out your perfect trip.
            </p>
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <button
              type="button"
              onClick={() => onNavigate('/planner/generate')}
              className={`${cardBaseClass} bg-[linear-gradient(160deg,rgba(14,165,233,0.12),rgba(255,255,255,0.95),rgba(59,130,246,0.08))]`}
              style={{ animationDelay: '0.2s' }}
            >
              <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-sky-200/50 blur-3xl transition duration-300 group-hover:scale-125" />
              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364 6.364-2.121-2.121M8.757 8.757 6.636 6.636m11.728 0-2.121 2.121M8.757 15.243l-2.121 2.121" />
                  </svg>
                </div>
                <h3 className="mt-5 text-3xl font-black tracking-tight text-slate-950">Generate Plan</h3>
                <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                  Let AI create a personalized itinerary based on your preferences,
                  then review the plan to polish it to your liking.
                </p>
                <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all duration-300 group-hover:bg-sky-600 group-hover:shadow-sky-100">
                  Start Generating
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/planner/manual')}
              className={`${cardBaseClass} bg-[linear-gradient(160deg,rgba(34,197,94,0.12),rgba(255,255,255,0.95),rgba(251,191,36,0.08))]`}
              style={{ animationDelay: '0.4s' }}
            >
              <div className="absolute bottom-0 left-0 h-44 w-44 -translate-x-10 translate-y-10 rounded-full bg-emerald-200/50 blur-3xl transition duration-300 group-hover:scale-125" />
              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-3xl font-black tracking-tight text-slate-950">Build Your Own</h3>
                <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
                  Create your own plan by selecting activities using drag-and-drop to manually organize your plan.
                </p>
                <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all duration-300 group-hover:bg-emerald-600 group-hover:shadow-emerald-100">
                  Start Building
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
              </div>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlannerModeSelection;
