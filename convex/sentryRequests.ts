/**
 * Sentry Arrival Requests — ROUND SENTRY 2 (resident authorisation workflow)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The Sentry Pass brief §2: a visitor arrives WITHOUT a pass, the
 * gatehouse raises a request, the resident is notified and approves or
 * rejects it. The request row IS the authorisation record — requestedBy/
 * At, decidedBy/At, rejectReason and the minted tokenId are all kept.
 *
 * FLOW
 *   gatehouse                resident (portal)              visitor
 *   ────────                 ────────                       ───────
 *   createArrivalRequest  →  app_notifications ping
 *                            decideArrivalRequest
 *                            ├─ approved  → mints a visitor_tokens row
 *                            │              (SAME billing gate + unique-code
 *                            │               rule as generateVisitorToken)
 *                            │              → WhatsApp to the visitor when a
 *                            │                 phone was left at the gate
 *                            └─ rejected  → recorded, gatehouse sees it
 *
 * SECURITY
 *   - createArrivalRequest is PUBLIC (gatehouse tablet, no login) but
 *     rate-limited 10/min/property; the resident is resolved SERVER-SIDE
 *     from the active tenancy of the announced unit — never from a
 *     caller-supplied resident id.
 *   - decideArrivalRequest is the resident's OWN call: resolveCaller
 *     possession (bearer session) + the request must target them.
 *   - Notifications are minimal: visitor name + unit + who's asking.
 *     No gatehouse-visible phone numbers, no address.
 *   - Approval passes through the SAME VMS billing gate as
 *     generateVisitorToken (copied verbatim, not bypassed).
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { resolveCaller } from "./callerAuth";
import { internal } from "./_generated/api";
import { checkRateLimit } from "./securityHelpers";
import { generateUniqueCode } from "./visitorManagement";
import { codeFromCharset } from "./secureRandom";

const PASSREF_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PASSREF_LENGTH = 12;
function mintPassRef(): string {
  return codeFromCharset(PASSREF_CHARSET, PASSREF_LENGTH);
}

// ─── VMS billing gate (identical to generateVisitorToken's — never bypassed
// on the approval path; kept as a verbatim copy so the resident-facing
// generateVisitorToken source stays byte-stable under its pinned tests).
async function assertVmsEntitlement(ctx: any, firmId: string): Promise<void> {
  let firm: any = await ctx.db
    .query("firms")
    .filter((q: any) => q.eq(q.field("id"), firmId))
    .first();
  if (!firm) {
    try { firm = await ctx.db.get(firmId as any); } catch { /* not a valid Convex id */ }
  }
  if (!firm) return; // generateVisitorToken tolerates a missing firm row the same way

  const plan = firm.subscriptionPlan;
  const isVmsIncludedInPlan = plan === 'Komplete' || plan === 'Enterprise';
  if (isVmsIncludedInPlan) return;

  const vmsAddon = (firm.subscriptionAddons as any)?.vms;
  if (!vmsAddon || vmsAddon.status === 'none' || vmsAddon.status === 'expired' || vmsAddon.status === 'suspended') {
    const isFounderFirm = (firm.email || '').toLowerCase().endsWith('@practicepro.ng')
      || firm.id === 'practicepro'
      || (firm.name || '').toLowerCase().includes('practicepro');
    if (!isFounderFirm) {
      throw new Error("VMS_ADDON_REQUIRED: Your firm does not have an active Visitor Management System add-on. Please ask your firm admin to subscribe in Settings → Subscription → Add-ons.");
    }
  } else if (vmsAddon.status === 'trial' && vmsAddon.trialEndsAt && vmsAddon.trialEndsAt < Date.now()) {
    throw new Error("VMS_TRIAL_EXPIRED: Your 30-day VMS trial has ended. Please subscribe to the VMS add-on in Settings → Subscription → Add-ons to continue generating visitor codes.");
  }
}

