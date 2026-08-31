/**
 * Cryptographically secure random generation helpers.
 *
 * SECURITY RULE: All token / code / reference generation MUST use these
 * helpers — NEVER Math.random(). Math.random() is a predictable PRNG:
 * observing a few outputs allows predicting subsequent ones, which is a
 * real-world OTP-guessing / token-enumeration vulnerability class.
 *
 * Implementation note: crypto.randomUUID() is available in ALL Convex
 * runtimes (queries, mutations, actions) — verified in production by
 * convex/impersonation.ts. We derive unbiased random integers from its
 * hex output via rejection sampling (no modulo bias).
 */

/** Returns `count` random hex characters (0-9a-f), crypto-secure. */
export function randomHex(count: number): string {
  let out = "";
  while (out.length < count) {
    out += crypto.randomUUID().replace(/-/g, "");
  }
  return out.slice(0, count);
}

/**
 * Uniform random integer in [0, maxExclusive) — unbiased via rejection
 * sampling. Draws entropy from crypto.randomUUID()'s hex digits.
 */
export function randomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(
      `randomInt: maxExclusive must be a positive integer, got ${maxExclusive}`
    );
  }
  if (maxExclusive === 1) return 0;

  const hexDigits = Math.ceil(Math.log(maxExclusive) / Math.log(16));
  const capacity = Math.pow(16, hexDigits);
  // Largest multiple of maxExclusive <= capacity; values >= limit are
  // rejected and redrawn so every output is exactly equally likely.
  const limit = capacity - (capacity % maxExclusive);

  for (let attempts = 0; attempts < 16; attempts++) {
    const value = parseInt(randomHex(hexDigits), 16);
    if (value < limit) return value % maxExclusive;
  }
  // Statistically unreachable (worst-case rejection rate here is 15/16^k);
  // fall back to a plain mod draw rather than looping forever.
  return parseInt(randomHex(hexDigits), 16) % maxExclusive;
}

/**
 * Numeric code of exactly `digits` digits where the first digit is 1-9,
 * e.g. numericCode(6) → "100000"–"999999". Same shape as the legacy
 * `Math.floor(100000 + Math.random() * 900000)` codes.
 */
export function numericCode(digits: number): string {
  if (digits < 1) throw new Error("numericCode: digits must be >= 1");
  const first = 1 + randomInt(9); // 1–9, never leading zero
  let out = first.toString();
  for (let i = 1; i < digits; i++) out += randomInt(10).toString();
  return out;
}

/**
 * Numeric code of exactly `digits` digits, zero-padded,
 * e.g. paddedDigitCode(6) → "000000"–"999999".
 */
export function paddedDigitCode(digits: number): string {
  if (digits < 1) throw new Error("paddedDigitCode: digits must be >= 1");
  let out = "";
  for (let i = 0; i < digits; i++) out += randomInt(10).toString();
  return out;
}

/**
 * Code of `length` chars drawn from `charset`, unbiased.
 * Use for human-typed codes — pass an ambiguity-free charset, e.g.
 * "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" (no 0/O/1/I/L).
 */
export function codeFromCharset(charset: string, length: number): string {
  if (charset.length < 2) throw new Error("codeFromCharset: charset too small");
  if (length < 1) throw new Error("codeFromCharset: length must be >= 1");
  let out = "";
  for (let i = 0; i < length; i++) out += charset[randomInt(charset.length)];
  return out;
}
