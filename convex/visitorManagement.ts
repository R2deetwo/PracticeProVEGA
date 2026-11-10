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
import { paddedDigitCode, codeFromCharset } from "./secureRandom";
import { checkRateLimit } from "./securityHelpers";
import { requireFirmUser } from "./authHelpers";

// ─── ROUND SENTRY 4: passRef (non-guessable pass identifier) ──────────────
// 12 chars from an ambiguity-free 31-symbol alphabet (no I/L/O/0/1) drawn
// via the crypto-secure rejection-sampling helpers (secureRandom). ~59.5
// bits of entropy — enumeration is not a practical attack. The 6-digit PIN
// stays for fast typing; the passRef is the machine-verifiable identifier
// (links/QR/audit joins) and never doubles as the PIN.
const PASSREF_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 23 letters + 8 digits
const PASSREF_LENGTH = 12;
function generatePassRef(): string {
  return codeFromCharset(PASSREF_CHARSET, PASSREF_LENGTH);
}

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
 * ROUND SENTRY 2: exported so the arrival-request approval path mints
 * passes through the IDENTICAL uniqueness rule.
 */
export async function generateUniqueCode(ctx: any, propertyId: string): Promise<string> {
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
    // ROUND SENTRY 1 (all optional, display-only — never widens the window):
    expectedArrival: v.optional(v.string()),  // "HH:MM" 24h
    accessNote: v.optional(v.string()),       // ≤120 chars, gate instructions
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

    // Generate unique 6-digit code + non-guessable passRef (ROUND SENTRY 4).
    // passRef collision is a 31^-12 event; we still re-roll once on a hit.
    const tokenCode = await generateUniqueCode(ctx, args.propertyId);
    let passRef = generatePassRef();
    for (let i = 0; i < 3; i++) {
      const clash = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_passref", (q: any) => q.eq("propertyId", args.propertyId).eq("passRef", passRef))
        .first();
      if (!clash) break;
      passRef = generatePassRef();
    }

    // Compute expiry: visitDate at 00:00 + expiryWindowHours
    // The token is valid from the start of the visit date until
    // visitDate + expiryWindowHours
    const visitStart = new Date(args.visitDate + "T00:00:00");
    const expiresAt = visitStart.getTime() + args.expiryWindowHours * 60 * 60 * 1000;

    // ROUND SENTRY 1: enforce the display-only caps before insert.
    const expectedArrival = args.expectedArrival?.trim() || undefined;
    if (expectedArrival && !/^([01]\d|2[0-3]):[0-5]\d$/.test(expectedArrival)) {
      throw new Error("Invalid expected arrival time — use HH:MM (24-hour).");
    }
    const accessNote = args.accessNote?.trim().slice(0, 120) || undefined;

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
      expectedArrival,
      accessNote,
      tokenCode,
      passRef,
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
      passRef,
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
      const result = await ctx.runAction(internal.communications.sendWhatsAppCore, {
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
    tokenCode: v.optional(v.string()),   // ROUND SENTRY: either identifier works
    passRef: v.optional(v.string()),     // alone — code OR passRef (not both needed)
    propertyId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // ROUND SENTRY 4: exactly one identifier must be presented, upper-cased
    // for passRef (case-insensitive typing at the gate).
    const ref = args.passRef?.trim().toUpperCase() || undefined;
    const code = args.tokenCode?.trim() || undefined;
    if (!ref && !code) {
      return { valid: false, reason: "invalid", message: "Enter a code first." };
    }

    // ── ROUND A (C8): brute-force throttle + PII minimization. ─────────
    //    verifyToken previously returned visitor phone + resident name +
    //    estate address for a 6-digit code with NO rate limit — a scripted
    //    sweep over the 10^6 code space (propertyId is public in the
    //    gatehouse URL) harvested visitor/resident PII. Now: 30 verifies
    //    per minute per property (checkRateLimit logs a rate_limit_exceeded
    //    security event on the 31st), and the response carries ONLY what
    //    the gate display and the check-in flow actually need — fields
    //    already printed on the visitor's own Sentry Pass message. No
    //    phone numbers, no street addresses, no internal Convex ids.
    const allowed = await checkRateLimit(ctx, `vms-verify:${args.propertyId}`, 30, 60_000);
    if (!allowed) {
      return {
        valid: false,
        reason: "rate_limited",
        message: "Too many verification attempts. Please wait a moment and try again.",
      };
    }

    // Find token by (code | passRef) + property (ROUND SENTRY 4: passRef
    // lookups ride the by_property_passref index — same semantics, ~59.5-bit
    // identifier instead of the 20-bit PIN)
    let token: any = null;
    if (ref) {
      token = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_passref", (q: any) => q.eq("propertyId", args.propertyId).eq("passRef", ref))
        .first();
    }
    if (!token && code) {
      token = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_code", (q: any) => q.eq("propertyId", args.propertyId).eq("tokenCode", code))
        .first();
    }

    if (!token) {
      return {
        valid: false,
        reason: "invalid",
        message: "Code not recognized. Please check and try again.",
      };
    }

    // Check if revoked
    if (token.status === "revoked") {
      // ROUND A (C8): failure responses no longer echo the visitor's name —
      // an invalid probe learns nothing beyond the code's status.
      return {
        valid: false,
        reason: "revoked",
        message: "This code has been revoked by the resident.",
      };
    }

    // Check if already used (checked in but not checked out)
    if (token.status === "used" && token.checkedInAt && !token.checkedOutAt) {
      return {
        valid: false,
        reason: "already_inside",
        message: "This visitor is already checked in.",
      };
    }

    // Check if already used and checked out
    if (token.status === "used" && token.checkedOutAt) {
      return {
        valid: false,
        reason: "used",
        message: "This code has already been used.",
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
        validFrom,
      };
    }

    if (now > validUntil) {
      return {
        valid: false,
        reason: "expired",
        message: "This code has expired.",
        expiredAt: token.expiresAt,
      };
    }

    // Valid! Minimal projection — these fields are all already printed on
    // the visitor's own Sentry Pass message (buildVisitorMessage); nothing
    // beyond them is exposed. visitorPhone / address / internal ids are
    // deliberately absent (ROUND A C8). ROUND SENTRY 1 adds the display-only
    // expectedArrival + accessNote (the gate instructions the Sentry brief §3
    // asks the gatehouse to see) — still nothing the visitor wasn't told.
    return {
      valid: true,
      visitorName: token.visitorName,
      estateName: token.propertyName,
      unitName: token.unitName,
      residentName: token.residentName,
      expectedArrival: token.expectedArrival,
      accessNote: token.accessNote,
      expiresAt: token.expiresAt,
      visitDate: token.visitDate,
      gracePeriodMinutes: token.gracePeriodMinutes || 30,
    };
  },
});

