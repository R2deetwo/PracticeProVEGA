/**
 * ROUND 22 — inline edits inside Court Mode, with the institutional audit
 * trail. Two actions, both behind ONE visible Save press (no silent writes):
 *
 *   saveEndorsement — edits the saved endorsement (the LAST ENDORSEMENT note)
 *     via updateItem('notePages'), then writes a firmActivity row naming
 *     the editor, the matter and the moment.
 *   saveNextDate — edits the upcoming matter date. A real diary event is
 *     moved via updateItem('events') (its original duration preserved);
 *     a synthesized next-adjourned date (no event yet) patches the matter
 *     itself — and, since ROUND 25 (owner bug report 2026-11-28), an EMPTY
 *     date on a synthesized hearing RESETS the matter's next date (the
 *     matter drops back to "Needs a new date" in the diary, cleanly). A
 *     real diary event always keeps a date (cancel instead). Then the
 *     audit row.
 *
 * Errors: updateItem already surfaces the server's verbatim rejection and
 * rolls back; the actions return false so the editor STAYS OPEN (nothing is
 * silently discarded). Success toasts name the audit trail.
 */
import { useCallback, useState } from "react";
import type { CalendarEvent, Matter, NotePage } from "../../../types";
import { useDataActions } from "../../../contexts/DataContext";
import { useUI } from "../../../contexts/UIContext";
import { useEndorsementNotify } from "../../../hooks/useEndorsementNotify";
import { endorsementBodyOf, isRecurringInstanceId, SYNTHESIZED_HEARING_ID_PREFIX } from "../courtModeUtils";
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
  const notifyEndorsement = useEndorsementNotify();
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
          // ROUND 23 (owner vocabulary): "Endorsement" — never "Court
          // endorsement"; there is no need to say "court" to a lawyer.
          "Endorsement",
        );
        // The institutional audit trail — a firmActivity row names the
        // editor, the matter and the moment (visible firm-wide).
        logActivity("Edited an endorsement", "Matter", matter.id, matter.title, matter.id);
        // ROUND 23 (owner spec §4): the matter's attached users are notified
        // of the edit — best-effort, never blocks the save.
        notifyEndorsement({
          matterId: matter.id,
          noteId: note.id,
          action: "edited",
          snippet: endorsementBodyOf(trimmed),
        });
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
    [updateItem, logActivity, notifyEndorsement, addToast, isSaving],
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
      if (isSaving) return false;
      // ROUND 23 (parity): a recurrence EXPANSION INSTANCE is a virtual
      // occurrence, not a stored row — patching it would move the whole
      // series' anchor. The recurring series is edited on the calendar.
      if (isRecurringInstanceId(hearing.id)) {
        addToast("That is a recurring diary item — edit the series on the calendar.", { type: "info" });
        return false;
      }
      // ROUND 25 (owner bug report 2026-11-28): the clean RESET — a
      // synthesized (matter-level) date saves EMPTY, clearing the matter's
      // next-adjourned date so it drops back to "Needs a new date". A real
      // diary event still requires a date (it is a scheduled sitting, not a
      // flag — moving it to "" would corrupt the diary).
      const isSynthesized = hearing.id.startsWith(SYNTHESIZED_HEARING_ID_PREFIX);
      if (!dateISO && !isSynthesized) return false;
      setIsSaving(true);
      try {
        if (isSynthesized) {
          // No diary event — the date lives on the matter itself. "" clears
          // it (getCourtHearings drops the synthesized hearing, so the card
          // renders the "No next date set" empty state and the diary moves
          // the matter to "Needs a new date" — the reset the owner asked
          // for, updating the card and diary in one clean write).
          await updateItem("matters", { id: matter.id, nextAdjournedDate: dateISO }, "Matter next date");
          logActivity(
            dateISO ? "Updated the next court date" : "Cleared the next court date",
            "Matter",
            matter.id,
            matter.title,
            matter.id,
          );
          addToast(
            dateISO
              ? "Next date updated — logged to the firm activity trail."
              : "Next date cleared — the matter needs a new date.",
            { type: "success" },
          );
          return true;
        } else {
          if (!dateISO) return false; // unreachable — guarded above
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
