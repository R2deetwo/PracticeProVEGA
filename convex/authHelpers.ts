
import { Doc } from "./_generated/dataModel";
import { resolveUserBySessionToken } from "./sessions";

/**
 * Helper to ensure the user is logged in and associated with a firm.
 * This is used by queries and mutations to enforce data isolation.
 *
 * AUTHENTICATION MODEL (R16 / plan Round 15 — Phase B, burned in):
 * The caller presents the bearer `sessionToken` issued by verifyLogin;
 * the server resolves the user by the token's SHA-256 hash (possession
 * proof — password + MFA were verified at the login gateway). There is
 * no other acceptance path: the legacy caller-supplied `userEmail`
 * branches (and the permissive anonymous fallback) were deleted after
 * the live cutover was proven by production spoof probes.
 */
export async function requireFirmUser(
  ctx: any,
  userEmail?: string,
  sessionToken?: string | null
): Promise<{
  firmId: string;
  userId: string;
  user: Doc<"users">;
}> {
  // Bearer session token — the only accepted proof. Possession of the
  // token proves the caller passed password (+ MFA) at login.
  if (sessionToken) {
    const user = await resolveUserBySessionToken(ctx, sessionToken);
    if (!user) {
      throw new Error(
        "Unauthenticated: the session token is invalid, expired, or revoked. Please sign in again."
      );
    }
    return await settleFirmUser(ctx, user as Doc<"users">);
  }

  // No token presented: reject before touching any caller-supplied
  // identity string. (The `userEmail` parameter is kept in the signature
  // so call sites don't churn — it is IGNORED.)
  throw new Error(
    "Unauthenticated: a verified session is required. Please sign in again."
  );
}

/**
 * Shared tail of requireFirmUser: firm check, portal-role block, and
 * suspension check — run identically no matter how the user resolved.
 */
async function settleFirmUser(
  ctx: any,
  user: Doc<"users"> | null
): Promise<{ firmId: string; userId: string; user: Doc<"users"> }> {
  if (!user || !user.firmId) {
    // ── RLS Audit: Log unauthorized access attempt ───────────────────
    try {
      await ctx.db.insert("securityEvents", {
        eventType: "unauthorized_access",
        email: user?.email || undefined,
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
        email: user.email,
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
export async function requireAdmin(
  ctx: any,
  userEmail?: string,
  sessionToken?: string | null
) {
  const auth = await requireFirmUser(ctx, userEmail, sessionToken);
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
