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
import aloaIdentity from '../../ai/prompts/01-aloa-legal-identity.md?raw';
import ariaIdentity from '../../ai/prompts/02-aria-property-identity.md?raw';
import aloaGuardrail from '../../ai/prompts/03a-aloa-identity-guardrail.md?raw';
import ariaGuardrail from '../../ai/prompts/03b-aria-identity-guardrail.md?raw';
import formProtocol from '../../ai/prompts/04-interactive-form-protocol.md?raw';

export const PROMPTS = {
  aloaIdentity,
  ariaIdentity,
  aloaGuardrail,
  ariaGuardrail,
  formProtocol,
} as const;

/**
 * Render the interactive form protocol with the appropriate slider examples
 * for the current product mode.
 */
export function renderFormProtocol(isAtriumMode: boolean): string {
  const sliderExamples = isAtriumMode
    ? 'agency fee %, commission %'
    : 'legal fee %, agency fee %';
  return PROMPTS.formProtocol.replace('{{sliderExamples}}', sliderExamples);
}

/**
 * Get the identity guardrail for the current product mode.
 */
export function renderIdentityGuardrail(isProperty: boolean): string {
  return isProperty ? PROMPTS.ariaGuardrail : PROMPTS.aloaGuardrail;
}

/**
 * Render the ALOA (Vega legal) system instruction with runtime placeholders.
 * Replaces the inline 70-line string in AgencyHub.ts:260-328.
 */
export function renderAloaIdentity(params: {
  userName: string;
  userRole: string;
  currentView: string;
  selectedId: string;
  currentTime: string;
}): string {
  return PROMPTS.aloaIdentity
    .replace(/{{assistantName}}/g, 'ALOA')
    .replace(/{{userName}}/g, params.userName)
    .replace(/{{userRole}}/g, params.userRole)
    .replace(/{{currentView}}/g, params.currentView)
    .replace(/{{selectedId}}/g, params.selectedId)
    .replace(/{{currentTime}}/g, params.currentTime);
}

/**
 * Render the ARIA (Atrium property) system instruction with runtime placeholders.
 * Replaces the inline string in PropertyManagementAgent.ts:19-84.
 */
export function renderAriaIdentity(params: {
  userName: string;
  userRole: string;
  currentView: string;
  selectedId: string;
  currentTime: string;
  propertySummary: string;
}): string {
  return PROMPTS.ariaIdentity
    .replace(/{{userName}}/g, params.userName)
    .replace(/{{userRole}}/g, params.userRole)
    .replace(/{{currentView}}/g, params.currentView)
    .replace(/{{selectedId}}/g, params.selectedId)
    .replace(/{{currentTime}}/g, params.currentTime)
    .replace(/{{propertySummary}}/g, params.propertySummary);
}
