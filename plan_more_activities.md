# Places Results Expansion (Multi-Type Fan-Out): Implementation Plan

## Goal
Increase the number of places returned per search without changing the user-selected radius or relaxing client filters.
Keep the codebase simple, predictable, and low-cost.

## Constraints
- Keep existing client-side filtering in place.
- Respect the user-selected search radius.
- Avoid complex tiling/grids or heavy keyword sweeps.

## Recommended strategy
Use a small multi-type fan-out in the backend for generic searches:
- Split the existing `includedTypes` list into 3-4 buckets.
- Issue one `searchNearby` request per bucket.
- Merge and de-duplicate results by `place.id`.
- Cap the merged list to a max count (e.g., 60-80) before returning.
- Cache the merged response (already supported via NodeCache).

This yields more coverage than the current single call capped at 20, without adding a lot of code or cost.

## Proposed bucket split (example)
These are suggestions; adjust for desired content mix.

- Food & drink:
  - restaurant, cafe, bar, bakery, ice_cream_shop
- Culture & attractions:
  - museum, art_gallery, tourist_attraction, zoo, aquarium, marina, temple
- Outdoors & recreation:
  - park, beach, garden, lake, golf_course, hiking_area, trail
- Entertainment & misc:
  - movie_theater, stadium, shopping_mall, casino, bowling_alley, spa, gym

## Implementation steps (safe and minimal)
1) Define type buckets
  - Add a small constant array of buckets near the current `includedTypes` list.
  - Keep the existing single list for reference.

2) Build a shared `searchNearby` helper
  - Extract the current single `searchNearby` call into a helper that accepts `includedTypes`.
  - Reuse existing headers and `locationRestriction` logic.

3) Fan-out requests
  - For generic queries only (same branch as current `includedTypes` usage), call the helper once per bucket.
  - Use `Promise.all` to run in parallel.

4) Merge and dedupe
  - Flatten all `places` arrays.
  - Deduplicate by `place.id` with a `Map`.

5) Apply a hard cap
  - After dedupe, slice to a max count (e.g., 60-80) to keep UI fast.
  - If you want stability, preserve the original order (first-seen wins).

6) Keep all existing client filters
  - No changes required in client filtering logic.

## Files to touch
- server/src/index.ts
  - Add type buckets and helper function.
  - Replace the single `searchNearby` call in the generic-search branch with the fan-out merge.

## Risks and guardrails
- Extra API calls per search (3-4x). Keep buckets small to control cost.
- Result ordering may shift. Preserve order by inserting into the dedupe map in the order responses are processed.
- Cache key should remain the same so repeated searches are cheap.

## Validation
- Manual test with a dense urban area.
- Confirm more than 20 results appear before filters.
- Confirm filters still reduce the list as expected.
- Verify no change to query-based search path (non-generic queries still use `searchText`).
- clear:
  - local planner state
  - localStorage guest draft
  - Supabase draft if authenticated

## UX recommendations
- Restore silently if draft exists
- Optional small toast:
  - `Restored your planner draft`
- Do not force users through a modal
- Preserve current subpage if practical

## Important guardrails
- Validate loaded JSON before hydrating state
- Version the draft format with `version: 1`
- If schema changes later, ignore or migrate old drafts safely
- Do not save purely ephemeral hover state unless it noticeably improves UX

## Risks and mitigations

### Risk: too many writes to Supabase
Mitigation:
- debounce saves
- save only meaningful draft changes

### Risk: stale guest and account drafts conflict
Mitigation:
- compare `updatedAt`
- prefer the newer one
- optionally migrate guest draft after login

### Risk: large payloads
Mitigation:
- store only necessary planner state
- avoid redundant derived data where possible

### Risk: drag-and-drop order mismatch after reload
Mitigation:
- persist exact day arrays and item order
- hydrate directly into the same `Plan` structure used by the UI

## Recommended rollout order
1. Define shared draft types
2. Lift state into `PlannerPage`
3. Make both planner pages controlled by parent state
4. Add guest persistence with localStorage
5. Add authenticated persistence with Supabase
6. Add hydration and autosave
7. Test navigation-away / return behavior thoroughly

## Testing checklist
- Generated mode survives leaving `/planner/generate` and returning
- Manual mode survives leaving `/planner/manual` and returning
- Dragged activities remain in correct day and order
- Added/removed days remain correct after reload
- Selected location and discovered activities restore
- Guest draft restores after refresh
- Authenticated draft restores after sign-in and revisit
- Drafts do not overwrite each other incorrectly between guest and auth states

## Final recommendation
Implement this as a shared planner draft system first, then attach storage.

That sequence matters:
- first make state survive component unmounts
- then persist it durably for guest and authenticated users

This keeps the implementation clean, testable, and much less brittle than trying to patch persistence separately into each page component.

