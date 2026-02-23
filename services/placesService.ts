import { Activity } from '../types';

interface PlaceResponse {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  types?: string[];
  address?: string;
  photoUrl?: string;
}

interface NearbyResponse {
  places: PlaceResponse[];
}

function inferCategory(types: string[] = []): Activity['category'] {
  const t = types.map((x) => x.toLowerCase());
  if (t.some((x) => ['restaurant', 'food', 'cafe', 'meal'].some((k) => x.includes(k)))) return 'restaurant';
  if (t.some((x) => ['park', 'natural_feature'].some((k) => x.includes(k)))) return 'park';
  if (t.some((x) => ['entertainment', 'movie_theater', 'night_club'].some((k) => x.includes(k)))) return 'entertainment';
  return 'attraction';
}

export async function searchNearbyActivities(params: {
  lat: number;
  lng: number;
  radiusMeters: number;
  query: string;
}): Promise<Activity[]> {
  const { lat, lng, radiusMeters, query } = params;
  const searchParams = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
    q: query,
  });
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5050' : '';
  
  try {
    const res = await fetch(`${baseUrl}/api/places/nearby?${searchParams}`);
    if (!res.ok) throw new Error(`Places API error: ${res.status}`);
    const data = (await res.json()) as NearbyResponse;
    const places = data.places ?? [];
    
    // Deduplicate by ID to avoid showing the same place twice
    const seenIds = new Set<string>();
    const deduplicated = places.filter((p) => {
      if (seenIds.has(p.id)) {
        return false;
      }
      seenIds.add(p.id);
      return true;
    });

    return deduplicated.map((p) => ({
      id: p.id,
      title: p.name,
      description: p.address ?? '',
      uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat + ',' + p.lng)}`,
      category: inferCategory(p.types),
    }));
  } catch (error) {
    console.error('[placesService] Error fetching places:', error);
    throw new Error('Unable to retrieve places. Please try again.');
  }
}
