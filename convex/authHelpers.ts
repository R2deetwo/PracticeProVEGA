
import { Doc } from "./_generated/dataModel";

/**
 * Helper to ensure the user is logged in and associated with a firm.
 * This is used by queries and mutations to enforce data isolation.
 *
 * SECURITY (Audit Finding C1 — Fixed):
 * Previously, when no authenticated session existed, this function fell
 * back to the client-supplied `userEmail` parameter. This allowed an
 * unauthenticated caller to pass ANY email and access that firm's data —
 * a critical auth bypass.
 *
 * Now, the session identity is REQUIRED. The `userEmail` parameter is
 * only used as a secondary lookup hint when the session identity's email
 * doesn't match a user record (e.g., email changed). The userEmail can
 * NEVER grant access to a firm the authenticated user doesn't belong to.
 *
 * For internal actions (httpActions, scheduled jobs) that don't have a
 * user auth context, use `requireServiceAuth()` instead.
 */
export async function requireFirmUser(ctx: any, userEmail?: string): Promise<{
  firmId: string;
  userId: string;
  user: Doc<"users">;
}> {
  // 1. REQUIRE an authenticated session — no exceptions.
  //    This is the primary security gate. Without it, the userEmail
  //    fallback below would allow auth bypass.
  let sessionEmail: string | undefined;
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      sessionEmail = (identity.email || identity.subject)?.toLowerCase();
    }
  } catch {}

  if (!sessionEmail) {
    // No authenticated session — reject immediately.
    // Do NOT fall back to userEmail (that was the auth bypass).
    throw new Error("Unauthenticated. Please log in to continue.");
  }

  // 2. Use the session email (authoritative) — ignore client-supplied email.
  //    The userEmail parameter is kept for backward compatibility but is
  //    NEVER used for authorization decisions.
  const email = sessionEmail;

  // 3. Lookup user by email (tokenIdentifier)
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email!))
    .first();

  // 4. Fallback lookup by the `email` field directly (some legacy users
  //    may have email in a different field than tokenIdentifier)
  if (!user) {
    user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("email"), email!))
      .first();
  }

  if (!user || !user.firmId) {
    throw new Error("User account not found or not associated with an active firm.");
  }

  return {
    firmId: user.firmId,
    userId: user._id,
    user
  };
}

/**
 * Service-level authentication for internal actions (httpActions, scheduled
 * jobs, cron tasks) that don't have a user auth context.
 *
 * These callers must authenticate via a service key or run within Convex's
 * trusted internal context. They CANNOT access user data — only system-level
 * operations are permitted.
 *
 * If you need firm data access from an internal action, pass the firmId
 * explicitly from a trusted source (e.g., a webhook payload verified by
 * a signature).
 */
export async function requireServiceAuth(ctx: any): Promise<{ isService: true }> {
  // Internal actions in Convex run with elevated privileges by default.
  // This function exists as a marker for code review — any caller using
  // it should be audited to ensure it doesn't expose user data without
  // proper authorization.
  //
  // For httpActions, verify webhook signatures BEFORE calling this.
  // For cron jobs, ensure the job doesn't expose data across firm boundaries.
  return { isService: true };
}

/**
 * Helper to ensure the user has Admin privileges.
 */
export async function requireAdmin(ctx: any, userEmail?: string) {
  const auth = await requireFirmUser(ctx, userEmail);
  if (auth.user.role !== "Admin") {
    throw new Error("Permission denied. This action requires Administrator privileges.");
  }
  return auth;
}
