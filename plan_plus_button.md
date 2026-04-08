# Plus Button Image-Guided Planner: Implementation Plan

## Goal
Turn the `+` button in the Generate Plan composer into an image uploader so users can provide visual inspiration (for example, a beach photo). Use that image to generate a short summary and combine it with the typed prompt before itinerary generation.

## Recommended model stack
- Vision + NLP summary model: `gpt-4.1-mini` via OpenAI Responses API.
- Existing itinerary model stays as-is: local Ollama planner model in `server/src/index.ts`.

Why this setup:
- Minimal architecture change.
- Fast and cost-effective for short image summarization.
- Keeps current planner JSON schema and downstream parsing stable.

## Scope (v1)
- One image upload per request.
- Accepted formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.
- Max image size: `20MB` (ChatGPT-like expectation).
- Image used as inspiration only (not exact geographic truth).
- If image summarization fails, continue with text-only prompt.

## End-to-end flow
1. User clicks `+` in `GeneratePlannerPage`.
2. Hidden file input opens; user selects one image.
3. Frontend shows preview + remove/replace control.
4. On submit (arrow button), frontend sends:
   - `prompt`
   - image payload (base64 + mime type), or temporary `imageId`.
5. Backend generates a short image summary using `gpt-4.1-mini`.
6. Backend fuses:
   - user prompt
   - image summary
   - guardrail instruction ("treat image as style/context unless location is explicit")
7. Existing planner generation runs with fused prompt.
8. Backend returns the same planner JSON shape.

## File-by-file implementation plan

### 1) Frontend uploader + UI state
File: `components/planner/GeneratePlannerPage.tsx`
- Add hidden `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif">`.
- Wire `+` button to trigger file input.
- Add state for selected image:
  - file metadata (name, size, mime)
  - preview URL
  - base64 (if sending directly), or `imageId` (if upload endpoint used)
- Add controls:
  - Remove image
  - Replace image
  - Validation messages (format, size > 20MB)
- Keep arrow button as submit trigger.
- Add loading statuses:
  - "Analyzing image..."
  - "Generating plans..."

### 2) Frontend planner request contract
Files:
- `services/plannerService.ts`
- `types/planner.ts`

Changes:
- Extend request body type from `{ prompt }` to:
  - `{ prompt, image?: { mimeType: string, base64: string } }`
  - or `{ prompt, imageId?: string }` if using temporary upload endpoint.
- Keep response types unchanged.

### 3) Backend image handling + summary generation
File: `server/src/index.ts`

Changes:
- Add env vars:
  - `OPENAI_API_KEY`
  - optional `OPENAI_BASE_URL` (if needed)
- Install package in `server/`:
  - `npm install openai`
- Add helper function:
  - `summarizePlannerImage({ mimeType, base64 }) -> short summary string`
- Prompt template for summary:
  - Return 2-4 concise bullets:
    - setting
    - mood
    - likely activities
    - notable cues
  - Do not infer exact location unless clear evidence appears.

### 4) Prompt fusion strategy
File: `server/src/index.ts` (inside `/api/planner/itinerary`)

Before calling the local planner model:
- Build `effectivePrompt`:
  - User prompt block
  - Optional "Visual inspiration summary" block
  - Guardrail line: "Use visual cues as thematic guidance, not confirmed geography."
- Use `effectivePrompt` as the user message content to the planner.

### 5) Brief image persistence (TTL)
Files:
- `server/src/index.ts`
- optional utility module `server/src/tempImageStore.ts`

Approach:
- Persist uploaded image briefly in `server/tmp/planner-uploads/`.
- Store metadata (id, path, mimeType, createdAt).
- TTL = 1 hour.
- Cleanup job on startup + every 15 minutes.
- Delete image immediately after summarization unless reuse is needed.

Alternative:
- Skip disk persistence and pass base64 in one request (simpler, but less resilient to refresh/retry).

## API shape proposal

### Option A: single request (simplest)
`POST /api/planner/itinerary`
```json
{
  "prompt": "Plan a coastal weekend...",
  "image": {
    "mimeType": "image/jpeg",
    "base64": "<...>"
  }
}
```

### Option B: two-step with temporary persistence
1. `POST /api/planner/upload-image` -> returns `{ imageId }`
2. `POST /api/planner/itinerary` with `{ prompt, imageId }`

Recommended for this repo:
- Start with Option A for fastest implementation.
- Move to Option B only if refresh/retry reuse is needed.

## Validation + guardrails
- Reject unsupported mime types.
- Reject files larger than 20MB.
- Truncate/sanitize any generated image summary before prompt fusion.
- Never block itinerary generation if image analysis fails.
- Log summary generation failures at warning level; return graceful fallback.

## UX copy recommendations
- Near preview:
  - "Image will be used as inspiration for vibe and activities."
- On failure:
  - "We couldn’t analyze that image. Generating from your text prompt only."
- Optional transparency:
  - Expandable "How image influenced this plan" panel with the generated summary.

## Implementation milestones
1. Frontend file picker + preview + validation.
2. Request schema extension from frontend.
3. Backend OpenAI image summarizer helper.
4. Prompt fusion in itinerary endpoint.
5. TTL persistence and cleanup.
6. QA for:
   - text-only flow
   - text+image flow
   - invalid file
   - summarizer failure fallback

## Risks and mitigations
- Risk: model infers wrong location from generic image.
  - Mitigation: explicit guardrail in fusion prompt.
- Risk: large payloads if sending base64.
  - Mitigation: 20MB cap + optional compression + future `imageId` upload path.
- Risk: slower generation with vision step.
  - Mitigation: low-detail vision pass, short summary output.

## Setup checklist
1. Add `OPENAI_API_KEY` to `server/.env`.
2. Install OpenAI SDK in `server/`.
3. Implement image summary helper.
4. Extend planner request schema.
5. Add uploader UI for `+` button.
6. Add temp storage + TTL cleanup.
7. Test with and without image.

