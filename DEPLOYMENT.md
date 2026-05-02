# Deployment

This repo is now ready for a simple MVP deployment as one Node service:

- Vite builds the React app into `dist/`
- the Express server builds into `server/dist/`
- Express serves API routes under `/api/*`
- Express serves the Vite app from `dist/` for all non-API routes

## Production Build

From the repo root:

```bash
npm install
npm run build
cd server
npm install
npm run build
npm start
```

The app will bind to `PORT` in production, or `5050` locally.

## Required Environment Variables

Frontend build:

```bash
VITE_GOOGLE_MAPS_API_KEY=AIza...your_browser_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Server runtime:

```bash
GOOGLE_PLACES_API_KEY=AIza...your_server_key_here
PORT=5050
TRUST_PROXY=true
```

Optional:

```bash
VITE_UNSPLASH_API_KEY=your_unsplash_api_key_here
ALLOWED_ORIGINS=https://your-frontend-domain.com
VITE_API_BASE_URL=https://your-api-domain.com
OLLAMA_BASE_URL=http://your-ollama-host:11434
OLLAMA_MODEL=llama3:latest
```

Use `VITE_API_BASE_URL` only if the frontend and server are deployed separately. If Express hosts the built frontend, leave it blank so the browser calls same-origin `/api/*`.

## API Key Restrictions

Use two separate Google API keys for production:

Frontend browser key:

- Application restriction: HTTP referrers
- Allowed referrers: `https://your-domain.com/*` and `https://www.your-domain.com/*`
- API restrictions: Maps JavaScript API and Places API only if browser autocomplete needs it
- Do not put unrestricted server APIs on this key

Backend server key:

- Application restriction: IP addresses if your host provides stable outbound IPs
- If stable outbound IPs are not available, keep API restrictions tight and set budget/quota alerts
- API restrictions: Places API (New) only
- Store only as `GOOGLE_PLACES_API_KEY` on the server

Supabase:

- The anon key is public by design, but Row Level Security must be enabled on any tables that store user data.
- Add only production URLs to Auth redirect URLs and Site URL.
- Never ship a Supabase service-role key to the frontend.

Unsplash:

- `VITE_UNSPLASH_API_KEY` is public in the browser. Restrict allowed domains in the provider dashboard if available and monitor usage.

## Rate Limits

The Express server has in-memory per-IP rate limits:

```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
PLACES_RATE_LIMIT_WINDOW_MS=60000
PLACES_RATE_LIMIT_MAX_REQUESTS=60
PHOTO_RATE_LIMIT_WINDOW_MS=60000
PHOTO_RATE_LIMIT_MAX_REQUESTS=120
PLANNER_RATE_LIMIT_WINDOW_MS=60000
PLANNER_RATE_LIMIT_MAX_REQUESTS=10
```

These are good MVP defaults. For multi-instance production, move rate limiting to the host/CDN/WAF or a shared Redis-backed limiter so limits work across all server instances.

## Security Notes

Current hardening:

- Google Places calls are proxied through the backend for search, details, and photos.
- Backend endpoints are rate-limited.
- Request JSON body size is capped.
- CORS can be locked to `ALLOWED_ORIGINS`.
- Basic browser security headers are set.
- API keys are excluded from git through `.gitignore`.

Remaining launch items:

- Rotate any keys that were ever pasted into chat, committed, or shared publicly.
- Use separate dev and production keys.
- Enable Google Cloud budget alerts and API quotas.
- Turn on Supabase Row Level Security before storing user-owned favorites/plans in the database.
- Decide whether generated itinerary should launch. It depends on an Ollama-compatible server and has a stricter rate limit by default.

## MVP Deploy Checklist

- Create production Google API keys and restrict them by domain or server IP.
- Enable Maps JavaScript API and Places API (New) in Google Cloud.
- Add deployed app domains to Supabase auth redirect URLs.
- Confirm `/api/health` returns `{ "ok": true }` after deploy.
- Smoke test location search, map rendering, activity search, details photos, auth, favorites, and planner flows.
- Decide whether generated itinerary is part of launch. It currently depends on an Ollama-compatible service reachable from the server.

## Single-Service Host Settings

For hosts that ask for commands:

Build command:

```bash
npm install && npm run build && cd server && npm install && npm run build
```

Start command:

```bash
cd server && npm start
```
