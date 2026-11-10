/**
 * Money / Currency Utilities for Convex Server Side
 * ═══════════════════════════════════════════════════════════════════════
 *
 * AUDIT FIX (C11): Floating-point naira causes silent rounding errors.
 * These helpers should be used in all Convex mutations that write
 * currency values to ensure amounts are always rounded to 2 decimal
 * places before storage.
 *
 * FUTURE: When migrating to integer kobo storage, use toKobo() before
 * writing and fromKobo() after reading.
 */

/**
 * Round a number to 2 decimal places (for Naira).
 */
export function roundMoney(amount: number): number {
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Validate that a monetary amount has at most 2 decimal places.
 */
export function validateMoney(amount: number): boolean {
    if (typeof amount !== 'number' || isNaN(amount)) return false;
    const rounded = roundMoney(amount);
    return Math.abs(amount - rounded) < 0.0001;
}

/**
 * Safe addition for money values.
 */
export function addMoney(...amounts: number[]): number {
    const sum = amounts.reduce((acc, n) => acc + (typeof n === 'number' && !isNaN(n) ? n : 0), 0);
    return roundMoney(sum);
}

/**
 * Safe subtraction for money values.
 */
export function subtractMoney(a: number, b: number): number {
    return roundMoney((a || 0) - (b || 0));
}

/**
 * Convert Naira to kobo (integer).
 */
export function toKobo(naira: number): number {
    return Math.round(roundMoney(naira) * 100);
}

/**
 * Convert kobo (integer) to Naira.
 */
export function fromKobo(kobo: number): number {
    return roundMoney((kobo || 0) / 100);
}

/**
 * Sanitize a money value for storage — rounds to 2 decimal places.
 */
export function sanitizeMoney(amount: any): number {
    if (typeof amount === 'string') {
        const cleaned = amount.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : roundMoney(parsed);
    }
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    return roundMoney(amount);
}

/**
 * ROUND B (M5, Wave S2 money truth): server-side amount validation for
 * every dedicated money mutation. A payment, charge, credit or deduction
 * must be a FINITE POSITIVE amount before it can touch the books —
 * previously the money mutations accepted 0, negative and NaN amounts
 * (a negative "debit" could CREDIT a wallet balance; a NaN silently
 * poisoned every aggregate it entered). Returns the rounded amount so
 * callers store the validated value in one step.
 */
export function assertPositiveAmount(amount: number, label: string): number {
    if (typeof amount !== 'number' || !isFinite(amount) || isNaN(amount)) {
        throw new Error(`${label} must be a valid number.`);
    }
    const rounded = roundMoney(amount);
    if (rounded <= 0) {
        throw new Error(`${label} must be greater than zero. Zero or negative amounts are not valid money movements — corrections belong in the audited void/reinstate lifecycle.`);
    }
    return rounded;
}

/**
 * ROUND B (M5): non-negative variant for optional money figures that may
 * legitimately be zero (e.g. a management fee of 0 on a rent collection).
 */
export function assertNonNegativeAmount(amount: number, label: string): number {
    if (typeof amount !== 'number' || !isFinite(amount) || isNaN(amount)) {
        throw new Error(`${label} must be a valid number.`);
    }
    const rounded = roundMoney(amount);
    if (rounded < 0) {
        throw new Error(`${label} cannot be negative.`);
    }
    return rounded;
}

// ─── ROUND F (Wave F4, §6): kobo-native arithmetic helpers ──────────────────
//
// The Round F convention: NEW money code computes in integer kobo internally
// and converts back to naira @2dp once, at the end (storage stays naira —
// the kobo STORAGE migration is a deliberately deferred separate wave).
// These are the shared primitives every Round F module uses (and every
// future wave should reach for first).

/** Add amounts as integer kobo (no float accumulation). Inputs are naira
 *  @2dp; the sum is exact because each operand is converted once. */
export function addKobo(...nairaAmounts: number[]): number {
  let kobo = 0;
  for (const n of nairaAmounts) {
    kobo += Math.round((Number(n) || 0) * 100);
  }
  return Math.round((kobo / 100) * 100) / 100;
}

/** Subtract as integer kobo (minuend − subtrahend). */
export function subKobo(a: number, b: number): number {
  const kobo = Math.round((Number(a) || 0) * 100) - Math.round((Number(b) || 0) * 100);
  return Math.round((kobo / 100) * 100) / 100;
}

/** Compare two naira amounts exactly in kobo (no float drift):
 *  negative when a < b, 0 when equal, positive when a > b. */
export function compareKobo(a: number, b: number): number {
  return Math.round((Number(a) || 0) * 100) - Math.round((Number(b) || 0) * 100);
}
