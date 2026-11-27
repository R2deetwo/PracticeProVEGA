# ALOA FAB surface — Phase 0 diagnosis (Round 24, 2026-11-27)

Method: Vite dev server (demo bypass, dev-gated), Playwright 1.62.1, Chromium with a
fake media stream (mic permission granted) so live takes are real. BEFORE shots:
`docs/ui-audit/aloa-fab/before/` (73 files — every state below × 390×844 / 768×1024 /
1440×900 × light/dark, plus probe evidence shots). Runtime probe data:
`docs/ui-audit/aloa-fab/probes.json`.

Baselines recorded this round (ratchets must not grow):
- `check-design-tokens.mjs`: gray=0 slate=11642 zinc=8581 dim=376 roundedXl=72
  textPx=70 zIndex=0 animatePulse=82 (hard gate gray zero — held).
- `check-ui-primitives.mjs`: button=1602 input=403 select=139 textarea=58,
  total=2202 (baseline 2202 — held, no growth).
- Root `npx tsc --noEmit`: **0 errors** (committed ceiling 87).

## 1. Distinct headers on the path chat → Vox → Court Mode

Three different headers, each with different navigation semantics, PLUS a
fourth chrome row (the panel-level Vox switcher) stacked above the Vox pane:

| Surface | Location | Controls |
| --- | --- | --- |
| Chat header | `src/components/aloa/AloaChat.tsx:3574-3654` | ALOA mark button (also exits form/details views), title + `ModelBadge` which **cycles model on click** (`:3596`, `cycleModel`), Vox mic (`:3615-3626`), History (`:3637-3643`), Close on `onPointerDown` (`:3644-3652`) |
| Panel Vox switcher row | `src/components/aloa/AloaPanel.tsx:119-139` | `SegmentedToggle` "Consultation / Note | Court Mode" — shown only in capture/court modes; busy-lock already implemented (`:129-135`) |
| Vox header (embedded/compact) | `src/components/quickcapture/QuickCaptureView.tsx:810-1153` | `< ALOA` back (`:815-824`, embedded → chat), absolutely-centered ALOA Vox box with first-use callout (`:849-950`), Dashboard (`:988-1001`, hidden on embedded desktop), gear popover with Quiet Mode / startup pref / tips / all settings (`:1002-1140`) |
| Court header | `src/components/aloa/AloaCourtMode.tsx:167-190` | Back (inner nav: compose→matter→diary→**capture pane**, `:128-132`), title, X Close behind `leaveGuard` (`:180-189`) |

Close/back semantics are inconsistent: chat Close closes the whole panel; Vox
`< ALOA` returns to chat; Court X closes the whole panel; Court "Back" at diary
level returns to the **capture** pane (not chat); backdrop closes everything
except in court mode; **Escape does nothing** (no keydown handler in
`AloaPanel.tsx`; only the Vox callout/menu close on Escape —
`QuickCaptureView.tsx:323,346`).

## 2. Backdrop click while Vox is recording/processing — the take is lost

Code: `AloaPanel.tsx:96` — `onClick={mode === 'court' ? undefined : handleClose}`;
`captureBusy` is NOT consulted (only the segment switcher is, `:129-135`).

Runtime proof (`probes.json → runtime.backdropTake`, shot
`before/probe-backdrop-take-1440x900-light.png`): started a real take
(`recordingStarted: true`), clicked the veil at x=60 →
`panelClosedByBackdropDuringRecording: true`; reopened → the take is gone
(`takeSurvived: { recentRows: 0, queuedStrip: false }`). No confirm, no queue,
no recovery. Related: an online take whose transcription request fails (demo
session without bearer → 401 from `convex/ai.ts:158`) is stuck in
"Transcribing…" forever with **no cancel affordance**
(`QuickCaptureView.tsx:1372-1383` — spinner + copy only), and the only exit
(killing the panel) destroys the take (see shots `vox-triage-unreachable-*`,
`vox-recent-*` — still spinning after 35 s).

## 3. Mobile drag handle is visual-only

`AloaPanel.tsx:110-115` — two nested divs, no handlers. Runtime proof
(`probes.json → runtime.dragHandle`): dispatched a full swipe (pointerdown →
move +260px → up) on the handle → `panelStillOpenAfterSwipe: true`,
`handleGestureHandlers: { pointerdown: false, touchstart: false }`. It implies
a dismiss gesture that does not exist. (Also hidden in capture mode
`mode !== 'capture'` so it appears/disappears between panes.)

