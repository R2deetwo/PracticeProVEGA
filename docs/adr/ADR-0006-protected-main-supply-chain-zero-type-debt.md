# ADR-0006: Protected main, pinned supply chain, zero type debt

**Status:** Accepted (2026-11-18)
**Context:** Post-review hardening round following an external code review
(Copilot, 2026-11-18) and the Brand Clarity Pass landing.

## Decision 1 — `main` is protected (gate-lite, not PR-gated yet)

Branch protection on `main`:

- **Required status checks:** "Typecheck + unit tests" (the `tests.yml`
  quality gate: Convex tsc 0-error, root tsc 0-error, identity audit,
  design-token ratchet, UI-primitives ratchet, full vitest suite).
  Required on every PR into `main`.
- **No force pushes, no branch deletion.**
- **Direct pushes remain allowed (deliberate).** The reason: `build-apk.yml`
  pushes a `version.json` metadata commit back to `main` on every build via
  `GITHUB_TOKEN` (the `chore: update version.json … [build-N]` commits).
  "Require a pull request before merging" would block that bot push — and
  every existing installed APK fetches `version.json` from the deployed
  frontend built off `main`, so silently breaking the write-back breaks the
  in-app update feed for all users.

**Path to full PR-gating (two steps, deliberate order):**

1. Rework the `version.json` write-back so the APK bot no longer pushes to
   `main` (e.g. commit the manifest to a `release-manifest` branch and point
   the updater at `raw.githubusercontent.com` / the Release asset; ship one
   app release that carries the new URL).
2. Enable "Require a pull request before merging" (0 approvals — solo
   founder, self-merge allowed) once no bot depends on direct pushes.

Until then, the required checks still gate every PR, and force-push/deletion
protection guards history.

## Decision 2 — Supply chain pinned

- Every `uses:` in `.github/workflows/` is pinned to an **immutable 40-char
  commit SHA** (with a `# vX` version comment), resolved and verified
  2026-11-18: actions/checkout, actions/setup-node, actions/upload-artifact,
  actions/setup-java, softprops/action-gh-release.
- **Dependabot** (`.github/dependabot.yml`) opens weekly PRs for
  github-actions and npm (minor/patch only for direct deps; security for
  indirect). Dependabot PRs are themselves subject to the required checks.

## Decision 3 — The TypeScript baseline exception is removed

The root `tsc --noEmit` error baseline (94 in CI; 87 actual; 153 in stale
docs) was burned down to **0 errors** on 2026-11-18 across ~40 files, and
the `ERROR_BASELINE` escape hatch was deleted from all four gated workflows
(`tests.yml`, `staging-deploy.yml`, `production-deploy.yml`, `build-apk.yml`).
The gate now fails on ANY new type error. Real bugs the debt was hiding:

- `useApkVersionCheck.ts` read `info.version.build` (a property of a
  *string*) — every device parsed its local versionCode as 0, so the update
  prompt compared `remote <= 0` and nagged on every check. Now reads
  `info.build` (Capacitor `AppInfo`).
- `TrialNudgeBanner.tsx` navigated to `'messages'` — not a member of the
  `View` union (`'messaging'`); the Day-7 CTA was a no-op.
- `WordProcessor → DraftProEditor` passed a bare array where the prop
  contract is `{ citations: any[] }` — research citations never hydrated.
- `loginAsDemoUser` was typed `=> void` while it returns a result object;
  the demo-failure branch in `LeadCaptureModal` was untypeable dead code.

Type-only completions (optional fields added to local interfaces: `Property`
`name`/`type`, `ChatMessage.matterId`, `ClientMessage.conversationId`,
`ResearchSource/Message/StudioAnalysisResult._id`, `User.tokenIdentifier`,
`FirmDetails._id`, `FounderUser.firmId`, `RealEstateSpecialtyData.unitId`,
`rentalDetails.unitDescription`) document existing runtime shapes; they do
not change behavior.

## Decision 4 — Staging is a hard gate on production promotion

`production-deploy.yml` now refuses to promote unless (a) the staging Convex
secrets exist and (b) the staging alias serves a healthy build. Previously
the staging workflow silently skipped its deploy when unconfigured (green
run, nothing deployed), making "verify on staging first" unenforceable.
Per-push staging behavior is unchanged (quality gate always runs; deploy
skips loudly with setup instructions until the one-time Convex staging
project exists). Staging may be AHEAD of the promoted sha — the gate
requires health, not sha equality.

## Decision 5 — The Cloudflare mirror is best-effort

`CLOUDFLARE_API_TOKEN` expired twice (2026-09-02, again by 2026-11-18) and
each lapse red-X'd every production promotion while Vercel + Convex (the
real production) were healthy. The `deploy-cloudflare` job now SKIPS with a
loud warning and exact restore steps when secrets are missing or the token
is unusable; only a deploy/verify failure with a WORKING token fails the
run. Production truth = Vercel + Convex; the watchdog continues reporting
mirror staleness. Restoring the mirror is a 5-minute token rotation.

## Consequences

- Any new `tsc` error red-X's every gate (tests, staging, APK, promote) —
  by design; debt is no longer permitted to accumulate.
- Dependabot PRs will appear weekly; review with the required checks in
  place, merge deliberately (majors stay manual).
- When Decision 1's two-step path completes, direct pushes to `main` close
  for everyone, completing the review's "protect main" recommendation.
