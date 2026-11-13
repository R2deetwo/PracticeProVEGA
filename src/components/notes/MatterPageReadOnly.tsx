import React from 'react';
import { NotePage, Matter } from '../../types';
import { Button } from '../ui';
import { timeAgo } from '../../utils/colorUtils';
import { sanitize } from '../../utils/sanitization';

/**
 * MatterPageReadOnly — the read-only renderer for matter pages browsed in
 * the Firm Knowledge "Matters" notebook (UX-27).
 *
 * DESIGN DECISION (UX-27, ratified from the phase-0 audit register):
 * the matter's OWN Notes tab (MatterDetailView) is the one canonical
 * write surface for matter notes — the point of work, where the
 * endorsement composer and the task/event conversions live. This
 * surface (the cross-matter notebook browser) renders the same note
 * rows READ-ONLY with one affordance: jump to the matter. Predictable
 * destination, one write path, no more "where did my note land?"
 *
 * Rich content authored in the TipTap editor renders as sanitized
 * HTML (same contract as the endorsement timeline); plain notes
 * render as pre-wrapped text.
 */

const looksLikeHtml = (s: string) =>
    /<\/(p|h[1-6]|ol|ul|li|strong|em|b|i|div|blockquote|table)\s*>|<br\s*\/?>/i.test(s || '');

interface MatterPageReadOnlyProps {
    page: NotePage;
    matter: Matter | null;
    onOpenInMatter: () => void;
}

const MatterPageReadOnly: React.FC<MatterPageReadOnlyProps> = ({ page, matter, onOpenInMatter }) => (
    <div className="h-full flex flex-col overflow-hidden">
        {/* The lock banner — why this page is not editable here. */}
        <div
            className="flex-shrink-0 mx-4 mt-4 p-3 rounded-lg bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-start gap-2.5"
            role="note"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
            <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                    Matter notes are written in the matter
                </p>
                <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    This page is part of {matter ? matter.title : 'a matter'}'s record. Open it in the
                    matter's Notes tab to edit, or to convert it into a task or event.
                </p>
            </div>
        </div>

        {/* Read-only page body. */}
        <div className="flex-grow overflow-y-auto custom-scrollbar px-4 py-4">
            <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-6">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
                    {page.title}
                </h1>
                <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1 mb-4 pb-4 border-b border-slate-100 dark:border-zinc-700">
                    Updated {page.updatedAt ? timeAgo(page.updatedAt) : '—'}
                </p>
                {looksLikeHtml(page.content) ? (
                    /* Rich (TipTap-authored) content — sanitized HTML, same
                     * contract as the endorsement timeline. */
                    <div
                        className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mb-2 prose-headings:mt-3 prose-li:my-0.5"
                        dangerouslySetInnerHTML={{ __html: sanitize(page.content) }}
                    />
                ) : (
                    <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                        {page.content || <span className="italic text-slate-400 dark:text-zinc-500">Empty page</span>}
                    </div>
                )}
            </div>
        </div>

        {/* The one affordance: jump to the canonical surface. */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                <p className="text-2xs text-slate-400 dark:text-zinc-500 hidden sm:block">
                    Read-only view — editing lives in the matter
                </p>
                <Button variant="primary" size="sm" onClick={onOpenInMatter}>
                    Open in {matter ? `“${matter.title}”` : 'Matter'} →
                </Button>
            </div>
        </div>
    </div>
);

export default MatterPageReadOnly;
