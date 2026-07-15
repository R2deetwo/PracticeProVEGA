import React, { useState, useEffect, useRef } from 'react';

interface GenerationOverlayProps {
  label?: string;
  /** Called when the user clicks "Cancel & Retry" */
  onCancel?: () => void;
  /** Called when the user clicks "Cancel" (just stop, no retry) */
  onJustCancel?: () => void;
}

/**
 * GenerationOverlay — a small, non-blocking indicator shown on the white
 * canvas while the AI is drafting. It does NOT mask the page (no dark
 * backdrop) so the document sheet stays crisp white.
 *
 * Features:
 *   - Spinner + status label
 *   - Live elapsed timer (so the user knows it's not frozen)
 *   - "Cancel" button (appears after 5s — lets the user bail out)
 *   - "Cancel & Retry" button (appears after 20s — suggests something is wrong)
 *   - Warning color shift after 30s (amber → red) to signal a likely stall
 *
 * As text streams in from the AI, it appears directly on the page beneath
 * this indicator. When drafting completes, the indicator fades out.
 */
const GenerationOverlay: React.FC<GenerationOverlayProps> = ({
  label = 'Preparing your document...',
  onCancel,
  onJustCancel,
}) => {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show "Cancel" button after 5s, "Cancel & Retry" after 20s
  const showCancel = elapsed >= 5;
  const showRetry = elapsed >= 20;
  const isStalled = elapsed >= 30;

  // Color shifts: primary (0-15s) → amber (15-30s) → red (30s+)
  const spinnerColor = isStalled
    ? 'border-red-200 dark:border-red-900 border-t-red-500'
    : elapsed >= 15
      ? 'border-amber-200 dark:border-amber-900 border-t-amber-500'
      : 'border-slate-200 dark:border-zinc-700 border-t-primary-500';

  const labelColor = isStalled
    ? 'text-red-600 dark:text-red-400'
    : elapsed >= 15
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-700 dark:text-zinc-300';

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-10">
      <div className={`flex flex-col items-center gap-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-2xl shadow-lg border px-4 py-2.5 transition-colors ${
        isStalled ? 'border-red-300 dark:border-red-800' : elapsed >= 15 ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-zinc-700'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 border-2 ${spinnerColor} rounded-full animate-spin`} style={{ animationDuration: '0.8s' }} />
          <span className={`text-xs font-semibold whitespace-nowrap ${labelColor}`}>
            {isStalled ? 'Taking longer than expected…' : label}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
            {elapsed}s
          </span>
        </div>

        {/* Action buttons — appear progressively */}
        {showCancel && (
          <div className="flex items-center gap-2 mt-0.5">
            {showRetry && onCancel && (
              <button
                onClick={onCancel}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800/50"
                title="Stop drafting and retry with a fresh request"
              >
                Cancel &amp; Retry
              </button>
            )}
            {onJustCancel && (
              <button
                onClick={onJustCancel}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                title="Stop drafting"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Stalled warning message */}
        {isStalled && (
          <p className="text-[9px] text-red-500 dark:text-red-400 text-center max-w-[260px] leading-tight">
            The AI stream appears to have stalled. Click "Cancel &amp; Retry" to try again.
          </p>
        )}
      </div>
    </div>
  );
};

export default GenerationOverlay;
