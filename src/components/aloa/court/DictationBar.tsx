/**
 * Round 19 — Court Mode dictation bar.
 *
 * ONE status row, aria-live="polite": idle → recording (danger bar, pulsing
 * dot, local mm:ss timer) → transcribing → queued offline → ready. Errors
 * in role="alert". "Discard dictation and leave" stays for queued/processing
 * (preserved behaviour). The Vox entitlement gate (canUseVox + VoxUpsellModal)
 * is unchanged: without Vox the primary action is to write, with a small
 * secondary link to unlock.
 */
import React from "react";
import { Check, Mic, Square } from "lucide-react";
import { Button } from "../../ui";
import type { QuickCapturePhase } from "../../../hooks/useQuickCapture";
import { formatElapsed } from "./format";

export interface DictationBarProps {
  phase: QuickCapturePhase;
  elapsedMs: number;
  transcriptSoFar: string;
  error: string | null;
  supported: boolean;
  canUseVox: boolean;
  onStart: () => void;
  onStop: () => void;
  onDiscardAndLeave: () => void;
  /** Focuses the endorsement textarea (the no-Vox primary action). */
  onWriteEndorsement: () => void;
  onUnlockVox: () => void;
}

export const DictationBar: React.FC<DictationBarProps> = ({
  phase,
  elapsedMs,
  transcriptSoFar,
  error,
  supported,
  canUseVox,
  onStart,
  onStop,
  onDiscardAndLeave,
  onWriteEndorsement,
  onUnlockVox,
}) => {
  const waiting = phase === "processing" || phase === "queued";
  const ready = phase === "triage" && Boolean(transcriptSoFar);

  return (
    <div aria-live="polite" className="space-y-2">
      {phase === "recording" ? (
        <div className="flex min-h-11 items-center gap-2 rounded-sm bg-status-danger/10 px-3 text-status-danger">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-status-danger motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-sm font-bold">Recording · {formatElapsed(elapsedMs)}</span>
          <Button variant="danger" size="sm" type="button" icon={Square} onClick={onStop}>
            Stop
          </Button>
        </div>
      ) : phase === "processing" ? (
        <p className="flex min-h-11 items-center gap-2 rounded-sm bg-surface-2 px-3 text-sm font-medium text-body dark:bg-zinc-900 dark:text-zinc-300">
          Transcribing audio…
        </p>
      ) : phase === "queued" ? (
        <p className="flex min-h-11 items-center gap-2 rounded-sm bg-status-warning/10 px-3 text-sm font-medium text-status-warning">
          Saved on this device; will transcribe when you&apos;re back online
        </p>
      ) : ready ? (
        <p className="flex min-h-11 items-center gap-2 rounded-sm bg-status-success/10 px-3 text-sm font-bold text-status-success">
          <Check className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Transcript ready to review
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canUseVox ? (
            <Button
              variant="primary"
              size="md"
              type="button"
              icon={Mic}
              minTouchTarget
              onClick={onStart}
              disabled={!supported}
            >
              Dictate
            </Button>
          ) : (
            <Button variant="primary" size="md" type="button" minTouchTarget onClick={onWriteEndorsement}>
              Write endorsement
            </Button>
          )}
          {canUseVox ? null : (
            <Button variant="secondary" size="sm" type="button" onClick={onUnlockVox}>
              Unlock Vox
            </Button>
          )}
        </div>
      )}
      {!supported ? (
        <p role="alert" className="text-xs text-status-danger">
          This browser does not support audio recording.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="break-words text-xs text-status-danger">
          {error}
        </p>
      ) : null}
      {waiting ? (
        <Button variant="ghost" size="sm" type="button" className="text-status-danger" onClick={onDiscardAndLeave}>
          Discard dictation and leave
        </Button>
      ) : null}
    </div>
  );
};
