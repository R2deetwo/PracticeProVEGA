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
 */

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select, type SelectOption } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import {
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  ShareIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "../../constants";
import { useUI } from "../../contexts/UIContext";
import { useDataActions } from "../../contexts/DataContext";
import { useCoreState } from "../../contexts/CoreContext";
import { MATTERS_NOTEBOOK_ID } from "../../constants";
import type { Matter } from "../../types";
import {
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
}) => {
  const { addToast } = useUI();
  const actions = useDataActions();
  const { coreState } = useCoreState();

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
    () =>
      matters.slice(0, 100).map((m) => ({
        value: m.id,
        label: m.title || "(untitled matter)",
      })),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture.clientLocalId]);

  const polishedText = capture.smartCleanText || capture.verbatimText || "";
  const verbatimText = capture.verbatimText || "";
  // The working draft (editable, owned by the parent) is what every action
  // uses — manual tweaks are respected, appended clips accumulate in it.
  const displayText = draftText || polishedText || verbatimText;

  // ─── Destination actions ─────────────────────────────────────────────────────────

  const handleSaveNote = async (): Promise<void> => {
    const matter = matters.find((m) => m.id === selectedMatterId);
    const notebookId = matter
      ? MATTERS_NOTEBOOK_ID
      : coreState.noteNotebooks?.find((nb) => nb.id !== MATTERS_NOTEBOOK_ID)?.id ||
        MATTERS_NOTEBOOK_ID;
    try {
      if (savedNote && savedNotePageId) {
        // The note was already saved and more dictation was appended since —
        // UPDATE the same page instead of duplicating it.
        await actions.updateItem(
          "notePages",
          {
            id: savedNotePageId,
            content: displayText,
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
          content: displayText,
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
          description: `From voice note: ${displayText.slice(0, 400)}`,
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

  const endorsement = triage.endorsement;
  const hasEndorsement =
    !!endorsement &&
    !!(endorsement.court || endorsement.suitNumber || endorsement.parties || (endorsement.orders && endorsement.orders.length > 0));

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

      {/* Editable transcript draft with Smart Clean / Verbatim toggle.
          The toggle sits in this header row — NOT absolutely positioned over
          the text — so the first line of the transcript can never be covered. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Transcript — editable draft{clipCount > 1 ? ` (${clipCount} clips)` : ""}
          </span>
          <div className="flex items-center gap-1.5">
            {capture.smartCleanText ? (
              <Button
                variant={draftSource === "verbatim" ? "outline" : "dark"}
                size="sm"
                onClick={onToggleSource}
              >
                {draftSource === "verbatim" ? "Smart Clean" : "Verbatim"}
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
          rows={6}
          maxLength={100000}
          className="!text-base !leading-relaxed !max-h-56 overflow-y-auto"
          style={{ minHeight: "7rem" }}
        />
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
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
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
