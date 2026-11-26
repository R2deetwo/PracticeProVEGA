/**
 * Round 19 — Court Mode draft persistence hook.
 *
 * sessionStorage-backed (survives panel close/reopen and page reload);
 * every storage call is guarded so the UI still works with storage
 * unavailable; writes are debounced 400ms and flushed synchronously on
 * unmount + pagehide so closing never loses text. Text only — NEVER audio.
 *
 * Keys:  courtmode:v1:drafts:<userId>  — per-matter endorsement drafts
 *        courtmode:v1:scope:<userId>   — the chosen DiaryScope ('mine' default)
 *
 * Cleared on save success / explicit discard (clearDraft below) and on
 * sign-out (AuthContext logout purges every courtmode:v1: key).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { DiaryScope } from "../courtModeUtils";
import { parseDrafts, serializeDrafts, StoredCourtDraft } from "./courtDrafts";

const DRAFTS_KEY_PREFIX = "courtmode:v1:drafts:";
const SCOPE_KEY_PREFIX = "courtmode:v1:scope:";
const WRITE_DEBOUNCE_MS = 400;

export const COURT_MODE_STORAGE_PREFIX = "courtmode:v1:";

export interface CourtDraftsApi {
  /** The hydrated per-matter draft record (re-hydrated on every mount). */
  drafts: Record<string, StoredCourtDraft>;
  /** The persisted DiaryScope ('mine' by default). */
  scope: DiaryScope;
  /** Persist a draft for one matter (or clear it with null / empty text). */
  setDraft: (matterId: string, draft: StoredCourtDraft | null) => void;
  /** Alias for setDraft(id, null) — explicit discard. */
  clearDraft: (matterId: string) => void;
  /** Persist the diary scope choice. */
  setScope: (scope: DiaryScope) => void;
}

export function useCourtDrafts(userId: string): CourtDraftsApi {
  const draftsKey = DRAFTS_KEY_PREFIX + userId;
  const scopeKey = SCOPE_KEY_PREFIX + userId;
  const [drafts, setDrafts] = useState<Record<string, StoredCourtDraft>>({});
  const [scope, setScopeState] = useState<DiaryScope>("mine");
  const writeTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<Record<string, StoredCourtDraft> | null>(null);

  // Hydrate on mount / user change. Storage failures degrade to "no drafts".
  useEffect(() => {
    let hydratedDrafts: Record<string, StoredCourtDraft> = {};
    let hydratedScope: DiaryScope = "mine";
    try {
      hydratedDrafts = parseDrafts(sessionStorage.getItem(draftsKey), Date.now());
      const storedScope = sessionStorage.getItem(scopeKey);
      if (storedScope === "mine" || storedScope === "firm") hydratedScope = storedScope;
    } catch {
      /* storage unavailable — empty state is fine */
    }
    setDrafts(hydratedDrafts);
    setScopeState(hydratedScope);

    // Flush any pending debounced write synchronously when the consumer
    // unmounts (panel close) or the page is being torn down (reload).
    const flush = () => {
      if (writeTimerRef.current == null) return;
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
      const pending = pendingRef.current;
      if (!pending) return;
      try {
        sessionStorage.setItem(draftsKey, serializeDrafts(pending));
      } catch {
        /* best effort */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [draftsKey, scopeKey]);

  const persist = useCallback(
    (record: Record<string, StoredCourtDraft>) => {
      pendingRef.current = record;
      if (writeTimerRef.current != null) window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = window.setTimeout(() => {
        writeTimerRef.current = null;
        const toWrite = pendingRef.current;
        if (!toWrite) return;
        try {
          sessionStorage.setItem(draftsKey, serializeDrafts(toWrite));
        } catch {
          /* storage unavailable — drafts live in state until unmount */
        }
      }, WRITE_DEBOUNCE_MS);
    },
    [draftsKey],
  );

  const setDraft = useCallback(
    (matterId: string, draft: StoredCourtDraft | null) => {
      if (!matterId) return;
      setDrafts((previous) => {
        const next = { ...previous };
        if (!draft || !draft.text.trim()) {
          delete next[matterId];
        } else {
          next[matterId] = draft;
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearDraft = useCallback((matterId: string) => setDraft(matterId, null), [setDraft]);

  const setScope = useCallback(
    (next: DiaryScope) => {
      setScopeState(next);
      try {
        sessionStorage.setItem(scopeKey, next);
      } catch {
        /* storage unavailable — scope still applies for this session */
      }
    },
    [scopeKey],
  );

  return { drafts, scope, setDraft, clearDraft, setScope };
}
