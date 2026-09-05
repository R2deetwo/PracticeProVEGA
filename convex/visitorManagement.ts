/**
 * Visitor Management System (VMS)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Gated-estate visitor access tokens. Residents generate 6-digit codes
 * for their visitors; gatekeepers verify at the gate.
 *
 * TWO DELIVERY MODES:
 *   1. client_share — resident shares via their own WhatsApp (wa.me deep link)
 *   2. portal_api   — backend sends WhatsApp via Chakra API gateway
 *
 * TOKEN SECURITY:
 *   6-digit codes are generated using crypto.getRandomValues for
 *   cryptographic randomness. Collision check: no two active tokens
 *   in the same estate can share the same code. If a collision is
 *   detected, a new code is generated (max 10 retries).
 *
 * GRACE PERIOD:
 *   Configurable buffer (default 30 min) allows entry slightly before
 *   or after the rigid expiry window. The verify endpoint accepts
 *   codes within [visitDate - grace, expiresAt + grace].
 *
 * OFFLINE FALLBACK:
 *   The gatekeeper UI caches the last 100 verified tokens in
 *   localStorage. If the network is down, the gatekeeper can still
 *   verify against the cache (with a warning that it's offline mode).
 */

import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { resolveCaller } from "./callerAuth";
import { api, internal } from "./_generated/api";
import { paddedDigitCode } from "./secureRandom";

// ─── Token Code Generation ───────────────────────────────────────────────

/**
 * Generates a cryptographically random 6-digit code, zero-padded.
 * SECURITY: draws from crypto.randomUUID entropy (was Math.random — a
 * predictable PRNG). crypto.randomUUID IS available in mutations
 * (verified in production by convex/impersonation.ts).
 */
function generate6DigitCode(): string {
  return paddedDigitCode(6);
}

/**
 * Generates a unique 6-digit code for an estate, checking for collisions
 * against active tokens in the same property over a rolling 24h window.
 * Max 10 retries before giving up (extremely unlikely).
 */
async function generateUniqueCode(ctx: any, propertyId: string): Promise<string> {
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generate6DigitCode();

    // Check for collisions: any token with this code in this property
    // that was created in the last 24h and isn't expired/revoked
    const existing = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_property_code", (q: any) => q.eq("propertyId", propertyId).eq("tokenCode", code))
      .filter((q: any) =>
        q.gte(q.field("createdAt"), twentyFourHoursAgo) &&
        q.neq(q.field("status"), "expired") &&
        q.neq(q.field("status"), "revoked")
      )
      .first();

    if (!existing) return code;
  }
  throw new Error("Failed to generate unique token code after 10 attempts. Please try again.");
}

// ─── Message Template ────────────────────────────────────────────────────

