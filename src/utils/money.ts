/**
 * Money / Currency Utilities — Prevent Floating-Point Precision Loss
 * ═══════════════════════════════════════════════════════════════════════
 *
 * AUDIT FIX (C11): Floating-point naira in Convex schema causes silent
 * rounding errors (0.1 + 0.2 = 0.30000000000000004). All currency
 * fields in the schema are stored as v.number() (JS float).
 *
 * APPROACH: Rather than a risky full schema migration to integer kobo
 * (which would require migrating all existing data and updating every
 * read/write path), we use these utility functions to:
 *   1. Round all currency values to 2 decimal places on write
 *   2. Validate that inputs don't have more than 2 decimal places
 *   3. Provide safe arithmetic that avoids float accumulation
 *
 * FUTURE: A full migration to integer kobo (amount * 100 as integer) is
 * recommended for new tables. The helpers below (toKobo / fromKobo) make
 * that transition easier when ready.
 */

/**
 * Round a number to 2 decimal places (for Naira).
 * Uses Math.round with a precision correction to avoid float errors.
 * e.g., roundMoney(0.1 + 0.2) → 0.30 (not 0.30000000000000004)
 */
export function roundMoney(amount: number): number {
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Validate that a monetary amount has at most 2 decimal places.
 * Returns true if valid, false otherwise.
 * e.g., validateMoney(10.50) → true
 *       validateMoney(10.555) → false
 */
export function validateMoney(amount: number): boolean {
    if (typeof amount !== 'number' || isNaN(amount)) return false;
    const rounded = roundMoney(amount);
    return Math.abs(amount - rounded) < 0.0001;
}

/**
 * Safe addition for money values — rounds result to 2 decimal places.
 */
export function addMoney(...amounts: number[]): number {
    const sum = amounts.reduce((acc, n) => acc + (typeof n === 'number' && !isNaN(n) ? n : 0), 0);
    return roundMoney(sum);
}

/**
 * Safe subtraction for money values — rounds result to 2 decimal places.
 */
export function subtractMoney(a: number, b: number): number {
    return roundMoney((a || 0) - (b || 0));
}

/**
 * Safe multiplication for money values (e.g., quantity × unit price).
 * Rounds result to 2 decimal places.
 */
export function multiplyMoney(amount: number, factor: number): number {
    return roundMoney((amount || 0) * (factor || 0));
}

/**
 * Convert Naira to kobo (integer). Use this when writing to a schema
 * that stores amounts in kobo (recommended for new tables).
 * e.g., toKobo(10.50) → 1050
 */
export function toKobo(naira: number): number {
    return Math.round(roundMoney(naira) * 100);
}

/**
 * Convert kobo (integer) back to Naira. Use this when reading from a
 * schema that stores amounts in kobo.
 * e.g., fromKobo(1050) → 10.50
 */
export function fromKobo(kobo: number): number {
    return roundMoney((kobo || 0) / 100);
}

/**
 * Sanitize a money value for storage — rounds to 2 decimal places and
 * returns 0 for invalid inputs. Use this in Convex mutations before
 * storing any currency value.
 */
export function sanitizeMoney(amount: any): number {
    if (typeof amount === 'string') {
        // Parse formatted strings like "₦1,234.56" → 1234.56
        const cleaned = amount.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : roundMoney(parsed);
    }
    if (typeof amount !== 'number' || isNaN(amount)) return 0;
    return roundMoney(amount);
}
