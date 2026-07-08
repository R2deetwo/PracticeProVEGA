/**
 * JurisdictionReasoning — a collapsible card shown in the ALOA chat that
 * displays the jurisdictional analysis the AI made before drafting.
 *
 * Shows:
 *   - Selected court (e.g., "IN THE HIGH COURT OF LAGOS STATE")
 *   - Jurisdiction (e.g., "Lagos State")
 *   - A dropdown to expand the reasoning
 *
 * This gives the user transparency into the AI's jurisdictional
 * decision-making, so they understand WHY a particular court was chosen
 * and can correct it if needed.
 */
import React, { useState } from 'react';

interface JurisdictionReasoningProps {
  court: string;
  jurisdiction: string;
  reasoning: string;
}

const JurisdictionReasoning: React.FC<JurisdictionReasoningProps> = ({ court, jurisdiction, reasoning }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 mb-1 rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        {/* Jurisdiction icon — a map pin / scale of justice */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 1a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide leading-tight">
            Jurisdictional Analysis
          </p>
          <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">
            {jurisdiction} · {court.length > 50 ? court.substring(0, 50) + '…' : court}
          </p>
        </div>
        {/* Expand chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-indigo-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable reasoning */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-indigo-200/50 dark:border-indigo-800/30">
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-0.5">Selected Court</p>
              <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium">{court}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-0.5">Reasoning</p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{reasoning}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JurisdictionReasoning;
