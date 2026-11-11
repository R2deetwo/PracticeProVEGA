/**
 * validateAIResponse — identity-leak redaction that RETAINS hedging.
 *
 * V5 (legal AI reliability): the strip list used to delete the model's
 * honest uncertainty vocabulary ("my knowledge cutoff", "my training data",
 * "as an AI", …) — stripping the very hedging the trust contract depends
 * on, and inflating the confidence heuristic (which AloaChat now scores on
 * the raw text). These tests pin the SPLIT: model-identity leaks are
 * redacted; genuine uncertainty language survives.
 */
import { describe, it, expect } from 'vitest';
import { validateAIResponse } from '../../src/constants/identityGuardrails';

describe('validateAIResponse — identity leaks still redacted', () => {
    it('keeps the full answer and removes only the leaked phrase', () => {
        const answer = [
            '**Research summary — tenancy recovery in Lagos**',
            '',
            'Under the Lagos Tenancy Law 2011, a landlord must serve a statutory notice to quit before recovery proceedings [1].',
            'As a large language model, I must add that this summary is not legal advice.',
            'The notice period depends on the tenancy type [2].',
        ].join('\n');

        const result = validateAIResponse(answer, false);

        // The substance survives…
        expect(result).toContain('Lagos Tenancy Law 2011');
        expect(result).toContain('statutory notice to quit');
        expect(result).toContain('notice period depends on the tenancy type');
        // …the model-identity leak is gone…
        expect(result.toLowerCase()).not.toContain('large language model');
    });

    it('falls back to the canned ALOA line when the response is ONLY the leak', () => {
        const result = validateAIResponse('I am a large language model.', false);
        expect(result).toContain('ALOA');
        expect(result).toContain('legal practice assistant');
    });

    it('falls back to the canned ARIA line for property mode', () => {
        const result = validateAIResponse("I'm a large language model trained by Google.", true);
        expect(result).toContain('ARIA');
        expect(result).toContain('property management assistant');
    });

    it('returns clean answers untouched', () => {
        const clean = 'Under s. 36 of the Constitution, fair hearing is guaranteed. The courts have affirmed this in numerous cases [1].';
        expect(validateAIResponse(clean, false)).toBe(clean);
    });

    it('redacts multiple distinct identity leaks in one answer', () => {
        const answer = 'I was trained by Google, so verify this independently.';
        const result = validateAIResponse(answer, false);
        expect(result.toLowerCase()).not.toContain('trained by google');
    });
});

describe('validateAIResponse — hedging is RETAINED (V5)', () => {
    it('"as an AI" uncertainty survives the strip', () => {
        const answer = 'As an AI, I cannot verify the current filing fee — confirm it against the current rules of court.';
        const result = validateAIResponse(answer, false);
        expect(result).toContain('As an AI');
        expect(result).toContain('cannot verify the current filing fee');
    });

    it('"my knowledge cutoff" survives the strip', () => {
        const answer = 'Because of my knowledge cutoff, I cannot confirm post-2024 amendments to the rules.';
        const result = validateAIResponse(answer, false);
        expect(result).toContain('my knowledge cutoff');
        expect(result).toContain('cannot confirm post-2024 amendments');
    });

    it('"my training data" survives the strip', () => {
        const answer = 'Per my training data, the limitation period is six years in some states — verify this for your state.';
        const result = validateAIResponse(answer, false);
        expect(result).toContain('my training data');
        expect(result).toContain('limitation period is six years');
    });

    it('a hedged answer is never gutted into the canned fallback', () => {
        const answer = 'I think the notice may be defective, and it appears the tenant possibly vacated earlier. I cannot verify this from the record — please check the registry file before serving.';
        const result = validateAIResponse(answer, false);
        expect(result).toContain('I think the notice may be defective');
        expect(result).not.toContain('How can I help with your practice');
    });

    it('an identity leak inside an otherwise hedged answer removes only the identity part', () => {
        const answer = 'I must note: as a language model I cannot verify this section number. Please confirm it against the current rules.';
        const result = validateAIResponse(answer, false);
        // the "language model" identity leak is stripped…
        expect(result.toLowerCase()).not.toContain('language model');
        // …while the honest uncertainty MEANING survives the sentence.
        expect(result).toContain('I cannot verify this section number');
        expect(result).toContain('Please confirm it against the current rules');
    });
});
