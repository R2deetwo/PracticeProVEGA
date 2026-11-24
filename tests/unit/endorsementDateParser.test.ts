/**
 * endorsementDateParser — the one-click "+ Task / + Event" date extraction
 * behind the matter endorsement composer (owner brief 2026-11-24). Locks the
 * parsing rules: Nigerian day-first numerics, month-forced flips, plain
 * English dates, relative words, time-of-day, and the title derivation.
 */
import { describe, it, expect } from 'vitest';
import {
    extractDatedMention,
    formatDatedMention,
    endorsementTitleFrom,
} from '../../src/utils/endorsementDateParser';

const NOW = new Date(2026, 10, 24, 10, 0, 0); // Tue 24 Nov 2026, 10:00 local

describe('extractDatedMention', () => {
    it('parses Nigerian day-first dd/mm/yyyy', () => {
        const m = extractDatedMention('File the defence before 12/03/2027.', NOW);
        expect(m).not.toBeNull();
        expect(m!.date.getFullYear()).toBe(2027);
        expect(m!.date.getMonth()).toBe(2); // March
        expect(m!.date.getDate()).toBe(12);
        expect(m!.matched).toBe('12/03/2027');
    });

    it('flips to month-first when the numbers force it', () => {
        const m = extractDatedMention('Hearing 03/25/2027 per the notice.', NOW);
        expect(m).not.toBeNull();
        expect(m!.date.getMonth()).toBe(2); // March
        expect(m!.date.getDate()).toBe(25);
    });

    it('parses "12th of March 2027"', () => {
        const m = extractDatedMention('Matter adjourned to the 12th of March 2027.', NOW);
        expect(m).not.toBeNull();
        expect(m!.date.getMonth()).toBe(2);
        expect(m!.date.getDate()).toBe(12);
        expect(m!.date.getFullYear()).toBe(2027);
    });

    it('parses "March 12, 2027"', () => {
        const m = extractDatedMention('Court fixed March 12, 2027 for mention.', NOW);
        expect(m).not.toBeNull();
        expect(m!.date.getMonth()).toBe(2);
        expect(m!.date.getDate()).toBe(12);
    });

    it('parses a time-of-day riding along', () => {
        const m = extractDatedMention('Mention on 12/03/2027 at 2:30pm.', NOW);
        expect(m).not.toBeNull();
        expect(m!.timeMinutes).toBe(14 * 60 + 30);
    });

    it('reads a bare hour ("by 9am")', () => {
        const m = extractDatedMention('Serve process on 12/03/2027 by 9am.', NOW);
        expect(m).not.toBeNull();
        expect(m!.timeMinutes).toBe(9 * 60);
    });

    it('parses 24-hour times', () => {
        const m = extractDatedMention('Call at 14:30 on 12/03/2027.', NOW);
        expect(m).not.toBeNull();
        expect(m!.timeMinutes).toBe(14 * 60 + 30);
    });

    it('day+month without a year resolves to the NEXT future occurrence', () => {
        const m = extractDatedMention('Renew the lease on 15 January.', NOW);
        expect(m).not.toBeNull();
        expect(m!.date.getFullYear()).toBe(2027);
        expect(m!.date.getMonth()).toBe(0);
        expect(m!.date.getDate()).toBe(15);
    });

    it('a past day+month this year rolls to next year', () => {
        const m = extractDatedMention('Review after 5 February.', NOW);
        expect(m!.date.getFullYear()).toBe(2027);
    });

    it('parses relative words', () => {
        expect(extractDatedMention('Call the client tomorrow.', NOW)!.date.getDate()).toBe(25);
        expect(extractDatedMention('Serve today.', NOW)!.date.getDate()).toBe(24);
        expect(extractDatedMention('File next week.', NOW)!.date.getDate()).toBe(1); // 1 Dec 2026
    });

    it('returns null when no date is spoken', () => {
        expect(extractDatedMention('Client confirmed instructions by phone.', NOW)).toBeNull();
        expect(extractDatedMention('', NOW)).toBeNull();
    });

    it('a two-digit year maps into the current century without crashing', () => {
        // 12/03/77 → year 2077 under the +2000 rule — parsed, never thrown.
        const m = extractDatedMention('Old entry 12/03/77.', NOW);
        expect(m).not.toBeNull();
        expect(m!.date.getFullYear()).toBe(2077);
    });
});

describe('formatDatedMention', () => {
    it('includes the time when spoken', () => {
        const m = extractDatedMention('Mention 12/03/2027 at 2:30pm.', NOW)!;
        expect(formatDatedMention(m)).toBe('Fri 12 Mar, 2:30 PM');
    });

    it('date-only otherwise', () => {
        const m = extractDatedMention('File by 12/03/2027.', NOW)!;
        expect(formatDatedMention(m)).toBe('Fri 12 Mar');
    });
});

describe('endorsementTitleFrom', () => {
    it('takes the first non-empty line, strips HTML, collapses whitespace', () => {
        expect(endorsementTitleFrom('  <p>Court granted the adjourned date.</p>\nSecond line.  ')).toBe('Court granted the adjourned date.');
    });

    it('truncates at 90 characters with an ellipsis', () => {
        const long = 'A'.repeat(120);
        const t = endorsementTitleFrom(long);
        expect(t.length).toBe(91); // 90 + ellipsis char
        expect(t.endsWith('…')).toBe(true);
    });

    it('falls back to a generic title for empty content', () => {
        expect(endorsementTitleFrom('   \n  ')).toBe('Case endorsement');
    });
});
