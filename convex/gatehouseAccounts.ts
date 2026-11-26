/**
 * Gatehouse Accounts — Sentry Pass station provisioning + terminal login
 * ═══════════════════════════════════════════════════════════════════════
 *
 * TASK 94 (2026-11-25), owner spec:
 *   "Simple, secure Gatehouse Account / Terminal Access… Admin Provisioning:
 *   an Estate Admin / Property Manager inside Atrium creates a Gatehouse
 *   Account / Guard Station (Main Gate / Gate 1) with simple credentials
 *   (Gate ID + PIN). Strict least-privilege scope: a logged-in Gatehouse
 *   session must ONLY see the Sentry Pass Gatehouse Verification Screen."
 *
 * MODEL
 *   gatehouse_accounts  — one row per guard station: property, name,
 *                         PIN hash (sha256(salt+pin) — the PIN itself is
 *                         never stored or logged), status.
 *   gatehouse_sessions  — one row per tablet login: sha256 of a 256-bit
 *                         station token, 30-day expiry.
 *
 * THE LOCK FLIP (back-compat rule):
 *   Until a property has at least one ACTIVE station, its /gatehouse
 *   terminal keeps working in the legacy anonymous mode (firms that never
 *   provisioned see no change). The moment a station exists, every gated
 *   Sentry Pass endpoint (verify / check-in / check-out / search / logs /
 *   denial in visitorManagement.ts) requires a valid station session.
 *   Revoking the station kills every tablet's session instantly.
 *
 * LEAST PRIVILEGE:
 *   The station token is only accepted by the six gate endpoints above —
 *   it is not a user session, reaches no financials/leases/directories,
 *   and the terminal UI renders nothing beyond verification.
 *
 * AUDIT:
 *   provocation/revoke/reset write audit_logs; failed PIN logins write
 *   securityEvents ('gatehouse_login_failed', no PIN echo); logins update
 *   lastLoginAt.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFirmUser } from "./authHelpers";
import { checkRateLimit } from "./securityHelpers";
import { randomHex, paddedDigitCode } from "./secureRandom";
import { sha256Hex } from "./sha256";

// ─── Station session TTL: 30 days, fixed. Admin revocation is instant. ────
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function pinHashFor(salt: string, pin: string): string {
  return sha256Hex(`${salt}:${pin}`);
}

/** 6-digit crypto-secure station PIN (provisioning default). */
function generateStationPin(): string {
  return paddedDigitCode(6);
}

function validPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

// ─── Admin: provision a station (requireFirmUser) ──────────────────────────
// The PIN is generated (or taken from the admin's chosen value), hashed
// with a per-station salt, and returned ONCE — never stored raw, never
// retrievable afterwards. resetGatehousePin re-issues a fresh one.
export const provisionGatehouseAccount = mutation({
  args: {
    firmId: v.string(),
    propertyId: v.string(),
    stationName: v.string(),
    pin: v.optional(v.string()),          // 4-8 digits when admin-chosen
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (user.firmId && user.firmId !== args.firmId) {
      throw new Error("Not authorized: firm mismatch.");
    }

    const stationName = args.stationName?.trim().slice(0, 60);
    if (!stationName) throw new Error("Station name is required (e.g. Main Gate, Gate 1).");

    // The property must belong to this firm (no provisioning onto another
    // firm's estate).
    const property: any = await ctx.db.get(args.propertyId as any);
    if (!property || property.firmId !== args.firmId) {
      throw new Error("Property not found in this firm — pick one of your estates.");
    }

    const pin = args.pin?.trim() || generateStationPin();
    if (!validPin(pin)) {
      throw new Error("PIN must be 4-8 digits (digits only).");
    }

    const salt = randomHex(16);
    const now = Date.now();
    const accountId = await ctx.db.insert("gatehouse_accounts", {
      firmId: args.firmId,
      propertyId: args.propertyId,
      propertyName: property.name,
      stationName,
      pinHash: pinHashFor(salt, pin),
      pinSalt: salt,
      status: "active",
      createdBy: String(user._id),
      createdByName: user.name || user.email || "",
      createdAt: now,
      updatedAt: now,
    });

    try {
      await ctx.db.insert("audit_logs", {
        firmId: args.firmId,
        actorId: user._id,
        actorName: user.name || user.email || "",
        actorRole: user.role || "firm_user",
        action: "create",
        resource: "gatehouse_account",
        resourceId: String(accountId),
        metadata: { stationName, propertyId: args.propertyId },
        timestamp: now,
      });
    } catch { /* best-effort audit */ }

    // THE moment this row lands, the property's gate endpoints flip from
    // legacy-anonymous to station-authenticated (see visitorManagement's
    // requireGatehouseAccess).
    return {
      accountId: String(accountId),
      stationName,
      propertyId: args.propertyId,
      propertyName: property.name,
      pin, // shown once — copy it now
    };
  },
});

