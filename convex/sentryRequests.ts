/**
 * Sentry Arrival Requests — RETIRED visitor-facing surface (TASK 94, 2026-11-25)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The ROUND SENTRY 2 workflow (a visitor arrives without a pass, the
 * gatehouse raises a request, the resident approves it) was RETIRED by
 * the owner's 2026-11-25 direction:
 *
 *   • Primary gate flow = the RESIDENT dispatches the visitor's access
 *     code ahead of arrival (generateVisitorToken in visitorManagement.ts);
 *     the gate verifies and grants/denies. There is no visitor-facing
 *     "request a pass" prompt at the gate for a resident's guest.
 *   • Pass/code request capability now lives quietly with ESTATE ADMIN as
 *     in-house STAFF time-tracking: issueStaffPass + getStaffAttendance
 *     (visitorManagement.ts) — admin-issued worker codes whose gate
 *     check-in/check-out timestamps form the movement/attendance log.
 *   • The gatehouse terminal itself now requires a station PIN when the
 *     estate admin has provisioned a gatehouse account
 *     (gatehouseAccounts.ts).
 *
 * REMOVED here (2026-11-25): createArrivalRequest (public gatehouse entry
 * point), decideArrivalRequest (resident decision), getSentryResidentRequests
 * (resident portal board), getGatehouseRequests (gate board), and the
 * VMS gate copy that only served the approval mint path.
 *
 * KEPT: the sentry_arrival_requests TABLE (rows are historical authorisation
 * records — approvals minted real visitor tokens that still stand) and the
 * expireStaleArrivalRequests cron, which keeps tidying any old pending rows.
 * No surface writes new rows; this module owns only that hygiene sweep.
 */
import { internalMutation } from "./_generated/server";

// ─── Cron: expire stale pending requests (12h unanswered) ────────────────
// Retired-workflow hygiene: any pre-2026-11-26 pending rows still get their
// terminal status so the historical record is complete.
export const expireStaleArrivalRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const staleMs = 12 * 60 * 60 * 1000;
    const pending: any[] = await ctx.db
      .query("sentry_arrival_requests")
      .withIndex("by_status", (q: any) => q.eq("status", "pending"))
      .collect();
    let expired = 0;
    for (const r of pending) {
      if (now - r.requestedAt > staleMs) {
        await ctx.db.patch(r._id, { status: "expired", updatedAt: now });
        expired++;
      }
    }
    return { expired };
  },
});
