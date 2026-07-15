/**
 * JurisdictionCard — a concise, executive-level summary card shown in the
 * ALOA chat stream when the AI makes a jurisdictional analysis before drafting.
 *
 * This replaces the old verbose JurisdictionReasoning component with a clean,
 * compact, highly professional design per the "Concise Jurisdictional UI" spec:
 *
 *   - Slim badge header indicating the primary governing framework or forum
 *   - Exactly 3 concise bullet points:
 *     1. Governing Authority (primary Acts, Rules, Practice Directions)
 *     2. Competent Forum (the court or regulatory body, with legal nuance)
 *     3. Filing/Practice Key (a single sentence on the procedural rule/form)
 *   - Conditional warning block (ONLY if there's a genuine jurisdictional risk)
 *   - Expandable "Change Jurisdiction" override (optional, via onJurisdictionChange)
 *
 * Design principles:
 *   - No wall of text
 *   - No clutter
 *   - No anxiety-inducing countdowns or red warnings (unless genuinely needed)
 *   - Clean, executive-level summary
 */
import React, { useState } from 'react';
import { JURISDICTION_REGISTRY, getJurisdiction } from '../../utils/jurisdictionConfig';

export interface JurisdictionCardProps {
  /** The primary governing statutes, rules, and practice directions */
  governingLaw: string;
  /** The competent forum (court or regulatory body) with legal nuance */
  forum: string;
  /** A single sentence on the immediate procedural rule or form required */
  filingKey: string;
  /** Full court caption for the document header (used by override UI) */
  court?: string;
  /** Display name of the jurisdiction (e.g., "Lagos State", "Federal") */
  jurisdiction?: string;
  /** Full reasoning text (optional — shown in expandable details) */
  reasoning?: string;
  /** Optional jurisdictional warning (only if there's a genuine risk) */
  warning?: string;
  /** Called when the user changes the jurisdiction. Returns the new court string. */
  onJurisdictionChange?: (newCourt: string, newJurisdiction: string, newReasoning: string) => void;
  /** Whether the jurisdiction is locked (user already set it this session) */
  locked?: boolean;
}

export function JurisdictionCard({
  governingLaw,
  forum,
  filingKey,
  court,
  jurisdiction,
  reasoning,
  warning,
  onJurisdictionChange,
  locked,
}: JurisdictionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [selectedState, setSelectedState] = useState(jurisdiction || 'Lagos');
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
    <div className="mt-2 mb-1 p-3 rounded-lg border border-slate-200 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 space-y-2.5">
      {/* ─── Header: "Applicable Framework" badge + forum ─── */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          title={expanded ? 'Collapse details' : 'Expand details'}
        >
          {/* Chevron icon */}
          <svg
            className={`w-3 h-3 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-8-4.5-8-11.8A8 8 0 0 1 12 1a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          Applicable Framework
          {locked && <span className="text-[9px]">🔒</span>}
        </button>
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 whitespace-nowrap truncate max-w-[180px]" title={forum}>
          {forum}
        </span>
      </div>

      {/* ─── 3-Bullet Summary (always visible) ─── */}
      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
        <p className="flex items-start gap-1.5">
          <span className="text-blue-500 font-bold flex-shrink-0">•</span>
          <span><strong className="text-slate-700 dark:text-slate-200">Primary Law:</strong> {governingLaw}</span>
        </p>
        <p className="flex items-start gap-1.5">
          <span className="text-blue-500 font-bold flex-shrink-0">•</span>
          <span><strong className="text-slate-700 dark:text-slate-200">Forum Rule:</strong> {filingKey}</span>
        </p>
      </div>

      {/* ─── Conditional Warning (only if genuine risk) ─── */}
      {warning && (
        <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400 flex items-start gap-1.5">
          <span className="flex-shrink-0">⚠️</span>
          <span><strong>Note:</strong> {warning}</span>
        </div>
      )}

      {/* ─── Expandable details (optional) ─── */}
      {expanded && (
        <div className="pt-2 border-t border-slate-200 dark:border-zinc-700 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {court && (
            <div>
              <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-0.5">Selected Court</p>
              <p className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium">{court}</p>
            </div>
          )}
          {reasoning && (
            <div>
              <p className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-0.5">Full Reasoning</p>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">{reasoning}</p>
            </div>
          )}

          {/* Change Jurisdiction button */}
          {!locked && !showOverride && onJurisdictionChange && (
            <button
              onClick={() => setShowOverride(true)}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Change jurisdiction
            </button>
          )}

          {/* Locked indicator */}
          {locked && (
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 italic flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Jurisdiction is locked for this drafting session.
            </p>
          )}

          {/* Override UI */}
          {showOverride && (
            <div className="p-3 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">Select a different court:</p>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">State</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="flex-1 text-xs font-bold text-white bg-blue-600 px-2 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Apply & Lock
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default JurisdictionCard;
