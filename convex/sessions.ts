/**
 * R13 — Session token foundation (Phase 3 of the SaaS hardening plan).
 *
 * PROBLEM being solved: the app's "session" is a plain email string in
 * localStorage. Every backend call passes `userEmail` as an argument, and
 * the backend verifies the email EXISTS — never that the caller IS that
 * person. The Convex URL is public in the JS bundle, so anyone who knows
 * a staff email can call the API as them.
 *
 * This module introduces REAL bearer sessions:
 *   - verifyLogin issues an opaque 256-bit token (crypto-secure via
 *     secureRandom) and returns it to the client.
 *   - Only the SHA-256 hash of the token is stored server-side, so a
 *     database leak does not leak usable session tokens.
 *   - validateSessionToken(token) resolves the caller's user by hashing
 *     the presented token (pure-TS sha256 — runs in queries/mutations,
 *     where node:crypto is unavailable).
 *   - Sessions expire (30 days) and are revoked on logout / on demand.
 *   - resolveCaller (callerAuth.ts) trusts a valid session first. The
 *     legacy email acceptance branch was DELETED at the Round 16 cutover:
 *     email-only identity is REJECTED (proven live by production spoof
 *     probes).
 *
 * MIGRATION WINDOW (Rounds 13→15) — CLOSED at Round 16: callers still send
 * userEmail for API-shape compatibility, but it is ignored by auth.
 * AuthContext stores the session token from login and revokes it on
 * logout. The ~165 call-site sweep to `sessionToken` completed in
 * Round 15; this module is now the only accepted identity proof.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { randomHex } from "./secureRandom";
import { sha256Hex } from "./sha256";

/** 30-day session lifetime — matches the "remember me" UX expectations. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Opaque bearer token: 64 hex chars = 256 bits of entropy from
 * crypto.randomUUID (unbiased — see secureRandom.ts). 2^256 search space
 * makes enumeration infeasible.
 */
export function generateSessionToken(): string {
  return randomHex(64);
}

/** Server-side storage form: SHA-256 hex of the token (never the token). */
export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

/** Expiry timestamp for a session created at `now`. Pure, testable. */
export function sessionExpiry(now: number): number {
  return now + SESSION_TTL_MS;
}

/**
 * Pure validation of a session row against `now`.
 * Returns the failure reason (null = valid) so both callers and tests can
 * assert exact semantics: revoked beats expired beats mismatched user.
 */
export function sessionInvalidReason(
  session: { revokedAt?: number | null; expiresAt: number; userId: string } | null | undefined,
  now: number
): "not_found" | "revoked" | "expired" | null {
  if (!session) return "not_found";
  if (session.revokedAt != null && session.revokedAt <= now) return "revoked";
  if (session.expiresAt <= now) return "expired";
  return null;
}

// ─── Convex functions ──────────────────────────────────────────────────────

/** Create a session for a verified user; returns the plaintext token ONCE. */
export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    userEmail: v.string(),
    device: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Opportunistic hygiene: cap concurrent sessions per user (keep the
    // newest — oldest are pruned). Bounded work, no full scan.
    //
    // CAP RAISED 10 → 25 (2026-09-14, "messaging stops working after a
    // while"): every fresh APK install/re-login creates a NEW session row
    // (the APK pipeline ships multiple builds a day during active
    // development, and the founder tests on several devices). At a cap of
    // 10, the 11th login silently revoked the session on the device the
    // user was actively using — every mutation then failed with
    // "Unauthenticated" (messaging "broken", test push erroring) until a
    // manual re-login. 25 concurrent sessions absorbs realistic device
    // churn while still bounding the table.
    const SESSION_SOFT_CAP = 25;
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    const active = existing.filter((s: any) => s.revokedAt == null);
    if (active.length >= SESSION_SOFT_CAP) {
      const toRevoke = active.slice(SESSION_SOFT_CAP - 1);
      for (const s of toRevoke) {
        await ctx.db.patch(s._id, { revokedAt: Date.now() });
      }
    }

    const token = generateSessionToken();
    const now = Date.now();
    await ctx.db.insert("sessions", {
      tokenHash: hashSessionToken(token),
      userId: args.userId,
      userEmail: args.userEmail,
      device: args.device,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: sessionExpiry(now),
    });
    return { token };
  },
});

/**
 * Validate a presented session token → the resolved users-table row
 * (sensitive fields stripped), or null. PUBLIC query: it authenticates the
 * bearer, leaks nothing, and is the primitive Round 15's call-site sweep
 * will use (callers pass sessionToken; resolveCaller consumes it).
 */
export const validateSessionToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await resolveUserBySessionToken(ctx, args.token);
    if (!user) return null;
    const { password, mfaCode, verificationCode, failedLoginAttempts, lockedUntil, recoveryCode, ...safe } =
      user as any;
    return safe;
  },
});

/** Shared resolver (used by this module AND callerAuth.resolveCaller).
 *\n * ACTION-SAFE (2026-09-23 ALOA audit): Convex ACTIONS have no `ctx.db` —
 * every action that authenticated via resolveCaller crashed with
 * "Cannot read properties of undefined (reading 'query')" (Brain
 * searchMemories, Rules & Forms searchKnowledge, legalRepo searchStatutes,
 * portal invites). In an action context we now route the lookup through
 * the internal query below (ctx.runQuery) instead of touching ctx.db.
 */
export async function resolveUserBySessionToken(ctx: any, token: string): Promise<any | null> {
  if (!token || typeof token !== "string") return null;
  const tokenHash = hashSessionToken(token);
  if (!ctx.db) {
    // Action context: no ctx.db — resolve via the internal query.
    return await ctx.runQuery(internal.sessions.lookupUserByTokenHash, { tokenHash });
  }
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
    .first();
  const reason = sessionInvalidReason(session, Date.now());
  if (reason) return null;
  if (!session) return null;
  return await ctx.db.get(session.userId);
}

/**
 * Internal query — session-token → full user row, for ACTIONS (which have
 * no ctx.db). Returns the RAW user row (resolveCaller needs role/firmId);
 * never exposed publicly.
 */
export const lookupUserByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", args.tokenHash))
      .first();
    const reason = sessionInvalidReason(session, Date.now());
    if (reason || !session) return null;
    return await ctx.db.get(session.userId);
  },
});

/** Revoke the session presented by the token (logout). Idempotent. */
export const revokeSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = hashSessionToken(args.token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
      .first();
    if (session && session.revokedAt == null) {
      await ctx.db.patch(session._id, { revokedAt: Date.now() });
    }
    return { success: true };
  },
});

/** Revoke every active session for a user (password change / compromise). */
export const revokeAllUserSessions = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .collect();
    const now = Date.now();
    for (const s of sessions) {
      if (s.revokedAt == null) {
        await ctx.db.patch(s._id, { revokedAt: now });
      }
    }
    return { revoked: sessions.length };
  },
});

/** Cron: delete session rows expired > 7 days ago (post-graveyard purge). */
export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stale = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q: any) => q.lt("expiresAt", cutoff))
      .collect();
    for (const s of stale) {
      await ctx.db.delete(s._id);
    }
    return { deleted: stale.length };
  },
});
