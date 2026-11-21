# Vega Session & Multi-Tab Security Architecture

**Status:** live (2026-11-22 owner task — "Session & multi-tab security for
private legal records")
**Audience:** engineers, security reviewers, and the owner.

Vega holds confidential and privileged legal records (matters, clients,
case files). This document is the exact account of how authentication and
sessions work end-to-end, the choices made for legal-grade confidentiality,
and the honest trade-offs.

---

## 1. Identity: how a login is proven

| Layer | Mechanism |
|---|---|
| Credential | email + password (bcrypt-hashed server-side), optional MFA |
| Session token | opaque 256-bit hex token (`crypto.randomUUID`-based, via `convex/secureRandom.ts`) |
| Server storage | **SHA-256 hash only** — a database leak exposes no usable tokens (`convex/sessions.ts`) |
| Absolute expiry | 30 days from issue (`SESSION_TTL_MS`), enforced server-side |
| Revocation | on logout, password change (all other sessions), founder suspend (all sessions) — idempotent |
| Concurrency cap | 25 active sessions per user (newest kept; oldest pruned) |
| Legacy email identity | **rejected** since Round 16 — a caller-supplied email proves nothing; every Convex call must present a valid `sessionToken` (the `resolveCaller` sweep completed in Round 15) |

The bearer is the only accepted identity proof on the backend. A leaked
matter list is not possible with just an email address.

## 2. Client-side token storage — what lives where, and why

| Key | sessionStorage | localStorage | Why |
|---|---|---|---|
| `practicepro_session_bearer` | always after login | **only with "Remember Me"** | without Remember Me the token dies with the tab |
| `practicepro_user_session` | always | only with "Remember Me" | same lifetime semantics |
| `practicepro_portal_session` / `_type` | portal (tenant/client) routes | only with Remember Me | portals are separate from staff sessions |
| `practicepro_session_locked` | — | always | the lock flag must be visible to every tab (see §4) |
| `practicepro_global_activity_ts` | — | always | cross-tab idle truth (see §4) |
| `practicepro_sidebar_retracted`, theme, font size, Vox callout dismissal | — | always | UI preferences, no confidentiality impact |

### Why not HttpOnly cookies?

The frontend is a static SPA that talks **directly** to Convex
(`*.convex.cloud`) over HTTPS with the bearer in the `Authorization`-style
argument flow. We do not own a backend proxy on the Convex domain, so we
cannot set an `HttpOnly; SameSite=Strict` cookie that Convex would read.
That is the platform constraint, stated plainly.

**Compensating controls** (what makes the localStorage trade acceptable):

1. Only the SHA-256 hash exists server-side — a stolen token is revocable
   but not replayable after revocation, and 256 bits is unenumerable.
2. Full server-side revocation paths (logout / password change / suspend).
3. The idle lock (§3) means a live token in an abandoned browser is behind
   a password-verified lock screen within 15 minutes.
4. Sessions are scoped per product surface: portal sessions and staff
   sessions use disjoint keys and are mutually cleared on login/logout, so
   a tenant cookie jar never authenticates a staff surface (and vice versa).

If the platform ever gains a proxy edge (e.g. Cloudflare Worker fronting
the Convex URL), moving the bearer to a `HttpOnly; Secure; SameSite=Strict`
cookie is the first recommended hardening step.

## 3. Idle policy (legal-grade)

- **Every staff session locks after 15 minutes of inactivity — including
  "Remember Me".** (Before 2026-11-22, Remember Me disabled the idle lock
  entirely; that exemption is retired. Remember Me now only extends the
  server token's absolute lifetime, which is what "remember me" means.)
- The lock screen **replaces** the app (not an overlay): while locked, no
  matter data exists in the DOM.
- Unlock = **password re-verification** against the real backend (max 5
  attempts, then full sign-out). It is not a "click to continue" screen.
- Portal users (tenants/clients) are **logged out** on inactivity (not
  locked) with a clear message — their sessions are lower-trust and the
  fresh login is the cleaner boundary.

## 4. Multi-tab behavior (the reported gap)

**Before:** the lock flag was persisted to localStorage but only read at
mount — locking tab A left tab B fully interactive. Remember-Me sessions
never locked at all, so a second tab was a permanent unverified window into
privileged records.

**Now:**

1. **Cross-tab lock propagation** — `UIContext` listens to the `storage`
   event for `practicepro_session_locked`: lock/unlock in any tab
   propagates live to every tab of the same browser profile. A new tab
   opened while locked mounts directly into the lock screen.
2. **Cross-tab idle truth** — `useIdleTimer` publishes a throttled
   `practicepro_global_activity_ts` on user activity and subscribes to
   other tabs' updates. The idle decision is "no activity in ANY tab", so:
   - working in tab A keeps tab B alive (no lock while the user is active
     anywhere — normal single-tab workflows stay smooth);
   - a truly abandoned browser locks **all** tabs together.
3. Unlocking in one tab unlocks the others — the password was just proven;
   re-asking per tab trains reflexive password entry, which is worse for
   security.

## 5. Sign-out cleanup

Logout (AuthContext) does all of, in order:

1. Revokes the server session — live mutation **plus** a `sendBeacon`
   fallback that survives the navigation away;
2. Clears bearer/session/portal keys from **both** storages;
3. Clears per-user caches: cached user record, draft matters, demo-product
   flag, impersonation/override keys, the lock flag, and the analytics/
   Sentry user context;
4. Navigates with `location.replace()` so the authenticated page is not
   reachable via Back.

Portal logout clears only portal keys; staff logout clears only staff
keys — the surfaces never share a credential jar.

## 6. Public vs authenticated separation

- The marketing surfaces (`/`, `/vega`, `/atrium`) render with **no**
  authenticated context; user-scoped keys (theme etc.) reset to neutral on
  logout so a previous user's preferences never bleed into public pages.
- Unauthenticated visits to app routes redirect to the landing page; portal
  users with a stored session are never bounced during the auth-loading
  window.
- Impersonation is server-verified (`?impersonateToken=`); the legacy
  `?impersonate=email` identity-spoof param is rejected and cleaned.

## 7. Remaining trade-offs (honest list)

| Trade-off | Reason | Mitigation |
|---|---|---|
| Bearer in localStorage (Remember Me) instead of HttpOnly cookie | SPA talks directly to Convex; no proxy edge we control | hashed-at-rest tokens, revocation, idle lock, 30-day absolute cap |
| Second tab joins an active session without a fresh prompt | requiring re-login per tab breaks the normal "open matter in new tab" legal-research workflow; the boundary that matters is idle + verification, not tab count | cross-tab idle lock covers every tab; lock propagates; unlock re-verifies |
| 15-minute idle window | shorter windows (2–5 min) are banking-grade and measurably harm lawyers' drafting flow | OWASP's 10–15 min recommendation for confidential business apps; password-verified unlock |
| 25-session concurrency cap | founder tests on many devices; a lower cap silently logged out active devices | newest-kept pruning, not hard denial |