// ─── Mutation: Check In Visitor ──────────────────────────────────────────

export const checkInVisitor = mutation({
  args: {
    tokenCode: v.optional(v.string()),
    passRef: v.optional(v.string()),
    propertyId: v.string(),
    gatekeeperId: v.optional(v.string()),
    gatekeeperName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ── ROUND A (C8): check-in now requires POSSESSION OF THE 6-DIGIT
    //    CODE. It previously took a bare tokenId — an enumerable Convex id
    //    leaked by the public getGatehouseLogs board — so anyone could
    //    check any visitor in/out of any estate. The token row is now
    //    resolved by (propertyId, tokenCode) exactly like verifyToken, and
    //    the same per-property throttle applies. ROUND SENTRY 4: passRef is
    //    an equally-valid possession proof; ROUND SENTRY 5: every failure
    //    path is persisted as a security event so the denied/unauthorised
    //    attempts report has real data to show.
    const allowed = await checkRateLimit(ctx, `vms-checkin:${args.propertyId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many check-in attempts. Please wait a moment and try again.");
    }
    const ref = args.passRef?.trim().toUpperCase() || undefined;
    const code = args.tokenCode?.trim() || undefined;
    const failAudit = async (eventType: string, stage: string, extra?: Record<string, any>) => {
      try {
        await ctx.db.insert("securityEvents", {
          firmId: undefined,
          eventType,
          details: JSON.stringify({ propertyId: args.propertyId, code: code ?? null, passRef: ref ?? null, stage, gatekeeper: args.gatekeeperName || args.gatekeeperId || null, ...extra }),
          timestamp: Date.now(),
        });
      } catch { /* audit is best-effort; never blocks the gate error */ }
    };
    const resolveToken = async (): Promise<any | null> => {
      if (ref) {
        const byRef = await ctx.db
          .query("visitor_tokens")
          .withIndex("by_property_passref", (q: any) => q.eq("propertyId", args.propertyId).eq("passRef", ref))
          .first();
        if (byRef) return byRef;
      }
      if (code) {
        return await ctx.db
          .query("visitor_tokens")
          .withIndex("by_property_code", (q: any) => q.eq("propertyId", args.propertyId).eq("tokenCode", code))
          .first();
      }
      return null;
    };
    let token: any = await resolveToken();
    if (!token) {
      await failAudit("sentry_pass_attempt_rejected", "checkin_unknown_code");
      throw new Error("Code not recognized for this estate — cannot check in");
    }
    if (token.status !== "active") {
      await failAudit("sentry_pass_attempt_rejected", `checkin_${token.status}_pass`);
      throw new Error(`Token is ${token.status}, cannot check in`);
    }

    const now = Date.now();
    await ctx.db.patch(token._id, {
      status: "used",
      checkedInAt: now,
      checkedInBy: args.gatekeeperName || args.gatekeeperId || "Gatekeeper device",
      updatedAt: now,
    });

    return { success: true, checkedInAt: now };
  },
});

// ─── Mutation: Check Out Visitor ─────────────────────────────────────────

export const checkOutVisitor = mutation({
  args: {
    tokenCode: v.optional(v.string()),
    passRef: v.optional(v.string()),
    propertyId: v.string(),
  },
  handler: async (ctx, args) => {
    // ── ROUND A (C8): same code-possession requirement as checkInVisitor
    //    (was a bare tokenId — anyone could check visitors out of any
    //    estate by id). Plus the per-property throttle.
    const allowed = await checkRateLimit(ctx, `vms-checkout:${args.propertyId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many check-out attempts. Please wait a moment and try again.");
    }
    const ref = args.passRef?.trim().toUpperCase() || undefined;
    const code = args.tokenCode?.trim() || undefined;
    let token: any = null;
    if (ref) {
      token = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_passref", (q: any) => q.eq("propertyId", args.propertyId).eq("passRef", ref))
        .first();
    }
    if (!token && code) {
      token = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_code", (q: any) => q.eq("propertyId", args.propertyId).eq("tokenCode", code))
        .first();
    }
    if (!token) throw new Error("Code not recognized for this estate — cannot check out");
    if (!token.checkedInAt) throw new Error("Visitor has not checked in");

    const now = Date.now();
    await ctx.db.patch(token._id, {
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
    // ── ROUND A (C8): same minimal projection as before (this board is
    //    public-by-design for the gatehouse tablet), now throttled.
    const allowed = await checkRateLimit(ctx, `vms-logs:${args.propertyId}`, 60, 60_000);
    if (!allowed) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
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
    // ── ROUND A (C8): this was a fully public directory of firm property
    //    names + addresses. The estate picker only needs names; the
    //    address is dropped from the response and the listing is throttled
    //    (30/min per firm) to stop scripted enumeration.
    const allowed = await checkRateLimit(ctx, `vms-properties:${args.firmId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    const properties = await ctx.db
      .query("properties")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .collect();

    return properties.map((p: any) => ({
      id: p._id,
      name: p.name,
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

// ═══════════════════════════════════════════════════════════════════════════
// ROUND SENTRY — §3 gatehouse operations, §5 estate-admin reports
// ═══════════════════════════════════════════════════════════════════════════

// ─── Mutation: Record Denied Entry (§3, §5) ──────────────────────────────
// PUBLIC (gatehouse tablet, no login) but rate-limited. The gatekeeper
// records a refusal AT THE GATE: it lands in securityEvents as a
// 'sentry_denied_entry' row (the denied-entry report reads these) with a
// minimal payload — property, the identifier that was presented (code OR
// passRef, never both echoed with PII), the announced name, one reason.
// If the presented identifier matches a known token, its id is attached
// for the join; we do NOT mutate the token's lifecycle (a denial at the
// gate does not consume or revoke the pass).
export const recordDeniedEntry = mutation({
  args: {
    propertyId: v.string(),
    propertyName: v.optional(v.string()),
    tokenCode: v.optional(v.string()),
    passRef: v.optional(v.string()),
    visitorName: v.optional(v.string()),   // as announced at the gate
    reason: v.string(),                    // free text, ≤200 chars
    gatekeeperName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowed = await checkRateLimit(ctx, `vms-denied:${args.propertyId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }

    const code = args.tokenCode?.trim() || undefined;
    const ref = args.passRef?.trim().toUpperCase() || undefined;
    if (!args.reason?.trim()) throw new Error("A reason is required to record a denial.");

    // Best-effort join to a token row (id only — no lifecycle change)
    let tokenId: string | undefined;
    if (ref) {
      const byRef = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_passref", (q: any) => q.eq("propertyId", args.propertyId).eq("passRef", ref))
        .first();
      if (byRef) tokenId = byRef._id;
    }
    if (!tokenId && code) {
      const byCode = await ctx.db
        .query("visitor_tokens")
        .withIndex("by_property_code", (q: any) => q.eq("propertyId", args.propertyId).eq("tokenCode", code))
        .first();
      if (byCode) tokenId = byCode._id;
    }

    await ctx.db.insert("securityEvents", {
      eventType: "sentry_denied_entry",
      details: JSON.stringify({
        propertyId: args.propertyId,
        propertyName: args.propertyName ?? null,
        tokenCode: code ?? null,
        passRef: ref ?? null,
        tokenId: tokenId ?? null,
        visitorName: args.visitorName?.trim().slice(0, 80) || null,
        reason: args.reason.trim().slice(0, 200),
        gatekeeper: args.gatekeeperName || null,
      }),
      timestamp: Date.now(),
    });

    return { success: true, tokenId: tokenId ?? null };
  },
});

// ─── Query: Search Expected Visitors (§3) ────────────────────────────────
// PUBLIC (gatehouse). One box, two dimensions: matches the visitor NAME
// (case-insensitive contains) or an exact/-prefix code|passRef. Returns
// the same minimal projection as getGatehouseLogs plus expectedArrival +
// accessNote (the "relevant access instructions" the brief asks for).
export const searchExpectedVisitors = query({
  args: {
    propertyId: v.string(),
    date: v.optional(v.string()),      // YYYY-MM-DD; defaults to today
    term: v.string(),                 // name / code / passRef (≥2 chars)
  },
  handler: async (ctx, args) => {
    const allowed = await checkRateLimit(ctx, `vms-search:${args.propertyId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many searches. Please wait a moment and try again.");
    }
    const term = args.term.trim();
    if (term.length < 2) return [];

    const targetDate = args.date || new Date().toISOString().split("T")[0];
    const rows = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_property", (q: any) => q.eq("propertyId", args.propertyId))
      .filter((q: any) => q.eq(q.field("visitDate"), targetDate))
      .collect();

    const needle = term.toLowerCase();
    const hits = rows.filter((t: any) => {
      const nameHit = (t.visitorName || "").toLowerCase().includes(needle);
      const codeHit = (t.tokenCode || "").startsWith(term.replace(/\s+/g, ""));
      const refHit = (t.passRef || "").toUpperCase().startsWith(term.toUpperCase());
      return nameHit || codeHit || refHit;
    });

    return hits
      .map((t: any) => ({
        visitorName: t.visitorName,
        tokenCode: t.tokenCode,
        passRef: t.passRef,
        unitName: t.unitName,
        residentName: t.residentName,
        status: t.status,
        expectedArrival: t.expectedArrival,
        accessNote: t.accessNote,
        visitDate: t.visitDate,
        expiresAt: t.expiresAt,
        checkedInAt: t.checkedInAt,
        checkedOutAt: t.checkedOutAt,
      }))
      .sort((a: any, b: any) => (b.checkedInAt || 0) - (a.checkedInAt || 0))
      .slice(0, 25);
  },
});

// ─── Estate-admin reports (§5) ───────────────────────────────────────────
// Mutations (not queries) on purpose: each run FIRST writes an audit_logs
// row (who pulled which report, when, scope) and then returns the data —
// the audit trail the brief §4/§7.10 demands. Auth: requireFirmUser
// (bearer session, firm-scoped) — the gatehouse public endpoints never
// reach these.

async function reportAudit(
  ctx: any,
  user: any,
  report: string,
  scope: Record<string, any>,
): Promise<void> {
  try {
    await ctx.db.insert("audit_logs", {
      firmId: user.firmId,
      actorId: user._id,
      actorName: user.name || user.email,
      actorRole: user.role || "firm_user",
      action: "read",
      resource: "sentry_report",
      resourceId: report,
      metadata: { report, ...scope },
      timestamp: Date.now(),
    });
  } catch { /* best-effort audit; the report still returns */ }
}

const REPORT_PROJECTION = (t: any) => ({
  visitorName: t.visitorName,
  unitName: t.unitName,
  residentName: t.residentName,
  tokenCode: t.tokenCode,
  passRef: t.passRef,
  status: t.status,
  visitDate: t.visitDate,
  expectedArrival: t.expectedArrival,
  accessNote: t.accessNote,
  expiresAt: t.expiresAt,
  checkedInAt: t.checkedInAt,
  checkedInBy: t.checkedInBy,
  checkedOutAt: t.checkedOutAt,
  revokedAt: t.revokedAt,
  revokedReason: t.revokedReason,
  createdAt: t.createdAt,
});

// 5a — Daily visitor log: everyone whose pass is FOR the given date
// (visitDate-scoped, unlike the gatehouse board's createdAt filter).
export const getSentryDailyReport = mutation({
  args: {
    propertyId: v.optional(v.string()),
    date: v.string(),                   // YYYY-MM-DD
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await reportAudit(ctx, user, "daily", { propertyId: args.propertyId ?? "all", date: args.date });

    let rows: any[] = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_firm", (q: any) => q.eq("firmId", user.firmId))
      .filter((q: any) => q.eq(q.field("visitDate"), args.date))
      .collect();
    if (args.propertyId) rows = rows.filter((t: any) => t.propertyId === args.propertyId);

    const counts = { expected: 0, onSite: 0, completed: 0, expired: 0, revoked: 0, active: 0 };
    for (const t of rows) {
      if (t.checkedInAt && !t.checkedOutAt) counts.onSite++;
      else if (t.checkedInAt && t.checkedOutAt) counts.completed++;
      else if (t.status === "expired") counts.expired++;
      else if (t.status === "revoked") counts.revoked++;
      else if (t.status === "active") { counts.expected++; counts.active++; }
    }

    return {
      date: args.date,
      counts,
      visitors: rows.map(REPORT_PROJECTION).sort((a: any, b: any) => (b.checkedInAt || 0) - (a.checkedInAt || 0)),
    };
  },
});

// 5b — Currently on-site across the estate (checked in, not yet out).
export const getSentryOnSite = mutation({
  args: {
    propertyId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await reportAudit(ctx, user, "on_site", { propertyId: args.propertyId ?? "all" });

    const rows: any[] = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_firm", (q: any) => q.eq("firmId", user.firmId))
      .collect();
    const onSite = rows.filter(
      (t: any) => t.checkedInAt && !t.checkedOutAt && (!args.propertyId || t.propertyId === args.propertyId),
    );
    return onSite.map(REPORT_PROJECTION).sort((a: any, b: any) => (b.checkedInAt || 0) - (a.checkedInAt || 0));
  },
});

// 5c — Historical access records over a date range (visitDate-scoped).
export const getSentryHistorical = mutation({
  args: {
    from: v.string(),                   // YYYY-MM-DD inclusive
    to: v.string(),                     // YYYY-MM-DD inclusive
    propertyId: v.optional(v.string()),
    limit: v.optional(v.number()),      // default 200, max 500
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const cap = Math.min(Math.max(args.limit ?? 200, 1), 500);
    await reportAudit(ctx, user, "historical", { from: args.from, to: args.to, propertyId: args.propertyId ?? "all", limit: cap });

    const rows: any[] = await ctx.db
      .query("visitor_tokens")
      .withIndex("by_firm", (q: any) => q.eq("firmId", user.firmId))
      .collect();
    const scoped = rows.filter(
      (t: any) =>
        t.visitDate >= args.from &&
        t.visitDate <= args.to &&
        (!args.propertyId || t.propertyId === args.propertyId),
    );
    return {
      total: scoped.length,
      truncated: scoped.length > cap,
      records: scoped
        .sort((a: any, b: any) => (b.checkedInAt || b.createdAt || 0) - (a.checkedInAt || a.createdAt || 0))
        .slice(0, cap)
        .map(REPORT_PROJECTION),
    };
  },
});

// 5d — Denied entries + unauthorised/expired pass attempts + verify throttle
// events, over a timestamp range. Reads securityEvents only (the token
// lifecycle is already covered by 5a/5c).
export const getSentrySecurityReport = mutation({
  args: {
    from: v.number(),                   // Unix ms inclusive
    to: v.number(),                     // Unix ms inclusive
    propertyId: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    await reportAudit(ctx, user, "security", { from: args.from, to: args.to, propertyId: args.propertyId ?? "all" });

    const events: any[] = await ctx.db
      .query("securityEvents")
      .withIndex("by_firm", (q: any) => q.eq("firmId", user.firmId))
      .collect();
    // by_firm only covers rows written WITH a firmId (denied/attempt rows
    // are firm-agnostic by design) — sweep the type indexes too and merge.
    // ROUND SENTRY fix: throttle rows (rate_limit_exceeded) carry no firmId
    // either, so they need their OWN type sweep or the "throttled" count
    // silently reads zero in production.
    const globalish: any[] = (await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q: any) => q.eq("eventType", "sentry_denied_entry"))
      .collect()).concat(
      await ctx.db.query("securityEvents")
        .withIndex("by_type", (q: any) => q.eq("eventType", "sentry_pass_attempt_rejected"))
        .collect(),
    ).concat(
      await ctx.db.query("securityEvents")
        .withIndex("by_type", (q: any) => q.eq("eventType", "rate_limit_exceeded"))
        .collect(),
    );

    const seen = new Set<string>();
    const all = [...events, ...globalish].filter((e: any) => {
      const key = String(e._id ?? `${e.eventType}:${e.timestamp}:${e.details ?? ""}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const parsed = all
      .filter((e: any) => e.timestamp >= args.from && e.timestamp <= args.to)
      .filter((e: any) => {
        if (e.eventType !== "sentry_denied_entry" && e.eventType !== "sentry_pass_attempt_rejected" && e.eventType !== "rate_limit_exceeded") return false;
        if (e.eventType === "rate_limit_exceeded" && !(String(e.details ?? "").includes("vms-"))) return false;
        return true;
      })
      .map((e: any) => {
        let detail: any = null;
        try { detail = e.details ? JSON.parse(e.details) : null; } catch { detail = null; }
        const scopeOk = !args.propertyId || (detail && detail.propertyId === args.propertyId) || (e.eventType === "rate_limit_exceeded" && String(e.details ?? "").includes(args.propertyId) === true);
        if (!scopeOk) return null;
        return {
          eventType: e.eventType,
          timestamp: e.timestamp,
          detail,
          raw: e.eventType === "rate_limit_exceeded" ? (e.details ?? null) : null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.timestamp - a.timestamp);

    const counts = {
      denied: parsed.filter((p: any) => p.eventType === "sentry_denied_entry").length,
      rejectedPassAttempts: parsed.filter((p: any) => p.eventType === "sentry_pass_attempt_rejected").length,
      throttled: parsed.filter((p: any) => p.eventType === "rate_limit_exceeded").length,
    };
    return { counts, events: parsed.slice(0, 300) };
  },
});
