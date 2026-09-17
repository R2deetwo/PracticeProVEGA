/**
 * Signup product normalization — single source of truth for what counts as
 * a valid product selection anywhere in the signup funnel.
 *
 * ── WHY THIS EXISTS (2026-09-17 live incident) ──────────────────────────
 * LandingPage's `openSignup(productOverride?)` was wired directly as
 * `onClick={onSignup}` on the "Start Free Trial" buttons. React passes the
 * click event as the first argument, so the SyntheticEvent object became
 * `productOverride`. Because an event object is TRUTHY:
 *
 *   1. `selectedProduct` was set to the event object → Signup.tsx treated it
 *      as an explicit product choice and SKIPPED the "Choose Your Solution"
 *      step (users landed on the form and had to hit "← Back").
 *   2. On submit, AuthContext sanitized it via `String(product)` → the
 *      string "[object Object]" → stored verbatim on `users.product`
 *      (the schema field is a loose nullableString with no enum guard).
 *   3. Every downstream default (`user.product || 'legal'`) then branded the
 *      account **Vega** — so a user who intended Atrium was told they had
 *      signed up for Vega, and the corrupted product would later make
 *      createFirm's v.union validator THROW, breaking onboarding entirely.
 *
 * The fix: every product value entering the signup funnel (from modal
 * context, refs, or click handlers) must pass through `normalizeSignupProduct`.
 * Non-string values (events, objects, numbers) and unknown strings
 * (including the literal "[object Object]") return `null`, which the UI
 * interprets as "no product chosen" → the product selection step shows.
 */

/** Internal product identifiers as stored on user/firm records. */
export type InternalProduct = 'legal' | 'property' | 'unified';

/**
 * Marketing-facing names for UI copy (chips, toasts, confirmation text).
 * Kept next to the normalizer so display mapping can never drift from the
 * accepted vocabulary.
 */
export const PRODUCT_DISPLAY_NAMES: Record<InternalProduct, string> = {
  legal: 'Vega',
  property: 'Atrium',
  unified: 'Komplete',
};

/**
 * Tailwind-ish accent colors for the product chip in the signup form —
 * mirrors the glow colors of the three chooser cards (amber / blue / indigo).
 */
export const PRODUCT_ACCENT_COLORS: Record<InternalProduct, string> = {
  legal: '#D97706', // amber-600 — Vega
  property: '#2563EB', // blue-600 — Atrium
  unified: '#4F46E5', // indigo-600 — Komplete
};

// Accepted vocabularies, mapped to internal ids. Both the landing-page
// vocabulary ('vega' | 'atrium' | 'unified' — ProductMode) and the internal
// record vocabulary ('legal' | 'property' | 'unified') are accepted, plus
// 'komplet' (route spelling) as an alias for 'unified'.
const PRODUCT_ALIASES: Record<string, InternalProduct> = {
  vega: 'legal',
  legal: 'legal',
  atrium: 'property',
  property: 'property',
  unified: 'unified',
  komplet: 'unified',
};

/**
 * Normalize an arbitrary value to a valid internal product id.
 *
 * Returns:
 *   - 'legal' | 'property' | 'unified' for any accepted spelling
 *     (case-insensitive, trimmed)
 *   - null for EVERYTHING else — undefined, null, numbers, booleans,
 *     React SyntheticEvents / DOM events, plain objects, and unknown
 *     strings (notably "[object Object]", the residue of the incident
 *     described above).
 *
 * Callers must treat null as "no product chosen" and show the product
 * selection step — never fall back to a silent default.
 */
export function normalizeSignupProduct(value: unknown): InternalProduct | null {
  if (typeof value !== 'string') return null;
  const mapped = PRODUCT_ALIASES[value.toLowerCase().trim()];
  return mapped ?? null;
}

/**
 * Guard for submit paths: true only when the value is one of the three
 * internal ids EXACTLY (no aliases) — what we're about to send to the
 * backend must already be normalized.
 */
export function isInternalProduct(value: unknown): value is InternalProduct {
  return value === 'legal' || value === 'property' || value === 'unified';
}
