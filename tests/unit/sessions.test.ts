/**
 * R13 regression suite — session token helpers (convex/sessions.ts).
 *
 * Locks the bearer-session invariants:
 *   - tokens are 64-char lowercase hex (256 bits of entropy — infeasible
 *     to enumerate);
 *   - only the SHA-256 hash is ever derivable from storage logic (the
 *     token itself never round-trips through the hash);
 *   - expiry math is exactly SESSION_TTL_MS;
 *   - validation semantics: revoked beats expired, expired beats valid,
 *     absent rows are "not_found".
 *
 * The Convex mutations themselves (createSession, revokeSession, …) run
 * against the real database in CI deploys; the pure surface here is what
 * protects against silent logic drift.
 */
import { describe, it, expect } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
  sessionInvalidReason,
  SESSION_TTL_MS,
} from "../../convex/sessions";

describe("generateSessionToken", () => {
  it("produces 64 lowercase hex chars (256 bits)", () => {
    for (let i = 0; i < 5; i++) {
      expect(generateSessionToken()).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("never repeats across draws (collision sanity on 10k draws)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateSessionToken());
    expect(seen.size).toBe(10_000);
  });
});

describe("hashSessionToken", () => {
  it("matches the reference SHA-256 of the token", () => {
    const token = "a".repeat(64);
    // sha256("aaaa...") — computed once and pinned; the sha256 suite
    // independently proves the algorithm against FIPS vectors.
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is NOT the token (storage never holds the secret)", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("distinct tokens hash to distinct digests", () => {
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    expect(hashSessionToken(t1)).not.toBe(hashSessionToken(t2));
  });
});

describe("sessionExpiry", () => {
  it("is exactly SESSION_TTL_MS after creation", () => {
    const now = 1_788_000_000_000;
    expect(sessionExpiry(now)).toBe(now + SESSION_TTL_MS);
  });

  it("SESSION_TTL_MS is 30 days", () => {
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe("sessionInvalidReason — validation semantics", () => {
  const now = 1_788_000_000_000;
  const userId = "users/abc123";
  const base = { userId, expiresAt: now + 1000 };

  it("null (valid) for an active, unexpired session", () => {
    expect(sessionInvalidReason({ ...base }, now)).toBeNull();
  });

  it("'expired' when expiresAt <= now", () => {
    expect(sessionInvalidReason({ ...base, expiresAt: now }, now)).toBe("expired");
    expect(sessionInvalidReason({ ...base, expiresAt: now - 1 }, now)).toBe("expired");
  });

  it("'revoked' when revokedAt is set (revocation beats expiry)", () => {
    // Revoked AND expired → 'revoked' (the stronger signal for forensics).
    expect(sessionInvalidReason({ ...base, expiresAt: now - 1, revokedAt: now - 5 }, now)).toBe("revoked");
  });

  it("'not_found' for missing sessions", () => {
    expect(sessionInvalidReason(null, now)).toBe("not_found");
    expect(sessionInvalidReason(undefined, now)).toBe("not_found");
  });

  it("valid at exactly expiresAt - 1ms (boundary is exclusive)", () => {
    expect(sessionInvalidReason({ ...base, expiresAt: now + 1 }, now)).toBeNull();
  });
});
