import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  Mic,
  MicOff,
  Square,
  X,
} from "lucide-react";
import { useDataActions } from "../../contexts/DataContext";
import { useDocumentState } from "../../contexts/DocumentContext";
import { useExecutionState } from "../../contexts/ExecutionContext";
import { useMatterState } from "../../contexts/MatterContext";
import { useUI } from "../../contexts/UIContext";
import { useFeatures } from "../../hooks/useFeatures";
import { useQuickCapture } from "../../hooks/useQuickCapture";
import { stampVoxUsedAt } from "../../utils/voxUsageTracking";
import { Button, Select, Textarea } from "../ui";
import { VoxUpsellModal } from "../quickcapture/VoxUpsellModal";
import { CourtHearing, getCourtModeMatters, mergeLiveTranscriptDraft } from "./courtModeUtils";

interface AloaCourtModeProps {
  onBackToChat: () => void;
  onClose: () => void;
}

function formatDate(value: string): string {
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = new Date(dateOnly && !value.includes("T") ? `${dateOnly}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const InfoCard: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{label}</div>
    <div className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-zinc-100">{value?.trim() || "Not on record"}</div>
  </div>
);

const HearingRow: React.FC<{ hearing: CourtHearing; label?: string }> = ({ hearing, label }) => (
  <div className="flex min-w-0 items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-zinc-900/70">
    <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600 dark:text-primary-400" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{formatDate(hearing.date)}</span>
        {label ? <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span> : null}
      </div>
      <div className="break-words text-xs text-slate-600 dark:text-zinc-400">{hearing.title}</div>
    </div>
  </div>
);

export const AloaCourtMode: React.FC<AloaCourtModeProps> = ({ onBackToChat, onClose }) => {
  const { matterState } = useMatterState();
  const { executionState } = useExecutionState();
  const { documentState } = useDocumentState();
  const { handleAddMatterNote } = useDataActions();
  const { addToast, navigateTo } = useUI();
  const { canUseVox } = useFeatures();
  const capture = useQuickCapture({ outputMode: "verbatim" });
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [draftsByMatter, setDraftsByMatter] = useState<Record<string, string>>({});
  const [noteType, setNoteType] = useState<"endorsement" | "user">("endorsement");
  const [isSaving, setIsSaving] = useState(false);
  const [showVoxUpsell, setShowVoxUpsell] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const draftsRef = useRef<Record<string, string>>({});
  const baseDraftRef = useRef("");
  const previousTranscriptRef = useRef("");
  const manualEditsRef = useRef(false);
  const recordingMatterIdRef = useRef("");

  const courtMatters = useMemo(
    () => getCourtModeMatters(matterState.matters, executionState.events),
    [matterState.matters, executionState.events],
  );
  const selectedCourtMatter = courtMatters.find(({ matter }) => matter.id === selectedMatterId) || courtMatters[0];
  const selectedMatter = selectedCourtMatter?.matter;
  const currentDraft = selectedMatter ? (draftsByMatter[selectedMatter.id] || "") : "";

  useEffect(() => {
    if (!courtMatters.some(({ matter }) => matter.id === selectedMatterId)) {
      setSelectedMatterId(courtMatters[0]?.matter.id || "");
    }
  }, [courtMatters, selectedMatterId]);

  useEffect(() => {
    draftsRef.current = draftsByMatter;
  }, [draftsByMatter]);

  useEffect(() => {
    const matterId = recordingMatterIdRef.current;
    if (!matterId || !capture.transcriptSoFar) return;
    const merged = mergeLiveTranscriptDraft(
      draftsRef.current[matterId] || "",
      baseDraftRef.current,
      previousTranscriptRef.current,
      capture.transcriptSoFar,
      manualEditsRef.current,
    );
    previousTranscriptRef.current = merged.previousTranscript;
    draftsRef.current = { ...draftsRef.current, [matterId]: merged.draft };
    setDraftsByMatter(draftsRef.current);
  }, [capture.transcriptSoFar]);

  const setCurrentDraft = (value: string) => {
    if (!selectedMatter) return;
    if (capture.phase === "recording" || capture.phase === "processing" || capture.phase === "queued") {
      manualEditsRef.current = true;
    }
    draftsRef.current = { ...draftsRef.current, [selectedMatter.id]: value };
    setDraftsByMatter(draftsRef.current);
  };

  const startDictation = () => {
    if (!selectedMatter) return;
    if (!canUseVox) {
      setShowVoxUpsell(true);
      return;
    }
    stampVoxUsedAt();
    recordingMatterIdRef.current = selectedMatter.id;
    baseDraftRef.current = currentDraft;
    previousTranscriptRef.current = "";
    manualEditsRef.current = false;
    setCaptureError(null);
    void capture.startRecording().catch((error: unknown) => {
      console.error("[AloaCourtMode] Failed to start Vox dictation:", error);
      setCaptureError("Could not start dictation. Check microphone access and try again.");
    });
  };

  const stopDictation = async (): Promise<boolean> => {
    try {
      await capture.stopRecording();
      setCaptureError(null);
      return true;
    } catch (error) {
      console.error("[AloaCourtMode] Failed to stop Vox dictation:", error);
      setCaptureError("Could not finish dictation. Please try stopping again.");
      return false;
    }
  };

  const saveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMatter || !currentDraft.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const titlePrefix = noteType === "endorsement" ? "Court endorsement" : "Court note";
      await handleAddMatterNote(
        selectedMatter.id,
        `${titlePrefix} — ${selectedMatter.title}`,
        currentDraft.trim(),
        noteType,
      );
      draftsRef.current = { ...draftsRef.current, [selectedMatter.id]: "" };
      setDraftsByMatter(draftsRef.current);
      baseDraftRef.current = "";
      previousTranscriptRef.current = "";
      addToast(noteType === "endorsement" ? "Court endorsement saved." : "Matter note saved.", { type: "success" });
    } catch (error) {
      console.error("[AloaCourtMode] Failed to save matter note:", error);
      addToast("Could not save this note. Please try again.", { type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const notes = selectedMatter
    ? documentState.notePages
        .filter((note) => note.matterId === selectedMatter.id && !note.archivedAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5)
    : [];
  const documents = selectedMatter
    ? documentState.documents
        .filter((document) => document.matterId === selectedMatter.id || document.matter?.id === selectedMatter.id)
        .slice(0, 6)
    : [];
  const recording = capture.phase === "recording";
  const waitingForTranscript = capture.phase === "processing" || capture.phase === "queued";
  const captureBusy = recording || waitingForTranscript;

  const leaveCourtMode = (leave: () => void) => {
    if (recording) {
      void stopDictation().then((stopped) => {
        if (stopped) addToast("Dictation stopped. Review the transcript before leaving Court Mode.", { type: "info" });
      });
      return;
    }
    if (waitingForTranscript) {
      addToast("Wait for transcription to finish before leaving, or discard the queued capture.", { type: "info" });
      return;
    }
    leave();
  };

  const discardAndLeave = async (leave: () => void) => {
    if (capture.phase !== "queued" && capture.phase !== "processing") return;
    try {
      await capture.cancelRecording();
      recordingMatterIdRef.current = "";
      previousTranscriptRef.current = "";
      addToast("Queued dictation discarded.", { type: "info" });
      leave();
    } catch (error) {
      console.error("[AloaCourtMode] Failed to discard Vox dictation:", error);
      setCaptureError("Could not discard the queued dictation.");
    }
  };

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-4">
        <Button
          variant="bare"
          size="sm"
          type="button"
          onClick={() => leaveCourtMode(onBackToChat)}
          className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          aria-label="Back to ALOA chat"
        >
          <ArrowLeft className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Back to ALOA</span>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-sm font-extrabold sm:text-base">Court Mode</h2>
          <p className="truncate text-[10px] text-slate-500 dark:text-zinc-500">Matter details, hearings and endorsements</p>
        </div>
        <Button
          variant="bare"
          size="md"
          iconOnly
          icon={X}
          type="button"
          onClick={() => leaveCourtMode(onClose)}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900"
          aria-label="Close Court Mode"
        />
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
        {courtMatters.length === 0 || !selectedMatter || !selectedCourtMatter ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-bold">No active court matters yet</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Active litigation matters and matters with court dates will appear here.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="aloa-court-matter" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Switch matter
              </label>
              <div className="relative">
                <Select
                  id="aloa-court-matter"
                  value={selectedMatter.id}
                  onChange={(event) => setSelectedMatterId(event.target.value)}
                  disabled={captureBusy}
                  styleVariant="bare"
                  selectClassName="min-h-11 w-full min-w-0 appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm font-semibold text-slate-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {courtMatters.map(({ matter }) => (
                    <option key={matter.id} value={matter.id}>{matter.title}</option>
                  ))}
                </Select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>
            </div>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="min-w-0">
                <h3 className="break-words text-base font-extrabold leading-snug">{selectedMatter.title}</h3>
                <p className="mt-1 break-words text-xs text-slate-500 dark:text-zinc-400">
                  {selectedMatter.suitNumber ? `Suit no. ${selectedMatter.suitNumber}` : "Suit number not on record"}
                  {selectedMatter.referenceNumber ? ` · Ref. ${selectedMatter.referenceNumber}` : ""}
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoCard label="Court / forum" value={selectedMatter.court || selectedCourtMatter.upcomingHearings[0]?.court || selectedCourtMatter.previousHearing?.court} />
                <InfoCard label="Judicial division" value={selectedMatter.judicialDivision || selectedCourtMatter.upcomingHearings[0]?.judicialDivision || selectedCourtMatter.previousHearing?.judicialDivision} />
                <InfoCard label="Status" value={selectedMatter.status} />
                <InfoCard label="Current stage" value={selectedMatter.stage} />
              </div>
              {selectedMatter.presidingJudge || selectedMatter.courtRoom ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
                  {selectedMatter.presidingJudge ? <span>Judge: {selectedMatter.presidingJudge}</span> : null}
                  {selectedMatter.courtRoom ? <span>Courtroom: {selectedMatter.courtRoom}</span> : null}
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Hearing dates</h3>
              {selectedCourtMatter.previousHearing ? (
                <HearingRow hearing={selectedCourtMatter.previousHearing} label="Last hearing" />
              ) : (
                <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">No previous hearing recorded.</p>
              )}
              {selectedCourtMatter.upcomingHearings.length ? (
                <div className="space-y-2">
                  {selectedCourtMatter.upcomingHearings.slice(0, 3).map((hearing, index) => (
                    <HearingRow key={hearing.id} hearing={hearing} label={index === 0 ? "Next hearing" : undefined} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">No upcoming hearing recorded.</p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Attached documents</h3>
                <span className="text-[10px] text-slate-400">{documents.length}</span>
              </div>
              {documents.length ? (
                <div className="space-y-2">
                  {documents.map((document) => (
                    <Button
                      variant="bare"
                      size="md"
                      key={document.id}
                      type="button"
                      icon={FileText}
                      disabled={captureBusy}
                      onClick={() => {
                        navigateTo("documentDetail", document.id);
                        onClose();
                      }}
                      className="min-h-11 w-full min-w-0 justify-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-primary-300 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-800"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">{document.title}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">No documents attached to this matter.</p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Matter notes &amp; endorsements</h3>
                <Button
                  variant="bare"
                  size="sm"
                  type="button"
                  disabled={captureBusy}
                  onClick={() => {
                    navigateTo("matterDetail", selectedMatter.id, { initialTab: "endorsements" });
                    onClose();
                  }}
                  className="min-h-9 flex-shrink-0 rounded-lg px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/20"
                >
                  View all
                </Button>
              </div>
              {notes.length ? (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <article key={note.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                        <h4 className="break-words text-xs font-bold">{note.title}</h4>
                        <span className="text-[10px] text-slate-400">{formatDate(note.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{note.content}</p>
                      <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {note.type === "endorsement" ? "Endorsement" : "Note"}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">No notes or endorsements recorded.</p>
              )}
            </section>

            <form onSubmit={(event) => void saveNote(event)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold">Draft a court note</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Review and edit dictated text before saving.</p>
                </div>
                <label className="sr-only" htmlFor="aloa-court-note-type">Note type</label>
                <Select
                  id="aloa-court-note-type"
                  value={noteType}
                  onChange={(event) => setNoteType(event.target.value as "endorsement" | "user")}
                  styleVariant="bare"
                  containerClassName="w-auto flex-shrink-0"
                  selectClassName="min-h-9 max-w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="endorsement">Endorsement</option>
                  <option value="user">Matter note</option>
                </Select>
              </div>

              <Textarea
                value={currentDraft}
                onChange={(event) => setCurrentDraft(event.target.value)}
                rows={5}
                styleVariant="bare"
                textareaClassName="min-h-32 w-full min-w-0 resize-y rounded-md border border-slate-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                containerClassName="w-full"
                placeholder="Type a note or dictate after court. Transcribed text will appear here for review."
                aria-label="Editable court note"
              />

              <div className="flex flex-wrap items-center gap-2">
                {recording ? (
                  <Button
                    variant="bare"
                    size="md"
                    type="button"
                    onClick={() => void stopDictation()}
                    icon={Square}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700"
                  >
                    Stop dictation
                  </Button>
                ) : (
                  <Button
                    variant="bare"
                    size="md"
                    type="button"
                    onClick={startDictation}
                    disabled={!selectedMatter || !capture.supported || waitingForTranscript}
                    icon={canUseVox ? Mic : MicOff}
                    aria-label={canUseVox ? "Start Vox dictation" : "Unlock Vox dictation on Pro"}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary-700 px-4 text-sm font-bold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {canUseVox ? "Dictate with Vox" : "Unlock Vox"}
                  </Button>
                )}
                {waitingForTranscript ? (
                  <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                    {capture.phase === "queued" ? "Saved on this device; waiting for connection" : "Transcribing audio…"}
                  </span>
                ) : null}
                {capture.phase === "triage" && capture.transcriptSoFar ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Transcript ready to review
                  </span>
                ) : null}
                {capture.error || captureError ? <span role="alert" className="w-full break-words text-xs text-rose-600">{capture.error || captureError}</span> : null}
                {!capture.supported ? <span className="w-full text-xs text-rose-600">This browser does not support audio recording.</span> : null}
                {(capture.phase === "queued" || capture.phase === "processing") ? (
                  <Button
                    variant="bare"
                    size="sm"
                    type="button"
                    onClick={() => void discardAndLeave(onBackToChat)}
                    className="min-h-11 rounded-md px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    Discard dictation and leave
                  </Button>
                ) : null}
                <Button
                  variant="bare"
                  size="md"
                  type="submit"
                  disabled={!selectedMatter || !currentDraft.trim() || isSaving || captureBusy}
                  className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isSaving ? "Saving…" : "Save note"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
      {showVoxUpsell ? <VoxUpsellModal onClose={() => setShowVoxUpsell(false)} /> : null}
    </section>
  );
};
