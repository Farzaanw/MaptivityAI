# Mic Button Voice-to-Text: Implementation Plan

## Goal
Turn the microphone button in the Generate Plan prompt bubble into a voice-to-text input that records the user's speech and inserts the resulting transcript into the prompt bubble.

This version will use **post-stop transcription**:
- User clicks the mic to start recording.
- While recording, the prompt bubble shows `Listening...`.
- User clicks again to stop.
- Audio is sent to the backend for transcription.
- The returned text is inserted into the prompt bubble.

## API key and model strategy
- Use the **same `OPENAI_API_KEY`** already needed for the image/AI features.
- No separate API key is required for microphone transcription.
- Use a **different model type** for speech-to-text than for image understanding.

Recommended model split:
- Image summary / visual inspiration: `gpt-4.1-mini`
- Voice-to-text transcription: `gpt-4o-mini-transcribe`
- Existing itinerary generation can remain on the current local Ollama model

Why:
- Same OpenAI account/key, simpler configuration.
- Each model is used for the job it is best suited for.
- Keeps planner generation and transcription concerns separate and easier to debug.

## Scope (v1)
- Post-stop transcription only
- No live streaming transcript while user is talking
- One-click start, one-click stop
- `Listening...` visible inside the prompt bubble while recording
- Transcript gets appended to or inserted into the existing prompt text
- If transcription fails, preserve existing prompt text and show a soft error

## User flow
1. User clicks the mic button.
2. Browser requests microphone permission if needed.
3. Recording begins.
4. Prompt bubble shows `Listening...`.
5. Mic button changes visual state to indicate active recording.
6. User clicks the mic again to stop.
7. UI changes to `Transcribing...`.
8. Frontend uploads audio to the backend.
9. Backend sends audio to OpenAI transcription API.
10. Backend returns transcript text.
11. Frontend inserts transcript into the prompt bubble.

## Recommended implementation approach

### Frontend recording
File: `components/planner/GeneratePlannerPage.tsx`

Use browser APIs:
- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `MediaRecorder`

Frontend state to add:
- `isRecording`
- `isTranscribing`
- `transcriptionError`
- audio chunks / recorder refs

Prompt bubble behavior:
- Normal: show typed text
- Recording: show typed text plus `Listening...`, or an inline overlay if textarea is empty
- Transcribing: show subtle helper text below or inside the composer

Mic button behavior:
- Idle: normal mic icon
- Recording: highlighted / active state
- Transcribing: disabled or loading state

### Backend transcription endpoint
File: `server/src/index.ts`

Add a route such as:
- `POST /api/planner/transcribe`

Responsibilities:
- accept uploaded audio file
- validate format and file size
- call OpenAI transcription model
- return `{ text: "..." }`

Use:
- same `OPENAI_API_KEY`
- transcription model `gpt-4o-mini-transcribe`

## Request format
Recommended frontend upload:
- `multipart/form-data`

Payload:
- audio file blob from `MediaRecorder`

Recommended audio format:
- `webm` if supported by the browser

Fallback formats if needed:
- `wav`
- `m4a`

## UI behavior details

### Prompt bubble states
- Default:
  - normal placeholder or typed text
- Recording:
  - show `Listening...`
  - do not erase existing typed prompt
  - optionally animate the mic button
- Transcribing:
  - show `Transcribing...`
  - keep the bubble stable so the layout does not jump
- Success:
  - insert transcript into prompt bubble
- Failure:
  - keep existing prompt intact
  - show soft error like `Couldn't transcribe audio. Try again.`

### Transcript insertion behavior
Recommended for v1:
- append transcript to the end of the current prompt, with a space or newline

Later enhancement:
- insert at current cursor position

## Validation and limits
- Limit recording length to a practical cap, for example 60-90 seconds
- Reject empty recordings
- Reject unsupported mime types
- Add timeout handling on backend transcription

## Setup steps
1. Ensure `OPENAI_API_KEY` is present in `server/.env`
2. Install OpenAI SDK in `server/`
   - `npm install openai`
3. Add microphone recording logic in `GeneratePlannerPage.tsx`
4. Add `/api/planner/transcribe` endpoint in `server/src/index.ts`
5. Connect mic button state to prompt bubble UI
6. Test permission flow, stop/start flow, and transcript insertion

## Suggested technical rollout
1. Add frontend mic button states and `Listening...` UI
2. Record audio with `MediaRecorder`
3. Add backend upload + transcription route
4. Insert transcript into textarea on success
5. Add error handling and polish

## Risks and mitigations
- Risk: browser microphone permissions denied
  - Mitigation: show clear non-blocking error
- Risk: browser codec differences
  - Mitigation: prefer `webm`, detect support if needed
- Risk: transcription latency
  - Mitigation: use post-stop flow and visible `Transcribing...` status
- Risk: transcript overwrites prompt accidentally
  - Mitigation: append instead of replace in v1

## Not in v1
- Real-time streaming transcript
- Voice command parsing
- Auto-submit after transcription
- Multi-language configuration UI

## Final recommendation
Start with post-stop transcription. It is the cleanest and lowest-risk version of voice input for this planner:
- same `OPENAI_API_KEY`
- different model type for speech
- simple mic UX
- `Listening...` inside the prompt bubble while recording

