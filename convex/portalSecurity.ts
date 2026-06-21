import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * checkEmailForPortalConflict — Pre-flight security check
 * ─────────────────────────────────────────────────────────────────────────────
 * Called BEFORE creating a portal invitation. Checks if the email is already
 * registered as an internal staff member (Admin/Lawyer/Paralegal/ExternalCounsel)
 * in the specified firm. If so, the invitation must be BLOCKED to prevent
 * cross-portal session contamination.
 *
 * Returns:
 *   { hasConflict: false } — safe to proceed with invitation
 *   { hasConflict: true, role: "Admin", name: "John Doe" } — BLOCK the invitation
 */
export const checkEmailForPortalConflict = query({
  args: {
    email: v.string(),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    if (!email || !args.firmId) return { hasConflict: false };

    // Search for users with this email in the same firm
    const allUsers = await ctx.db.query("users").take(500);
    const matches = allUsers.filter((u: any) =>
      u.tokenIdentifier &&
      u.tokenIdentifier.toLowerCase() === email &&
      u.firmId === args.firmId
    );

    const ADMIN_ROLES = new Set(["Admin", "Lawyer", "Paralegal", "ExternalCounsel"]);
    const conflictingUser = matches.find((u: any) => ADMIN_ROLES.has(u.role));

    if (conflictingUser) {
      return {
        hasConflict: true,
        role: conflictingUser.role,
        name: conflictingUser.name || email,
      };
    }

    return { hasConflict: false };
  },
});