// ─── Admin: list the firm's stations ──────────────────────────────────────
export const listGatehouseAccounts = query({
  args: {
    firmId: v.string(),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    if (user.firmId && user.firmId !== args.firmId) {
      throw new Error("Not authorized: firm mismatch.");
    }
    const rows: any[] = await ctx.db
      .query("gatehouse_accounts")
      .withIndex("by_firm", (q: any) => q.eq("firmId", args.firmId))
      .collect();
    return rows
      .sort((a: any, b: any) => a.createdAt - b.createdAt)
      .map((a: any) => ({
        accountId: a._id,
        propertyId: a.propertyId,
        propertyName: a.propertyName,
        stationName: a.stationName,
        status: a.status,
        createdByName: a.createdByName,
        lastLoginAt: a.lastLoginAt,
        revokedAt: a.revokedAt,
        revokedReason: a.revokedReason,
        createdAt: a.createdAt,
      }));
  },
});

// ─── Admin: reset a station's PIN ─────────────────────────────────────────
export const resetGatehousePin = mutation({
  args: {
    firmId: v.string(),
    accountId: v.id("gatehouse_accounts"),
    pin: v.optional(v.string()),      // optional admin-chosen; else generated
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const acc: any = await ctx.db.get(args.accountId);
    if (!acc || acc.firmId !== args.firmId) {
      throw new Error("Station not found in this firm.");
    }
    if (acc.status === "revoked") {
      throw new Error("This station is revoked — provision a new one instead.");
    }
    const pin = args.pin?.trim() || generateStationPin();
    if (!validPin(pin)) throw new Error("PIN must be 4-8 digits (digits only).");

    const salt = randomHex(16);
    const now = Date.now();
    await ctx.db.patch(args.accountId, {
      pinSalt: salt,
      pinHash: pinHashFor(salt, pin),
      updatedAt: now,
    });
    try {
      await ctx.db.insert("audit_logs", {
        firmId: args.firmId,
        actorId: user._id,
        actorName: user.name || user.email || "",
        actorRole: user.role || "firm_user",
        action: "update",
        resource: "gatehouse_account_pin",
        resourceId: String(args.accountId),
        metadata: { stationName: acc.stationName },
        timestamp: now,
      });
    } catch { /* best-effort audit */ }
    return { accountId: String(args.accountId), stationName: acc.stationName, pin };
  },
});

// ─── Admin: revoke a station (kills its sessions instantly) ───────────────
export const revokeGatehouseAccount = mutation({
  args: {
    firmId: v.string(),
    accountId: v.id("gatehouse_accounts"),
    reason: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireFirmUser(ctx, args.userEmail, args.sessionToken);
    const acc: any = await ctx.db.get(args.accountId);
    if (!acc || acc.firmId !== args.firmId) {
      throw new Error("Station not found in this firm.");
    }
    const now = Date.now();
    await ctx.db.patch(args.accountId, {
      status: "revoked",
      revokedAt: now,
      revokedReason: args.reason?.trim().slice(0, 200) || undefined,
      updatedAt: now,
    });
    try {
      await ctx.db.insert("audit_logs", {
        firmId: args.firmId,
        actorId: user._id,
        actorName: user.name || user.email || "",
        actorRole: user.role || "firm_user",
        action: "delete",
        resource: "gatehouse_account",
        resourceId: String(args.accountId),
        metadata: { stationName: acc.stationName, reason: args.reason ?? null },
        timestamp: now,
      });
    } catch { /* best-effort audit */ }
    return { success: true, revokedSessions: true };
  },
});

