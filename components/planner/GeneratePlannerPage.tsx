import React, { useEffect, useMemo, useState } from 'react';
import PlannerMap from './PlannerMap';
import { buildMarkerData } from '../../services/plannerGeocoding';
import { generateItinerary } from '../../services/plannerService';
import type { GeneratedPlan, MappedActivity, MarkerData, ReservationDraft } from '../../types/planner';

const starterPrompt =
  'Plan a relaxed 3-day Seattle trip for two with coffee shops, waterfront walks, a museum, and one memorable dinner.';

interface GeneratePlannerPageProps {
  onNavigate: (path: '/planner' | '/planner/generate' | '/planner/manual' | '/planner/reserve') => void;
  onPrepareReservationDraft: (draft: ReservationDraft) => void;
}

function buildGeneratedReservationDraft(plan: GeneratedPlan): ReservationDraft {
  return {
    id: `reserve-${plan.id}`,
    title: `Reserve ${plan.title}`,
    subtitle: 'These itinerary stops are lined up for future AI-agent booking support once reservations are implemented.',
    source: 'generated',
    candidates: plan.dayPlans.flatMap((dayPlan) =>
      dayPlan.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        dayLabel: `Day ${dayPlan.dayNumber}`,
        timeLabel: activity.time,
        address: activity.location,
        notes: activity.description,
        reservationHint: 'Review for tickets, tables, or timed-entry holds',
        source: 'generated' as const,
      })),
    ),
  };
}

