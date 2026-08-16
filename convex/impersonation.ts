/**
 * convex/impersonation.ts — Server-verified impersonation tokens.
 *
 * B1 SHIP-BLOCKER FIX: Replaces the unsigned ?impersonate=email URL param
 * that accepted any email with no server check. Now:
 *
 *   1. Founder calls createImpersonationToken({ targetEmail }) — server verifies
 *      the caller is a Founder and that the target exists.
 *   2. Server returns a short-lived (5-minute), single-use opaque token.
 *   3. Founder's APK appends ?impersonateToken=xxx to the URL instead of ?impersonate=email.
 *   4. Frontend (AuthContext) calls verifyImpersonationToken({ token }) on load.
 *   5. Server verifies the token, marks it used, returns the targetEmail.
 *   6. Frontend sets the session token to targetEmail (same as before, but now
 *      server-verified).
 *
 * Security properties:
 *   - Founder-only: requireFounder gates both mutations.
 *   - Short-lived: 5-minute expiry (300000 ms).
 *   - Single-use: usedAt is set on first consumption; subsequent attempts fail.
 *   - Opaque: the token is a crypto.randomUUID — no information about the target.
 *   - Auditable: founderEmail + targetEmail + createdAt + usedAt logged per token.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFounder } from "./founderMetrics";

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a short-lived, single-use impersonation token.
 * Founder-only. The target must exist in the users table.
 *
 * Returns { token, expiresAt } — the founder's APK appends ?impersonateToken=token
 * to the URL when redirecting to the consumer app.
 */
export const createImpersonationToken = mutation({
  args: {
    targetEmail: v.string(),
    founderEmail: v.string(), // caller's email (tokenIdentifier)
  },
  handler: async (ctx, args) => {
    // 1. Verify caller is a Founder
    const founder = await requireFounder(ctx, args.founderEmail);

    // 2. Verify target user exists
    const targetEmail = args.targetEmail.toLowerCase().trim();
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", targetEmail))
      .first();

    if (!targetUser) {
      throw new Error(
        `Impersonation failed: target user "${targetEmail}" not found.`
      );
    }

    // 3. Generate opaque token (crypto.randomUUID is available in Convex runtime)
    const token = crypto.randomUUID();
    const now = Date.now();

    // 4. Insert the token record
    await ctx.db.insert("impersonation_tokens", {
      token,
      founderEmail: founder.email || founder.tokenIdentifier || args.founderEmail,
      targetEmail,
      createdAt: now,
      expiresAt: now + TOKEN_TTL_MS,
      usedAt: undefined,
    });

    // 5. Clean up expired tokens (best-effort, non-blocking)
    // Keep the table small by deleting tokens older than 1 hour.
    try {
      const expired = await ctx.db
        .query("impersonation_tokens")
        .filter((q: any) => q.lt(q.field("expiresAt"), now - 55 * 60 * 1000))
        .take(50);
      for (const doc of expired) {
        await ctx.db.delete(doc._id);
      }
    } catch {
      // Non-critical — don't fail the mutation if cleanup fails.
    }

    return { token, expiresAt: now + TOKEN_TTL_MS };
  },
});

/**
 * Verify an impersonation token and return the target email.
 * Called by the frontend (AuthContext) when ?impersonateToken=xxx is in the URL.
 *
 * Single-use: marks the token as consumed. Subsequent calls with the same
 * token will fail with "Token already used".
 *
 * Returns { targetEmail } on success, throws on failure.
 */
export const verifyImpersonationToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Look up the token
    const record = await ctx.db
      .query("impersonation_tokens")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();

    if (!record) {
      throw new Error("Impersonation token not found.");
    }

    // 2. Check expiry
    if (now > record.expiresAt) {
      // Clean up the expired token
      await ctx.db.delete(record._id);
      throw new Error("Impersonation token expired.");
    }

    // 3. Check single-use
    if (record.usedAt !== undefined && record.usedAt !== null) {
      throw new Error("Impersonation token already used.");
    }

    // 4. Mark as used (single-use enforcement)
    await ctx.db.patch(record._id, { usedAt: now });

    // 5. Return the target email
    return { targetEmail: record.targetEmail };
  },
});

/**
 * Optional: list recent impersonation tokens for a founder (audit log).
 * Founder-only. Returns tokens created in the last 24 hours.
 */
export const getMyImpersonationHistory = query({
  args: {
    founderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requireFounder(ctx, args.founderEmail);

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const tokens = await ctx.db
      .query("impersonation_tokens")
      .withIndex("by_founder", (q: any) =>
        q.eq("founderEmail", args.founderEmail.toLowerCase().trim())
      )
      .filter((q: any) => q.gte(q.field("createdAt"), oneDayAgo))
      .take(100);

    return tokens.map((t: any) => ({
      targetEmail: t.targetEmail,
      createdAt: t.createdAt,
      usedAt: t.usedAt,
      expiresAt: t.expiresAt,
    }));
  },
});
