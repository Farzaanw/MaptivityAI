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
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reservable?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  servesVegetarianFood?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  outdoorSeating?: boolean;
}

interface NearbyResponse {
  places: PlaceResponse[];
}

function inferCategory(types: string[] = []): Activity['category'] {
  const t = types.map((x) => x.toLowerCase());
  // Food bucket
  if (t.some((x) => ['restaurant', 'food', 'cafe', 'meal', 'bakery', 'bar', 'ice_cream_shop'].some((k) => x.includes(k)))) return 'food';
  // Places (Nature/Parks/Landmarks) bucket
  if (t.some((x) => ['park', 'natural_feature', 'beach', 'garden', 'lake', 'landmark', 'tourist_attraction'].some((k) => x.includes(k)))) return 'places';
  // Activities (Entertainment/Shopping/Culture) bucket
  return 'activities';
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
      lat: p.lat,
      lng: p.lng,
      category: inferCategory(p.types),

      rating: p.rating,
      userRatingCount: p.userRatingCount,
      priceLevel: p.priceLevel,
      photoUrl: p.photoUrl ? `${baseUrl}/api/places/photo/${p.photoUrl}` : undefined,
      types: p.types,
      regularOpeningHours: p.regularOpeningHours,
      reservable: p.reservable,
      goodForChildren: p.goodForChildren,
      goodForGroups: p.goodForGroups,
      servesVegetarianFood: p.servesVegetarianFood,
      servesBreakfast: p.servesBreakfast,
      servesBrunch: p.servesBrunch,
      servesLunch: p.servesLunch,
      servesDinner: p.servesDinner,
      outdoorSeating: p.outdoorSeating,
    }));
  } catch (error) {
    console.error('[placesService] Error fetching places:', error);
    throw new Error('Unable to retrieve places. Please try again.');
  }
}

export async function getPlaceDetails(placeId: string): Promise<any> {
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5050' : '';
  try {
    const res = await fetch(`${baseUrl}/api/places/details/${placeId}`);
    if (!res.ok) throw new Error(`Place details error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[placesService] Error fetching details:', error);
    throw error;
  }
}

