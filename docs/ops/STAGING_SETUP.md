# Staging environment — CONFIGURED (went live 2026-11-20)

> Status: **live.** The staging Convex backend is `shiny-echidna-432`
> (https://shiny-echidna-432.convex.cloud), wired via the GitHub secrets
> `CONVEX_STAGING_DEPLOY_KEY` + `CONVEX_STAGING_URL` on 2026-11-20.
> Every push to `main` now auto-deploys staging (backend + Vercel preview
> alias `staging-practice-pro-vega.vercel.app`), and the production
> promote gate's "staging must exist" precondition is satisfied.

Staging is a full, isolated copy of the app: its own Convex deployment,
its own Vercel preview URL (`staging-practice-pro-vega.vercel.app`). Test
payments, auth experiments and risky changes land there first; production
only changes after staging is verified healthy.

## What was done (2026-11-20, the one-time setup — now complete)

1. Owner provided the deploy key for the Convex deployment
   `shiny-echidna-432` (role: **staging** — previously this deployment
   held an older copy of the backend; the first staging deploy refreshed
   its functions; its existing env vars `GEMINI_API_KEY` /
   `PracticePro_Vega_Mailer` were preserved).
2. Build agent verified the key (`npx convex env list` against the
   deployment) and set the GitHub secrets:
   - `CONVEX_STAGING_DEPLOY_KEY` = the deploy key
   - `CONVEX_STAGING_URL` = `https://shiny-echidna-432.convex.cloud`
3. Pushed to `main` → `staging-deploy.yml` ran its first real deploy:
   quality gate → `npx convex deploy` to shiny-echidna-432 → Vercel
   preview build wired to the staging URL (bundle verified NOT to point
   at production) → alias `staging` pinned → health check.
4. `Seed Staging Data` (`staging-seed.yml`) can now be run to populate
   demo/test data.

## Key custody (owner instruction: NEVER DELETE THESE KEYS)

- The staging deploy key is stored in: (a) the GitHub secret
  `CONVEX_STAGING_DEPLOY_KEY`, (b) the build agent's private config store
  (`/home/z/my-project/config/convex-deploy-keys.env`, outside the repo),
  and (c) the owner's own records. It must never be deleted or rotated
  without replacing all three.
- A "dev" prefixed deploy key (`dev:<deployment>|<token>`) can push
  functions and set env vars on its deployment — everything the staging
  workflow needs.

## What staging is NOT allowed to do

- Talk to the production Convex backend (the workflow hard-fails such a build).
- Receive real Paystack live keys (test keys only — that is its purpose).
- Serve users: the staging URL is for verification, the promote gate reads its
  health, nothing else points at it.

## History

- 2026-11-18 (Round 20): the promote gate began refusing production
  frontend releases while staging did not exist; the workflow ran in
  "skipped (green, with instructions)" mode until today.
- 2026-11-20: staging configured and live — see above. The four-environment
  map (production / staging / Aloa X / dev) now lives in
  `docs/ops/ENVIRONMENTS.md`.
