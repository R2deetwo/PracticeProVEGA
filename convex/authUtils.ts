"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * PBKDF2 iterations.
 *
 * P1 FIX: Was 100,000 — below OWASP 2023 minimum of 600,000 for PBKDF2-SHA512.
 * Now 600,000. New passwords are hashed with 600k iterations.
 * Existing passwords with 100k iterations still verify correctly (the iteration
 * count is stored in the hash string) and are flagged for rehashing on next login.
 */
const PBKDF2_ITERATIONS = 600_000;

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
    const keylen = 64;
    const digest = "sha512";
    const hash = crypto
      .pbkdf2Sync(args.password, salt, PBKDF2_ITERATIONS, keylen, digest)
      .toString("hex");
    return `${digest}$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
  },
});

/**
 * Verify a plaintext password against a stored hash.
 * Handles three legacy formats for migration:
 *   1. PBKDF2 format:   "sha512$iterations$salt$hash"  (current — any iteration count)
 *   2. SHA-256 format:  64-char hex string              (legacy — client used to hash before sending)
 *   3. Plaintext:       raw string stored as-is          (ancient legacy — P1 FIX: use timingSafeEqual)
 *
 * Returns needsMigration=true if:
 *   - The hash uses fewer than 600,000 iterations (should rehash)
 *   - The hash is in a legacy format (SHA-256 or plaintext)
 */
export const verifyPassword = internalAction({
  args: { password: v.string(), storedHash: v.string() },
  handler: async (
    _ctx,
    args
  ): Promise<{ valid: boolean; needsMigration: boolean }> => {
    const crypto = await import("crypto");

    // CURRENT FORMAT: sha512$iterations$salt$hash
    if (args.storedHash.includes("$")) {
      const parts = args.storedHash.split("$");
      if (parts.length === 4) {
        const [digest, iterationsStr, salt, hash] = parts;
        const iterations = parseInt(iterationsStr, 10);
        const keylen = 64;
        const computedHash = crypto
          .pbkdf2Sync(args.password, salt, iterations, keylen, digest)
          .toString("hex");
        // P1 FIX: Use timingSafeEqual instead of === to prevent timing attacks
        const valid = computedHash.length === hash.length &&
          crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
        // Flag for rehashing if iterations are below current standard
        const needsMigration = valid && iterations < PBKDF2_ITERATIONS;
        return { valid, needsMigration };
      }
    }

    // LEGACY FORMAT: 64-char SHA-256 hex (client used to SHA-256 hash before sending)
    if (args.storedHash.length === 64) {
      const legacyHash = crypto
        .createHash("sha256")
        .update(args.password)
        .digest("hex");
      // P1 FIX: Use timingSafeEqual
      const valid = legacyHash.length === args.storedHash.length &&
        crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(args.storedHash));
      return { valid, needsMigration: true };
    }

    // ANCIENT FORMAT: plaintext — P1 FIX: use timingSafeEqual instead of ===
    if (args.password.length === args.storedHash.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(args.password), Buffer.from(args.storedHash))) {
          return { valid: true, needsMigration: true };
        }
      } catch { /* lengths differ, fall through */ }
    }

    return { valid: false, needsMigration: false };
  },
});
