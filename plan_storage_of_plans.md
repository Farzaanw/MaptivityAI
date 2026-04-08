# Planner Draft Persistence: Implementation Plan

## Goal
Persist plans created in both planner modes so users do not lose work when they leave the Planner page and return.

This should work for:
- authenticated users under their current account
- guest users in the current browser/session context

Core requirement:
- If a user leaves the planner page and comes back, the current planner state should still be there
- In manual mode, dragged activities must remain in their assigned days
- In generated mode, generated options and selected plan state must remain intact

## Recommended storage strategy
Use a **hybrid persistence model**:

- Authenticated users:
  - persist planner drafts to **Supabase**
  - associate drafts with the current `user_id`
- Guest users:
  - persist planner drafts in **localStorage**
  - use a stable guest draft key in the browser

Also keep:
- in-memory React state for immediate UI updates

Why this is the best fit:
- logged-in users keep plans tied to their account
- guests still get reliable draft persistence without needing auth
- navigation between planner subpages does not wipe draft state
- local UX stays fast even while network saves happen in the background

## High-level architecture

### 1) Shared planner draft state
Move planner mode state out of page-local component state and into a shared planner draft layer.

Recommended location:
- parent state in `components/PlannerPage.tsx`
- or a dedicated planner draft service/store

Reason:
- `GeneratePlannerPage` and `ManualPlannerPage` currently own important state locally
- when those components unmount, draft state is lost
- lifting state makes navigation persistence possible even before durable storage kicks in

### 2) Durable persistence layer
Persist the shared planner draft to:
- Supabase for signed-in users
- localStorage for guests

### 3) Hydration on load
When the planner opens:
- check whether a signed-in user exists
- load their latest planner draft from Supabase if available
- otherwise load guest planner draft from localStorage if available
- hydrate the shared planner state before rendering the planner mode pages

## What to persist

### Generated mode draft
Persist:
- prompt text
- generated plans array
- selected plan id
- mapped plan id
- selected activity id
- hovered activity id if useful
- geocoded markers if you want fast restore

Recommended:
- do not depend on re-generating plans after reload
- store the actual returned plans

### Manual mode draft
Persist:
- location query
- selected destination
- discovered activities
- active day
- all days and dragged activities
- current discovery tab mode
  - `searchByLocation`
  - `showFavorites`

This is the critical state that preserves drag-and-drop results.

### Shared planner UI state
Optionally persist:
- current planner route
  - `/planner`
  - `/planner/generate`
  - `/planner/manual`
  - `/planner/reserve`
- reservation draft if needed

## Suggested draft data shape

```ts
interface PlannerDraftState {
  version: 1;
  updatedAt: string;
  generated: {
    prompt: string;
    plans: GeneratedPlan[];
    selectedPlanId: string | null;
    mappedPlanId: string | null;
    selectedActivityId: string | null;
  };
  manual: {
    locationQuery: string;
    selectedLocation: PlannerLocation | null;
    discoveredActivities: Activity[];
    activeDay: number;
    showFavoritesOnly: boolean;
    plan: Plan;
  };
  reserve: {
    draft: ReservationDraft | null;
  };
}
```

## Supabase storage design

### Table recommendation
Create a table such as:
- `planner_drafts`

Columns:
- `id`
- `user_id`
- `draft_json`
- `updated_at`

Suggested behavior:
- one draft row per user
- overwrite the same row when planner state changes

Benefits:
- simple to query
- easy to extend later
- avoids multiple stale drafts unless versioning is needed

### Row Level Security
Enable RLS so users can only read/write their own draft:
- `auth.uid() = user_id`

## Guest storage design
Use `localStorage` with a stable app-specific key, for example:
- `maptivity_planner_guest_draft`

Behavior:
- autosave draft on meaningful changes
- restore on app load
- clear only when user explicitly resets/clears planner data

## Save strategy
Use **debounced autosave**.

Recommended:
- save 300-800ms after state changes stop

Why:
- avoids writing on every keystroke or drag movement
- keeps UI responsive
- reduces Supabase writes

Triggers:
- generated plan created
- selected generated plan changed
- manual location selected
- activity dragged into plan
- activity reordered
- day added or removed
- activity removed

## Hydration strategy

### On planner load
1. Check auth session
2. If authenticated:
   - fetch draft from Supabase
3. Else:
   - load guest draft from localStorage
4. Validate the draft structure
5. Populate shared planner state

### On auth transition
If guest logs in:
- optionally merge guest draft into account draft
- then write to Supabase

Recommended v1:
- if authenticated and guest draft exists, prefer account draft if newer
- otherwise migrate guest draft to account

## Implementation steps by file

### 1) Add shared planner draft types
File:
- `types/planner.ts`

Add:
- `PlannerDraftState`
- any helper types for generated/manual persisted state

### 2) Lift planner state up
File:
- `components/PlannerPage.tsx`

Changes:
- store generated draft state here
- store manual draft state here
- pass state and setters down into:
  - `GeneratePlannerPage`
  - `ManualPlannerPage`
  - `ReservePlanPage` if needed

### 3) Refactor child pages to controlled state
Files:
- `components/planner/GeneratePlannerPage.tsx`
- `components/planner/ManualPlannerPage.tsx`

Changes:
- remove local ownership of persistent draft state
- accept props for current planner state and mutation callbacks

### 4) Create persistence helpers
Recommended new file:
- `services/plannerDraftService.ts`

Responsibilities:
- save guest draft to localStorage
- load guest draft from localStorage
- save authenticated draft to Supabase
- load authenticated draft from Supabase
- optionally clear planner draft

### 5) Integrate auth-aware storage
Files:
- `services/authService.ts`
- `components/PlannerPage.tsx`

Use current session identity to decide:
- Supabase draft persistence
- localStorage guest persistence

### 6) Add autosave and hydration
File:
- `components/PlannerPage.tsx`

Add:
- hydration on mount / session ready
- debounced persistence on draft changes

### 7) Optional reset controls
If users need a clean start:
- add explicit "Clear Draft" behavior