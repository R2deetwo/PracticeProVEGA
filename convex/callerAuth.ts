
import { Doc } from "./_generated/dataModel";
import { resolveUserBySessionToken } from "./sessions";

/**
 * R16 (plan Round 15) — STRICT IDENTITY MODE. The cutover.
 * ─────────────────────────────────────────────────────────────────────
 * When true, caller-supplied identity strings (email, userId) are
 * REJECTED. Every public function requires a valid bearer session token
 * issued by verifyLogin (password + MFA verified at the login gateway).
 * This closes the spoofable-identity class: knowing a staff member's
 * email no longer lets anyone call the API as them.
 *
 * ROLLBACK (instant, per the plan's design): flip to `false` and redeploy —
 * the legacy branches below resume accepting caller-supplied identity.
 * Phase B deletes the legacy branches entirely once the cutover is proven
 * by live spoof probes on production.
 */
export const STRICT_IDENTITY_MODE = true;

/**
 * STRICT caller verification — Round 8 auth retrofit.
 * ─────────────────────────────────────────────────────────────────────────
 * Background: this app uses CUSTOM auth (email/password verified against the
 * `users` table), NOT Convex Auth. The established per-function convention is
 * a caller-supplied identity that the function resolves against the `users`
 * table before writing. `authHelpers.requireFirmUser` implements that
 * convention but has a PERMISSIVE anonymous fallback for legacy callers.
 *
 * These helpers are the STRICT version — no anonymous fallback:
 *   resolveCaller      → user must resolve (session identity, userId, or email)
 *   requireStaffCaller → + portal roles (Tenant/Client) blocked, firm match
 *   requirePortalCaller→ + ONLY portal roles (Tenant/Client)
 *   requireFounderCaller → + role === 'Founder' (the Founder App admission rule)
 *   assertSameFirm     → firmId must be the caller's own firm (incl. joined)
 *
 * Every public Convex writer that mutates firm-scoped or entity-scoped data
 * must call one of these BEFORE its first write. Entity-scoped mutations
 * (delete X by id, mark X read, …) additionally verify the entity's firmId
 * matches the caller's firm — see the retrofit patterns in sentry.ts
 * (requireSentryAuth) which this module generalizes.
 */

export type CallerUser = Doc<"users">;

const PORTAL_ROLES = new Set(["Tenant", "Client"]);

/** Users-table lookup by login email (tokenIdentifier first, then email). */
async function findUserByEmail(ctx: any, email: string): Promise<CallerUser | null> {
  const e = String(email).toLowerCase().trim();
  if (!e) return null;
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", e))
    .first();
  if (!user) {
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", e))
      .first();
  }
  return (user as CallerUser) || null;
}

/**
 * Resolve the caller to a real users-table row.
 *
 * Resolution order:
 *   1. Bearer session token (hash verified against the sessions table) —
 *      FULLY TRUSTED: possession proves the caller passed password
 *      (+ MFA) at the login gateway. An invalid/expired/revoked token
 *      THROWS (never falls through to a spoofable email).
 *   2. Convex Auth session (if ever configured).
 *
 * STRICT IDENTITY MODE (plan Round 15 cutover): with the flag on, paths
 * 3 and 4 below are UNREACHABLE — email-only and userId-only identity
 * are rejected outright. The code is retained solely as the rollback
 * lever (flag flip); Phase B deletes it.
 */
