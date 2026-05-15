import React, { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import Lottie from 'lottie-react';
import cyclistAnimation from '../../src/men run bycicle animation (1).json';
import PlannerMap from './PlannerMap';
import { buildMarkerData } from '../../services/plannerGeocoding';
import { generateItinerary } from '../../services/plannerService';
import type { GeneratedPlan, MappedActivity, MarkerData, ReservationDraft, SavedPlannerPlan } from '../../types/planner';
import { useVoiceToText } from '../../hooks/useVoiceToText';

import GeneratedPlanCard from './GeneratedPlanCard';
import SelectedItinerarySidebar from './SelectedItinerarySidebar';

// const starterPrompt =
//   'Plan a relaxed 3-day Seattle trip for two with coffee shops, waterfront walks, a museum, and one memorable dinner.';

interface GeneratePlannerPageProps {
  onNavigate: (path: '/planner' | '/planner/generate' | '/planner/manual' | '/planner/reserve') => void;
  onPrepareReservationDraft: (draft: ReservationDraft) => void;
  onSavePlan: (plan: SavedPlannerPlan) => void;
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

function buildSavedGeneratedPlan(plan: GeneratedPlan, prompt: string): SavedPlannerPlan {
  return {
    kind: 'generated',
    id: `saved-generated-${plan.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: plan.title,
    subtitle: plan.summary,
    prompt,
    days: plan.days,
    activityCount: plan.activities.length,
    plan,
  };
}

const GeneratePlannerPage: React.FC<GeneratePlannerPageProps> = ({ onNavigate, onPrepareReservationDraft, onSavePlan }) => {
  const {
    isRecording,
    micError,
    transcript: tripDescription,
    setTranscript: setTripDescription,
    toggleRecording: handleMicClick,
    supportsSpeechRecognition,
  } = useVoiceToText();

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
        planId: mappedPlan?.id ?? 'temp',
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

  const handleSavePlan = () => {
    if (!selectedPlan) return;
    onSavePlan(buildSavedGeneratedPlan(selectedPlan, tripDescription.trim()));
  };

  const handleSelectMappedActivity = (activityId: string) => {
    if (mappedPlanId) {
      setSelectedPlanId(mappedPlanId);
    }
    setSelectedActivityId(activityId);
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-slate-50">
      {/* Moving Background Glow Concept */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-sky-400/20 to-purple-400/20 animate-flowy-gradient bg-[length:200%_200%]"
        />
      </div>

      <div className="relative z-10 h-full overflow-y-auto px-4 py-6 sm:px-10 sm:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:gap-8">
          <section className="rounded-2xl sm:rounded-[36px] border border-sky-100 bg-white/85 p-6 sm:p-10 shadow-[0_24px_80px_rgba(14,116,144,0.12)] backdrop-blur transition-all duration-500 hover:animate-none">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center rounded-full bg-sky-100 px-5 py-3 text-sm sm:text-base font-bold uppercase tracking-wider text-sky-700 shadow-md">
                Generate Plan
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/planner')}
                className="rounded-full border-2 border-sky-200 bg-white px-5 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
              >
                Back to Planner Modes
              </button>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div>
                <h3 className="max-w-3xl text-3xl sm:text-5xl font-black tracking-tight text-slate-900">
                  Generate, Select, View, Plan
                </h3>
                <p className="mt-6 max-w-3xl text-base sm:text-md leading-8 text-slate-600 font-medium">
                  Describe the kind of trip your looking for and instantly get three thoughtfully crafted plans.
                  Pick one, view the recommended daily itinerary, and interact with the map to explore the stops.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-4">
              <label className="block">
                <span className="mb-4 block px-2 text-sm sm:text-base font-bold uppercase tracking-wider text-slate-500">
                  Describe your ideal trip
                </span>
                <div className="overflow-hidden rounded-2xl sm:rounded-[30px] border border-slate-200 bg-slate-50 shadow-sm transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
                  <textarea
                    value={tripDescription}
                    onChange={(event) => setTripDescription(event.target.value)}
                    className="min-h-[160px] sm:min-h-[210px] w-full resize-none border-0 bg-transparent px-5 sm:px-8 py-5 sm:py-6 text-lg sm:text-xl leading-relaxed text-slate-800 outline-none placeholder:italic placeholder:text-slate-400"
                    placeholder="Example: Plan a relaxed 3-day Seattle trip for two with coffee shops, waterfront walks, a museum, and one memorable dinner."
                  />

                  <div className="flex items-center justify-end px-4 sm:px-5 pb-4">
                    <div className="flex items-center gap-3">
                      {supportsSpeechRecognition && (
                        <button
                          type="button"
                          aria-label="Voice input"
                          onClick={handleMicClick}
                          className={`inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full transition hover:bg-slate-200 ${isRecording ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-white text-slate-400 hover:text-slate-600'}`}
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-4 sm:w-4 fill-current" aria-hidden="true">
                            <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="submit"
                        aria-label={isGenerating ? 'Generating plans' : 'Generate plans'}
                        disabled={isGenerating}
                        className="inline-flex h-12 w-12 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-sky-500 text-white shadow-md transition hover:scale-105 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isGenerating ? (
                          <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-4 sm:w-4 animate-spin fill-none stroke-current stroke-2" aria-hidden="true">
                            <path d="M12 3a9 9 0 1 0 9 9" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-4 sm:w-4 fill-current" aria-hidden="true">
                            <path d="M12 4a1 1 0 0 1 1 1v10.59l3.3-3.29a1 1 0 1 1 1.4 1.41l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.41L11 15.59V5a1 1 0 0 1 1-1Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </label>
            </form>

            {(error || micError) && (
              <div className="mt-5 rounded-xl sm:rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
                {micError && <div>{micError}</div>}
              </div>
            )}
          </section>

          <section className="rounded-2xl sm:rounded-[32px] border border-slate-200 bg-white/85 p-6 sm:p-8 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Plan Options</p>
                <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">Choose a Direction</h3>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
                {plans.length}/3 ready
              </div>
            </div>

            {isGenerating ? (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <Lottie
                  animationData={cyclistAnimation}
                  loop
                  autoplay
                  style={{ width: 320, height: 220 }}
                />
                <p className="text-sm font-semibold text-slate-500 tracking-wide animate-pulse">
                  Crafting your travel plans…
                </p>
              </div>
            ) : plans.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan, index) => (
                  <GeneratedPlanCard
                    key={plan.id}
                    plan={plan}
                    index={index}
                    isSelected={plan.id === selectedPlanId}
                    isMapped={plan.id === mappedPlanId}
                    onClick={handleSendToMap}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border-2 border-dashed border-slate-200 py-16 text-center">
                <p className="text-base font-medium text-slate-500">Your plans will appear here</p>
              </div>
            )}
          </section>

          {unresolvedMarkerCount > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 sm:px-5 py-3 sm:py-4 text-amber-800 shadow-sm border border-amber-100">
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 15v-2h2v2Zm0-4V7h2v6Z" />
                </svg>
                <p className="text-xs sm:text-sm font-semibold">
                  We couldn't map {unresolvedMarkerCount} location(s) accurately.
                </p>
              </div>
            </div>
          )}

          <section className="grid h-[600px] sm:h-[700px] lg:h-[800px] grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,420px)] mb-8">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-[36px] bg-slate-200 shadow-inner order-2 lg:order-1 h-full flex flex-col">
              <div className="absolute top-4 left-4 z-10">
                <p className="hidden md:inline-flex rounded-full bg-white/90 backdrop-blur px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 shadow-sm border border-slate-200">
                  {mappedPlan ? `Mapping: ${mappedPlan.title}` : 'Map View'}
                </p>
              </div>
              <div className="flex-1">
                <PlannerMap
                  markers={geocodedMarkers}
                  hoveredActivityId={hoveredActivityId}
                  selectedActivityId={selectedActivityId}
                  onMarkerHoverChange={setHoveredActivityId}
                  onMarkerClick={handleSelectMappedActivity}
                />
              </div>
              {isGeocoding && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
                  <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-lg border border-slate-200">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin text-sky-500" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.636 5.636l2.121 2.121M16.243 16.243l2.121 2.121M5.636 18.364l2.121-2.121M16.243 7.757l2.121-2.121" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-700">Placing pins...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="order-1 lg:order-2 flex flex-col h-[500px] lg:h-full min-h-0">
               <SelectedItinerarySidebar
                selectedPlan={selectedPlan}
                mappedPlanId={mappedPlanId}
                hoveredActivityId={hoveredActivityId}
                selectedActivityId={selectedActivityId}
                setHoveredActivityId={setHoveredActivityId}
                setSelectedActivityId={setSelectedActivityId}
                onSavePlan={handleSavePlan}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GeneratePlannerPage;
