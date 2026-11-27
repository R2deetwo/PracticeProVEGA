/**
 * DictationReviewPanel — ROUND 25 (ALOA Vox intelligence overhaul, owner bug
 * report 2026-11-28, BUG 2: raw, uncleaned dictation). The review workflow's
 * status strip: the LLM cleanup pass status ("Cleaning up dictation…" /
 * failed / skipped), the on-demand "Clean up with AI" re-run, and the RAW
 * TRANSCRIPT disclosure kept alongside the cleaned, editable draft. Pure
 * presentation — the pass itself runs in useCourtDictation.
 */
import React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../../ui";
import type { EndorsementCleanupPhase } from "./useCourtDictation";

interface DictationReviewPanelProps {
  cleanupPhase: EndorsementCleanupPhase;
  /** The raw verbatim words the STT produced (null when none recorded). */
  rawTranscript?: string;
  onRunCleanup: () => void;
  /** True while the text is non-empty, not being cleaned, capture idle. */
  canRunCleanup: boolean;
}

export const DictationReviewPanel: React.FC<DictationReviewPanelProps> = ({
  cleanupPhase,
  rawTranscript,
  onRunCleanup,
  canRunCleanup,
}) => {
  if (cleanupPhase !== "cleaning" && cleanupPhase !== "failed" && cleanupPhase !== "skipped" && !rawTranscript && !canRunCleanup) {
    return null;
  }
  return (
    <div className="space-y-2">
      {cleanupPhase === "cleaning" ? (
        <p className="flex min-h-9 items-center gap-2 rounded-sm bg-status-info/10 px-3 text-xs font-medium text-status-info">
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Cleaning up dictation — homophones, stutters and endorsement order…
        </p>
      ) : cleanupPhase === "failed" ? (
        <p className="rounded-sm bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
          Cleanup could not run — review the raw transcript below before saving.
        </p>
      ) : cleanupPhase === "skipped" ? (
        <p className="rounded-sm bg-surface-2 px-3 py-2 text-xs text-subtle">
          Cleanup skipped — your own edits were kept.
        </p>
      ) : null}
      {canRunCleanup ? (
        <Button variant="ghost" size="sm" type="button" icon={Sparkles} onClick={onRunCleanup}>
          Clean up with AI
        </Button>
      ) : null}
      {rawTranscript ? (
        <details className="rounded-sm border border-hairline bg-surface-2 px-3 py-2 dark:border-zinc-800">
          <summary className="cursor-pointer text-xs font-semibold text-body">Raw transcript (as dictated)</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs text-subtle">{rawTranscript}</p>
          <p className="mt-1.5 text-2xs text-subtle">Also kept on the voice note in Vox — Recent voice notes.</p>
        </details>
      ) : null}
    </div>
  );
};

export default DictationReviewPanel;
