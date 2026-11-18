/**
 * Pins for the founder-APK black-screen fix (2026-11-18).
 *
 * Reproduced headlessly: with a stored session whose getUser resolves to
 * null, the founder app stayed on the splash's final near-black (#0e0e11)
 * frame forever — "the app doesn't load" — because the boot gate treated a
 * resolved-empty session query as still loading. These pins keep the
 * boot-gate semantics from regressing.
 */
import { describe, it, expect } from 'vitest';
import {
  isSessionQueryPending,
  SESSION_WATCHDOG_MS,
} from '../../src/admin/founderBoot';

describe('founder boot gate (black-screen fix, 2026-11-18)', () => {
  it('no stored session token → not loading (fresh install passes the splash straight to login)', () => {
    expect(isSessionQueryPending(null, undefined)).toBe(false);
    expect(isSessionQueryPending('', undefined)).toBe(false);
  });

  it('token + query in flight → loading (the only true case)', () => {
    expect(isSessionQueryPending('founder@practicepro.ng', undefined)).toBe(true);
  });

  it('token + query resolved to no user → NOT loading (was the black-screen bug)', () => {
    // Convex useQuery returns null when the query resolved to no user.
    // The old expression `sessionToken && !userData` returned TRUE here,
    // parking the founder app on the splash's near-black final frame forever.
    expect(isSessionQueryPending('founder@practicepro.ng', null)).toBe(false);
  });

  it('token + user resolved → not loading', () => {
    expect(
      isSessionQueryPending('founder@practicepro.ng', {
        _id: 'x',
        role: 'Founder',
      })
    ).toBe(false);
  });

  it('watchdog: long enough for a slow first connect, never a permanent wait', () => {
    expect(SESSION_WATCHDOG_MS).toBeGreaterThanOrEqual(3000);
    expect(SESSION_WATCHDOG_MS).toBeLessThanOrEqual(8000);
  });
});
