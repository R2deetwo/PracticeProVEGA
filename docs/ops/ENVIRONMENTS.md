# Environments — the Convex deployment map

> One page, no hunting: which Convex deployment is which, where its key
> lives, and what is allowed to touch it. Established 2026-11-20 when the
> owner assigned the staging and Aloa X roles
> (**owner instruction: NEVER DELETE THE DEPLOY KEYS**).

| Role | Deployment | URL | Deploy key lives in | Who deploys |
|---|---|---|---|---|
| **Production** | `gregarious-malamute-537` | https://gregarious-malamute-537.convex.cloud | GitHub secret `CONVEX_DEPLOY_KEY` | `production-deploy.yml` / `convex-production-deploy.yml` (manual promote only) |
| **Staging** | `shiny-echidna-432` | https://shiny-echidna-432.convex.cloud | GitHub secret `CONVEX_STAGING_DEPLOY_KEY` (+ `CONVEX_STAGING_URL`) | `staging-deploy.yml` — every push to `main`, auto |
| **Aloa X** (reserved) | `groovy-mandrill-732` | https://groovy-mandrill-732.convex.cloud | GitHub secret `CONVEX_ALOAX_DEPLOY_KEY` (+ `CONVEX_ALOAX_URL`) | Nothing yet — reserved for the Aloa X supervisor backend (below) |
| **Dev** (local) | `keen-jaguar-204` | https://keen-jaguar-204.convex.cloud | local `.env.local` only (not in CI) | `npx convex dev` from a developer machine |

All four are in the same Convex account. The three CI-visible keys are
"dev"-prefixed deploy keys (`dev:<deployment>|<token>`): each can push
functions and set env vars on its own deployment, and nothing else —
they cannot delete deployments or touch each other.

## Aloa X — what the reserved deployment is for

Aloa X ("in charge of all the other apps and ensures that there are no
problems") currently exists as the **platform watchdog inside the main
backend** (`convex/alox.ts`, cron every 15 min, 11 health checks, founder
push alerts — shipped 2026-11-19, see the worklog). That watchdog must
stay on the production deployment it monitors: it reads production tables
(`error_events`, ingestion runs, financial reports, sessions), so it
cannot live on a separate database.

`groovy-mandrill-732` is reserved for the **standalone Aloa X surface**
when it grows one — the supervisor's own app/data (cross-app dashboards,
alert routing rules, incident history beyond what `alox_alerts` keeps
today). It is intentionally EMPTY right now: no functions deployed, no
env vars set (verified 2026-11-20). When the first Aloa X functions are
written, deploy with:

```bash
CONVEX_DEPLOY_KEY="$(gh secret? no — from the owner/key store)" \
  npx convex deploy
```

i.e. point `CONVEX_DEPLOY_KEY` at the `CONVEX_ALOAX_DEPLOY_KEY` value and
run `npx convex deploy` from the repo root. The secret pair
(`CONVEX_ALOAX_DEPLOY_KEY` / `CONVEX_ALOAX_URL`) is already in GitHub so a
future `aloax-deploy.yml` needs no further setup.

## Key custody rules

1. **Never delete a deploy key.** If a key must be rotated (suspected
   leak), create the replacement FIRST, swap the GitHub secret and the
   build agent's copy (`/home/z/my-project/config/convex-deploy-keys.env`,
   outside the repo), and only then retire the old one.
2. Keys are never committed to this repository (`.gitignore` covers
   `.env*`; the key store lives outside the repo).
3. A key's deployment is its whole world — there is no "master" key in
   CI. Production's key is used ONLY by the two promote workflows.
