import { useState, useCallback } from 'react';

export interface PlaceResult {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photos?: string[];
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export const usePlaceDiscovery = () => {
  const [discoveredPlaces, setDiscoveredPlaces] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper: Check if a point is inside bounding box
  const isPointInsideBBox = useCallback((lat: number, lng: number, bbox: BoundingBox): boolean => {
    return (
      lat >= bbox.minLat &&
      lat <= bbox.maxLat &&
      lng >= bbox.minLng &&
      lng <= bbox.maxLng
    );
  }, []);

  // Helper: Calculate radius from bounding box (distance from center to corner)
  const calculateBBoxRadius = useCallback((bbox: BoundingBox): number => {
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;
    const centerLng = (bbox.minLng + bbox.maxLng) / 2;

    // Haversine formula to calculate distance
    const R = 6371000; // Earth's radius in meters
    const dLat = ((bbox.maxLat - centerLat) * Math.PI) / 180;
    const dLng = ((bbox.maxLng - centerLng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((centerLat * Math.PI) / 180) *
        Math.cos((bbox.maxLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.ceil(distance * 1.2); // Add 20% buffer
  }, []);

  // Helper: Get center point from bounding box
  const getBBoxCenter = useCallback((bbox: BoundingBox) => {
    return {
      lat: (bbox.minLat + bbox.maxLat) / 2,
      lng: (bbox.minLng + bbox.maxLng) / 2,
    };
  }, []);

  // Helper: Deduplicate results by place_id
  const deduplicatePlaces = useCallback((places: PlaceResult[]): PlaceResult[] => {
    const seen = new Set<string>();
    return places.filter((place) => {
      if (seen.has(place.place_id)) return false;
      seen.add(place.place_id);
      return true;
    });
  }, []);

  // Main function: Discover places within bounding box
  const discoverPlacesInBBox = useCallback(
    async (bounds: [[number, number], [number, number]]): Promise<PlaceResult[]> => {
      setLoading(true);
      setError(null);

      try {
        // Parse bounds into bbox format
        const bbox: BoundingBox = {
          minLat: bounds[0][0],
          minLng: bounds[0][1],
          maxLat: bounds[1][0],
          maxLng: bounds[1][1],
        };

        // Calculate search parameters
        const center = getBBoxCenter(bbox);
        const radius = calculateBBoxRadius(bbox);

        // Validate Google Maps API
        if (!window.google?.maps?.places?.PlacesService) {
          throw new Error('Google Places API not available');
        }

        // Create a temporary map element for PlacesService
        const tempDiv = document.createElement('div');
        const placesService = new google.maps.places.PlacesService(tempDiv);

        // Call Nearby Search API
        const request = {
          location: new google.maps.LatLng(center.lat, center.lng),
          radius: radius,
          type: 'point_of_interest',
        };

        const results = await new Promise<google.maps.places.PlaceResult[]>(
          (resolve, reject) => {
            placesService.nearbySearch(request, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
              } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
              } else {
                reject(new Error(`Places API error: ${status}`));
              }
            });
          }
        );

        // Filter results: keep only places inside the exact bounding box
        const filteredResults: PlaceResult[] = results
          .filter((place) => {
            const lat = place.geometry?.location?.lat();
            const lng = place.geometry?.location?.lng();
            return lat !== undefined && lng !== undefined && isPointInsideBBox(lat, lng, bbox);
          })
          .map((place) => ({
            place_id: place.place_id || '',
            name: place.name || 'Unknown',
            lat: place.geometry?.location?.lat() || center.lat,
            lng: place.geometry?.location?.lng() || center.lng,
            address: place.vicinity || '',
            rating: place.rating,
            userRatingCount: place.user_ratings_total,
            types: place.types,
            photos: place.photos
              ?.map((photo) => photo.getUrl({ maxHeight: 300, maxWidth: 400 }))
              .filter(Boolean),
          }));

        // Deduplicate and set results
        const dedupedResults = deduplicatePlaces(filteredResults);
        setDiscoveredPlaces(dedupedResults);

        return dedupedResults;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to discover places';
        setError(errorMessage);
        console.error('Place discovery error:', errorMessage);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [isPointInsideBBox, calculateBBoxRadius, getBBoxCenter, deduplicatePlaces]
  );

  return {
    discoveredPlaces,
    loading,
    error,
    discoverPlacesInBBox,
  };
};
