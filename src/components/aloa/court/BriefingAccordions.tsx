/**
 * Round 19 — the briefing's collapsible sections: earlier endorsements &
 * notes, attached documents, and the matter's other diary items (the
 * court-regex-invisible ones). Documents/"View all" navigate away and close
 * the panel (drafts persist, so leaving is safe) — disabled while dictation
 * is busy (preserved rule).
 */
import React from "react";
import { CalendarDays, ChevronRight, FileText } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, SectionErrorBoundary } from "../../ui";
import type { CalendarEvent, Document, NotePage } from "../../../types";

interface BriefingAccordionsProps {
  earlierNotes: NotePage[];
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

export const BriefingAccordions: React.FC<BriefingAccordionsProps> = ({
  earlierNotes,
  documents,
  nonCourtEvents,
  captureBusy,
  onViewAllNotes,
  onOpenDocument,
}) => (
  <SectionErrorBoundary sectionName="Earlier notes, documents and diary items">
    <Accordion type="multiple" className="space-y-2">
      {earlierNotes.length ? (
        <AccordionItem
          value="earlier-notes"
          className="rounded-sm border border-hairline bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <AccordionTrigger className="text-xs">Earlier endorsements &amp; notes ({earlierNotes.length})</AccordionTrigger>
          <AccordionContent className="space-y-2">
            {earlierNotes.slice(0, 5).map((note) => (
              <div key={note.id} className="min-w-0">
                <p className="break-words text-sm font-semibold">{note.title}</p>
                <p className="mt-0.5 line-clamp-2 break-words text-xs text-body">{note.content}</p>
              </div>
            ))}
            <Button variant="ghost" size="sm" type="button" disabled={captureBusy} onClick={onViewAllNotes}>
              View all
            </Button>
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
