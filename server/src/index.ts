import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5050;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIELDS =
  'places.id,places.displayName,places.location,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.priceLevel,places.photos';

const GENERIC_QUERIES = ['things to do', 'fun things to do', ''];

function isGenericQuery(q: string): boolean {
  const normalized = q.trim().toLowerCase();
  return GENERIC_QUERIES.includes(normalized) || ['things to do', 'fun things to do'].some((g) => normalized === g);
}

app.use(cors({ origin: 'http://localhost:3000' }));
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

  let data: { places?: unknown[] };

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
      return res.status(response.status).json({ error: err || 'Places API error' });
    }
    data = (await response.json()) as { places?: unknown[] };
  } else {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationRestriction: { circle },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err || 'Places API error' });
    }
    data = (await response.json()) as { places?: unknown[] };
  }

  const rawPlaces = data.places ?? [];

  const places = rawPlaces.map((p: Record<string, unknown>) => {
    const id = (p.id as string) ?? '';
    const displayName = p.displayName as { text?: string } | undefined;
    const name = displayName?.text ?? '';
    const location = p.location as { latitude?: number; longitude?: number } | undefined;
    const lat = location?.latitude ?? 0;
    const lng = location?.longitude ?? 0;
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
      lat,
      lng,
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
});
