/**
 * ROUND 22/23 — the saved endorsement at the bottom of a selected matter (the
 * LAST ENDORSEMENT block), directly editable inline. Read view identical to
 * the Round 19/20 block (heading, Just-now badge, clamped body, Show more);
 * one "Edit" affordance swaps in a Textarea with a single visible Save press.
 * Every save writes the note via updateItem('notePages') AND an audit row
 * (logActivity — the firm activity trail, firm-wide and attributed) and
 * notifies the matter's attached users; a server rejection keeps the editor
 * open with the text intact.
 */
import React, { useState } from "react";
import { Badge, Button, SectionErrorBoundary, Textarea } from "../../ui";
import type { Matter, NotePage } from "../../../types";
import { useCourtInlineEdit } from "./useCourtInlineEdit";

interface EndorsementEditorProps {
  /** The matter's latest endorsement (the LAST ENDORSEMENT note). */
  note: NotePage;
  matter: Matter;
  /** Preserved rule: editing is disabled while dictation is busy. */
  captureBusy: boolean;
}

const shortDate = (dateISO: string): string => {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const EndorsementEditor: React.FC<EndorsementEditorProps> = ({ note, matter, captureBusy }) => {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content || "");
  const [expanded, setExpanded] = useState(false);
  const { isSaving, saveEndorsement } = useCourtInlineEdit();

  const beginEdit = () => {
    setContent(note.content || "");
    setEditing(true);
  };

  const onSave = async () => {
    const saved = await saveEndorsement(matter, note, content);
    if (saved) setEditing(false);
  };

  const justNow = Date.now() - new Date(note.createdAt).getTime() < 60_000;
  // The institutional trail also shows in the record itself: an updatedAt
  // meaningfully after the create is an edit (existing schema fields only).
  const wasEdited =
    new Date(note.updatedAt || note.createdAt).getTime() - new Date(note.createdAt).getTime() >
    60_000;
  const isLong = (note.content || "").length > 240 || (note.content || "").split("\n").length > 6;

  return (
    <SectionErrorBoundary sectionName="Last endorsement">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-2xs font-black uppercase tracking-widest text-subtle">
            Last endorsement · {shortDate(note.createdAt)}
            {wasEdited && !justNow ? " · edited" : ""}
          </h3>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {justNow ? <Badge tone="success">Just now</Badge> : null}
            {!editing ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={captureBusy}
                title={captureBusy ? "Finish or discard dictation first." : undefined}
                onClick={beginEdit}
              >
                Edit
              </Button>
            ) : null}
          </div>
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              label="Endorsement"
              aria-label="Edit endorsement"
            />
            <p className="text-2xs text-subtle">
              Saving updates the record and logs your name, the matter and the time to the firm activity trail.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" disabled={isSaving} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                minTouchTarget
                loading={isSaving}
                disabled={!content.trim() || content.trim() === (note.content || "").trim()}
                onClick={() => void onSave()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p
              className={`mt-1.5 break-words whitespace-pre-wrap text-sm leading-relaxed text-body ${
                expanded ? "" : "line-clamp-6"
              }`}
            >
              {note.content}
            </p>
            {isLong ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="-ml-2"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "Show less" : "Show more"}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </SectionErrorBoundary>
  );
};

export default EndorsementEditor;
