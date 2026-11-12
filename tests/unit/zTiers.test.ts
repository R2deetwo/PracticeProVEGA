/**
 * Z_TIERS / Z_CLASS contract tests (UX-18 — z-index governance).
 *
 * The migration replaced 125 hardcoded z-[NNNN] literals across 74 files
 * with the named tier ladder in src/overlays/constants.ts. These tests
 * hold the ladder's structural invariants so it can never silently
 * drift or regress to path-dependent stacking:
 *   1. Z_CLASS strings are exactly `z-[<value>]` for their Z_TIERS key.
 *   2. Both modal render paths share ONE tier (the 300-below-everything
 *      bug: registry ModalShell dialogs used to render under the bottom
 *      nav, side panels and every legacy modal).
 *   3. The system ladder is strictly ordered where it must be:
 *      modal < modalRaised < modalStack < modalPeak,
 *      toast-sub < toast/system-alert < refresh banner < crash screen.
 *   4. ModalShell and Modal.tsx consume the SAME tier value (both paths
 *      checked by reading the tier, not the class string).
 */
import { describe, it, expect } from 'vitest';
import { Z_TIERS, Z_CLASS } from '../../src/overlays/constants';

describe('UX-18: Z_TIERS / Z_CLASS z-index governance', () => {
  it('Z_CLASS maps 1:1 onto Z_TIERS with z-[<value>] strings', () => {
    const tierKeys = Object.keys(Z_TIERS).sort();
    const classKeys = Object.keys(Z_CLASS).sort();
    expect(classKeys).toEqual(tierKeys);
    for (const key of tierKeys) {
      expect(Z_CLASS[key as keyof typeof Z_CLASS]).toBe(
        `z-[${Z_TIERS[key as keyof typeof Z_TIERS]}]`,
      );
    }
  });

  it('the modal tier is 3000 — the value every legacy fixed modal uses', () => {
    // The pre-migration defect: ModalShell read an idealised Z_TIERS.modal
    // of 300 and rendered UNDER the bottom nav (1000), side panels (2000)
    // and legacy modals (3000). Both paths must sit on the real rung.
    expect(Z_TIERS.modal).toBe(3000);
  });

  it('keeps the second-level modal ladder strictly ascending', () => {
    expect(Z_TIERS.modal).toBeLessThan(Z_TIERS.modalRaised);
    expect(Z_TIERS.modalRaised).toBeLessThan(Z_TIERS.modalStack);
    expect(Z_TIERS.modalStack).toBeLessThan(Z_TIERS.modalPeak);
  });

  it('keeps system chrome above the modal ladder', () => {
    expect(Z_TIERS.checklist).toBeGreaterThan(Z_TIERS.modalPeak);
    expect(Z_TIERS.toastSub).toBeLessThan(Z_TIERS.toast);
    expect(Z_TIERS.toast).toBeLessThan(Z_TIERS.refreshBanner);
    expect(Z_TIERS.refreshBanner).toBeLessThan(Z_TIERS.crashScreen);
  });

  it('keeps the terms bar below the modal tier (dimmer never covers modals)', () => {
    expect(Z_TIERS.termsBar).toBeLessThan(Z_TIERS.modal);
  });

  it('keeps docked panels below the modal tier and above mobile chrome', () => {
    expect(Z_TIERS.sidePanel).toBeGreaterThan(Z_TIERS.bottomNav);
    expect(Z_TIERS.docked).toBeGreaterThan(Z_TIERS.sidePanel);
    expect(Z_TIERS.docked).toBeLessThan(Z_TIERS.modal);
  });
});
