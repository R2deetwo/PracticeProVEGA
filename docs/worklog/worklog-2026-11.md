# Worklog — November 2026

## Task R73 — "the silk pass": the sites stop stuttering, and stop shipping the whole app to strangers

**Owner direction (verbatim shape):** "you did what i said largely but i
noticed that it is glitchy and slow and we need to ensure that the sites
are as silky smooth as possible to use always."

### Diagnosis

Two separate diseases, both real:

1. **Runtime jank on the marketing pages.**
   - `useSiteScroll` ran its DOM measurements on EVERY scroll event
     (trackpads fire far faster than the display), non-passive, and
     called `setActiveSection` per event — used by all three sites.
   - Each `FluidSeam` ran its OWN rAF loop: read
     `getBoundingClientRect()` → write path `d` → next seam reads again
     → forced synchronous layout per seam per frame (4 seams on the hub).
   - `HeroRibbons` repainted 128 gradient strokes × 221 points at 60fps
     for an 11-second sway nobody can perceive the difference at 30fps.
   - `[data-vg-reveal]` / `.w9-reveal` kept `will-change` FOREVER after
     their one-shot reveal — dozens of permanent compositor layers on a
     long page, plus a `blur(7px)` filter rasterized through every
     reveal transition (the most expensive paint on the page, on phones).
   - The fixed navs (all three shells) blurred their backdrop at `xl`
     (24px) — re-blurred on every scroll frame over the whole viewport
     width.
   - The marquee track animated on the main thread's mercy (no
     `will-change`), competing with all of the above.

2. **Load time: a logged-out visitor downloaded the entire app.**
   Measured from `dist/index.html`: **~7.4MB of eager JS** — entry
   3.13MB + module-settings 1.18MB + vendor-pdf 1.08MB + vendor-editor
   478KB + module-atrium 326KB + vendor-ai 322KB + module-research
   115KB + module-documents 274KB (+ 380KB CSS). The manualChunks
   per-view rules were the mechanism: Rollup hoisted SHARED CORE
   (contexts, hooks, utils — `MatterProvider`, `useFeatures`,
   `GettingStartedChecklist`…) INTO those manual chunks, and since the
   entry statically needed the shared core, it statically imported the
   manual chunks — settings/documents/atrium/research/editor/pdf/ai all
   eagerly preloaded for every visitor to `/`, `/vega`, `/atrium`.

### Changes — runtime

- `HeroRibbons.tsx`: the loop still ticks every rAF but PAINTS at most
  once per 33ms (~30fps), accumulating skipped time into `t` so the sway
  speed is identical; zero-size guard; all R55-pinned contract strings
  intact.
- `MarqueeSection.tsx` (FluidSeam): ONE shared module-level rAF pass —
  every visible seam is MEASURED first (reads only), then every path
  painted (at most one layout pass per frame). Seams join/leave via
  IntersectionObserver exactly as before.
- `useSiteScroll.ts`: `{ passive: true }` + rAF throttle + functional
  setState (re-render only when the section actually changes) + settles
  the initial section without waiting for a scroll.
- `index.css`: `.w7-marquee-track { will-change: transform }` (the R72
  docked bar now glides on the compositor thread); `[data-vg-reveal].vg-in`,
  `.w9-reveal.is-visible` and `.w9-reveal-stagger.is-visible > *` release
  `will-change: auto` after the reveal; below `lg` the blur(7px) leg of
  the hub reveal is dropped (rise+fade unchanged, desktop keeps the
  defocus).
- Fixed navs: `backdrop-blur-xl` → `backdrop-blur-md` in
  VegaShell/HubShell (pill + mobile menu)/AtriumShell — at 80–95% white
  the radius difference is invisible; the recurring per-frame cost halves.

### Changes — load

- **App.tsx**: 29 app-only views/components are now `lazyWithReload`
  chunks with `<React.Suspense fallback={<…Skeleton />}>` at every
  render site — Dashboard, Contacts, Tasks, Documents, Calendar, Billing
  (+Monitor), Compliance, Settings, Messages, Notes, Help, Archive,
  SecurityAccess, the property pair, all five detail views, the public
  application form, the ALOA panel, TenantPortal, the client portal
  pair, MatterList, OnboardingWizard, DockedModal. The dead
  `FounderDashboard` import (founder APK only, never rendered here) is
  deleted. The marketing router `LandingPage` is its own chunk, WARMED
  at module evaluation (`void import('./LandingPage')`) so the fetch
  races the Convex auth roundtrip — marketing visitors don't wait on
  discovery. Login/signup modals stay static (they must open instantly
  from the nav).
- **Heavy libraries load on first use:**
  - `reportGenerator.ts`: jspdf + jspdf-autotable (~1.1MB together in
    vendor-pdf) via one cached dynamic `ensurePdfLibs()`; all nine
    generators became `async` (call sites awaited — verified below).
  - `attachmentProcessor.ts`: pdfjs-dist via cached dynamic import, the
    worker URL configured at that moment (provider-chain safe).
  - `useResearch.ts`, `NigerianTaxComplianceAgent.ts`,
    `IngestionAgent.ts`: `@google/genai` loads inside the async calls.
    geminiService/IngestionAgent mirror the `Type` string-enum locally
    (value === name in the SDK) so the module-level tool schemas still
    evaluate without the SDK; only types are imported.
  - `audioUtils.ts`: the `Blob` import is `import type` (was pulling the
    whole SDK to describe a shape).
  - `IngestionAgent.ts`: JSZip also loads on first use.
- **vite.config.ts**: the per-view manual chunks (module-settings /
  module-atrium / module-documents / module-research) are RETIRED — the
  views are dynamic imports now and Rollup's automatic chunking gives
  each its own chunk with exactly its exclusive deps (SettingsView,
  MessagesView, WordProcessor, PropertyDetailView… each their own file),
  while shared core stays in the shared graph. `module-shared` survives
  (the types/constants leaf — cyclic-eval enum fix) and now also hosts
  Vite's preload helper, which Rollup had parked inside vendor-pdf (the
  entry was importing 1MB of PDF stack to get a 2KB `__vitePreload`).

### Measured

- Eager JS+CSS for a logged-out visitor: **7.4MB → 2.70MB (−64%)**;
  vendor-pdf (1.05MB), vendor-ai (315KB), vendor-editor (467KB),
  module-settings (715KB), module-documents (699KB), module-atrium
  (319KB), module-research (122KB) are all lazy now; entry 3.13MB →
  1.94MB. The remaining entry is App + providers + ModalManager's
  modals/forms + Sentry + Convex — the true static graph.
