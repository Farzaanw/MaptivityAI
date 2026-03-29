export interface Activity {
  id: string;
  name: string;
  address: string;
  rating?: number;
  lat: number;
  lng: number;
  photoUrl?: string;
  placeId?: string;
}

export interface DayPlan {
  day: number;
  activities: Activity[];
}

export interface Plan {
  id: string;
  days: DayPlan[];
}

export interface PlannerLocation {
  name: string;
  placeId: string;
  lat: number;
  lng: number;
  address: string;
}

export interface PlannerResponseActivity {
  name: string;
  time: string;
  location: string;
  description: string;
}

export interface PlannerResponsePlan {
  id: string;
  title: string;
  summary: string;
  days: number;
  activities: PlannerResponseActivity[];
}

export interface PlannerResponse {
  plans: PlannerResponsePlan[];
}

export interface GeneratedPlanActivity {
  id: string;
  order: number;
  dayNumber: number;
  name: string;
  time: string;
  location: string;
  description: string;
}

export interface GeneratedDayPlan {
  dayNumber: number;
  activities: GeneratedPlanActivity[];
}

export interface GeneratedPlan {
  id: string;
  title: string;
  summary: string;
  days: number;
  activities: GeneratedPlanActivity[];
  dayPlans: GeneratedDayPlan[];
}

export interface MappedActivity extends GeneratedPlanActivity {
  planId: string;
  markerLabel: string;
  locationQuery: string;
}

export interface MarkerData extends MappedActivity {
  lat: number | null;
  lng: number | null;
  geocodeStatus: 'pending' | 'resolved' | 'failed';
}

export interface PlannerMarkerRequest {
  id: string;
  name: string;
  locationQuery: string;
}

export interface ReservationCandidate {
  id: string;
  name: string;
  dayLabel: string;
  address: string;
  timeLabel?: string;
  notes?: string;
  photoUrl?: string;
  lat?: number;
  lng?: number;
  reservationHint: string;
  source: 'generated' | 'manual';
}

export interface ReservationDraft {
  id: string;
  title: string;
  subtitle: string;
  source: 'generated' | 'manual';
  candidates: ReservationCandidate[];
}
