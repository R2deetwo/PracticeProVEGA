
import { Doc } from "./_generated/dataModel";

/**
 * Helper to ensure the user is logged in and associated with a firm.
 * This is used by queries and mutations to enforce data isolation.
 */
export async function requireFirmUser(ctx: any, userEmail?: string): Promise<{
  firmId: string;
  userId: string;
  user: Doc<"users">;
}> {
  // SECURITY: Always verify the authenticated session FIRST when available.
  // This prevents a caller from passing a different userEmail to access another firm's data.
  let sessionEmail: string | undefined;
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) sessionEmail = (identity.email || identity.subject)?.toLowerCase();
  } catch {}

  // If a session identity exists, always use it (ignore client-supplied email)
  let email = sessionEmail;

  // Fallback: if no session identity, use the client-supplied userEmail
  // (This supports Convex actions that don't have auth context)
  if (!email) {
    email = userEmail?.toLowerCase();
  }

  if (!email) {
    throw new Error("Unauthenticated. Please log in to continue.");
  }

  // Lookup user by email (tokenIdentifier)
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email!))
    .first();

  if (!user) {
     user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email!))
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
 * Helper to ensure the user has Admin privileges.
 */
export async function requireAdmin(ctx: any, userEmail?: string) {
  const auth = await requireFirmUser(ctx, userEmail);
  if (auth.user.role !== "Admin") {
    throw new Error("Permission denied. This action requires Administrator privileges.");
  }
  return auth;
}
