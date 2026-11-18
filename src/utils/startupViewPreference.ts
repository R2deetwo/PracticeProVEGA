/**
 * startupViewPreference — where the app lands on boot.
 *
 * OWNER ADDENDUM (2026-11-18, "startup default & one-tap launch
 * preference"): the app DEFAULTS TO THE FULL OFFICE DASHBOARD for everyone —
 * Quick Capture is never forced on new users, first-time launches, or
 * phones. Values:
 *   - 'auto' (default): the Full Office dashboard — identical to 'office'.
 *     (Historic note: 'auto' once meant "Quick Capture on phones"; the
 *     owner addendum reversed that. Stored 'auto' values simply behave as
 *     office-first now.)
 *   - 'capture': MOBILE launches (phone-like devices) bypass the dashboard
 *     and open directly into Quick Capture. Set by the "Start in Quick
 *     Capture on mobile" toggle inside the Quick Capture header (OFF by
 *     default) or Settings → Display.
 *   - 'office': always the full workspace.
 *
 * Persisted per-account in localStorage (same pattern as the accent-theme
 * lock in Settings → Display) — instant read on boot, no network round
 * trip before the first paint.
 */

export type StartupViewPreference = 'auto' | 'capture' | 'office';

const KEY_PREFIX = 'practicepro_startup_view_';

export function getStartupViewPreference(userId?: string | null): StartupViewPreference {
  if (!userId || typeof localStorage === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    if (raw === 'auto' || raw === 'capture' || raw === 'office') return raw;
  } catch { /* private mode / quota */ }
  return 'auto';
}

export function setStartupViewPreference(userId: string | null | undefined, value: StartupViewPreference): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY_PREFIX + userId, value);
  } catch { /* private mode / quota */ }
}
