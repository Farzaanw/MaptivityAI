import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { discoverPlannerActivities } from '../../services/manualPlannerService';
import type { Activity, Plan, PlannerLocation, ReservationDraft, SavedPlannerPlan } from '../../types/planner';
import type { Activity as SavedActivity } from '../../types';

interface ManualPlannerPageProps {
  onNavigate: (path: '/planner' | '/planner/generate' | '/planner/manual' | '/planner/reserve') => void;
  favorites: SavedActivity[];
  onPrepareReservationDraft: (draft: ReservationDraft) => void;
  onSavePlan: (plan: SavedPlannerPlan) => void;
}

interface PlaceSuggestion {
  placePrediction: {
    placeId: string;
    text: { text: string };
    toPlace: () => {
      fetchFields: (request: { fields: string[] }) => Promise<void>;
      id?: string;
      location?: google.maps.LatLng;
      formattedAddress?: string;
      displayName?: { text?: string };
    };
  };
}

interface DragPreviewData {
  type: 'discovery' | 'planned';
  activity: Activity;
}

function dayContainerId(day: number): string {
  return `day-${day}`;
}

function plannedItemId(day: number, activityId: string): string {
  return `planned:${day}:${activityId}`;
}

function parsePlannedItemId(id: string): { day: number; activityId: string } | null {
  const parts = id.split(':');
  if (parts.length !== 3 || parts[0] !== 'planned') return null;
  const day = Number(parts[1]);
  if (!Number.isFinite(day)) return null;
  return { day, activityId: parts[2] };
}

function parseDayContainerId(id: string): number | null {
  if (!id.startsWith('day-')) return null;
  const day = Number(id.slice(4));
  return Number.isFinite(day) ? day : null;
}

function clonePlan(plan: Plan): Plan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      activities: [...day.activities],
    })),
  };
}

function mapFavoriteToPlannerActivity(activity: SavedActivity): Activity {
  return {
    id: activity.id,
    placeId: activity.id,
    name: activity.title,
    address: activity.description || 'Saved favorite',
    rating: activity.rating,
    lat: activity.lat,
    lng: activity.lng,
    photoUrl: activity.photoUrl,
  };
}

function buildManualReservationDraft(plan: Plan): ReservationDraft {
  return {
    id: `reserve-${plan.id}`,
    title: 'Reserve Your Custom Plan',
    subtitle: 'These saved itinerary stops are ready for a future AI agent to review for reservations, timed entries, and bookings.',
    source: 'manual',
    candidates: plan.days.flatMap((dayPlan) =>
      dayPlan.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        dayLabel: `Day ${dayPlan.day}`,
        address: activity.address,
        photoUrl: activity.photoUrl,
        lat: activity.lat,
        lng: activity.lng,
        reservationHint: 'Review venue for bookable tables, tickets, or entry windows',
        source: 'manual' as const,
      })),
    ),
  };
}

