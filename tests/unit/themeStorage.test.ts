/**
 * R12 regression suite — user-scoped theme key derivation.
 *
 * Locks in the semantics that killed the cross-account/cross-tab theme
 * leak (user report: a dark theme chosen in one tab/account showed up in
 * the post-email-verification onboarding of a different account):
 *   - two different users must map to two DIFFERENT localStorage keys
 *   - the same user always maps to the SAME key (case/whitespace-safe)
 *   - no email → no key (logged out → nothing to load or save)
 *
 * Only the pure key-derivation layer is tested here: the load/save/purge
 * wrappers are thin localStorage accesses (the suite runs in the node
 * environment, matching the repo's other unit suites).
 */
import { describe, it, expect } from "vitest";
import {
  normalizeThemeEmail,
  userThemeKey,
  isUserThemeKey,
  LEGACY_THEME_KEY,
} from "../../src/utils/themeStorage";

describe("normalizeThemeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeThemeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("null/empty/whitespace-only → null", () => {
    expect(normalizeThemeEmail(null)).toBeNull();
    expect(normalizeThemeEmail(undefined)).toBeNull();
    expect(normalizeThemeEmail("")).toBeNull();
    expect(normalizeThemeEmail("   ")).toBeNull();
  });
});

describe("userThemeKey — the scoping invariant", () => {
  it("maps an email to a user-scoped key", () => {
    expect(userThemeKey("ada@example.com")).toBe("practicepro_theme_u:ada@example.com");
  });

  it("DIFFERENT users → DIFFERENT keys (the leak, closed)", () => {
    const keyA = userThemeKey("ada@example.com");
    const keyB = userThemeKey("tunde@example.com");
    expect(keyA).not.toBeNull();
    expect(keyB).not.toBeNull();
    expect(keyA).not.toBe(keyB);
  });

  it("SAME user → SAME key regardless of case/whitespace (saves always hit the same slot)", () => {
    expect(userThemeKey("ada@example.com")).toBe(userThemeKey("  ADA@Example.com "));
  });

  it("no email → no key (nothing to load/save when logged out)", () => {
    expect(userThemeKey(null)).toBeNull();
    expect(userThemeKey(undefined)).toBeNull();
    expect(userThemeKey("   ")).toBeNull();
  });

  it("user keys never collide with the legacy shared key", () => {
    expect(userThemeKey("practicepro_theme")).not.toBe(LEGACY_THEME_KEY);
  });
});

describe("isUserThemeKey — version-refresh preservation filter", () => {
  it("recognizes user-scoped keys (any account)", () => {
    expect(isUserThemeKey("practicepro_theme_u:ada@example.com")).toBe(true);
  });

  it("rejects the legacy shared key and unrelated keys", () => {
    expect(isUserThemeKey("practicepro_theme")).toBe(false);
    expect(isUserThemeKey("practicepro_theme_u")).toBe(false); // bare prefix, no user
    expect(isUserThemeKey("practicepro_fontSize")).toBe(false);
    expect(isUserThemeKey("practicepro_portal_theme")).toBe(false);
  });
});
