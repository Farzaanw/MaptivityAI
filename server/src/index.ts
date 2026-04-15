import { fileURLToPath } from 'node:url';
import { extractJsonFromLLM } from './utils/extractJsonFromLLM.js';
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
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
// const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
// const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3:latest';
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
  'id,displayName,formattedAddress,location,types,photos,rating,userRatingCount,priceLevel,websiteUri,internationalPhoneNumber,regularOpeningHours,editorialSummary,reviews,googleMapsUri,googleMapsLinks,reservable,goodForChildren,goodForGroups,servesVegetarianFood,servesBreakfast,servesBrunch,servesLunch,servesDinner,outdoorSeating';



const GENERIC_QUERIES = ['things to do', 'fun things to do', ''];

const NEARBY_TYPE_BUCKETS: string[][] = [
  ['restaurant', 'cafe', 'bar', 'bakery', 'ice_cream_shop'],
  ['museum', 'art_gallery', 'tourist_attraction', 'zoo', 'aquarium', 'marina'],
  ['park', 'beach', 'garden', 'lake', 'golf_course', 'hiking_area'],
  ['movie_theater', 'stadium', 'shopping_mall', 'casino', 'bowling_alley', 'spa', 'gym'],
];

const MAX_MERGED_RESULTS = 80;

const EXCLUDED_PLACE_TYPES = new Set([
  'supermarket',
  'grocery_store',
  'convenience_store',
  'warehouse_store',
]);

const EXCLUDED_SUPERMARKET_NAME_TERMS = [
  'safeway',
  'fred meyer',
  'kroger',
  'albertsons',
  'whole foods',
  'trader joe',
  'costco',
  'walmart',
  'target',
  'winco',
  'qfc',
  'grocery outlet',
];

function isGenericQuery(q: string): boolean {
  const normalized = q.trim().toLowerCase();
  return GENERIC_QUERIES.includes(normalized) || ['things to do', 'fun things to do'].some((g) => normalized === g);
}

