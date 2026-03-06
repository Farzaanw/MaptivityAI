import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const PORT = 5050;
const API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 min cache, check every 2 min

console.log('[startup] CWD:', process.cwd());
console.log('[startup] Resolved .env path:', envPath);
console.log('[startup] .env file exists:', fs.existsSync(envPath) ? 'yes' : 'NO');
console.log('[startup] VITE_GOOGLE_MAPS_API_KEY prefix:', API_KEY ? `${API_KEY.slice(0, 6)}…` : 'NOT SET');

if (
  !API_KEY ||
  API_KEY.toLowerCase().startsWith('your_') ||
  !API_KEY.startsWith('AIza')
) {
  console.error('\n[FATAL] VITE_GOOGLE_MAPS_API_KEY is missing or invalid.');
  console.error('Add your real API key to server/.env (not .env.example):');
  console.error('  VITE_GOOGLE_MAPS_API_KEY=AIza...your_key_here\n');
  process.exit(1);
}

const app = express();
const FIELDS =
  'places.id,places.displayName,places.location,places.formattedAddress,places.types,places.photos,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.reservable,places.goodForChildren,places.goodForGroups,places.servesVegetarianFood,places.servesBreakfast,places.servesBrunch,places.servesLunch,places.servesDinner,places.outdoorSeating';
const PLACE_DETAILS_FIELDS =
  'id,displayName,formattedAddress,location,types,photos,rating,userRatingCount,priceLevel,websiteUri,internationalPhoneNumber,regularOpeningHours,editorialSummary,reviews,googleMapsUri,reservable,goodForChildren,goodForGroups,servesVegetarianFood,servesBreakfast,servesBrunch,servesLunch,servesDinner,outdoorSeating';



const GENERIC_QUERIES = ['things to do', 'fun things to do', ''];

function isGenericQuery(q: string): boolean {
  const normalized = q.trim().toLowerCase();
  return GENERIC_QUERIES.includes(normalized) || ['things to do', 'fun things to do'].some((g) => normalized === g);
}


// searchText only supports `locationRestriction.rectangle`, not .circle.
// We compute a bounding box from the circle, then post-filter with Haversine distance.
function circleToBoundingRect(lat: number, lng: number, radiusMeters: number) {
  const deltaLat = radiusMeters / 111320;
  const deltaLng = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    low: { latitude: lat - deltaLat, longitude: lng - deltaLng },
    high: { latitude: lat + deltaLat, longitude: lng + deltaLng },
  };
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
  })
);
app.use(express.json());

