# Staging environment — one-time setup (owner action required)

> Why this matters: the production promote gate (Round 20, 2026-11-18) **refuses
> to deploy the production website while staging does not exist**. Until staging
> is set up, `practice-pro-vega.vercel.app` cannot receive new frontend releases
> through the normal "Deploy to Production (promote)" workflow. The Convex
> backend is unaffected (it deploys independently).

Staging is a full, isolated copy of the app: its own Convex backend, its own
Vercel preview URL (`staging-practice-pro-vega.vercel.app`). Test payments,
auth experiments and risky changes land there first, production only changes
after staging is verified healthy.

## What already works (no action needed)

- `staging-deploy.yml` runs on every push to main: full quality gate, then it
  waits for the two secrets below. Until they exist it skips the deploy
  (green, with a visible summary) — it must never deploy a frontend that
  talks to the production backend.
- `production-deploy.yml` checks staging health before promoting.
- The e2e auth suite (`tests/e2e/staging-auth.spec.ts`) auto-activates once
  `STAGING_URL` exists.

## The one-time setup (~5 minutes, dashboard only)

1. **Create the staging Convex project**
   - Go to https://dashboard.convex.dev → your account → **+ New project**
   - Name it `practice-pro-vega-staging` (any name works; this one is clear)
   - Open the new project → **Settings → API keys / Deploy keys** → create a
     **Production deploy key** for it → copy the value
     (looks like `deploy:practice-pro-vega-staging|eyJ...`)
2. **Copy its deployment URL**
   - On the staging project's dashboard home: `https://<name>.convex.cloud`
3. **Add both as GitHub secrets**
   - https://github.com/R2deetwo/PracticeProVEGA/settings/secrets/actions
   - `CONVEX_STAGING_DEPLOY_KEY` = the deploy key from step 1
   - `CONVEX_STAGING_URL` = the deployment URL from step 2
   - (Paste both to the build agent and it can do this step for you.)
4. **Trigger the first staging deploy**
   - Re-run the "Deploy to Staging" workflow (Actions tab → Deploy to Staging
     → Run workflow), or push any commit to main.
   - It deploys the staging Convex backend + the Vercel staging alias and
     verifies the build points at the staging backend.

After that, "Deploy to Production (promote)" works again end to end.

## Cost note

A second Convex project sits on Convex's free tier (Hobby) until usage grows;
the Vercel staging alias is a preview deployment on the existing Vercel
project. If Convex's free tier limits become a problem, the staging project
can share the paid tier later — the workflow only needs the deploy key and URL.

## What staging is NOT allowed to do

- Talk to the production Convex backend (the workflow hard-fails such a build).
- Receive real Paystack live keys (test keys only — that is its purpose).
- Serve users: the staging URL is for verification, the promote gate reads its
  health, nothing else points at it.
