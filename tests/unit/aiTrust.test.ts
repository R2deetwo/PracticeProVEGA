/**
 * Item 3 regression suite — AI trust signals for ALOA/ARIA.
 *
 * THE GAP THIS LOCKS IN: ALOA/ARIA responses rendered as polished prose
 * with zero reliability signaling — a hedged guess, a hallucinated statute
 * and a well-sourced answer looked identical, unverified [3] markers looked
 * like real citations, and no AI output was recorded anywhere.
 *
 * A missing "hedged language downgrades confidence" or
 * "unverified [n] gets the warning marker" case means the fix is NOT in.
 */
import { describe, it, expect } from 'vitest';
import {
    assessConfidence,
    findCitationMarkers,
    findUnverifiedCitationNumbers,
    markUnverifiedCitationsInHtml,
    buildAiAuditPayload,
    AI_DISCLAIMER_SESSION_KEY,
    REVIEW_REQUIRED_TITLE,
} from '../../src/utils/aiTrust';

describe('assessConfidence — hedging & uncertainty', () => {
    it('self-reported inability to verify drags confidence to LOW', () => {
        const a = assessConfidence('I cannot verify the current status of this case as I don\'t have access to the court records.');
        expect(a.level).toBe('low');
        expect(a.indicators.some(i => i.includes('cannot verify'))).toBe(true);
    });

    it('hedging language lowers confidence', () => {
        const hedged = assessConfidence('I think the notice may be defective, and it appears the tenant possibly vacated earlier.');
        const plain = assessConfidence('The notice must comply with the Recovery of Premises Act.');
        expect(hedged.score).toBeLessThan(plain.score);
        expect(hedged.indicators.some(i => i.includes('hedging'))).toBe(true);
    });

    it('specificity anchors (statute + section + year) raise confidence', () => {
        const specific = assessConfidence('Under section 21 of the Recovery of Premises Act, a 1945 enactment, seven days notice is required.');
        expect(specific.level).toBe('high');
        expect(specific.indicators.some(i => i.includes('statutory section reference'))).toBe(true);
    });

    it('full citation coverage beats no citations', () => {
        const text = 'The rule was restated [1] and later distinguished [2].';
        const covered = assessConfidence(text, {
            citationMarkers: [1, 2], verifiedCitationNumbers: [1, 2],
        });
        const bare = assessConfidence(text, { citationMarkers: [1, 2], verifiedCitationNumbers: [] });
        expect(covered.score).toBeGreaterThan(bare.score);
        expect(bare.indicators.some(i => i.includes('no sources given'))).toBe(true);
    });

    it('levels respect the 70/40 thresholds and score stays 0..100', () => {
        const a = assessConfidence('Under section 5 of the Land Use Act of 1978, the Governor holds land in trust. Section 5 and section 28 both apply. See also cap. 202.');
        expect(a.score).toBeLessThanOrEqual(100);
        expect(a.level).toBe('high');
        const b = assessConfidence('It seems this might be correct generally, perhaps.');
        expect(b.level).not.toBe('high');
        expect(b.score).toBeGreaterThanOrEqual(0);
    });

    it('empty indicators never happen — plain response gets a neutral note', () => {
        const a = assessConfidence('Rent is collected monthly.');
        expect(a.indicators.length).toBeGreaterThan(0);
        expect(a.indicators[0]).toContain('no citations');
    });
});

describe('unverified citations', () => {
    it('findCitationMarkers collects inline [n] markers in order, deduped', () => {
        expect(findCitationMarkers('see [2] and [1], then [2] again')).toEqual([2, 1]);
        expect(findCitationMarkers('no markers here')).toEqual([]);
    });

    it('markers without a source entry are flagged as unverified', () => {
        expect(findUnverifiedCitationNumbers('cite [1] [2] [3]', [1, 3])).toEqual([2]);
        expect(findUnverifiedCitationNumbers('cite [1] [2] [3]', [1, 2, 3])).toEqual([]);
    });

    it('renders the ⚠ warning marker after unverified [n] in HTML', () => {
        const html = '<p>see [2] here</p>';
        const out = markUnverifiedCitationsInHtml(html, [2]);
        expect(out).toContain('[2]<sup data-unverified-citation="true"');
        expect(out).toContain('⚠');
        expect(out).toContain('Unverified citation');
    });

    it('NEVER injects inside HTML tags or attributes', () => {
        // href="[2]" is an attribute — must not be touched
        const html = '<a href="/x/[2]">link</a> and [2] in text';
        const out = markUnverifiedCitationsInHtml(html, [2]);
        expect(out).toContain('href="/x/[2]"');           // attribute untouched
        expect((out.match(/⚠/g) || []).length).toBe(1);   // exactly one marker
    });

    it('verified markers are left alone', () => {
        const html = '<p>safe [1]</p>';
        expect(markUnverifiedCitationsInHtml(html, [])).toBe('<p>safe [1]</p>');
        expect(markUnverifiedCitationsInHtml(html, [])).not.toContain('⚠');
    });

    it('multiple unverified markers each get exactly one warning', () => {
        const html = '<p>[1] ... [2] ... [1]</p>';
        const out = markUnverifiedCitationsInHtml(html, [1, 2]);
        expect((out.match(/data-unverified-citation/g) || []).length).toBe(3);
    });
});