- Gates: root tsc 125 errors (baseline 125 — ZERO new); vitest
  **1421/1421** (was 1399 + 22 new R73 source-contract tests in
  `tests/unit/silkRuntime.test.ts`); `vite build` green (25s).

### Verified (local preview, headless)

- Hub: hero bottom 852 == strip top 852 (R72 flush docking intact, zero
  gap), strip 48px, hero+strip fill exactly 100dvh; marquee transform
  advancing; ribbons painting (frame-capped); seam 0 and seam 1 morph
  while in view (shared batched pass); no console errors.
- Vega: clip 1 playing (1920×1080, currentTime advancing, preload
  "metadata"), clip 2 idle at preload "none" (network posture intact);
  reveals fire on scroll (4 → 8 after scrolling); revealed elements
  report `will-change: auto` (layer release works — 0 leaks); no errors.
- Atrium: loads, hero present, nav blur-md applied; no errors.
- Logged-out modal path: "Log In" on the marketing page opens the email
  modal (ModalManager intact), scroll locks; no errors.
- (Headless Chrome does not fire rAF without forced frames — ribbon/seam
  paint checks were done with screenshot-forced frames.)

### Task R73 — DEPLOY RECORD

- Commit db8b48b9 pushed → CI green: Tests ✓, Deploy to Staging ✓,
  Build Android APK ✓ (bot followed with 66a4c746 v1.0.742 +
  66953b09 build-1136).
- Production promote run 42399010094 (workflow_dispatch, latest main =
  66953b09, which carries R73): Typecheck + unit tests on the promoted
  commit ✓; **Deploy to production (Vercel + Convex) and verify live ✓**
  — "Vercel production is healthy and serving the promoted commit
  (66953b09)", Convex live-query probe ✓; Cloudflare mirror ✗ at the
  token check as always (standing inactive CLOUDFLARE_API_TOKEN — owner
  rotates, mirror re-runs; unchanged since R71).
- Self-verified live (practice-pro-vega.vercel.app, aliased at
  practicepro.ng): `/version.json` sha **66953b09** ✓; the served
  `/vega` + `/` HTML eagerly loads ONLY entry (1.98MB) + module-shared +
  vendor-react/animation/convex/icons + CSS — **no vendor-pdf, no
  vendor-ai, no vendor-editor, no module-settings/documents/atrium/
  research**; the entry references the LandingPage chunk twice (lazy
  const + module-eval warm-up).

---

## Task R74 — the dashboard becomes a demo; the roster writes messages; the "live shot" labelling retires

**Owner direction (verbatim shape):** "It now begs the question, what
does this do? … Okay, now it looks really cool. But do we have this in
the app? I don't think we do, and if we don't, we need to have it
immediately. So make sure it actually works as a system. Think through
this. Also, are there other interactive features we can have? … you can
DM people directly … maybe you can even select multiple people so that
you can create a group message … the ability to open that up and connect
so that they can actually connect to multiple workspaces … This could
probably be a very good opportunity to sort of showcase the whole app
like a mini demo. … Is it something that we can also use to open up
Aloa?" — plus, on the hub: "when I hover over Vega, I can see that it
hasn't been updated. Even the logo inside that image is not up to date …
There's no need to be writing live shots everywhere. If you have a live
shot, just show it. Don't be mentioning live shot."

### Diagnosis

- The hero's dashboard capture carried only ONE interactive pixel: the
  presence stack. Everything else begged the owner's question — "what
  does this do?" — and the R71 quiet stack (correctly) refused to
  advertise itself.
- The presence dropdown TOLD visitors the app does DMs ("Direct
  messages open inside Vega") instead of SHOWING it — a note where a
  working miniature could be.
- The app itself (the real product) had NO path from the header's
  presence avatars to a conversation: the stack was display-only. The
  DM form existed (`NewDirectMessageForm`, dual-mode DM/group) but was
  reachable from no live UI.
- The hub's Vega exhibit (`vega-page.jpg`, also the SystemTour's first
  Vega stop) still showed the pre-R56 Warm Chambers page — the orange
  Seal era, the eyebrow pill, the grid hero. The capture predates SIX
  redesigns of the page it claims to show.
- "LIVE CAPTURE — " prefixes rode 18 captions, the lightbox said
  "· Live capture", the tour badged public pages "Live site" — the
  exact "live shot" narration the owner rejects.

### Changes — the landing preview (src/sites/vega/sections/)