function mapPriceLevel(level: any): number | undefined {
  if (typeof level === 'number') return level;
  if (typeof level !== 'string') return undefined;

  const map: Record<string, number> = {
    'PRICE_LEVEL_FREE': 0,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4
  };

  return map[level];
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

function isRelevant(p: any, q: string): boolean {
  const query = q.toLowerCase().trim();
  if (!query || isGenericQuery(query)) return true;

  const name = (p.displayName?.text || '').toLowerCase();
  const address = (p.formattedAddress || '').toLowerCase();
  const types = (p.types as string[]) ?? [];
  const normalizedTypes = types.map((t) => t.toLowerCase().replace(/_/g, ' '));

  // 1. Direct match in name, address or types
  if (name.includes(query) || address.includes(query) || normalizedTypes.some((t) => t.includes(query))) {
    return true;
  }

  // 2. Individual word matching for multi-word queries
  const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
  const nameOrTypeMatch = queryWords.some(
    (w) => name.includes(w) || normalizedTypes.some((t) => t.includes(w))
  );

  if (nameOrTypeMatch) {
    // 3. Loose category protection: if it's a generic store/POI, insist on a name match
    const looseCategories = ['book_store', 'store', 'establishment', 'point_of_interest', 'library', 'school'];
    const isLoose = types.some((t) => looseCategories.includes(t));

    if (isLoose) {
      // If it's a loose category, require that at least one query word is actually in the name
      return queryWords.some((w) => name.includes(w));
    }
    return true;
  }

  return false;
}

function isExcludedSupermarketLikePlace(place: Record<string, unknown>): boolean {
  const types = ((place.types as string[]) ?? []).map((t) => t.toLowerCase());
  if (types.some((t) => EXCLUDED_PLACE_TYPES.has(t))) {
    return true;
  }

  const name = ((place.displayName as { text?: string } | undefined)?.text ?? '').toLowerCase();
  return EXCLUDED_SUPERMARKET_NAME_TERMS.some((term) => name.includes(term));
}

function inferPriceLevel(name: string, description: string = '', types: string[] = []): number | undefined {
  const n = name.toLowerCase();
  const d = description.toLowerCase();
  const t = types.map((x) => x.toLowerCase());
  const combined = `${n} ${d}`;

  // 1. Keyword Overrides (Luxury / High-end) - General
  const luxuryKeywords = [
    'four seasons', 'ritz', 'st. regis', 'waldorf', 'aman', 'luxury', 'premium', 'royal',
    'grand', 'exclusive', 'boutique', 'private', 'estate', 'fine dining', 'steakhouse',
    'yacht', 'country club', 'resort & spa', 'marina', 'chic', 'high-end', 'upscale',
    'elegant', 'sophisticated'
  ];
  if (luxuryKeywords.some(kw => combined.includes(kw))) return 4;

  // 2. Keyword Overrides (Budget / Low-end) - General
  const budgetKeywords = [
    'hostel', 'motel', 'super 8', 'travelodge', 'days inn', 'backpackers', 'budget',
    'cheap', 'discount', 'dollar', 'outlet', 'wholesale', 'thrift', 'flea market',
    'fast food', 'drive-thru', 'takeaway', 'expresso', 'diner', 'economy', 'affordable',
    'low-cost'
  ];
  if (budgetKeywords.some(kw => combined.includes(kw))) return 1;

  // 3. Type Fallbacks
  // 4: Very Expensive
  if (t.some(x => ['resort', 'casino', 'spa', 'night_club', 'stadium'].includes(x))) return 4;

  // 3: Expensive
  if (t.some(x => ['amusement_park', 'convention_center', 'department_store', 'jewelry_store'].includes(x))) return 3;

  // 2: Moderate
  if (t.some(x => [
    'hotel', 'lodging', 'restaurant', 'bar', 'aquarium', 'zoo', 'shopping_mall',
    'movie_theater', 'fitness_center', 'clothing_store', 'electronics_store'
  ].includes(x))) return 2;

  // 1: Inexpensive
  if (t.some(x => [
    'cafe', 'bakery', 'museum', 'art_gallery', 'tourist_attraction', 'library',
    'book_store', 'pharmacy', 'supermarket', 'convenience_store'
  ].includes(x))) return 1;

  // 0: Free / Very Low
  if (t.some(x => [
    'park', 'garden', 'beach', 'church', 'landmark', 'natural_feature',
    'hiking_area', 'playground', 'community_center'
  ].includes(x))) return 0;

  return undefined;
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

async function fetchNearbyPlaces(params: {
  headers: Record<string, string>;
  circle: { center: { latitude: number; longitude: number }; radius: number };
  includedTypes: string[];
}): Promise<Array<Record<string, unknown>>> {
  const { headers, circle, includedTypes } = params;
  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      includedTypes,
      maxResultCount: 20,
      locationRestriction: { circle },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[searchNearby] Places API error:', response.status, err);
    throw new Error(err || 'Places API error');
  }

  const data = (await response.json()) as { places?: Array<Record<string, unknown>> };
  return data.places ?? [];
}

interface PlannerActivity {
  name: string;
  time: string;
  location: string;
  description: string;
}

interface PlannerPlan {
  id: string;
  title: string;
  summary: string;
  days: number;
  activities: PlannerActivity[];
}

interface PlannerResponse {
  plans: PlannerPlan[];
}

interface PlannerMarkerLookup {
  id: string;
  name: string;
  locationQuery: string;
}

interface PlannerMarkerResult {
  id: string;
  lat: number | null;
  lng: number | null;
}

const plannerJsonSchema = {
  type: 'object',
  required: ['plans'],
  properties: {
    plans: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        required: ['id', 'title', 'summary', 'days', 'activities'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          days: { type: 'integer', minimum: 1 },
          activities: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['name', 'time', 'location', 'description'],
              properties: {
                name: { type: 'string' },
                time: { type: 'string' },
                location: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

function isPlannerActivity(value: unknown): value is PlannerActivity {
  if (!value || typeof value !== 'object') return false;
  const activity = value as Record<string, unknown>;
  return typeof activity.name === 'string'
    && typeof activity.time === 'string'
    && typeof activity.location === 'string'
    && typeof activity.description === 'string';
}

function isPlannerPlan(value: unknown): value is PlannerPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;
  return typeof plan.id === 'string'
    && typeof plan.title === 'string'
    && typeof plan.summary === 'string'
    && typeof plan.days === 'number'
    && Number.isFinite(plan.days)
    && plan.days >= 1
    && Array.isArray(plan.activities)
    && plan.activities.every(isPlannerActivity);
}

function safeParsePlannerResponse(raw: string): PlannerResponse | null {
  try {
    const parsed = JSON.parse(extractJsonBlock(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const plans = (parsed as { plans?: unknown }).plans;
    if (
      Array.isArray(plans)
      && plans.length === 3
      && plans.every(isPlannerPlan)
    ) {
      return parsed as PlannerResponse;
    }
    return null;
  } catch {
    return null;
  }
}

function isPlannerMarkerLookup(value: unknown): value is PlannerMarkerLookup {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Record<string, unknown>;
  return typeof marker.id === 'string'
    && typeof marker.name === 'string'
    && typeof marker.locationQuery === 'string';
}

async function searchPlannerMarker(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) {
    return null;
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.location',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[planner-markers] Places text search failed:', response.status, errorText);
    return null;
  }

  const data = await response.json() as {
    places?: Array<{
      location?: {
        latitude?: number;
        longitude?: number;
      };
    }>;
  };

  const location = data.places?.[0]?.location;
  if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
    return null;
  }

  return {
    lat: location.latitude,
    lng: location.longitude,
  };
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

app.post('/api/planner/itinerary', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'Trip description is required.' });
  }

  const systemPrompt = [
    'You are a trip planner.',
    'Respond with a single JSON object: { "plans": [ ... ] }.',
    'The "plans" array must have exactly 3 options. Each plan: id, title, summary, days (number), activities (flat array, not grouped by day).',
    'Each activity: name, time, location, description. No prose or extra text, only valid JSON.',
    'Keep titles and summaries short, times readable (e.g. "Day 1 - Morning").',
    'Be concise and realistic.'
  ].join(' ');

  try {
    // -- PREV LOCAL LLAMA MODEL SET UP COMMENTED OUT
    // const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    console.log("OpenRouter key exists?", !!OPENROUTER_MODEL);
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        "model": OPENROUTER_MODEL,
        "messages": [
          { "role": "system", "content": systemPrompt },
          { "role": "user", "content": prompt }
        ],
        "stream": false,
        "temperature": 0.7
        // // model: OLLAMA_MODEL,
        // format: plannerJsonSchema,
        // messages: [
        //   { role: 'system', content: systemPrompt },
        //   { role: 'user', content: prompt },
        // ],
        // stream: false,

        // options: {
        //   temperature: 0.7,
        // },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('[planner] Ollama error:', response.status, errorText);
      console.error('[planner] OpenRouter error:', response.status, errorText); 
      return res.status(502).json({
        // error: 'Unable to reach the local LLaMA model. Make sure Ollama is running and the model is installed.',
        error: 'Unable to reach the OpenRouter API. Check your network connection and API key.',
      });
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
    };
    // const rawContent = data.message?.content?.trim();
    const rawContent = data.choices?.[0]?.message?.content?.trim();
    console.log('[planner] Raw LLM response:', rawContent);

    if (!rawContent) {
      return res.status(502).json({ error: 'The local LLaMA model returned an empty itinerary.' });
    }

    let parsed = extractJsonFromLLM(rawContent);

    // If invalid, try fallback: look for 2 plans instead of 3
    if (!parsed || !Array.isArray(parsed.plans) || parsed.plans.length !== 3) {
      // Try to extract 2 plans if possible
      try {
        const jsonBlock = rawContent.match(/\{[\s\S]*\}/)?.[0];
        if (jsonBlock) {
          const fallback = JSON.parse(jsonBlock);
          if (Array.isArray(fallback.plans) && fallback.plans.length === 2) {
            parsed = fallback;
          }
        }
      } catch {}
    }

    if (!parsed || !Array.isArray(parsed.plans) || (parsed.plans.length !== 3 && parsed.plans.length !== 2)) {
      console.error('[planner] Invalid or incomplete planner JSON:', rawContent);
      return res.status(502).json({
        error: 'The LLM returned invalid or incomplete planner JSON.',
      });
    }

    res.json(parsed);
  } catch (error) {
    console.error('[planner] Error generating itinerary:', error);
    res.status(500).json({
      error: 'Unable to generate an itinerary right now. Make sure your local LLaMA server is running.',
    });
  }
});

