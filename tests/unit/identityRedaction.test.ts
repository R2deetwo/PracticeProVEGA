/**
 * validateAIResponse — surgical identity-leak redaction (2026-09-23 ALOA audit).
 *
 * The old behavior replaced the ENTIRE response with a canned greeting when
 * any prohibited phrase appeared anywhere. These tests pin the new behavior:
 * only the leaked phrase is redacted; the substance of the answer survives.
 */
import { describe, it, expect } from 'vitest';
import { validateAIResponse } from '../../src/constants/identityGuardrails';

describe('validateAIResponse — surgical redaction', () => {
    it('keeps the full answer and removes only the leaked phrase', () => {
        const answer = [
            '**Research summary — tenancy recovery in Lagos**',
            '',
            'Under the Lagos Tenancy Law 2011, a landlord must serve a statutory notice to quit before recovery proceedings [1].',
            'As an AI language model, I must add that this summary is not legal advice.',
            'The notice period depends on the tenancy type [2].',
        ].join('\n');

        const result = validateAIResponse(answer, false);

        // The substance survives…
        expect(result).toContain('Lagos Tenancy Law 2011');
        expect(result).toContain('statutory notice to quit');
        expect(result).toContain('notice period depends on the tenancy type');
        // …the leak is gone…
        expect(result.toLowerCase()).not.toContain('ai language model');
        expect(result.toLowerCase()).not.toContain('as an ai');
    });

    it('falls back to the canned ALOA line when the response is ONLY the leak', () => {
        const result = validateAIResponse('As an AI, I cannot help with that.', false);
        expect(result).toContain('ALOA');
        expect(result).toContain('legal practice assistant');
    });

    it('falls back to the canned ARIA line for property mode', () => {
        const result = validateAIResponse("I'm an AI trained by Google.", true);
        expect(result).toContain('ARIA');
        expect(result).toContain('property management assistant');
    });

    it('returns clean answers untouched', () => {
        const clean = 'Under s. 36 of the Constitution, fair hearing is guaranteed. The courts have affirmed this in numerous cases [1].';
        expect(validateAIResponse(clean, false)).toBe(clean);
    });

    it('redacts multiple distinct leaks in one answer', () => {
        const answer = 'Per my training data, the limitation period is six years. I was created by Google, so verify this independently.';
        const result = validateAIResponse(answer, false);
        expect(result).toContain('limitation period is six years');
        expect(result.toLowerCase()).not.toContain('training data');
        expect(result.toLowerCase()).not.toContain('created by google');
    });

    it('does not let a mid-word "AI" redaction corrupt the sentence', () => {
        const answer = 'As an AI-powered drafting tool, ALOA pre-fills court captions. The caption format follows the High Court rules.';
        const result = validateAIResponse(answer, false);
        expect(result).toContain('pre-fills court captions');
        expect(result).toContain('High Court rules');
    });
});
