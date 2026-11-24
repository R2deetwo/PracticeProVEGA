// @vitest-environment jsdom
/**
 * voxUsageTracking — the dismissible Overview Vox card's 7-day re-surface
 * rule (owner brief 2026-11-24):
 *   • dismiss hides the card;
 *   • it returns ONLY when the card has been hidden ≥7 days AND Aloa Vox
 *     has not been used for ≥7 days;
 *   • stamping usage (launch or recording) resets the usage clock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    stampVoxUsedAt,
    dismissVoxCard,
    shouldShowVoxCard,
    getLastVoxUsedAt,
    getVoxCardDismissedAt,
} from '../../src/utils/voxUsageTracking';

const DAY = 24 * 60 * 60 * 1000;

describe('shouldShowVoxCard (7-day rule)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shows when never dismissed', () => {
        expect(shouldShowVoxCard()).toBe(true);
    });

    it('stays hidden immediately after dismissal (even with recent Vox use)', () => {
        dismissVoxCard();
        stampVoxUsedAt();
        expect(shouldShowVoxCard()).toBe(false);
    });

    it('stays hidden 6 days after dismissal even when Vox is unused', () => {
        dismissVoxCard();
        // Backdate the dismissal 6 days and never use Vox.
        localStorage.setItem('practicepro_vox_card_dismissed_at', String(Date.now() - 6 * DAY));
        expect(shouldShowVoxCard()).toBe(false);
    });

    it('re-surfaces only after 7 days hidden AND 7 days unused', () => {
        dismissVoxCard();
        localStorage.setItem('practicepro_vox_card_dismissed_at', String(Date.now() - 8 * DAY));
        // Vox used 3 days ago → the AND fails → still hidden.
        localStorage.setItem('practicepro_vox_last_used_at', String(Date.now() - 3 * DAY));
        expect(shouldShowVoxCard()).toBe(false);
        // Vox unused for 8 days → both conditions hold → visible again.
        localStorage.setItem('practicepro_vox_last_used_at', String(Date.now() - 8 * DAY));
        expect(shouldShowVoxCard()).toBe(true);
    });

    it('an active Vox user never sees the card again', () => {
        dismissVoxCard();
        localStorage.setItem('practicepro_vox_card_dismissed_at', String(Date.now() - 30 * DAY));
        localStorage.setItem('practicepro_vox_last_used_at', String(Date.now() - 1 * DAY));
        expect(shouldShowVoxCard()).toBe(false);
    });

    it('stampVoxUsedAt/getters round-trip through storage', () => {
        const before = Date.now();
        stampVoxUsedAt();
        expect(getLastVoxUsedAt()).toBeGreaterThanOrEqual(before);
        dismissVoxCard();
        expect(getVoxCardDismissedAt()).toBeGreaterThanOrEqual(before);
    });

    it('injectable now drives the comparison (no clock flakiness)', () => {
        dismissVoxCard();
        const dismissedAt = getVoxCardDismissedAt();
        // Exactly 7 days minus one second → still hidden.
        expect(shouldShowVoxCard(dismissedAt + 7 * DAY - 1000)).toBe(false);
        // Past 7 days AND Vox never used → visible.
        expect(shouldShowVoxCard(dismissedAt + 7 * DAY + 1000)).toBe(true);
    });
});
