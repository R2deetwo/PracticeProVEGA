/**
 * TriageCard — the Smart Post-Capture Triage confirmation card.
 *
 * "Once the user finishes speaking and stops recording, analyze the cleaned
 * transcript and automatically suggest the single best action on a
 * confirmation card, with one-tap pills underneath to switch destinations."
 * (owner spec, 2026-11-18)
 *
 * Destinations:
 *   1. Save as Case Note — pre-selects the matter when the client/matter
 *      name was mentioned (server-side deterministic match first, LLM
 *      candidates second).
 *   2. Add to Diary / Schedule — extracted dates/times/court deadlines as
 *      one-tap calendar entries.
 *   3. Quick Ask / Search — for questions: a concise, grounded answer from
 *      the firm's own matters, notes and schedule.
 *   4. Copy / Share Text — the polished dictation, immediately.
 */

import React, { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Select, type SelectOption } from "../ui/Select";
import {
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  DocumentTextIcon,
  ShareIcon,
  SparklesIcon,
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

interface TriageCardProps {
  capture: CaptureProjection;
  matters: Matter[];
  /** The firm's calendar type names, used to coerce extracted event types. */
  eventTypeNames: string[];
  onDone: () => void;
  onOpenMatter?: (matterId: string) => void;
  onOpenCalendar?: () => void;
}

type Destination = "case_note" | "schedule" | "question" | "share";

const INTENT_LABEL: Record<Destination, string> = {
  case_note: "Case Note",
  schedule: "Diary",
  question: "Quick Ask",
  share: "Share",
};

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

export const TriageCard: React.FC<TriageCardProps> = ({
  capture,
  matters,
  eventTypeNames,
  onDone,
  onOpenMatter,
  onOpenCalendar,
}) => {
  const { addToast } = useUI();
  const actions = useDataActions();
  const { coreState } = useCoreState();

  const triage = capture.triageMeta || {};
  const [destination, setDestination] = useState<Destination>(
    (capture.triageIntent as Destination) || "share"
  );
  const [showVerbatim, setShowVerbatim] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [savedEvents, setSavedEvents] = useState<string[]>([]);
  const [askResult, setAskResult] = useState<QuickAskResult | null>(null);
  const [asking, setAsking] = useState(false);

  const polishedText = capture.smartCleanText || capture.verbatimText || "";
  const verbatimText = capture.verbatimText || "";
  const displayText = showVerbatim ? verbatimText : polishedText || verbatimText;

  // ── Matter pre-selection: deterministic server matches first, then any
  //    matter whose client name matches a matched contact's matters.
  const preselectedMatterId = useMemo(() => {
    const matched = triage.matchedMatterIds?.[0];
    if (matched && matters.some((m) => m.id === matched)) return matched;
    const matchedContactId = triage.matchedContactIds?.[0];
    if (matchedContactId) {
      const byClient = matters.find((m) => m.clientId === matchedContactId);
      if (byClient) return byClient.id;
    }
    return "";
  }, [triage.matchedMatterIds, triage.matchedContactIds, matters]);

  const [selectedMatterId, setSelectedMatterId] = useState(preselectedMatterId);

  const matterOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = matters.slice(0, 100).map((m) => ({
      value: m.id,
      label: m.title || "(untitled matter)",
    }));
    return opts;
  }, [matters]);

  const events: TriageEventDraft[] = (triage.events || []).slice(0, 3);

  // ─── Destination actions ─────────────────────────────────────────────────

  const handleSaveNote = async () => {
    if (savedNote) return;
    const matter = matters.find((m) => m.id === selectedMatterId);
    const notebookId = matter
      ? MATTERS_NOTEBOOK_ID
      : coreState.noteNotebooks?.find((nb) => nb.id !== MATTERS_NOTEBOOK_ID)?.id ||
        MATTERS_NOTEBOOK_ID;
    try {
      const created: any = await actions.addItem(
        "notePages",
        {
          matterId: matter?.id,
          notebookId,
          title: (triage.summary || polishedText.slice(0, 60) || "Voice note").slice(0, 120),
          content: polishedText || verbatimText,
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
      addToast("Saved as case note" + (matter ? ` — ${matter.title}` : "") + ".", { type: "success" });
    } catch (err: any) {
      addToast(err?.message || "Could not save the note. Please try again.", { type: "error" });
    }
  };

  const handleAddEvent = async (draft: TriageEventDraft) => {
    if (savedEvents.includes(draft.title + draft.dateISO)) return;
    const time = draft.time && /^\d{2}:\d{2}$/.test(draft.time) ? draft.time : "09:00";
    const date = new Date(`${draft.dateISO}T${time}:00`);
    if (isNaN(date.getTime())) {
      addToast("That date could not be parsed — add it manually in the calendar.", { type: "error" });
      return;
    }
    try {
      const created: any = await actions.addItem(
        "events",
        {
          title: draft.title || "Court event",
          description: `From voice note: ${polishedText.slice(0, 400)}`,
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
      setSavedEvents((prev) => [...prev, draft.title + draft.dateISO]);
      await linkCapture({
        clientLocalId: capture.clientLocalId,
        eventId: created?.id,
      }).catch(() => undefined);
      addToast(`Added to diary: ${draft.title} (${draft.dateISO})`, { type: "success" });
    } catch (err: any) {
      addToast(err?.message || "Could not add the diary entry.", { type: "error" });
    }
  };

  const handleAsk = async () => {
    if (asking || askResult) return;
    setAsking(true);
    try {
      const question = triage.questionText || polishedText || verbatimText;
      const result = await quickAsk(question.slice(0, 500));
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
            {capture.polishError ? " · Smart Clean unavailable (verbatim shown)" : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>

      {/* Transcript preview with Smart Clean / Verbatim toggle */}
      <div className="relative">
        <div className="max-h-44 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-base leading-relaxed text-slate-800 whitespace-pre-wrap">
          {displayText || "(no transcript)"}
        </div>
        {capture.smartCleanText ? (
          <div className="absolute top-2 right-2">
            <Button
              variant={showVerbatim ? "outline" : "dark"}
              size="sm"
              onClick={() => setShowVerbatim((v) => !v)}
            >
              {showVerbatim ? "Smart Clean" : "Verbatim"}
            </Button>
          </div>
        ) : null}
      </div>

      {/* One-tap destination pills */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Send this note to">
        {(Object.keys(INTENT_LABEL) as Destination[]).map((d) => (
          <Button
            key={d}
            variant={destination === d ? "primary" : "outline"}
            size="sm"
            minTouchTarget
            onClick={() => {
              setDestination(d);
              if (d === "question" && !askResult) void handleAsk();
            }}
          >
            {d === "case_note" ? <DocumentTextIcon className="w-4 h-4" /> : null}
            {d === "schedule" ? <CalendarIcon className="w-4 h-4" /> : null}
            {d === "question" ? <SparklesIcon className="w-4 h-4" /> : null}
            {d === "share" ? <ShareIcon className="w-4 h-4" /> : null}
            {INTENT_LABEL[d]}
          </Button>
        ))}
      </div>

      {/* Destination panel */}
      {destination === "case_note" && (
        <div className="flex flex-col gap-3">
          {matterOptions.length > 0 ? (
            <Select
              label="File under matter"
              options={matterOptions}
              value={selectedMatterId}
              onChange={(e) => setSelectedMatterId((e.target as HTMLSelectElement).value)}
            />
          ) : (
            <p className="text-sm text-slate-500">No matters yet — the note will be saved standalone.</p>
          )}
          <Button
            variant={savedNote ? "success" : "primary"}
            size="lg"
            fullWidth
            minTouchTarget
            icon={savedNote ? CheckIcon : DocumentTextIcon}
            onClick={handleSaveNote}
            disabled={savedNote}
          >
            {savedNote ? "Saved to case notes" : "Save as Case Note"}
          </Button>
          {savedNote && onOpenMatter && selectedMatterId ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenMatter(selectedMatterId)}>
              Open matter
            </Button>
          ) : null}
        </div>
      )}

      {destination === "schedule" && (
        <div className="flex flex-col gap-3">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">
              No dates or deadlines were detected in this note. Add one manually from the Calendar.
            </p>
          ) : (
            events.map((ev, i) => {
              const key = ev.title + ev.dateISO;
              const added = savedEvents.includes(key);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{ev.title}</p>
                    <p className="text-xs text-slate-500">
                      {ev.dateISO}
                      {ev.time ? ` · ${ev.time}` : ""}
                      {ev.location ? ` · ${ev.location}` : ""}
                      {` · ${coerceEventType(ev.type, eventTypeNames)}`}
                    </p>
                  </div>
                  <Button
                    variant={added ? "success" : "primary"}
                    size="sm"
                    minTouchTarget
                    icon={added ? CheckIcon : CalendarIcon}
                    onClick={() => handleAddEvent(ev)}
                    disabled={added}
                  >
                    {added ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })
          )}
          {savedEvents.length > 0 && onOpenCalendar ? (
            <Button variant="ghost" size="sm" onClick={onOpenCalendar}>
              Open calendar
            </Button>
          ) : null}
        </div>
      )}

      {destination === "question" && (
        <div className="flex flex-col gap-3">
          {asking ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 px-1">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
              Searching your matters, notes and schedule…
            </div>
          ) : askResult ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-base leading-relaxed text-slate-800 whitespace-pre-wrap">
                {askResult.answer}
              </div>
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
          ) : (
            <Button variant="primary" size="lg" fullWidth minTouchTarget icon={SparklesIcon} onClick={handleAsk}>
              Get Answer
            </Button>
          )}
        </div>
      )}

      {destination === "share" && (
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" fullWidth minTouchTarget icon={ClipboardIcon} onClick={handleCopy}>
            Copy Text
          </Button>
          <Button variant="outline" size="lg" fullWidth minTouchTarget icon={ShareIcon} onClick={handleShare}>
            Share…
          </Button>
        </div>
      )}
    </div>
  );
};
