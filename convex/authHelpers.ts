
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
  let email = userEmail;

  if (!email) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated. Please log in to continue.");
    }
    email = identity.email || identity.subject;
  }
  
  if (!email) {
      throw new Error("Unauthenticated. No email provided.");
  }

  // Lookup user by email (tokenIdentifier)
  let user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email!))
    .first();

  if (!user) {
     user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email!.toLowerCase()))
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
