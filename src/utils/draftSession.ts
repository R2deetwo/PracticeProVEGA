export interface DraftSessionData {
  title: string;
  content: string;
  draftPrompt?: string;
  matterId?: string | null;
  documentId?: string | null;
  updatedAt: string;
}

function storageKey(firmId: string, sessionKey: string) {
  return `draftpro:${firmId}:${sessionKey}`;
}

export function draftSessionKey(opts: {
  matterId?: string | null;
  title?: string;
  documentId?: string | null;
}) {
  const base = opts.documentId || `${opts.matterId || 'general'}:${(opts.title || 'untitled').slice(0, 80).replace(/\s+/g, '-')}`;
  return base;
}

export function saveDraftSession(firmId: string, sessionKey: string, data: DraftSessionData): void {
  try {
    localStorage.setItem(storageKey(firmId, sessionKey), JSON.stringify(data));
  } catch (e) {
    console.warn('[draftSession] save failed', e);
  }
}

export function loadDraftSession(firmId: string, sessionKey: string): DraftSessionData | null {
  try {
    const raw = localStorage.getItem(storageKey(firmId, sessionKey));
    if (!raw) return null;
    return JSON.parse(raw) as DraftSessionData;
  } catch {
    return null;
  }
}

export function clearDraftSession(firmId: string, sessionKey: string): void {
  try {
    localStorage.removeItem(storageKey(firmId, sessionKey));
  } catch {
    /* ignore */
  }
}
