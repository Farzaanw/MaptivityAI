import type { MappedActivity, MarkerData, PlannerMarkerRequest } from '../types/planner';

interface PlannerMarkerResolution {
  id: string;
  lat: number | null;
  lng: number | null;
}

async function resolveMarkers(
  requests: PlannerMarkerRequest[],
): Promise<Map<string, PlannerMarkerResolution>> {
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5050' : '';

  const response = await fetch(`${baseUrl}/api/planner/markers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ activities: requests }),
  });

  const data = await response.json() as {
    markers?: PlannerMarkerResolution[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || 'Unable to resolve planner map markers.');
  }

  return new Map((data.markers ?? []).map((marker) => [marker.id, marker]));
}

export async function buildMarkerData(activities: MappedActivity[]): Promise<MarkerData[]> {
  try {
    const resolvedMarkers = await resolveMarkers(
      activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        locationQuery: activity.locationQuery,
      })),
    );

    return activities.map((activity) => {
      const coordinates = resolvedMarkers.get(activity.id);
      const hasCoordinates = coordinates?.lat != null && coordinates?.lng != null;

      return {
        ...activity,
        lat: coordinates?.lat ?? null,
        lng: coordinates?.lng ?? null,
        geocodeStatus: hasCoordinates ? 'resolved' : 'failed',
      } satisfies MarkerData;
    });
  } catch {
    return activities.map((activity) => ({
      ...activity,
      lat: null,
      lng: null,
      geocodeStatus: 'failed',
    }) satisfies MarkerData);
  }
}
