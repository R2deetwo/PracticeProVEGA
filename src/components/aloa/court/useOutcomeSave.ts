/**
 * Round 19 — the composer's deterministic save sequence.
 *
 * The ONLY writes in Court Mode: (1) the note, then (2) the diary event,
 * then (3) the matter's next-adjourned-date patch — in that order.
 * (1) fails → nothing else runs and the draft is untouched (server message
 * surfaced verbatim). (1) succeeds + (2)/(3) fail → the text is cleared but
 * the next date + toggles are kept and a partial-failure retry state is
 * exposed (retry re-runs ONLY the failed steps; the note is never
 * duplicated). Success clears the draft and returns to the briefing.
 */
import { useState } from "react";
import type { CalendarEvent, Matter } from "../../../types";
import { useDataActions } from "../../../contexts/DataContext";
import { useUI } from "../../../contexts/UIContext";
import { buildOutcomePlan, diaryDayLabel, OutcomeDraft } from "../courtModeUtils";

export interface SavedNotePlan {
  note: { matterId: string; title: string; content: string; type: "endorsement" | "user" };
  event: Record<string, unknown> | null;
  matterPatch: { nextAdjournedDate: string } | null;
}

/** ROUND 22: the retry state carries the RAW body text — never the
 * jacketed note content — so a retry can never re-wrap the jacket. */
export interface PartialFailureState {
  matterId: string;
  noteType: "endorsement" | "user";
  text: string;
  nextDate: NonNullable<OutcomeDraft["nextDate"]>;
  addToDiary: boolean;
  setAsMatterNextDate: boolean;
}

export interface UseOutcomeSaveArgs {
  matter: Matter;
  events: CalendarEvent[];
  viewerId: string;
  viewerName: string;
  eventTypeNames: string[];
  nextDate: OutcomeDraft["nextDate"];
  addToDiary: boolean;
  setAsMatterNextDate: boolean;
  onTextCleared: () => void;
  onNextDateCleared: () => void;
  onSaved: () => void;
}

const serverMessage = (error: unknown): string | null => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return null;
};

const successToastText = (event: Record<string, unknown> | null, noteType: "endorsement" | "user"): string => {
  const base = noteType === "endorsement" ? "Endorsement saved" : "Matter note saved";
  if (event) {
    const dateISO = String(event.date || "").slice(0, 10);
    return dateISO ? `${base} · added to diary for ${diaryDayLabel(dateISO)}` : base;
  }
  return base;
};

export function useOutcomeSave(args: UseOutcomeSaveArgs) {
  const { matter, events, viewerId, viewerName, eventTypeNames, nextDate, addToDiary, setAsMatterNextDate } = args;
  const { addItem, handleAddMatterNote, handleUpdateMatter } = useDataActions();
  const { addToast } = useUI();
  const [isSaving, setIsSaving] = useState(false);
  const [partialFailure, setPartialFailure] = useState<PartialFailureState | null>(null);

  const buildPlan = (draft: OutcomeDraft): SavedNotePlan =>
    buildOutcomePlan(draft, { matter, events, viewerId, viewerName, eventTypeNames, nowISO: new Date().toISOString() });

  // Steps (2)+(3) only — step (1), the note, is saved by the caller.
  const runDiarySteps = async (plan: SavedNotePlan): Promise<{ diaryFailed: boolean; matterFailed: boolean }> => {
    let diaryFailed = false;
    let matterFailed = false;
    if (plan.event) {
      try {
        await addItem("events", plan.event, `Event: ${String(plan.event.title || "Court date")}`);
      } catch {
        diaryFailed = true;
      }
    }
    if (plan.matterPatch) {
      try {
        await handleUpdateMatter({ ...matter, ...plan.matterPatch });
      } catch {
        matterFailed = true;
      }
    }
    return { diaryFailed, matterFailed };
  };

  const finishAfterNoteSaved = async (
    plan: SavedNotePlan,
    failed: { diaryFailed: boolean; matterFailed: boolean },
    rawText: string,
  ) => {
    if (failed.diaryFailed || failed.matterFailed) {
      // ROUND 21: a purpose-only draft (empty dateISO) has no diary step to
      // fail — partial-failure retry only applies to a real next date.
      if (nextDate?.dateISO)
        setPartialFailure({
          matterId: matter.id,
          noteType: plan.note.type,
          text: rawText,
          nextDate,
          addToDiary,
          setAsMatterNextDate,
        });
      args.onTextCleared();
      addToast("Note saved. The diary could not be updated.", { type: "warning" });
      setIsSaving(false);
      return;
    }
    addToast(successToastText(plan.event, plan.note.type), { type: "success" });
    args.onTextCleared();
    args.onNextDateCleared();
    setPartialFailure(null);
    setIsSaving(false);
    args.onSaved();
  };

  const save = async (noteType: "endorsement" | "user", text: string, captureBusy: boolean) => {
    if (!text.trim() || captureBusy || isSaving) return;
    const plan = buildPlan({ matterId: matter.id, noteType, text, nextDate, addToDiary, setAsMatterNextDate });
    setIsSaving(true);
    try {
      await handleAddMatterNote(plan.note.matterId, plan.note.title, plan.note.content, plan.note.type);
    } catch (error) {
      addToast(serverMessage(error) || "Could not save this note. Please try again.", { type: "error" });
      setIsSaving(false);
      return; // nothing else runs; the draft is untouched
    }
    const failed = await runDiarySteps(plan);
    await finishAfterNoteSaved(plan, failed, text);
  };

  const retry = async (captureBusy: boolean) => {
    if (!partialFailure || isSaving || captureBusy) return;
    const plan = buildPlan({
      matterId: partialFailure.matterId,
      noteType: partialFailure.noteType,
      text: partialFailure.text,
      nextDate: partialFailure.nextDate,
      addToDiary: partialFailure.addToDiary,
      setAsMatterNextDate: partialFailure.setAsMatterNextDate,
    });
    setIsSaving(true);
    const failed = await runDiarySteps(plan);
    await finishAfterNoteSaved(plan, failed, partialFailure.text);
  };

  return { isSaving, partialFailure, save, retry };
}
