# Developer Toolkit — Commands, Scripts & Conventions

Everything a developer needs to build, audit, and deploy PracticePro.

---

## 1. Everyday commands

```bash
npm run dev                # Vite dev server (http://localhost:5173)
npm run dev:staging        # dev server in staging mode
npm run build              # production build → dist/ (includes version manifest + CSS cache-bust + health mark)
npm run preview            # preview the production build
npm run lint               # eslint (max-warnings 0)
npx tsc --noEmit           # typecheck
```

> **TypeScript baseline:** the codebase carries a known-error baseline of **153** (`tsc --noEmit | grep -c "error TS"`). Never let it increase; fixing pre-existing errors is welcome, adding new ones is not.

> **Lint guard:** the ESLint config includes `no-restricted-syntax` rules from past audits (e.g. flagging new `rounded-xl` string literals — the radius scale is `md/lg/2xl`; see STYLE_GUIDE.md).

## 2. Mobile (Android / Capacitor)

```bash
npm run cap:sync           # build web + sync into android/
npm run cap:open           # open Android Studio
npm run apk:debug          # debug APK
npm run apk:release        # release APK (needs RELEASE_* signing vars — see .env.example)
# Founder/Admin app variants:
npm run cap:sync:admin     # build admin bundle + sync
npm run apk:admin:release  # release founder APK
```

App IDs: user APK `com.practicepro.app`, founder APK `com.practicepro.admin`.

## 3. Audit suites

```bash
node scripts/landing-page-audit.cjs          # landing page crawler (sections, nav, JSON-LD, pricing)
AUDIT_PRODUCT=vega  node scripts/product-page-audit.cjs
AUDIT_PRODUCT=atrium node scripts/product-page-audit.cjs
npm run audit:app                            # agent-audit.ts
npm run audit:all                            # master 10-domain audit suite
npm run dev-report                           # development report
```

Reports land in `./audit-results/` (`landing-report.json`, `product-*-report.json`, `master-report.json`, `screenshots/`).

## 4. Deploy

**Push to `main`** — GitHub Actions handles the rest:

| Workflow | What it deploys |
|----------|-----------------|
| `vercel-deploy.yml` | Frontend → Vercel |
| `cloudflare-deploy.yml` | Frontend → Cloudflare Workers (wrangler) |
| `build-apk.yml` | Android APK + **Convex backend** (`npx convex deploy`) |

Manual: `npx convex deploy` / `npx vercel --prod` / `CLOUDFLARE_API_TOKEN=… npx wrangler deploy`.

**CSS cache-busting note:** `scripts/bust-css-cache.cjs` rotates the CSS asset URL per deploy — this cures a Cloudflare edge-cache issue where a stale `index.html` served references to missing hashed assets. Do not remove this step from the build.

## 5. Key conventions

- **Convex filter methods:** the installed Convex version (1.40.x) FilterBuilder supports `eq / neq / lt / lte / gt / gte / or / and`. It does **NOT** support `startsWith`/`endsWith`/`includes` — using them crashes the function at runtime (this caused a full production outage on 2026-08-31). Filter prefix-matching in JS instead. Never write `(q: any)` casts in filter callbacks — they hide nonexistent APIs from TypeScript.
- **Plan/tier changes:** edit `src/constants/tiers.ts` AND its server mirror `convex/tierLimits.ts` together, then update the README pricing table.
- **AI prompts** live in `/ai/prompts/*.md` (ICM methodology), loaded via `?raw` imports (`src/constants/loadPrompts.ts`) — edit prompts there, not in code.
- **Security helpers:** `requireFirmUser()` / `requireEstateCommunity()` / `requireAdmin()` in `convex/authHelpers.ts` gate every server function that touches firm data.
- **Worklog:** append to `worklog.md` (format: Task ID / Agent / Task / Work Log / Stage Summary) — it is the multi-agent memory of this repo.

## 6. Repo map (quick orientation)

- `convex/` — backend (48 modules: `myFunctions.ts` core, `portals.ts`, `estateCommunity.ts`, `visitorManagement.ts`, `retainerBilling.ts`, `trustAccount.ts`, `search.ts`, …)
- `src/components/` — 82+ components (atrium/, aloa/, client/, tenant/, portal/, documents/, settings/, admin/)
- `src/agents/` — AI agent modules (AgencyHub, Research, Drafting, Jurisdiction, ScaleOfCharges, DataProtection, …)
- `src/constants/tiers.ts` — pricing source of truth
- `scripts/` — build/audit/deploy tooling (.cjs and .ts)
- `android/` — Capacitor project
- `ai/prompts/` — versioned AI prompt files (ICM)

## 7. Environment

Copy `.env.example` → `.env.local`. The required var is `VITE_CONVEX_URL`. Optional: `VITE_GEMINI_API_KEY` (AI features), `VITE_POSTHOG_KEY` (analytics), `VITE_SENTRY_DSN` (crash reporting). Android signing vars are documented in `.env.example` too.
