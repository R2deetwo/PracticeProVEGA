/**
 * Recovery-flow regression suite — the 2026-09-14 "recovery key invalid
 * though pasted from the email" incident.
 *
 * LIVE EVIDENCE (production probe, gregarious-malamute-537):
 *   - the user pasted RCV-165662 from an email; the stored code was
 *     RCV-473613 (a later request had silently superseded every earlier
 *     email — the user had no way to know);
 *   - the public getUser query returned the ACTIVE recoveryCode to any
 *     caller who knew the email (account-takeover vector).
 *
 * This suite locks the fixes:
 *   1. resetPassword normalizes the submitted code (paste line-wraps can't
 *      reject a valid code) and explains the supersession trap instead of
 *      a bare "Invalid Recovery Key";
 *   2. every code-mint site stamps recoveryCodeIssuedAt + resets the
 *      failed-attempt counter (60-min TTL, brute-force wipe);
 *   3. the NDPA projection strips recoveryCode (the leak);
 *   4. all four client reset screens normalize before sending.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripAuthFields, AUTH_STRIP_FIELDS } from "../../convex/userResolution";

const repoRoot = join(__dirname, "..", "..");
const myFunctionsSrc = readFileSync(join(repoRoot, "convex", "myFunctions.ts"), "utf-8");
const loginSrc = readFileSync(join(repoRoot, "src", "components", "auth", "Login.tsx"), "utf-8");
const adminLoginSrc = readFileSync(join(repoRoot, "src", "admin", "AdminLogin.tsx"), "utf-8");
const tenantPortalSrc = readFileSync(join(repoRoot, "src", "components", "portal", "TenantPortalLogin.tsx"), "utf-8");
const clientPortalSrc = readFileSync(join(repoRoot, "src", "components", "portal", "ClientPortalLogin.tsx"), "utf-8");

function functionSrc(src: string, name: string): string {
  const start = src.indexOf(`export const ${name} =`);
  if (start === -1) throw new Error(`function ${name} not found in source`);
  const next = src.indexOf("export const", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe("resetPassword — validation hardening (the incident)", () => {
  const src = () => functionSrc(myFunctionsSrc, "resetPassword");

  it("normalizes the submitted code before comparing (paste artifacts)", () => {
    expect(src()).toContain("normalizeResetCode");
    expect(src()).toContain('replace(/\\s+/g, "")');
    // The OLD raw comparison must be gone:
    expect(src()).not.toContain("args.overrideCode !== user.recoveryCode");
  });

  it("explains supersession instead of the bare 'Invalid Recovery Key'", () => {
    expect(src()).toContain("MOST RECENT email");
    expect(src()).not.toContain('"Invalid Recovery Key or OTP Code."');
  });

  it("enforces the 60-minute TTL on stamped codes", () => {
    expect(src()).toContain("RECOVERY_CODE_TTL_MS");
    expect(src()).toContain("60 * 60 * 1000");
    expect(src()).toContain("recoveryCodeIssuedAt");
  });

  it("wipes the stored code after repeated wrong attempts", () => {
    expect(src()).toContain("MAX_RECOVERY_ATTEMPTS");
    expect(src()).toContain("recoveryFailedAttempts");
  });

  it("clears the recovery fields on SUCCESS (one-shot codes)", () => {
    expect(src()).toContain("recoveryCode: null");
    expect(src()).toContain("recoveryCodeIssuedAt: null");
  });
});

describe("code-mint sites — TTL stamp + attempt-counter reset", () => {
  const mintSites = [
    "requestPasswordReset",
    "sendFounderRecoveryCode",
    "requestPortalPasswordReset",
  ] as const;

  it.each(mintSites)("%s stamps recoveryCodeIssuedAt and resets attempts", (name) => {
    const src = functionSrc(myFunctionsSrc, name);
    expect(src).toContain("recoveryCodeIssuedAt: Date.now()");
    expect(src).toContain("recoveryFailedAttempts: 0");
  });
});

describe("NDPA projection — the recoveryCode leak (live-probed)", () => {
  it("AUTH_STRIP_FIELDS covers the recovery family", () => {
    expect(AUTH_STRIP_FIELDS).toContain("recoveryCode");
    expect(AUTH_STRIP_FIELDS).toContain("recoveryCodeIssuedAt");
    expect(AUTH_STRIP_FIELDS).toContain("recoveryFailedAttempts");
  });

  it("a projected record can never leak the active recovery code", () => {
    const record: Record<string, any> = {
      email: "founder@example.com",
      role: "Founder",
      recoveryCode: "RCV-165662",
      recoveryCodeIssuedAt: 1789344832438,
      recoveryFailedAttempts: 1,
    };
    const safe = stripAuthFields(record);
    expect(safe.recoveryCode).toBeUndefined();
    expect(safe.recoveryCodeIssuedAt).toBeUndefined();
    expect(safe.recoveryFailedAttempts).toBeUndefined();
    expect(safe.email).toBe("founder@example.com"); // non-auth fields untouched
  });

  it("emails state the expiry + newest-email rule", () => {
    const recovery = functionSrc(myFunctionsSrc, "sendRecoveryEmail");
    const portal = functionSrc(myFunctionsSrc, "sendPortalRecoveryEmail");
    for (const src of [recovery, portal]) {
      expect(src).toContain("expires in 60 minutes");
      expect(src).toContain("newest");
    }
  });
});

describe("client reset screens — normalize before sending", () => {
  it("Login.tsx (the screen in the user's screenshot)", () => {
    expect(loginSrc).toContain("recoveryCode.trim().replace(/\\s+/g, '')");
  });
  it("AdminLogin.tsx (founder APK)", () => {
    expect(adminLoginSrc).toContain("code.trim().replace(/\\s+/g, '')");
  });
  it("portal logins trim (pre-existing, must stay)", () => {
    expect(tenantPortalSrc).toContain("overrideCode: recoveryCode.trim()");
    expect(clientPortalSrc).toContain("overrideCode: recoveryCode.trim()");
  });
});
