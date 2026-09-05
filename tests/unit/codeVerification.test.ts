/**
 * Task 20 regression suite — the "both codes failed" incident (2026-09-05).
 *
 * Production evidence (read-only inspect via the R17 drill pattern): a user
 * record with password set, MFA disabled, a stale login code still stored,
 * zero sessions, zero failed attempts. Reconstruction: the login code email
 * and the SIGNUP verification email were the same template; codes had no
 * enforced expiry (the email promised 10 minutes); every password attempt
 * silently regenerated the code; wrong codes did not count toward the
 * lockout; and resetPassword left stale codes on the record.
 *
 * These tests lock the rules that close that class:
 *   1. normalizeCode — paste artifacts and non-digits never reach the
 *      comparison;
 *   2. isCodeExpired — the 10-minute promise is real, and legacy codes
 *      without an issuance timestamp are expired (forces a fresh code);
 *   3. codeHint — only ever a 2-digit prefix, never the full code;
 *   4. wrongCodeMessage — expired vs incorrect say different things, and
 *      both direct the user to the newest email / resend.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeCode,
  isCodeExpired,
  codeHint,
  wrongCodeMessage,
  CODE_TTL_MS,
} from "../../convex/codeVerification";

describe("normalizeCode — input hygiene before comparison", () => {
  it("passes clean 6-digit codes through unchanged", () => {
    expect(normalizeCode("640209")).toBe("640209");
  });

  it("strips whitespace from pasted codes", () => {
    expect(normalizeCode(" 640209 ")).toBe("640209");
    expect(normalizeCode("\n640209\t")).toBe("640209");
  });

  it("strips non-digit artifacts (hyphens, letters, zero-width)", () => {
    expect(normalizeCode("640-209")).toBe("640209");
    expect(normalizeCode("64 209")).toBe("64209");
    expect(normalizeCode("A640209Z")).toBe("640209");
  });

  it("returns empty string for nullish or non-code input", () => {
    expect(normalizeCode(null)).toBe("");
    expect(normalizeCode(undefined)).toBe("");
    expect(normalizeCode("")).toBe("");
  });
});

describe("isCodeExpired — the 10-minute promise is enforced", () => {
  const now = 1_000_000_000;

  it("a code issued now is not expired", () => {
    expect(isCodeExpired(now, now)).toBe(false);
  });

  it("a code issued 9 minutes ago is not expired", () => {
    expect(isCodeExpired(now - CODE_TTL_MS + 60_000, now)).toBe(false);
  });

  it("a code issued exactly TTL ago is expired", () => {
    expect(isCodeExpired(now - CODE_TTL_MS, now)).toBe(true);
  });

  it("a code issued 11 minutes ago is expired", () => {
    expect(isCodeExpired(now - CODE_TTL_MS - 60_000, now)).toBe(true);
  });

  it("legacy codes with NO issuance timestamp are expired (forces fresh code)", () => {
    // The user's stale pre-fix code (observed live) had no timestamp — its
    // age is unknowable, so it must be treated as expired, not valid.
    expect(isCodeExpired(undefined, now)).toBe(true);
    expect(isCodeExpired(null, now)).toBe(true);
  });
});

describe("codeHint — 2-digit prefix only, never the full code", () => {
  it("returns the first two digits of a 6-digit code", () => {
    expect(codeHint("640209")).toBe("64");
  });

  it("returns null for nullish codes", () => {
    expect(codeHint(null)).toBeNull();
    expect(codeHint(undefined)).toBeNull();
  });

  it("returns null for codes too short to safely hint", () => {
    expect(codeHint("642")).toBeNull();
  });
});

describe("wrongCodeMessage — actionable, state-specific copy", () => {
  it("expired copy points at Resend, not at the user's typing", () => {
    const msg = wrongCodeMessage(true);
    expect(msg).toContain("expired");
    expect(msg).toContain("Resend");
  });

  it("incorrect copy points at the newest email (the incident's failure mode)", () => {
    const msg = wrongCodeMessage(false);
    expect(msg.toLowerCase()).toContain("newest");
    expect(msg.toLowerCase()).toContain("no longer work");
    expect(msg).not.toContain("expired");
  });
});
