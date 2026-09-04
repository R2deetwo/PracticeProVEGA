/**
 * R13 regression suite — pure-TS SHA-256 (convex/sha256.ts).
 *
 * Session-token validation hashes the presented token inside Convex
 * queries/mutations (no node:crypto there). A single bit-flipped round
 * constant or padding bug would silently invalidate every session — or
 * worse, produce collisions. These vectors are from FIPS 180-4 / the
 * NIST examples, so correctness is anchored to the standard, not to a
 * self-consistent reimplementation.
 */
import { describe, it, expect } from "vitest";
import { sha256Hex } from "../../convex/sha256";

describe("sha256Hex — FIPS 180-4 test vectors", () => {
  it("empty string", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("'abc' (single-block classic)", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("448-bit message (two-block, crosses the padding boundary)", () => {
    // "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });

  it("896-bit message (long multi-block)", () => {
    const input =
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu";
    expect(sha256Hex(input)).toBe(
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
    );
  });
});

describe("sha256Hex — structural properties", () => {
  it("64 lowercase hex chars for arbitrary inputs", () => {
    for (const input of ["", "x", "hello world", "a".repeat(1000), "ünicode→✓ input"]) {
      expect(sha256Hex(input)).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("deterministic (same input → same digest)", () => {
    expect(sha256Hex("practicepro-session-token")).toBe(sha256Hex("practicepro-session-token"));
  });

  it("avalanche: a one-character change changes the digest", () => {
    const a = sha256Hex("session-token-1");
    const b = sha256Hex("session-token-2");
    expect(a).not.toBe(b);
  });

  it("handles 2^32-ish bit lengths without truncation (long input sanity)", () => {
    // 100k chars — exercises the multi-block loop + high word of the length.
    const digest = sha256Hex("z".repeat(100_000));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
