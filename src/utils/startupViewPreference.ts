/**
 * startupViewPreference — where the app lands on boot (owner spec, 2026-11-18).
 *
 * "a setting allowing users to choose their preferred default startup view"
 * — 'auto' (default): phones open Quick Capture Mode, desktops open the
 * full office workspace; 'capture': always Quick Capture on boot;
 * 'office': always the full workspace.
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
