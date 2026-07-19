export interface DraftSessionData {
  title: string;
  content: string;
  draftPrompt?: string;
  matterId?: string | null;
  documentId?: string | null;
  documentType?: string | null;
  // FIX 5b: Persist citations so they survive new-tab navigation and tab-close recovery
  citations?: any[];
  updatedAt: string;
  savedAt: number;
}

function storageKey(firmId: string, sessionKey: string) {
  return `draftpro:${firmId}:${sessionKey}`;
}

/**
 * Canonical draft key strategy:
 * - If documentId exists (editing a saved draft): use `draft:doc:${documentId}`
 * - Else: use `draft:${matterId}:${documentType}` — documentType is stable
 *   (e.g. "notice_to_quit", "affidavit") and known before generation starts.
 * - Fallback: `draft:general:untitled`
 */
export function getDraftKey(
  matterId?: string | null,
  documentType?: string | null,
  documentId?: string | null,
): string {
  if (documentId) return `draft:doc:${documentId}`;
  const m = matterId || 'general';
  const t = documentType || 'untitled';
  return `draft:${m}:${t}`;
}

/**
 * Slugify a free-form title into a stable documentType token.
 * "Tenancy Agreement (Lagos)" → "tenancy-agreement-lagos"
 * Returns undefined for empty/whitespace titles so the caller can fall back.
 */
function slugifyTitle(title?: string | null): string | undefined {
  if (!title) return undefined;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || undefined;
}

/** @deprecated Use getDraftKey() instead — kept for backward compat */
export function draftSessionKey(opts: {
  matterId?: string | null;
  title?: string;
  documentId?: string | null;
}): string {
  // IMPORTANT: include the slugified title so each ALOA-started draft gets
  // its own persistence key. Without this, all drafts without a matterId
  // collapse onto `draft:general:untitled` and overwrite each other —
  // which is also why "Open item in chat" used to re-draft instead of
  // loading the saved content.
  return getDraftKey(opts.matterId, slugifyTitle(opts.title), opts.documentId);
}

export function saveDraft(key: string, data: DraftSessionData, firmId: string): void {
  try {
    const full = { ...data, savedAt: Date.now() };
    localStorage.setItem(storageKey(firmId, key), JSON.stringify(full));
  } catch (e) {
    console.warn('[draftSession] save failed', e);
  }
}

/** @deprecated Use saveDraft() instead */
export function saveDraftSession(firmId: string, sessionKey: string, data: DraftSessionData): void {
  saveDraft(sessionKey, data, firmId);
}

export function loadDraft(key: string, firmId: string): DraftSessionData | null {
  try {
    const raw = localStorage.getItem(storageKey(firmId, key));
    if (!raw) return null;
    return JSON.parse(raw) as DraftSessionData;
  } catch {
    return null;
  }
}

/** @deprecated Use loadDraft() instead */
export function loadDraftSession(firmId: string, sessionKey: string): DraftSessionData | null {
  return loadDraft(sessionKey, firmId);
}

export function clearDraft(key: string, firmId: string): void {
  try {
    localStorage.removeItem(storageKey(firmId, key));
  } catch {
    /* ignore */
  }
}

/** @deprecated Use clearDraft() instead */
export function clearDraftSession(firmId: string, sessionKey: string): void {
  clearDraft(sessionKey, firmId);
}

/**
 * Auto-cleanup: scan localStorage for draftpro:* keys older than 7 days.
 * Call on app load to prevent stale drafts from accumulating.
 */
export function pruneStaleDrafts(firmId: string): number {
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();
  let pruned = 0;
  try {
    const prefix = `draftpro:${firmId}:`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.savedAt && (now - data.savedAt) > MAX_AGE_MS) {
          localStorage.removeItem(key);
          pruned++;
        }
      } catch {
        // Can't parse — leave it alone
      }
    }
  } catch {
    /* ignore */
  }
  return pruned;
}
