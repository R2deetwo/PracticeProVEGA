/**
 * firebaseProvision gate tests.
 *
 * Locks in the setup-token gate of the one-time Firebase provisioning
 * action: only the holder of the plaintext token (sha256 committed in the
 * source) can invoke the Management API through it. The provisioning flow
 * itself is exercised live against production, not in unit tests.
 */

import { describe, it, expect } from "vitest";
import { tokenMatchesHash, ADMIN_PACKAGE_NAME } from "../../convex/firebaseProvision";

describe("firebaseProvision.tokenMatchesHash", () => {
  const hash = "a".repeat(64); // well-formed placeholder hash for pure tests

  it("accepts the exact plaintext whose sha256 matches", () => {
    // Compute a real hash here so the comparison path runs for real.
    const { createHash } = require("node:crypto");
    const plaintext = "correct horse battery staple";
    const realHash = createHash("sha256").update(plaintext).digest("hex");
    expect(tokenMatchesHash(plaintext, realHash)).toBe(true);
  });

  it("rejects a wrong token", () => {
    const { createHash } = require("node:crypto");
    const realHash = createHash("sha256").update("correct horse battery staple").digest("hex");
    expect(tokenMatchesHash("wrong horse battery staple", realHash)).toBe(false);
  });

  it("rejects empty and oversized tokens without throwing", () => {
    expect(tokenMatchesHash("", hash)).toBe(false);
    expect(tokenMatchesHash("x".repeat(513), hash)).toBe(false);
    expect(tokenMatchesHash("x".repeat(512), hash)).toBe(false); // length ok, hash mismatch
  });

  it("guards against non-string input", () => {
    expect(tokenMatchesHash(undefined as any, hash)).toBe(false);
    expect(tokenMatchesHash(null as any, hash)).toBe(false);
    expect(tokenMatchesHash(123 as any, hash)).toBe(false);
  });

  it("the committed gate hash is a well-formed sha256 hex string", () => {
    // Read the source so the committed constant itself is validated.
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "../../convex/firebaseProvision.ts"),
      "utf8"
    );
    const m = src.match(/SETUP_TOKEN_SHA256\s*=\s*"([0-9a-f]{64})"/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("targets the founder package name", () => {
    expect(ADMIN_PACKAGE_NAME).toBe("com.practicepro.admin");
  });
});
