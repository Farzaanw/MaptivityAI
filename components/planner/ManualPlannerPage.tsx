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
  savedPlans: SavedPlannerPlan[];
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

const DiscoveryPlanCard: React.FC<{
  plan: SavedPlannerPlan;
  onSelect: (plan: SavedPlannerPlan) => void;
  isSelected?: boolean;
}> = ({ plan, onSelect, isSelected }) => {
  return (
    <div
      onClick={() => onSelect(plan)}
      className={`group cursor-pointer rounded-[24px] border p-4 transition-all duration-300 ${isSelected
          ? 'border-emerald-400 bg-emerald-50 shadow-[0_10px_40px_rgba(16,185,129,0.16)] ring-2 ring-emerald-400/20 scale-[1.02]'
          : 'border-slate-200 bg-white shadow-sm hover:border-emerald-200 hover:shadow-md'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-base font-black truncate transition-colors ${isSelected ? 'text-emerald-800' : 'text-slate-900 group-hover:text-emerald-700'}`}>{plan.title}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${plan.kind === 'generated'
                ? (isSelected ? 'bg-sky-200 text-sky-800' : 'bg-sky-100 text-sky-700')
                : (isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-emerald-100 text-emerald-700')
              }`}>
              {plan.kind === 'generated' ? 'AI-Generated' : 'Manual'}
            </span>
          </div>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-50 group-hover:bg-emerald-50 group-hover:text-emerald-600'
          }`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[3]">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
      <p className={`mt-3 text-sm leading-5 line-clamp-1 ${isSelected ? 'text-emerald-600/80' : 'text-slate-500'}`}>{plan.subtitle}</p>
    </div>
  );
};

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
            <p className="text-base font-black text-slate-900">{activity.name}</p>
            {activity.rating != null && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                {activity.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-base leading-6 text-slate-600">{activity.address}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold uppercase tracking-[0.14em] text-emerald-700">
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
      className="group relative overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 pr-[12%] shadow-sm transition hover:border-slate-300"
    >
      <div className="flex items-start gap-4">
        <div
          className="h-16 w-16 shrink-0 cursor-grab overflow-hidden rounded-2xl bg-slate-100 active:cursor-grabbing touch-none"
          {...listeners}
          {...attributes}
        >
          {activity.photoUrl ? (
            <img 
              src={activity.photoUrl} 
              alt={activity.name} 
              className="pointer-events-none h-full w-full object-cover" 
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Move
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-black text-slate-900">{activity.name}</p>
          </div>
          <p className="mt-2 text-base leading-6 text-slate-600">{activity.address}</p>
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

      <button
        type="button"
        onClick={onRemove}
        className="absolute bottom-0 right-0 top-0 flex w-[10%] items-center justify-center bg-rose-400 text-white transition-all duration-200 hover:bg-rose-700 focus:outline-none"
        title="Remove Stop"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
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
      className={`min-h-[260px] rounded-[28px] border p-5 transition ${isOver
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

function buildSavedManualPlan(plan: Plan, destination: PlannerLocation | null, existingId?: string | null): SavedPlannerPlan {
  const activityCount = plan.days.reduce((count, day) => count + day.activities.length, 0);

  return {
    kind: 'manual',
    id: existingId || `saved-manual-${plan.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: destination ? `${destination.name} custom plan` : 'Custom manual plan',
    // subtitle: destination
    //   ? `A hand-built itinerary centered around ${destination.name}.`
    //   : 'A hand-built itinerary created with the manual planner.',
    destination,
    days: plan.days.length,
    activityCount,
    plan,
  };
}

const ManualPlannerPage: React.FC<ManualPlannerPageProps> = ({
  onNavigate,
  favorites,
  savedPlans,
  onPrepareReservationDraft,
  onSavePlan,
}) => {
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<PlannerLocation | null>(null);
  const [discoveredActivities, setDiscoveredActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [discoveryMode, setDiscoveryMode] = useState<'search' | 'favorites' | 'plans'>('search');
  const [pendingPlanToSwitch, setPendingPlanToSwitch] = useState<SavedPlannerPlan | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
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

  const planTitle = useMemo(() => {
    if (editingPlanId) {
      const saved = savedPlans.find((p) => p.id === editingPlanId);
      if (saved) {
        return saved.title.replace(/\s*(?:USA\s*)?custom plan/gi, '').trim();
      }
    }
    if (selectedLocation) {
      return selectedLocation.name.replace(/\s*USA\s*/gi, '').trim();
    }
    return 'Custom Plan';
  }, [editingPlanId, savedPlans, selectedLocation]);

  const favoriteActivities = useMemo(
    () => favorites.map(mapFavoriteToPlannerActivity),
    [favorites],
  );



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

  const handleSavePlan = async () => {
    if (plannedCount === 0) return;

    setIsResetting(true);
    // Show "Saving" animation to match the "Start Fresh" flow
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const newPlan = buildSavedManualPlan(plan, selectedLocation, editingPlanId);
    onSavePlan(newPlan);

    // Lock the ID so the next save updates this same card
    setEditingPlanId(newPlan.id);
    setIsResetting(false);
  };

  const confirmPlanSwitch = () => {
    if (!pendingPlanToSwitch) return;

    // 1. Auto-save current progress if it has content
    if (plannedCount > 0) {
      onSavePlan(buildSavedManualPlan(plan, selectedLocation, editingPlanId));
    }

    // 2. Load the target plan
    setEditingPlanId(pendingPlanToSwitch.id);
    if (pendingPlanToSwitch.kind === 'manual') {
      setPlan(clonePlan(pendingPlanToSwitch.plan));
      setSelectedLocation(pendingPlanToSwitch.destination);
      if (pendingPlanToSwitch.destination) {
        setLocationQuery(pendingPlanToSwitch.destination.name);
        void loadActivities(pendingPlanToSwitch.destination);
      }
    } else {
      // AI to Manual conversion
      const convertedPlan: Plan = {
        id: pendingPlanToSwitch.plan.id,
        days: pendingPlanToSwitch.plan.dayPlans.map((dp) => ({
          day: dp.dayNumber,
          activities: dp.activities.map((act) => ({
            id: act.id,
            name: act.name,
            address: act.location,
            lat: 0,
            lng: 0,
            description: act.description,
          })),
        })),
      };
      setPlan(convertedPlan);
      setSelectedLocation(null);
      setLocationQuery('');
      setDiscoveredActivities([]);
    }

    setActiveDay(1);
    setPendingPlanToSwitch(null);
  };

  const handleCreateNewPlan = async () => {
    if (plannedCount > 0) {
      setIsResetting(true);

      // Brief delay to show "Saving" animation
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const newPlan = buildSavedManualPlan(plan, selectedLocation, editingPlanId);
      onSavePlan(newPlan);

      setPlan({
        id: `manual-plan-${Date.now()}`,
        days: [{ day: 1, activities: [] }],
      });
      setSelectedLocation(null);
      setLocationQuery('');
      setDiscoveredActivities([]);
      setActiveDay(1);
      setEditingPlanId(null);

      setIsResetting(false);
    } else {
      setPlan({
        id: `manual-plan-${Date.now()}`,
        days: [{ day: 1, activities: [] }],
      });
      setSelectedLocation(null);
      setLocationQuery('');
      setDiscoveredActivities([]);
      setActiveDay(1);
      setEditingPlanId(null);
    }
  };

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
          <section className="rounded-[36px] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur transition-all duration-500 animate-float hover:animate-none">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1.5 text-sm sm:text-base font-bold uppercase tracking-wider text-emerald-700 animate-float shadow-sm">
                Build Your Own
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/planner')}
                className="rounded-full border-2 border-sky-200 bg-white px-5 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-bold text-sky-800 transition hover:bg-sky-50 shadow-sm"
              >
                Back to Planner Modes
              </button>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div>
                <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">
                  Plan Your Perfect Trip, Your Way
                </h2>
                <p className="mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 font-medium">
                  Search or select favorited places and activities, drag them to the planning canvas, add trip days, and reorder until your itinerary is perfect.
                </p>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={handleCreateNewPlan}
                    className="group relative flex items-center gap-3 rounded-[20px] bg-slate-900 px-7 py-4 text-sm font-black text-white transition-all duration-300 hover:scale-105 shadow-[0_20px_60px_rgba(15,23,42,0.14)] active:scale-95"
                  >
                    <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-r from-emerald-400 to-sky-400 opacity-0 blur-lg transition-opacity group-hover:opacity-70" />
                    <span className="relative text-xl">♻️</span>
                    <span className="relative uppercase tracking-[0.2em]">Start fresh / New Plan</span>
                  </button>
                </div>
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
            <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] focus:outline-none">
              <section className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
                <div className="mb-6">
                  <p className="text-base font-bold uppercase tracking-wider text-slate-500">Activity Discovery</p>
                  <div className="mt-6 inline-flex flex-wrap gap-1 rounded-[24px] border border-slate-200 bg-slate-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => setDiscoveryMode('search')}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition ${discoveryMode === 'search'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Search
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscoveryMode('favorites')}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition ${discoveryMode === 'favorites'
                          ? 'bg-white text-rose-500 shadow-sm'
                          : 'text-slate-500 hover:text-rose-600'
                        }`}
                    >
                      Favorites
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscoveryMode('plans')}
                      className={`rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition ${discoveryMode === 'plans'
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'text-slate-500 hover:text-emerald-700'
                        }`}
                    >
                      My Plans
                    </button>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {discoveryMode === 'search' && (
                      <PlannerLocationSearch
                        value={locationQuery}
                        onValueChange={setLocationQuery}
                        onLocationSelected={handleLocationSelected}
                      />
                    )}
                    {discoveryMode === 'favorites' && (
                      <div className="py-2 text-base font-bold text-rose-500 uppercase tracking-widest">Your Favorites</div>
                    )}
                    {discoveryMode === 'plans' && (
                      <>
                        <div className="py-2 text-base font-bold text-emerald-600 uppercase tracking-widest">Saved Itineraries</div>
                        <div className="mb-1 text-sm text-slate-700 tracking-widest">Open your existing plans to continue building them!</div>
                      </>
                    )}
                  </div>
                  {discoveryMode !== 'plans' && (
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
                      {(discoveryMode === 'search' ? discoveredActivities : favoriteActivities).length} found
                    </div>
                  )}
                </div>

                {discoveryMode === 'plans' ? (
                  <div className="grid max-h-[820px] gap-4 overflow-y-auto pr-1">
                    {savedPlans.length > 0 ? (
                      savedPlans.map((plan) => (
                        <DiscoveryPlanCard
                          key={plan.id}
                          plan={plan}
                          onSelect={setPendingPlanToSwitch}
                          isSelected={pendingPlanToSwitch?.id === plan.id}
                        />
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-16 text-center text-sm leading-7 text-slate-500">
                        You haven't saved any plans yet.
                      </div>
                    )}
                  </div>
                ) : isLoadingActivities && discoveryMode === 'search' ? (
                  <div className="space-y-4">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
                        <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
                        <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
                      </div>
                    ))}
                  </div>
                ) : (discoveryMode === 'search' ? discoveredActivities : favoriteActivities).length > 0 ? (
                  <div className="grid max-h-[820px] gap-4 overflow-y-auto pr-1">
                    {(discoveryMode === 'search' ? discoveredActivities : favoriteActivities).map((activity) => (
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
                    {discoveryMode === 'favorites'
                      ? 'No favorites saved from the map'
                      : 'Select a location to load the most popular nearby places'}
                  </div>
                )}
              </section>

              <section className="relative rounded-[32px] border border-slate-200 bg-white/90 p-6 text-slate-900 shadow-xl backdrop-blur-md">
                {isResetting && (
                  <div className="absolute inset-0 z-[60] flex items-center justify-center overflow-hidden rounded-[32px] bg-white/70 p-6 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="flex flex-col items-center gap-6">
                      <div className="text-6xl animate-spin" style={{ animationDuration: '3s' }}>
                        ♻️
                      </div>
                      <p className="text-base font-bold uppercase tracking-wider text-slate-700">Saving this Plan</p>
                    </div>
                  </div>
                )}

                {pendingPlanToSwitch && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-[32px] bg-white/70 p-6 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="w-full max-w-sm rounded-[32px] border border-slate-200 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                      <h4 className="mt-6 text-2xl font-bold tracking-tight text-center text-slate-900">Start editing this plan?</h4>
                      <p className="mt-4 text-base text-center leading-relaxed text-slate-600 font-medium">
                        This will automatically save your current progress to "My Plans" and load the new itinerary into here
                      </p>
                      <div className="mt-8 flex gap-4">
                        <button
                          type="button"
                          onClick={confirmPlanSwitch}
                          className="flex-1 rounded-full bg-emerald-500 py-4 text-base font-bold text-white transition hover:bg-emerald-400"
                        >
                          Yes, Switch
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingPlanToSwitch(null)}
                          className="flex-1 rounded-full bg-slate-100 py-4 text-base font-bold text-slate-600 transition hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-bold uppercase tracking-wider text-sky-600">Planning Canvas</p>
                    <div className="mt-2 flex items-center gap-4">
                      <h3 className="text-3xl font-bold text-slate-900">{planTitle}</h3>
                      {/* <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                        {plannedCount} selected
                      </span> */}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSavePlan}
                    disabled={plannedCount === 0}
                    className="rounded-full bg-sky-500 px-6 py-3 text-base sm:text-lg font-bold text-white shadow-md transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save to My Plans
                  </button>
                </div>

                <div className="mb-8 flex flex-wrap items-center gap-3">
                  {plan.days.map((day) => (
                    <button
                      key={day.day}
                      type="button"
                      onClick={() => setActiveDay(day.day)}
                      className={`rounded-full px-5 py-2.5 text-base font-bold transition ${activeDay === day.day
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      Day {day.day}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddDay}
                    className="rounded-full border-2 border-dashed border-slate-300 bg-transparent px-5 py-2.5 text-base font-bold text-slate-500 transition hover:border-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    + Add Day
                  </button>
                  {plan.days.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDay(activeDay)}
                      className="rounded-full bg-rose-50 px-5 py-2.5 text-base font-bold text-rose-600 transition hover:bg-rose-100"
                    >
                      Remove Day
                    </button>
                  )}
                </div>

                <div className="space-y-5">
                  {plan.days.map((day) => (
                    <div key={day.day} className={activeDay === day.day ? 'block' : 'hidden'}>
                      <DayDropZone day={day.day} isActive={activeDay === day.day}>
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                              Day {day.day}
                            </p>
                            {/* <h4 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                              {day.activities.length > 0 ? 'Drag to reorder your stops' : 'Drop activities here'}
                            </h4> */}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
                              {day.activities.length} stop{day.activities.length === 1 ? '' : 's'}
                            </span>
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
                                      <div className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 shadow-sm">
                                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
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
                          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-14 text-center text-base leading-7 text-slate-500 font-medium">
                            Drag and drop activities from the discovery panel here
                          </div>
                        )}
                      </DayDropZone>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-[24px] border border-emerald-100 bg-emerald-50 px-6 py-5">
                  <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Map-ready structure</p>
                  <p className="mt-3 text-base leading-relaxed text-emerald-900/80 font-medium">
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
    </div>
  );
};

export default ManualPlannerPage;