describe('buildAiAuditPayload — audit normalization', () => {
    it('produces a bounded, PII-trimmed record', () => {
        const p = buildAiAuditPayload({
            assistant: 'ARIA',
            text: 'A'.repeat(2000),
            model: 'gemini-2.5-pro',
            conversationId: 'conv_123',
            confidence: { level: 'moderate', score: 55, indicators: [] },
            citationCount: 3,
            unverifiedCitationCount: 1,
        });
        expect(p.preview.length).toBeLessThanOrEqual(400);
        expect(p.charCount).toBe(2000);
        expect(p.confidenceLevel).toBe('moderate');
        expect(p.confidenceScore).toBe(55);
        expect(p.assistant).toBe('ARIA');
    });

    it('defaults are safe for sparse inputs', () => {
        const p = buildAiAuditPayload({ assistant: '', text: '' });
        expect(p.assistant).toBe('AI');
        expect(p.model).toBe('unknown');
        expect(p.confidenceLevel).toBe('unassessed');
        expect(p.confidenceScore).toBe(-1);
        expect(p.citationCount).toBe(0);
    });
});

describe('copy constants — the contract the UI renders', () => {
    it('disclaimer banner is scoped by a session key and never empty', () => {
        expect(AI_DISCLAIMER_SESSION_KEY).toBe('ai_disclaimer_acknowledged');
        expect(AI_DISCLAIMER_SESSION_KEY.length).toBeGreaterThan(0);
    });
    it('review-required title is stable', () => {
        expect(REVIEW_REQUIRED_TITLE).toBe('Review Required');
    });
});

// ─── V5 (legal AI reliability) — confidence semantics match the evidence ────
describe('V5 — confidence semantics match actual evidence', () => {
    it('uncertainty drags an otherwise highly-specific answer below HIGH', () => {
        // Specific anchors would push this to high on their own; two distinct
        // uncertainty signals must keep it honest.
        const text = 'Under section 21 CAMA 2020 and section 28 of the Land Use Act 1978, the consent regime applies [1]. However, I cannot verify the current filing fee, and the position is unverified as at today.';
        const a = assessConfidence(text, {
            citationMarkers: [1],
            verifiedCitationNumbers: [1],
        });
        expect(a.level).toBe('moderate');
        expect(a.level).not.toBe('high');
        expect(a.indicators.some(i => i.includes('cannot verify'))).toBe(true);
        expect(a.indicators.some(i => i.includes('unverified'))).toBe(true);
    });

    it('coverage language describes source MATCHING, never external verification', () => {
        const covered = assessConfidence('The rule was restated [1] and later distinguished [2].', {
            citationMarkers: [1, 2], verifiedCitationNumbers: [1, 2],
        });
        expect(covered.indicators).toContain('all 2 citation markers resolve to sources');
        // The heuristic never claims authority verification:
        for (const i of covered.indicators) {
            expect(i.toLowerCase()).not.toContain('externally verified');
            expect(i.toLowerCase()).not.toContain('authority verified');
        }
    });

    it('a citation-coverage miss is an evidence downgrade, not a formatting pass', () => {
        const half = assessConfidence('Claim A is settled [1] and Claim B is settled [2].', {
            citationMarkers: [1, 2], verifiedCitationNumbers: [1],
        });
        expect(half.indicators.some(i => i.includes('1/2 citation markers resolve to sources'))).toBe(true);
        expect(half.score).toBeLessThan(
            assessConfidence('Claim A is settled [1] and Claim B is settled [2].', {
                citationMarkers: [1, 2], verifiedCitationNumbers: [1, 2],
            }).score
        );
    });

    it('raw-text scoring contract: hedging must be present in the text the heuristic sees', () => {
        // AloaChat now scores the RAW model text (pre-identity-strip) — this
        // pins the heuristic's dependence on hedging vocabulary being intact.
        const hedged = 'I think the notice may be defective, and it appears the tenant possibly vacated earlier.';
        const stripped = 'The notice is defective, and the tenant vacated earlier.';
        expect(assessConfidence(hedged).score).toBeLessThan(assessConfidence(stripped).score);
    });
});
