/**
 * useCourtroomActions — ROUND 25 (ALOA Vox intelligence overhaul, owner spec
 * 2026-11-28, FEATURE 5): the one-tap creation of extracted courtroom items.
 *
 * A dictated passage's extracted directives ("the defendants are to file
 * their response" → task; "remind me to prepare the written address" →
 * reminder) become real records auto-associated with the active matter, with
 * the stated due date, in ONE tap. Created items settle to "Created" so the
 * same action can never stack duplicates; a server rejection re-arms the
 * button and surfaces the verbatim message (the item is never lost).
 */
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Matter } from "../../../types";
import { useDataActions } from "../../../contexts/DataContext";
import { useUI } from "../../../contexts/UIContext";
import { todayDayKey } from "../courtModeUtils";
import { formatDayKeyFull } from "./format";
import type { CourtroomAction } from "../../../services/voice/courtroomExtraction";

export type CreatedActionState = "pending" | "done";

export interface UseCourtroomActionsApi {
  /** "pending" while saving, "done" after — keyed by lowercased title. */
  createdActions: Record<string, CreatedActionState>;
  /** Create one extracted item as a task linked to the matter. Idempotent
   *  per title while pending/done. */
  createAction: (action: CourtroomAction) => Promise<void>;
}

export function useCourtroomActions(args: {
  matter: Matter;
  viewerId: string;
}): UseCourtroomActionsApi {
  const { matter, viewerId } = args;
  const { addItem } = useDataActions();
  const { addToast } = useUI();
  const [createdActions, setCreatedActions] = useState<Record<string, CreatedActionState>>({});

  const createAction = async (action: CourtroomAction): Promise<void> => {
    const key = action.title.toLowerCase();
    if (createdActions[key]) return;
    setCreatedActions((previous) => ({ ...previous, [key]: "pending" }));
    try {
      const isReminder = action.kind === "reminder";
      await addItem(
        "tasks",
        {
          id: uuidv4(),
          title: isReminder ? `Reminder: ${action.title}` : `${action.title} — ${matter.title}`,
          description:
            `Recorded from the ${isReminder ? "voice reminder" : "courtroom dictation"} on ${formatDayKeyFull(todayDayKey()) || "today"}` +
            `${action.dueDayKey ? `. Due ${formatDayKeyFull(action.dueDayKey)}.` : "."} Source: "${action.sourceSentence}"`,
          status: "todo",
          priority: isReminder ? "Medium" : "High",
          dueDate: action.dueDayKey,
          assignedUsers: isReminder
            ? [viewerId]
            : (matter.assignedUsers || []).length > 0
              ? matter.assignedUsers
              : [viewerId],
          matterId: matter.id,
          createdAt: new Date().toISOString(),
          creatorId: viewerId,
        },
        isReminder ? "Reminder task" : "Courtroom task",
      );
      setCreatedActions((previous) => ({ ...previous, [key]: "done" }));
      addToast(
        isReminder ? "Reminder created — linked to this matter." : "Task created — linked to this matter.",
        { type: "success" },
      );
    } catch (error) {
      setCreatedActions((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message)
          : null;
      addToast(message || "Could not create the task. Please try again.", { type: "error" });
    }
  };

  return { createdActions, createAction };
}
