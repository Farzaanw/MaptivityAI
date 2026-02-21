import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const PORT = 5050;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

console.log('[startup] CWD:', process.cwd());
console.log('[startup] Resolved .env path:', envPath);
console.log('[startup] .env file exists:', fs.existsSync(envPath) ? 'yes' : 'NO');
console.log('[startup] GOOGLE_PLACES_API_KEY prefix:', API_KEY ? `${API_KEY.slice(0, 6)}…` : 'NOT SET');

if (
  !API_KEY ||
  API_KEY.toLowerCase().startsWith('your_') ||
  !API_KEY.startsWith('AIza')
) {
  console.error('\n[FATAL] GOOGLE_PLACES_API_KEY is missing or invalid.');
  console.error('Add your real API key to server/.env (not .env.example):');
  console.error('  GOOGLE_PLACES_API_KEY=AIza...your_key_here\n');
  process.exit(1);
}

const app = express();
const FIELDS =
  'places.id,places.displayName,places.location,places.formattedAddress,places.types,places.photos';

const GENERIC_QUERIES = ['things to do', 'fun things to do', ''];

function isGenericQuery(q: string): boolean {
  const normalized = q.trim().toLowerCase();
  return GENERIC_QUERIES.includes(normalized) || ['things to do', 'fun things to do'].some((g) => normalized === g);
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

  const center = { latitude: lat, longitude: lng };
  const circle = { center, radius };
  const headers = {
    'X-Goog-Api-Key': API_KEY,
    'X-Goog-FieldMask': FIELDS,
    'Content-Type': 'application/json',
  };

  let data: { places?: Array<Record<string, unknown>> };

  if (q && !isGenericQuery(q)) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        textQuery: q,
        locationBias: { circle },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('[searchText] Places API error:', response.status, err);
      return res.status(response.status).json({ error: err || 'Places API error' });
    }
    data = (await response.json()) as { places?: Array<Record<string, unknown>> };
  } else {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        includedTypes: [
          'tourist_attraction',
          'museum',
          'park',
          'art_gallery',
          'amusement_park',
          'zoo',
          'aquarium',
          'movie_theater',
          'shopping_mall',
          'restaurant',
          'cafe',
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
    };
  });

  res.json({ places });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(
    `GOOGLE_PLACES_API_KEY: ${API_KEY ? `loaded (${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)})` : 'NOT LOADED'}`
  );
});
