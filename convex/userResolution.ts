/**
 * Task 21 — user-record resolution + NDPA privacy projection, extracted as
 * PURE functions so they can be unit-tested in the node suite.
 *
 * WHY THIS MODULE EXISTS (the 2026-09-05 "every login code rejected"
 * incident — the real one):
 *
 *   `getUser` (public query) applies a server-side privacy projection that
 *   strips password / mfaCode / verificationCode / failedLoginAttempts /
 *   lockedUntil before returning a user record. That is correct for the
 *   CLIENT (those fields must never leave the server) — but `verifyLogin`
 *   and `resetPassword` (server-side actions) were ALSO fetching their user
 *   through `getUser`. They received the projected record, so:
 *
 *     - user.password      → undefined → the real-password branch never ran;
 *       every account looked "passwordless" → the code prompt always fired;
 *     - user.mfaCode       → undefined → the typed code was compared against
 *       normalizeCode(undefined) === "" → EVERY code was rejected, no matter
 *       how fresh or correctly typed (production evidence: fresh code issued
 *       11:48:26, one failed attempt, zero sessions, 14 users);
 *     - user.lockedUntil / failedLoginAttempts → undefined → the lockout
 *       could never trigger;
 *     - resetPassword: user.verificationCode → undefined → the 6-digit OTP
 *       path always failed (the RCV- recovery-code path worked by accident —
 *       recoveryCode was not in the strip list).
 *
 *   The fix: server-side auth flows now read the RAW record via the
 *   internal query `getUserForAuth` (internal functions are not callable
 *   from clients). This module holds the shared resolution + projection
 *   logic so both `getUser` and `getUserForAuth` resolve the SAME record,
 *   and tests can lock the invariant.
 */
import { v } from "convex/values";

/** Fields that must NEVER leave the server through a client-visible query.
 * Kept in one place so getUser's projection and the contract tests cannot
 * drift apart. Do NOT add fields here without extending the strip test. */
export const AUTH_STRIP_FIELDS = [
  "password",
  "passwordHash",
  "mfaCode",
  "verificationCode",
  "failedLoginAttempts",
  "lockedUntil",
] as const;

/** Convex validator fragment shared by getUser / getUserForAuth args. */
export const userLookupArgs = {
  tokenIdentifier: v.string(),
  preferPortalRole: v.optional(v.boolean()),
};

/**
 * Picks the right record when the same email has several user records.
 * Mirrors the exact resolution strategy previously inlined in getUser:
 *   - filter out role="Pending" (revoked accounts) unless everything is
 *     Pending (fall through so the revoked-user handling downstream fires);
 *   - if preferPortalRole (login via /portal/*) and a Client/Tenant record
 *     exists, prefer it (the "residents see admin dashboard" bug);
 *   - otherwise take the first record (preserves admin-side behavior).
 * Returns null for empty input.
 */
export function pickUserRecord(
  allMatches: any[] | null | undefined,
  preferPortalRole: boolean
): any | null {
  if (!allMatches || allMatches.length === 0) return null;
  const PORTAL_ROLES = new Set(["Client", "Tenant"]);
  const nonPending = allMatches.filter((u: any) => u.role !== "Pending");
  const pool = nonPending.length > 0 ? nonPending : allMatches;
  if (preferPortalRole) {
    const portalRecord = pool.find((u: any) => PORTAL_ROLES.has(u.role));
    return portalRecord || pool[0];
  }
  return pool[0];
}

/**
 * NDPA privacy projection: returns a shallow copy of the user record with
 * every field in AUTH_STRIP_FIELDS removed. Pure — never mutates the input.
 */
export function stripAuthFields<T extends Record<string, any>>(user: T): Partial<T> {
  const safe: Record<string, any> = { ...user };
  for (const field of AUTH_STRIP_FIELDS) {
    delete safe[field];
  }
  return safe as Partial<T>;
}