// ─── Terminal: which stations exist for a firm? (public + throttled) ───────
// The login screen needs the station list (name + id + property). No PII,
// no phones — station names and estate names the legacy picker already
// exposes publicly.
export const getGatehouseStations = mutation({
  // ROUND 20: was a `query` — the throttle writes (rateLimits), writes
  // are illegal in a read-only Convex query, and the station-lock
  // screen (useQuery) never resolved in production.
  args: { firmId: v.string() },
  handler: async (ctx, args) => {
    const allowed = await checkRateLimit(ctx, `gatehouse-stations:${args.firmId}`, 30, 60_000);
    if (!allowed) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    const rows: any[] = await ctx.db
      .query("gatehouse_accounts")
      .withIndex("by_firm_status", (q: any) => q.eq("firmId", args.firmId).eq("status", "active"))
      .collect();
    return rows
      .sort((a: any, b: any) => a.createdAt - b.createdAt)
      .map((a: any) => ({
        accountId: a._id,
        propertyId: a.propertyId,
        propertyName: a.propertyName,
        stationName: a.stationName,
      }));
  },
});

// ─── Terminal: station login (public + throttled, PIN) ────────────────────
export const gatehouseLogin = mutation({
  args: {
    accountId: v.id("gatehouse_accounts"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const acc: any = await ctx.db.get(args.accountId);
    const key = `gatehouse-login:${args.accountId}`;
    const allowed = await checkRateLimit(ctx, key, 10, 60_000);
    if (!allowed) {
      throw new Error("Too many login attempts. Please wait a minute and try again.");
    }

    const failAudit = async () => {
      try {
        await ctx.db.insert("securityEvents", {
          firmId: acc?.firmId ?? undefined,
          eventType: "gatehouse_login_failed",
          details: JSON.stringify({
            accountId: String(args.accountId),
            stationName: acc?.stationName ?? null,
            propertyId: acc?.propertyId ?? null,
          }),
          timestamp: Date.now(),
        });
      } catch { /* best-effort */ }
    };

    if (!acc || acc.status !== "active") {
      await failAudit();
      throw new Error("Station not found or revoked. Ask your estate admin.");
    }

    const candidate = pinHashFor(acc.pinSalt, args.pin.trim());
    if (candidate !== acc.pinHash) {
      await failAudit();
      throw new Error("Wrong PIN. Ask your estate admin for the station PIN.");
    }

    // Mint a 256-bit station token; store only its SHA-256 (same storage
    // form as user bearer sessions in sessions.ts).
    const token = randomHex(64);
    const now = Date.now();
    await ctx.db.insert("gatehouse_sessions", {
      accountId: acc._id,
      tokenHash: sha256Hex(token),
      propertyId: acc.propertyId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    await ctx.db.patch(acc._id, { lastLoginAt: now, updatedAt: now });

    return {
      stationToken: token,
      stationName: acc.stationName,
      propertyId: acc.propertyId,
      propertyName: acc.propertyName,
      firmId: acc.firmId,
      expiresAt: now + SESSION_TTL_MS,
    };
  },
});

// ─── Shared resolver: valid station session for THIS property? ─────────────
// Exported for visitorManagement.ts's requireGatehouseAccess. Pure
// validation (no writes — queries call it too); mutations refresh
// lastSeenAt best-effort via touchStationSession.
export async function resolveStationSession(
  ctx: any,
  propertyId: string,
  stationToken?: string,
): Promise<{ accountId: string; stationName: string } | null> {
  if (!stationToken) return null;
  const session: any = await ctx.db
    .query("gatehouse_sessions")
    .withIndex("by_token", (q: any) => q.eq("tokenHash", sha256Hex(stationToken)))
    .first();
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  if (String(session.propertyId) !== String(propertyId)) return null;
  const acc: any = await ctx.db.get(session.accountId);
  if (!acc || acc.status !== "active") return null;
  return { accountId: String(acc._id), stationName: acc.stationName };
}

/** Best-effort lastSeenAt refresh — mutations only (queries can't write). */
export async function touchStationSession(ctx: any, stationToken?: string): Promise<void> {
  if (!stationToken) return;
  try {
    const session: any = await ctx.db
      .query("gatehouse_sessions")
      .withIndex("by_token", (q: any) => q.eq("tokenHash", sha256Hex(stationToken)))
      .first();
    if (session) await ctx.db.patch(session._id, { lastSeenAt: Date.now() });
  } catch { /* best-effort */ }
}

// ─── Does this property have active stations (i.e. is the gate LOCKED)? ────
export async function propertyHasActiveStations(ctx: any, propertyId: string): Promise<boolean> {
  const one: any = await ctx.db
    .query("gatehouse_accounts")
    .withIndex("by_property_status", (q: any) => q.eq("propertyId", propertyId).eq("status", "active"))
    .first();
  return !!one;
}