- **CollabPresence v2** — the roster becomes a working miniature:
  every row gains a checkbox and a quick DM; one pick opens a
  direct-message composer, two or more open the GROUP composer (name
  prefilled from initials, editable), Send lands the message in a
  delivered mini-thread with the Start-free hand-off ("Inside Vega
  this thread lives in Messages — kept on the matter"). The R71 quiet
  stack contract is untouched: no hover pop, no plate, focus ring
  only. A small mono PREVIEW chip keeps it honest without narrating.
- **DashboardHotspots (new)** — the capture stays a REAL screenshot;
  the app's own interactive furniture is overlaid where it already
  lives, in cqw units on the same container-type wrapper:
  - the workspace chip (sidebar head) → the multi-workspace
    switcher: current firm, two others (Vega OS + Atrium OS), and
    Connect New Workspace with a join-code flow — "keep things
    separate, switch without logging out" made visible;
  - your own profile (Demo User / DU) → the user menu — My Profile,
    Settings, Lock Workspace, Sign out, each unfolding a one-line
    explanation of what it does in the app;
  - the Aloa orb (the bottom-right FAB) → a mini Aloa exchange:
    a seeded Q&A about the firm's week, quick-ask chips (draft the
    affidavit, who's free Thursday, summarise the matter), and a
    free input with honest fallback — plus the "Aloa reads your
    matters, deadlines and files — not the open internet" line.
  - Discoverability without highlight: a quiet pill rides the
    capture foot ("INTERACTIVE PREVIEW — CLICK AROUND" / mobile
    "TAP TO EXPLORE") until the first interaction; the hotspots
    themselves stay invisible at rest and gain only a soft ring on
    hover/focus. The profile hotspot is sized (7.5cqw) to stop short
    of the presence stack's measured gap (x 85.9–91.5%) so the two
    triggers never fight — the first click-test caught exactly that
    collision and the geometry was narrowed.
- Wired into BOTH the hero card and the lightbox's Dashboard exhibit
  (scale 1.3, same as CollabPresence); the caption now says what is
  clickable: "THE VEGA DASHBOARD, AS THE FIRM SEES IT EACH MORNING —
  CLICK THE WORKSPACE, YOUR PROFILE, A TEAMMATE OR ALOA".

### Changes — the app itself (it must WORK as a system)

- `PresenceAvatars` (the header stack) becomes a messaging surface:
  click any avatar → `openModal('newDirectMessage', null,
  { recipientId })`; the roster's overflow list gains checkboxes and
  a selection bar → `openModal('newDirectMessage', null,
  { initialMode: 'group', initialMemberIds })`. Avatars gain the
  pointer cursor and a subtle hover scale — they finally do something.
- `NewDirectMessageForm` honours the prefill: group mode + members
  arrive preselected (the old recipientId path kept).
- BOTH modal renderers (`ModalManager`, `DockedModal`) pass
  `initialContext={modalContext}` — the context previously never
  reached the form.
- The multi-workspace switcher and Connect-New-Workspace already
  existed in the app's sidebar (Round 13+, `canUseMultiFirm`-gated) —
  the landing demo now mirrors the real system.

### Changes — the hub's Vega exhibit + the "live shot" retirement

- Fresh captures of the CURRENT /vega (navy Seal logo, video-band
  hero, no eyebrow pill) taken from production at 1440×900 and
  390×844, saved as `vega-page-r74.jpg` / `vega-m-page-r74.jpg` —
  RENAMED, not overwritten: /assets jpgs carry immutable year-long
  cache headers, and the 9573903d round proved a same-name swap keeps
  serving the stale capture to returning visitors. References updated
  in OurWorkSection + SystemTour; the stale files deleted.
- "LIVE CAPTURE — " prefixes retired across VegaSuite, VegaHero,
  VegaWhyNigeria, AtriumReceipt; the lightbox "· Live capture" suffix
  dropped; the tour's "Live site" badge and "Live inbox" label
  retired (badge type now optional — public pages carry none; app
  surfaces keep the form-factor labels that say what they ARE).

### Verified (local preview, headless)

- The dashboard card: stack + INTERACTIVE pill + click-guide caption
  all render (VLM-confirmed at 1440×900).
- Presence flow exercised end-to-end: roster opens, two teammates
  ticked → "Message 2 teammates — group" → composer with TA, CN chips
  and prefilled group name → typed message → Send → delivered view
  with the indigo bubble and the Start-free hand-off.
- Workspace panel: three firms + Connect flow (join code → sent
  state); Profile panel: DU header + four rows, My Profile note
  unfolds; Aloa panel: seeded exchange, "Draft the affidavit" chip
  appends its reply (4 bubbles), input + fallback present.
- Lightbox: hotspots render at scale 1.3, positions measured over the
  capture (workspace x 13px-in, profile right-aligned, Aloa
  bottom-right); the workspace panel opens from inside the lightbox.
- Mobile 390×844: card fits, TAP TO EXPLORE pill, roster panel fits
  the viewport (300px at x 43).
- Hub: `vega-page-r74.jpg` loads (1440×900), zero "Live site" badges,
  tour's first Vega stop shows the new capture.
- A JSX-literal `\u2019` artefact class (escapes in JSX text render
  literally) caught by VLM in the connect view and fixed with real
  apostrophes.

### Gates

vitest 1424/1424 green (3 new R74 ratchets in
websiteRepositioning.test.ts: the hotspots/composer contracts, the
app-side DM/group wiring through BOTH modal renderers, and the
"live shot" retirement sweep; the W9/W10 tour-honesty ratchet flips
to the optional badge), tsc 125 baseline with zero errors in touched
files, vite build green, ADR-0004 held (the Aloa chips converted to
ui/Button; raw form-buttons do not grow).

### R74 addendum — the ADR-0004 ratchet and the first CI run

The first CI run on 079fab3d failed ONE gate: the UI-primitives
ratchet — "Raw form-element count GREW: 2312 -> 2316 (+4)". The four
new raw elements were exactly the app-side additions in
PresenceAvatars (the avatar button, the roster-row button, the group
bar button, the select checkbox). All four are now ui/ primitives
(Button; the checkbox is a role="checkbox" Button with the CheckIcon —
the same pattern the landing roster uses, since ui/ ships no checkbox
primitive). Ratchet re-verified locally: 2312 = 2312 baseline, gate
held. tsc 125 baseline, the two touched suites green.

### Task R74 — DEPLOY RECORD

- First push (079fab3d) failed ONE CI gate: the UI-primitives ratchet
  (+4 raw elements — the app-side presence additions). Fixed in
  2253c967 (all four are ui/ primitives; the checkbox is a
  role=checkbox Button with the CheckIcon). CI then green across the
  board: Tests ✓, Deploy to Staging ✓, Build Android APK ✓ (bot
  followed with 53d4c9b5 v1.0.743 + 4b701e28 build-1137, then a1dd93d3
  build-1138 on the promote).
- Production promote run 42405340474 (workflow_dispatch, latest main
  = a1dd93d3, which carries R74): Typecheck + unit tests on the
  promoted commit ✓; **Deploy to production (Vercel + Convex) and
  verify live ✓** — production healthy and serving a1dd93d3;
  Cloudflare mirror ✗ at the token check (standing inactive
  CLOUDFLARE_API_TOKEN — owner rotates; mirror frozen at
  04d798b3/2026-09-18, unchanged since R71).
- Live-verified on practice-pro-vega.vercel.app (practicepro.ng still
  NXDOMAIN — the standing domain-renewal owner action):
  - /version.json sha a1dd93d3 ✓ healthy.
  - /vega dashboard card: the INTERACTIVE PREVIEW pill, the
    click-guide caption, 3 hotspot triggers + 4 presence triggers in
    the DOM; the WORKSPACE panel opens live (Badejo & Associates /
    Badejo Property Co. / Okonkwo & Partners + Connect); the presence
    roster opens live with checkboxes and DM buttons.
  - Hub: vega-page-r74.jpg loads (1440×900) — navy Seal logo, the
    current video-band hero; the phone capture overlaps as before.
- Standing owner actions unchanged: rotate CLOUDFLARE_API_TOKEN (the
  mirror is why a stale /vega can still appear on the workers.dev
  URL), renew practicepro.ng (NXDOMAIN), rotate the GitHub PAT when
  sessions end.

## R75 — the deep audit: both apps, the sites, and the AI stack (2026-11-08)

docs(r75): DEEP_AUDIT_R75.md at repo root — the owner's requested
page-by-page deep dive after the long gap ("these apps need to be
better… a page-by-page analysis of every single aspect"). Basis: the
live code at 176eb905 (R74, v1.0.744, build-1138) audited in four
parallel passes (app core / messaging+Atrium+portals+admin / sites+
prior plans / AI stack), every finding file:line-verified, the three
highest-impact claims (schemaValidation revert, PII attachment bypass,
dead matter components) independently re-verified by direct read, and
the dependency set cross-checked against the npm registry on the day.

Headlines:
- MESSAGING (the owner's open question): partially done. R27–R74
  shipped real send/attachments/push/scheduled/WhatsApp; notification
  and push-tap deep-links DO open the right thread. But the exact flow
  the owner reported is still broken: roster DM open/create and
  channel creation pass activeConversationId, which MessagesView never
  consumes (MessagesView.tsx:346-406 reads only initialTab /
  selectedInboxId / systemInbox) — landing on the generic inbox. Same
  class: ContactDetailView rows deep-link to a permanent spinner
  (clientMessages never resolved in the 'flat' lookup); PropertyDetail
  ticket strip navigates with no context. Fix ≈10 lines; scheduled as
  R75 item 1 in the roadmap.
- Interaction truth: Notes drag-drop is a silent no-op (onDragEnd
  returns early while NoteColumn renders real Draggables); matter
  DocumentsTab download is a no-op for storage-backed files;
  DocumentComparisonModal renders an apology screen; data export
  promises a zip of CSVs and delivers one JSON.
- History model: no popstate sync; filters/tabs/selection never become
  URLs; context dies on refresh — nothing filtered is deep-linkable.
- ~1,500 lines of dead matter components (MatterBrief chain +
  BacklinksPanel) advertising compliance/timeline features that don't
  exist in-product.
- AI stack (the separate mandate): capable but scattered — 5 services,
  6 prompt sources, 2 research paths, localStorage-bound drafts
  (device-loss risk), porous PII (attachments + research sources bypass
  stripPII), BLOCK_NONE safety, zero prompt evals; the
  nigerian-litigation-drafting skill pack sits unwired at repo root.
  Target architecture written: 1 gateway + 1 skills registry + 1
  artifacts store + 1 evals harness, with the full deletion net.
- Stack drift: Vite 5→8.3.5 (3 majors), React 18→19.3.1, Tailwind
  3→4.3.4, Router 6→7.18.5; Convex/Capacitor/genai current-major.
- Sites: R66–R74 all verified in code (hero video, docked ticker,
  lightbox, presence roster, fresh 2026-11-08 captures, Live Shot
  retired); the gaps are SEO (JS-only meta, no sitemap/JSON-LD) and
  zero funnel analytics (PostHog init'd, zero track calls).
- Prior plans: schemaValidation still off (PHASE 0 REVERT never
  followed by the insert audit); offline queue stalled (158 direct
  mutation sites); three strategy docs obsolete (dead Ultimate plan).

The roadmap in §10 sequences R75–R92: Phase A make-the-clicks-land
(deep-links, dead interactions), B app model (URL/history, dead-code
consolidation), C AI modernization (gateway → skills → artifacts →
research → safety/metering/evals), D stack currency (one major per
round: Vite, React, Tailwind, Router), E sites (SEO + analytics),
F data integrity + payments (schemaValidation flip, offline queue,
Paystack). Owner picks the pace; each round runs the full gates
(tsc 125 baseline, vitest 1421, ratchet 2312, live verify, promotion
record).

## Phase 1 — interaction-truth quick wins + the Research crash hotfix (2026-11-12)

**Context.** The owner greenlit implementation off the Phase 0 audit
roadmap ("push the ui/ux changes") and reported the Research section
crashing in production (screenshot: `getResearchMessages → db.get →
"Unable to decode ID: ID wasn't valid base32"`, whole view down behind
the "Something went wrong" boundary).

**Hotfix (production Research crash).** Root cause: notebooks created
through the generic createItem path carry the CLIENT uuid v4 in their
`id` field; DataProvider deliberately keeps that UUID as `nb.id`
(the duplicate-cards fix) — and ResearchView passes `nb.id` to
getResearchMessages/getResearchAnalysisResults, which handed it straight
to `ctx.db.get()`. db.get throws on non-base32 ids → the query throws →
ErrorBoundary eats the whole Research view. The unit tests never caught
it because the mock db.get doesn't validate id shape (mock-fidelity
gap, now closed). Fix: `resolveResearchNotebook()` resolves by the
client UUID via the existing by_custom_id index first, then by Convex
document id via `db.normalizeId` (returns null instead of throwing);
message/analysis queries key on the notebook's own `id` field (what
researchMessages.notebookId actually stores). Tests: roundDWave3b
fixtures rewritten to production shape (`_id` + client UUID `id`);
regression tests pin both id forms and the no-throw contract.

**Phase 1 (roadmap row 1 — 15 findings, all rated S):**
- UX-05 Case Law stub tab folded into AI Notebooks (corpus disclosure
  now rendered in the ResearchPlaceholder; LawReportsView file retained
  for the licensed-corpus future).
- UX-06 matter-stage toast now awaits the mutation (success only on a
  real write; failure already surfaces via the update pipeline).
- UX-09 public vacancy application shows the FETCHED property address
  in header + success state (route label is only the pre-fetch
  fallback).
- UX-10 Estate Community upsell CTAs wired to openModal('upgradePlan')
  (were dead `#subscription` anchors); ui/Button primitives.
- UX-11 vacancy pipeline gates on `liveLeads === undefined` — loading
  is no longer rendered as "No applicants" columns.
- UX-12 portal invite links derive from the deployment origin via an
  ALLOWLIST (production, Cloudflare mirror, this project's Vercel
  previews — owner-controlled, so no phishing vector); unknown origins
  fall back to production (the old behaviour). createPortalInvite
  returns `inviteUrl`; PortalAccessSettings passes
  window.location.origin and displays the same link; client mirror in
  src/utils/portalOrigins.ts (unit-tested).
- UX-25 the half-wired invoice statusFilter now has a rendered Select
  (ui/Select bare, legacy toolbar look).
- UX-30 rent ledger skeleton gates on isDataLoaded (the `!entries`
  branch was unreachable dead code behind `|| []`).
- UX-31 expected rent drops the `|| p.value` valuation fallback.
- UX-39 upgrade modal names the ACTIVE product's assistant
  (getAssistantName(isProperty); Komplete/Vega no longer sold "ARIA").
- UX-40 dashboard OutstandingCard follows canViewBilling (the same
  staffCanViewBilling rule as Financials) instead of isAdmin-only.
- UX-41 contact Properties tab always visible for property-capable
  firms — the empty tab IS the Komplete bridge entry point; empty state
  points at Add Property.
- UX-49 workspace switcher failure toasts (was a silent catch).
- UX-58 the last native browser prompt dialog (FirmSettings
  deactivation reason) replaced by the app's confirmation dialog; the
  optional free-text reason is dropped (server field stays optional;
  audit trail keeps the session-derived acting admin).
- UX-60 demo persona gets honest search copy (search disabled in demo
  build, not "sign in" to an already-signed-in user).

**Gates (all green):** vitest 2561/2561 (126 files; +22 Phase 1 tests
in tests/unit/phase1InteractionTruth.test.ts, roundDWave3b extended);
`npx tsc -p convex --noEmit` 0 errors; root tsc 87 (baseline 94, V7's
87 held); eslint changed files 0/0; check-ui-primitives ratchet held at
2295 (the 3 new raw controls were migrated to ui/Select + ui/Button —
the gate caught the +3 first, exactly as designed); audit-identity.py
PASSED (the new `origin` arg is allowlisted server-side, never trusted
as identity); check-design-tokens gray=0, rounded-xl 72 held.

**Not done here (deliberately):** Phases 2–6 of the roadmap remain
gated per the audit (Phase 3 identity work behind Phase 2
consolidation); ADR-0005 unchanged; no styling/token work was touched
beyond the interaction-truth fixes above.

---

## 2026-11-18 (b) — CI hardening round: brand clarity landed, type debt to zero, protected main

Follows the external review (Copilot) and lands the Brand Clarity Pass.

**Landed on main:** the six-commit Brand Clarity Pass branch
(`chore/brand-clarity`, audit + Phases 1–5: splash product end-card,
per-product APK variants, release-signed CI distribution, brand rules,
regression pins) — fast-forward merge, 2848/2848 tests green.

**Type debt burned to zero (87 → 0):** ~40 files fixed. Real bugs found
under the debt: `useApkVersionCheck` parsed the local versionCode from a
string property (always 0 → update prompt nagged every check); the
TrialNudge Day-7 CTA navigated to a nonexistent view; DraftPro citations
never hydrated (bare array vs `{citations}` contract); `loginAsDemoUser`
mis-typed as void. The rest: type completions, guards, casts, dead-arg
removal. Baseline exception deleted from all four gated workflows —
any new tsc error now fails CI. See ADR-0006 §3.

**Supply chain:** all 50 `uses:` across 16 workflows pinned to immutable
commit SHAs (verified against the API); Dependabot enabled (github-actions
+ npm minor/patch + security).

**Staging gate:** production promotion now refuses to run unless the
staging Convex secrets exist AND the staging alias is healthy. Per-push
staging keeps its loud-skip behavior until the one-time setup is done.

**Cloudflare mirror:** best-effort (Round 20). Missing/unusable token →
the job skips with a loud warning + restore steps instead of red-X-ing
the promote; a failing deploy with a working token still fails. README /
RUNBOOK / watchdog language aligned with reality (the mirror is currently
frozen pending a token rotation — a human, 5-minute task).

**Protected main (gate-lite):** required status check "Typecheck + unit
tests" on PRs, force-push and deletion blocked. Direct pushes stay open
until the APK bot's `version.json` write-back is reworked (two-step plan
in ADR-0006 §1 — full PR-gating would break the in-app update feed today).

**Gates (all green):** vitest 2848/2848; root tsc 0 errors; convex tsc
0 errors; all 16 workflow YAMLs parse; action SHAs verified against the
GitHub API.

**Not done here (deliberate):** `myFunctions.ts` / `portals.ts` /
`schema.ts` domain extraction (needs its own round — 463KB/351KB/170KB);
browser E2E for signup/onboarding (Playwright is already a devDep; smoke
gates added instead in the promote path); Google Play internal testing.

---

## 2026-11-18 (c) — Quick Capture mic lock + boot experience

**The mic bug (founder report: "allowed the microphone, it still says
in use by another app").** Five features each called getUserMedia with
their own lifecycle; on the Android WebView the permission-grant race
rejects the very request the user just allowed AND leaves the
AudioRecord held — every retry fails until app restart. Fix:
`src/services/voice/micStream.ts` — ONE shared stream per session
(refcounted), retry ladder across the grant/release races, single
in-flight open (double-tap safe), 15s warm-idle for stop→record-again,
force-release on background (privacy). All consumers migrated
(VoiceRecorder, useQuickCapture, SaveToNoteForm, NoteEditor,
AutoExpandingChatInput, requestMicrophonePermission). 8 new pins in
`tests/unit/micStream.test.ts`.

**The boot experience (founder report: "white flat screen, looked like
it wasn't loading").** The boot cycled white→green→white→black across
five mismatched surfaces. Now one continuous brand-green phase:
regenerated all 11 native splash drawables (solid #16A34A + white P —
`scripts/generate-splash-assets.py`), native splash spinner ON in all
five capacitor configs, and a zero-JS HTML boot overlay (green + P +
spinner) covering the bundle-parse window, removed on React's first
commit. Founder config aligned to the company-green native splash per
ADR-0005.

**Gates:** tsc 0 / convex 0; vitest 2856/2856 (+8); vite build green
with the overlay verified in dist/index.html.

---

## 2026-11-18 (d) — Founder app black screen + release hygiene

**Founder app black screen (founder report: "I see the splash and then it
doesn't actually load — black screen after granting the permission").**
Reproduced headlessly: with a stored session whose getUser resolves to
null, the boot gate treated the RESOLVED-empty query as still loading
(`sessionToken && !userData` conflates undefined-pending with
null-resolved), so showSplash stayed true forever and the app parked on
the splash's final near-black (#0e0e11) frame. Fix:
`src/admin/founderBoot.ts` — isSessionQueryPending (pending-only
semantics) + SESSION_WATCHDOG_MS (4s post-cinematic backstop for a
never-resolving query). 5 pins in tests/unit/founderBoot.test.ts.
Verified headlessly before/after; fresh-install behavior unchanged.

**Duplicate v1.0.792 releases (founder report: "not sure which one I'm
supposed to download because I see two things").** build-1189 and
build-1190 were both named 'PracticePro v1.0.792' from two different
commits: a lost patch-bump push made the next run rebuild the same
version, and the version.json write-back (no [skip ci]) re-triggered
builds. The founder installed the stale one — the reported Vega mic bug
('in use by another app') was already fixed in current code; the exact
old error text only exists in pre-fix builds. Fix in build-apk.yml:
exit 1 on a lost bump (no release rather than an ambiguous duplicate) +
[skip ci] on the write-back. One-time manual cleanup: delete the
build-1189 release.

**Gates:** tsc 0; vitest 2861/2861 (+5); lint clean; build-apk.yml
parses; dist-admin rebuilt and verified.

---

## 2026-11-18 (e) — Gemini key leaked + mic permissions, the native layer

**ALOA 403 "Your API key was reported as leaked" (founder report: raw
"[Request ID] Server Error Uncaught Error: Gemini 403" dialog in Quick
Capture).** Root cause was NOT app code: the platform Gemini key was
committed to the PUBLIC repo in three places (scripts/list-models.js,
scripts/verify-config.js, docs/archive/fix-logs/ALOA_COMPLETE_FIX.md);
Google's leaked-credential scanner found it and disabled it, so every
server-side AI call (transcription, polish, triage, Quick Ask, ALOA
proxy) failed 403. Fixes: key purged from the tree (scripts read
GEMINI_API_KEY from env, fail with instructions when unset; doc
redacted); voiceCapture/ai now classify Gemini failures
(classifyGeminiFailure: key-rejected / rate-limited / provider-down /
bad-request / unknown) and throw ConvexError with client-safe, honest
messages — plain Error crossing the action boundary is what produced the
"Uncaught Error [Request ID]" text. 5 pins. OPERATOR ACTION REQUIRED:
mint a new key (aistudio.google.com/apikey) and set GEMINI_API_KEY (+
GEMINI_DEMO_KEY if present) in the Convex dashboard; also update the
GitHub Actions secret GEMINI_DEMO_KEY (production-deploy.yml re-pushes
it onto Convex — a stale secret would overwrite the rotation on the next
deploy); enable secret scanning + push protection on the repo.

**Vega mic "did not open on this device" persisting across
grant/revoke/re-grant (founder report, second report after installing a
post-micStream build).** The OS permission was never the issue. Two
native defects: (1) MainActivity replaced Capacitor's WebChromeClient
with a bare one requesting ONLY RECORD_AUDIO — Capacitor 8's stock
client requests RECORD_AUDIO + MODIFY_AUDIO_SETTINGS for AUDIO_CAPTURE,
and the manifest didn't declare MODIFY_AUDIO_SETTINGS either; on several
OEM ROMs (Transsion/Infinix/Tecno, some Samsung) Chromium cannot open
the native AudioRecord without it → NotReadableError even with the OS
permission granted. (2) The bare client also dropped onShowFileChooser
(file uploads silently dead in the APK) and JS dialogs. Fix: stop
replacing the client — the stock BridgeWebChromeClient owns
onPermissionRequest again; manifest declares both permissions. micStream
gains a 4th retry (2.5s backoff) for the stale-AudioRecord case. Gates:
tsc 0; vitest 2866/2866 (+5 classifier pins, ladder pin updated to 4
attempts); lint clean. APKs built and verified from this commit: vega
1.0.794 (10794), founder 1.99.2 (19902) — aapt2 permissions show both
mic permissions; dex free of the old client; founder bundle re-verified
headlessly (fresh + stale-session → login screen).

---

## 2026-11-18 (f) — ALOA double-send + ONE key policy across every AI surface

**ALOA duplicated the question AND the answer (founder report).** Root
cause: `AutoExpandingChatInput`'s send button had no `type` attribute, and
the input lives inside AloaChat's `<form onSubmit={… handleSend()}>` — a
button in a form defaults to `type="submit"`, so one tap fired BOTH the
button's `onClick` and the form's `onSubmit`: every message was sent twice
(two queued AI calls → two streamed answers). The Enter key path never
duplicated because its keydown handler `preventDefault()`s and a textarea
Enter never submits a form. Fix: `type="button"` on all five buttons in
`AutoExpandingChatInput` (send, attach, voice, recording cancel,
recording stop — the attach/voice ones were accidental empty-text
submitters too), plus a 1.2s double-fire guard in `handleSend`
(`lastSendGuardRef`) that absorbs double-taps and any other path that
re-delivers identical content; the intentional multi-message queue is
untouched (a human cannot type a second, different message in under 1.2s).

**"Why doesn't the key the firm uses apply to Quick Capture?" — it now
does.** The asymmetry was real and structural: text ALOA resolves keys on
the CLIENT (`aiProvider.ts resolveProvider`: firm key whenever present,
defaulting provider to gemini), while every server surface
(`voiceCapture`, `ai`, `noteDictation`, `http`) required
`aiProvider === "gemini"` EXPLICITLY — a firm with a stored key but no
provider selection (or a half-configured openai-compatible selection: no
baseUrl) was silently skipped down to the platform env key, which Google
had disabled after the leak → 403 in Quick Capture while text ALOA kept
working. Fix: all four server resolvers now mirror the client (firm key
applies unless the firm is FULLY configured for a direct openai-compatible
endpoint: key + baseUrl; `getFirmAiSettingsInternal` now also returns
`openaiBaseUrl`), and `voiceCapture` gains a caller-BYO channel: the
client (`voiceCaptureService`) sends the user's own key — the same key
text ALOA chat already uses — as `callerApiKey` on every voice action
(uploadSegment, finalizeCapture, quickAsk, repolish, transcribeBatch);
resolution order everywhere: caller's own key → firm key → platform env.
Convex code changes go live at the next production promote; the instant
unblock remains rotating GEMINI_API_KEY in the Convex dashboard (env
changes need no deploy).

Gates: tsc 0; vitest 2867/2867 (+1 new pin: half-configured
openai-compatible firm now spends its stored key through the proxy,
mirroring the client; the existing full-openai-compatible pin updated to
carry a baseUrl). lint clean, UI ratchet held.

---

## 2026-11-18 (g) — Landing ALOA goes LIVE: real AI behind the website assistant

**Owner direction (verbatim): "we cannot have something that is not smart
or answers only preset answers."** The website assistant
(AloaAssistantFab — ALOA on Vega, ARIA on Atrium) was deliberately a
deterministic keyword catalogue (its header said so: no anonymous key
funding, corpus unseeded). That decision is reversed: the panel is now a
REAL AI, and the catalogue is demoted to grounding reference + fallback.

- **New public endpoint `/ai/landing-chat`** (convex/landingChat.ts):
  anonymous by design but fenced — CORS allow-list (prod/staging/CF
  mirror/localhost), blocked-IP enforcement, per-IP 8/hour + 30/day and
  a global 4000/day cap through the existing atomic consumeRateLimit
  machinery; question ≤600 chars, history ≤8 turns ×300 chars; Gemini
  2.5 flash, temperature 0.4, maxOutputTokens 700, JSON answer contract
  {intro, steps[≤6], note}; 15s server budget, 9s client budget.
- **Key hygiene after the leaked-key incident:** the Gemini key lives
  ONLY in Convex env (GEMINI_API_KEY || GEMINI_DEMO_KEY), rides the
  x-goog-api-key header (never the URL), is never echoed in errors or
  logs; AI failures log status-only security events. Prompt injection
  contained: visitor text + client-supplied reference are declared
  untrusted inside the system prompt, which carries the rules (no
  invented statutes, general information not advice, no product pitch
  unless the visitor self-identifies, ignore persona-hijack attempts).
- **Frontend swap (AloaAssistantFab.tsx):** every question — free text
  AND chips — goes to the live engine first, with the best-matched
  curated topic riding along as grounding REFERENCE (owner-approved
  copy + the encoded Lagos Tenancy Law 2011 figures stay authoritative).
  On ANY failure (timeout, 429, 503, network) the panel answers exactly
  as before from the catalogue — it can never regress to silence — and
  two consecutive failures disable live answers for the session.
  send-button/isThinking double-submit guard added (the AloaChat
  double-send lesson applied at the landing surface too).
- **production-deploy.yml:** GEMINI_API_KEY gains the same
  secret-rotation path GEMINI_DEMO_KEY already had (no-op when the
  GitHub secret is unset — it never clears an existing Convex value).
  Rotating the platform key is now: set the GitHub secret, re-run the
  workflow — no dashboard surgery.

Gates: convex tsc 0; root tsc 0; eslint clean on changed files; vitest
+22 pins (tests/unit/landingChat.test.ts — CORS allow-list, history
sanitisation, reference serialisation bounds, JSON/fenced/garbage answer
parsing, prompt contract). Full suite: see commit.

## 2026-11-18 — Incremental dictation ("Add More") + Verbatim-badge overlap fix (PR #17)

**Founder reports:** (1) the Smart Clean/Verbatim toggle on the Voice-note-ready
card floated absolutely (top-2 right-2) OVER the transcript and covered the
first line of the transcription; (2) addendum — completed transcriptions must
stay in an editable draft with an "Add More" mic that appends further clips to
the same note, smart re-evaluation on appended text, and "Append by Voice" on
already-saved notes.

- **Overlap fix (TriageCard):** the toggle now lives in a header row ABOVE the
  (now editable) draft textarea — no absolute positioning remains in the card,
  so text can never be covered.
- **Draft/staging state:** transcript is an editable Textarea; draft state is
  owned by QuickCaptureView so it survives Add More rounds (the card unmounts
  while recording). Every action (save/diary/ask/copy/share) uses the draft —
  manual tweaks are respected; Re-sync resets to the backend tier.
- **Add More plumbing:** useQuickCapture.appendRecording() re-opens the SAME
  capture (same clientLocalId); recorder segment indexes offset past existing
  ones via the new `nextSegmentIndex` projection field (max index + 1 —
  gap-safe against dead-lettered segments), so backend (clientLocalId,
  segmentIndex) idempotency + index-ordered assembly append cleanly. Unlimited
  rounds; cancel discards ONLY the new clip (VoiceSyncManager.cancelAppendRound
  — the original capture is never purged); mid-session mic failure keeps the
  addition (close + finalize).
- **Smart re-evaluation:** each round's finalize re-runs Smart Clean + triage
  across the COMBINED verbatim — clip 2's "adjourned to Friday at 9 AM"
  surfaces as a Diary event on the refreshed card. Pristine Smart-Clean drafts
  adopt the re-polished combined text; edited drafts get the new clip appended
  via joinDraftText (never overwrites user words); Verbatim mode keeps every
  word of every clip chronological (extractNewClipText rides the immutable-
  prefix invariant of the verbatim tier). Save-after-append UPDATEs the same
  note page instead of duplicating.
- **Append by Voice (NoteEditor):** compact toolbar button (ui/Button
  primitive — the first cut used a raw <button> and tripped the ADR-0004
  ratchet gate in CI, fixed in 614e2c03) parks the cursor at the note's end,
  drops a timestamp separator (— Appended Wed 18 Nov 2026, 14:32 —), and
  dictates after it through the same backend engine; the stop ceremony
  re-cleans the COMBINED raw transcript (both tiers update).
- **Drive-by:** dead-lettered segments no longer block finalize forever
  (remaining.length check) and are swept post-finalize.

Gates: tsc 0; eslint clean; ui-primitives ratchet held (2218 = baseline);
vitest +15 pins (45 in tests/unit/voiceCapture.test.ts — extractNewClipText,
joinDraftText, appendSeparatorLabel, cross-round assembly). Full suite 2903
passing. PR #17 all checks green (Tests, E2E smoke, CodeQL, Playwright).
Merged b6fb0a15 → APK release build-1199 (practicepro-1.0.801-release.apk) +
staging deployed. Known pre-existing: "Workers Builds: practiceprovega" check
has been failing on every non-[skip ci] main commit since before this PR
(stale Cloudflare git integration, fails in 0s, unrelated to app code).

### 2026-11-18 (ii) — PR #18: obvious delete, grounded Quick Ask, Full Office default, ALOA unified home

Owner addendum ("HOW DO WE DELETE A QUICK CAPTURE? IT IS NOT OBVIOUS" + the
startup default / ALOA placement / one-tap launch preference):

- **Delete is a first-class action.** Every Recent-voice-notes row carries a
  trash button (two-tap inline confirm); the triage card gains a Discard
  action (two-tap confirm). Delete removes the Convex capture row + archived
  audio AND purges any segments still queued in IndexedDB; if the open card
  was the deleted capture the staging area resets. Notes already saved into
  a matter are separate records and are kept (stated in the confirm tooltip).
  The backend deleteCapture mutation already existed — the gap was pure UI.
- **Quick Ask grounding fix** ("I asked how many matters I have and it said I
  have no matters"): retrieval was keyword-only and the prompt LED with
  "MATCHED MATTERS: (none)" — for generic questions (how/many/matters/have)
  nothing matches a title, and the model read the empty subset as an empty
  firm. The context now leads with an authoritative FIRM DATA SUMMARY
  (total/active/closed counts, notes, upcoming events) + a compact matter
  inventory (first 25); keyword sections are labelled "subset filtered by
  the question's words — of N on record; empty here means no title matched
  the wording, NOT that the firm has none". Extracted to exported pure
  buildQuickAskContext() + QUICK_ASK_SYSTEM_PROMPT; +7 vitest pins
  (counts lead, inventory caps at 25/30, subset labelling, case-insensitive
  status buckets, genuine-empty wording, system-prompt contract).
- **Startup default reversed:** everyone — new users, first launches, phones
  — opens the Full Office Dashboard. 'auto' now behaves as 'office'; the
  boot redirect only fires for preference==='capture' AND phone-like
  devices. New "Start in Quick Capture on mobile" toggle lives directly in
  the Quick Capture header strip (OFF by default, per-account localStorage,
  same key as Settings → Display; phone-like devices only). Persistent
  "Full Office" button stays in the top corner (relabeled from "Open Full
  Office").
- **ALOA unified home:** AloaPanel gained a top-level mode (chat | capture).
  A mic button in the ALOA chat header switches to the embedded
  QuickCaptureView (new props: embedded/onBackToChat/onExitEmbedded —
  back-to-ALOA chip, "ALOA · Quick Capture" title, Full Office exits the
  panel for the dashboard). useAloa().openPanel('capture') +
  panelInitialMode added (backward-compatible signature).
- **One-tap launch:** emerald mic button in the top navigation Header (all
  breakpoints) and a Quick Capture card at the top of the mobile Dashboard
  (md:hidden) — both open the ALOA panel straight into capture mode.
- **ADR-0004:** all new buttons are the ui/Button primitive ('bare' variant
  for the one-off emerald looks — same escape hatch QuickNote-era code
  uses); the header switch uses the app's div/role="switch" pattern
  (DisplaySettings Toggle) with tabIndex + Enter/Space keydown. Ratchet held
  at 2218 — a first cut used raw <button>s and tripped the gate (+5,
  including one literal "<button>" inside a comment that the counter
  regex-matched; all migrated in acdea6f0's follow-up edits before push).

Gates: tsc 0; eslint 0 errors; ui-primitives ratchet held (2218); vitest
2910 passing (+7); vite build green. PR #18.

### 2026-11-18 (iii) — production Convex finally deployed (targeted path) + Gemini key rotation

The full "Deploy to Production (promote)" pipeline has NEVER succeeded (all
runs fail), and since ca7cb740 added the staging release gate they fail even
earlier: staging Convex was never provisioned (CONVEX_STAGING_DEPLOY_KEY /
CONVEX_STAGING_URL are unset — one-time owner setup, ~2 min in the Convex
dashboard). Meanwhile the production APK talks DIRECTLY to production Convex
(gregarious-malamute-537), so backend fixes were stuck: Quick Ask grounding,
the PR #17 voice pipeline, even the leaked-key rotation path could not ship.

Unblock (PR #18 follow-up, a5f18b10 + e4ae1678):

- New targeted workflow `convex-production-deploy.yml` (workflow_dispatch):
  deploys ONLY the Convex production backend with the SAME quality gate the
  promote runs (convex + root typecheck, identity audit, ADR-0004 ratchet,
  unit tests) and the SAME deploy + GEMINI key rotation + SITE_URL + live
  myFunctions:ping probe steps. Frontends (Vercel/Cloudflare) stay on the
  promote path. First run failed with "No CONVEX_DEPLOYMENT set" — the
  CONVEX_DEPLOY_KEY must be at JOB level (same as the promote), fixed in
  371cd96a. Run #2 green end-to-end.
- GEMINI_API_KEY added as a GitHub secret (owner-provided platform key) and
  rotated onto the production Convex environment by the deploy — closes the
  standing "set up the new Gemini key in production" task; Quick Capture /
  ALOA / transcription / landing chat now spend the healthy key.
- Live probe after deploy: myFunctions:ping → {"status":"success"}.
- APK build-1202 (practicepro-1.0.804-release.apk) built green on the merged
  main; combined with the deployed backend, Quick Ask counts + delete +
  startup default + ALOA home are live for the APK.

Still open (owner, one-time): provision the staging Convex project + the two
secrets, then the full promote (with Vercel + Cloudflare frontends) can run —
and the targeted workflow can be retired. Frontend production promotion
remains blocked on that staging setup (production WEB is still served by
Vercel's own git integration from main pushes).

### 2026-11-18 (iv) — PR #19: Quick Capture intelligence upgrade

Owner spec "Upgrade Quick Capture Intelligence" — the analysis layer behind
the voice pipeline is now context-aware (semantic matching, relative dates,
multi-intent, action-capable Quick Ask):

- **§1 Live context:** every analysis call (initial + each Add More round)
  gets the exact WAT date/time with PRE-RESOLVED anchors ("tomorrow" /
  "in 3 days" / "next week" = real dates) and a rich matters DIRECTORY —
  clientName (contacts join) + parties + court, ACTIVE matters first
  (listFirmMattersInternal extended).
- **§2 Semantic matching:** the LLM ranks matters with confidence + reason
  ("the Chukwu file" → party match); rankAndValidateMatterMatches() drops
  conjured ids, merges the containment backstop at 0.5, caps at 3. The card
  AUTO-SELECTS the top match and shows 1-tap disambiguation pills (% +
  reason tooltip) beside the full dropdown.
- **§3 Relative dates + tasks:** implied follow-ups ("follow up with
  registry") become diary events; unspoken times default 09:00/14:00/17:00
  flagged timeEstimated; every event row inline-editable (ui/Input date +
  time pickers). ZERO DEAD-END: no dates → inline quick-schedule form
  prefilled (summary, matched matter, tomorrow 09:00) replaces the old
  "add manually" message.
- **§4 Multi-intent:** one JSON extracts summary/intent/matterMatches/
  events/isDiaryTask/endorsement/questionText. Card shows Case Note + Diary
  TOGGLES (both on simultaneously) with unified CTA "Save Case Note & Add
  to Diary"; courtroom endorsement panel (court/suit/parties/judge/orders)
  with 1-tap "Add adjourned date to Diary".
- **§5 Action-capable Quick Ask:** tool protocol (create_event / save_note)
  in a strict-JSON envelope; validateQuickAskActions() sanitises (unknown
  types dropped, real YYYY-MM-DD required, matterId must exist in-firm,
  ≤3 actions); writes via ownership-stamped internal mutations
  (created_by/authorId). New QuickAskActions component renders a
  confirmation card per created item with View + one-tap Undo;
  undoQuickAskAction re-verifies firm scope + creator + 15-min window.
  quickAsk FIRM DATA SUMMARY inventory now carries matter ids for action
  referencing.

Convex gotchas (both fixed + documented inline): events/notePages have NO
legacy `id` column (schema is stricter than matters); a public mutation
returning ctx.runMutation(internal.…) directly triggers the TS7022
ApiFromModules circular degradation (legal/search.ts collapsed to {}) —
explicit handler return annotation breaks the cycle.

Gates: convex tsc 0; root tsc 0; eslint 0 errors; ratchet held 2218; vitest
2929 (+19: addDaysISO, buildAnalysisPrompt anchors/directory/time-rules,
backstop merge incl. the Chukwu-ambiguity disambiguation case, action
sanitisation, prompt tool contract); vite build green. PR #19.
