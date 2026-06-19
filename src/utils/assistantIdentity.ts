/**
 * ALOA / ARIA — Central Naming Authority
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PracticePro uses TWO distinct AI assistant identities depending on the
 * product context. This file is the SINGLE SOURCE OF TRUTH for the names,
 * abbreviations, and full definitions. Every user-facing string in the app
 * must import from here — NEVER hardcode "ALOA" or "ARIA" directly.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PRODUCT        │ ABBREVIATION │ FULL NAME                           │
 * ├────────────────────────────────┼─────────────────────────────────────┤
 * │  Vega (Legal)  │ ALOA         │ Advanced Legal Office Assistant     │
 * │  Atrium (Prop) │ ARIA         │ Asset & Revenue Intelligence Asst   │
 * │  Komplete      │ ALOA / ARIA  │ Both (context-dependent)            │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * INTERNAL CODE NOTE: Variable names, file names, and hook names (useAloa,
 * AloaProvider, AloaChat, etc.) are INTERNAL and do NOT change — they're
 * shared infrastructure. Only the USER-FACING display name changes based
 * on the active product. This is similar to how a white-label product works.
 */

/**
 * Returns the correct assistant display name for the current product.
 * - Legal (Vega) → "ALOA"
 * - Property (Atrium) → "ARIA"
 * - Unified (Komplete) → "ARIA" (default; legal views can override)
 */
export function getAssistantName(isProperty: boolean): string {
    return isProperty ? 'ARIA' : 'ALOA';
}

/**
 * Returns the FULL unabbreviated name for the current product.
 * - Legal → "Advanced Legal Office Assistant"
 * - Property → "Asset & Revenue Intelligence Assistant"
 */
export function getAssistantFullName(isProperty: boolean): string {
    return isProperty
        ? 'Asset & Revenue Intelligence Assistant'
        : 'Advanced Legal Office Assistant';
}

/**
 * Returns a short tagline for use under the assistant name in headers.
 * - Legal → "Advanced Legal Office Assistant"
 * - Property → "Asset & Revenue Intelligence Assistant"
 */
export function getAssistantTagline(isProperty: boolean): string {
    return getAssistantFullName(isProperty);
}

/**
 * Returns the correct placeholder text for the chat input.
 * - Legal → "Ask ALOA about your practice…"
 * - Property → "Ask ARIA about your properties…"
 */
export function getChatPlaceholder(isProperty: boolean): string {
    return isProperty
        ? 'Ask ARIA about your properties…'
        : 'Ask ALOA about your practice…';
}

/**
 * Returns the product context label for AI system prompts.
 * - Legal → "Vega (Legal Practice Management)"
 * - Property → "Atrium (Property Management)"
 */
export function getProductContextLabel(isProperty: boolean): string {
    return isProperty ? 'Atrium (Property Management)' : 'Vega (Legal Practice Management)';
}