app.get('/api/places/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseInt(req.query.radius as string, 10);
  const q = (req.query.q as string) ?? '';

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'Invalid or missing lat' });
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid or missing lng' });
  }
  if (isNaN(radius) || radius <= 0 || radius > 50000) {
    return res.status(400).json({ error: 'Invalid or missing radius (1-50000)' });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
  }

  // Generate cache key
  const cacheKey = `places:${lat}:${lng}:${radius}:${q}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    console.log('[cache] HIT:', cacheKey);
    return res.json(cachedResult);
  }

  const center = { latitude: lat, longitude: lng };
  const circle = { center, radius };
  const headers = {
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': FIELDS,
    'Content-Type': 'application/json',
  };

  let data: { places?: Array<Record<string, unknown>> };

  if (q && !isGenericQuery(q)) {
    const boundingRect = circleToBoundingRect(lat, lng, radius);
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        textQuery: q,
        // searchText only supports rectangle for locationRestriction (not circle)
        locationRestriction: { rectangle: boundingRect },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[searchText] Places API error:', response.status, err);
      return res.status(response.status).json({ error: err || 'Places API error' });
    }
    data = (await response.json()) as { places?: Array<Record<string, unknown>> };

    // Post-filter: keep only places within the actual circle radius (bounding box is slightly larger)
    const allPlaces = (data.places ?? []) as Array<Record<string, unknown>>;
    const withinCircle = allPlaces.filter((p) => {
      const loc = p.location as { latitude?: number; longitude?: number } | undefined;
      if (!loc?.latitude || !loc?.longitude) return true; // keep if no location info
      return haversineDistanceMeters(lat, lng, loc.latitude, loc.longitude) <= radius;
    });

    // Filter out pure administrative areas (cities, states, countries)
    const filtered = withinCircle.filter((p) => {
      const types = (p.types as string[]) ?? [];
      const hasActivityType = types.some(
        (t) =>
          ![
            'locality',
            'political',
            'country',
            'administrative_area_level_1',
            'administrative_area_level_2',
          ].includes(t)
      );
      return hasActivityType || types.length === 0;
    });

    console.log(`[searchText] Got ${allPlaces.length} places, ${withinCircle.length} within circle, ${filtered.length} after admin filter`);
    data.places = filtered;

    // If searchText returns no activity results, fall back to searchNearby
    if (filtered.length === 0) {
      console.log(`[searchText] No activity results for "${q}", falling back to searchNearby`);
      const fallbackResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          includedTypes: [
            'amusement_park',
            'aquarium',
            'art_gallery',
            'bakery',
            'bar',
            'beach',
            'beauty_salon',
            'bowling_alley',
            'cafe',
            'casino',
            'church',
            'garden',
            'golf_course',
            'gym',
            'hotel',
            'ice_cream_shop',
            'lake',
            'library',
            'movie_theater',
            'museum',
            'park',
            'restaurant',
            'shopping_mall',
            'spa',
            'stadium',
            'tourist_attraction',
            'zoo',
          ],
          maxResultCount: 20,
          locationRestriction: { circle },
        }),
      });
      if (!fallbackResponse.ok) {
        const err = await fallbackResponse.text();
        console.error('[searchNearby fallback] Places API error:', fallbackResponse.status, err);
        return res.status(fallbackResponse.status).json({ error: err || 'Places API error' });
      }
      data = (await fallbackResponse.json()) as { places?: Array<Record<string, unknown>> };
    }
  } else {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        includedTypes: [
          'amusement_park',
          'aquarium',
          'art_gallery',
          'bakery',
          'bar',
          'beach',
          'beauty_salon',
          'bowling_alley',
          'cafe',
          'casino',
          'church',
          'garden',
          'golf_course',
          'gym',
          'hotel',
          'ice_cream_shop',
          'lake',
          'library',
          'movie_theater',
          'museum',
          'park',
          'restaurant',
          'shopping_mall',
          'spa',
          'stadium',
          'tourist_attraction',
          'zoo',
        ],
        maxResultCount: 20,
        locationRestriction: { circle },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[searchNearby] Places API error:', response.status, err);
      return res.status(response.status).json({ error: err || 'Places API error' });
    }
    data = (await response.json()) as { places?: Array<Record<string, unknown>> };
  }

  const rawPlaces = (data.places ?? []) as Array<Record<string, unknown>>;

  const places = rawPlaces.map((p) => {
    const id = (p.id as string) ?? '';
    const displayName = p.displayName as { text?: string } | undefined;
    const name = displayName?.text ?? '';
    const location = p.location as { latitude?: number; longitude?: number } | undefined;
    const latVal = location?.latitude ?? 0;
    const lngVal = location?.longitude ?? 0;
    const rating = p.rating as number | undefined;
    const userRatingCount = p.userRatingCount as number | undefined;
    const priceLevel = p.priceLevel as number | undefined;
    const types = (p.types as string[]) ?? [];
    const address = (p.formattedAddress as string) ?? undefined;
    const photos = (p.photos as { name?: string }[]) ?? [];
    const photoRef = photos[0]?.name;

    const regularOpeningHours = p.regularOpeningHours as any;
    const reservable = p.reservable as boolean | undefined;
    const goodForChildren = p.goodForChildren as boolean | undefined;
    const goodForGroups = p.goodForGroups as boolean | undefined;
    const servesVegetarianFood = p.servesVegetarianFood as boolean | undefined;
    const servesBreakfast = p.servesBreakfast as boolean | undefined;
    const servesBrunch = p.servesBrunch as boolean | undefined;
    const servesLunch = p.servesLunch as boolean | undefined;
    const servesDinner = p.servesDinner as boolean | undefined;
    const outdoorSeating = p.outdoorSeating as boolean | undefined;

    return {
      id,
      name,
      lat: latVal,
      lng: lngVal,
      ...(rating != null && { rating }),
      ...(userRatingCount != null && { userRatingCount }),
      ...(priceLevel != null && { priceLevel }),
      ...(types.length > 0 && { types }),
      ...(address && { address }),
      ...(photoRef && { photoUrl: photoRef }),
      ...(regularOpeningHours && { regularOpeningHours }),
      ...(reservable != null && { reservable }),
      ...(goodForChildren != null && { goodForChildren }),
      ...(goodForGroups != null && { goodForGroups }),
      ...(servesVegetarianFood != null && { servesVegetarianFood }),
      ...(servesBreakfast != null && { servesBreakfast }),
      ...(servesBrunch != null && { servesBrunch }),
      ...(servesLunch != null && { servesLunch }),
      ...(servesDinner != null && { servesDinner }),
      ...(outdoorSeating != null && { outdoorSeating }),
    };
  });

  const result = { places };
  cache.set(cacheKey, result);
  res.json(result);
});

app.get('/api/places/details/:placeId', async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: 'placeId is required' });
  if (!API_KEY) return res.status(500).json({ error: 'API_KEY not configured' });

  const cacheKey = `details:${placeId}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const headers = {
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': PLACE_DETAILS_FIELDS,
  };

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, { headers });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err || 'Places API error' });
    }
    const data = await response.json();
    cache.set(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error('[details] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/places/photo/:photoName(*)', async (req, res) => {
  const photoName = req.params.photoName;
  const maxWidth = req.query.maxHeightPx || 800;
  const maxHeight = req.query.maxWidthPx || 800;

  if (!photoName) return res.status(400).send('Photo name required');
  if (!API_KEY) return res.status(500).send('API_KEY not configured');

  const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${API_KEY}&maxHeightPx=${maxHeight}&maxWidthPx=${maxWidth}`;

  try {
    const response = await fetch(photoUrl);
    if (!response.ok) return res.status(response.status).send('Place photo error');

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // Stream the binary data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('[photo] Error:', error);
    res.status(500).send('Internal server error');
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    `GOOGLE_PLACES_API_KEY: ${API_KEY ? `loaded (${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)})` : 'NOT LOADED'}`
  );
});
