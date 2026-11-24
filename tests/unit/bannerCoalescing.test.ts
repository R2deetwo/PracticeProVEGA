/**
 * bannerCoalescing — the Dashboard attention-slot grammar (2026-11-25 audit
 * response: "Banner Fatigue — … banners can stack vertically, pushing
 * operational widgets below the fold").
 */
import { describe, it, expect } from 'vitest';
import { pickAttentionBanner } from '../../src/utils/bannerCoalescing';

describe('pickAttentionBanner — ONE attention slot, setup wins', () => {
  it('both visible → setup (finishing onboarding is the activation driver)', () => {
    expect(pickAttentionBanner({ setup: true, trial: true })).toBe('setup');
  });

  it('setup only → setup', () => {
    expect(pickAttentionBanner({ setup: true, trial: false })).toBe('setup');
  });

  it('trial only → trial (the nudge returns on its next milestone day)', () => {
    expect(pickAttentionBanner({ setup: false, trial: true })).toBe('trial');
  });

  it('neither → null (no attention banner renders)', () => {
    expect(pickAttentionBanner({ setup: false, trial: false })).toBe(null);
  });

  it('the zero-records suppression happens BEFORE this slot (flags arrive pre-gated)', () => {
    // The Dashboard passes hasAnyRecords-gated flags; the pure grammar never
    // re-implements that policy. Zero records ⇒ both false ⇒ null.
    expect(pickAttentionBanner({ setup: false && true, trial: false && true })).toBe(null);
  });
});
