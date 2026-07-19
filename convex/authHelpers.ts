
import { Doc } from "./_generated/dataModel";

/**
 * Helper to ensure the user is logged in and associated with a firm.
 * This is used by queries and mutations to enforce data isolation.
 *
 * SECURITY FIX: The previous version had a fallback that allowed
 * client-supplied `userEmail` when no auth session existed. This was
 * an auth bypass — any unauthenticated caller could pass any email
 * and access any firm's data (IDOR / horizontal privilege escalation).
 *
 * Now: ALWAYS require a valid Convex Auth identity. The client-supplied
 * `userEmail` parameter is accepted ONLY as a secondary lookup key AFTER
 * the session identity is verified — it can be used to find the user
 * record but cannot bypass authentication.
 */
export async function requireFirmUser(ctx: any, userEmail?: string): Promise<{
  firmId: string;
  userId: string;
  user: Doc<"users">;
}> {
  // Step 1: REQUIRE authenticated session — no exceptions
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated. Please log in to continue.");
  }

  // Use the authenticated identity's email as the primary lookup key
  const sessionEmail = (identity.email || identity.subject)?.toLowerCase();
  if (!sessionEmail) {
    throw new Error("Authentication error: no email in session identity.");
  }

  // Lookup user by the AUTHENTICATED email (not client-supplied)
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", sessionEmail))
    .first();

  // Fallback: try client-supplied email ONLY if it matches the session
  // (handles edge cases where tokenIdentifier was stored differently)
  if (!user && userEmail) {
    const clientEmail = userEmail.toLowerCase();
    // SECURITY: Only allow the client-supplied email if it matches the session
    if (clientEmail === sessionEmail) {
      user = await ctx.db
        .query("users")
        .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", clientEmail))
        .first();
    }
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
 * Helper to ensure the user has Admin privileges.
 */
export async function requireAdmin(ctx: any, userEmail?: string) {
  const auth = await requireFirmUser(ctx, userEmail);
  if (auth.user.role !== "Admin") {
    throw new Error("Permission denied. This action requires Administrator privileges.");
  }
  return auth;
}
