# Maptivity.ai (v0)

Maptivity.ai is a map-first activity discovery tool.  
Users search a location, draw a custom region on the map, and get the best activities inside that region.

This repository contains the **v0 MVP**, focused on proving the core idea.

## What This Version Does
- Search for a location and move the map to it
- Draw a custom region (polygon) on the map
- Find recommended activities inside the drawn region
- Display results as map pins and a ranked list

## What This Version Does Not Do
- No itinerary generation
- No bookings or tickets
- No accounts or authentication
- No reviews or social features

## Core Idea
Instead of browsing endless lists, users define **where they are willing to go** directly on the map and see what’s worth doing there.

## How Recommendations Work
Activities are ranked using a deterministic algorithm:
- Only activities inside the drawn region are considered
- Activities are scored by popularity and relevance
- Top activities are returned and displayed

LLMs are not used to decide recommendations in v0.

## Tech Stack
**Frontend**
- Next.js + TypeScript
- Mapbox GL JS + Mapbox Draw
- Tailwind CSS

**Backend**
- FastAPI or Node.js
- External Places/POI API (single provider)

## Status
Early MVP — under active development.


### Prereqs
- Node.js (recommended: v18+)
- npm (comes with Node)

# Maptivity.ai (v0)

Maptivity.ai is a map-first activity discovery tool.  
Users search a location, draw a custom region on the map, and get the best activities inside that region.

This repository contains the **v0 MVP**, focused on proving the core idea.

## What This Version Does
- Search for a location and move the map to it
- Draw a custom region (polygon) on the map
- Find recommended activities inside the drawn region
- Display results as map pins and a ranked list

## What This Version Does Not Do
- No itinerary generation
- No bookings or tickets
- No accounts or authentication
- No reviews or social features

## Core Idea
Instead of browsing endless lists, users define **where they are willing to go** directly on the map and see what’s worth doing there.

## How Recommendations Work
Activities are ranked using a deterministic algorithm:
- Only activities inside the drawn region are considered
- Activities are scored by popularity and relevance
- Top activities are returned and displayed

LLMs are not used to decide recommendations in v0.

## Tech Stack
**Frontend**
- Next.js + TypeScript
- Mapbox GL JS + Mapbox Draw
- Tailwind CSS

**Backend**
- FastAPI or Node.js
- External Places/POI API (single provider)

## Status
Early MVP — under active development.


### Prereqs
- Node.js (recommended: v18+)
- npm (comes with Node)

## Setup

```bash
### 1. Clone the repo:
git clone <REPO_URL>
cd MaptivityAI

### 2. Install dependencies
npm install

--- For Local Development ---
### 3. Google Maps Setup

This project requires a Google Maps API key with the following APIs enabled:
- Maps JavaScript API
- Places API (New)
- Optional: Geocoding API (used as fallback)

Create `.env` file in project root and add:
```
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 4. Unsplash API Setup

The app fetches location images from Unsplash. The API key is embedded in the code but should be moved to environment variables for security:

1. Get free API key at https://unsplash.com/developers
2. Update `services/unsplashService.ts` to use environment variable:
```
const UNSPLASH_API_KEY = import.meta.env.VITE_UNSPLASH_API_KEY;
```
3. Add to `.env`:
```
VITE_UNSPLASH_API_KEY=your_unsplash_api_key_here
```

### 5. Start App
npm run dev
