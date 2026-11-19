/**
 * TriageCard — the Smart Post-Capture Triage confirmation card.
 *
 * INTELLIGENCE UPGRADE (owner spec, 2026-11-18, "Upgrade Quick Capture
 * Intelligence"): the card is MULTI-INTENT — one voice note can be a Case
 * Note AND a Diary task at once, so the actions are toggles with a unified
 * primary CTA ("Save Case Note & Add to Diary"), not a single-choice pill
 * row. Behind it, the backend analysis pass now returns:
 *   - ranked SEMANTIC matter matches (confidences + reasons) → auto-select
 *     the best one and show the top candidates as 1-tap disambiguation
 *     pills beside the full matter dropdown;
 *   - relative-date-resolved diary events with 09:00 defaults when no clock
 *     time was spoken (flagged "est." — editable inline);
 *   - implied follow-up tasks ("follow up with registry");
 *   - structured ENDORSEMENT fields when courtroom proceedings were
 *     dictated, with a 1-tap "add the adjourned date to Diary";
 *   - a ZERO DEAD-END diary: with no extracted dates, tapping Diary reveals
 *     an inline quick-schedule form (title prefilled from the summary,
 *     matched matter, date/time pickers defaulting to tomorrow 09:00) —
 *     never a "no dates detected" message.
 *
 * INCREMENTAL DICTATION (owner addendum, earlier today): the transcript is
 * a live, EDITABLE DRAFT — the note is never locked into a save-or-discard
 * choice. An "Add More" mic button (props: onAddMore) records another clip
 * through the same Whisper pipeline; the parent appends the new words onto
 * this draft and the re-finalized analysis (events, matter matches,
 * endorsement) refreshes with them. The Smart Clean / Verbatim toggle lives
 * in a header row ABOVE the draft box — nothing overlaps the transcript.
 *
 * DELETION (owner report: "how do we delete a quick capture? it is not
 * obvious"): a trash button in this card's header offers "Discard this
 * note" with a two-tap confirm. It deletes the capture row + archived
 * audio; a note already SAVED into a matter is a separate record and stays.
 *
 * CONTEXT- & INTENT-AWARE FORMATTING (owner spec, 2026-11-19 — "Wispr Flow
 * style"): saved records are formatted for their destination, never a raw
 * transcript dump. The diary Notes field gets the analysis' concise action
 * summary for THAT entry (editable inline before save); the case note body
 * defaults to the analysis' formatted caseNoteText (paragraphs vs bullets
 * chosen by content, meta-speech stripped — "From voice note…", "I'm
 * trying to set a reminder…" never reach the saved record); a courtroom
 * endorsement appends its formal structured block (Court / Suit No /
 * Parties / Coram / Proceedings / Next Adjourned Date). The raw transcript
 * stays one toggle away (Formatted ⇄ Verbatim) and rides along in the
 * note's rawTranscript field.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select, type SelectOption } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import {
  BanknotesIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  EditIcon,
  MicrophoneIcon,
  OfficeBuildingIcon,
  PlusIcon,
  ShareIcon,
  SparklesIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useDataActions } from "../../contexts/DataContext";
import { useCoreState } from "../../contexts/CoreContext";
import { useAuth } from "../../contexts/AuthContext";
import { MATTERS_NOTEBOOK_ID } from "../../constants";
import type { Matter } from "../../types";
import {
  eventDescriptionFrom,
  extractLearnedTerms,
  formatEndorsementText,
} from "../../services/voice/draftUtils";
// VOICE → DRAFTPRO PIPELINE (owner spec 2026-11-19): the Drafting Blueprint
// card — deterministic taxonomy + assembly replace the old free-text brief.
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "../../legal/drafting/documentTypes";
import type { DraftBlueprint } from "../../legal/drafting/types";
import { hydrate } from "../../legal/drafting/hydrate";
import { computeMissingFields } from "../../legal/drafting/assemble";
import { generateDraftBundle } from "../../services/draftProBlueprintService";
import { saveDraft } from "../../utils/draftSession";
import { openDraftProNewTab, isMobileOrNative } from "../../utils/tabNavigation";
import {
  addDictionaryTerms,
  linkCapture,
  quickAsk,
  type CaptureProjection,
  type QuickAskResult,
  type TriageEventDraft,
} from "../../services/voice/voiceCaptureService";
import { QuickAskActions } from "./QuickAskActions";

interface TriageCardProps {
  capture: CaptureProjection;
  matters: Matter[];
  /** The firm's calendar type names, used to coerce extracted event types. */
  eventTypeNames: string[];
  onDone: () => void;
  /** Delete this capture entirely (row + archived audio). Saved case
   * notes are separate records and are NOT touched. Two-tap confirm here. */
  onDelete?: (capture: CaptureProjection) => void | Promise<void>;
  onOpenMatter?: (matterId: string) => void;
  onOpenCalendar?: () => void;
  /** INCREMENTAL DICTATION — the working draft text (owned by the parent so
   * it survives the Add More recording round, during which this card
   * unmounts). */
  draftText: string;
  onDraftChange: (text: string) => void;
  /** Start another recording round appended to this capture. */
  onAddMore: () => void;
  /** Reset the draft to the backend's current tier text (drops manual edits). */
  onResyncDraft: () => void;
  /** How many dictation clips the draft holds so far (≥1 after first pass). */
  clipCount: number;
  /** Which transcript tier the draft follows — drives the toggle label. */
  draftSource: "clean" | "verbatim";
  onToggleSource: () => void;
  /** Disable Add More while the parent is mid-append (guard). */
  addMoreDisabled?: boolean;
  /** EDIT SELECTION BY VOICE (owner spec 2026-11-19 §6): the user
   *  highlighted a passage in the draft box and wants to rewrite it by
   *  speaking. The parent records the instruction clip and splices the
   *  rewritten passage back into [start, end). */
  onEditSelection?: (start: number, end: number) => void;
}

/** Coerce an LLM-extracted event type to a type the firm actually has. */
function coerceEventType(type: string | undefined, eventTypeNames: string[]): string {
  if (!type) return eventTypeNames[0] || "Meeting";
  const exact = eventTypeNames.find((t) => t.toLowerCase() === type.toLowerCase());
  if (exact) return exact;
  const partial = eventTypeNames.find(
    (t) => t.toLowerCase().includes(type.toLowerCase()) || type.toLowerCase().includes(t.toLowerCase())
  );
  return partial || eventTypeNames[0] || "Meeting";
}

