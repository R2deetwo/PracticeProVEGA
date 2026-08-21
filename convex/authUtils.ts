"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Hash a password using PBKDF2-SHA512.
 * Runs as an internalAction so it can access Node.js crypto.
 * Output format: "sha512$iterations$salt$hash"
 *
 * OWASP recommends a minimum of 600,000 iterations for PBKDF2-SHA512
 * (as of 2023). Previously this was set to 100,000 which is below the
 * OWASP minimum. Existing passwords hashed with 100k iterations will
 * still verify correctly (the iteration count is stored in the hash
 * string), but all NEW passwords are hashed with 600,000 iterations.
 * When a user with a 100k-iteration hash logs in, verifyPassword
 * returns needsMigration=true, and the caller should re-hash the
 * password with the new iteration count.
 */
export const hashPassword = internalAction({
  args: { password: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    const crypto = await import("crypto");
    const salt = crypto.randomBytes(16).toString("hex");
    const iterations = 600000;
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

    // NEW FORMAT: sha512$iterations$salt$hash
    if (args.storedHash.includes("$")) {
      const parts = args.storedHash.split("$");
      if (parts.length === 4) {
        const [digest, iterationsStr, salt, hash] = parts;
        const iterations = parseInt(iterationsStr, 10);
        const keylen = 64;
        const computedHash = crypto
          .pbkdf2Sync(args.password, salt, iterations, keylen, digest)
          .toString("hex");
        // If the password is valid AND the iteration count is below the
        // current OWASP minimum (600k), flag for migration so the caller
        // can re-hash with the stronger iteration count.
        const needsMigration = computedHash === hash && iterations < 600000;
        return { valid: computedHash === hash, needsMigration };
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

    // ANCIENT FORMAT: plaintext — PHASE 0.6: Log security warning for migration.
    // We don't remove this check because it would lock out ancient users.
    // The needsMigration=true flag causes verifyLogin to re-hash on next login,
    // so plaintext passwords are gradually eliminated.
    if (args.password === args.storedHash) {
      console.warn("[SECURITY] Plaintext password matched — this user should be migrated to PBKDF2 on login.");
      return { valid: true, needsMigration: true };
    }

    return { valid: false, needsMigration: false };
  },
});
