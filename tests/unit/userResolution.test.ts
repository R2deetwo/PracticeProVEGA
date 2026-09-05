/**
 * Task 21 regression suite — the "EVERY login code rejected" incident
 * (2026-09-05, tasks 19–20 follow-up — the REAL root cause).
 *
 * Production evidence (read-only inspect, run 33964754717): a fresh login
 * code issued at 11:48:26, failedLoginAttempts=1 (the user typed a code
 * seconds after the email arrived — exactly as they insisted), zero
 * sessions across ALL 14 users. The user was RIGHT: the codes they typed
 * were correct and fresh.
 *
 * The bug: `verifyLogin` and `resetPassword` fetched the user record
 * through the PUBLIC `getUser` query, which applies the NDPA privacy
 * projection (stripAuthFields). The projected record has password /
 * mfaCode / verificationCode / failedLoginAttempts / lockedUntil removed,
 * so:
 *   - the typed code was compared against normalizeCode(undefined) === ""
 *     → every code rejected, no matter what;
 *   - user.password was always undefined → every account looked
 *     "passwordless" → the code prompt always fired;
 *   - the lockout could never trigger;
 *   - resetPassword's 6-digit OTP path always failed.
 *
 * This suite locks three things:
 *   1. pickUserRecord — the duplicate-record resolution is unchanged
 *      (portal preference, Pending filtering) so getUser and
 *      getUserForAuth keep agreeing on WHICH record is the user;
 *   2. stripAuthFields — the projection removes exactly the auth fields
 *      (and nothing else), so a projected record can NEVER authenticate;
 *   3. SOURCE CONTRACT — the auth flows (verifyLogin, resetPassword, the
 *      portals invite re-accept guard) read the RAW record via the
 *      internal getUserForAuth, and getUserForAuth stays internal
 *      (uncallable from clients). If someone reintroduces the bug by
 *      pointing an auth flow back at the public getUser, these fail.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pickUserRecord,
  stripAuthFields,
  AUTH_STRIP_FIELDS,
} from "../../convex/userResolution";

const repoRoot = join(__dirname, "..", "..");
const myFunctionsSrc = readFileSync(join(repoRoot, "convex", "myFunctions.ts"), "utf-8");
const portalsSrc = readFileSync(join(repoRoot, "convex", "portals.ts"), "utf-8");

/** Extract the source of one exported function (from its `export const`
 * marker to the next export boundary) so contract assertions stay scoped
 * to that function's body. */