app.post('/api/planner/markers', async (req, res) => {
  const activities = req.body?.activities;

  if (!Array.isArray(activities) || !activities.every(isPlannerMarkerLookup)) {
    return res.status(400).json({ error: 'Planner marker requests must include id, name, and locationQuery.' });
  }

  try {
    const markers = await Promise.all(
      activities.map(async (activity): Promise<PlannerMarkerResult> => {
        const combinedQuery = [activity.name, activity.locationQuery]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(', ');

        const coordinates =
          await searchPlannerMarker(combinedQuery)
          ?? await searchPlannerMarker(activity.locationQuery.trim())
          ?? await searchPlannerMarker(activity.name.trim());

        return {
          id: activity.id,
          lat: coordinates?.lat ?? null,
          lng: coordinates?.lng ?? null,
        };
      }),
    );

    res.json({ markers });
  } catch (error) {
    console.error('[planner-markers] Error resolving markers:', error);
    res.status(500).json({ error: 'Unable to resolve planner markers right now.' });
  }
});

app.post('/api/planner/discover', async (req, res) => {
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const radiusMeters = Math.min(Math.max(Number(req.body?.radiusMeters) || 6000, 1000), 15000);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'A valid latitude is required.' });
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'A valid longitude is required.' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'Google Places API key is not configured.' });
  }

  const cacheKey = `planner-discover:${lat}:${lng}:${radiusMeters}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.json(cachedResult);
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELDS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includedTypes: [
          'tourist_attraction',
          'restaurant',
          'park',
          'museum',
          'night_club',
          'bar',
          'art_gallery',
          'cafe',
        ],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[planner-discover] Places API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Unable to retrieve planner activities.' });
    }

    const data = await response.json() as { places?: Array<Record<string, unknown>> };
    const places = (data.places ?? [])
      .map((place) => {
        const id = (place.id as string) ?? '';
        const displayName = place.displayName as { text?: string } | undefined;
        const location = place.location as { latitude?: number; longitude?: number } | undefined;
        const formattedAddress = (place.formattedAddress as string) ?? '';
        const rating = place.rating as number | undefined;
        const photos = (place.photos as { name?: string }[]) ?? [];
        const photoName = photos[0]?.name;

        if (
          !id
          || !displayName?.text
          || typeof location?.latitude !== 'number'
          || typeof location?.longitude !== 'number'
        ) {
          return null;
        }

        return {
          id,
          placeId: id,
          name: displayName.text,
          address: formattedAddress,
          rating,
          lat: location.latitude,
          lng: location.longitude,
          ...(photoName ? { photoUrl: `/api/places/photo/${photoName}` } : {}),
        };
      })
      .filter((place): place is NonNullable<typeof place> => Boolean(place));

    const deduplicatedPlaces = Array.from(new Map(places.map((place) => [place.id, place])).values());
    const result = { activities: deduplicatedPlaces };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('[planner-discover] Error:', error);
    res.status(500).json({ error: 'Unable to retrieve planner activities right now.' });
  }
});

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

    // Filter out pure administrative areas and check for keyword relevance
    const filtered = withinCircle.filter((p) => {
      // 1. Check relevance
      if (!isRelevant(p, q)) return false;

      // 2. Filter out administrative areas
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
  } else {
    try {
      const bucketResults = await Promise.all(
        NEARBY_TYPE_BUCKETS.map((includedTypes) =>
          fetchNearbyPlaces({ headers, circle, includedTypes })
        )
      );

      const merged: Array<Record<string, unknown>> = [];
      const seenIds = new Set<string>();

      for (const places of bucketResults) {
        for (const place of places) {
          const id = (place.id as string) ?? '';
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);
          merged.push(place);
          if (merged.length >= MAX_MERGED_RESULTS) break;
        }
        if (merged.length >= MAX_MERGED_RESULTS) break;
      }

      data = { places: merged };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Places API error';
      return res.status(502).json({ error: message });
    }
  }

  const rawPlaces = (data.places ?? []) as Array<Record<string, unknown>>;
  const filteredRawPlaces = rawPlaces.filter((p) => !isExcludedSupermarketLikePlace(p));

  const places = filteredRawPlaces.map((p) => {
    const id = (p.id as string) ?? '';
    const displayName = p.displayName as { text?: string } | undefined;
    const name = displayName?.text ?? '';
    const location = p.location as { latitude?: number; longitude?: number } | undefined;
    const latVal = location?.latitude ?? 0;
    const lngVal = location?.longitude ?? 0;
    const rating = p.rating as number | undefined;
    const userRatingCount = p.userRatingCount as number | undefined;
    const types = (p.types as string[]) ?? [];
    const address = (p.formattedAddress as string) ?? undefined;
    const photos = (p.photos as { name?: string }[]) ?? [];
    const photoRef = photos[0]?.name;

    const editorialSummary = p.editorialSummary as { text?: string } | undefined;
    const summaryText = editorialSummary?.text ?? '';

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

    let priceLevel = mapPriceLevel(p.priceLevel);

    // Fallback: Infer price if missing
    if (priceLevel === undefined) {
      priceLevel = inferPriceLevel(name, summaryText, types);
    }
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
