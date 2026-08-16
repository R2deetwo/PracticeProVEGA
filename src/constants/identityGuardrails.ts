
/**
 * ARIA® — Identity Guardrails & Capability Manifests
 *
 * These prompts are injected at the VERY TOP of every system instruction
 * to prevent the model from ever defaulting to generic Gemini/Google identity.
 *
 * PLACEMENT: MUST be the FIRST content in the system instruction — before ANY
 * context, RAG data, or tool descriptions.
 *
 * ICM: The canonical source of truth is now the markdown files:
 *   - ai/prompts/03a-aloa-identity-guardrail.md (Vega)
 *   - ai/prompts/03b-aria-identity-guardrail.md (Atrium)
 * Loaded via src/constants/loadPrompts.ts (Vite ?raw imports).
 * The code constants below are kept as a fallback for safety.
 */

import { renderIdentityGuardrail, PROMPTS } from './loadPrompts';

// ─────────────────────────────────────────────────────────────────────────────
// ALOA — Advanced Legal Office Assistant (Vega OS)
// ICM: Source of truth is ai/prompts/03a-aloa-identity-guardrail.md
// ─────────────────────────────────────────────────────────────────────────────
export const ALOA_IDENTITY_GUARDRAIL = PROMPTS.aloaGuardrail;

// ─────────────────────────────────────────────────────────────────────────────
// ARIA — Asset & Revenue Intelligence Assistant (Atrium OS)
// ICM: Source of truth is ai/prompts/03b-aria-identity-guardrail.md
// ─────────────────────────────────────────────────────────────────────────────
export const ARIA_IDENTITY_GUARDRAIL = PROMPTS.ariaGuardrail;

/**
 * Dynamic identity guardrail selector — returns the correct identity lock
 * prompt based on the current product mode.
 *
 * Use this as the single entry point when building system instructions.
 * Consumers should call `getIdentityGuardrail(isProperty)` instead of
 * importing `ALOA_IDENTITY_GUARDRAIL` or `ARIA_IDENTITY_GUARDRAIL` directly,
 * which ensures the correct product identity is always selected.
 */
export const getIdentityGuardrail = (isProperty: boolean): string => {
    return isProperty ? ARIA_IDENTITY_GUARDRAIL : ALOA_IDENTITY_GUARDRAIL;
};

/**
 * Post-generation validator: Strips any accidental generic AI leakage
 * from ARIA responses before they are shown to the user.
 */
export const validateAIResponse = (
    response: string,
    isProperty: boolean
): string => {
    const prohibitedPhrases = [
        "large language model",
        "trained by Google",
        "Google Gemini",
        "as an AI",
        "as a language model",
        "I'm a large language model",
        "I am a large language model",
        "my training data",
        "my knowledge cutoff",
        "I don't have personal experiences",
        "I cannot perform physical actions",
        "I exist only as software",
        "I was created by",
        "I was trained by",
        "I am an AI",
        "I'm an AI",
        "as an artificial intelligence",
    ];

    const lowerResponse = response.toLowerCase();
    const hasLeak = prohibitedPhrases.some(phrase =>
        lowerResponse.includes(phrase.toLowerCase())
    );

    if (hasLeak) {
        return isProperty
            ? "I'm ARIA, your property management assistant within PracticePro Atrium. How can I help with your portfolio? I can assist with revenue monitoring, residents management, property tracking, and more."
            : "I'm ALOA, your legal practice assistant within PracticePro Vega. How can I help with your practice? I can assist with matter management, legal drafting, client relations, and more.";
    }

    return response;
};
