import type { Activity } from '../types/planner';

interface DiscoverPlannerActivitiesResponse {
  activities?: Activity[];
  error?: string;
}

export async function discoverPlannerActivities(params: {
  lat: number;
  lng: number;
  radiusMeters?: number;
}): Promise<Activity[]> {
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5050' : '';

  const response = await fetch(`${baseUrl}/api/planner/discover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await response.json() as DiscoverPlannerActivitiesResponse;

  if (!response.ok) {
    throw new Error(data.error || 'Unable to discover activities for this destination.');
  }

  return (data.activities ?? []).map((activity) => ({
    ...activity,
    photoUrl: activity.photoUrl
      ? activity.photoUrl.startsWith('http')
        ? activity.photoUrl
        : `${baseUrl}${activity.photoUrl}`
      : undefined,
  }));
}
