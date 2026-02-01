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

### Setup
1. Clone the repo:
```
git clone <REPO_URL>
cd MaptivityAI

npm install
- Optional (not necessary for development): Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
npm run dev
