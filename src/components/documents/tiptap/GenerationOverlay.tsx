import React, { useState, useEffect, useRef } from 'react';

interface GenerationOverlayProps {
  label?: string;
  /** Called when the user clicks "Cancel" */
  onCancel?: () => void;
  /** Called when the user clicks "Cancel & Retry" */
  onRetry?: () => void;
}

/**
 * GenerationOverlay — a SLIM, non-blocking indicator shown on the white
 * canvas while the AI is drafting. It does NOT mask the page (no dark
 * backdrop) so the document sheet stays crisp white.
 *
 * Design principles (per user feedback):
 *   - Slim form factor — small pill, not a big modal
 *   - Spinning circle is the primary indicator
 *   - NO countdown timer / "time to failure" display (causes anxiety)
 *   - NO red "stalled" warnings (premature — the AI may still be working)
 *   - Cancel button appears after a reasonable delay (30s) — not aggressive
 *   - Color stays primary/emerald throughout — no amber/red escalation
 *   - As text streams in, it appears on the page beneath this indicator
 *
 * The overlay is intentionally calm and unobtrusive. The user asked:
 * "I really don't like the countdown to failure thing. You can bring in
 * the cancel button but let us have it a little longer."
 */
const GenerationOverlay: React.FC<GenerationOverlayProps> = ({
  label = 'Preparing your document...',
  onCancel,
  onRetry,
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

  // Show Cancel button only after 30s — give the AI plenty of time.
  // Most drafts complete in 10-30s. Complex legal documents can take 40-60s.
  // We do NOT show "stalled" warnings — that's premature and anxiety-inducing.
  const showCancel = elapsed >= 30;

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-10 pointer-events-auto">
      {/* Slim pill — spinner + label + optional cancel */}
      <div className="flex items-center gap-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 dark:border-zinc-700 px-3 py-1.5">
        {/* Spinning circle — the primary indicator */}
        <div
          className="w-3.5 h-3.5 border-2 border-slate-200 dark:border-zinc-700 border-t-primary-500 rounded-full animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 whitespace-nowrap">
          {label}
        </span>

        {/* Cancel button — appears after 30s. No retry, no warnings.
            Just a quiet cancel so the user can bail if they want. */}
        {showCancel && onCancel && (
          <button
            onClick={onCancel}
            className="ml-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
            title="Cancel drafting"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default GenerationOverlay;
