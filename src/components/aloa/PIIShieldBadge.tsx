/**
 * PIIShieldBadge — Non-intrusive PII stripping indicator
 *
 * Shows a small dismissible badge above the user's message when PII is
 * detected and stripped. The user can:
 *   - See the count and types at a glance
 *   - Click to expand and see exactly what was stripped (with originals masked)
 *   - Dismiss with one tap
 *
 * Design: emerald pill with shield icon, expands to show details.
 * Non-intrusive: doesn't block the conversation, doesn't require interaction.
 */

import React, { useState } from 'react';
import { PIIStripResult } from '../../utils/aiUtils';

interface PIIShieldBadgeProps {
    result: PIIStripResult;
    onDismiss?: () => void;
}

const PIIShieldBadge: React.FC<PIIShieldBadgeProps> = ({ result, onDismiss }) => {
    const [expanded, setExpanded] = useState(false);

    if (result.totalStripped === 0) return null;

    const types = [...new Set(result.found.map(f => f.type))];

    // Mask the original PII for display (show first 2 + last 2 chars)
    const maskValue = (val: string) => {
        if (val.length <= 4) return '****';
        return val.substring(0, 2) + '••••' + val.substring(val.length - 2);
    };

    return (
        <div className="mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="inline-flex flex-col w-full sm:w-auto sm:max-w-md">
                {/* Collapsed badge */}
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-lg px-3 py-1.5">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{result.totalStripped}</span>
                        PII item{result.totalStripped > 1 ? 's' : ''} stripped
                        <span className="text-emerald-500 dark:text-emerald-500 text-2xs">
                            ({types.join(', ')})
                        </span>
                        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="ml-auto p-0.5 text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                            aria-label="Dismiss"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Expanded details */}
                {expanded && (
                    <div className="mt-1 bg-white dark:bg-zinc-800 border border-emerald-100 dark:border-emerald-800/30 rounded-lg p-3 shadow-sm space-y-1.5">
                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">What was removed before AI processing</p>
                        {result.found.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 text-3xs font-bold flex-shrink-0">
                                    {item.type}
                                </span>
                                <span className="font-mono text-slate-400 dark:text-zinc-500 line-through">{maskValue(item.original)}</span>
                                <svg className="w-3 h-3 text-slate-300 dark:text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">{item.replacement}</span>
                            </div>
                        ))}
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-700">
                            Your private data was removed before sending to Google's AI. The AI never sees the original values.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PIIShieldBadge;
