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
