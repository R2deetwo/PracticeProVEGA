/**
 * ROUND 22 — inline edits inside Court Mode, with the institutional audit
 * trail. Two actions, both behind ONE visible Save press (no silent writes):
 *
 *   saveEndorsement — edits the saved endorsement (the LAST ORDER note)
 *     via updateItem('notePages'), then writes a firmActivity row naming
 *     the editor, the matter and the moment.
 *   saveNextDate — edits the upcoming matter date. A real diary event is
 *     moved via updateItem('events') (its original duration preserved);
 *     a synthesized next-adjourned date (no event yet) patches the matter
 *     itself; when the matter's nextAdjournedDate pointed at the moved
 *     hearing it is kept in step. Then the audit row.
 *
 * Errors: updateItem already surfaces the server's verbatim rejection and
 * rolls back; the actions return false so the editor STAYS OPEN (nothing is
 * silently discarded). Success toasts name the audit trail.
 */
import { useCallback, useState } from "react";
import type { CalendarEvent, Matter, NotePage } from "../../../types";
import { useDataActions } from "../../../contexts/DataContext";
import { useUI } from "../../../contexts/UIContext";
import { SYNTHESIZED_HEARING_ID_PREFIX } from "../courtModeUtils";
import { dayKeyOf } from "./format";

/** The exact event object to patch, matched the way updateItem does (id/_id —
 * Convex rows carry _id at runtime even though the client type omits it). */
const findEvent = (events: CalendarEvent[], eventId: string): CalendarEvent | null =>
  (events || []).find(
    (candidate) =>
      candidate.id === eventId || (candidate as { _id?: string })._id === eventId,
  ) || null;

/** Local ISO date for the new hearing moment — timed when a time is set,
 * date-only otherwise (the diary's untimed convention). */
const composeEventDate = (dateISO: string, timeHHmm: string | null): string => {
  if (!timeHHmm) return dateISO;
  const [year, month, day] = dateISO.split("-").map(Number);
  const [hours, minutes] = timeHHmm.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
};

export function useCourtInlineEdit() {
  const { updateItem, logActivity } = useDataActions();
  const { addToast } = useUI();
  const [isSaving, setIsSaving] = useState(false);

  const saveEndorsement = useCallback(
    async (matter: Matter, note: NotePage, content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!trimmed || isSaving) return false;
      if (trimmed === (note.content || "").trim()) {
        addToast("No changes to save.", { type: "info" });
        return false;
      }
      setIsSaving(true);
      try {
        await updateItem(
          "notePages",
          { id: note.id, content: trimmed, updatedAt: new Date().toISOString() },
          "Court endorsement",
        );
        // The institutional audit trail — a firmActivity row names the
        // editor, the matter and the moment (visible firm-wide).
        logActivity("Edited a court endorsement", "Matter", matter.id, matter.title, matter.id);
        addToast("Endorsement updated — logged to the firm activity trail.", { type: "success" });
        return true;
      } catch {
        // updateItem surfaced the server's verbatim rejection and rolled
        // back — keep the editor open with the lawyer's text intact.
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [updateItem, logActivity, addToast, isSaving],
  );

  const saveNextDate = useCallback(
    async (args: {
      matter: Matter;
      hearing: { id: string; date: string };
      dateISO: string;
      timeHHmm: string | null;
      events: CalendarEvent[];
    }): Promise<boolean> => {
      const { matter, hearing, dateISO, timeHHmm, events } = args;
      if (!dateISO || isSaving) return false;
      setIsSaving(true);
      try {
        if (hearing.id.startsWith(SYNTHESIZED_HEARING_ID_PREFIX)) {
          // No diary event — the date lives on the matter itself.
          await updateItem("matters", { id: matter.id, nextAdjournedDate: dateISO }, "Matter next date");
        } else {
          const event = findEvent(events, hearing.id);
          if (!event) {
            addToast("That diary item is no longer available. Please reopen the matter.", { type: "error" });
            return false;
          }
          const date = composeEventDate(dateISO, timeHHmm);
          const patch: Record<string, unknown> = {
            id: event.id,
            date,
            updatedAt: new Date().toISOString(),
          };
          if (event.endDate) {
            const durationMs =
              new Date(event.endDate).getTime() - new Date(event.date).getTime();
            if (Number.isFinite(durationMs) && durationMs > 0) {
              patch.endDate = new Date(new Date(date).getTime() + durationMs).toISOString();
            }
          }
          await updateItem("events", patch, "Court date");
          // Keep the matter's next-adjourned flag in step when it pointed at
          // the hearing that just moved (never left stale by a silent write).
          if (matter.nextAdjournedDate && dayKeyOf(matter.nextAdjournedDate) === dayKeyOf(hearing.date)) {
            try {
              await updateItem("matters", { id: matter.id, nextAdjournedDate: dateISO }, "Matter next date");
            } catch {
              addToast("The diary date moved; the matter's next date could not be updated.", {
                type: "warning",
              });
            }
          }
        }
        logActivity("Updated the next court date", "Matter", matter.id, matter.title, matter.id);
        addToast("Next date updated — logged to the firm activity trail.", { type: "success" });
        return true;
      } catch {
        // updateItem surfaced the server's verbatim rejection and rolled back.
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [updateItem, logActivity, addToast, isSaving],
  );

  return { isSaving, saveEndorsement, saveNextDate };
}
