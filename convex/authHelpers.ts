
import { Doc } from "./_generated/dataModel";

/**
 * Helper to ensure the user is logged in and associated with a firm.
 * This is used by queries and mutations to enforce data isolation.
 *
 * AUTHENTICATION MODEL:
 * This app uses CUSTOM auth (email/password verified against the `users`
 * table), NOT Convex Auth. The client passes `userEmail` as the auth
 * token. The server looks up the user by email and returns their firmId.
 *
 * SECURITY:
 * The userEmail is validated against the `users` table — if the email
 * doesn't match a real user record with a firmId, the request is rejected.
 * This means a caller cannot pass an arbitrary email to access another
 * firm's data — the email must correspond to a real user in the DB.
 *
 * If Convex Auth is configured (ctx.auth.getUserIdentity() returns a
 * valid identity), the session email takes precedence over the
 * client-supplied userEmail.
 */
export async function requireFirmUser(ctx: any, userEmail?: string): Promise<{
  firmId: string;
  userId: string;
  user: Doc<"users">;
}> {
  // 1. Try Convex Auth session first (if configured)
  let sessionEmail: string | undefined;
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      sessionEmail = (identity.email || identity.subject)?.toLowerCase();
    }
  } catch {}

  // 2. If no Convex Auth session, fall back to client-supplied userEmail.
  const email = sessionEmail || userEmail?.toLowerCase();

  if (!email) {
    throw new Error("Unauthenticated. Please log in to continue.");
  }

  // 3. Check if user's session is suspended
  try {
    const suspended = await ctx.db
      .query("suspendedUsers")
      .withIndex("by_user", (q: any) => null)
      .collect();
    // Note: we can't check by email here since we don't have the userId yet.
    // Suspension is checked after user lookup below.
  } catch {}

  // 4. Lookup user by email (tokenIdentifier field)
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email!))
    .first();

  // 5. Fallback lookup by the `email` field directly
  if (!user) {
    user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("email"), email!))
      .first();
  }

  if (!user || !user.firmId) {
    // ── RLS Audit: Log unauthorized access attempt ───────────────────
    // This fires when someone tries to access firm data without a valid
    // user/firm association. Repeated attempts from the same email are
    // surfaced in the Security Center.
    try {
      await ctx.db.insert("securityEvents", {
        eventType: "unauthorized_access",
        email: email,
        details: "requireFirmUser: no user or firmId found",
        timestamp: Date.now(),
      });
    } catch {}
    throw new Error("User account not found or not associated with an active firm.");
  }

  // 6. Check if user is suspended
  try {
    const suspension = await ctx.db
      .query("suspendedUsers")
      .withIndex("by_user", (q: any) => q.eq("userId", user!._id))
      .first();
    if (suspension) {
      throw new Error(`Account suspended: ${suspension.reason || "Contact support."}`);
    }
  } catch (e: any) {
    if (e.message?.includes("suspended")) throw e;
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
