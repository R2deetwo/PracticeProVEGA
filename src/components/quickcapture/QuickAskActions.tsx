/**
 * QuickAskActions — confirmation cards for items Quick Ask CREATED (owner
 * spec 2026-11-18 §5: "Whenever Quick Ask creates or updates an item,
 * display a clean confirmation card with a 1-tap link to view or undo it").
 *
 * One card per executed action:
 *   - "Added to Diary: <title> · <date> at <time>" → View (calendar) / Undo
 *   - "Saved Case Note: <title>" (+ matter)        → View (matter) / Undo
 *
 * Undo calls the backend undoQuickAskAction mutation, which re-verifies
 * firm scope, creator ownership and a 15-minute recency window before
 * deleting — nothing a colleague created, nothing old, can be undone here.
 *
 * Used by BOTH Quick Ask surfaces: the ask bar on QuickCaptureView and the
 * question destination on the TriageCard.
 */

import React, { useState } from "react";
import { Button } from "../ui/Button";
import { CalendarIcon, CheckIcon, DocumentTextIcon } from "../../constants";
import { useUI } from "../../contexts/UIContext";
import {
  undoQuickAskAction,
  type QuickAskActionResult,
} from "../../services/voice/voiceCaptureService";

export const QuickAskActions: React.FC<{
  actions: QuickAskActionResult[];
  /** Optional: after ALL actions are undone, reset the whole result. */
  onAllUndone?: () => void;
}> = ({ actions, onAllUndone }) => {
  const { addToast, navigateTo } = useUI();
  const [undoneIds, setUndoneIds] = useState<Set<string>>(new Set());
  const [undoingId, setUndoingId] = useState<string | null>(null);

  if (!actions || actions.length === 0) return null;

  const handleUndo = async (action: QuickAskActionResult) => {
    if (undoingId) return;
    setUndoingId(action.itemId);
    try {
      await undoQuickAskAction(action.type, action.itemId);
      const next = new Set(undoneIds);
      next.add(action.itemId);
      setUndoneIds(next);
      addToast(
        action.type === "event" ? "Diary entry removed." : "Case note removed.",
        { type: "success" }
      );
      if (next.size === actions.length) onAllUndone?.();
    } catch (err: any) {
      addToast(err?.message || "Could not undo — the 15-minute window may have passed.", {
        type: "error",
      });
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Quick Ask actions taken">
      {actions.map((action) => {
        if (undoneIds.has(action.itemId)) return null;
        const isEvent = action.type === "event";
        return (
          <div
            key={action.itemId}
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-3"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white shrink-0">
              {isEvent ? <CalendarIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {isEvent ? "Added to Diary" : "Saved Case Note"}
                {action.matterTitle ? (
                  <span className="font-normal text-slate-600"> — {action.matterTitle}</span>
                ) : null}
              </p>
              <p className="text-xs text-slate-600 leading-snug mt-0.5">
                {action.title}
                {isEvent && action.dateISO ? (
                  <> · {action.dateISO}{action.time ? ` at ${action.time}` : ""}</>
                ) : null}
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  minTouchTarget
                  icon={isEvent ? CalendarIcon : DocumentTextIcon}
                  onClick={() =>
                    isEvent
                      ? navigateTo("calendar")
                      : action.matterId
                        ? navigateTo("matterDetail", action.matterId)
                        : navigateTo("notes")
                  }
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  minTouchTarget
                  loading={undoingId === action.itemId}
                  onClick={() => void handleUndo(action)}
                >
                  Undo
                </Button>
              </div>
            </div>
            <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
          </div>
        );
      })}
    </div>
  );
};