function buildVisitorMessage(
  visitorName: string,
  estateName: string,
  tokenCode: string,
  visitDate: string,
  expiresAt: number,
  address: string,
  mapsLink: string,
  residentName?: string,
  unitName?: string,
): string {
  const expiryTime = new Date(expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const expiryDate = new Date(expiresAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  // Standardized Sentry Pass message format — structured for SMS/WhatsApp distribution
  return `🛡️ SENTRY PASS ACCESS CODE: [ ${tokenCode} ]
----------------------------------------
Host: ${residentName || 'Resident'}
Destination: ${estateName}${unitName ? `, Unit ${unitName}` : ''}
Valid Until: ${expiryDate} ${expiryTime}

Please present this pass at the main security gate upon arrival.`;
}

function buildMapsLink(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

// ─── Mutation: Generate Visitor Token ────────────────────────────────────

export const generateVisitorToken = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.string(),
    unitId: v.optional(v.string()),
    residentId: v.string(),         // currentUser.id (Convex _id of the user)
    visitorName: v.string(),
    visitorPhone: v.string(),
    visitDate: v.string(),           // YYYY-MM-DD
    expiryWindowHours: v.number(),   // 2, 6, 12, or 24
    deliveryMethod: v.union(v.literal("client_share"), v.literal("portal_api")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ─── CALLER IDENTITY (R16 strict cutover) ───────────────────────────
    // The previous gate (ctx.auth.getUserIdentity) could never pass under
    // this app's custom auth — Convex Auth is not configured, so identity
    // was always null and EVERY token generation threw "Not authenticated".
    // (This is why Komplete firms still hit a wall despite the tier bypass
    // below — the function was dead for everyone.) Resolve the caller from
    // the bearer session and bind possession to the resident record.
    const caller = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userId: args.residentId,
    });
    if (String(caller._id) !== String(args.residentId)) {
      throw new Error("Not authorized: visitor codes can only be generated for the signed-in resident.");
    }
    if (caller.firmId && caller.firmId !== args.firmId) {
      throw new Error("Not authorized: firm mismatch.");
    }

    // ─── VMS ADD-ON BILLING GATE ──────────────────────────────────────
    // VMS is a paid add-on. Before generating a token, verify the firm has
    // an active or trial VMS add-on subscription. If the trial has expired
    // or no subscription exists, block token generation with a clear
    // upgrade prompt.
    let firm: any = await ctx.db
      .query("firms")
      .filter((q: any) => q.eq(q.field("id"), args.firmId))
      .first();
    if (!firm) {
      try { firm = await ctx.db.get(args.firmId as any); } catch { /* not a valid Convex id */ }
    }
    if (firm) {
      // ─── TIER-BASED BYPASS (Aug 2026) ────────────────────────────────
      // Komplete and Enterprise firms get VMS included free (per pricing page
      // promise: "Sentry Pass (VMS) included"). This mirrors the Estate
      // Community pattern in estateCommunity.ts → requireEstateCommunityAccess.
      // Previously, the pricing page promised "included" but the backend
      // gate had no tier check — Komplete customers paying ₦2.5M/year would
      // hit the same paywall as Starter customers unless someone manually
      // flipped subscriptionAddons.vms.status to 'active'.
      const plan = firm.subscriptionPlan;
      const isVmsIncludedInPlan = plan === 'Komplete' || plan === 'Enterprise';

      if (!isVmsIncludedInPlan) {
        // Below Komplete/Enterprise: check the add-on status
        const vmsAddon = (firm.subscriptionAddons as any)?.vms;
        if (!vmsAddon || vmsAddon.status === 'none' || vmsAddon.status === 'expired' || vmsAddon.status === 'suspended') {
          // Allow if founder firm (practicepro.ng) for testing
          const isFounderFirm = (firm.email || '').toLowerCase().endsWith('@practicepro.ng')
            || firm.id === 'practicepro'
            || (firm.name || '').toLowerCase().includes('practicepro');
          if (!isFounderFirm) {
            throw new Error("VMS_ADDON_REQUIRED: Your firm does not have an active Visitor Management System add-on. Please ask your firm admin to subscribe in Settings → Subscription → Add-ons.");
          }
        } else if (vmsAddon.status === 'trial' && vmsAddon.trialEndsAt && vmsAddon.trialEndsAt < Date.now()) {
          // Trial has expired — auto-mark as expired
          vmsAddon.status = 'expired';
          await ctx.db.patch(firm._id, {
            subscriptionAddons: { ...(firm.subscriptionAddons as any || {}), vms: vmsAddon },
          });
          throw new Error("VMS_TRIAL_EXPIRED: Your 30-day VMS trial has ended. Please subscribe to the VMS add-on in Settings → Subscription → Add-ons to continue generating visitor codes.");
        }
      }
    }

    // Fetch property details (for denormalized gate display)
    const property: any = await ctx.db.get(args.propertyId as any);
    if (!property) throw new Error("Property not found");

    // Fetch resident user record by _id
    const resident: any = await ctx.db.get(args.residentId as any);
    const residentName = resident?.name || resident?.email || "Resident";
    const residentPhone = resident?.phone || resident?.phoneNumber || "";

    // Fetch unit if provided
    let unitName: string | undefined;
    if (args.unitId) {
      const unit: any = await ctx.db.get(args.unitId as any);
      if (unit) unitName = unit.name || unit.unitName;
    }

    // Generate unique 6-digit code
    const tokenCode = await generateUniqueCode(ctx, args.propertyId);

    // Compute expiry: visitDate at 00:00 + expiryWindowHours
    // The token is valid from the start of the visit date until
    // visitDate + expiryWindowHours
    const visitStart = new Date(args.visitDate + "T00:00:00");
    const expiresAt = visitStart.getTime() + args.expiryWindowHours * 60 * 60 * 1000;

    const now = Date.now();
    // Read grace period from portal settings (admin-configurable).
    // Previously hardcoded to 30 minutes — now honors the admin setting
    // from PortalAccessSettings (vmsGracePeriodMinutes).
    const portalSettings = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q) => q.eq("firmId", args.firmId))
      .first();
    const gracePeriodMinutes = portalSettings?.vmsGracePeriodMinutes ?? 30;

    const tokenId = await ctx.db.insert("visitor_tokens", {
      firmId: args.firmId,
      propertyId: args.propertyId,
      propertyName: property.name,
      propertyAddress: property.address,
      unitId: args.unitId,
      unitName,
      residentId: args.residentId,
      residentName,
      residentPhone,
      visitorName: args.visitorName,
      visitorPhone: args.visitorPhone,
      tokenCode,
      deliveryMethod: args.deliveryMethod,
      status: "active",
      visitDate: args.visitDate,
      expiresAt,
      expiryWindowHours: args.expiryWindowHours,
      gracePeriodMinutes,
      createdAt: now,
      updatedAt: now,
    });

    // If portal_api delivery, schedule the WhatsApp send as an action
    // (mutations can't call actions directly, so we return a flag and
    // the frontend triggers the send action, OR we use scheduler)
    let whatsappResult: any = null;
    if (args.deliveryMethod === "portal_api") {
      // Schedule the WhatsApp send — non-blocking, runs after mutation completes
      await ctx.scheduler.runAfter(0, internal.visitorManagement.sendVisitorWhatsApp, {
        tokenId,
        visitorName: args.visitorName,
        visitorPhone: args.visitorPhone,
        estateName: property.name || "the estate",
        tokenCode,
        visitDate: args.visitDate,
        expiresAt,
        address: property.address || "",
        firmId: args.firmId,
      });
    }

    return {
      tokenId,
      tokenCode,
      expiresAt,
      message: args.deliveryMethod === "client_share"
        ? buildVisitorMessage(
            args.visitorName,
            property.name || "the estate",
            tokenCode,
            args.visitDate,
            expiresAt,
            property.address || "",
            buildMapsLink(property.address || ""),
            residentName,
            unitName,
          )
        : undefined,
      whatsappScheduled: args.deliveryMethod === "portal_api",
    };
  },
});

