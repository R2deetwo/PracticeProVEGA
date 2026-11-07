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

- Commit <SHA> pushed → CI → production promote: see below.
