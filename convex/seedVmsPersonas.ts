/**
 * VMS Test Persona Seeder — dev/demo deployments ONLY
 * ═══════════════════════════════════════════════════════════════════════
 *
 * TASK VMS-E2E (2026-11-28). Provisions the three SentryPass test personas
 * with the tester's own email addresses (the owner's Woosh addresses) so
 * every onboarding code, login code and pass notification lands in the
 * tester's own inbox — no shared credentials, nothing hardcoded.
 *
 * PERSONAS (one call provisions all three):
 *   1. ESTATE ADMIN (Estate Manager) — firm-side user (role Administrator)
 *      with VMS entitlement: vmsEnabled + approved + a 30-day VMS add-on
 *      trial, exactly what a founder approval grants. Logs in through the
 *      MAIN app. Reaching Security & Access is this persona's job.
 *   2. RESIDENT / HOST — portal user (role Tenant) linked to Unit 101 via
 *      the property's units[] currentTenantId (the portal resolution
 *      contract). Logs in through /portal/tenant/login, generates and
 *      revokes visitor codes in the VisitorPortal.
 *   3. GATE SECURITY — NOT a user account (by design, TASK 94): a GATEHOUSE
 *      STATION with a station PIN. The guard opens /gatehouse?firmId=…,
 *      picks the station and enters the PIN. The PIN is returned ONCE here
 *      — it is hashed before storage and cannot be recovered later.
 *
 * NO SECRETS: no passwords are set by the seeder. Both email personas start
 * passwordless: the first login emails a verification code to the persona's
 * own address and prompts them to claim a password there (TOFU claim). The
 * tester chooses the passwords; nothing lands in the repo or the log.
 *
 * GUARDS (same as seedSentry):
 *   • Env gate — refuses to run unless ALLOW_DEMO_SEED === 'true' is set on
 *     the target deployment (dev/demo only — NEVER production).
 *   • Founder session — requires the platform founder's bearer session
 *     (the only identity entitled to grant VMS entitlement).
 *   • Recorded in securityEvents on every run.
 *
 * IDEMPOTENT: re-running with the same emails reuses the firm, property,
 * users and station. The station PIN is re-issued only when the station is
 * created; use resetGatehousePin (Security & Access) to rotate it later.
 *
 * INVOCATION (on a dev deployment with ALLOW_DEMO_SEED=true):
 *   npx convex run seedVmsPersonas:seed '{
 *     "sessionToken": "<founder session token>",
 *     "adminEmail": "admin@YOUR-WOOSH-DOMAIN",
 *     "residentEmail": "resident@YOUR-WOOSH-DOMAIN",
 *     "firmName": "Woosh Test Estate",
 *     "propertyName": "Woosh Court",
 *     "stationName": "Main Gate",
 *     "pin": "123456"
 *   }'
 * Only adminEmail + residentEmail are required; every other field has a
 * default. The returned manifest carries the gatehouse URL and the manual
 * login steps — docs/VMS_TEST_ACCOUNTS_AND_SEED_GUIDE.md documents the full
 * walkthrough.
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireFounderCaller } from "./callerAuth";
import { randomHex, paddedDigitCode } from "./secureRandom";
import { pinHashFor } from "./gatehouseAccounts";

const TRIM = (s?: string) => s?.trim() || "";

export const seed = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminEmail: v.string(),
    residentEmail: v.string(),
    firmName: v.optional(v.string()),
    propertyName: v.optional(v.string()),
    propertyAddress: v.optional(v.string()),
    unitName: v.optional(v.string()),
    stationName: v.optional(v.string()),
    pin: v.optional(v.string()),           // 4-8 digits when you choose it; else generated
  },
  handler: async (ctx, args) => {
    await requireFounderCaller(ctx, { sessionToken: args.sessionToken });

    if (process.env.ALLOW_DEMO_SEED !== "true") {
      throw new Error(
        "seedVmsPersonas is disabled on this deployment. Set ALLOW_DEMO_SEED=true (dev/demo deployments only — never production) to run the VMS persona seeder."
      );
    }

    const adminEmail = TRIM(args.adminEmail).toLowerCase();
    const residentEmail = TRIM(args.residentEmail).toLowerCase();
    if (!adminEmail.includes("@") || !residentEmail.includes("@")) {
      throw new Error("Provide both persona email addresses (the tester's own Woosh addresses).");
    }
    if (adminEmail === residentEmail) {
      throw new Error("Use two different addresses — the admin and the resident are different personas.");
    }

    try {
      await ctx.db.insert("securityEvents", {
        eventType: "demo_seed_run",
        details: JSON.stringify({ seeder: "seedVmsPersonas", adminEmail, residentEmail }),
        timestamp: Date.now(),
      });
    } catch {}

    const firmName = TRIM(args.firmName) || "Woosh Test Estate";
    const propertyName = TRIM(args.propertyName) || "Woosh Court";
    const propertyAddress = TRIM(args.propertyAddress) || "1 Test Gate Road, Lagos";
    const unitName = TRIM(args.unitName) || "Unit 101";
    const stationName = TRIM(args.stationName) || "Main Gate";

    // ── Idempotency: reuse persona rows when the emails already exist ──────
    const findUser = async (email: string) =>
      (await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .first()) ??
      (await ctx.db
        .query("users")
        .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", email))
        .first());

    const existingAdmin = await findUser(adminEmail);
    const existingResident = await findUser(residentEmail);

    let adminId: any;
    let firmId: string;
    let createdFirm = false;

    if (existingAdmin) {
      if (!existingAdmin.firmId) {
        throw new Error(`${adminEmail} already exists without a firm — pick a fresh address for the admin persona.`);
      }
      firmId = String(existingAdmin.firmId);
      adminId = existingAdmin._id;
    } else {
      // New firm with the FULL VMS entitlement a founder approval grants:
      // capability (vmsEnabled) + 30-day add-on trial. This mirrors
      // decideVmsAccessRequest (myFunctions.ts) — the only other writer of
      // these flags, and the founder session proves the same authority.
      // SCHEMA ALIGNMENT (fixup 2026-11-28): firms have no email column
      // — the persona's Woosh address lives on the ADMIN USER only. The
      // property has no name column either: address is the identity
      // (by-address lookup below) and the estate display name rides in
      // description, which is where the portal and unit views read it.
      const now = Date.now();
      const firmDoc: any = await ctx.db.insert("firms", {
        name: firmName,
        product: "atrium",
        subscriptionPlan: "Komplete",
        subscriptionAddons: {
          vms: { status: "trial", trialEndsAt: now + 30 * 24 * 60 * 60 * 1000 },
        },
        vmsEnabled: true,
        vmsRequestStatus: "approved",
        created_by: "seedVmsPersonas",
        createdBy: "seedVmsPersonas",
      });
      firmId = String(firmDoc);
      createdFirm = true;
      adminId = await ctx.db.insert("users", {
        firmId,
        name: "Woosh Estate Admin",
        email: adminEmail,
        tokenIdentifier: adminEmail,
        role: "Administrator",
        product: "atrium",
        isVerified: true,
        emailVerified: true,
      });
    }

    if (existingResident) {
      if (String(existingResident.firmId ?? "") !== firmId) {
        throw new Error(
          `${residentEmail} already exists in another firm — pick a fresh address for the resident persona.`
        );
      }
    } else {
      await ctx.db.insert("users", {
        firmId,
        name: "Woosh Resident Host",
        email: residentEmail,
        tokenIdentifier: residentEmail,
        role: "Tenant",
        product: "atrium",
        isVerified: true,
        emailVerified: true,
      });
    }

    // ── Property + unit, linked to the resident (portal contract) ─────────
    let property: any = (
      await ctx.db
        .query("properties")
        .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
        .filter((q: any) => q.eq(q.field("address"), propertyAddress))
        .first()
    );
    let propertyId: string;
    let unitId: string;
    if (property) {
      propertyId = String(property._id);
      const unit = (property.units ?? [])[0] ?? {};
      unitId = String(unit.id ?? unit.unitId ?? "unit-101");
    } else {
      const inserted: any = await ctx.db.insert("properties", {
        firmId,
        // properties carry NO name column — address is the identity;
        // the estate display name rides in description.
        description: propertyName,
        address: propertyAddress,
        status: "Occupied",
        units: [
          {
            id: "unit-101",
            unitId: "unit-101",
            name: unitName,
            unitName,
            currentTenantId: residentEmail, // portal resolution joins on this
          },
        ],
      });
      propertyId = String(inserted);
      unitId = "unit-101";
    }

    // ── Portal settings: VMS ON, arrival notifications ON, 30-min grace ────
    const settings: any = await ctx.db
      .query("portal_settings")
      .withIndex("by_firm", (q: any) => q.eq("firmId", firmId))
      .first();
    if (!settings) {
      const now = Date.now();
      await ctx.db.insert("portal_settings", {
        firmId,
        vmsEnabled: true,
        vmsResidentNotifications: true,
        vmsGracePeriodMinutes: 30,
        vmsDefaultExpiryHours: 6,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── Gatehouse station (the guard persona) — PIN hashed like production ──
    const stations: any[] = await ctx.db
      .query("gatehouse_accounts")
      .withIndex("by_property_status", (q: any) => q.eq("propertyId", propertyId).eq("status", "active"))
      .collect();
    const existingStation = stations.find((s: any) => s.stationName === stationName);
    let pin: string | undefined;
    if (!existingStation) {
      pin = TRIM(args.pin) || paddedDigitCode(6); // crypto-secure, same as provisionGatehouseAccount
      if (!/^\d{4,8}$/.test(pin)) {
        throw new Error("Station PIN must be 4-8 digits (digits only).");
      }
      const salt = randomHex(16);
      const now = Date.now();
      await ctx.db.insert("gatehouse_accounts", {
        firmId,
        propertyId,
        propertyName,
        stationName,
        pinHash: pinHashFor(salt, pin),
        pinSalt: salt,
        status: "active",
        createdBy: "seedVmsPersonas",
        createdByName: "VMS persona seeder",
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      createdFirm,
      firmId,
      propertyId,
      unitId,
      personas: {
        admin: { email: adminEmail, login: "Main app → Log in (passwordless first login: the emailed code claims your password)" },
        resident: { email: residentEmail, login: "/portal/tenant/login (passwordless first login: the emailed code claims your password)" },
        guard: { stationName, pin: pin ?? null, note: "PIN shown ONCE — rotate with resetGatehousePin if lost. null = station already existed." },
      },
      gatehouseUrl: `/gatehouse?firmId=${firmId}`,
      entitlement: "vmsEnabled + approved + 30-day VMS add-on trial (mirrors decideVmsAccessRequest)",
      next: "docs/VMS_TEST_ACCOUNTS_AND_SEED_GUIDE.md — full manual login walkthrough",
    };
  },
});
