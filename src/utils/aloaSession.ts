/**
 * aloaSession — lightweight localStorage-backed session persistence for ALOA.
 *
 * Remembers the last active conversation ID and message draft per "context key"
 * (e.g. matterId, draftSessionKey, or 'global'). When the user navigates away
 * and returns to the same context, the ALOA panel can rehydrate the conversation
 * instead of starting fresh.
 *
 * Schema (localStorage):
 *   practicepro:aloa:session:<contextKey> = {
 *     conversationId: string,
 *     lastMessageAt: number,
 *     draftInput?: string,
 *   }
 *
 * Also tracks the "global" last-active conversation so the ALOA FAB can show
 * the most recent conversation when no specific context is active.
 */

const PREFIX = 'practicepro:aloa:session:';

export interface AloaSession {
  conversationId: string;
  lastMessageAt: number;
  draftInput?: string;
}

export function saveAloaSession(contextKey: string, session: AloaSession): void {
  try {
    localStorage.setItem(PREFIX + contextKey, JSON.stringify(session));
    // Also update the global pointer
    localStorage.setItem(PREFIX + 'global', JSON.stringify(session));
  } catch (e) {
    console.warn('[aloaSession] save failed', e);
  }
}

export function loadAloaSession(contextKey: string): AloaSession | null {
  try {
    const raw = localStorage.getItem(PREFIX + contextKey);
    if (!raw) return null;
    return JSON.parse(raw) as AloaSession;
  } catch {
    return null;
  }
}

export function loadGlobalAloaSession(): AloaSession | null {
  try {
    const raw = localStorage.getItem(PREFIX + 'global');
    if (!raw) return null;
    return JSON.parse(raw) as AloaSession;
  } catch {
    return null;
  }
}

export function clearAloaSession(contextKey: string): void {
  try {
    localStorage.removeItem(PREFIX + contextKey);
  } catch { /* ignore */ }
}

/**
 * Derive a stable context key from the current app state.
 * Priority: matterId > draftSessionKey > 'global'
 */
export function deriveAloaContextKey(opts: {
  matterId?: string | null;
  draftSessionKey?: string | null;
  view?: string;
}): string {
  if (opts.matterId) return `matter:${opts.matterId}`;
  if (opts.draftSessionKey) return `draft:${opts.draftSessionKey}`;
  return 'global';
}