/** Tomorrow's date (local) as YYYY-MM-DD — the quick-schedule default. */
function tomorrowISO(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const TriageCard: React.FC<TriageCardProps> = ({
  capture,
  matters,
  eventTypeNames,
  onDone,
  onDelete,
  onOpenMatter,
  onOpenCalendar,
  draftText,
  onDraftChange,
  onAddMore,
  onResyncDraft,
  clipCount,
  draftSource,
  onToggleSource,
  addMoreDisabled,
  onEditSelection,
}) => {
  const { addToast, navigateTo } = useUI();
  const actions = useDataActions();
  const { coreState } = useCoreState();
  const { currentUser } = useAuth();

  const triage = capture.triageMeta || {};

  // ── Multi-intent action toggles (owner spec §4) ─────────────────────────
  // Defaults from the analysis: a note about a matter wants to be a Case
  // Note; a note with dates / tasks wants the Diary; both can be true at
  // once and the unified CTA reflects the combination.
  const semanticMatches = triage.matterMatches || [];
  const extractedEvents: TriageEventDraft[] = useMemo(
    () => (triage.events || []).slice(0, 6),
    [triage.events]
  );

  const [saveNote, setSaveNote] = useState(() => {
    const intent = triage.intent;
    return (
      intent === "case_note" ||
      (semanticMatches.length > 0 && intent !== "question")
    );
  });
  const [addToDiary, setAddToDiary] = useState(() => {
    const intent = triage.intent;
    return intent === "schedule" || triage.isDiaryTask === true || extractedEvents.length > 0;
  });

  // ── Matter auto-select + disambiguation (owner spec §2) ─────────────────
  const preselectedMatterId = useMemo(() => {
    const top = semanticMatches[0];
    if (top && matters.some((m) => m.id === top.matterId)) return top.matterId;
    const matched = triage.matchedMatterIds?.[0];
    if (matched && matters.some((m) => m.id === matched)) return matched;
    const matchedContactId = triage.matchedContactIds?.[0];
    if (matchedContactId) {
      const byClient = matters.find((m) => m.clientId === matchedContactId);
      if (byClient) return byClient.id;
    }
    return "";
  }, [semanticMatches, triage.matchedMatterIds, triage.matchedContactIds, matters]);

  const [selectedMatterId, setSelectedMatterId] = useState(preselectedMatterId);

  const matterOptions: SelectOption[] = useMemo(
    () => [
      // Standalone tasks are first-class: a diary entry or note with NO
      // matter (chambers admin, personal reminders) must never be forced
      // onto a file (owner spec 2026-11-19, Part 1 §2).
      { value: "", label: "No linked matter (standalone)" },
      ...matters.slice(0, 100).map((m) => ({
        value: m.id,
        label: m.title || "(untitled matter)",
      })),
    ],
    [matters]
  );

  const matchPills = useMemo(
    () =>
      semanticMatches
        .filter((m) => matters.some((x) => x.id === m.matterId))
        .slice(0, 3),
    [semanticMatches, matters]
  );

  // ── Diary events: inline-editable drafts (owner spec §3) ────────────────
  const [eventDrafts, setEventDrafts] = useState<TriageEventDraft[]>(extractedEvents);
  /** Quick-schedule form (zero dead-end when nothing was extracted). */
  const [quickForm, setQuickForm] = useState(() => ({
    title: (triage.summary || "Voice note").slice(0, 120),
    dateISO: tomorrowISO(),
    time: "09:00",
  }));

  const [savedNote, setSavedNote] = useState(false);
  const [savedNotePageId, setSavedNotePageId] = useState<string | null>(null);
  const [savedEvents, setSavedEvents] = useState<string[]>([]);
  const [askResult, setAskResult] = useState<QuickAskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [unifiedBusy, setUnifiedBusy] = useState(false);
  const [adjournedAdded, setAdjournedAdded] = useState(false);
  // Two-tap confirm for Discard (never one accidental tap away).
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  // ── WORKSPACE PROPOSALS (owner spec 2026-11-19, Part 1): one-shot apply
  //    flags + dismissals so a card never double-creates.
  const [appliedProposal, setAppliedProposal] = useState<
    "newMatter" | "contact" | "propertyNote" | "draft" | "financial" | null
  >(null);
  const [proposalBusy, setProposalBusy] = useState<string | null>(null);
  const [dismissedProposals, setDismissedProposals] = useState<string[]>([]);
  const [taskUpdatesDone, setTaskUpdatesDone] = useState<string[]>([]);
  // Highlighted passage in the draft box (Edit Selection by Voice).
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  // ── DRAFTING BLUEPRINT state (owner spec §4): the working copy the Edit
  //    blueprint mode mutates; falls back to the analysis blueprint.
  const [blueprintDraft, setBlueprintDraft] = useState<DraftBlueprint | null>(null);
  const [blueprintEditing, setBlueprintEditing] = useState(false);
  const [blueprintReliefsText, setBlueprintReliefsText] = useState("");
  const [blueprintExpanded, setBlueprintExpanded] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState("");

  // Re-seed the per-capture state when the card stays mounted across a
  // capture switch (e.g. opening a different recent note).
  useEffect(() => {
    setEventDrafts((capture.triageMeta?.events || []).slice(0, 6));
    setQuickForm({
      title: (capture.triageMeta?.summary || "Voice note").slice(0, 120),
      dateISO: tomorrowISO(),
      time: "09:00",
    });
    setSavedNote(false);
    setSavedNotePageId(null);
    setSavedEvents([]);
    setAskResult(null);
    setAdjournedAdded(false);
    setConfirmDiscard(false);
    setAppliedProposal(null);
    setProposalBusy(null);
    setDismissedProposals([]);
    setTaskUpdatesDone([]);
    setSelection(null);
    setBlueprintDraft(null);
    setBlueprintEditing(false);
    setBlueprintExpanded(false);
    setBlueprintReliefsText("");
    setGeneratingMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.clientLocalId]);

  const polishedText = capture.smartCleanText || capture.verbatimText || "";
  const verbatimText = capture.verbatimText || "";
  // The working draft (editable, owned by the parent) is what every action
  // uses — manual tweaks are respected, appended clips accumulate in it.
  // The parent seeds it from the FORMATTED tier (triageMeta.caseNoteText)
  // when the analysis produced one, so the saved case note is clean by
  // default; the raw transcript stays one toggle away (Formatted ⇄ Verbatim).
  const displayText = draftText || polishedText || verbatimText;

  // Structured courtroom endorsement fields (rendered on the card AND
  // appended to the saved case note as a formal block — owner spec §C).
  const endorsement = triage.endorsement;
  const hasEndorsement =
    !!endorsement &&
    !!(endorsement.court || endorsement.suitNumber || endorsement.parties || (endorsement.orders && endorsement.orders.length > 0));
  const endorsementBlock = hasEndorsement
    ? formatEndorsementText(endorsement)
    : "";

  const handleSaveNote = async (): Promise<void> => {
    const matter = matters.find((m) => m.id === selectedMatterId);
    const notebookId = matter
      ? MATTERS_NOTEBOOK_ID
      : coreState.noteNotebooks?.find((nb) => nb.id !== MATTERS_NOTEBOOK_ID)?.id ||
        MATTERS_NOTEBOOK_ID;
    const noteBody = endorsementBlock
      ? `${displayText.trimEnd()}\n\n${endorsementBlock}`
      : displayText;
    try {
      if (savedNote && savedNotePageId) {
        // The note was already saved and more dictation was appended since —
        // UPDATE the same page instead of duplicating it.
        await actions.updateItem(
          "notePages",
          {
            id: savedNotePageId,
            content: noteBody,
            rawTranscript: verbatimText,
            cleanedTranscript: capture.smartCleanText || null,
            updatedAt: new Date().toISOString(),
          },
          "Case Note"
        );
        addToast("Saved note updated with your additions.", { type: "success" });
        return;
      }
      if (savedNote) return;
      const created: any = await actions.addItem(
        "notePages",
        {
          matterId: matter?.id,
          notebookId,
          title: (triage.summary || displayText.slice(0, 60) || "Voice note").slice(0, 120),
          content: noteBody,
          type: "user",
          // Two-tier record rides along with the note (Vega dual dictation).
          rawTranscript: verbatimText,
          cleanedTranscript: capture.smartCleanText || null,
          dictationMode: "vega_dual",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        "Case Note"
      );
      await linkCapture({
        clientLocalId: capture.clientLocalId,
        matterId: matter?.id,
        notePageId: created?.id,
      }).catch(() => undefined);
      setSavedNote(true);
      setSavedNotePageId(created?.id ?? null);
      addToast("Saved as case note" + (matter ? ` — ${matter.title}` : "") + ".", { type: "success" });
      // SILENT LEARNING: any corrected names/terms enter the Personal
      // Dictionary so the next dictation spells them right (Part 2 §3).
      learnFromEdits(displayText);
    } catch (err: any) {
      addToast(err?.message || "Could not save the note. Please try again.", { type: "error" });
    }
  };

  const handleAddEvent = async (draft: {
    title: string;
    type?: string;
    dateISO: string;
    time: string;
    location?: string;
    note?: string;
  }): Promise<boolean> => {
    if (!draft.title?.trim() || !draft.dateISO) {
      addToast("Pick a date for the entry first.", { type: "info" });
      return false;
    }
    const key = draft.title + draft.dateISO;
    if (savedEvents.includes(key)) return true;
    const time = draft.time && /^\d{2}:\d{2}$/.test(draft.time) ? draft.time : "09:00";
    const date = new Date(`${draft.dateISO}T${time}:00`);
    if (isNaN(date.getTime())) {
      addToast("That date could not be parsed — adjust it and try again.", { type: "error" });
      return false;
    }
    try {
      const created: any = await actions.addItem(
        "events",
        {
          title: draft.title || "Court event",
          // Wispr-Flow style Notes field (owner spec 2026-11-19 §A): the
          // concise action summary for THIS entry — never a raw transcript
          // dump. eventDescriptionFrom prefers the (inline-edited) note and
          // falls back to the meta-stripped draft.
          description: eventDescriptionFrom(draft.note, displayText),
          type: coerceEventType(draft.type, eventTypeNames),
          date: date.toISOString(),
          endDate: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
          matterId: selectedMatterId || undefined,
          matterTitle: matters.find((m) => m.id === selectedMatterId)?.title,
          status: "Active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        draft.title || "Calendar entry"
      );
      setSavedEvents((prev) => [...prev, key]);
      await linkCapture({
        clientLocalId: capture.clientLocalId,
        eventId: created?.id,
      }).catch(() => undefined);
      addToast(`Added to diary: ${draft.title} (${draft.dateISO})`, { type: "success" });
      return true;
    } catch (err: any) {
      addToast(err?.message || "Could not add the diary entry.", { type: "error" });
      return false;
    }
  };

  // ─── WORKSPACE PROPOSAL APPLIERS (owner spec 2026-11-19, Part 1) ───────────
  // Every proposal was validated server-side against the firm's real
  // records; these handlers execute the 1-tap action through the same
  // optimistic DataContext CRUD the rest of the app uses.

  const proposals = triage.proposals || null;
  const firmProperties = coreState.properties || [];

  /** SILENT LEARNING (Part 2 §3): every manual edit that fixes a name or
   *  term is captured into the user's Personal Dictionary. */
  const learnFromEdits = (finalText: string) => {
    const seeded = triage.caseNoteText || capture.smartCleanText || capture.verbatimText || "";
    if (!seeded) return;
    const terms = extractLearnedTerms(seeded, finalText);
    if (terms.length === 0) return;
    addDictionaryTerms(terms, "auto")
      .then((r) => {
        if (r.added.length > 0) {
          addToast(
            `Added ${r.added.map((t) => `“${t}”`).join(", ")} to your Voice Dictionary.`,
            { type: "success" }
          );
        }
      })
      .catch(() => undefined);
  };

  const applyNewMatter = async () => {
    const p = proposals?.newMatter;
    if (!p || proposalBusy) return;
    setProposalBusy("newMatter");
    try {
      const now = new Date().toISOString();
      const created: any = await actions.addItem(
        "matters",
        {
          title: p.title,
          type: p.practiceArea || "General Practice",
          status: "Active",
          stage: "Intake",
          // The intake summary rides along as attorney notes so the file
          // opens with the dictated brief already on it.
          attorneyNotes: [{ text: p.summaryNote, at: now, source: "voice-capture" }],
          parties: [
            ...(p.clientName ? [{ name: p.clientName, role: "Client" }] : []),
            ...(p.opposingParty ? [{ name: p.opposingParty, role: "Opposing Party" }] : []),
          ],
          createdAt: now,
          updatedAt: now,
        },
        "Matter"
      );
      // Intake note into the matters notebook, linked to the new file.
      const note: any = await actions.addItem(
        "notePages",
        {
          matterId: created?.id,
          notebookId: MATTERS_NOTEBOOK_ID,
          title: `Intake — ${p.title}`,
          content: p.summaryNote,
          type: "user",
          createdAt: now,
          updatedAt: now,
        },
        "Intake note"
      );
      await linkCapture({
        clientLocalId: capture.clientLocalId,
        matterId: created?.id,
        notePageId: note?.id,
      }).catch(() => undefined);
      setAppliedProposal("newMatter");
      setSelectedMatterId(created?.id || "");
      addToast(`Matter created — ${p.title}. Chained tasks are in the Diary section.`, {
        type: "success",
      });
    } catch (err: any) {
      addToast(err?.message || "Could not create the matter.", { type: "error" });
    } finally {
      setProposalBusy(null);
    }
  };

  const applyContactUpsert = async () => {
    const p = proposals?.contactUpsert;
    if (!p || proposalBusy) return;
    setProposalBusy("contact");
    try {
      const now = new Date().toISOString();
      if (p.contactId) {
        await actions.updateItem(
          "contacts",
          { id: p.contactId, phone: p.phone || undefined, email: p.email || undefined, companyName: p.company || undefined, jobTitle: p.role || undefined, notes: p.notes || undefined, updatedAt: now },
          "Contact"
        );
        addToast(`Contact updated — ${p.name}.`, { type: "success" });
      } else {
        await actions.addItem(
          "contacts",
          {
            name: p.name,
            phone: p.phone || null,
            email: p.email || null,
            companyName: p.company || null,
            jobTitle: p.role || null,
            notes: p.notes || null,
            contactType: "Client",
            createdAt: now,
            updatedAt: now,
          },
          "Contact"
        );
        addToast(`Contact saved — ${p.name}.`, { type: "success" });
      }
      setAppliedProposal("contact");
    } catch (err: any) {
      addToast(err?.message || "Could not save the contact.", { type: "error" });
    } finally {
      setProposalBusy(null);
    }
  };

  const applyPropertyNote = async () => {
    const p = proposals?.propertyNote;
    if (!p || proposalBusy) return;
    setProposalBusy("propertyNote");
    try {
      const prop = firmProperties.find((x: any) => x.id === p.propertyId);
      const unit = prop?.units?.find?.((u: any) => u.id === p.unitId);
      const now = new Date().toISOString();
      await actions.addItem(
        "notePages",
        {
          propertyId: p.propertyId,
          contextType: "property",
          notebookId: MATTERS_NOTEBOOK_ID,
          title: `Property note — ${prop?.address || "Property"}${unit ? ` (${unit.label || unit.id})` : ""}`,
          content: p.note,
          type: "user",
          rawTranscript: capture.verbatimText || null,
          createdAt: now,
          updatedAt: now,
        },
        "Property note"
      );
      setAppliedProposal("propertyNote");
      addToast(
        `Note logged on ${prop?.address || "the property"}${unit ? ` — ${unit.label || unit.id}` : ""}.`,
        { type: "success" }
      );
    } catch (err: any) {
      addToast(err?.message || "Could not log the property note.", { type: "error" });
    } finally {
      setProposalBusy(null);
    }
  };

  // ── DRAFTING BLUEPRINT (owner spec §4, Phase 2): the Drafting Blueprint
  //    card — documents in dependency order, matter linkage (0.85 gate),
  //    key reliefs, missing-field count, and the Generate & Open CTA that
  //    assembles the bundle deterministically and opens DraftPro.
  const draftBlueprint: DraftBlueprint | null = proposals?.draftBlueprint || null;
  const activeBlueprint = blueprintDraft || draftBlueprint;

  const applyDraftBlueprint = async () => {
    if (!activeBlueprint || proposalBusy) return;
    if (activeBlueprint.documents.length === 0) {
      addToast("Pick at least one document type in the blueprint first.", { type: "info" });
      return;
    }
    setProposalBusy("draft");
    try {
      const matter = matters.find((m) => m.id === selectedMatterId) || null;
      const result = await generateDraftBundle({
        blueprint: activeBlueprint,
        matter,
        firm: coreState.firmDetails,
        user: currentUser,
        onProgress: setGeneratingMsg,
      });
      const isCourt = activeBlueprint.documents.some((d) =>
        ["litigation_process", "appellate_process", "execution_and_enforcement"].includes(
          d.documentCategory
        )
      );
      const title =
        activeBlueprint.documents.length === 1
          ? DOCUMENT_TYPE_LABELS[activeBlueprint.documents[0].documentType]
          : `${DOCUMENT_TYPE_LABELS[activeBlueprint.documents[0].documentType]} + ${
              activeBlueprint.documents.length - 1
            } more`;
      const now = new Date().toISOString();
      const created: any = await actions.addItem(
        "documents",
        {
          title,
          matterId: selectedMatterId || null,
          content: result.html,
          documentType: activeBlueprint.documents[0].documentType,
          source: "Voice Blueprint",
          isCourtProcess: isCourt,
          summary: activeBlueprint.dictated.reliefs.slice(0, 3).join(" ") || null,
          metadata: {
            draftBundle: result.bundle,
            blueprint: activeBlueprint,
            missingFields: result.missing,
            voiceCaptureLocalId: capture.clientLocalId,
          },
          createdAt: now,
          updatedAt: now,
        },
        "Draft"
      );
      const documentId = created?.id as string | undefined;
      const firmId = coreState.firmDetails?.id || "";
      const draftKey = documentId ? `draft:doc:${documentId}` : `draft:${selectedMatterId || "general"}:blueprint`;
      if (firmId) {
        saveDraft(
          draftKey,
          {
            title,
            content: result.html,
            matterId: selectedMatterId || null,
            documentId: documentId || null,
            documentType: activeBlueprint.documents[0].documentType,
            draftBundle: result.bundle,
            updatedAt: now,
            savedAt: Date.now(),
          },
          firmId
        );
      }
      // DRAFTPRO-NEW-TAB — desktop opens the dedicated DraftPro tab; the
      // in-place result is mobile-only (isMobileOrNative), where tabs do
      // not exist and in-app navigation is correct.
      const open = openDraftProNewTab(draftKey, title);
      if (open === "in-place" && isMobileOrNative()) {
        navigateTo("editor", null, {
          documentId,
          matterId: selectedMatterId || undefined,
        });
      }
      setAppliedProposal("draft");
      addToast("Draft generated — finishing it in DraftPro.", { type: "success" });
    } catch (err: any) {
      addToast(err?.message || "Could not generate the draft.", { type: "error" });
    } finally {
      setProposalBusy(null);
      setGeneratingMsg("");
    }
  };

  /** Missing-field count preview: hydrate (pure, no LLM) + the template
   *  required-field diff — computed in code, never by the LLM (AC2.5). */
  const blueprintMissingCount = useMemo(() => {
    if (!activeBlueprint) return 0;
    let count = activeBlueprint.missingCriticalFields.length;
    try {
      const ctx = hydrate({
        blueprint: activeBlueprint,
        matter: (matters.find((m) => m.id === selectedMatterId) || null) as any,
        firm: coreState.firmDetails as any,
        user: currentUser as any,
      });
      count +=
        computeMissingFields(
          ctx,
          activeBlueprint.documents.map((d) => ({ documentType: d.documentType }))
        ).length;
    } catch {
      /* preview only — the real count is computed at generation */
    }
    return count;
  }, [activeBlueprint, matters, selectedMatterId, coreState.firmDetails, currentUser]);

  const applyFinancialEntry = async () => {
    const p = proposals?.financialEntry;
    if (!p || proposalBusy) return;
    setProposalBusy("financial");
    try {
      const now = new Date().toISOString();
      const matterId = p.matterId || selectedMatterId || null;
      await actions.addItem(
        "expenses",
        {
          matterId,
          amount: p.amount,
          description: p.description,
          date: now.slice(0, 10),
          isBillable: p.type === "fee",
          createdAt: now,
          updatedAt: now,
        },
        p.type === "fee" ? "Fee entry" : "Expense"
      );
      setAppliedProposal("financial");
      addToast(
        `${p.type === "fee" ? "Fee" : "Expense"} logged — ₦${p.amount.toLocaleString()}.`,
        { type: "success" }
      );
    } catch (err: any) {
      addToast(err?.message || "Could not log the entry.", { type: "error" });
    } finally {
      setProposalBusy(null);
    }
  };

  const applyTaskUpdate = async (u: { kind: "task" | "event"; itemId: string; status: string; note: string }) => {
    if (proposalBusy) return;
    setProposalBusy(`task-${u.itemId}`);
    try {
      const now = new Date().toISOString();
      await actions.updateItem(
        u.kind === "task" ? "tasks" : "events",
        { id: u.itemId, status: u.status, updatedAt: now },
        u.kind === "task" ? "Task" : "Reminder"
      );
      setTaskUpdatesDone((prev) => [...prev, u.itemId]);
      if (u.note) {
        // The outcome note rides along as a case note so the file history
        // records what was actually found.
        await handleSaveNote().catch(() => undefined);
      }
      addToast(`Marked ${u.status === "Completed" ? "done" : u.status}.`, { type: "success" });
    } catch (err: any) {
      addToast(err?.message || "Could not update the task.", { type: "error" });
    } finally {
      setProposalBusy(null);
    }
  };

  /** The unified primary CTA (owner spec §4): run every selected action on
   *  the note in one tap — save the case note AND add every pending diary
   *  event — then report what happened. */
  const handleUnifiedSave = async () => {
    if (unifiedBusy) return;
    if (!saveNote && !addToDiary) {
      addToast("Pick at least one action — Case Note or Diary.", { type: "info" });
      return;
    }
    setUnifiedBusy(true);
    try {
      if (saveNote) await handleSaveNote();
      if (addToDiary) {
        for (const ev of eventDrafts) {
          if (!ev.dateISO) continue; // undated tasks stay in the quick form
          await handleAddEvent(ev);
        }
      }
    } finally {
      setUnifiedBusy(false);
    }
  };

  const handleAsk = async () => {
    if (asking || askResult) return;
    setAsking(true);
    try {
      const question = triage.questionText || displayText;
      const notebookId =
        coreState.noteNotebooks?.find((nb) => nb.id !== MATTERS_NOTEBOOK_ID)?.id ||
        MATTERS_NOTEBOOK_ID;
      const result = await quickAsk(question.slice(0, 500), { notebookId });
      setAskResult(result);
    } catch (err: any) {
      addToast(err?.message || "Quick Ask failed. Please try again.", { type: "error" });
    } finally {
      setAsking(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      addToast("Copied.", { type: "success" });
    } catch {
      addToast("Could not access the clipboard on this device.", { type: "error" });
    }
  };

  const handleShare = async () => {
    const text = displayText;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Voice note", text });
      } else {
        await navigator.clipboard.writeText(text);
        addToast("Sharing is unavailable here — text copied instead.", { type: "info" });
      }
    } catch { /* user dismissed the share sheet */ }
  };

  const handleDiscard = async () => {
    if (!onDelete) return;
    setDiscarding(true);
    try {
      await onDelete(capture);
    } finally {
      setDiscarding(false);
      setConfirmDiscard(false);
    }
  };

  const pendingEventCount = eventDrafts.filter(
    (ev) => ev.dateISO && !savedEvents.includes(ev.title + ev.dateISO)
  ).length;
  const unifiedLabel =
    saveNote && addToDiary
      ? "Save Case Note & Add to Diary"
      : saveNote
        ? "Save as Case Note"
        : addToDiary
          ? "Add to Diary"
          : "Choose an action";
  const allDone =
    (!saveNote || savedNote) && (!addToDiary || savedEvents.length > 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700">
              <CheckIcon className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base leading-tight">
              {triage.summary || "Voice note ready"}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {capture.provider === "openai-whisper" ? "Whisper" : capture.provider || "Transcribed"}
            {" · "}
            {Math.round((capture.durationMs || 0) / 1000)}s
            {clipCount > 1 ? ` · ${clipCount} clips` : ""}
            {capture.polishError ? " · Smart Clean unavailable (verbatim shown)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onDelete ? (
            confirmDiscard ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  loading={discarding}
                  onClick={() => void handleDiscard()}
                >
                  Discard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={XMarkIcon}
                  aria-label="Keep this note"
                  onClick={() => setConfirmDiscard(false)}
                />
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={TrashIcon}
                aria-label="Discard and delete this voice note"
                title="Discard this voice note (saved case notes are kept)"
                className="!text-slate-400 hover:!text-rose-600"
                onClick={() => setConfirmDiscard(true)}
              />
            )
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>

      {/* Editable transcript draft with Formatted / Verbatim toggle.
          The toggle sits in this header row — NOT absolutely positioned over
          the text — so the first line of the transcript can never be covered. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Transcript — editable draft{clipCount > 1 ? ` (${clipCount} clips)` : ""}
          </span>
          <div className="flex items-center gap-1.5">
            {capture.smartCleanText || triage.caseNoteText ? (
              <Button
                variant={draftSource === "verbatim" ? "outline" : "dark"}
                size="sm"
                onClick={onToggleSource}
              >
                {draftSource === "verbatim" ? "Formatted" : "Verbatim"}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onResyncDraft}>
              Re-sync
            </Button>
          </div>
        </div>
        <Textarea
          aria-label="Voice note draft — edit or add more by voice"
          value={draftText}
          onChange={(e) => onDraftChange((e.target as HTMLTextAreaElement).value)}
          onSelect={(e) => {
            const el = e.target as HTMLTextAreaElement;
            setSelection(
              el.selectionStart !== null && el.selectionEnd !== null && el.selectionEnd > el.selectionStart
                ? { start: el.selectionStart, end: el.selectionEnd }
                : null
            );
          }}
          rows={6}
          maxLength={100000}
          className="!text-base !leading-relaxed !max-h-56 overflow-y-auto"
          style={{ minHeight: "7rem" }}
        />
        {/* EDIT SELECTION BY VOICE (owner spec 2026-11-19 §6): a highlighted
            passage becomes the target of a spoken edit command; only that
            passage is rewritten, the rest of the draft is untouched. */}
        {selection && onEditSelection ? (
          <Button
            variant="outline"
            size="md"
            minTouchTarget
            icon={EditIcon}
            onClick={() => {
              onEditSelection(selection.start, selection.end);
              setSelection(null);
            }}
          >
            Edit Selection by Voice — speak your change
          </Button>
        ) : null}
        {/* Add More — the incremental dictation launcher, directly above the
            primary "Save / Route" action per the owner addendum. */}
        <Button
          variant="outline"
          size="lg"
          fullWidth
          minTouchTarget
          icon={MicrophoneIcon}
          onClick={onAddMore}
          disabled={addMoreDisabled}
        >
          Add More — continue dictating
        </Button>
      </div>

      {/* ── WORKSPACE PROPOSALS (owner spec 2026-11-19, Part 1) ────────────
          The analysis matched this note against the firm's live directories
          and proposes context-driven actions: create a new matter, save a
          contact, log a property/unit note, kick off a draft, log an
          expense/fee, or mark an open task/reminder done. Each card is a
          1-tap apply with a dismiss — nothing is forced. */}
      {proposals ? (
        <div className="flex flex-col gap-2">
          {proposals.newMatter && !dismissedProposals.includes("newMatter") ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-700">
                    New instruction — create matter
                  </span>
                  <p className="font-semibold text-sm text-slate-900 mt-0.5 break-words">
                    {proposals.newMatter.title}
                  </p>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    {[
                      proposals.newMatter.practiceArea,
                      proposals.newMatter.clientName,
                      proposals.newMatter.opposingParty,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {appliedProposal === "newMatter" ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">
                    <CheckIcon className="w-3 h-3" /> Created
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={XMarkIcon}
                    aria-label="Dismiss new matter proposal"
                    className="!text-slate-400 shrink-0"
                    onClick={() => setDismissedProposals((d) => [...d, "newMatter"])}
                  />
                )}
              </div>
              {proposals.newMatter.summaryNote ? (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-6">
                  {proposals.newMatter.summaryNote}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={appliedProposal === "newMatter" ? "success" : "primary"}
                  size="sm"
                  minTouchTarget
                  icon={appliedProposal === "newMatter" ? CheckIcon : PlusIcon}
                  disabled={appliedProposal === "newMatter"}
                  loading={proposalBusy === "newMatter"}
                  onClick={() => void applyNewMatter()}
                >
                  {appliedProposal === "newMatter" ? "Matter created" : "Create Matter"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  minTouchTarget
                  onClick={() => setDismissedProposals((d) => [...d, "newMatter"])}
                >
                  Link to Existing Matter instead
                </Button>
              </div>
            </div>
          ) : null}

          {proposals.contactUpsert && !dismissedProposals.includes("contact") ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-sky-700">
                    {proposals.contactUpsert.contactId ? "Update contact" : "New contact"}
                  </span>
                  <p className="font-semibold text-sm text-slate-900 mt-0.5">
                    {proposals.contactUpsert.name}
                  </p>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    {[
                      proposals.contactUpsert.phone,
                      proposals.contactUpsert.email,
                      proposals.contactUpsert.company,
                      proposals.contactUpsert.role,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {appliedProposal === "contact" ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">
                    <CheckIcon className="w-3 h-3" /> Saved
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={XMarkIcon}
                    aria-label="Dismiss contact proposal"
                    className="!text-slate-400 shrink-0"
                    onClick={() => setDismissedProposals((d) => [...d, "contact"])}
                  />
                )}
              </div>
              {proposals.contactUpsert.notes ? (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {proposals.contactUpsert.notes}
                </p>
              ) : null}
              <Button
                variant={appliedProposal === "contact" ? "success" : "outline"}
                size="sm"
                minTouchTarget
                icon={appliedProposal === "contact" ? CheckIcon : UserIcon}
                disabled={appliedProposal === "contact"}
                loading={proposalBusy === "contact"}
                onClick={() => void applyContactUpsert()}
                className="self-start"
              >
                {appliedProposal === "contact"
                  ? "Contact saved"
                  : proposals.contactUpsert.contactId
                    ? "Update Contact"
                    : "Save Contact"}
              </Button>
            </div>
          ) : null}

          {proposals.propertyNote && !dismissedProposals.includes("propertyNote") ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-teal-700">
                    Property / unit note
                  </span>
                  <p className="font-semibold text-sm text-slate-900 mt-0.5">
                    {(firmProperties.find((x: any) => x.id === proposals.propertyNote!.propertyId) as any)?.address ||
                      "Property on record"}
                    {proposals.propertyNote.unitId
                      ? ` — ${
                          (firmProperties.find((x: any) => x.id === proposals.propertyNote!.propertyId) as any)?.units?.find?.(
                            (u: any) => u.id === proposals.propertyNote!.unitId
                          )?.label || "unit"
                        }`
                      : ""}
                  </p>
                </div>
                {appliedProposal === "propertyNote" ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">
                    <CheckIcon className="w-3 h-3" /> Logged
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={XMarkIcon}
                    aria-label="Dismiss property note proposal"
                    className="!text-slate-400 shrink-0"
                    onClick={() => setDismissedProposals((d) => [...d, "propertyNote"])}
                  />
                )}
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-6">
                {proposals.propertyNote.note}
              </p>
              <Button
                variant={appliedProposal === "propertyNote" ? "success" : "outline"}
                size="sm"
                minTouchTarget
                icon={appliedProposal === "propertyNote" ? CheckIcon : OfficeBuildingIcon}
                disabled={appliedProposal === "propertyNote"}
                loading={proposalBusy === "propertyNote"}
                onClick={() => void applyPropertyNote()}
                className="self-start"
              >
                {appliedProposal === "propertyNote" ? "Note logged" : "Log Property Note"}
              </Button>
            </div>
          ) : null}

          {activeBlueprint && !dismissedProposals.includes("draft") ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Drafting Blueprint
                  </span>
                  <p className="font-semibold text-sm text-slate-900 mt-0.5">
                    {activeBlueprint.documents.length > 0
                      ? activeBlueprint.documents
                          .map((d) => DOCUMENT_TYPE_LABELS[d.documentType])
                          .join(" → ")
                      : "Document type needed"}
                  </p>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    {matters.find((m) => m.id === selectedMatterId)?.title ? (
                      <>Linked: {matters.find((m) => m.id === selectedMatterId)!.title}</>
                    ) : activeBlueprint.matchConfidence > 0 ? (
                      <>No matter linked · best match {Math.round(activeBlueprint.matchConfidence * 100)}% (below the 85% auto-link bar)</>
                    ) : (
                      "No matter linked (standalone draft)"
                    )}
                  </p>
                </div>
                {appliedProposal === "draft" ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">
                    <CheckIcon className="w-3 h-3" /> Generated
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={XMarkIcon}
                    aria-label="Dismiss drafting blueprint"
                    className="!text-slate-400 shrink-0"
                    onClick={() => setDismissedProposals((d) => [...d, "draft"])}
                  />
                )}
              </div>

              {/* Low-confidence matter disambiguation (spec §4.5): one-tap
                  alternatives — never auto-linked below 0.85. */}
              {!selectedMatterId && activeBlueprint.matchAlternatives.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeBlueprint.matchAlternatives.map((alt) => (
                    <Button
                      key={alt.matterId}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMatterId(alt.matterId)}
                      className="!rounded-full !text-2xs !font-medium !text-indigo-700 !border-indigo-200 hover:!bg-indigo-100 truncate max-w-[220px]"
                      title={`Link to ${alt.label}`}
                    >
                      Link: {alt.label} ({Math.round(alt.score * 100)}%)
                    </Button>
                  ))}
                </div>
              ) : null}

              {/* Key reliefs / terms — first 3, expandable (spec §4). */}
              {activeBlueprint.dictated.reliefs.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {(blueprintExpanded
                    ? activeBlueprint.dictated.reliefs
                    : activeBlueprint.dictated.reliefs.slice(0, 3)
                  ).map((r, i) => (
                    <p key={i} className="text-xs text-slate-700 leading-relaxed">
                      • {r}
                    </p>
                  ))}
                  {activeBlueprint.dictated.reliefs.length > 3 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-2xs !font-semibold self-start !px-1 !py-0.5"
                      onClick={() => setBlueprintExpanded((v) => !v)}
                    >
                      {blueprintExpanded
                        ? "Show less"
                        : `+ ${activeBlueprint.dictated.reliefs.length - 3} more relief${
                            activeBlueprint.dictated.reliefs.length - 3 === 1 ? "" : "s"
                          }`}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {/* Missing fields count (computed in code — AC2.5). */}
              <p className="text-2xs text-slate-500">
                {blueprintMissingCount > 0
                  ? `${blueprintMissingCount} field${blueprintMissingCount === 1 ? "" : "s"} to fill — placeholders stay clickable in DraftPro.`
                  : "All critical fields sourced from the file record."}
              </p>

              {/* Edit blueprint mode (spec §4 secondary action). */}
              {blueprintEditing ? (
                <div className="flex flex-col gap-2 rounded-lg bg-white border border-indigo-100 p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {activeBlueprint.documents.map((d, i) => (
                      <span
                        key={`${d.documentType}-${i}`}
                        className="inline-flex items-center gap-1 text-2xs font-semibold text-white bg-indigo-600 rounded-full px-2 py-1"
                      >
                        {i + 1}. {DOCUMENT_TYPE_LABELS[d.documentType]}
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={XMarkIcon}
                          aria-label={`Remove ${DOCUMENT_TYPE_LABELS[d.documentType]}`}
                          className="!text-white hover:!text-indigo-200 !p-0 !w-4 !h-4"
                          onClick={() =>
                            setBlueprintDraft({
                              ...activeBlueprint,
                              documents: activeBlueprint.documents.filter((_, idx) => idx !== i),
                            })
                          }
                        />
                      </span>
                    ))}
                    <Select
                      value=""
                      options={[
                        { value: "", label: "+ Add document…" },
                        ...DOCUMENT_TYPES.filter(
                          (t) => !activeBlueprint.documents.some((d) => d.documentType === t)
                        ).map((t) => ({ value: t, label: DOCUMENT_TYPE_LABELS[t] })),
                      ]}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setBlueprintDraft({
                          ...activeBlueprint,
                          documents: [
                            ...activeBlueprint.documents,
                            {
                              documentType: v as (typeof activeBlueprint.documents)[number]["documentType"],
                              documentCategory: activeBlueprint.documents[0]?.documentCategory ?? "litigation_process",
                              order: activeBlueprint.documents.length + 1,
                            },
                          ],
                        });
                      }}
                      className="!w-auto min-w-[180px] !text-2xs"
                    />
                  </div>
                  <Textarea
                    value={blueprintReliefsText}
                    onChange={(e) => setBlueprintReliefsText(e.target.value)}
                    placeholder="One relief per line…"
                    rows={4}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      minTouchTarget
                      onClick={() => {
                        const reliefs = blueprintReliefsText
                          .split(/\n+/)
                          .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
                          .filter(Boolean);
                        setBlueprintDraft({
                          ...activeBlueprint,
                          dictated: { ...activeBlueprint.dictated, reliefs },
                        });
                        setBlueprintEditing(false);
                      }}
                    >
                      Save blueprint
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      minTouchTarget
                      onClick={() => {
                        setBlueprintDraft(null);
                        setBlueprintEditing(false);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ) : null}

              {appliedProposal !== "draft" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    minTouchTarget
                    icon={DocumentTextIcon}
                    loading={proposalBusy === "draft"}
                    onClick={() => void applyDraftBlueprint()}
                  >
                    {proposalBusy === "draft"
                      ? generatingMsg || "Assembling…"
                      : "Generate & Open in DraftPro →"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    minTouchTarget
                    icon={EditIcon}
                    disabled={proposalBusy === "draft"}
                    onClick={() => {
                      setBlueprintReliefsText(activeBlueprint.dictated.reliefs.join("\n"));
                      setBlueprintEditing(true);
                    }}
                  >
                    Edit blueprint
                  </Button>
                </div>
              ) : (
                <p className="text-2xs text-slate-500">
                  Opened in DraftPro — fill the placeholder pills and export.
                </p>
              )}
            </div>
          ) : null}

          {proposals.financialEntry && !dismissedProposals.includes("financial") ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    {proposals.financialEntry.type === "fee" ? "Fee earned" : "Expense logged by voice"}
                  </span>
                  <p className="font-semibold text-sm text-slate-900 mt-0.5">
                    {proposals.financialEntry.currency === "NGN"
                      ? "₦"
                      : `${proposals.financialEntry.currency} `}
                    {proposals.financialEntry.amount.toLocaleString()}
                  </p>
                  <p className="text-2xs text-slate-500 mt-0.5">
                    {proposals.financialEntry.description}
                    {proposals.financialEntry.matterId
                      ? ` · ${
                          matters.find((m) => m.id === proposals.financialEntry!.matterId)?.title || "linked matter"
                        }`
                      : ""}
                  </p>
                </div>
                {appliedProposal === "financial" ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">
                    <CheckIcon className="w-3 h-3" /> Logged
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={XMarkIcon}
                    aria-label="Dismiss financial entry proposal"
                    className="!text-slate-400 shrink-0"
                    onClick={() => setDismissedProposals((d) => [...d, "financial"])}
                  />
                )}
              </div>
              <Button
                variant={appliedProposal === "financial" ? "success" : "outline"}
                size="sm"
                minTouchTarget
                icon={appliedProposal === "financial" ? CheckIcon : BanknotesIcon}
                disabled={appliedProposal === "financial"}
                loading={proposalBusy === "financial"}
                onClick={() => void applyFinancialEntry()}
                className="self-start"
              >
                {appliedProposal === "financial" ? "Entry logged" : "Log Entry"}
              </Button>
            </div>
          ) : null}

          {proposals.taskUpdates.map((u, i) =>
            taskUpdatesDone.includes(u.itemId) ? (
              <div
                key={u.itemId}
                className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3"
              >
                <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-slate-700">
                  Marked {u.status === "Completed" ? "done" : u.status}
                  {u.note ? ` — ${u.note}` : ""}
                </p>
              </div>
            ) : (
              <div
                key={`${u.itemId}-${i}`}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {u.kind === "event" ? "Reminder reported done" : "Task reported done"}
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {u.note || "Mark this open item as done instead of creating a duplicate."}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={XMarkIcon}
                    aria-label="Dismiss task update"
                    className="!text-slate-400 shrink-0"
                    onClick={() => setTaskUpdatesDone((prev) => [...prev, u.itemId])}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  minTouchTarget
                  icon={CheckIcon}
                  loading={proposalBusy === `task-${u.itemId}`}
                  onClick={() => void applyTaskUpdate(u)}
                  className="self-start"
                >
                  Mark {u.status === "Completed" ? "Done" : u.status}
                </Button>
              </div>
            )
          )}

          {/* Warm client-update draft (register shifting, Part 2 §2). */}
          {(proposals.clientUpdateText || triage.clientUpdateText) &&
          !dismissedProposals.includes("clientUpdate") ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50/50 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-rose-700">
                Client update drafted
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {proposals.clientUpdateText || triage.clientUpdateText}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  minTouchTarget
                  icon={ClipboardIcon}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(proposals.clientUpdateText || triage.clientUpdateText || "")
                      .then(() => addToast("Client update copied — paste it into WhatsApp or email.", { type: "success" }))
                      .catch(() => addToast("Could not access the clipboard on this device.", { type: "error" }));
                  }}
                  className="self-start"
                >
                  Copy Client Update
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissedProposals((d) => [...d, "clientUpdate"])}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── SEMANTIC MATTER MATCHING (owner spec §2) ───────────────────────
          Auto-selected best match + 1-tap disambiguation pills for similar
          names, plus the full dropdown for everything else. */}
      {matterOptions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-500">File under matter</span>
          {matchPills.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" aria-label="Suggested matters">
              {matchPills.map((match) => {
                const matter = matters.find((m) => m.id === match.matterId);
                const active = selectedMatterId === match.matterId;
                return (
                  <Button
                    key={match.matterId}
                    variant={active ? "primary" : "outline"}
                    size="sm"
                    minTouchTarget
                    className="!max-w-full"
                    icon={active ? CheckIcon : undefined}
                    title={match.reason || "Matched from your note"}
                    onClick={() => setSelectedMatterId(match.matterId)}
                  >
                    <span className="truncate max-w-[180px]">
                      {matter?.title || "Matter"}
                    </span>
                    <span className="text-2xs opacity-70 ml-1">
                      {Math.round((match.confidence || 0) * 100)}%
                    </span>
                  </Button>
                );
              })}
            </div>
          ) : matchPills.length === 1 ? (
            <p className="text-2xs text-slate-400 leading-snug">
              Matched “{matchPills[0].reason || "from your note"}” with{" "}
              {Math.round((matchPills[0].confidence || 0) * 100)}% confidence.
            </p>
          ) : null}
          <Select
            aria-label="File under matter"
            options={matterOptions}
            value={selectedMatterId}
            onChange={(e) => setSelectedMatterId((e.target as HTMLSelectElement).value)}
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">No matters yet — the note will be saved standalone.</p>
      )}

      {/* ── MULTI-INTENT TOGGLES (owner spec §4) ───────────────────────────
          One note can be both a Case Note and a Diary task. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="What should happen to this note">
        <Button
          variant={saveNote ? "primary" : "outline"}
          size="sm"
          minTouchTarget
          icon={saveNote ? CheckIcon : DocumentTextIcon}
          onClick={() => setSaveNote((v) => !v)}
          aria-pressed={saveNote}
        >
          Case Note
        </Button>
        <Button
          variant={addToDiary ? "primary" : "outline"}
          size="sm"
          minTouchTarget
          icon={addToDiary ? CheckIcon : CalendarIcon}
          onClick={() => {
            setAddToDiary((v) => !v);
          }}
          aria-pressed={addToDiary}
        >
          Diary
        </Button>
        <Button
          variant="ghost"
          size="sm"
          minTouchTarget
          icon={SparklesIcon}
          onClick={() => void handleAsk()}
          loading={asking}
        >
          Quick Ask
        </Button>
        <Button variant="ghost" size="sm" minTouchTarget icon={ClipboardIcon} onClick={() => void handleCopy()}>
          Copy
        </Button>
        <Button variant="ghost" size="sm" minTouchTarget icon={ShareIcon} onClick={() => void handleShare()}>
          Share…
        </Button>
      </div>

      {/* ── DIARY (owner spec §3) — inline editable events, never a dead end. */}
      {addToDiary ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <span className="text-xs font-semibold text-slate-500">
            Add to Diary{eventDrafts.length > 0 ? ` — ${eventDrafts.length} item${eventDrafts.length > 1 ? "s" : ""} from your note` : ""}
          </span>
          {eventDrafts.map((ev, i) => {
            const key = ev.title + ev.dateISO;
            const added = savedEvents.includes(key);
            const undated = !ev.dateISO;
            return (
              <div
                key={`${ev.title}-${i}`}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-slate-900 min-w-0">
                    <span className="truncate block">{ev.title}</span>
                    <span className="block text-2xs font-normal text-slate-400 truncate">
                      {coerceEventType(ev.type, eventTypeNames)}
                      {ev.location ? ` · ${ev.location}` : ""}
                      {ev.timeEstimated ? " · time estimated — tap to change" : ""}
                    </span>
                  </p>
                  {added ? (
                    <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 shrink-0">
                      <CheckIcon className="w-3 h-3" /> Added
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label={`Date for ${ev.title}`}
                    value={undated ? quickForm.dateISO : ev.dateISO}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      setEventDrafts((drafts) =>
                        drafts.map((d, j) => (j === i ? { ...d, dateISO: v } : d))
                      );
                    }}
                    styleVariant="modern"
                    containerClassName="flex-1 min-w-0"
                  />
                  <Input
                    type="time"
                    aria-label={`Time for ${ev.title}`}
                    value={ev.time || "09:00"}
                    onChange={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      setEventDrafts((drafts) =>
                        drafts.map((d, j) =>
                          j === i ? { ...d, time: v, timeEstimated: false } : d
                        )
                      );
                    }}
                    styleVariant="modern"
                    containerClassName="flex-1 min-w-0"
                  />
                  <Button
                    variant={added ? "success" : "primary"}
                    size="sm"
                    minTouchTarget
                    icon={added ? CheckIcon : CalendarIcon}
                    disabled={added}
                    onClick={() =>
                      void handleAddEvent({
                        ...ev,
                        dateISO: undated ? quickForm.dateISO : ev.dateISO,
                      })
                    }
                  >
                    {added ? "Added" : "Add"}
                  </Button>
                </div>
                {/* Diary note (owner spec §A + 2026-11-19): the concise
                    action summary that lands in the entry's Notes field —
                    pre-filled by the analysis, editable inline before save. */}
                {!added ? (
                  <Textarea
                    aria-label={`Diary note for ${ev.title}`}
                    value={ev.note || ""}
                    onChange={(e) => {
                      const v = (e.target as HTMLTextAreaElement).value;
                      setEventDrafts((drafts) =>
                        drafts.map((d, j) => (j === i ? { ...d, note: v } : d))
                      );
                    }}
                    rows={2}
                    maxLength={600}
                    placeholder="Diary note — the action summary saved on the calendar entry (edit freely)."
                    className="!text-xs !leading-relaxed"
                  />
                ) : null}
              </div>
            );
          })}

          {/* ZERO DEAD-END FALLBACK: no dates were spoken → the inline
              quick-schedule form appears immediately, prefilled with the
              note summary, the matched matter, tomorrow at 9:00 AM. */}
          {eventDrafts.length === 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-3">
              <span className="text-xs font-semibold text-emerald-800">
                Quick schedule — no date was spoken
              </span>
              <Input
                aria-label="Event title"
                value={quickForm.title}
                onChange={(e) =>
                  setQuickForm((f) => ({ ...f, title: (e.target as HTMLInputElement).value }))
                }
                styleVariant="modern"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="Event date"
                  value={quickForm.dateISO}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, dateISO: (e.target as HTMLInputElement).value }))
                  }
                  styleVariant="modern"
                  containerClassName="flex-1 min-w-0"
                />
                <Input
                  type="time"
                  aria-label="Event time"
                  value={quickForm.time}
                  onChange={(e) =>
                    setQuickForm((f) => ({ ...f, time: (e.target as HTMLInputElement).value }))
                  }
                  styleVariant="modern"
                  containerClassName="flex-1 min-w-0"
                />
              </div>
              <Button
                variant="primary"
                size="md"
                minTouchTarget
                icon={CalendarIcon}
                onClick={() =>
                  void handleAddEvent({
                    title: quickForm.title,
                    type: "Meeting",
                    dateISO: quickForm.dateISO,
                    time: quickForm.time,
                  })
                }
              >
                Add to Diary — {quickForm.dateISO} at {quickForm.time || "09:00"}
              </Button>
            </div>
          ) : null}

          {/* One-tap schedule for an undated extracted task. */}
          {eventDrafts.some((e) => !e.dateISO) ? (
            <p className="text-2xs text-slate-400 leading-snug">
              Undated tasks default to the date shown — change it inline before adding.
            </p>
          ) : null}

          {savedEvents.length > 0 && onOpenCalendar ? (
            <Button variant="ghost" size="sm" onClick={onOpenCalendar}>
              Open calendar
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ── ENDORSEMENT (owner spec §4) — structured courtroom fields. ───── */}
      {hasEndorsement && endorsement ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Courtroom endorsement detected
          </span>
          <div className="text-sm text-slate-800 leading-relaxed">
            {endorsement.court ? <p className="font-semibold">{endorsement.court}</p> : null}
            {endorsement.suitNumber ? (
              <p className="text-xs text-slate-600">Suit No: {endorsement.suitNumber}</p>
            ) : null}
            {endorsement.parties ? (
              <p className="text-xs text-slate-600">Parties: {endorsement.parties}</p>
            ) : null}
            {endorsement.judge ? (
              <p className="text-xs text-slate-600">Judge: {endorsement.judge}</p>
            ) : null}
            {endorsement.orders && endorsement.orders.length > 0 ? (
              <ol className="list-decimal ml-4 mt-1 text-xs text-slate-700 space-y-0.5">
                {endorsement.orders.map((order, i) => (
                  <li key={i}>{order}</li>
                ))}
              </ol>
            ) : null}
          </div>
          {endorsement.nextAdjournedDate ? (
            <Button
              variant={adjournedAdded ? "success" : "outline"}
              size="sm"
              minTouchTarget
              icon={adjournedAdded ? CheckIcon : CalendarIcon}
              disabled={adjournedAdded}
              onClick={async () => {
                const ok = await handleAddEvent({
                  title: `Adjourned — ${endorsement.suitNumber || endorsement.parties || "matter"}`,
                  type: "Mention",
                  dateISO: endorsement.nextAdjournedDate!,
                  time: endorsement.nextAdjournedTime || "09:00",
                  location: endorsement.court,
                  // Concise Notes field for the diary entry (§A): the formal
                  // endorsement block, not the raw transcript.
                  note: formatEndorsementText(endorsement).slice(0, 600) || undefined,
                });
                if (ok) setAdjournedAdded(true);
              }}
            >
              {adjournedAdded
                ? "Adjourned date added"
                : `Add adjourned date (${endorsement.nextAdjournedDate}) to Diary`}
            </Button>
          ) : null}
          <p className="text-2xs text-amber-700/80 leading-snug">
            The full endorsement text rides along in the saved case note.
          </p>
        </div>
      ) : null}

      {/* ── UNIFIED PRIMARY CTA (owner spec §4) ──────────────────────────── */}
      <Button
        variant={allDone ? "success" : "primary"}
        size="lg"
        fullWidth
        minTouchTarget
        loading={unifiedBusy}
        icon={allDone ? CheckIcon : undefined}
        onClick={() => void handleUnifiedSave()}
        disabled={allDone}
      >
        {allDone
          ? "Saved"
          : unifiedLabel}
      </Button>
      {allDone ? (
        <div className="flex flex-wrap gap-2">
          {onOpenMatter && selectedMatterId ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenMatter(selectedMatterId)}>
              Open matter
            </Button>
          ) : null}
          {onOpenCalendar ? (
            <Button variant="ghost" size="sm" onClick={onOpenCalendar}>
              Open calendar
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      ) : null}

      {/* ── QUICK ASK (owner spec §5) — now action-capable; confirmations
          render as cards with View / Undo. */}
      {askResult ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-base leading-relaxed text-slate-800 whitespace-pre-wrap">
            {askResult.answer}
          </div>
          <QuickAskActions actions={askResult.actions || []} />
          {[
            ...askResult.sources.matters.slice(0, 3),
            ...askResult.sources.notes.slice(0, 2),
            ...askResult.sources.events.slice(0, 3),
          ].length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {askResult.sources.matters.slice(0, 3).map((s) => (
                <span
                  key={s.id}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 truncate max-w-[200px]"
                >
                  Matter: {s.title}
                </span>
              ))}
              {askResult.sources.notes.slice(0, 2).map((s) => (
                <span
                  key={s.id}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 truncate max-w-[200px]"
                >
                  Note: {s.title}
                </span>
              ))}
              {askResult.sources.events.slice(0, 3).map((s) => (
                <span
                  key={s.id}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 truncate max-w-[200px]"
                >
                  Schedule: {s.title}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
