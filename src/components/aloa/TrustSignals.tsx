/**
 * TrustSignals — the visible layer of the Item 3 trust contract.
 *
 * Every ALOA/ARIA output now carries:
 *   • ReviewRequiredHeader — NON-DISMISSIBLE red header. There is no X, no
 *     "don't show again": AI output is always review-required, full stop.
 *   • ConfidenceChip — HIGH / MODERATE / LOW with the evidence in the
 *     tooltip (from assessConfidence — deterministic, no extra API calls).
 *   • AiDisclaimerBanner — once per browser session (sessionStorage), then
 *     a quiet one-liner remains reachable via the info icon in the header.
 *   • UnverifiedCitationSup — the ⚠ marker injected next to [n] markers
 *     with no source entry (see markUnverifiedCitationsInHtml).
 *
 * Design language: identical chip vocabulary as the rest of the app —
 * text-2xs/text-3xs font-bold/black uppercase rounded-full + soft
 * tinted backgrounds, emerald/amber/red families, full dark-mode pairs.
 */
import React, { useState, useEffect } from 'react';
import {
    REVIEW_REQUIRED_TITLE,
    REVIEW_REQUIRED_HINT,
    AI_DISCLAIMER_TEXT,
    AI_DISCLAIMER_SESSION_KEY,
    type ConfidenceAssessment,
} from '../../utils/aiTrust';

// ─── Review Required (non-dismissible header) ──────────────────────────────
export const ReviewRequiredHeader: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
    <div
        className={`flex items-center gap-1.5 rounded-lg border bg-red-50/90 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 px-3 ${compact ? 'py-1' : 'py-1.5'} mb-1`}
        role="note"
        aria-label={`${REVIEW_REQUIRED_TITLE} — ${REVIEW_REQUIRED_HINT}`}
    >
        <svg className="w-3 h-3 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span className="text-2xs font-black uppercase tracking-widest text-red-700 dark:text-red-400">
            {REVIEW_REQUIRED_TITLE}
        </span>
        {!compact && (
            <span className="text-3xs text-red-600/80 dark:text-red-400/70 hidden sm:inline truncate">
                — AI output · verify before relying on it
            </span>
        )}
        <span className="ml-auto text-3xs text-red-400 dark:text-red-500/60" title={REVIEW_REQUIRED_HINT}>
            ⓘ
        </span>
    </div>
);

// ─── Confidence chip ────────────────────────────────────────────────────────
const CONFIDENCE_STYLES: Record<string, { chip: string; dot: string; label: string }> = {
    high: {
        chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'High',
    },
    moderate: {
        chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: 'Moderate',
    },
    low: {
        chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        dot: 'bg-red-500',
        label: 'Low',
    },
};

export const ConfidenceChip: React.FC<{ assessment: ConfidenceAssessment }> = ({ assessment }) => {
    const s = CONFIDENCE_STYLES[assessment.level] ?? CONFIDENCE_STYLES.moderate;
    const tooltip = `AI confidence: ${s.label} (${assessment.score}/100) — heuristic from the response text.\n\nEvidence:\n• ${assessment.indicators.join('\n• ')}\n\nThis is NOT a guarantee of correctness. Review Required still applies.`;
    return (
        <span
            className={`inline-flex items-center gap-1 text-2xs font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${s.chip}`}
            title={tooltip}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            Confidence: {s.label}
        </span>
    );
};

// ─── Per-session disclaimer banner ──────────────────────────────────────────
export const AiDisclaimerBanner: React.FC<{ assistantName: string }> = ({ assistantName }) => {
    const [dismissed, setDismissed] = useState(true); // default hidden; effect reveals once per session

    useEffect(() => {
        try {
            if (sessionStorage.getItem(AI_DISCLAIMER_SESSION_KEY) !== '1') {
                setDismissed(false);
            }
        } catch {
            // sessionStorage unavailable (private mode) — show the banner,
            // better one extra impression than zero trust signaling.
            setDismissed(false);
        }
    }, []);

    const dismiss = () => {
        try { sessionStorage.setItem(AI_DISCLAIMER_SESSION_KEY, '1'); } catch { /* ignore */ }
        setDismissed(true);
    };

    if (dismissed) return null;
    return (
        <div
            className="mx-3 mb-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-900/15 px-3 py-2.5 flex items-start gap-2.5 animate-fade-in"
            role="alert"
        >
            <svg className="w-4 h-4 flex-shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H3.645c-1.73 0-2.813-1.874-1.948-3.374L10.05 3.378c.866-1.5 3.032-1.5 3.898 0l7.355 13.248zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
                <p className="text-2xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-0.5">
                    {assistantName} is an AI assistant
                </p>
                <p className="text-2xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                    {AI_DISCLAIMER_TEXT}
                </p>
            </div>
            <button
                onClick={dismiss}
                className="flex-shrink-0 text-3xs font-bold px-2 py-1 rounded-md text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors uppercase tracking-wide"
                aria-label="Acknowledge and hide this notice for the rest of this session"
            >
                Got it
            </button>
        </div>
    );
};

// ─── Unverified-citation legend (expanded outputs with ⚠ markers) ───────────
export const UnverifiedCitationLegend: React.FC<{ count: number }> = ({ count }) => {
    if (count <= 0) return null;
    return (
        <p className="text-3xs text-amber-600 dark:text-amber-400 font-bold mt-1.5">
            <span className="font-black">⚠</span> {count} unverified citation{count > 1 ? 's' : ''} — no source was provided for the marked reference{count > 1 ? 's' : ''}.
        </p>
    );
};