// ─── Internal Action: Send Visitor WhatsApp ──────────────────────────────

export const sendVisitorWhatsApp = internalAction({
  args: {
    tokenId: v.id("visitor_tokens"),
    visitorName: v.string(),
    visitorPhone: v.string(),
    estateName: v.string(),
    tokenCode: v.string(),
    visitDate: v.string(),
    expiresAt: v.number(),
    address: v.string(),
    firmId: v.string(),
  },
  handler: async (ctx, args) => {
    const mapsLink = buildMapsLink(args.address);
    const messageText = buildVisitorMessage(
      args.visitorName,
      args.estateName,
      args.tokenCode,
      args.visitDate,
      args.expiresAt,
      args.address,
      mapsLink,
    );

    try {
      const result = await ctx.runAction(api.communications.sendWhatsApp, {
        to: args.visitorPhone,
        messageText,
        firmId: args.firmId,
      });

      // Update token with send result
      await ctx.runMutation(internal.visitorManagement.markWhatsAppSent, {
        tokenId: args.tokenId,
        success: result.success,
        sentAt: result.success ? Date.now() : undefined,
      });

      if (!result.success) {
        console.error("[VMS] WhatsApp send failed:", result.error);
      }
    } catch (err: any) {
      console.error("[VMS] WhatsApp send error:", err.message);
      await ctx.runMutation(internal.visitorManagement.markWhatsAppSent, {
        tokenId: args.tokenId,
        success: false,
      });
    }
  },
});

export const markWhatsAppSent = internalMutation({
  args: {
    tokenId: v.id("visitor_tokens"),
    success: v.boolean(),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, {
      whatsappSentAt: args.success ? args.sentAt : undefined,
      updatedAt: Date.now(),
    });
  },
});

// ─── Query: Verify Token (Gatekeeper) ────────────────────────────────────

