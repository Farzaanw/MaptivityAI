import React from 'react';
import type { GeneratedPlan, GeneratedActivity } from '../../types/planner';

interface SelectedItinerarySidebarProps {
  selectedPlan: GeneratedPlan | null;
  mappedPlanId: string | null;
  hoveredActivityId: string | null;
  selectedActivityId: string | null;
  setHoveredActivityId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedActivityId: React.Dispatch<React.SetStateAction<string | null>>;
  onSavePlan: () => void;
}

const SelectedItinerarySidebar: React.FC<SelectedItinerarySidebarProps> = ({
  selectedPlan,
  mappedPlanId,
  hoveredActivityId,
  selectedActivityId,
  setHoveredActivityId,
  setSelectedActivityId,
  onSavePlan,
}) => {
  return (
    <aside className="relative flex flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white/50 backdrop-blur shadow-sm transition-all xs:rounded-[36px]">
      <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 lg:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-base font-bold uppercase tracking-wider text-slate-500">
              Selected Itinerary
            </p>
          </div>
          <div className="rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
            {selectedPlan ? `${selectedPlan.days} days` : 'Awaiting plan'}
          </div>
        </div>

        {selectedPlan ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-3xl font-bold leading-tight text-slate-900">{selectedPlan.title}</p>
              <div className="mt-4 flex items-center gap-4 text-base uppercase tracking-wider text-slate-500 font-semibold">
                <span>{selectedPlan.activities.length} total stops</span>
                <span>{mappedPlanId === selectedPlan.id ? 'Currently mapped' : 'Not mapped yet'}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={onSavePlan}
                  className="rounded-full bg-sky-500 px-8 py-4 text-base font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-sky-400"
                >
                  Save to My Plans
                </button>
              </div>
            </div>

            <div className="max-h-[540px] space-y-5 overflow-y-auto pr-3 scrollbar-refined">
              {selectedPlan.dayPlans.map((dayPlan) => (
                <div key={`${selectedPlan.id}-day-${dayPlan.dayNumber}`} className="space-y-4">
                  <div className="sticky top-0 z-10 rounded-xl bg-slate-50/95 px-4 py-3 text-base font-bold uppercase tracking-wider text-emerald-600 backdrop-blur shadow-sm">
                    Day {dayPlan.dayNumber}
                  </div>

                  {dayPlan.activities.map((activity) => {
                    const isHovered = hoveredActivityId === activity.id;
                    const isSelected = selectedActivityId === activity.id;

                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onMouseEnter={() => setHoveredActivityId(activity.id)}
                        onMouseLeave={() =>
                          setHoveredActivityId((current) => (current === activity.id ? null : current))
                        }
                        onFocus={() => setHoveredActivityId(activity.id)}
                        onBlur={() =>
                          setHoveredActivityId((current) => (current === activity.id ? null : current))
                        }
                        onClick={() => setSelectedActivityId(activity.id)}
                        className={`w-full rounded-2xl border p-5 text-left transition ${
                          isSelected
                            ? 'border-sky-300 bg-sky-50 shadow-md'
                            : isHovered
                            ? 'border-sky-200 bg-white shadow-sm'
                            : 'border-slate-100 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                              isSelected || isHovered
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {activity.order}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-900">{activity.name}</p>
                            <p className="mt-1 text-base font-semibold uppercase tracking-wider text-sky-600">
                              {activity.time}
                            </p>
                          </div>
                        </div>

                        <p className="mt-4 text-lg text-slate-700 font-medium">{activity.location}</p>
                        <p className="mt-3 line-clamp-3 text-base leading-relaxed text-slate-500">
                          {activity.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center p-6">
            <div>
              <p className="text-xl font-bold text-slate-400">No itinary selected</p>
              <p className="mt-3 text-base text-slate-500 max-w-[250px] mx-auto">
                Generate and pick one of the plans above to see the daily breakdown.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default SelectedItinerarySidebar;
