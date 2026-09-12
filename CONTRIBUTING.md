# Contributing to PracticePro VEGA

Thank you for contributing! This document covers the workflow, quality gates,
and conventions every change must follow before it reaches production.

## Repository layout

| Path | What lives here |
|------|-----------------|
| `convex/` | Backend — Convex functions, schema, crons, http routes |
| `src/` | Frontend — React SPA (Vega / Atrium / Komplete product contexts) |
| `tests/unit/` | Vitest unit suite (CI gate: all must pass) |
| `scripts/` | CI helper scripts (identity audit, etc.) |
| `android/` | Capacitor APK wrapper |
| `.github/workflows/` | CI/CD: tests, staging, APK, production promote |

## Local development

```bash
npm ci                 # install
npx convex dev         # start the Convex dev backend + codegen
npm run dev            # Vite dev server
```

Useful checks before you push (these are the CI gates — run them locally
first, CI will reject otherwise):

```bash
npx tsc -p convex --noEmit   # MUST be 0 errors (hard deploy gate)
npx vitest run               # all tests must pass
npx tsc -b                   # app typecheck (baseline-guarded in CI)
python3 scripts/audit-identity.py   # R16 identity audit — must pass
```

## How changes reach production

1. **Push to `main`** → `tests.yml`, `staging-deploy.yml` (Convex staging +
   Vercel staging), and `build-apk.yml` run automatically.
2. **Production** is promoted manually: dispatch `production-deploy.yml`
   (Actions → Production Deploy → Run workflow; blank SHA = latest main).
   The promote re-runs every gate, deploys the Convex production backend and
   the Vercel production frontend, then health-verifies both.

Never push directly to production bypassing these gates.

## Non-negotiable rules

1. **Never trust caller-supplied identity.** Any public Convex function that
   needs identity must go through `requireFirmUser` / `requireAdmin` /
   `requireFounder` etc. **with a session token** — email-only args are
   spoofable. `scripts/audit-identity.py` fails the build on violations.
2. **Never commit secrets.** `.env*` files are gitignored; secrets live in
   GitHub Actions secrets / the Convex dashboard. If a secret ever lands in
   git, rotate it immediately — history rewriting is a last resort.
3. **Convex query hygiene.** Prefer `withIndex` + server-side predicates over
   `.filter()`; bound every list with `.take(n)` or pagination; compound
   indexes for `firmId + status` style access. Unbounded `.collect()` on
   firm-scoped hot paths is a scale bug waiting to happen.
4. **Errors must be actionable.** Provider/API failures surface the raw
   provider text (see `extractWaError` / `explainWhatsAppError`) — never
   swallow them into "Unknown error".

## Commit conventions

- Conventional commits: `feat(scope): …`, `fix(scope): …`,
  `docs: …`, `chore: …`, `test: …`.
- Reference the task/user report that motivated the change in the commit
  body when there is one — this repo's history doubles as its audit trail.
- Docs-only / worklog commits that should skip CI add the `[skip ci]`
  trailer.

## Multi-agent / AI contributor protocol

This repository is actively worked on by multiple AI agents and humans in
parallel. To keep that sane:

1. **Read `/home/z/my-project/worklog.md` before starting work** — the
   previous agent's deploy state and pending verification steps matter.
2. **Append your worklog entry when done** (never overwrite others') with
   the task ID, what you changed, how it was validated, and what remains.
3. **Verify live, don't assume.** A deploy is not "done" until the
   production health endpoint (`/version.json`) answers with your SHA, and
   behavior is confirmed against the real backend (e.g. the
   `WhatsApp Live Test` workflow for messaging changes).
4. **Reopen issues that regress.** If a user says something is not fixed,
   run the live diagnostic before re-theorizing.

## Testing expectations

- New pure logic gets unit tests in `tests/unit/`.
- New Convex functions: the module must typecheck with 0 errors and any
  exported pure helpers should be covered.
- WhatsApp/messaging changes: run the **WhatsApp Live Test** workflow after
  the production promote and paste the raw output into the worklog entry.

## Questions?

Check `RUNBOOK.md` (operations), `ARCHITECTURE.md` (system design), and
`SAAS_HARDENING_PLAN.md` (the hardening rounds this repo follows) first.