const GeneratePlannerPage: React.FC<GeneratePlannerPageProps> = ({ onNavigate, onPrepareReservationDraft }) => {
  const [tripDescription, setTripDescription] = useState(starterPrompt);
  const [plans, setPlans] = useState<GeneratedPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [mappedPlanId, setMappedPlanId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const [geocodedMarkers, setGeocodedMarkers] = useState<MarkerData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const mappedPlan = useMemo(
    () => plans.find((plan) => plan.id === mappedPlanId) ?? null,
    [mappedPlanId, plans],
  );

  const mappedActivities = useMemo<MappedActivity[]>(
    () =>
      (mappedPlan?.activities ?? []).map((activity) => ({
        ...activity,
        planId: mappedPlan.id,
        markerLabel: String(activity.order),
        locationQuery: activity.location,
      })),
    [mappedPlan],
  );

  const selectedActivity = useMemo(
    () => selectedPlan?.activities.find((activity) => activity.id === selectedActivityId) ?? null,
    [selectedActivityId, selectedPlan],
  );

  useEffect(() => {
    if (!mappedActivities.length) {
      setGeocodedMarkers([]);
      setIsGeocoding(false);
      return;
    }

    let cancelled = false;
    setIsGeocoding(true);
    setGeocodedMarkers(
      mappedActivities.map((activity) => ({
        ...activity,
        lat: null,
        lng: null,
        geocodeStatus: 'pending',
      })),
    );

    void buildMarkerData(mappedActivities)
      .then((markers) => {
        if (cancelled) return;
        setGeocodedMarkers(markers);
      })
      .catch(() => {
        if (cancelled) return;
        setGeocodedMarkers(
          mappedActivities.map((activity) => ({
            ...activity,
            lat: null,
            lng: null,
            geocodeStatus: 'failed',
          })),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeocoding(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mappedActivities]);

  const unresolvedMarkerCount = useMemo(
    () => geocodedMarkers.filter((marker) => marker.geocodeStatus === 'failed').length,
    [geocodedMarkers],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedPrompt = tripDescription.trim();
    if (!trimmedPrompt) {
      setError('Please describe the kind of trip you want first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedPlans = await generateItinerary(trimmedPrompt);
      const firstPlan = generatedPlans[0] ?? null;
      const firstActivity = firstPlan?.activities[0] ?? null;

      setPlans(generatedPlans);
      setSelectedPlanId(firstPlan?.id ?? null);
      setMappedPlanId(firstPlan?.id ?? null);
      setSelectedActivityId(firstActivity?.id ?? null);
      setHoveredActivityId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate travel plans.');
      setPlans([]);
      setSelectedPlanId(null);
      setMappedPlanId(null);
      setSelectedActivityId(null);
      setGeocodedMarkers([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectPlan = (plan: GeneratedPlan) => {
    setSelectedPlanId(plan.id);
    setSelectedActivityId(plan.activities[0]?.id ?? null);
  };

  const handleSendToMap = (plan: GeneratedPlan) => {
    setMappedPlanId(plan.id);
    setSelectedPlanId(plan.id);
    setSelectedActivityId(plan.activities[0]?.id ?? null);
  };

  const handleReservePlan = () => {
    if (!selectedPlan) return;
    onPrepareReservationDraft(buildGeneratedReservationDraft(selectedPlan));
    onNavigate('/planner/reserve');
  };

  const handleSelectMappedActivity = (activityId: string) => {
    if (mappedPlanId) {
      setSelectedPlanId(mappedPlanId);
    }
    setSelectedActivityId(activityId);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.55),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_50%,#f8fafc_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="rounded-[36px] border border-sky-100 bg-white/85 p-8 shadow-[0_24px_80px_rgba(14,116,144,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center rounded-full bg-sky-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              Generate Plan
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/planner')}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Back to Planner Modes
            </button>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div>
              <h2 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900">
                Generate three polished travel plans, then send one straight to the map.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Describe the kind of trip you want and your local LLaMA model will return
                three structured options. Pick a plan, review the itinerary by day, and map
                its activities as numbered stops.
              </p>
            </div>

            <div className="rounded-[28px] border border-sky-100 bg-sky-50/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Planner flow</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>1. Generate 3 plan options from your prompt</p>
                <p>2. Select the strongest itinerary</p>
                <p>3. Send that itinerary to the map as numbered stops</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
                Ideal Trip Description
              </span>
              <textarea
                value={tripDescription}
                onChange={(event) => setTripDescription(event.target.value)}
                placeholder="Example: Plan a cozy anniversary weekend in Portland with bookstores, good food, and a scenic walk."
                className="min-h-[210px] w-full rounded-[26px] border border-slate-200 bg-white px-5 py-4 text-base leading-7 text-slate-800 shadow-inner outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGenerating ? 'Generating 3 Plans...' : 'Generate 3 Plans'}
              </button>

              <p className="text-sm text-slate-500">
                Structured itinerary options come back from your local Ollama `llama3` model.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={handleReservePlan}
                disabled={!selectedPlan}
                className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-200"
              >
                Reserve Plan
              </button>
              <p className="self-center text-sm text-slate-500">
                Open a future booking queue for the currently selected itinerary.
              </p>
            </div>
          </form>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Plan Options</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Choose a Direction</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {plans.length}/3 ready
            </div>
          </div>

          {isGenerating ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 h-6 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : plans.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan, index) => {
                const isSelected = plan.id === selectedPlanId;
                const isMapped = plan.id === mappedPlanId;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-[26px] border p-5 transition ${
                      isSelected
                        ? 'border-sky-400 bg-sky-50 shadow-[0_12px_36px_rgba(14,165,233,0.16)]'
                        : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        Option {index + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{plan.days} days</span>
                    </div>

                    <h4 className="mt-4 text-xl font-black tracking-tight text-slate-900">
                      {plan.title}
                    </h4>

                    <p className="mt-3 text-sm leading-6 text-slate-600">{plan.summary}</p>

                    <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                      <span>{plan.activities.length} activities</span>
                      <span>{isMapped ? 'Mapped now' : 'Ready to map'}</span>
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'View Itinerary'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendToMap(plan)}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
                          isMapped
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sky-600 text-white hover:bg-sky-700'
                        }`}
                      >
                        {isMapped ? 'On Map' : 'Send to Map'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm leading-7 text-slate-500">
              Submit a trip description to generate three polished travel plan options.
            </div>
          )}
        </section>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Map View</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  {mappedPlan ? `${mappedPlan.title} on the map` : 'Map your selected itinerary'}
                </h3>
              </div>
              <div className="flex gap-2">
                {isGeocoding && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    Geocoding stops...
                  </span>
                )}
                {unresolvedMarkerCount > 0 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {unresolvedMarkerCount} stop{unresolvedMarkerCount === 1 ? '' : 's'} need coordinates
                  </span>
                )}
              </div>
            </div>

            <PlannerMap
              markers={geocodedMarkers}
              hoveredActivityId={hoveredActivityId}
              selectedActivityId={selectedActivityId}
              onMarkerHoverChange={setHoveredActivityId}
              onMarkerClick={handleSelectMappedActivity}
            />
          </section>

          <aside className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Selected Itinerary</p>
                <h3 className="mt-2 text-2xl font-black">
                  {selectedPlan ? selectedPlan.title : 'No plan selected'}
                </h3>
              </div>
              <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                {selectedPlan ? `${selectedPlan.days} days` : 'Awaiting plan'}
              </div>
            </div>

            {selectedPlan ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm leading-6 text-slate-200">{selectedPlan.summary}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-sky-200">
                    <span>{selectedPlan.activities.length} total stops</span>
                    <span>{mappedPlanId === selectedPlan.id ? 'Currently mapped' : 'Not mapped yet'}</span>
                  </div>
                </div>

                <div className="max-h-[540px] space-y-4 overflow-y-auto pr-1">
                  {selectedPlan.dayPlans.map((dayPlan) => (
                    <div key={`${selectedPlan.id}-day-${dayPlan.dayNumber}`} className="space-y-3">
                      <div className="sticky top-0 rounded-xl bg-slate-900/95 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-300 backdrop-blur">
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
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? 'border-sky-400 bg-sky-500/15 shadow-[0_10px_30px_rgba(14,165,233,0.18)]'
                                : isHovered
                                  ? 'border-sky-300 bg-white/10'
                                  : 'border-white/10 bg-white/5'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                                  isSelected || isHovered
                                    ? 'bg-sky-400 text-slate-950'
                                    : 'bg-white/10 text-white'
                                }`}
                              >
                                {activity.order}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{activity.name}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                                  {activity.time}
                                </p>
                              </div>
                            </div>

                            <p className="mt-3 text-sm text-slate-300">{activity.location}</p>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                              {activity.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {selectedActivity && (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                      Activity Details
                    </p>
                    <div className="mt-3 space-y-2">
                      <p className="text-base font-bold text-white">
                        {selectedActivity.order}. {selectedActivity.name}
                      </p>
                      <p className="text-sm text-emerald-50">Day {selectedActivity.dayNumber}</p>
                      <p className="text-sm text-emerald-50">{selectedActivity.time}</p>
                      <p className="text-sm text-emerald-50">{selectedActivity.location}</p>
                      <p className="pt-2 text-sm leading-6 text-emerald-50/90">
                        {selectedActivity.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm leading-7 text-slate-300">
                Select one of the generated plans to inspect the full itinerary and send it to the map.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default GeneratePlannerPage;