// ─── Mutation: createArrivalRequest (gatehouse, public + throttled) ──────
export const createArrivalRequest = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.string(),
    unitLabel: v.string(),          // the unit as announced ("Flat 3B")
    visitorName: v.string(),
    visitorPhone: v.optional(v.string()),  // optional — only if offered at the gate
    notes: v.optional(v.string()),        // gatekeeper context, ≤200 chars
    requestedBy: v.string(),              // gatekeeper name / device label
  },
  handler: async (ctx, args) => {
    const allowed = await checkRateLimit(ctx, `sentry-req:${args.propertyId}`, 10, 60_000);
    if (!allowed) {
      throw new Error("Too many requests raised. Please wait a moment and try again.");
    }

    const visitorName = args.visitorName?.trim();
    const unitLabel = args.unitLabel?.trim();
    if (!visitorName) throw new Error("Visitor name is required.");
    if (!unitLabel) throw new Error("Unit is required — ask which unit they are visiting.");

    // Property (denormalized estate name for notifications)
    const property: any = await ctx.db.get(args.propertyId as any);
    const propertyName = property?.name ?? undefined;

    // Resolve the resident SERVER-SIDE from the ACTIVE tenancy of that unit
    // in this property. Match on unitName (case-insensitive) or unitKey;
    // never trust a caller-supplied resident id.
    const tenancies: any[] = await ctx.db
      .query("tenancies")
      .withIndex("by_property", (q: any) => q.eq("propertyId", args.propertyId))
      .collect();
    const label = unitLabel.toLowerCase();
    const candidates = tenancies.filter((t: any) => {
      if (String(t.status ?? '') !== 'active') return false;
      const un = (t.unitName || '').trim().toLowerCase();
      const uk = (t.unitKey || '').trim().toLowerCase();
      const uid = (t.unitId || '').trim().toLowerCase();
      return un === label || uk === label || uid === label;
    });
    const latest = candidates.sort((a: any, b: any) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
    const residentId = latest?.tenantUserId;
    if (!residentId) {
      throw new Error(`No active resident found for unit "${unitLabel}" — the visitor needs a pass from the resident directly.`);
    }

    const resident: any = await ctx.db.get(residentId as any);
    const residentName = resident?.name || resident?.email || "Resident";

    const now = Date.now();
    const requestId = await ctx.db.insert("sentry_arrival_requests", {
      firmId: args.firmId,
      propertyId: args.propertyId,
      propertyName,
      unitId: latest.unitId ?? undefined,
      unitName: unitLabel,
      residentId,
      residentName,
      residentPhone: resident?.phone || resident?.phoneNumber || undefined,
      visitorName: visitorName.slice(0, 80),
      visitorPhone: args.visitorPhone?.trim().slice(0, 40) || undefined,
      notes: args.notes?.trim().slice(0, 200) || undefined,
      status: "pending",
      requestedBy: (args.requestedBy || "Gatehouse").slice(0, 80),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Notify the resident in-app (NotificationCenter reads app_notifications)
    try {
      await ctx.db.insert("app_notifications", {
        userId: residentId,
        firmId: args.firmId,
        title: "Visitor at the gate",
        body: `${visitorName.slice(0, 80)} is at the gate for ${unitLabel}${propertyName ? ` · ${propertyName}` : ''}. Approve or reject in your portal.`,
        type: "security",
        priority: "high",
        actionType: "navigate",
        actionUrl: null,
        actionData: { tab: "visitors", requestId: String(requestId) },
        isRead: false,
        readAt: null,
        createdAt: now,
      });
    } catch { /* notification is best-effort; the request row stands alone */ }

    return { requestId, residentName };
  },
});

// ─── Mutation: decideArrivalRequest (resident, session + possession) ─────
export const decideArrivalRequest = mutation({
  args: {
    requestId: v.id("sentry_arrival_requests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectReason: v.optional(v.string()),
    residentId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Same caller model as getResidentTokens/revokeVisitorToken: bearer
    // session, and the caller may only decide THEIR OWN requests.
    const caller = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userId: args.residentId,
    });
    if (String(caller._id) !== String(args.residentId)) {
      throw new Error("Not authorized: only the signed-in resident can decide their own requests.");
    }

    const req: any = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found.");
    if (req.residentId !== args.residentId) {
      throw new Error("Not authorized: this request belongs to another resident.");
    }
    if (req.status !== "pending") {
      throw new Error(`This request was already ${req.status}.`);
    }

    const now = Date.now();

    // ── REJECT: record and close. ─────────────────────────────────────
    if (args.decision === "rejected") {
      await ctx.db.patch(args.requestId, {
        status: "rejected",
        decidedAt: now,
        decidedBy: args.residentId,
        rejectReason: args.rejectReason?.trim().slice(0, 200) || undefined,
        updatedAt: now,
      });
      return { decision: "rejected", requestId: String(args.requestId) };
    }

    // ── APPROVE: mint a pass through the SAME gate + uniqueness rule. ──
    await assertVmsEntitlement(ctx, req.firmId);

    const property: any = await ctx.db.get(req.propertyId as any);
    const propertyName = property?.name ?? req.propertyName ?? undefined;
    const propertyAddress = property?.address ?? undefined;

    const tokenCode = await generateUniqueCode(ctx, req.propertyId);
    let passRef = mintPassRef();
    for (let i = 0; i < 3; i++) {
      const clash = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_passref", (q: any) => q.eq("propertyId", req.propertyId).eq("passRef", passRef))
        .first();
      if (!clash) break;
      passRef = mintPassRef();
    }

    // Same expiry shape as generateVisitorToken: visitDate = today,
    // window = the portal default (6h) — an approval is a TODAY pass.
    const today = new Date().toISOString().split("T")[0];
    const visitStart = new Date(today + "T00:00:00");
    const expiryWindowHours = 6;
    const expiresAt = visitStart.getTime() + expiryWindowHours * 60 * 60 * 1000;

    const portalSettings = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q: any) => q.eq("firmId", req.firmId))
      .first();
    const gracePeriodMinutes = portalSettings?.vmsGracePeriodMinutes ?? 30;

    const tokenId = await ctx.db.insert("visitor_tokens", {
      firmId: req.firmId,
      propertyId: req.propertyId,
      propertyName,
      propertyAddress,
      unitId: req.unitId ?? undefined,
      unitName: req.unitName ?? undefined,
      residentId: req.residentId,
      residentName: req.residentName ?? undefined,
      residentPhone: req.residentPhone ?? undefined,
      visitorName: req.visitorName,
      visitorPhone: req.visitorPhone ?? "-",
      tokenCode,
      passRef,
      deliveryMethod: "portal_api",
      status: "active",
      visitDate: today,
      expiresAt,
      expiryWindowHours,
      gracePeriodMinutes,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.requestId, {
      status: "approved",
      decidedAt: now,
      decidedBy: args.residentId,
      tokenId,
      updatedAt: now,
    });

    // WhatsApp the code to the visitor when a phone was left at the gate;
    // otherwise the resident relays it (the row keeps it either way).
    let delivered: "whatsapp" | "manual" = "manual";
    if (req.visitorPhone) {
      try {
        await ctx.scheduler.runAfter(0, internal.visitorManagement.sendVisitorWhatsApp, {
          tokenId,
          visitorName: req.visitorName,
          visitorPhone: req.visitorPhone,
          estateName: propertyName || "the estate",
          tokenCode,
          visitDate: today,
          expiresAt,
          address: propertyAddress || "",
          firmId: req.firmId,
        });
        delivered = "whatsapp";
      } catch { /* delivery failure never invalidates the approval */ }
    }

    return {
      decision: "approved",
      requestId: String(args.requestId),
      tokenId: String(tokenId),
      tokenCode,
      passRef,
      expiresAt,
      delivered,
    };
  },
});

