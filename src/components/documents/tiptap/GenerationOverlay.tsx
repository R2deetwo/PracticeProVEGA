import React from 'react';

interface GenerationOverlayProps {
  label?: string;
}

/**
 * GenerationOverlay — a small, non-blocking indicator shown on the white
 * canvas while the AI is drafting. It does NOT mask the page (no dark
 * backdrop) so the document sheet stays crisp white.
 *
 * The indicator is a compact pill at the top-center of the page with:
 *   - A spinner
 *   - The status label
 *   - A subtle hint about timing
 *
 * As text streams in from the AI, it appears directly on the page beneath
 * this indicator. When drafting completes, the indicator fades out.
 */
const GenerationOverlay: React.FC<GenerationOverlayProps> = ({ label = 'Preparing your document...' }) => {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-10 pointer-events-none">
      <div className="flex items-center gap-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 dark:border-zinc-700 px-3 py-1.5">
        <div className="w-3.5 h-3.5 border-2 border-slate-200 dark:border-zinc-700 border-t-primary-500 rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
};

export default GenerationOverlay;
