"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Hash a password using PBKDF2-SHA512.
 * Runs as an internalAction so it can access Node.js crypto.
 * Output format: "sha512$iterations$salt$hash"
 */
export const hashPassword = internalAction({
  args: { password: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    const crypto = await import("crypto");
    const salt = crypto.randomBytes(16).toString("hex");
    const iterations = 100000;
    const keylen = 64;
    const digest = "sha512";
    const hash = crypto
      .pbkdf2Sync(args.password, salt, iterations, keylen, digest)
      .toString("hex");
    return `${digest}$${iterations}$${salt}$${hash}`;
  },
});

/**
 * Verify a plaintext password against a stored hash.
 * Handles three legacy formats for migration:
 *   1. PBKDF2 format:   "sha512$100000$salt$hash"  (new)
 *   2. SHA-256 format:  64-char hex string          (legacy — client used to hash before sending)
 *   3. Plaintext:       raw string stored as-is     (ancient legacy)
 */
export const verifyPassword = internalAction({
  args: { password: v.string(), storedHash: v.string() },
  handler: async (
    _ctx,
    args
  ): Promise<{ valid: boolean; needsMigration: boolean }> => {
    const crypto = await import("crypto");

    // NEW FORMAT: sha512$100000$salt$hash
    if (args.storedHash.includes("$")) {
      const parts = args.storedHash.split("$");
      if (parts.length === 4) {
        const [digest, iterationsStr, salt, hash] = parts;
        const iterations = parseInt(iterationsStr, 10);
        const keylen = 64;
        const computedHash = crypto
          .pbkdf2Sync(args.password, salt, iterations, keylen, digest)
          .toString("hex");
        return { valid: computedHash === hash, needsMigration: false };
      }
    }

    // LEGACY FORMAT: 64-char SHA-256 hex (client used to SHA-256 hash before sending)
    if (args.storedHash.length === 64) {
      const legacyHash = crypto
        .createHash("sha256")
        .update(args.password)
        .digest("hex");
      return { valid: legacyHash === args.storedHash, needsMigration: true };
    }

    // ANCIENT FORMAT: plaintext
    if (args.password === args.storedHash) {
      return { valid: true, needsMigration: true };
    }

    return { valid: false, needsMigration: false };
  },
});
