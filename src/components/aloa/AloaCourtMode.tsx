/**
 * ALOA Court Mode — Round 19. Container only (routing + shared state); views
 * in ./court/ (dictation in useCourtDictation — the Vox capture hook is
 * UNCHANGED; drafts in useCourtDrafts; data in useCourtModeData). No LLM
 * anywhere; the single write is the visible Save press. Backdrop click does
 * not close Court Mode (AloaPanel). Terminology: DIARY.
 *
 * ROUND 25 (ALOA Vox intelligence overhaul 2026-11-28): the container owns
 * the diary calendar's FOCUS day (the auto-jump for confirmed dictated
 * dates and committed NEXT DATE edits) and the Court ↔ Vox cross-surface
 * link — every dictated-and-saved endorsement's capture row is linked to
 * its matter, so it appears in Vox → Recent voice notes tagged to that
 * matter and can be reopened there for further extraction.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useCoreState } from "../../contexts/CoreContext";
import { useDocumentState } from "../../contexts/DocumentContext";
import { useExecutionState } from "../../contexts/ExecutionContext";
import { useMatterState } from "../../contexts/MatterContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUI } from "../../contexts/UIContext";
import { Button, SectionErrorBoundary } from "../ui";
import { VoxUpsellModal } from "../quickcapture/VoxUpsellModal";
import { canSeeMatter, todayDayKey } from "./courtModeUtils";
import { useCourtDrafts } from "./court/useCourtDrafts";
import { useCourtModeData } from "./court/useCourtModeData";
import { StoredCourtDraft } from "./court/courtDrafts";
import { useCourtDictation } from "./court/useCourtDictation";
import { dayKeyOf, dayLabelOf, nonCourtEventsFor, shortTitle } from "./court/format";
import { linkCapture } from "../../services/voice/voiceCaptureService";
import { DiaryView } from "./court/DiaryView";
import { MatterBriefing } from "./court/MatterBriefing";
import { OutcomeComposer } from "./court/OutcomeComposer";

type CourtView = "diary" | "matter" | "compose";

interface AloaCourtModeProps {
  /** ROUND 24 (§1.1): the mode-level back prop is gone — the panel's Ask |
   *  Vox | Court segmented row owns pane navigation; the inner Back below
   *  only moves WITHIN the Court pane (compose → matter → diary). */
  onClose: () => void;
  initialMatterId?: string;
  /** ROUND 22: reports dictation busyness up to the panel so the Vox
   *  switcher can lock its other segment mid-take (the leave-guard rule). */
  onCaptureBusyChange?: (busy: boolean) => void;
  /** ROUND 24 (§1.2 no accidental loss): the panel's busy-guard Close calls
   *  this to stop a live dictation while KEEPING the transcript — the court
   *  draft store keeps the text, so nothing is lost on close. */
  registerStopAndKeep?: (fn: (() => Promise<unknown> | void) | null) => void;
}

