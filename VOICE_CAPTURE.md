# Voice Capture Engine — Operator Runbook

**Shipped:** 2026-11-18 · **Owner spec:** "Upgrade the voice transcription system + build a lightweight, mobile-first Quick Capture Mode"

This document tells you what was built, where every piece lives, how to turn the Whisper service on, and how to run and monitor the new processes.

---

## 1. What was built (the 3-step pipeline)

### Step 1 — Reliable on-device capture (never lose audio)
| Piece | File | What it does |
|---|---|---|
| Segmented recorder | `src/services/voice/audioRecorder.ts` | MediaRecorder wrapper: 60s slices, pause/resume, energy metering, codec negotiation (webm/opus → mp4/aac → ogg), **silent-failure watchdog** (some Android WebViews accept `start()` and never emit data — we detect it in ~8–150s and surface a real error), mic-in-use / denied / no-device errors each get their own actionable message. |
| IndexedDB queue | `src/services/voice/audioQueue.ts` | Every segment is written to IndexedDB (`practicepro_voice`) **before any network call** — a courtroom/basement recording is never lost. |
| Upload manager | same file (`voiceSync` singleton) | Drains the queue in order per capture: on the `online` event, every 30s, on app foreground, and instantly after each new segment. Exponential backoff on network hiccups (5s → 30s → 2m → 5m cap). Auth/payload rejections **dead-letter the single segment**, never the whole capture. |

### Step 2 — Backend transcription (the dedicated Whisper service)
| Piece | File | What it does |
|---|---|---|
| Provider chain | `convex/voiceCapture.ts` → `transcribeSegment()` | **Whisper first** (`OPENAI_API_KEY`, model from `TRANSCRIPTION_MODEL`, default `whisper-1`), **Gemini fallback** (firm BYO key → platform `GEMINI_API_KEY`/`GEMINI_DEMO_KEY`). The provider used is recorded per segment on the capture row. |
| Segment upload | `convex/voiceCapture.ts` → `uploadSegment` action | Stores the original WAV in **Convex file storage**, transcribes it, appends the text. **Idempotent on (clientLocalId, segmentIndex)** — reconnect replays can never double-book. Continuation tails heal the 60s chunk seams for both Whisper (`prompt` param) and Gemini. |
| Legacy retrofit | same file → `transcribeBatch` action | One-shot transcription with no storage — this is what the **NoteEditor mic** and **SaveToNoteForm recorder** now call. The browser-level Web Speech API is **retired** (deleted from NoteEditor). |

### Step 3 — Smart polishing (Smart Clean vs Verbatim) + routing
| Piece | File | What it does |
|---|---|---|
| Smart Clean | `finalizeCapture` action + `SMART_CLEAN_SYSTEM_PROMPT` | Filler removal, **mid-sentence self-correction resolution** ("Tuesday… actually make that Thursday" → keeps only Thursday), punctuation, paragraphs. Preserves Nigerian legal terms, Latin phrases, case citations (`[2023] NWLR (Pt 1291) 1`, LPELR), ₦ amounts, Pidgin phrasing (never translated). |
| Verbatim tier | `verbatimText` on the capture row | Word-for-word, **never edited** — the evidentiary source of truth. The Legal Pad's transcript tier is always verbatim; its polish tier is the merged summary. |
| Triage | `finalizeCapture` + `buildTriagePrompt` | Classifies the note (case_note / schedule / question / share), extracts dates+times+deadlines as absolute Lagos dates, matches mentioned client/matter names against the firm's records (LLM candidates + **deterministic server-side match**). |
| Quick Ask | `quickAsk` action | Grounded answers from the firm's own matters/notes/schedule only — cites `[Matter: X]` / `[Note: Y]` / `[Schedule: Z]`, and says plainly when the data doesn't contain the answer. |
| Legal Pad merge | `buildMergePrompt` | Weaves typed shorthand + verbatim into one structured summary (Overview / Key Facts / Client Instructions / Action Items / **Discrepancies**). |

### Quick Capture Mode (the mobile-first landing)
| Piece | File |
|---|---|
| Landing screen (walkie-talkie: ask bar + big record button) | `src/components/quickcapture/QuickCaptureView.tsx` |
| Post-capture triage card (one-tap pills: Case Note / Diary / Quick Ask / Copy-Share) | `src/components/quickcapture/TriageCard.tsx` |
| Hybrid Legal Pad (shorthand typing + continuous background recording) | `src/components/quickcapture/LegalPadView.tsx` |
| Boot redirect (phones → Quick Capture, desktop → office, once per session) | `src/components/App.tsx` (search `QUICK CAPTURE LANDING`) |
| Startup-view setting (Auto / Quick Capture / Full Office) | Settings → Display → Startup View (`src/utils/startupViewPreference.ts`) |
| Way back from the office | BottomNav → More → **Quick Capture** |