function functionSrc(src: string, name: string): string {
  const start = src.indexOf(`export const ${name} =`);
  if (start === -1) throw new Error(`function ${name} not found in source`);
  const next = src.indexOf("export const", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("pickUserRecord — duplicate resolution (unchanged behavior)", () => {
  const admin = { role: "Admin", email: "a@x.com" };
  const client = { role: "Client", email: "a@x.com" };
  const tenant = { role: "Tenant", email: "a@x.com" };
  const pending = { role: "Pending", email: "a@x.com" };

  it("returns null for empty or missing matches", () => {
    expect(pickUserRecord([], false)).toBeNull();
    expect(pickUserRecord(null, false)).toBeNull();
    expect(pickUserRecord(undefined, true)).toBeNull();
  });

  it("single record: returned regardless of preference", () => {
    expect(pickUserRecord([admin], false)).toBe(admin);
    expect(pickUserRecord([admin], true)).toBe(admin);
  });

  it("admin login (preferPortalRole=false) keeps first-record behavior", () => {
    expect(pickUserRecord([admin, client], false)).toBe(admin);
  });

  it("portal login (preferPortalRole=true) prefers the Client/Tenant record", () => {
    expect(pickUserRecord([admin, client], true)).toBe(client);
    expect(pickUserRecord([admin, tenant], true)).toBe(tenant);
    expect(pickUserRecord([admin, client, tenant], true)).toBe(client);
  });

  it("falls back to the first record when no portal record exists", () => {
    expect(pickUserRecord([admin], true)).toBe(admin);
    expect(pickUserRecord([admin, admin], true)).toBe(admin);
  });

  it("Pending (revoked) records are filtered out unless everything is Pending", () => {
    expect(pickUserRecord([pending, admin], false)).toBe(admin);
    // all Pending → fall through so downstream revoked-user handling fires
    expect(pickUserRecord([pending], false)).toBe(pending);
    expect(pickUserRecord([pending, pending], true)).toBe(pending);
  });
});

describe("stripAuthFields — the NDPA projection", () => {
  const record: Record<string, any> = {
    _id: "users/abc",
    email: "founder@example.com",
    role: "Admin",
    isMfaEnabled: false,
    isVerified: true,
    firmId: "firms/1",
    password: "$pbkdf2$hash",
    mfaCode: "490005",
    mfaCodeIssuedAt: 1788608906581,
    verificationCode: "123456",
    failedLoginAttempts: 1,
    lockedUntil: null,
    passwordHash: "legacy-hash",
  };

  it("removes every auth-only field", () => {
    const safe = stripAuthFields(record);
    for (const field of AUTH_STRIP_FIELDS) {
      expect(safe).not.toHaveProperty(field);
    }
  });

  it("keeps every non-auth field (behavior unchanged for clients)", () => {
    const safe = stripAuthFields(record);
    expect(safe.email).toBe("founder@example.com");
    expect(safe.role).toBe("Admin");
    expect(safe.isMfaEnabled).toBe(false);
    expect(safe.isVerified).toBe(true);
    // mfaCodeIssuedAt was NEVER stripped pre-fix; keep it that way.
    expect(safe.mfaCodeIssuedAt).toBe(1788608906581);
  });

  it("does not mutate the input record", () => {
    stripAuthFields(record);
    expect(record.password).toBe("$pbkdf2$hash");
    expect(record.mfaCode).toBe("490005");
  });

  it("a projected record can never authenticate (the incident, in one line)", () => {
    const safe: Record<string, any> = stripAuthFields(record);
    // Exactly what verifyLogin reads after a getUser fetch:
    expect(safe.password).toBeUndefined();      // → every account "passwordless"
    expect(safe.mfaCode).toBeUndefined();       // → typed code compared to ""
    expect(safe.failedLoginAttempts).toBeUndefined(); // → lockout dead
    expect(safe.lockedUntil).toBeUndefined();
    expect(safe.verificationCode).toBeUndefined();    // → reset OTP dead
  });
});

describe("SOURCE CONTRACT — auth flows must read the RAW record", () => {
  it("getUserForAuth exists and is an internalQuery (never client-callable)", () => {
    const src = functionSrc(myFunctionsSrc, "getUserForAuth");
    expect(src).toContain("internalQuery(");
    expect(src).not.toContain("query(");
  });

  it("getUser stays PUBLIC and keeps the privacy projection", () => {
    const src = functionSrc(myFunctionsSrc, "getUser");
    expect(src).toContain("stripAuthFields");
    expect(src).not.toContain("internalQuery(");
  });

  it("verifyLogin fetches via internal getUserForAuth, not the projected getUser", () => {
    const src = functionSrc(myFunctionsSrc, "verifyLogin");
    expect(src).toContain("internal.myFunctions.getUserForAuth");
    // The exact regression this suite guards against:
    expect(src).not.toContain("api.myFunctions.getUser");
  });

  it("resetPassword fetches via internal getUserForAuth (fixes the OTP reset path)", () => {
    const src = functionSrc(myFunctionsSrc, "resetPassword");
    expect(src).toContain("internal.myFunctions.getUserForAuth");
    expect(src).not.toContain("api.myFunctions.getUser");
  });

  it("portals invite re-accept guard reads the raw password (not the stripped one)", () => {
    // Scoped to the invite-acceptance region that reads .password.
    const guardIdx = portalsSrc.indexOf(
      "const existingUserCheck: any = await ctx.runQuery("
    );
    expect(guardIdx).toBeGreaterThan(-1);
    const region = portalsSrc.slice(guardIdx, guardIdx + 700);
    expect(region).toContain("internal.myFunctions.getUserForAuth");
  });
});
