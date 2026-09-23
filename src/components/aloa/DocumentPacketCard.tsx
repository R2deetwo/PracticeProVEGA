/**
 * DocumentPacketCard — renders an itemised DOCUMENT PACKET in the chat.
 *
 * Task 69: when the user asks for "the documents necessary" for a process,
 * ALOA/ARIA research the process and call `plan_document_packet`. This card
 * presents the plan: the job, the process, what the law requires, and every
 * document in the order it is needed — each with its own purpose, legal
 * basis, and a Draft button.
 *
 * 2026-09-24 (user feedback round 3) — "DRAFT ALL" NOW DRAFTS THEM ALL:
 * the user reported that hitting "Draft all" only opened the first document
 * and left the rest UNDRAFTED — clicking the next one visibly started
 * drafting from scratch. New behaviour:
 *   • Document #1 opens in DraftPro immediately (the user gesture is
 *     consumed by the tab open) and drafts live in the editor.
 *   • Documents #2..n are FULLY DRAFTED IN THE BACKGROUND by the chat
 *     (onPreDraftDoc) with a small worker pool, so opening any of them
 *     later is instant — the editor opens what was drafted.
 *   • Every row shows a live visual cue IN THE CHAT: Queued → Drafting…
 *     (spinner) → Drafted ✓ (ready to open) / Retry (error).
 *   • A progress bar and a "x of y drafted" counter run in the card
 *     header while the packet is being prepared.
 */
import React, { useState } from 'react';
import { DocumentPacket, PacketDraftResult } from '../../utils/documentPacket';
import { Button } from '../ui';
import { ClipboardListIcon, EditIcon, CheckIcon, ChevronDownIcon, ScalesIcon, ArrowPathIcon, ClockIcon, CheckBadgeIcon } from '../../constants';

export type DocStatus = 'idle' | 'opening' | 'queued' | 'drafting' | 'ready' | 'opened' | 'error';

export interface PacketDraftAllSummary {
    total: number;
    ready: number;
    opened: number;
    errors: number;
}