### Data model
`voiceCaptures` table (`convex/schema.ts`): one row per capture session — `clientLocalId` (device uuid, idempotency key), `kind` (quick | legalpad), `outputMode`, `status`, `verbatimText` (tier 1), `smartCleanText` (tier 2), per-segment `segments[]` (storageId + startMs/endMs — the archived timestamped audio) and `segmentTexts[]` (order-safe), `triageIntent`/`triageMeta`, linked `matterId`/`notePageId`/`eventId`, `shorthandText`/`mergedSummary`.

---

## 2. How to enable Whisper (the one action item)

The engine works **today** on the existing Gemini keys. To switch transcription to Whisper:

1. Get an OpenAI API key (platform key, `audio.transcriptions` scope).
2. Set it on the Convex deployment:
   ```
   npx convex env set OPENAI_API_KEY=sk-...
   # optional, defaults to whisper-1:
   npx convex env set TRANSCRIPTION_MODEL=whisper-1   # or gpt-4o-mini-transcribe
   ```
3. Done. The provider chain prefers Whisper automatically and falls back to Gemini per segment if OpenAI errors. Existing recordings are unaffected (their `provider` field records what produced them).

Secrets live only in Convex env / Vercel env — never in the repo, never round-tripped through the client.

## 3. Everyday operation

- **Record on a phone:** open the app → Quick Capture (or More → Quick Capture) → tap the mic → speak → Stop → the triage card suggests the best destination; one-tap pills switch it.
- **Consultation/evidence session:** Quick Capture → **Legal Pad** → Start consultation → type shorthand while it records (pause/resume any time; segments auto-save every 60s) → End → Summary / Verbatim / My notes tabs.
- **Offline:** record normally. The amber strip shows "N segments waiting to upload" — they transcribe automatically the moment the signal returns, and the triage card appears then (no action needed).
- **Watch the queue (dev):** in the browser console, the `voiceSync` events fire on every state change; `indexedDB → practicepro_voice → segments` shows what is pending.
- **Storage hygiene:** each 60s segment ≈ 1.9 MB WAV in Convex file storage. `deleteCapture` removes the row + its audio. Old captures can be audited via `voiceCaptures.by_firm_created`.

## 4. Monitoring & limits

| Limit | Value | Where |
|---|---|---|
| Audio per segment call | 4 MB base64 (~75s of 16 kHz WAV; recorder slices at 60s) | `uploadSegment` |
| Transcription rate | 60 uploads/min/user, 60 batches/min/user | `consumeRateLimit` keys `voice_upload:*`, `voice_batch:*` |
| Finalize/polish/ask | 15 / 10 / 20 per min/user | `voice_finalize:*`, `voice_polish:*`, `voice_quickask:*` |
| Transcript size cap | 200 KB | polish/triage passes |
| Firm scan cap (triage/ask) | 300 rows per table | `voiceCaptureInternal` |

Every public function is session-bearer gated (`requireFirmUser`), firm-scoped, and re-checks ownership server-side — the identity audit passes.

## 5. Running the tests

```
npx vitest run tests/unit/voiceCapture.test.ts   # 26 tests: verbatim assembly,
                                                 # backoff, retryable-vs-permanent
                                                 # errors, prompts, matter matching,
                                                 # Lagos dates, base64, JSON parsing
npx tsc -p convex --noEmit                       # must be 0 errors
npx tsc --noEmit                                 # baseline-guarded (94)
```

## 6. Known design decisions & deferred items

- **Circular-type pitfall (documented in code):** an action must never call `internal.<its own module>` — it silently degrades type inference app-wide. That's why the DB helpers live in `voiceCaptureInternal.ts`, and why every action handler carries an explicit return-type annotation.
- **Legal Pad transcripts are always verbatim** (evidentiary integrity); the merged summary is that mode's polish tier. Quick notes default to Smart Clean.
- Deferred (v1): voice commands ("new paragraph"), transcript diff view, manual RAW editing with audit trail, per-firm OpenAI BYO key (platform key only today), audio playback UI for archived segments (the `getSegmentUrl` API exists).