export const AloaCourtMode: React.FC<AloaCourtModeProps> = ({ onClose, initialMatterId, onCaptureBusyChange, registerStopAndKeep }) => {
  const { matterState } = useMatterState();
  const { executionState } = useExecutionState();
  const { documentState } = useDocumentState();
  const { coreState, isDataLoaded } = useCoreState();
  const { currentUser } = useAuth();
  const { addToast, navigateTo, openModal } = useUI();

  const viewerId = currentUser?.id || "";
  const viewerName = currentUser?.name || "you";
  const { drafts, scope, setDraft, setScope } = useCourtDrafts(viewerId);

  const [view, setView] = useState<CourtView>("diary");
  const [selectedMatterId, setSelectedMatterId] = useState<string>("");
  const [query, setQuery] = useState("");
  // ROUND 25: the diary calendar's focus day — set when a dictated date is
  // confirmed in the composer or a NEXT DATE edit commits; the briefing's
  // mini-calendar jumps to that month/date and selects it.
  const [calendarFocusDayKey, setCalendarFocusDayKey] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const {
    userNames,
    eventTypeNames,
    visibleMatters,
    visibleCourtMatters,
    visibleEventList,
    filteredDiary,
    selectedMatter,
    selectedCourtMatter,
  } = useCourtModeData({
    viewerId,
    scope,
    query,
    selectedMatterId,
    users: coreState.users || [],
    eventTypes: coreState.eventTypes || [],
    matters: matterState.matters || [],
    events: executionState.events || [],
    notePages: documentState.notePages || [],
  });

  const dictation = useCourtDictation({ matter: selectedMatter, drafts, setDraft });

  // ROUND 22: keep the panel's Vox switcher informed — a live dictation
  // take locks the Consultation / Note segment until it is finished or
  // discarded (nothing is silently dropped).
  useEffect(() => {
    onCaptureBusyChange?.(dictation.captureBusy);
  }, [dictation.captureBusy, onCaptureBusyChange]);

  // ROUND 24 (§1.2): stop-and-keep is only meaningful mid-dictation — once
  // the transcript is processing/queued the draft store already holds the
  // text, so closing the panel loses nothing.
  useEffect(() => {
    registerStopAndKeep?.(dictation.recording ? () => dictation.stopDictation() : null);
  }, [dictation.recording, dictation.stopDictation, registerStopAndKeep]);

  // Landing: a deep-linked matter opens its briefing (only when visible).
  useEffect(() => {
    if (!initialMatterId) return;
    const matter = (matterState.matters || []).find((candidate) => candidate.id === initialMatterId);
    if (matter && canSeeMatter(matter, viewerId)) {
      setSelectedMatterId(initialMatterId);
      setView("matter");
    } else {
      addToast("That matter isn't available to you.", { type: "info" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    headingRef.current?.focus(); // focus moves to the new view's heading
  }, [view, selectedMatterId]);

  const writeDraft = (matterId: string, patch: Partial<StoredCourtDraft>) => {
    const base = drafts[matterId] ?? { text: "", noteType: "endorsement" as const, nextDate: null, updatedAt: Date.now() };
    setDraft(matterId, { ...base, ...patch, updatedAt: Date.now() });
  };

  // Round 21: documents per matter — the collapsed diary cards print the count.
  const documentCountByMatter = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const document of documentState.documents || []) {
      const matterId = document.matterId || (document as { matter?: { id?: string } }).matter?.id;
      if (matterId) counts[matterId] = (counts[matterId] || 0) + 1;
    }
    return counts;
  }, [documentState.documents]);

  const openMatter = (matterId: string) => {
    if (dictation.captureBusy) {
      addToast("Finish or discard dictation before switching matters.", { type: "info" });
      return;
    }
    setSelectedMatterId(matterId);
    // A fresh matter never inherits the previous matter's calendar focus.
    setCalendarFocusDayKey(null);
    setView("matter");
  };

  // Matter switching stays disabled while dictation is busy (preserved rule).
  // ROUND 24 (§1.1): the diary is the pane root — no inner Back there; the
  // panel's segmented row owns leaving the Court pane.
  const goBack = () => {
    if (view === "compose") return dictation.leaveGuard(() => setView("matter"));
    if (view === "matter") return dictation.leaveGuard(() => setView("diary"));
  };

  // Round 21 — the deep-linked New Matter modal: the empty diary's "Add a
  // court date" opens the form straight at the court/litigation section
  // (the accordion opens + scrolls there itself). A workflow that carries a
  // section hint uses the same contract: openModal('newMatter', null,
  // { focusSection: 'court' | 'parties' | 'basics' | … }).
  const openNewMatterAtCourtSection = () => {
    openModal("newMatter", null, { focusSection: "court" });
    onClose();
  };

  // ROUND 25 (FEATURE 6 — Court ↔ Vox cross-surface sync): when an
  // endorsement that was DICTATED in Court Mode saves, the capture row is
  // linked to its matter — it then appears in Vox → Recent voice notes
  // tagged to that matter, where the lawyer can reopen it to run further
  // extraction or draft follow-ups without re-recording. Only the capture
  // actually recorded on THIS matter is linked (never a stale capture from
  // another matter). Best-effort: a linking failure never blocks or alarms
  // the save itself.
  const linkCaptureToMatter = (matterId: string) => {
    const clientLocalId = dictation.capture.clientLocalId;
    if (!clientLocalId || dictation.dictatedMatterId !== matterId) return; // typed, or dictated elsewhere
    linkCapture({ clientLocalId, matterId }).catch((error: unknown) => {
      console.warn("[AloaCourtMode] Could not link the voice capture to the matter:", error);
    });
  };

  const renderDiary = () => (
    <DiaryView
      diary={filteredDiary}
      query={query}
      onQueryChange={setQuery}
      scope={scope}
      onScopeChange={setScope}
      onOpenMatter={openMatter}
      onShowFirmDiary={() => setScope("firm")}
      onAddCourtDate={openNewMatterAtCourtSection}
      isDataLoaded={isDataLoaded}
      hasAnyCourtMatters={visibleCourtMatters.length > 0}
      viewerId={viewerId}
      userNames={userNames}
      documentCountByMatter={documentCountByMatter}
      headingRef={headingRef}
    />
  );

  const headerTitle = view === "compose" ? "Record outcome" : view === "matter" ? shortTitle(selectedMatter?.title) : "Court Mode";

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface text-strong dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-hairline bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-4">
        {/* INNER Back — composes within the Court pane only (compose →
            matter → diary). Hidden at the diary root: the panel's Ask | Vox |
            Court segmented row is the one navigation model (§1.1). */}
        {view !== "diary" ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            icon={ArrowLeft}
            onClick={goBack}
            aria-label="Back"
            className="min-w-0 flex-shrink-0"
          >
            <span className="hidden truncate sm:inline">Back</span>
          </Button>
        ) : (
          <span className="min-w-0 flex-shrink-0 w-[72px]" aria-hidden="true" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-extrabold sm:text-base">{headerTitle}</h1>
        {/* ROUND 24 (§1.4): Close lives in the panel's top row (busy-guarded);
            the Court header keeps no X of its own. Spacer keeps the title
            centered. */}
        <span className="min-w-0 flex-shrink-0 w-[72px]" aria-hidden="true" />
      </header>

      {view === "diary" || !selectedMatter ? (
        <SectionErrorBoundary sectionName="Court diary">{renderDiary()}</SectionErrorBoundary>
      ) : view === "matter" && selectedCourtMatter ? (
        <SectionErrorBoundary sectionName="Matter briefing">
          <MatterBriefing
            matter={selectedMatter}
            courtMatter={selectedCourtMatter}
            notes={documentState.notePages.filter((note) => note.matterId === selectedMatter.id && !note.archivedAt)}
            documents={documentState.documents.filter(
              (document) => document.matterId === selectedMatter.id || document.matter?.id === selectedMatter.id,
            )}
            events={visibleEventList}
            matters={visibleMatters}
            nonCourtEvents={nonCourtEventsFor(selectedMatter.id, selectedCourtMatter, executionState.events, todayDayKey())}
            viewerId={viewerId}
            userNames={userNames}
            today={todayDayKey()}
            captureBusy={dictation.captureBusy}
            headingRef={headingRef}
            calendarFocusDayKey={calendarFocusDayKey}
            onCalendarFocus={setCalendarFocusDayKey}
            onOpenCompose={() => setView("compose")}
            onOpenDocument={(documentId) => {
              navigateTo("documentDetail", documentId);
              onClose();
            }}
            onViewAllNotes={() => {
              navigateTo("matterDetail", selectedMatter.id, { initialTab: "endorsements" });
              onClose();
            }}
            onAddCourtDetails={() => {
              openModal("editMatter", selectedMatter.id);
              onClose();
            }}
            onUseDate={(dateISO) => {
              // Round 21: a mini-calendar pick pipes straight into the
              // outcome flow — keeping any already-chosen purpose/time.
              const base = drafts[selectedMatter.id]?.nextDate;
              writeDraft(selectedMatter.id, {
                nextDate: {
                  dateISO,
                  timeHHmm: base?.timeHHmm ?? null,
                  purpose: base?.purpose ?? "Hearing",
                  purposeOther: base?.purposeOther,
                  source: "manual",
                },
              });
              // ROUND 25: the picked date becomes the calendar focus too.
              setCalendarFocusDayKey(dateISO);
              setView("compose");
            }}
          />
        </SectionErrorBoundary>
      ) : view === "compose" ? (
        <SectionErrorBoundary sectionName="Record outcome">
          <OutcomeComposer
            matter={selectedMatter}
            events={visibleEventList}
            matters={visibleMatters}
            viewerId={viewerId}
            viewerName={viewerName}
            eventTypeNames={eventTypeNames}
            userNames={userNames}
            draft={selectedMatter ? (drafts[selectedMatter.id] || null) : null}
            nextHearingDayLabel={
              selectedCourtMatter?.upcomingHearings[0]
                ? dayLabelOf(dayKeyOf(selectedCourtMatter.upcomingHearings[0].date))
                : null
            }
            onTextChange={(text) => {
              dictation.markManualEdits();
              writeDraft(selectedMatter.id, { text });
            }}
            onNextDateChange={(nextDate) => writeDraft(selectedMatter.id, { nextDate })}
            dictation={{
              phase: dictation.capture.phase,
              elapsedMs: dictation.capture.elapsedMs,
              transcriptSoFar: dictation.capture.transcriptSoFar,
              error: dictation.capture.error,
              supported: dictation.capture.supported,
            }}
            canUseVox={dictation.canUseVox}
            captureError={dictation.captureError}
            onStartDictation={dictation.startDictation}
            onStopDictation={() => void dictation.stopDictation()}
            onDiscardAndLeave={() => void dictation.discardDictation(() => setView("matter"))}
            onUnlockVox={() => dictation.setShowVoxUpsell(true)}
            cleanupPhase={dictation.cleanupPhase}
            onRunCleanup={() => void dictation.runCleanup({ manual: true })}
            onNextDateFocused={setCalendarFocusDayKey}
            onSaved={() => {
              // ROUND 25 (FEATURE 6): link the dictated capture to the matter
              // so it appears in Vox → Recent voice notes, tagged.
              linkCaptureToMatter(selectedMatter.id);
              setView("matter");
            }}
            headingRef={headingRef}
          />
        </SectionErrorBoundary>
      ) : (
        <SectionErrorBoundary sectionName="Court diary">{renderDiary()}</SectionErrorBoundary>
      )}
      {dictation.showVoxUpsell ? <VoxUpsellModal onClose={() => dictation.setShowVoxUpsell(false)} /> : null}
    </section>
  );
};

export default AloaCourtMode;
