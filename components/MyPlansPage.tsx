import React, { useState, useMemo, useEffect } from 'react';
import type { SavedPlannerPlan, MarkerData, MappedActivity } from '../types/planner';
import PlannerMap from './planner/PlannerMap';
import { buildMarkerData } from '../services/plannerGeocoding';

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

const SavedPlanCard: React.FC<{ plan: SavedPlannerPlan, onClick: () => void }> = ({ plan, onClick }) => {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <article
      onClick={onClick}
      className="group relative flex flex-col cursor-pointer rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition-all duration-300 hover:border-sky-300 hover:bg-white hover:shadow-[0_24px_80px_rgba(14,165,233,0.12)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${plan.kind === 'generated'
            ? 'bg-sky-100 text-sky-700'
            : 'bg-emerald-100 text-emerald-700'
          }`}>
          {plan.kind === 'generated' ? 'Generated Plan' : 'Build Your Own'}
        </div>
        <span className="text-xs font-semibold text-slate-400">{formatSavedDate(plan.createdAt)}</span>
      </div>

      <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900 group-hover:text-sky-900 transition-colors line-clamp-1">{plan.title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600 line-clamp-2">{plan.subtitle}</p>

      {plan.kind === 'generated' && (
        <div className="mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-sky-600"
          >
            <svg viewBox="0 0 24 24" className={`h-3 w-3 fill-current transition-transform duration-300 ${showPrompt ? 'rotate-180' : ''}`}>
              <path d="m12 15.4-6-6L7.4 8l4.6 4.6L16.6 8 18 9.4l-6 6Z" />
            </svg>
            {showPrompt ? 'Hide Prompt' : 'View Your Prompt'}
          </button>

          {showPrompt && (
            <div className="mt-3 rounded-2xl bg-slate-50 p-4 border border-slate-100 animate-in slide-in-from-top-2 duration-300">
              <p className="text-xs italic leading-relaxed text-slate-600">"{plan.prompt}"</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5 mt-8">
        <div className="flex gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {plan.days} day{plan.days === 1 ? '' : 's'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {plan.activityCount} stop{plan.activityCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-sky-600 group-hover:translate-x-1 transition-transform">
          View Detail &rarr;
        </div>
      </div>
    </article>
  );
};

const MyPlansPage: React.FC<MyPlansPageProps> = ({ plans }) => {
  const [selectedPlan, setSelectedPlan] = useState<SavedPlannerPlan | null>(null);
  const [geocodedMarkers, setGeocodedMarkers] = useState<MarkerData[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPlan) {
      setGeocodedMarkers([]);
      setSelectedActivityId(null);
      return;
    }

    if (selectedPlan.kind === 'manual') {
      let orderCount = 1;
      const markers: MarkerData[] = selectedPlan.plan.days.flatMap((day) =>
        day.activities.map((act) => ({
          ...act,
          order: orderCount++,
          dayNumber: day.day,
          time: '',
          location: act.address,
          description: '',
          geocodeStatus: 'resolved' as const,
          planId: selectedPlan.id,
          markerLabel: String(orderCount - 1),
          locationQuery: act.address,
        }))
      );
      setGeocodedMarkers(markers);
      setSelectedActivityId(markers[0]?.id ?? null);
    } else {
      const mappedActivities: MappedActivity[] = selectedPlan.plan.activities.map((activity) => ({
        ...activity,
        planId: selectedPlan.id,
        markerLabel: String(activity.order),
        locationQuery: activity.location,
      }));

      setIsGeocoding(true);
      setGeocodedMarkers(
        mappedActivities.map((activity) => ({
          ...activity,
          lat: null,
          lng: null,
          geocodeStatus: 'pending',
        }))
      );

      void buildMarkerData(mappedActivities)
        .then((markers) => {
          setGeocodedMarkers(markers);
          setSelectedActivityId(markers[0]?.id ?? null);
        })
        .finally(() => setIsGeocoding(false));
    }
  }, [selectedPlan]);

  const itineraryData = useMemo(() => {
    if (!selectedPlan) return [];
    if (selectedPlan.kind === 'generated') return selectedPlan.plan.dayPlans;

    // For manual plans, convert to same dayPlans structure
    return selectedPlan.plan.days.map(day => ({
      dayNumber: day.day,
      activities: day.activities.map((act, idx) => ({
        id: act.id,
        order: idx + 1, // This per-day order is different from total order
        dayNumber: day.day,
        name: act.name,
        time: '',
        location: act.address,
        description: '',
      }))
    }));
  }, [selectedPlan]);

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
          <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm border border-slate-200">
            {plans.length} saved plan{plans.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <SavedPlanCard key={plan.id} plan={plan} onClick={() => setSelectedPlan(plan)} />
          ))}
        </div>
      </div>

      {/* Plan Detail Overlay */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-8">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setSelectedPlan(null)}
          />

          <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[40px] border border-white/20 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6 backdrop-blur">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${selectedPlan.kind === 'generated' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                    {selectedPlan.kind === 'generated' ? 'Generated' : 'Manual'}
                  </span>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{selectedPlan.title}</h2>
                </div>
                {selectedPlan.kind === 'generated' && (
                  <p className="mt-2 text-sm italic text-slate-500 leading-relaxed max-w-3xl">
                    <span className="font-bold uppercase text-[10px] tracking-widest text-slate-400 not-italic mr-2">Your Prompt:</span>
                    "{selectedPlan.prompt}"
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="ml-6 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-900 hover:rotate-90 duration-300"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 stroke-current stroke-2 fill-none">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden grid lg:grid-cols-[1fr_420px] min-h-0">
              <div className="relative h-full p-6 lg:p-8 bg-slate-50 min-h-0">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-md font-bold uppercase tracking-[0.2em] text-sky-600">Map View</p>
                    {isGeocoding && (
                      <span className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
                        <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                        Re-geocoding stops...
                      </span>
                    )}
                  </div>
                  <PlannerMap
                    markers={geocodedMarkers}
                    hoveredActivityId={hoveredActivityId}
                    selectedActivityId={selectedActivityId}
                    onMarkerHoverChange={setHoveredActivityId}
                    onMarkerClick={setSelectedActivityId}
                  />
                </div>
              </div>

              {/* Sidebar Wrapper */}
              <div className="flex flex-col p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-0">
                <aside className="flex-1 flex flex-col bg-slate-950 rounded-[32px] border border-slate-200/10 p-6 text-slate-100 min-h-0 overflow-hidden shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
                  <div className="mb-5 flex items-center justify-between flex-shrink-0">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.1em] text-sky-300">Captured Itinerary</p>
                    </div>
                    <div className="mt-0 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                      {selectedPlan.days} days
                    </div>
                  </div>

                  <div className="space-y-5 flex flex-col min-h-0">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex-shrink-0">
                      <p className="text-xl font-bold leading-7 text-slate-200">{selectedPlan.title}</p>
                      {/* <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-sky-200">
                        <span>{selectedPlan.activityCount} total stops</span>
                        <span>Saved Plan</span>
                      </div> */}
                      <p className="mt-4 text-sm leading-6 text-slate-400 italic">
                        {selectedPlan.subtitle}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pr-2 scrollbar-refined min-h-0">
                      <div className="space-y-4">
                        {itineraryData.map((dayPlan) => (
                          <div key={`day-${dayPlan.dayNumber}`} className="space-y-3">
                            <div className="sticky top-0 z-10 rounded-xl bg-slate-900/95 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-green-300 backdrop-blur">
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
                                  onMouseLeave={() => setHoveredActivityId((current) => current === activity.id ? null : current)}
                                  onFocus={() => setHoveredActivityId(activity.id)}
                                  onBlur={() => setHoveredActivityId((current) => current === activity.id ? null : current)}
                                  onClick={() => setSelectedActivityId(activity.id)}
                                  className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${isSelected
                                      ? 'border-sky-400 bg-sky-500/15 shadow-[0_10px_30px_rgba(14,165,233,0.18)] scale-[1.02]'
                                      : isHovered
                                        ? 'border-white/20 bg-white/10'
                                        : 'border-white/10 bg-white/5'
                                    }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black ${isSelected || isHovered ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-white'
                                      }`}>
                                      {activity.order}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-white">{activity.name}</p>
                                      {activity.time && (
                                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">{activity.time}</p>
                                      )}
                                      <p className="mt-3 text-sm text-slate-300 line-clamp-1">{activity.location}</p>
                                      {activity.description && (
                                        <p className="mt-2 text-sm leading-6 text-slate-400 line-clamp-2">{activity.description}</p>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlansPage;