// ─── Query: the resident's own requests (portal, session + possession) ───
export const getSentryResidentRequests = query({
  args: {
    firmId: v.string(),
    residentId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userId: args.residentId,
    });
    if (String(caller._id) !== String(args.residentId)) {
      throw new Error("Not authorized: you can only view your own requests.");
    }
    if (caller.firmId && caller.firmId !== args.firmId) {
      throw new Error("Not authorized: firm mismatch.");
    }

    const rows: any[] = await ctx.db
      .query("sentry_arrival_requests")
      .withIndex("by_resident", (q: any) => q.eq("residentId", args.residentId))
      .collect();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return rows
      .filter((r: any) => r.status === "pending" || r.requestedAt >= weekAgo)
      .sort((a: any, b: any) => b.requestedAt - a.requestedAt)
      .slice(0, 50)
      .map((r: any) => ({
        requestId: r._id,
        visitorName: r.visitorName,
        unitName: r.unitName,
        propertyName: r.propertyName,
        status: r.status,
        notes: r.notes,
        requestedBy: r.requestedBy,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt,
        rejectReason: r.rejectReason,
      }));
  },
});

// ─── Query: gatehouse board for requests (public + throttled) ────────────
// Minimal projection: names, units, statuses, times. No phones, no ids
// beyond the request id the gate already holds.
export const getGatehouseRequests = query({
  args: {
    propertyId: v.string(),
  },
  handler: async (ctx, args) => {
    const allowed = await checkRateLimit(ctx, `sentry-req-board:${args.propertyId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    const rows: any[] = await ctx.db
      .query("sentry_arrival_requests")
      .withIndex("by_property", (q: any) => q.eq("propertyId", args.propertyId))
      .collect();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return rows
      .filter((r: any) => r.status === "pending" || r.requestedAt >= dayAgo)
      .sort((a: any, b: any) => b.requestedAt - a.requestedAt)
      .slice(0, 30)
      .map((r: any) => ({
        requestId: r._id,
        visitorName: r.visitorName,
        unitName: r.unitName,
        status: r.status,
        requestedBy: r.requestedBy,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt,
      }));
  },
});

// ─── Cron: expire stale pending requests (12h unanswered) ────────────────
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