interface DocumentPacketCardProps {
    packet: DocumentPacket;
    /**
     * Prepare (and try to open) one packet document in DraftPro — the
     * single-draft path. Implemented in AloaChat.
     */
    onDraftDoc: (packet: DocumentPacket, docIndex: number) => Promise<PacketDraftResult>;
    /**
     * Background-DRAFT one packet document (no tab): generate the complete
     * document and persist it, so opening it later is instant. Returns
     * 'ready' when the draft is saved (or already existed).
     */
    onPreDraftDoc: (packet: DocumentPacket, docIndex: number) => Promise<PacketDraftResult>;
    /** Fired once when a "Draft all" run finishes — lets the chat toast. */
    onDraftAllComplete?: (summary: PacketDraftAllSummary) => void;
    /**
     * Statuses the chat derived from persisted drafts (rows that already
     * have content open as "Drafted", never "Draft" — after a reload the
     * card must not pretend nothing was drafted). Only the value at mount
     * time is used.
     */
    initialStatuses?: DocStatus[];
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** How many background drafting workers run at once. Two is polite to the
 *  drafting API's rate limits while still finishing a 5-document packet
 *  ~2.5x faster than one-at-a-time. */
const DRAFT_POOL_SIZE = 2;

export const DocumentPacketCard: React.FC<DocumentPacketCardProps> = ({
    packet,
    onDraftDoc,
    onPreDraftDoc,
    onDraftAllComplete,
    initialStatuses,
}) => {
    const [statuses, setStatuses] = useState<DocStatus[]>(() => {
        if (initialStatuses && initialStatuses.length === packet.documents.length) {
            return [...initialStatuses];
        }
        return packet.documents.map(() => 'idle');
    });
    const [draftAllBusy, setDraftAllBusy] = useState(false);
    const [showProcess, setShowProcess] = useState(false);
    const [showSources, setShowSources] = useState(false);

    const setDocStatus = (i: number, status: DocStatus) =>
        setStatuses(prev => prev.map((s, idx) => (idx === i ? status : s)));

    const draftOne = async (i: number) => {
        if (statuses[i] === 'opening' || statuses[i] === 'drafting' || statuses[i] === 'queued') return;
        setDocStatus(i, 'opening');
        try {
            const result = await onDraftDoc(packet, i);
            setDocStatus(i, result.status === 'error' ? 'error' : result.status === 'opened' ? 'opened' : 'ready');
        } catch {
            setDocStatus(i, 'error');
        }
    };

    const draftAll = async () => {
        if (draftAllBusy) return;
        setDraftAllBusy(true);
        const n = packet.documents.length;
        try {
            // 1. Document #1 opens immediately and drafts live in DraftPro —
            //    the click on "Draft all" is the user gesture window.open
            //    needs; wasting it on background work would get the tab
            //    popup-blocked.
            await draftOne(0);

            // 2. Everything else is FULLY drafted in the background by the
            //    chat (2026-09-24 fix — previously these were merely
            //    "prepared" and only drafted on open, which is what the
            //    user caught).
            const rest: number[] = [];
            for (let i = 1; i < n; i++) rest.push(i);
            for (const i of rest) setDocStatus(i, 'queued');

            let cursor = 0;
            const worker = async () => {
                while (cursor < rest.length) {
                    const i = rest[cursor++];
                    setDocStatus(i, 'drafting');
                    try {
                        const result = await onPreDraftDoc(packet, i);
                        setDocStatus(i, result.status === 'error' ? 'error' : 'ready');
                    } catch {
                        setDocStatus(i, 'error');
                    }
                }
            };
            await Promise.all(
                Array.from({ length: Math.min(DRAFT_POOL_SIZE, rest.length) }, () => worker()),
            );

            // 3. Report the outcome (chat toasts it).
            if (onDraftAllComplete) {
                setStatuses(prev => {
                    onDraftAllComplete({
                        total: n,
                        ready: prev.filter(s => s === 'ready').length,
                        opened: prev.filter(s => s === 'opened').length,
                        errors: prev.filter(s => s === 'error').length,
                    });
                    return prev;
                });
            }
        } finally {
            setDraftAllBusy(false);
        }
    };

    const n = packet.documents.length;
    const doneCount = statuses.filter(s => s === 'opened' || s === 'ready').length;
    const draftingCount = statuses.filter(s => s === 'drafting' || s === 'queued' || s === 'opening').length;
    const errorCount = statuses.filter(s => s === 'error').length;
    const progressPct = n > 0 ? Math.round((doneCount / n) * 100) : 0;

    return (
        <div className="mt-2 rounded-3xl border border-white/40 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 pt-4 pb-3 bg-gradient-to-br from-primary-50/80 to-transparent dark:from-primary-900/20">
                <div className="text-2xs text-primary-600 dark:text-primary-400 mb-1.5 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <ClipboardListIcon className="w-2.5 h-2.5" />
                    Document Packet
                    <span className={`ml-auto font-semibold normal-case tracking-normal ${
                        draftingCount > 0
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-slate-400 dark:text-zinc-500'
                    }`}>
                        {draftAllBusy || draftingCount > 0
                            ? `${doneCount}/${n} drafted${draftingCount > 0 ? ` · ${draftingCount} in progress` : ''}`
                            : `${doneCount}/${n} prepared`}
                    </span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-snug">{packet.jobTitle}</p>

                {/* Draft-all progress bar — the at-a-glance cue that the
                    packet is being drafted and how far along it is. */}
                {(draftAllBusy || draftingCount > 0) && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                        <div
                            className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                )}

                {packet.processSummary && (
                    <Button
                        variant="bare"
                        size="sm"
                        onClick={() => setShowProcess(!showProcess)}
                        className="mt-1.5 flex items-center gap-1 text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                        <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${showProcess ? 'rotate-180' : ''}`} />
                        {showProcess ? 'Hide' : 'The process & what the law requires'}
                    </Button>
                )}
            </div>

            {/* Process + legal requirements (collapsible) */}
            {showProcess && (packet.processSummary || packet.legalRequirements) && (
                <div className="px-4 sm:px-5 pb-3 space-y-2 animate-in slide-in-from-top-1 duration-300">
                    {packet.processSummary && (
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-700/60">
                            <p className="text-2xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1">The process</p>
                            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{packet.processSummary}</p>
                        </div>
                    )}
                    {packet.legalRequirements && (
                        <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                            <p className="text-2xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                                <ScalesIcon className="w-2.5 h-2.5" /> What the law requires
                            </p>
                            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{packet.legalRequirements}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Document rows */}
            <div className="px-3 sm:px-4 pb-3 space-y-2">
                {packet.documents.map((doc, i) => {
                    const status = statuses[i] ?? 'idle';
                    const busy = status === 'opening' || status === 'drafting' || status === 'queued';
                    return (
                        <div
                            key={`${packet.jobId}-${i}`}
                            className={`p-3 rounded-2xl border transition-all ${
                                status === 'opened'
                                    ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40'
                                    : status === 'ready'
                                        ? 'bg-emerald-50/40 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-900/30'
                                        : status === 'error'
                                            ? 'bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-900/40'
                                            : busy
                                                ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30'
                                                : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700/60'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-3xs font-black ${
                                    status === 'opened' || status === 'ready'
                                        ? 'bg-emerald-500 text-white'
                                        : status === 'error'
                                            ? 'bg-red-500 text-white'
                                            : busy
                                                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                                : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                }}`}>
                                    {status === 'opened' || status === 'ready' ? <CheckIcon className="w-3 h-3" />
                                        : status === 'error' ? '!'
                                        : busy ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                        : i + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 leading-snug">{doc.name}</p>
                                    {doc.purpose && (
                                        <p className="mt-0.5 text-3xs text-slate-500 dark:text-zinc-400 leading-relaxed">{truncate(doc.purpose, 180)}</p>
                                    )}
                                    {doc.legalBasis && (
                                        <p className="mt-1 text-3xs text-primary-600 dark:text-primary-400/90 font-medium italic leading-snug">
                                            {truncate(doc.legalBasis, 140)}
                                        </p>
                                    )}
                                    {status === 'ready' && (
                                        <p className="mt-1 text-3xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <CheckBadgeIcon className="w-3 h-3" /> Drafted — ready to open
                                        </p>
                                    )}
                                    {status === 'error' && (
                                        <p className="mt-1 text-3xs font-bold text-red-500 dark:text-red-400">Couldn't draft this one — tap Retry.</p>
                                    )}
                                </div>
                                <Button
                                    variant="bare"
                                    size="sm"
                                    onClick={() => draftOne(i)}
                                    disabled={busy}
                                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-3xs font-bold transition-all active:scale-95 ${
                                        status === 'opening'
                                            ? 'bg-slate-100 dark:bg-zinc-700 text-slate-400 cursor-wait'
                                            : status === 'queued'
                                                ? 'bg-slate-100 dark:bg-zinc-700 text-slate-400'
                                                : status === 'drafting'
                                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                                    : status === 'opened'
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                                        : status === 'ready'
                                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                                                            : status === 'error'
                                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                                                : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                                    }`}
                                    title={
                                        status === 'opening' ? 'Opening DraftPro…'
                                            : status === 'queued' ? 'Queued — starts drafting in a moment'
                                            : status === 'drafting' ? 'ALOA is drafting this document now'
                                            : status === 'opened' ? 'Draft is open in DraftPro — click to reopen'
                                            : status === 'ready' ? 'Drafted — click to open it in DraftPro'
                                            : status === 'error' ? 'Something went wrong — click to retry'
                                            : `Draft the ${doc.name}`
                                    }
                                >
                                    {status === 'opening' || status === 'drafting'
                                        ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                        : status === 'queued'
                                            ? <ClockIcon className="w-3 h-3" />
                                            : status === 'opened' || status === 'ready'
                                                ? <CheckIcon className="w-3 h-3" />
                                                : status === 'error'
                                                    ? <ArrowPathIcon className="w-3 h-3" />
                                                    : <EditIcon className="w-3 h-3" />}
                                    {status === 'opening' ? 'Opening…'
                                        : status === 'idle' ? 'Draft'
                                        : status === 'queued' ? 'Queued'
                                        : status === 'drafting' ? 'Drafting…'
                                        : status === 'opened' ? 'Open again'
                                        : status === 'ready' ? 'Open Draft'
                                        : 'Retry'}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer: Draft all + sources */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-zinc-700/60 bg-slate-50/50 dark:bg-zinc-900/40">
                <Button
                    variant="bare"
                    size="md"
                    fullWidth
                    onClick={draftAll}
                    disabled={draftAllBusy || n === 0}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-200/50 dark:shadow-primary-900/20 transition-all transform active:scale-95 disabled:opacity-60"
                >
                    {draftAllBusy
                        ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        : <ClipboardListIcon className="w-4 h-4" />}
                    {draftAllBusy
                        ? `Drafting your packet — ${doneCount} of ${n} done…`
                        : `Draft all ${n} document${n > 1 ? 's' : ''}`}
                </Button>
                <p className="mt-2 text-center text-3xs text-slate-400 dark:text-zinc-500 leading-relaxed px-2">
                    {draftAllBusy || draftingCount > 0
                        ? `The first document is open in DraftPro; the rest are being drafted now — each row shows ✓ the moment its draft is ready.`
                        : cap(n <= 1
                            ? 'The draft opens in DraftPro in its own tab.'
                            : 'The first document opens in DraftPro; the rest are drafted in the background so they open instantly — watch each row for the ✓.')}
                </p>

                {packet.sources && packet.sources.length > 0 && (
                    <div className="mt-2">
                        <Button
                            variant="bare"
                            size="sm"
                            fullWidth
                            onClick={() => setShowSources(!showSources)}
                            className="w-full flex items-center justify-center gap-1 text-3xs font-bold text-slate-400 dark:text-zinc-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                            <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${showSources ? 'rotate-180' : ''}`} />
                            {showSources ? 'Hide' : 'Show'} research sources ({packet.sources.length})
                        </Button>
                        {showSources && (
                            <ul className="mt-2 space-y-1 animate-in slide-in-from-top-1 duration-300">
                                {packet.sources.map((s, i) => (
                                    <li key={i} className="text-3xs text-slate-500 dark:text-zinc-400 leading-relaxed flex gap-1.5">
                                        <span className="text-primary-400 font-bold">[{i + 1}]</span>
                                        <span className="min-w-0">
                                            {s.url ? (
                                                <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-primary-600 underline decoration-dotted underline-offset-2 break-words">
                                                    {truncate(s.text, 160)}
                                                </a>
                                            ) : (
                                                truncate(s.text, 160)
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
