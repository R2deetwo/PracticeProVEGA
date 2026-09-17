/**
 * TASK 54 regression tests — signup product normalization.
 *
 * Live incident (2026-09-17): LandingPage's openSignup was wired directly as
 * `onClick={openSignup}` on the "Start Free Trial" buttons, so React passed
 * the click event as `productOverride`. The event object is truthy → it
 * skipped the "Choose Your Solution" step → AuthContext's sanitizer
 * String()ed it to "[object Object]" → stored on users.product → every
 * `|| 'legal'` default downstream branded the account Vega (users who chose
 * Atrium were welcomed to Vega; the corrupted value also crashed createFirm's
 * v.union validator during onboarding).
 *
 * These tests pin the contract: only exact, known product spellings are
 * valid; EVERYTHING else — including event-like objects and the literal
 * string "[object Object]" — must normalize to null.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeSignupProduct,
  isInternalProduct,
  PRODUCT_DISPLAY_NAMES,
  PRODUCT_ACCENT_COLORS,
} from '../../src/utils/signupProduct';

// A minimal stand-in for a React SyntheticEvent — the shape doesn't matter,
// only that it's a truthy non-string object (like the real click event).
const fakeClickEvent: unknown = {
  bubbles: true,
  currentTarget: {},
  preventDefault: () => {},
  stopPropagation: () => {},
  type: 'click',
  nativeEvent: { type: 'click' },
};

describe('normalizeSignupProduct', () => {
  // ── Accepted vocabulary ────────────────────────────────────────────────
  it.each([
    ['legal', 'legal'],
    ['vega', 'legal'],
    ['property', 'property'],
    ['atrium', 'property'],
    ['unified', 'unified'],
    ['komplet', 'unified'],
  ])('maps %s → %s', (input, expected) => {
    expect(normalizeSignupProduct(input)).toBe(expected);
  });

  it('accepts case-insensitive and padded spellings', () => {
    expect(normalizeSignupProduct('Vega')).toBe('legal');
    expect(normalizeSignupProduct('  ATRIUM  ')).toBe('property');
    expect(normalizeSignupProduct('Unified')).toBe('unified');
  });

  // ── THE INCIDENT — click events and their stringified residue ──────────
  it('rejects a React click event object (the original bug)', () => {
    expect(normalizeSignupProduct(fakeClickEvent)).toBeNull();
  });

  it('rejects the literal string "[object Object]" (String(event) residue)', () => {
    expect(normalizeSignupProduct('[object Object]')).toBeNull();
  });

  it('rejects a native DOM event-like object', () => {
    expect(normalizeSignupProduct({ type: 'click', target: {} })).toBeNull();
  });

  // ── Everything else that must never count as a selection ───────────────
  it('rejects non-string values', () => {
    expect(normalizeSignupProduct(undefined)).toBeNull();
    expect(normalizeSignupProduct(null)).toBeNull();
    expect(normalizeSignupProduct(42)).toBeNull();
    expect(normalizeSignupProduct(true)).toBeNull();
    expect(normalizeSignupProduct({})).toBeNull();
    expect(normalizeSignupProduct(['atrium'])).toBeNull();
    expect(normalizeSignupProduct(() => 'atrium')).toBeNull();
  });

  it('rejects unknown or misspelled product strings', () => {
    expect(normalizeSignupProduct('complete')).toBeNull(); // common typo of komplet
    expect(normalizeSignupProduct('sentry')).toBeNull();
    expect(normalizeSignupProduct('legal property')).toBeNull();
    expect(normalizeSignupProduct('')).toBeNull();
    expect(normalizeSignupProduct('   ')).toBeNull();
  });
});

describe('isInternalProduct', () => {
  it('accepts exactly the three internal ids', () => {
    expect(isInternalProduct('legal')).toBe(true);
    expect(isInternalProduct('property')).toBe(true);
    expect(isInternalProduct('unified')).toBe(true);
  });

  it('rejects aliases (they must be normalized first) and garbage', () => {
    // Aliases are VALID selections but NOT internal ids — the submit path
    // must send normalized values only.
    expect(isInternalProduct('vega')).toBe(false);
    expect(isInternalProduct('atrium')).toBe(false);
    expect(isInternalProduct('[object Object]')).toBe(false);
    expect(isInternalProduct(undefined)).toBe(false);
    expect(isInternalProduct(fakeClickEvent)).toBe(false);
  });
});

describe('product display metadata', () => {
  it('covers all three internal products', () => {
    expect(Object.keys(PRODUCT_DISPLAY_NAMES).sort()).toEqual(['legal', 'property', 'unified']);
    expect(PRODUCT_DISPLAY_NAMES.legal).toBe('Vega');
    expect(PRODUCT_DISPLAY_NAMES.property).toBe('Atrium');
    expect(PRODUCT_DISPLAY_NAMES.unified).toBe('Komplete');
  });

  it('defines an accent color per product (signup clarity chip)', () => {
    for (const key of ['legal', 'property', 'unified'] as const) {
      expect(PRODUCT_ACCENT_COLORS[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
