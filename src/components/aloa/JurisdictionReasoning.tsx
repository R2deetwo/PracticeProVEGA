/**
 * JurisdictionReasoning — a collapsible card shown in the ALOA chat that
 * displays the jurisdictional analysis the AI made before drafting.
 *
 * Now includes a "Change Jurisdiction" button that lets the user:
 *   1. Select a different state
 *   2. Select a court tier (High Court, Magistrate, Federal High Court, etc.)
 *   3. Optionally trigger a redraft with the new jurisdiction
 *
 * Once set, the jurisdiction is LOCKED for the drafting session — even
 * if the user redrafts or adds more context, the jurisdiction stays.
 */
import React, { useState } from 'react';
import { JURISDICTION_REGISTRY, getJurisdiction } from '../../utils/jurisdictionConfig';

interface JurisdictionReasoningProps {
  court: string;
  jurisdiction: string;
  reasoning: string;
  /** Called when the user changes the jurisdiction. Returns the new court string. */
  onJurisdictionChange?: (newCourt: string, newJurisdiction: string, newReasoning: string) => void;
  /** Whether the jurisdiction is locked (user already set it this session) */
  locked?: boolean;
}

const JurisdictionReasoning: React.FC<JurisdictionReasoningProps> = ({ court, jurisdiction, reasoning, onJurisdictionChange, locked }) => {
  const [expanded, setExpanded] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [selectedState, setSelectedState] = useState(jurisdiction);
  const [selectedCourtTier, setSelectedCourtTier] = useState<'high_court' | 'magistrate' | 'federal' | 'customary'>('high_court');

  const handleApplyOverride = () => {
    const j = getJurisdiction(selectedState);
    let newCourt = '';
    let newReasoning = '';

    switch (selectedCourtTier) {
      case 'high_court':
        newCourt = `${j.highCourtCaption} IN THE ${j.defaultDivision.toUpperCase()} JUDICIAL DIVISION`;
        newReasoning = `Jurisdiction changed to ${j.name} — High Court (${j.defaultDivision} Judicial Division). Citing ${j.highCourtRules}.`;
        break;
      case 'magistrate':
        newCourt = j.magistrateCourtCaption.replace('{DIVISION}', j.defaultDivision);
        newReasoning = `Jurisdiction changed to ${j.name} — Magistrate Court (${j.defaultDivision}). Citing ${j.magistrateRules}.`;
        break;
      case 'federal':
        newCourt = j.federalHighCourtCaption;
        newReasoning = `Jurisdiction changed to ${j.name} — Federal High Court. Federal matters fall under federal jurisdiction per Section 251 of the 1999 Constitution.`;
        break;
      case 'customary':
        newCourt = `IN THE CUSTOMARY COURT OF ${j.name.toUpperCase()}`;
        newReasoning = `Jurisdiction changed to ${j.name} — Customary Court. Handles customary land disputes, inheritance, and family matters.`;
        break;
    }

    onJurisdictionChange?.(newCourt, j.name, newReasoning);
    setShowOverride(false);
    setExpanded(true);
  };

  return (
    <div className="mt-2 mb-1 rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-900/20 transition-colors"
      >
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 1a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide leading-tight">
            Jurisdictional Analysis {locked && '· 🔒 Locked'}
          </p>
          <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">
            {jurisdiction} · {court.length > 50 ? court.substring(0, 50) + '…' : court}
          </p>
        </div>
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

            {/* Change Jurisdiction button */}
            {!locked && !showOverride && (
              <button
                onClick={() => setShowOverride(true)}
                className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Change jurisdiction
              </button>
            )}

            {/* Locked indicator */}
            {locked && (
              <p className="mt-2 text-[10px] text-slate-500 dark:text-zinc-500 italic flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Jurisdiction is locked for this drafting session. Redrafts will keep the same court.
              </p>
            )}

            {/* Override UI */}
            {showOverride && (
              <div className="mt-3 p-3 bg-white dark:bg-zinc-800 rounded-lg border border-indigo-200 dark:border-indigo-700 space-y-3">
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Select a different court:</p>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {Object.values(JURISDICTION_REGISTRY).map(j => (
                      <option key={j.key} value={j.key}>{j.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Court Tier</label>
                  <select
                    value={selectedCourtTier}
                    onChange={(e) => setSelectedCourtTier(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="high_court">High Court (State)</option>
                    <option value="magistrate">Magistrate Court</option>
                    <option value="federal">Federal High Court</option>
                    <option value="customary">Customary Court</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowOverride(false)}
                    className="flex-1 text-xs font-bold text-slate-500 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyOverride}
                    className="flex-1 text-xs font-bold text-white bg-indigo-600 px-2 py-1.5 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Apply & Lock
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JurisdictionReasoning;
