/**
 * DocumentPacketCard — renders an itemised DOCUMENT PACKET in the chat.
 *
 * Task 69: when the user asks for "the documents necessary" for a process,
 * ALOA/ARIA research the process and call `plan_document_packet`. This card
 * presents the plan: the job, the process, what the law requires, and every
 * document in the order it is needed — each with its own purpose, legal
 * basis, and a Draft button. A "Draft all documents" button prepares the
 * whole packet.
 *
 * Popup-blocker reality: a single user gesture can reliably open ONE tab;
 * subsequent window.open calls are usually blocked. "Draft all" therefore
 * prepares every draft session (so each is ready to auto-draft), opens the
 * first, and the remaining rows flip to an "Open in DraftPro" state the
 * user clicks one by one — a deliberate, review-friendly packet workflow
 * rather than a tab storm.
 */
import React, { useState } from 'react';
import { DocumentPacket, PacketDraftResult } from '../../utils/documentPacket';
import { Button } from '../ui';
import { ClipboardListIcon, EditIcon, CheckIcon, ChevronDownIcon, ScalesIcon, ArrowPathIcon } from '../../constants';

type DocStatus = 'idle' | 'busy' | 'opened' | 'ready' | 'error';

interface DocumentPacketCardProps {
    packet: DocumentPacket;
    /**
     * Prepares (and tries to open) one packet document in DraftPro.
     * Implemented in AloaChat — has access to the session/user context,
     * the draft-session store, tabNavigation and toasts.
     */
    onDraftDoc: (packet: DocumentPacket, docIndex: number) => Promise<PacketDraftResult>;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export const DocumentPacketCard: React.FC<DocumentPacketCardProps> = ({ packet, onDraftDoc }) => {
    const [statuses, setStatuses] = useState<DocStatus[]>(() => packet.documents.map(() => 'idle'));
    const [draftAllBusy, setDraftAllBusy] = useState(false);
    const [showProcess, setShowProcess] = useState(false);
    const [showSources, setShowSources] = useState(false);

    const setDocStatus = (i: number, status: DocStatus) =>
        setStatuses(prev => prev.map((s, idx) => (idx === i ? status : s)));

    const draftOne = async (i: number) => {
        if (statuses[i] === 'busy') return;
        setDocStatus(i, 'busy');
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
        try {
            for (let i = 0; i < packet.documents.length; i++) {
                // Sequential: the first open consumes the user gesture; the
                // rest typically get popup-blocked and flip to "ready" rows.
                await draftOne(i);
            }
        } finally {
            setDraftAllBusy(false);
        }
    };

    const n = packet.documents.length;
    const doneCount = statuses.filter(s => s === 'opened' || s === 'ready').length;

    return (
        <div className="mt-2 rounded-3xl border border-white/40 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 pt-4 pb-3 bg-gradient-to-br from-primary-50/80 to-transparent dark:from-primary-900/20">
                <div className="text-2xs text-primary-600 dark:text-primary-400 mb-1.5 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <ClipboardListIcon className="w-2.5 h-2.5" />
                    Document Packet
                    <span className="ml-auto font-semibold text-slate-400 dark:text-zinc-500 normal-case tracking-normal">
                        {doneCount}/{n} prepared
                    </span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-snug">{packet.jobTitle}</p>
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
                    return (
                        <div
                            key={`${packet.jobId}-${i}`}
                            className={`p-3 rounded-2xl border transition-all ${
                                status === 'opened'
                                    ? 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40'
                                    : status === 'ready'
                                        ? 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40'
                                        : status === 'error'
                                            ? 'bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-900/40'
                                            : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700/60'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-3xs font-black ${
                                    status === 'opened'
                                        ? 'bg-emerald-500 text-white'
                                        : status === 'ready'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                }`}>
                                    {status === 'opened' ? <CheckIcon className="w-3 h-3" /> : i + 1}
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
                                </div>
                                <Button
                                    variant="bare"
                                    size="sm"
                                    onClick={() => draftOne(i)}
                                    disabled={status === 'busy'}
                                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-3xs font-bold transition-all active:scale-95 ${
                                        status === 'busy'
                                            ? 'bg-slate-100 dark:bg-zinc-700 text-slate-400 cursor-wait'
                                            : status === 'opened'
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                                : status === 'ready'
                                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-300/40 shadow-sm animate-pulse'
                                                    : status === 'error'
                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                                        : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                                    }`}
                                    title={
                                        status === 'opened' ? 'Draft is open in DraftPro — click to reopen'
                                            : status === 'ready' ? 'Your browser blocked the pop-up — click to open this draft'
                                            : status === 'error' ? 'Something went wrong — click to retry'
                                            : `Draft the ${doc.name}`
                                    }
                                >
                                    {status === 'busy'
                                        ? <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                        : status === 'opened'
                                            ? <CheckIcon className="w-3 h-3" />
                                            : <EditIcon className="w-3 h-3" />}
                                    {status === 'busy' ? 'Preparing…'
                                        : status === 'idle' ? 'Draft'
                                        : status === 'opened' ? 'Open again'
                                        : status === 'ready' ? 'Open DraftPro'
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
                    {draftAllBusy ? 'Preparing your packet…' : `Draft all ${n} document${n > 1 ? 's' : ''}`}
                </Button>
                <p className="mt-2 text-center text-3xs text-slate-400 dark:text-zinc-500 leading-relaxed px-2">
                    {cap(packet.documents.length === 1 ? 'Each draft opens in DraftPro in its own tab.' : 'Each draft opens in DraftPro in its own tab — if your browser blocks the rest, click them open one by one.')}
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
