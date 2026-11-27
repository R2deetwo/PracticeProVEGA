/**
 * Round 19/23 — the briefing's collapsible sections: PREVIOUS endorsements
 * (each item directly clickable — it expands in place to inspect the full
 * record, not just a generic "View all" jump), attached documents, plain
 * NOTES (kept distinct from endorsements — never an awkward "and notes"
 * label), and the matter's other diary items (the court-regex-invisible
 * ones). Documents/"View all" navigate away and close the panel (drafts
 * persist, so leaving is safe) — disabled while dictation is busy
 * (preserved rule).
 */
import React, { useState } from "react";
import { CalendarDays, ChevronRight, FileText } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Document, NotePage } from "../../../types";

interface BriefingAccordionsProps {
  /** Older endorsements, newest first (the latest lives in the LAST
   * ENDORSEMENT block above — never duplicated here). */
  previousEndorsements: NotePage[];
  /** Plain notes (type 'user') — distinct from endorsements. */
  plainNotes: NotePage[];
  documents: Document[];
  nonCourtEvents: CalendarEvent[];
  captureBusy: boolean;
  onViewAllNotes: () => void;
  onOpenDocument: (documentId: string) => void;
}

const shortDate = (dateISO: string): string => {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** One clickable endorsement row: the first line of the record, expanding in
 * place to the full endorsement (inspect without leaving the briefing). */
const PreviousEndorsementRow: React.FC<{ note: NotePage }> = ({ note }) => {
  const [open, setOpen] = useState(false);
  const body = (note.content || "").trim();
  const firstLine = body.split("\n").find((line) => line.trim()) || note.title;
  return (
    <div className="min-w-0 rounded-sm border border-hairline bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        fullWidth
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="justify-between gap-2 !px-0"
      >
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{firstLine}</span>
        <span className="flex flex-shrink-0 items-center gap-1 text-2xs text-subtle">
          {shortDate(note.createdAt || "")}
          <ChevronRight
            className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </span>
      </Button>
      {open ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words border-t border-hairline pt-1.5 text-xs leading-relaxed text-body dark:border-zinc-800">
          {body}
        </p>
      ) : null}
    </div>
  );
};

export const BriefingAccordions: React.FC<BriefingAccordionsProps> = ({
  previousEndorsements,
  plainNotes,
  documents,
  nonCourtEvents,
  captureBusy,
  onViewAllNotes,
  onOpenDocument,
}) => (
  <SectionErrorBoundary sectionName="Previous endorsements, notes, documents and diary items">
    <Accordion type="multiple" className="space-y-2">
      {previousEndorsements.length ? (
        <AccordionItem
          value="previous-endorsements"
          className="rounded-sm border border-hairline bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AccordionTrigger className="text-xs">
            Previous endorsements ({previousEndorsements.length})
          </AccordionTrigger>
          <AccordionContent className="space-y-2">
            {previousEndorsements.slice(0, 5).map((note) => (
              <PreviousEndorsementRow key={note.id} note={note} />
            ))}
            {previousEndorsements.length > 5 ? (
              <Button variant="ghost" size="sm" type="button" disabled={captureBusy} onClick={onViewAllNotes}>
                View all ({previousEndorsements.length})
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {plainNotes.length ? (
        <AccordionItem
          value="notes"
          className="rounded-sm border border-hairline bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AccordionTrigger className="text-xs">Notes ({plainNotes.length})</AccordionTrigger>
          <AccordionContent className="space-y-2">
            {plainNotes.slice(0, 5).map((note) => (
              <div key={note.id} className="min-w-0">
                <p className="break-words text-sm font-semibold">{note.title}</p>
                <p className="mt-0.5 line-clamp-2 break-words text-xs text-body">{note.content}</p>
              </div>
            ))}
            {plainNotes.length > 5 ? (
              <Button variant="ghost" size="sm" type="button" disabled={captureBusy} onClick={onViewAllNotes}>
                View all ({plainNotes.length})
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {documents.length ? (
        <AccordionItem
          value="documents"
          className="rounded-sm border border-hairline bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AccordionTrigger className="text-xs">Documents ({documents.length})</AccordionTrigger>
          <AccordionContent className="space-y-2">
            {documents.map((doc) => (
              <Button
                key={doc.id}
                variant="ghost"
                size="sm"
                type="button"
                icon={FileText}
                disabled={captureBusy}
                onClick={() => onOpenDocument(doc.id)}
                className="w-full justify-start gap-2"
              >
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{doc.title}</span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            ))}
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {nonCourtEvents.length ? (
        <AccordionItem
          value="other-diary-items"
          className="rounded-sm border border-hairline bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AccordionTrigger className="text-xs">Other diary items ({nonCourtEvents.length})</AccordionTrigger>
          <AccordionContent className="space-y-2">
            {nonCourtEvents.slice(0, 3).map((event) => (
              <p key={event.id} className="flex items-baseline gap-2 text-sm">
                <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{event.title}</span>
                <span className="text-xs text-subtle">{shortDate(event.date)}</span>
              </p>
            ))}
          </AccordionContent>
        </AccordionItem>
      ) : null}
    </Accordion>
  </SectionErrorBoundary>
);

export default BriefingAccordions;