export async function resolveCaller(
  ctx: any,
  opts: { userEmail?: string | null; userId?: string | null; sessionToken?: string | null }
): Promise<CallerUser> {
  // 0. R13: bearer session token — server-verified possession proof.
  //    Takes precedence over every caller-supplied identity string.
  if (opts.sessionToken) {
    const u = await resolveUserBySessionToken(ctx, opts.sessionToken);
    if (u) return u as CallerUser;
    // An invalid/expired/revoked token must NOT silently fall through to a
    // caller-supplied (spoofable) email — that would let an attacker pair
    // a dead token with any email. Treat as unauthenticated.
    throw new Error(
      "Unauthenticated: the session token is invalid, expired, or revoked. Please sign in again."
    );
  }

  // 1. Convex Auth session (if ever configured) takes precedence.
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const sessionEmail = (identity.email || identity.subject)?.toLowerCase();
      if (sessionEmail) {
        const u = await findUserByEmail(ctx, sessionEmail);
        if (u) return u;
      }
    }
  } catch {}

  // ── STRICT MODE CUTOVER ────────────────────────────────────────────
  // Caller-supplied identity strings are spoofable: anyone who knows a
  // staff email (or a userId leaked in a record) can claim it. Reject.
  if (STRICT_IDENTITY_MODE) {
    throw new Error(
      "Unauthenticated: a verified session is required. Please sign in again."
    );
  }

  // ── LEGACY PATHS (rollback lever only — unreachable while strict) ──

  // 2. Caller-supplied userId (the logged-in user's Convex _id).
  if (opts.userId) {
    try {
      const u = await ctx.db.get(opts.userId as any);
      if (u) return u as CallerUser;
    } catch {}
  }

  // 3. Caller-supplied email (the repo's legacy auth-token convention).
  if (opts.userEmail) {
    console.warn(
      "[resolveCaller] legacy email identity used (spoofable; strict mode is ON — this branch is the rollback lever):",
      String(opts.userEmail).toLowerCase().trim()
    );
    const u = await findUserByEmail(ctx, opts.userEmail);
    if (u) return u;
  }

  throw new Error(
    "Unauthenticated: a verified user session is required for this operation."
  );
}

/** Firm-scope check: firmId must be the caller's own firm (or one they joined). */
export function assertSameFirm(user: CallerUser, firmId: string | undefined | null): void {
  if (!firmId) {
    throw new Error("Missing firm context.");
  }
  if (user.firmId === firmId) return;
  const joined: string[] = (user as any).joinedFirmIds || [];
  if (joined.includes(firmId)) return;
  throw new Error("Not authorized: cannot access data belonging to a different firm.");
}

/**
 * Firm-staff caller (Admin/Lawyer/Paralegal/ExternalCounsel/Founder).
 * Portal roles are rejected — they must use portal-scoped endpoints.
 * When firmId is supplied it must match the caller's firm.
 */
export async function requireStaffCaller(
  ctx: any,
  opts: { userEmail?: string | null; userId?: string | null; firmId?: string | null; sessionToken?: string | null }
): Promise<CallerUser> {
  const user = await resolveCaller(ctx, opts);
  if (PORTAL_ROLES.has(String(user.role || ""))) {
    throw new Error("Portal users do not have access to this feature.");
  }
  if (opts.firmId !== undefined && opts.firmId !== null) {
    assertSameFirm(user, opts.firmId);
  }
  return user;
}

/**
 * Portal caller (Tenant/Client) — for tenant/client self-service endpoints.
 * Staff callers are rejected: staff must use the firm-side endpoints.
 */
export async function requirePortalCaller(
  ctx: any,
  opts: { userEmail?: string | null; userId?: string | null; sessionToken?: string | null }
): Promise<CallerUser> {
  const user = await resolveCaller(ctx, opts);
  if (!PORTAL_ROLES.has(String(user.role || ""))) {
    throw new Error("This operation is only available to portal users.");
  }
  return user;
}

/** Founder caller — matches the Founder App admission rule (role === 'Founder'). */
export async function requireFounderCaller(
  ctx: any,
  opts: { userEmail?: string | null; userId?: string | null; sessionToken?: string | null }
): Promise<CallerUser> {
  const user = await resolveCaller(ctx, opts);
  if (String(user.role || "") !== "Founder") {
    throw new Error("Unauthorized. Only Founders can perform this operation.");
  }
  return user;
}
