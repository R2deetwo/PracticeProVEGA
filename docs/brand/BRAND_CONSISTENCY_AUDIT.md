# Brand Consistency Audit — Phase 0

> Round: Brand Clarity Pass (2026-11-18) · Owner direction: *"PracticePro is
> now the company that owns those tools; Vega and Atrium are the apps."*
> Standard: `docs/brand-architecture.md` (W0, active). This audit inventories
> every surface where the company/products model is currently applied
> incorrectly, partially, or not at all.
>
> Verdict legend: **OK** = compliant with the standard · **DEFECT** = actively
> wrong (misbrands a product as the company or vice versa) · **GAP** = not
> wrong, but the product identity is missing where it should exist.

## 1. Executive summary

The **public website is compliant** (enforced by
`tests/unit/corporateIdentity.test.ts` and
`tests/unit/websiteRepositioning.test.ts` since W1–W5). The jumble the owner
experienced lives in **everything those tests do not cover**: the Android
wrapper, the APK distribution pipeline, the in-app splash end-card, and the
operator docs. One defect (S1) is a half-built feature — the splash already
*receives* a `product` prop from `App.tsx` but never reads it, and the value
it receives is itself computed by a dead comparison (`product === 'property'`
can never be true after `ProductContext` canonicalization, so every firm —
including Atrium firms — resolves to `'vega'`).

Highest-impact items: **S1** (splash end-card), **A1–A4** (wrapper + APK
naming + debug-build distribution), **D1–D3** (docs).

## 2. Surface inventory

### S — Splash & app identity (in-app)

| # | Surface | Location | Current | Correct per standard | Verdict | Effort |
|---|---|---|---|---|---|---|
| S1 | In-app cinematic splash | `src/components/SplashScreen.tsx` | Declares `product?: 'practicepro' \| 'vega' \| 'atrium'` but **never destructures or reads it**. Always ends on the company logo in hub green + "Ready". | Sequence keeps its choreography; the final settle frame resolves to the product mark + name (Vega / Atrium / Komplete), company mark for logged-out. | **DEFECT** | M |
| S2 | Splash product mapping | `src/components/App.tsx:1933` | `product === 'property' ? 'atrium' : 'vega'` — `'property'` is impossible post-`ProductContext` aliasing, so **Atrium firms get `'vega'`**; `'unified'` maps to `'vega'` instead of a Komplete end-card; `'komplete'` missing from the union. | `product === 'atrium' ? 'atrium' : product === 'unified' ? 'komplete' : 'vega'`. | **DEFECT** | S |
| S3 | Portal splash mapping | `src/components/App.tsx:1589` | Client portal → `'vega'`, tenant portal → `'atrium'`. | Correct already (dead only because of S1). | OK (blocked by S1) | — |
| S4 | Komplete mark component | `src/components/marketing/brand/ProductMarks.tsx` | Only `VegaMark` and `AtriumMark` exist; `ProductMark` union is `'vega' \| 'atrium'`. Static favicon exists (`public/brand/komplete/favicon.svg`, twin coins) but no in-app component. | Add `KompleteMark` (twin coins, token-driven) + extend `ProductMark`. | **GAP** | S |
| S5 | In-app tab identity | `src/components/marketing/brand/useProductBranding.ts` (`useAppProductIdentity`) | Per-product favicon + title already resolved from the firm record. | Already correct. | OK | — |
| S6 | Founder splash | `src/admin/FounderSplashScreen.tsx` | Company-branded. | Correct — the founder app is a company tool, not a product. | OK | — |
| S7 | Splash "Ready" + status copy | `SplashScreen.tsx` | Company-voiced. | Keep company-voiced; the product end-card carries the product name. | OK | — |

### A — Android wrapper & APK distribution