export const verifyToken = query({
  args: {
    tokenCode: v.string(),
    propertyId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find token by code + property
    const token: any = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_property_code", (q: any) => q.eq("propertyId", args.propertyId).eq("tokenCode", args.tokenCode))
      .first();

    if (!token) {
      return {
        valid: false,
        reason: "invalid",
        message: "Code not recognized. Please check and try again.",
      };
    }

    // Check if revoked
    if (token.status === "revoked") {
      return {
        valid: false,
        reason: "revoked",
        message: "This code has been revoked by the resident.",
        visitorName: token.visitorName,
      };
    }

    // Check if already used (checked in but not checked out)
    if (token.status === "used" && token.checkedInAt && !token.checkedOutAt) {
      return {
        valid: false,
        reason: "already_inside",
        message: `${token.visitorName} is already checked in.`,
        visitorName: token.visitorName,
        checkedInAt: token.checkedInAt,
      };
    }

    // Check if already used and checked out
    if (token.status === "used" && token.checkedOutAt) {
      return {
        valid: false,
        reason: "used",
        message: "This code has already been used.",
        visitorName: token.visitorName,
      };
    }

    // Check expiry with grace period
    const graceMs = (token.gracePeriodMinutes || 30) * 60 * 1000;
    const visitStart = new Date(token.visitDate + "T00:00:00").getTime();
    const validFrom = visitStart - graceMs; // grace before visit date
    const validUntil = token.expiresAt + graceMs; // grace after expiry

    if (now < validFrom) {
      return {
        valid: false,
        reason: "not_yet_valid",
        message: `This code is valid from ${new Date(validFrom).toLocaleString("en-GB")}.`,
        visitorName: token.visitorName,
        validFrom,
      };
    }

    if (now > validUntil) {
      return {
        valid: false,
        reason: "expired",
        message: "This code has expired.",
        visitorName: token.visitorName,
        expiredAt: token.expiresAt,
      };
    }

    // Valid!
    return {
      valid: true,
      tokenId: token._id,
      visitorName: token.visitorName,
      visitorPhone: token.visitorPhone,
      estateName: token.propertyName,
      address: token.propertyAddress,
      unitName: token.unitName,
      residentName: token.residentName,
      expiresAt: token.expiresAt,
      visitDate: token.visitDate,
      gracePeriodMinutes: token.gracePeriodMinutes || 30,
    };
  },
});

// ─── Mutation: Check In Visitor ──────────────────────────────────────────

export const checkInVisitor = mutation({
  args: {
    tokenId: v.id("visitor_tokens"),
    gatekeeperId: v.optional(v.string()),
    gatekeeperName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token: any = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    if (token.status !== "active") throw new Error(`Token is ${token.status}, cannot check in`);

    const now = Date.now();
    await ctx.db.patch(args.tokenId, {
      status: "used",
      checkedInAt: now,
      checkedInBy: args.gatekeeperName || args.gatekeeperId || "Gatekeeper",
      updatedAt: now,
    });

    return { success: true, checkedInAt: now };
  },
});

// ─── Mutation: Check Out Visitor ─────────────────────────────────────────

export const checkOutVisitor = mutation({
  args: {
    tokenId: v.id("visitor_tokens"),
  },
  handler: async (ctx, args) => {
    const token: any = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    if (!token.checkedInAt) throw new Error("Visitor has not checked in");

    const now = Date.now();
    await ctx.db.patch(args.tokenId, {
      checkedOutAt: now,
      updatedAt: now,
    });

    return { success: true, checkedOutAt: now };
  },
});

// ─── Mutation: Revoke Token ──────────────────────────────────────────────

export const revokeVisitorToken = mutation({
  args: {
    tokenId: v.id("visitor_tokens"),
    reason: v.optional(v.string()),
    residentId: v.string(),  // for authorization check
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // R16 strict: resolve the caller from the bearer session (the previous
    // ctx.auth gate never passed under custom auth — dead check). The
    // possession check below binds revocation to the creating resident.
    const caller = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userId: args.residentId,
    });
    if (String(caller._id) !== String(args.residentId)) {
      throw new Error("Not authorized: only the resident who created this code can revoke it.");
    }

    const token: any = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");

    // Only the resident who created it can revoke
    if (token.residentId !== args.residentId) {
      throw new Error("Only the resident who created this code can revoke it");
    }

    const now = Date.now();
    await ctx.db.patch(args.tokenId, {
      status: "revoked",
      revokedAt: now,
      revokedReason: args.reason,
      updatedAt: now,
    });

    return { success: true };
  },
});

// ─── Query: Get Resident's Tokens ────────────────────────────────────────

