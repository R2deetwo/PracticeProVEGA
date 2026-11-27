# ALOA FAB surface — Round 24 changes (2026-11-27)

Phase map: each implemented item → files → evidence. Baselines were
recorded in `docs/ui-audit/aloa-fab/FINDINGS.md` (Phase 0) BEFORE any code
change; BEFORE/AFTER screenshots live in `before/` and `after/` (same
filenames), runtime probes in `probes.json`.

| Item | Files | Evidence |
| --- | --- | --- |
| §1.1 One navigation model — panel top row `mark · Ask\|Vox\|Court · Close`; pane headers keep only pane-specific actions (chat Close/mic, Vox `< ALOA` back + Dashboard exit, Court mode-level Back/X removed; Court keeps INNER Back, hidden at diary root; standalone APK header unchanged) | `AloaPanel.tsx`, `AloaChat.tsx`, `QuickCaptureView.tsx`, `AloaCourtMode.tsx` | `tests/unit/aloaFabPanelFrame.test.ts` (one-navigation-model block); `after/vox-speak-idle-*` (top row + thin sub-row), `after/court-diary-*` |
| §1.2 Busy guard — backdrop/Close/Escape route through `requestClose`; live take → shared ConfirmDialog (Keep recording / Stop and close → pane-registered stop-and-keep; Vox flushes segments to the on-device queue, Court stops dictation and keeps the draft); segments lock while busy | `AloaPanel.tsx`, `QuickCaptureView.tsx`, `AloaCourtMode.tsx` | `tests/e2e/aloa-fab-busy-guard.spec.ts` — **2 passed (24.3s)**, output pasted in worklog; `tests/unit/aloaFabPanelFrame.test.ts` (no-accidental-loss block) |
| §1.3 Honest mobile frame — visual-only drag handle deleted; safe-area padding (top+bottom) in ONE place (AloaPanel; QuickCaptureView's insets standalone-only) | `AloaPanel.tsx`, `QuickCaptureView.tsx` | Phase 0 probe: swipe on handle did nothing, no handlers; pinned in `aloaFabPanelFrame.test.ts` |
| §1.4 Close semantics — onClick (not pointerdown), 44px target, label ≥sm, `role="dialog"`, `aria-modal` (mobile), `aria-label="ALOA"`, Tab trapped via existing `useFocusTrap`, focus returns to FAB | `AloaPanel.tsx` | pinned in `aloaFabPanelFrame.test.ts`; Phase 0 probe #4 proved the old pointerdown close fired mid-scroll |
| §1.5 FAB — one accessible name per state (Open / Unlock / Open — recording in progress / `ALOA, N alerts`), tooltip = aria-label, ® dropped, critical-insight count dot (same `getInsights` query as the chat empty state), red pulse wrapped `motion-safe:` (static ring under reduced motion), lock badge + three-way gate unchanged | `AloaFAB.tsx` | pinned in `aloaFabPanelFrame.test.ts` (incl. no-® and motion-safe assertions) |
| §2.1 Chat header — mark + name (left), History, explicit LABELLED model menu (the cycling ModelBadge is gone) | `AloaChat.tsx` | `ModelMenu` (menuitemradio + descriptions); `after/panel-chat-empty-*` |
| §2.2 Empty state — greeting + capability line; insight pills on Badge danger/warning/info (keyboard operable, motion-safe pulse); 4 prompt chips as a 2-col grid of full-width left-aligned cards (min 44px, line-clamp-2); "Dictate with Vox" / "Open Court Mode" quiet links; no auto-scroll cut-off on empty threads | `AloaChat.tsx` | `after/panel-chat-empty-*` (all 6 viewport/theme combos, VLM-verified) |
| §2.3 Errors — no raw backend text (the `System Error: <message>` fallback is gone); each class → specific message + single next step, incl. new session-expired branch; Retry unchanged | `AloaChat.tsx` | Phase 0 evidence `before/panel-chat-messages-*` showed the raw Convex handler path; pinned by removal in source |
| §2.5 Composer — auto-grow to 6 lines; Enter sends desktop / newlines mobile; send disabled empty/offline with visible reason; inline offline Banner; drafts survive close/reopen + segment switches (sessionStorage mirror of the per-conversation draft, cleared on send) | `AloaChat.tsx` | `tests/unit/aloaFabPanelFrame.test.ts` (composer pins: maxLines/sendOnEnter/sessionStorage) — draft mirror visible in source block §2.5 |
| §2.6 History drawer — "New chat" / "Recent chats"; conversation delete via the shared ConfirmDialog (was a blind fire-and-forget); drawer close named + 44px | `AloaChat.tsx` | `handleDeleteConversation`; `after/panel-chat-history-*` |
| §3.8 Copy — Recent-captures row label "Note" (was "Quick note"); "QC"/"Quick Capture"/"Whisper" verified absent from user-visible strings (internal keys unchanged, no migrations) | `QuickCaptureView.tsx` | `tests/unit/aloaVoxCopy.test.ts` (23 files scanned, comments stripped) |
| Phase 4 tokens/motion — new code on semantic tokens (surface/hairline/strong/muted with dark pairs); slate/zinc totals BELOW the Phase 0 baseline | all touched files | Gates below |

Acceptance evidence (full output in the worklog):
1. `npx vitest run` — **Test Files 201 passed | 1 skipped; Tests 4256 passed | 1 skipped**; new tests: `aloaFabPanelFrame.test.ts` (15), `aloaVoxCopy.test.ts` (24 incl. file scans), e2e `aloa-fab-busy-guard.spec.ts` (2).
2. Root `npx tsc --noEmit` — **0 errors** (ceiling 87); `git diff 8f68aa61 HEAD -- convex/` — **0 lines** (untouched).
3. Ratchets — BEFORE: `gray=0 slate=11642 zinc=8581 dim=376 roundedXl=72 textPx=70 zIndex=0 animatePulse=82 | total=2202`; AFTER: `gray=0 slate=11631 zinc=8572 dim=376 roundedXl=72 textPx=70 zIndex=0 animatePulse=83 | total=2201` — every ratchet held, primitives baseline tightened 2202→2201, slate/zinc below baseline.
4. AFTER screenshots — `after/` (80 files, same names as `before/`); this file maps items→files→evidence.
5. E2e busy guard — `tests/e2e/aloa-fab-busy-guard.spec.ts`: a live take survives backdrop click, Escape and Close ("Keep recording"), Stop keeps the take, and "Stop and close" closes safely.
6. DEFERRED regions — four `DEFERRED(quick-note-removal)` markers (`AloaChat.tsx:3675,3732,3806,3825`); `git diff 8f68aa61 HEAD` inside those regions shows only the markers themselves (the pencil button and New Note entry were already gone in Round 23; form/details branches, `SaveToNoteForm`, `NoteDetails` and Archived Notes are functionally intact).
7. Worklog + commits — `feat(aloa): Round 24 Phase 1…`, `feat(aloa): Round 24 Phase 2…`, and this final phase commit, each with verification evidence in the body.

Conflict report (per "report if one conflicts"): three existing pins asserted
the pre-Phase-1 wiring the new spec removes — `aloaCourtModeEntry.test.ts`
(two-segment Vox switcher, `onBackToChat`, backdrop-never-closes-court),
`aloaVoxDesktopEntry.test.ts` and `endorsementRound23.test.ts` (the chat
mic). They were moved forward to pin the NEW one-row contract (stronger
assertions, none weakened), per §1.1/§2.1. The backdrop rule changed
deliberately: it now closes in every mode, but never discards a live take
(busy-guarded) — Court Mode's no-accidental-loss intent is preserved by the
ConfirmDialog instead of a blanket backdrop kill-switch.