| # | Surface | Location | Current | Correct per standard | Verdict | Effort |
|---|---|---|---|---|---|---|
| A1 | Home-screen label | `android/app/src/main/res/values/strings.xml` | `app_name` = "PracticePro" for the single user APK. | Universal build keeps "PracticePro"; per-product variants carry "Vega" / "Atrium" / "Komplete" (same `applicationId`). | **GAP** | S |
| A2 | Capacitor app name | `capacitor.config.ts` | `appName: 'PracticePro'`. | Same as A1 (per-product configs). | **GAP** | S |
| A3 | APK artifact names | `.github/workflows/build-apk.yml` ("Rename APK") | `PracticePro-v${VERSION}.apk` — company-named, no channel suffix; per-product names absent. | `<product>-<version>-<channel>.apk` lowercase: `practicepro-1.0.791-release.apk`, `vega-…`, `atrium-…`, `komplete-…`; founder `practicepro-founder-…`. | **DEFECT** | S |
| A4 | **Distributed build type** | `build-apk.yml` line ~311 | Publishes **`app-debug.apk`** as the Release asset + `version.json.apkUrl` — debuggable, debug-signed. Debug signature is *stable* only because `debug.keystore` is deliberately committed. | Publish the `assembleRelease` output, release-signed from a base64 GitHub secret. Until the secret exists, keep the debug fallback (stable signature) with a loud warning — switching signatures forces a one-time reinstall for the installed base. | **DEFECT** | M |
| A5 | Release keystore in CI | `build-apk.yml` "Generate release.keystore if missing" | Generates a **new random keystore per run** on ephemeral runners. If release builds were distributed today, every build would carry a different signature → Android update installs would fail. | Decode `RELEASE_KEYSTORE_BASE64` secret; delete the generate-if-missing path for release. One-time setup documented in the runbook. | **DEFECT** | M |
| A6 | Native splash | `capacitor.config.ts` + `android/app/src/main/res/drawable*/splash.png` | Company green `#16A34A`, company logo, all densities. | **Stays company-branded** (owner likes the PracticePro opening; the *end* of the sequence is the product's). Per-product variants may adopt product-colored splash later — not required by the owner's direction. | OK | — |
| A7 | Launcher icon | `android/app/src/main/res/mipmap-*/ic_launcher*.png`, `drawable/ic_launcher_foreground.xml` | Company P on green (adaptive + legacy PNGs). | Per-product variants swap the launcher set (company set remains the committed default). | **GAP** | M |
| A8 | applicationId / package | `build.gradle`, `strings.xml` | `com.practicepro.app` everywhere. | **Unchanged** for all variants (installed base, FCM, deep links). Play Store listings would need per-listing appIds — future decision, out of scope. | OK (guardrail) | — |
| A9 | Download channel | GitHub Releases (public, no login) + Actions artifacts (login required, zip-wrapped) | Both exist; the owner was using the artifacts page (no download button on logged-out mobile; the zip is what desktop antivirus flagged). | Releases = the canonical human channel (already wired via `version.json.apkUrl` + `useApkVersionCheck`). Artifacts = CI debugging only. A public download page is follow-up work. | **GAP** (process) | S |
| A10 | Founder APK publication | `.github/workflows/build-admin-apk.yml` | No `gh-release` step — artifacts only. | Correct: the founder APK must never be a public release asset. | OK | — |
| A11 | Antivirus false positive | N/A (external) | Windows Defender `!ml` flagged minified JS chunks inside the APK zip. | Operator submits a developer dispute at microsoft.com/wdsi/filesubmission per affected version; do not upload proprietary bundles to public scanners. Play Store distribution is the structural fix. | **GAP** (operator task) | S |

### C — In-app copy

| # | Surface | Location | Current | Correct per standard | Verdict | Effort |
|---|---|---|---|---|---|---|
| C1 | Legal documents (Privacy, Terms, DPA, Cookies) | `src/components/PrivacyPolicy.tsx`, `TermsOfService.tsx`, `DataProcessingAgreement.tsx`, `CookiePolicy.tsx` | Company-named entities ("PracticePro Systems Limited…") — audited by `corporateIdentity.test.ts`. | Compliant; no change. | OK | — |
| C2 | Email branding | `convex/emailBranding.ts` | "…via PracticePro" footer + "Powered by PracticePro Systems" — the product→company attribution mark. | Compliant; no change. | OK | — |
| C3 | Onboarding wizard / workspace setup | `src/components/modals/OnboardingWizard.tsx`, `WorkspaceSetupModal.tsx` | Mixed company/product voice (63 component files reference PracticePro; most are legitimate attribution or storage keys). | Product surfaces name the product; company answers "who builds it". Sweep is desirable but needs per-string judgment — **deferred to a follow-up round**; the ratchet tests already guard the worst regressions. | PARTIAL | M |
| C4 | Assistant naming | `src/utils/assistantIdentity.ts` (authority) | ALOA = Vega only, ARIA = Atrium only. | Compliant; guardrail stays. | OK | — |
| C5 | Share/WhatsApp templates | `convex/whatsappTemplates.ts` | No company/product misattribution found in sender framing. | Compliant. | OK | — |
| C6 | PWA meta | `index.html` | `apple-mobile-web-app-title` = "PracticePro", company favicon. | Correct for the universal build. | OK | — |

### D — Documentation & agent context

| # | Surface | Location | Current | Correct per standard | Verdict | Effort |
|---|---|---|---|---|---|---|
| D1 | README product naming | `README.md` | Hierarchy right; says "Vega OS / Atrium OS" while the standard's full names are "PracticePro Vega / PracticePro Atrium". | Align short forms with §2 of the standard; keep the parent/products diagram. | PARTIAL | S |
| D2 | Agent orientation | `AGENTS.md` | Correct three-surface model, but no pointer to `docs/brand-architecture.md`; future agent sessions have no brand-rules contract. | Add a Brand rules section pointing at the standard. | **GAP** | S |
| D3 | Task routing context | `CONTEXT.md` | Not audited line-by-line; not brand-focused. | Add the same brand-rules pointer. | **GAP** | S |
| D4 | Root guides | `RUNBOOK.md`, `ALOAGUIDE.md`, `DEV_TOOLKIT.md`, etc. | Mixed usage (company name as product shorthand in places). | Sweep deferred with C3 — the standard + AGENTS pointer govern new writing; old text is corrected opportunistically. | PARTIAL | M |
| D5 | Brand docs | `docs/brand-architecture.md`, `docs/brand/{vega,atrium}.md` | The standard itself. | Compliant (is the standard). | OK | — |
| D6 | Repo name | `github.com/R2deetwo/PracticeProVEGA` | Jumbled, but renaming is out of scope per guardrails. | Documented as known debt. | DEFERRED | — |

### W — Website (regression check only)

| # | Surface | Verdict |
|---|---|---|
| W1 | Hub (`src/sites/hub/`) — speaks as the company | OK (pinned by `websiteRepositioning.test.ts`) |
| W2 | `/vega`, `/atrium` product pages — name the product, Built-by attribution | OK (pinned) |
| W3 | Structured data — Organization + per-product SoftwareApplication nodes | OK (pinned) |

## 3. What this round fixes (Phases 1–5)

1. **Phase 1** — S1, S2, S4: splash end-card resolution + Komplete mark + the
   App.tsx mapping fix, pinned by tests.
2. **Phase 2** — A1–A5, A7, A9: per-product wrapper variants (appName, launcher
   mark, artifact name; `applicationId` untouched), release-signed distribution
   with a stable keystore secret and debug fallback, Releases as the canonical
   channel.
3. **Phase 3** — D1, D2, D3: README naming, AGENTS/CONTEXT brand-rules sections.
4. **Phase 4** — regression pins for every fix above.
5. **Phase 5** — `docs/brand/BRAND_CLARITY_RUNBOOK.md` (build commands,
   keystore setup, signing-migration warning, antivirus dispute procedure).

Deferred by design: C3/D4 copy sweep (needs per-string judgment, next round),
A6 per-product native splash color (not required by owner direction), D6 repo
rename, Play Store listing (own project).

## 4. Open decisions (gate A resolved, gate B resolved)

- **Gate A — logged-out end card:** company mark + "Vega · Atrium · Komplete"
  lockup (teaches the two-products-plus-bundle model). Switchable in
  `src/components/splashEndCard.ts`.
- **Gate B — packaging:** per-product wrapper variants **sharing
  `com.practicepro.app`** (owner's stated preference), alongside the universal
  build. Play Store per-listing appIds remain a future, explicit decision.
