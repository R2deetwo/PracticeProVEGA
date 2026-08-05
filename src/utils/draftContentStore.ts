/**
 * draftContentStore — module-level temporary store for passing draft content
 * from ALOA chat to DraftPro.
 *
 * PROBLEM:
 *   React Router's `navigate(path, { state: context })` doesn't reliably
 *   preserve `location.state` in Capacitor's webview. When the user taps
 *   "Draft in DraftPro", the draft content (HTML, title, citations) is
 *   passed via `location.state`, but WordProcessor reads `location.state`
 *   which can be null — so the editor opens empty.
 *
 * SOLUTION:
 *   This module-level store holds the pending draft config. When
 *   `handleDraftInDraftPro` is called, it saves the config here AND
 *   navigates to the editor. WordProcessor reads from this store as a
 *   fallback when `location.state` is null.
 *
 *   The store is cleared after WordProcessor reads it, so it doesn't
 *   leak between sessions.
 */

export interface PendingDraftConfig {
    draftTitle?: string;
    draftContent?: string;
    draftPrompt?: string;
    disableAutoDraft?: boolean;
    openedByAloa?: boolean;
    citations?: any;
    matterId?: string;
    autoStartDrafting?: boolean;
}

let pendingDraft: PendingDraftConfig | null = null;

/**
 * Save a pending draft config. Called by ALOA's "Draft in DraftPro"
 * handler before navigating to the editor.
 */
export function setPendingDraft(config: PendingDraftConfig): void {
    pendingDraft = config;
}

/**
 * Read and clear the pending draft config. Called by WordProcessor
 * on mount. Returns null if no pending draft exists.
 */
export function getAndClearPendingDraft(): PendingDraftConfig | null {
    const draft = pendingDraft;
    pendingDraft = null;
    return draft;
}

/**
 * Check if a pending draft exists without clearing it.
 */
export function hasPendingDraft(): boolean {
    return pendingDraft !== null;
}
