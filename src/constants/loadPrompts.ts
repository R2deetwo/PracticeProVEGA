/**
 * src/constants/loadPrompts.ts — ICM (Interpretable Context Methodology) loader.
 *
 * This module implements Jake Van Clief's ICM pattern: markdown files are the
 * source of truth for AI prompts, and this loader reads them at build time via
 * Vite's `?raw` import suffix. Editing the .md files and rebuilding is
 * sufficient; no code changes are needed for routine prompt edits.
 *
 * Wired up (ICM-complete):
 *   - 03a-aloa-identity-guardrail.md → ALOA_IDENTITY_GUARDRAIL (Vega)
 *   - 03b-aria-identity-guardrail.md → ARIA_IDENTITY_GUARDRAIL (Atrium)
 *   - 04-interactive-form-protocol.md → getInteractiveFormDelegationProtocol()
 *
 * Pending migration (per Van Clief ICM Audit Report):
 *   - 01-aloa-legal-identity.md (has runtime interpolation — needs render layer)
 *   - 02-aria-property-identity.md (has runtime interpolation — needs render layer)
 *   - 05-precision-protocol.md (will be split into 05a/05b/05c — 3 variants)
 *
 * The loader is ~20 lines of TypeScript. No plugins required.
 */

// Vite ?raw imports — markdown files are bundled as strings at build time.
import aloaGuardrail from '../../ai/prompts/03a-aloa-identity-guardrail.md?raw';
import ariaGuardrail from '../../ai/prompts/03b-aria-identity-guardrail.md?raw';
import formProtocol from '../../ai/prompts/04-interactive-form-protocol.md?raw';

export const PROMPTS = {
  aloaGuardrail,
  ariaGuardrail,
  formProtocol,
} as const;

/**
 * Render the interactive form protocol with the appropriate slider examples
 * for the current product mode.
 *
 * @param isAtriumMode - true for Atrium (property), false for Vega (legal)
 * @returns the rendered protocol string, ready to append to a system instruction
 */
export function renderFormProtocol(isAtriumMode: boolean): string {
  const sliderExamples = isAtriumMode
    ? 'agency fee %, commission %'
    : 'legal fee %, agency fee %';
  return PROMPTS.formProtocol.replace('{{sliderExamples}}', sliderExamples);
}

/**
 * Get the identity guardrail for the current product mode.
 * Replaces the getIdentityGuardrail() function in constants/identityGuardrails.ts.
 *
 * @param isProperty - true for Atrium (property), false for Vega (legal)
 * @returns the guardrail string to inject at the top of the system instruction
 */
export function renderIdentityGuardrail(isProperty: boolean): string {
  return isProperty ? PROMPTS.ariaGuardrail : PROMPTS.aloaGuardrail;
}