function PlannerLocationSearch({
  value,
  onValueChange,
  onLocationSelected,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onLocationSelected: (location: PlannerLocation) => void;
  disabled?: boolean;
}) {
  const [googleReady, setGoogleReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    let timeoutId: number | null = null;

    const checkGoogleReady = () => {
      if (typeof google !== 'undefined' && google.maps?.places) {
        setGoogleReady(true);
        return;
      }
      timeoutId = window.setTimeout(checkGoogleReady, 120);
    };

    checkGoogleReady();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (googleReady && !sessionToken) {
      setSessionToken(new google.maps.places.AutocompleteSessionToken());
    }
  }, [googleReady, sessionToken]);

  const fetchSuggestions = async (input: string) => {
    if (!input.trim() || !googleReady || !sessionToken) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const { AutocompleteSuggestion } = await (google.maps as any).importLibrary('places');
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken,
      });
      setSuggestions((response.suggestions ?? []) as PlaceSuggestion[]);
    } catch (error) {
      console.error('[manual-planner] Autocomplete error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (nextValue: string) => {
    onValueChange(nextValue);
    if (nextValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    void fetchSuggestions(nextValue);
  };

  const handleSuggestionSelect = async (suggestion: PlaceSuggestion) => {
    setLoading(true);

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location'],
      });

      const location = place.location;
      if (!location) {
        throw new Error('Selected place is missing coordinates.');
      }

      const nextLocation: PlannerLocation = {
        name: place.displayName?.text || suggestion.placePrediction.text.text,
        placeId: place.id || suggestion.placePrediction.placeId,
        lat: location.lat(),
        lng: location.lng(),
        address: place.formattedAddress || suggestion.placePrediction.text.text,
      };

      onValueChange(nextLocation.name);
      onLocationSelected(nextLocation);
      setSuggestions([]);
      setSessionToken(new google.maps.places.AutocompleteSessionToken());
    } catch (error) {
      console.error('[manual-planner] Place selection error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <label className="block">
        {/* <span className="mb-2 block text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
          Destination
        </span> */}
        <input
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          placeholder="Search a city or location"
          disabled={disabled}
          className="w-full rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-800 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </label>

      {loading && (
        <div className="mt-2 text-sm font-medium text-slate-500">Looking up places...</div>
      )}

      {suggestions.length > 0 && (
        <div className="absolute z-20 mt-3 w-full overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placePrediction.placeId}
              type="button"
              onClick={() => void handleSuggestionSelect(suggestion)}
              className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-emerald-50"
            >
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {suggestion.placePrediction.text.text}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                  Google Places
                </p>
              </div>
              <span className="text-sm text-emerald-600">Select</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DiscoveryCard: React.FC<{ activity: Activity }> = ({ activity }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discovery:${activity.id}`,
    data: {
      type: 'discovery',
      activity,
    } satisfies DragPreviewData,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          {activity.photoUrl ? (
            <img src={activity.photoUrl} alt={activity.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              No Photo
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-black text-slate-900">{activity.name}</p>
            {activity.rating != null && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                {activity.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{activity.address}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
            Drag to plan
          </div>
        </div>
      </div>
    </article>
  );
};

const PlannedActivityCard: React.FC<{
  day: number;
  activity: Activity;
  onRemove: () => void;
}> = ({ day, activity, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plannedItemId(day, activity.id),
    data: {
      type: 'planned',
      activity,
      day,
    } satisfies DragPreviewData & { day: number },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-2xl bg-slate-900 text-xs font-black uppercase tracking-[0.14em] text-white active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          Move
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-black text-slate-900">{activity.name}</p>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
            >
              Remove
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{activity.address}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            {activity.rating != null && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                Rating {activity.rating.toFixed(1)}
              </span>
            )}
            <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
              Marker ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DayDropZone: React.FC<{
  day: number;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ day, isActive, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: dayContainerId(day),
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[260px] rounded-[28px] border p-5 transition ${
        isOver
          ? 'border-emerald-400 bg-emerald-50/80'
          : isActive
            ? 'border-slate-900 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]'
            : 'border-slate-200 bg-white/70'
      }`}
    >
      {children}
    </div>
  );
};

function buildSavedManualPlan(plan: Plan, destination: PlannerLocation | null): SavedPlannerPlan {
  const activityCount = plan.days.reduce((count, day) => count + day.activities.length, 0);

  return {
    kind: 'manual',
    id: `saved-manual-${plan.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: destination ? `${destination.name} custom plan` : 'Custom manual plan',
    subtitle: destination
      ? `A hand-built itinerary centered around ${destination.name}.`
      : 'A hand-built itinerary created with the manual planner.',
    destination,
    days: plan.days.length,
    activityCount,
    plan,
  };
}

const ManualPlannerPage: React.FC<ManualPlannerPageProps> = ({
  onNavigate,
  favorites,
  onPrepareReservationDraft,
  onSavePlan,
}) => {
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<PlannerLocation | null>(null);
  const [discoveredActivities, setDiscoveredActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [plan, setPlan] = useState<Plan>({
    id: 'manual-plan',
    days: [{ day: 1, activities: [] }],
  });
  const [activeDay, setActiveDay] = useState(1);
  const [activeDrag, setActiveDrag] = useState<DragPreviewData | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const plannedActivityIds = useMemo(
    () => new Set(plan.days.flatMap((day) => day.activities.map((activity) => activity.id))),
    [plan],
  );

  const plannedCount = useMemo(
    () => plan.days.reduce((count, day) => count + day.activities.length, 0),
    [plan],
  );

  const favoriteActivities = useMemo(
    () => favorites.map(mapFavoriteToPlannerActivity),
    [favorites],
  );

  const activityDiscoveryItems = showFavoritesOnly ? favoriteActivities : discoveredActivities;

  const loadActivities = async (location: PlannerLocation) => {
    setIsLoadingActivities(true);
    setError(null);

    try {
      const activities = await discoverPlannerActivities({
        lat: location.lat,
        lng: location.lng,
        radiusMeters: 7000,
      });
      setDiscoveredActivities(activities);
    } catch (err) {
      setDiscoveredActivities([]);
      setError(err instanceof Error ? err.message : 'Unable to discover activities for this destination.');
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleLocationSelected = (location: PlannerLocation) => {
    setSelectedLocation(location);
    setPlan({
      id: `manual-${location.placeId}`,
      days: [{ day: 1, activities: [] }],
    });
    setActiveDay(1);
    void loadActivities(location);
  };

  const addActivityToDay = (activity: Activity, targetDay: number, targetIndex?: number) => {
    setPlan((currentPlan) => {
      if (currentPlan.days.some((day) => day.activities.some((item) => item.id === activity.id))) {
        return currentPlan;
      }

      const nextPlan = clonePlan(currentPlan);
      const day = nextPlan.days.find((item) => item.day === targetDay);
      if (!day) return currentPlan;

      const nextIndex = targetIndex == null ? day.activities.length : targetIndex;
      day.activities.splice(nextIndex, 0, activity);
      return nextPlan;
    });
  };

  const movePlannedActivity = (
    activityId: string,
    sourceDay: number,
    targetDay: number,
    targetIndex?: number,
  ) => {
    setPlan((currentPlan) => {
      const nextPlan = clonePlan(currentPlan);
      const source = nextPlan.days.find((day) => day.day === sourceDay);
      const target = nextPlan.days.find((day) => day.day === targetDay);
      if (!source || !target) return currentPlan;

      const sourceIndex = source.activities.findIndex((activity) => activity.id === activityId);
      if (sourceIndex === -1) return currentPlan;

      if (sourceDay === targetDay && targetIndex != null && sourceIndex === targetIndex) {
        return currentPlan;
      }

      if (sourceDay === targetDay && targetIndex != null) {
        source.activities = arrayMove(source.activities, sourceIndex, targetIndex);
        return nextPlan;
      }

      const [activity] = source.activities.splice(sourceIndex, 1);
      if (!activity) return currentPlan;

      const nextIndex = targetIndex == null ? target.activities.length : targetIndex;
      target.activities.splice(nextIndex, 0, activity);
      return nextPlan;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);

    const activeData = event.active.data.current as (DragPreviewData & { day?: number }) | undefined;
    const overId = event.over?.id?.toString();

    if (!activeData || !overId) return;

    const overPlanned = parsePlannedItemId(overId);
    const overDay = overPlanned?.day ?? parseDayContainerId(overId);

    if (!overDay) return;
    setActiveDay(overDay);

    if (activeData.type === 'discovery') {
      const targetIndex = overPlanned
        ? plan.days.find((day) => day.day === overDay)?.activities.findIndex((item) => item.id === overPlanned.activityId)
        : undefined;
      addActivityToDay(activeData.activity, overDay, targetIndex ?? undefined);
      return;
    }

    if (activeData.type === 'planned' && typeof activeData.day === 'number') {
      const targetIndex = overPlanned
        ? plan.days.find((day) => day.day === overDay)?.activities.findIndex((item) => item.id === overPlanned.activityId)
        : undefined;
      movePlannedActivity(activeData.activity.id, activeData.day, overDay, targetIndex ?? undefined);
    }
  };

  const handleAddDay = () => {
    let nextDayNumber = plan.days.length + 1;
    setPlan((currentPlan) => {
      nextDayNumber = currentPlan.days.length + 1;
      return {
        ...currentPlan,
        days: [...currentPlan.days, { day: nextDayNumber, activities: [] }],
      };
    });
    setActiveDay(nextDayNumber);
  };

  const handleRemoveDay = (dayNumber: number) => {
    setPlan((currentPlan) => {
      if (currentPlan.days.length === 1) {
        return currentPlan;
      }

      const remainingDays = currentPlan.days
        .filter((day) => day.day !== dayNumber)
        .map((day, index) => ({
          ...day,
          day: index + 1,
        }));

      return {
        ...currentPlan,
        days: remainingDays,
      };
    });

    setActiveDay((currentActiveDay) => {
      if (plan.days.length === 1) {
        return currentActiveDay;
      }

      if (currentActiveDay < dayNumber) {
        return currentActiveDay;
      }

      if (currentActiveDay > dayNumber) {
        return currentActiveDay - 1;
      }

      return Math.max(1, currentActiveDay - 1);
    });
  };

  const handleRemoveActivity = (dayNumber: number, activityId: string) => {
    setPlan((currentPlan) => ({
      ...currentPlan,
      days: currentPlan.days.map((day) =>
        day.day === dayNumber
          ? { ...day, activities: day.activities.filter((activity) => activity.id !== activityId) }
          : day,
      ),
    }));
  };

  const handleImportFavorite = (activity: Activity) => {
    addActivityToDay(activity, activeDay);
  };

  const handleReservePlan = () => {
    onPrepareReservationDraft(buildManualReservationDraft(plan));
    onNavigate('/planner/reserve');
  };

  const handleSavePlan = () => {
    if (plannedCount === 0) return;
    onSavePlan(buildSavedManualPlan(plan, selectedLocation));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_28%),linear-gradient(180deg,#fbfdff_0%,#eefbf6_52%,#f8fafc_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="rounded-[36px] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1 text-sm font-bold uppercase tracking-[0.1em] text-emerald-700">
              Build Your Own
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/planner')}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Back to Planner Modes
            </button>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div>
              <h2 className="text-4xl font-black tracking-tight text-slate-950">
                Plan Your Perfect Trip, Your Way
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Search for places or Select activities that you've favoriated in the app, 
                drag them to the planning canvas, add days to your trip, and reorder them 
                until your itinerary feels just right.
              </p>
            </div>

            {/* <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Manual flow</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>1. Pick a real location with Google Places autocomplete</p>
                <p>2. Browse live attractions, restaurants, parks, museums, and nightlife</p>
                <p>3. Drag activities into your itinerary and reorder them by day</p>
              </div>
            </div> */}
          </div>

          {/* <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Saved places</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Import activities you already saved in Favorites into the currently selected day.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFavoritesOpen((current) => !current)}
                  className="rounded-full bg-rose-500 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-600"
                >
                  {isFavoritesOpen ? 'Hide Favorites' : 'Import from Favorites'}
                </button>
              </div>

              {isFavoritesOpen && (
                <div className="mt-5">
                  {favoriteActivities.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {favoriteActivities.map((activity) => {
                        const alreadyPlanned = plannedActivityIds.has(activity.id);

                        return (
                          <div
                            key={activity.id}
                            className={`rounded-[22px] border p-4 transition ${
                              alreadyPlanned
                                ? 'border-slate-200 bg-slate-50'
                                : 'border-rose-100 bg-rose-50/50'
                            }`}
                          >
                            <div className="flex gap-4">
                              <div className="h-18 w-18 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                                {activity.photoUrl ? (
                                  <img src={activity.photoUrl} alt={activity.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                    Favorite
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-black text-slate-900">{activity.name}</p>
                                  {activity.rating != null && (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                                      {activity.rating.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{activity.address}</p>
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleImportFavorite(activity)}
                                    disabled={alreadyPlanned}
                                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                  >
                                    {alreadyPlanned ? 'Already in Plan' : `Add to Day ${activeDay}`}
                                  </button>
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-500">
                                    Saved favorite
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      You don't have any favorites yet. Save places from the map to view here
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedLocation ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Selected destination</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-lg font-black text-slate-900">{selectedLocation.name}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{selectedLocation.address}</p>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-sm leading-7 text-slate-500">
                Pick a destination from Activity Discovery to anchor the live places panel and your manual itinerary.
              </div>
            )}
          </div> */}

          {/* <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleReservePlan}
              disabled={plannedCount === 0}
              className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-200"
            >
              Reserve Plan
            </button>
            <p className="text-sm text-slate-500">
              Open a future AI-agent reservation queue for the activities currently in your plan.
            </p>
          </div> */}

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </section>

        <DndContext
          sensors={sensors}
          onDragStart={(event) => {
            const data = event.active.data.current as DragPreviewData | undefined;
            setActiveDrag(data ?? null);
          }}
          onDragCancel={() => setActiveDrag(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
              <div className="mb-5">
                <p className="text-sm font-bold uppercase tracking-[0.1em] text-slate-500">Activity Discovery</p>
                <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly(false)}
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                      !showFavoritesOnly
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Search By Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly(true)}
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                      showFavoritesOnly
                        ? 'bg-rose-500 text-white shadow-sm hover:bg-rose-600'
                        : 'text-slate-500 hover:text-rose-600'
                    }`}
                  >
                    Show Favorites
                  </button>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {showFavoritesOnly ? null : (
                    <PlannerLocationSearch
                      value={locationQuery}
                      onValueChange={setLocationQuery}
                      onLocationSelected={handleLocationSelected}
                    />
                  )}
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {activityDiscoveryItems.length} found
                </div>
              </div>

              {isLoadingActivities && !showFavoritesOnly ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : activityDiscoveryItems.length > 0 ? (
                <div className="grid max-h-[820px] gap-4 overflow-y-auto pr-1">
                  {activityDiscoveryItems.map((activity) => (
                    <div key={activity.id} className="relative">
                      <DiscoveryCard activity={activity} />
                      {plannedActivityIds.has(activity.id) && (
                        <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white">
                          In plan
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-16 text-center text-sm leading-7 text-slate-500">
                  {showFavoritesOnly
                    ? 'No favorites saved from the map'
                    : 'Select a location to load the most popular nearby places'}
                </div>
              )}
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Planning Canvas</p>
                  <h3 className="mt-2 text-2xl font-black">Trip Itinerary</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                    {plannedCount} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    disabled={plannedCount === 0}
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save to My Plans
                  </button>
                  <button
                    type="button"
                    onClick={handleAddDay}
                    className="rounded-full bg-emerald-400 px-4 py-2 text-md font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    Add Day
                  </button>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                {plan.days.map((day) => (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => setActiveDay(day.day)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      activeDay === day.day
                        ? 'bg-white text-slate-950'
                        : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    Day {day.day}
                  </button>
                ))}
              </div>

              <div className="space-y-5">
                {plan.days.map((day) => (
                  <div key={day.day} className={activeDay === day.day ? 'block' : 'hidden'}>
                    <DayDropZone day={day.day} isActive={activeDay === day.day}>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                            Day {day.day}
                          </p>
                          <h4 className="mt-2 text-xl font-black text-slate-950">
                            {day.activities.length > 0 ? 'Drag to reorder your stops' : 'Drop activities here'}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {day.activities.length} stop{day.activities.length === 1 ? '' : 's'}
                          </span>
                          {plan.days.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDay(day.day)}
                              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-100"
                            >
                              Remove Day
                            </button>
                          )}
                        </div>
                      </div>

                      {day.activities.length > 0 ? (
                        <SortableContext
                          items={day.activities.map((activity) => plannedItemId(day.day, activity.id))}
                          strategy={rectSortingStrategy}
                        >
                          <div className="space-y-4">
                            {day.activities.map((activity, index) => (
                              <React.Fragment key={activity.id}>
                                <PlannedActivityCard
                                  day={day.day}
                                  activity={activity}
                                  onRemove={() => handleRemoveActivity(day.day, activity.id)}
                                />
                                {index < day.activities.length - 1 && (
                                  <div className="flex justify-center">
                                    <div className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500 shadow-sm">
                                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="M12 4a1 1 0 0 1 1 1v10.59l3.3-3.29a1 1 0 1 1 1.4 1.41l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.41L11 15.59V5a1 1 0 0 1 1-1Z" />
                                      </svg>
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </SortableContext>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-14 text-center text-sm leading-7 text-slate-500">
                          Pull activities from the discovery panel and drop them here to build Day {day.day}.
                        </div>
                      )}
                    </DayDropZone>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Map-ready structure</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Every selected activity keeps its Google Places `lat` and `lng`, so this itinerary
                  can be passed into map markers without reshaping the data later.
                </p>
              </div>
            </section>
          </div>

          <DragOverlay>
            {activeDrag ? (
              <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                <p className="text-sm font-black text-slate-900">{activeDrag.activity.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {activeDrag.type === 'discovery' ? 'Add to itinerary' : 'Reorder stop'}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default ManualPlannerPage;