export const getResidentTokens = query({
  args: {
    firmId: v.string(),
    residentId: v.string(),
    status: v.optional(v.string()), // filter by status, or all
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY (R16 strict cutover): the caller must present a valid bearer
    // session and may only view their OWN tokens. The previous email lookup
    // accepted any caller-supplied email (spoofable); the Convex-Auth branch
    // never fired under custom auth. Portal roles (Tenant/Client) are
    // EXPECTED here — this is the resident-facing portal endpoint — so we
    // resolve identity directly instead of using requireFirmUser.
    const user: any = await resolveCaller(ctx, {
      sessionToken: args.sessionToken,
      userId: args.residentId,
    });
    if (!user) {
      throw new Error("Unauthenticated: user account not found.");
    }
    // The caller may only view their OWN tokens
    if (String(user._id) !== args.residentId) {
      throw new Error("Not authorized: you can only view your own visitor tokens.");
    }
    // Cross-check the resident belongs to the claimed firm
    if (user.firmId && user.firmId !== args.firmId) {
      throw new Error("Not authorized: firm mismatch.");
    }
    // Suspension check
    const suspension = await ctx.db
      .query("suspendedUsers")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (suspension) {
      throw new Error(`Account suspended: ${suspension.reason || "Contact support."}`);
    }

    let q = ctx.db
      .query("visitor_tokens")
      .withIndex("by_firm_resident", (q: any) => q.eq("firmId", args.firmId).eq("residentId", args.residentId));

    const tokens = await q.collect();

    // Filter by status if provided
    const filtered = args.status ? tokens.filter((t: any) => t.status === args.status) : tokens;

    // Sort by createdAt desc
    return filtered.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

// ─── Query: Get Gatehouse Logs (for a property) ──────────────────────────
// PUBLIC endpoint (used by /gatehouse tablets without login — by design).
// SECURITY: returns a MINIMAL projection. The full token document contains
// PII (visitor phone, resident ids, delivery details) that the gatehouse UI
// never displays — leaking it to an unauthenticated caller who knows a
// propertyId was an information-disclosure hole. Only the fields the
// gatehouse board actually renders are returned.

export const getGatehouseLogs = query({
  args: {
    propertyId: v.string(),
    date: v.optional(v.string()), // YYYY-MM-DD, defaults to today
  },
  handler: async (ctx, args) => {
    const targetDate = args.date || new Date().toISOString().split("T")[0];
    const dayStart = new Date(targetDate + "T00:00:00").getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const tokens = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_property", (q: any) => q.eq("propertyId", args.propertyId))
      .filter((q: any) =>
        q.gte(q.field("createdAt"), dayStart) &&
        q.lt(q.field("createdAt"), dayEnd)
      )
      .collect();

    // Minimal projection — gatehouse board needs only these fields
    const projected = tokens.map((t: any) => ({
      _id: t._id,
      visitorName: t.visitorName,
      tokenCode: t.tokenCode,
      checkedInAt: t.checkedInAt,
      checkedOutAt: t.checkedOutAt,
      status: t.status,
    }));

    // Sort by checkedInAt desc (most recent first), tokens without check-in at the end
    return projected.sort((a: any, b: any) => {
      const aTime = a.checkedInAt || 0;
      const bTime = b.checkedInAt || 0;
      return bTime - aTime;
    });
  },
});

// ─── Query: Get Properties for Gatekeeper ────────────────────────────────
// Returns all properties for a firm so the gatekeeper can select their estate

export const getGatekeeperProperties = query({
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .collect();

    return properties.map((p: any) => ({
      id: p._id,
      name: p.name,
      address: p.address,
    }));
  },
});

// ─── Cron: Cleanup Expired Tokens ────────────────────────────────────────
// Runs every 15 minutes, marks tokens as "expired" past their grace period

export const cleanupExpiredTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all active tokens whose expiry + grace period has passed
    const activeTokens = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_status", (q: any) => q.eq("status", "active"))
      .collect();

    let expiredCount = 0;
    for (const token of activeTokens) {
      const graceMs = (token.gracePeriodMinutes || 30) * 60 * 1000;
      const validUntil = token.expiresAt + graceMs;

      if (now > validUntil) {
        await ctx.db.patch(token._id, {
          status: "expired",
          updatedAt: now,
        });
        expiredCount++;
      }
    }

    return { expiredCount };
  },
});