## 4. Chat Close uses `onPointerDown` — fires on touch-before-scroll

`AloaChat.tsx:139-150` (the "bulletproof close handler") and `:3644-3652`.
Runtime proof (`probes.json → runtime.pointerDownClose`): CDP `touchStart` on
the Close button then `touchMove` +320px (a scroll gesture that happens to
start on the header) → **the panel was already closed before `touchEnd`**
(`closedBeforeTouchEnd: true`). Any scroll that begins on the header's Close
button kills the panel. The stated reason (beating drag handlers) no longer
applies: the backdrop uses `onClick` only since 2026-11
(`AloaPanel.tsx:90-98`).

## 5. Vertical chrome before content

Measured (`probes.json → runtime.chromeBudget`):

| Viewport | drag handle | panel switcher row | Vox header | **total above content** | bottom mode bar |
| --- | --- | --- | --- | --- | --- |
| 390×844 | 0 (hidden in capture mode) | 34px | 64px | **98px** | 63px |
| 1440×900 (520px drawer) | 0 | 34px | 64px | **98px** | 63px |

In chat mode the drag-handle row adds ~20px more (`AloaPanel.tsx:111-115`).
Target for Phase 3.1 is ≤96px above content — currently 98px with FOUR chrome
layers (switcher + Vox header + bottom bar + hidden handle in chat).

## 6. User-visible strings vs brand rules

`grep src/components/{aloa,quickcapture}` for "QC", "Quick Capture", "Quick
note", "Whisper" in JSX text / `title=` / `aria-label=` / placeholders:

- **`QuickCaptureView.tsx:1494`** — Recent-captures row label
  `{r.kind === "legalpad" ? "Legal Pad" : "Quick note"}` → the only real
  violation; should read "Note" (Phase 3.3).
- "QC" survives only in doc comments (`QuickCaptureView.tsx:17`,
  `VoxUpsellModal.tsx:17`) — comments don't count; the phone title was already
  replaced by the ALOA Vox box.
- "Whisper" survives only as the storage key / function names
  (`QuickCaptureView.tsx:139-151` — `practicepro_whisper_mode`,
  `readWhisperPref`/`writeWhisperPref`); the user-visible name is already
  "Quiet Mode" (`:978-985`, `:1024-1066`). Internal identifiers stay (no
  migrations).
- `QuickAskActions.tsx:61` aria-label "Quick Ask actions taken" — "Quick Ask"
  is the feature's name, not a violation.
- `AloaFAB.tsx:41` still names the lock modal feature `ALOA® AI Copilot`
  (® usage to check against `assistantIdentity.ts` in Phase 1.5a).

## 7. Raw colour/size classes bypassing tokens (per-file baseline)

Counts of `slate-` / `zinc-` / `text-2xs` / inline `<svg>` / `variant="bare"`
in code (comments stripped) — the files Phase 1–3 will touch:

| File | slate- | zinc- | text-2xs | `<svg>` | bare |
| --- | --- | --- | --- | --- | --- |
| aloa/AloaPanel.tsx | 3 | 6 | 0 | 0 | 0 |
| aloa/AloaFAB.tsx | 3 | 1 | 0 | 0 | 0 |
| aloa/AloaChat.tsx | 99 | 82 | 20 | 27 | 2 |
| aloa/AloaCourtMode.tsx | 0 | 4 | 0 | 0 | 0 |
| aloa/court/SegmentedToggle.tsx | 0 | 2 | 0 | 0 | 0 |
| quickcapture/QuickCaptureView.tsx | 59 | 77 | 8 | 0 | 4 |
| quickcapture/LegalPadView.tsx | 16 | 19 | 0 | 0 | 0 |
| quickcapture/SessionCaptureView.tsx | 33 | 38 | 12 | 0 | 2 |
| quickcapture/TriageCard.tsx | 66 | 72 | 31 | 0 | 1 |
| quickcapture/VoiceTipsPanel.tsx | 28 | 31 | 7 | 0 | 0 |
| quickcapture/VoxUpsellModal.tsx | 5 | 5 | 0 | 0 | 0 |
| quickcapture/QuickAskActions.tsx | 3 | 3 | 0 | 0 | 0 |

Global ratchet baselines at the top of this file. Ratchet direction: these
totals may only shrink in touched files.

