# Maptivity.ai (v0)

Maptivity.ai is a map-first activity discovery tool.
Users search a location, define a circular region on the map,
and get recommended activities inside that region.

This repository contains the v0 MVP, focused on proving the core idea
with a working full-stack implementation.

------------------------------------------------------------
WHAT THIS VERSION DOES
------------------------------------------------------------
- Search for a city or location using Google Places Autocomplete
- Move the map to the selected location
- Define a circular search region
- Fetch real places data from Google Places API (New)
- Display activities as map pins and a sidebar list

------------------------------------------------------------
WHAT THIS VERSION DOES NOT DO
------------------------------------------------------------
- No itinerary generation
- No bookings or ticket integrations
- No accounts or authentication
- No reviews or social features
- No AI-based ranking (yet)

------------------------------------------------------------
CORE IDEA
------------------------------------------------------------
Instead of browsing endless lists, users define where they are
willing to go directly on the map and see what’s worth doing there.

The map is the primary interface — not a search results page.

------------------------------------------------------------
HOW RECOMMENDATIONS WORK (v0)
------------------------------------------------------------
- Only places inside the defined circular region are queried
- A fixed set of supported activity types is used
- Results are normalized and displayed
- No ML or LLM ranking is used in v0

------------------------------------------------------------
TECH STACK
------------------------------------------------------------

Frontend:
- React + TypeScript
- Vite
- Google Maps JavaScript API
- Tailwind CSS

Backend:
- Node.js
- Express
- Google Places API (New)

------------------------------------------------------------
PREREQUISITES
------------------------------------------------------------
- Node.js (recommended v18+)
- npm
- A Google Cloud project with billing enabled

------------------------------------------------------------
SETUP
------------------------------------------------------------

1) Clone the repo

git clone <REPO_URL>
cd MaptivityAI

2) Install frontend dependencies

npm install
npm run dev:all

------------------------------------------------------------
GOOGLE API SETUP (REQUIRED)
------------------------------------------------------------

1) FRONTEND KEY (Browser Key)

Used for:
- Google Maps feature
- Search Location autocomplete

Steps:
1. Go to Google Cloud Console
2. APIs & Services -> Credentials
3. Create Credentials -> API Key
4. Rename to: Maptivity_Frontend_Key

Application restrictions:
- For local development: Select "None"
- For production: Select "IP addresses" and add your server IP

API restrictions (enable these):
- Maps JavaScript API
- Places API (New)

Add to root .env file in project root:

.env

Add:
VITE_GOOGLE_MAPS_API_KEY=YOUR_FRONTEND_KEY

------------------------------------------------------------
1b) Optional Unsplash KEY (for location search images)
------------------------------------------------------------

a. Get free API key at https://unsplash.com/developers

b. Add to `.env`:
```
VITE_UNSPLASH_API_KEY=your_unsplash_api_key_here
```

- The app now can fetch location images from Unsplash


------------------------------------------------------------
2) BACKEND SETUP (Optional - use same Places API key)
------------------------------------------------------------

The backend uses the SAME Places API (New) key as the frontend.
You can reuse VITE_GOOGLE_MAPS_API_KEY for the backend.

Why reuse the same key?
- Simpler setup (one key instead of two)
- Both frontend and backend use Places API (New) via different methods
  * Frontend: JavaScript SDK (browser)
  * Backend: HTTP REST API (server)
- Easier to manage quotas and billing

OPTION A: Use the same key (recommended for MVP)
----

Create:
server/.env

Add:
VITE_GOOGLE_MAPS_API_KEY=YOUR_FRONTEND_KEY
PORT=5050

Note: Copy the same key value from your root .env file


OPTION B: Create a separate backend key (advanced)
----

If you want separate keys for monitoring/security:

Steps:
1. Go to Google Cloud Console
2. APIs & Services -> Credentials
3. Create Credentials -> API Key
4. Rename to: Maptivity_Backend_Key

Application restrictions:
For local development: Select "None"
For production: Select "IP addresses" and add your server IP

API restrictions:
Restrict key to:
- Places API (New)

Create:
server/.env

Add:
VITE_GOOGLE_MAPS_API_KEY=YOUR_BACKEND_KEY
PORT=5050

------------------------------------------------------------
BILLING
------------------------------------------------------------
Google Places API requires billing enabled.

In Google Cloud Console:
- Ensure project is linked to active billing account
- Ensure Places API (New) is enabled

------------------------------------------------------------
RUN LOCALLY
------------------------------------------------------------

From project root:

npm run dev:all

This starts:
Frontend: http://localhost:3000
Backend:  http://localhost:5050

------------------------------------------------------------
TROUBLESHOOTING
------------------------------------------------------------

API_KEY_INVALID:
- Confirm backend key is inside server/.env
- Confirm it starts with AIza
- Confirm Places API (New) is enabled
- Restart server after changes

Port 5050 already in use:
taskkill /F /IM node.exe
Then restart:
npm run dev:all

------------------------------------------------------------
STATUS
------------------------------------------------------------
Working full-stack MVP.
Backend integrated.
Under active development.

------------------------------------------------------------
ROADMAP
------------------------------------------------------------
- Deterministic ranking algorithm
- Polygon-based filtering
- Advanced map markers
- Caching layer
- Deployment
