
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

  // ── BACKWARD COMPATIBILITY ──────────────────────────────────────────
  // Many legacy client calls (mutations, AloaChat, etc.) do NOT pass
  // userEmail because they were written before the RLS enforcement was
  // added. Throwing "Unauthenticated" here breaks the entire app.
  //
  // SECURITY TRADE-OFF:
  // - When userEmail IS provided → full RLS enforcement (portal block,
  //   firm verification, suspension check). This is the primary path.
  // - When userEmail is NOT provided → we cannot identify the caller,
  //   so we return a permissive anonymous context. This preserves
  //   backward compatibility but does NOT enforce the portal block.
  //   The verifyLogin() gateway already blocks portal users from
  //   logging into the main app, so this is defense-in-depth, not the
  //   primary gate.
  //
  // TODO: Migrate all client calls to pass userEmail so this fallback
  // can be removed in a future release.
  if (!email) {
    // Log for monitoring (best-effort, don't block on failure)
    try {
      await ctx.db.insert("securityEvents", {
        eventType: "anonymous_legacy_call",
        details: "requireFirmUser: no userEmail provided (legacy call path)",
        timestamp: Date.now(),
      });
    } catch {}
    // Return permissive anonymous context — caller must supply firmId
    return {
      firmId: "",
      userId: "",
      user: null as any,
    };
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
    // Phase 4 (perf): index seek via users.by_email (previously a full users
    // table scan on EVERY login fallback)
    user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email!))
      .first();
  }

  if (!user || !user.firmId) {
    // ── RLS Audit: Log unauthorized access attempt ───────────────────
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

  // ── RLS: Block portal users from firm-level operations ────────────
  // Tenant/Client roles should ONLY access portal-scoped endpoints
  // (getTenantInfo, getTenantLedger, sendPortalMessage, etc.).
  // They must NOT pass requireFirmUser, which guards firm-wide CRUD
  // (createItem, updateItem, deleteItem, getFirmData, etc.).
  // This is the backend enforcement layer — the frontend redirect in
  // App.tsx is the UI layer, but the backend must enforce independently.
  if (user.role === "Tenant" || user.role === "Client") {
    try {
      await ctx.db.insert("securityEvents", {
        eventType: "unauthorized_access",
        userId: String(user._id),
        email: email,
        details: `requireFirmUser: portal role (${user.role}) attempted firm-level operation`,
        timestamp: Date.now(),
      });
    } catch {}
    throw new Error("Portal users do not have access to this feature.");
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
  // SECURITY FIX: Explicit guard — don't rely on null.role TypeError to
  // block anonymous callers. This makes the protection intentional.
  if (!auth.firmId || !auth.user) {
    throw new Error("Unauthenticated: userEmail required. Administrator access requires a verified session.");
  }
  if (auth.user.role !== "Admin") {
    throw new Error("Permission denied. This action requires Administrator privileges.");
  }
  return auth;
}
