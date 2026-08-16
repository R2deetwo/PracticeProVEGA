/**
 * src/constants/loadPrompts.ts — ICM (Interpretable Context Methodology) loader.
 *
 * This module implements Jake Van Clief's ICM pattern: markdown files are the
 * source of truth for AI prompts, and this loader reads them at build time via
 * Vite's `?raw` import suffix. Editing the .md files and rebuilding is
 * sufficient; no code changes are needed for routine prompt edits.
 *
 * Currently wired up (proof-of-concept):
 *   - 04-interactive-form-protocol.md → used by AgencyHub.getInteractiveFormDelegationProtocol()
 *
 * Pending migration (per Van Clief ICM Audit Report):
 *   - 01-aloa-legal-identity.md
 *   - 02-aria-property-identity.md
 *   - 03-identity-guardrail.md
 *   - 05-precision-protocol.md (will be split into 05a/05b/05c)
 *
 * The loader is ~10 lines of TypeScript. No plugins required.
 */

// Vite ?raw imports — markdown files are bundled as strings at build time.
import formProtocol from '../../ai/prompts/04-interactive-form-protocol.md?raw';

export const PROMPTS = {
  formProtocol,
} as const;

/**
 * Render the interactive form protocol with the appropriate slider examples
 * for the current product mode. This is the only prompt that needs runtime
 * interpolation today; the others are static strings.
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
