# RUNBOOK — PracticePro (Vega / Atrium / Komplete)

**Audience:** whoever is on call (today that's the founder; tomorrow it
should be anyone with repo access). Written 2026-09-05 during Round 17 of
the SaaS hardening program. Assumes access to: this GitHub repo, the
Vercel project, the Convex dashboard (gregarious-malamute-537), and the
Play/Android signing keystore for APK builds.

**Sister docs:** `ARCHITECTURE.md` (system map), `SAAS_HARDENING_PLAN.md`
(program status), `worklog.md` (round-by-round decisions + evidence).

---

## 1. The 60-second orientation

| Thing | Where |
|---|---|
| Production frontend | https://practice-pro-vega.vercel.app |
| Production backend | Convex `gregarious-malamute-537` (https://gregarious-malamute-537.convex.cloud) |
| Staging | ⏸ Not configured yet — see §8 |
| Cloudflare mirror | https://practice-pro-vega.prototypechigo.workers.dev — **frozen** (see §9) |
| Android APK | GitHub Releases (`build-apk.yml` workflow) |
| Health check | `version.json` on any frontend target (sha + status) |
| Automated watchdog | `.github/workflows/health-watchdog.yml` (every 15 min) |
| Backend error log | `error_events` table (founder query `observability:getRecentErrorEvents`) |
| Deploy pipeline | push to `main` → staging gate; production = manual promotion |

**Invariants that must never be violated** (each has a CI gate):
1. Backend identity is **session-bearer only** (Round 15/16). No public
   function may trust caller-supplied email — CI fails the build via the
   identity audit if one appears.
2. `convex/` typecheck must be 0 errors; root tsc must stay ≤ baseline
   (currently 131 — trend it DOWN, never up).
3. Production deploys only via `production-deploy.yml` (quality gate →
   deploy → live probes). Nothing auto-ships to production.
4. Every promotion is sha-pinned. Rollback = re-promote an older sha.

---

## 2. Deploy procedure

### 2.0 ⚠️ KNOWN HOLE (2026-09-05): Vercel auto-deploys main to production

Evidence: version.json showed sha `fe58506b` (a docs/workflows-only commit
nobody promoted) built 2026-09-05T08:41Z minutes after its push. Vercel's
Git integration auto-deploys every `main` push to production, which bypasses
the promotion gate's live-probe step. Today this is survivable because every
push to main is locally gated (vitest + convex tsc + build) before pushing —
but it is NOT the intended model. **Close it (one-time, dashboard):**
Vercel → Project → Settings → Git → set "Production Branch" to a dedicated
`release` branch (or disable auto-deploys), so only the promotion workflow's
`vercel deploy --prod` touches production. Until then, treat every `git
push origin main` as a production deploy and gate accordingly.

### 2.1 Everyday change (goes to staging gate, NOT to users)

```bash
git checkout main && git pull
# ...make changes...
npm test                    # vitest — must be green
cd convex && npx tsc --noEmit && cd ..   # must be 0 errors
npm run build               # must succeed
git commit -am "..." && git push origin main
```

Push to `main` runs `staging-deploy.yml`: typecheck + tests + (once
staging is configured) staging backend + staging frontend. Users are
untouched.

### 2.2 Production promotion (deliberate, gated, verified)

1. Open **Actions → Deploy to Production (promote) → Run workflow**.
2. Set `sha` to the **full 40-character** commit sha to promote
   (blank = latest main; an older main sha = rollback). Short shas fail
   checkout — use the full form.
3. The pipeline runs:
   - Quality gate: convex tsc = 0, root tsc ≤ baseline, vitest green,
     commit must be an ancestor of `main`.
   - Convex production deploy + SITE_URL point.
   - Vercel production build + deploy.
   - Live probes (never trust the deploy step's own claim).
   - Cloudflare mirror deploy — currently FAILS FAST on the expired
     token (§9). This failure does NOT affect the Vercel/Convex deploy.
4. Verify manually: `curl https://practice-pro-vega.vercel.app/version.json`
   → `status: "healthy"` and the sha you promoted.

### 2.3 Rollback

**Frontend + backend together (the normal path):**
re-run the promotion workflow with the last-known-good FULL sha. The
pipeline redeploys Vercel + Convex at that commit. (~5–8 min.)

**Convex function-level emergency rollback** (dashboard):
Convex dashboard → Functions → deploy a previous function bundle. Use
only when a single function regressed and a full re-promote is too slow.
Note: the dashboard rollback does NOT change the frontend — keep them in
sync afterwards by re-promoting the matching sha.

**Frontend-only instant rollback** (Vercel):
Vercel dashboard → Deployments → promote the previous one to Production.
(~1 min.) Then re-run the full promotion to align Convex.

**Known-bad shas:** see `worklog.md` (each round documents what shipped
and what it fixed).

---

## 3. Incident: site down / death loop / auth errors

Worked example: the 2026-09-05 "death loop" (splash ↔ "connection
interrupted" cycle, "attempt 22 of 3"). Full post-mortem in `worklog.md`
Round 17 (session). Compressed procedure:

1. **Confirm the blast radius.** Check the watchdog issue (or
   `curl <prod>/version.json`). One user vs all users? Console tab open?
2. **Freeze, don't thrash.** If a deploy minutes ago caused it → roll
   back FIRST (§2.3), diagnose second. Users > curiosity.
3. **Find the failure class.**
   - Frontend crash loop → `ConvexErrorBoundary`/`GlobalErrorBoundary`
     are the catch surfaces; client auth state lives in localStorage
     keys `practicepro_user_session` / `practicepro_session_bearer`.
   - Query storms / `Unauthenticated` errors → session validity gate
     (AuthContext) + strict-mode server guards (authHelpers.ts).
   - Silent backend breakage → check `error_events`
     (`observability:getRecentErrorEvents`) + Convex dashboard →
     Functions → Logs (crons show per-run failures).
4. **Fix forward with tests.** Every incident fix in this repo shipped
   with a regression test (`tests/unit/…`) + a browser smoke
   (`scripts/smoke-*.mjs`). Keep that bar.
5. **Post-incident:** append the post-mortem to `worklog.md` with the
   user-visible symptom, root cause chain, fix, and the probe/smoke that
   proves it.

**Session death-loop quick facts** (the class is now structurally
prevented, know it anyway): client sessions without a VALID server-issued
bearer are retired at boot by the AuthContext validity gate; the error
boundary caps retries per category (auth 2, connection 5 with backoff)
and its pill label tells the truth. If a similar loop EVER reappears, the
first place to look is `src/utils/errorRecovery.ts` policies and the
AuthContext `sessionValidation` query wiring.

---

## 4. Observability surfaces (R17)

| Surface | Where | Notes |
|---|---|---|
| Frontend crashes | Sentry (`VITE_SENTRY_DSN` on Vercel) | React errors + boundary catches |
| Backend errors | `error_events` table | crons (8 money-path jobs wrapped), Paystack webhook, drill route |
| Backend errors (unified) | `SENTRY_BACKEND_DSN` Convex env var | OPTIONAL — envelope POST from actions; table works without it |
| Uptime | `health-watchdog.yml` every 15 min | email on failed run + deduped `[WATCHDOG]` issue |
| Cron run status | Convex dashboard → Functions → Logs | authority on run success; `error_events` makes failures loud |
| Webhook audit | `paystackEvents` table | every signature-verified event, deduped |
| Backups | `backup_log` table + GitHub/Telegram targets | nightly 02:00 UTC (`nightlyR2Backup` cron → `backups.ts`) |

**Alert-path drill (how to prove alerting works):** run
`health-watchdog.yml` manually with `simulate=true` — it must open a
`[WATCHDOG][DRILL]` issue and close it cleanly. For the error-table
drill, POST the `/api/observability/drill` route (secret-gated) and read
back the counts.

---

## 5. Backup & restore (RPO/RTO)

**What's backed up, how often:**
- Nightly app-level export of ALL tables → GitHub private repo + Telegram
  (free, no card) at 02:00 UTC. Config lives in Convex env vars
  (`GITHUB_BACKUP_*`, `TELEGRAM_*`). Status queryable via `backups.ts`.
- Weekly independent verification + restore drill:
  `backup-restore-drill.yml` (Sundays 03:30 UTC) exports via the Convex
  CLI, verifies core tables parse, and (once staging exists) restores
  into staging.
- On-demand export any time: run the drill workflow manually.

**RPO: 24 hours** (nightly cadence — acceptable today; tighten by adding
a second daily run if payment volume justifies it).
**RTO: ~30 minutes** (measured by the drill's import+verify steps; the
nightly GitHub/Telegram copies need manual download + `npx convex import`).

**Manual restore (the real emergency):**
```bash
# 1. Get the snapshot (GitHub backup repo or the drill workflow artifact)
unzip practicepro-backup.zip -d snapshot/
# 2. Import into the deployment you're restoring
npx convex import snapshot/ --replace      # ⚠ replaces table data — drill first!
# 3. Verify: version.json, then spot-check users/firms counts in the dashboard
```
`--replace` wipes current rows in each table before inserting. ALWAYS
run the drill workflow against staging before ever doing this against
production. If the incident is data-corruption-not-outage, export the
CURRENT prod state first (evidence + diff), then restore.

---

## 6. Environment variables & secrets inventory

**Convex (dashboard → Settings → Environment Variables):**

| Var | Purpose | Status |
|---|---|---|
| `SITE_URL` | Deep links / emails | set by deploy pipeline |
| `PAYSTACK_ENABLED`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Payments | ⏸ dormant until LIVE keys + webhook URL registered |
| `GEMINI_API_KEY` / `GEMINI_DEMO_KEY` | AI features server-side | optional (users can supply own key) |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Transactional email | required for MFA/invite emails |
| `CHAKRA_*` (5 vars) | WhatsApp gateway | optional |
| `FCM_SERVER_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications | optional |
| `GITHUB_BACKUP_TOKEN` / `_OWNER` / `_REPO` | Nightly backup target | required for GitHub backup leg |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BACKUP_CHAT_ID` | Nightly backup target | optional (second leg) |
| `FOUNDER_NOTIFICATION_EMAILS` | Founder alerts | optional |
| `AGENT_INSPECT_SECRET` | Gates `/api/agent/inspect` + `/api/observability/drill` | set (also used by watchdog drills) |
| `SENTRY_BACKEND_DSN` | Backend → Sentry relay | optional, unset = table-only |

**Vercel (project env):** `VITE_CONVEX_URL` (production Convex URL),
`VITE_SENTRY_DSN` (frontend Sentry).

**GitHub secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, `CONVEX_DEPLOY_KEY` (production deploy key),
`CONVEX_STAGING_DEPLOY_KEY` + `CONVEX_STAGING_URL` (⏸ not yet created),
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (❌ token expired —
§9), `RELEASE_STORE_PASSWORD` / `RELEASE_KEY_PASSWORD` (APK signing).

**Rotation cadence:** GitHub PAT and Cloudflare tokens carry expiry dates
— the 2026-08-12→09-02 Cloudflare lapse froze the mirror for days
because nobody owned rotation. Calendar a quarterly check: PATs, CF
token, Paystack keys, backup targets' write access.

---

## 7. Android APK

- Built by `.github/workflows/build-apk.yml` (and `build-admin-apk.yml`
  for the founder app), signed with the keystore referenced by the
  `RELEASE_*` secrets; artifacts land in GitHub Releases.
- The APK talks to the SAME Convex deployment; auth state persists in
  the WebView's localStorage (`practicepro_session_bearer`). The R17
  death-loop fix applies to the APK identically — stale sessions are
  retired at boot.
- Version bumps: `apkVersion` in `version.json` via the build workflow.
  Current: 1.0.1 (10001).

---

## 8. Staging backend (one-time setup, pending)

The staging pipeline is fully wired but the second Convex project does
not exist yet, so staging deploys + the staging restore drill SKIPPED
state:

1. Convex dashboard → create project (e.g. `practice-pro-vega-staging`).
2. Copy its **Production Deploy Key** → GitHub secret
   `CONVEX_STAGING_DEPLOY_KEY`.
3. Copy its deployment URL → GitHub secret `CONVEX_STAGING_URL`.
4. Push to `main` once — staging auto-deploys; run `Seed Staging Data`
   once for test data.
5. Run `backup-restore-drill.yml` — the import half goes live.

Until then: staging gate still runs typecheck+tests on every push, and
production promotion remains the only deploy path.

---

## 9. Cloudflare mirror (known open item)

The mirror at `practice-pro-vega.prototypechigo.workers.dev` froze on
2026-09-02T18:04Z because `CLOUDFLARE_API_TOKEN` (set 2026-08-12,
30-day expiry) expired. The promotion pipeline fails fast at the
token-verify step with the exact remediation; Vercel + Convex deploys
are unaffected. The watchdog reports mirror staleness as a warning.

**Fix (5 minutes):** Cloudflare dashboard → My Profile → API Tokens →
Create Token ("Edit Cloudflare Workers", scoped to the account) → paste
as the `CLOUDFLARE_API_TOKEN` secret → re-run the promotion for the
current sha. Verify with `curl <mirror>/version.json` → sha matches prod.

---

## 10. Paystack go-live (open item)

Payments are dormant: `PAYSTACK_ENABLED` is unset and the webhook URL is
not registered with Paystack. To go live:
1. Set `PAYSTACK_ENABLED=true` + LIVE keys in Convex env (swap the test
   keys first used on staging).
2. Register the webhook in the Paystack dashboard:
   `https://gregarious-malamute-537.convex.cloud/paystack/webhook`
   (signature-verified, deduped, audited — see paystack.ts).
3. Watch the first live `charge.success` events in the `paystackEvents`
   table; failures now land in `error_events` + Sentry.
