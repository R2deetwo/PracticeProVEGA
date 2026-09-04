/**
 * R12 — User-scoped theme storage.
 *
 * PROBLEM (user report): the app theme used to live in a single shared
 * localStorage key (`practicepro_theme`). localStorage is shared by every
 * tab AND every account on the same browser profile — so when User A
 * picked a dark theme and later logged out, User B logging in on the same
 * machine inherited User A's dark theme. It also leaked into the post-
 * email-verification onboarding, which must always render light.
 *
 * FIX: themes are now stored per-account under
 *   `practicepro_theme_u:<normalized email>`
 * On login, the legacy shared key is PURGED (there is no way to attribute
 * it to whoever set it — keeping it would preserve the exact cross-user
 * leak this module exists to close, so it is dropped in favor of correct
 * semantics; users re-pick their theme once).
 *
 * The key derivation is pure so the R12 regression suite can lock it in.
 */

export const LEGACY_THEME_KEY = 'practicepro_theme';
const USER_THEME_PREFIX = 'practicepro_theme_u:';

/** Normalize an email for storage-key use (trim + lowercase). */
export function normalizeThemeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Per-user localStorage key for a theme preference.
 * Returns null when no usable email is provided (logged out).
 */
export function userThemeKey(email: string | null | undefined): string | null {
  const normalized = normalizeThemeEmail(email);
  return normalized ? `${USER_THEME_PREFIX}${normalized}` : null;
}

export function isUserThemeKey(key: string): boolean {
  return key.startsWith(USER_THEME_PREFIX);
}

/** Load the persisted theme for the given user (null = never chosen). */
export function loadUserTheme(email: string | null | undefined): string | null {
  const key = userThemeKey(email);
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode / storage disabled — theme is cosmetic, degrade quietly
  }
}

/** Persist the theme under the given user's scoped key. */
export function saveUserTheme(email: string | null | undefined, theme: string): void {
  const key = userThemeKey(email);
  if (!key) return;
  try {
    window.localStorage.setItem(key, theme);
  } catch {
    /* private mode — cosmetic preference, not worth failing on */
  }
}

/**
 * One-time purge of the legacy cross-user key. Called when any user logs
 * in: the shared key is the leak vector, so it is deleted the first time
 * any account touches this code path.
 */
export function purgeLegacyThemeKey(): void {
  try {
    window.localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    /* storage unavailable — nothing to purge */
  }
}