## 8. Touch targets, a11y names, focus, motion

- **Under 44px targets** in these surfaces: `AloaChat.tsx:3699-3706` (history
  drawer close, `p-1` ≈ 24px), `:4632-4639` (attachment-chip remove, icon
  `w-3 h-3` ≈ 12px and icon-only), `:4652` (composer trash, `p-2.5` ≈ 38px),
  `:114-137` (`ModelBadge`, ~22px tall), `:3936-3943` (prompt chips ~28px),
  `:3884-3912` (insight pills ~28px); `QuickCaptureView.tsx:1273-1299`
  (Dictation/Conversation segmented, `py-1.5` ≈ 30px). `.touch-target` (44px,
  `src/index.css:1402`) is used on the chat header buttons but not these.
- **Icon-only without an accessible name**: `AloaChat.tsx:3699-3706` (drawer
  X — no aria-label, no title), `AloaChat.tsx:4632-4639` (attachment remove).
  History (`:3637-3643`) has `title` only (weak but named); ModelBadge has
  `title` (`:117`).
- **Missing focus-visible rings**: the raw `<button>`s in the chat header
  (`AloaChat.tsx:3578-3590`, `:3637-3652`), history drawer, chips and pills
  carry no focus styles (only the ui/Button primitive does —
  `src/components/ui/Button.tsx:87-88`). FAB has focus ring (`AloaFAB.tsx:85`).
- **Animations without `prefers-reduced-motion`**: Tailwind `animate-pulse`
  has no global reduce rule (the 12 `prefers-reduced-motion` blocks in
  `src/index.css` cover `vox-rest-pulse`, hero/landing motion, etc. — not
  `animate-pulse`). Affected: `AloaFAB.tsx:67-68` (recording red pulse —
  Phase 1.5c), `AloaChat.tsx:3888` (critical insight dot), `:4113`
  (streaming cursor). `animate-vox-rest-pulse` IS covered
  (`src/index.css:1687-1690`).
- **FAB states** (`probes.json → runtime.fabA11y`): aria-label "Open AI
  Assistant ALOA" vs tooltip "Open ALOA®" — they disagree and the ® usage
  must be checked against `assistantIdentity.ts` (Phase 1.5a). The
  `listening`/`speaking`/`thinking` visual states are **unreachable dead
  code** — nothing outside `AloaProvider.tsx:206/218/235` ever calls
  `setAloaState`, and those sites only set `'idle'`. The locked state is
  unreachable in the demo firm (paid plan; `enableAllAiFeatures` is never
  written `false` anywhere in the app). FAB does not overlap the mobile bottom
  nav (measured box bottom 764px vs nav top ~780px on 390×844).

## Also observed (feeds Phases 2–3)

- Chat send in the demo surfaces the raw backend failure text inside the
  trust-chrome card ("System Error: Request ID … Unauthorized … at handler
  (../convex/ai.ts:158:8)" — shot `panel-chat-messages-390x844-light.png`);
  a Retry button exists. Phase 2.3 wants errors as a Card with Retry, never
  raw error text (today the stack/path is visible).
- Upsell duplication: the FAB lock opens the generic `upgradePlan` modal with
  feature name "ALOA® AI Copilot" (`AloaFAB.tsx:41`), while Vox lock paths
  open `VoxUpsellModal` ("Upgrade to Pro", `VoxUpsellModal.tsx:130-139`) —
  two different upgrade messages (Phase 3.7). `VoxUpsellModal` already
  renders at `Z_CLASS.modal` (3000 > sidePanel 2000, `VoxUpsellModal.tsx:91`)
  so it is not z-trapped; it is conditionally rendered, not opened via
  `openModal`.
- The offline take works end-to-end: with the context offline before the
  take, stop lands in the queued state "Saved on this device…" (shots
  `vox-speak-queued-*`), and the queue strip logic exists
  (`QuickCaptureView.tsx:1384-1392`, `:1457-1464`). The queued capture's
  later processing outcome was not observable in this environment.

## Unreachable in this environment (documented, not captured)

- `fab-listening-*` / `fab-locked-*` screenshots: see finding 8 — dead/unreachable
  states in the demo. `vox-upsell-*`: `canUseVox` is true on the demo firm at
  every viewport/theme (recorded in `probes.json`), so the modal could not be
  triggered live; its layout was reviewed in code.

— End of Phase 0. No code changes were made in this phase.
