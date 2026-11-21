/**
 * IngestionEngine — the Legal Knowledge Base ingestion engine's control
 * room, inside the Founder APK (2026-11-19).
 *
 * OWNER DIRECTIVE: "the ingestion engine is supposed to be in the
 * founder's app and work by itself — anytime I open my phone it should
 * be ingesting." The legacy engine was a Python CLI that only ran when a
 * laptop was open; it is now an in-Convex worker (convex/legal/worker.ts)
 * that runs every 15 minutes by cron. This view is the founder's console:
 *
 *   - ON/OFF toggle (+ tasks-per-run pacing) — pausing stops all crawling
 *     within one 15-minute cycle
 *   - Run Now — immediate worker run, no laptop
 *   - corpus stats (judgments / instruments / chunks / raw artifacts)
 *   - queue stats (queued / in progress / failed)
 *   - seed sources with per-source enable/disable
 *   - add-a-URL by hand
 *   - recent documents, coverage gaps (what users asked for that we lack)
 *   - the live audit feed (every fetch / parse / ingest is on the record)
 *
 * DEFENSIVE QUERY PATTERN: useConvex + useEffect + try/catch (NOT
 * useQuery) — the legal/engine module requires a Convex deploy; until
 * then the view renders a "backend not deployed yet" hint instead of a
 * black screen (same convention as FounderBottomNav / RefundRequestsCenter).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Z_CLASS } from '../../overlays/constants';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';

const CATEGORY_COLORS: Record<string, string> = {
    judgments: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    statutes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    subsidiary: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    rules_of_court: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    sec_regulations: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
    electoral: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    index: 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300',
};

function timeAgo(ts: number | null | undefined): string {
    if (!ts) return 'never';
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

/** The house switch pattern (div role="switch" — ADR-0004-safe). */
const Switch: React.FC<{ checked: boolean; onToggle: () => void; label: string }> = ({ checked, onToggle, label }) => (
    <div
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className={`${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none`}
    >
        <span className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white dark:bg-zinc-900 rounded-full transition-transform`} />
    </div>
);

const CategoryChip: React.FC<{ category: string }> = ({ category }) => (
    <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${CATEGORY_COLORS[category] || CATEGORY_COLORS.index}`}>
        {category.replace(/_/g, ' ')}
    </span>
);

export const IngestionEngine: React.FC = () => {
    const { bearerToken } = useFounderAuth();
    const convex = useConvex();

    const [dash, setDash] = useState<any>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState('');
    // ── Inspector drawer (2026-11-22: "no dead-end metric cards") ────
    // Which bucket the drawer is showing rows for (null = closed).
    const [inspectorBucket, setInspectorBucket] = useState<string | null>(null);
    const [inspector, setInspector] = useState<any>(null);
    const [inspectorLoading, setInspectorLoading] = useState(false);

    const sessionToken = bearerToken ?? undefined;

    // ── Defensive dashboard polling (10s) ──────────────────────────────
    const refresh = useCallback(async () => {
        if (!convex || !sessionToken) return;
        try {
            const data = await convex.query(api.legal.engine.getIngestionDashboard, { sessionToken });
            setDash(data);
            setLoadError(null);
        } catch (e: any) {
            setLoadError(e?.message || 'Could not load the ingestion dashboard.');
        }
    }, [convex, sessionToken]);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 10_000);
        return () => clearInterval(interval);
    }, [refresh]);

    // ── Inspector fetch ───────────────────────────────────────────────
    const openInspector = useCallback(async (bucket: string) => {
        if (!convex || !sessionToken) return;
        setInspectorBucket(bucket);
        setInspector(null);
        setInspectorLoading(true);
        try {
            const data = await convex.query(api.legal.engine.getIngestionInspector, { sessionToken, bucket });
            setInspector(data);
        } catch (e: any) {
            setInspector({ bucket, hint: e?.message || 'Could not load this bucket.', rows: [] });
        } finally {
            setInspectorLoading(false);
        }
    }, [convex, sessionToken]);

    // ── Actions ─────────────────────────────────────────────────────────
    // 2026-11-20 OWNER BUG REPORT ("the paused button can't be toggled —
    // it doesn't do anything"): the old guard bailed SILENTLY when
    // dash?.engine was null, but engine state only ever gets created BY
    // this mutation — a chicken-and-egg deadlock that left the switch
    // dead on fresh deployments (compounded by the dashboard query
    // throwing on a boolean range filter, see convex/legal/engine.ts).
    // The backend now always returns an engine object; the toggle always
    // fires, and every guard failure is VISIBLE instead of silent.
    const toggleEngine = async () => {
        if (!convex || !sessionToken) {
            setLoadError('Not connected — reopen the app and try again.');
            return;
        }
        const nextEnabled = !(dash?.engine?.enabled ?? false);
        setBusy('engine');
        try {
            await convex.mutation(api.legal.engine.setIngestionEngineState, {
                sessionToken,
                enabled: nextEnabled,
            });
            setNotice(nextEnabled
                ? 'Engine ON — the builtin sources are seeded and it runs every 15 minutes by itself.'
                : 'Engine paused — crawling stops within one 15-minute cycle.');
            await refresh();
        } catch (e: any) {
            setNotice(null);
            setLoadError(e?.message || 'Toggle failed.');
        } finally {
            setBusy(null);
        }
    };

    const runNow = async () => {
        if (!convex || !sessionToken) return;
        setBusy('run');
        try {
            await convex.action(api.legal.engine.runIngestionNow, { sessionToken });
            setNotice('Run started — the corpus stats refresh here automatically (~30s for the first documents).');
        } catch (e: any) {
            setNotice(null);
            setLoadError(e?.message || 'Run failed.');
        } finally {
            setBusy(null);
        }
    };

    const toggleSeed = async (seedId: any, enabled: boolean) => {
        if (!convex || !sessionToken) return;
        setBusy(`seed:${seedId}`);
        try {
            await convex.mutation(api.legal.engine.toggleSeedSource, { sessionToken, seedId, enabled });
            await refresh();
        } catch (e: any) {
            setLoadError(e?.message || 'Seed toggle failed.');
        } finally {
            setBusy(null);
        }
    };

    const addUrl = async () => {
        if (!convex || !sessionToken || !urlInput.trim()) return;
        setBusy('addurl');
        try {
            const result = await convex.mutation(api.legal.engine.enqueueUrlForIngestion, {
                sessionToken,
                url: urlInput.trim(),
            });
            if (result?.queued) {
                setNotice(result?.revived
                    ? `Re-queued the failed URL with fresh attempts (${String(result?.category ?? 'unknown').replace(/_/g, ' ')}) — the next run retries it.`
                    : `Added to the queue (${String(result?.category ?? 'unknown').replace(/_/g, ' ')}). The next run picks it up.`);
                setUrlInput('');
            } else if (result?.rejected) {
                // 2026-11-22 strict filter: show WHY the URL was refused
                // (block-list hit or off the legal allow-list) so the fix
                // is obvious instead of a silent no-op.
                setNotice(`Not queued — ${result.rejected}.`);
            } else {
                setNotice(`Already known to the queue (${String(result?.status || 'present')}).`);
            }
            await refresh();
        } catch (e: any) {
            setNotice(null);
            setLoadError(e?.message || 'Could not add that URL.');
        } finally {
            setBusy(null);
        }
    };

    // ── Render helpers ──────────────────────────────────────────────────
    const engine = dash?.engine ?? null;
    const corpus = dash?.corpus;
    const queue = dash?.queue ?? {};
    const lastSummary = engine?.lastRunSummary ?? null;

    // Pipeline stage strip (2026-11-22): where documents succeed or stall,
    // visible at a glance. Embed goes live once chunks carry vectors — the
    // engine generates them in-run with the platform Gemini key
    // (corpus.embeddingConfigured); "dormant" now only means the pass
    // hasn't produced a vector yet, never "impossible by design".
    const stages: Array<{ label: string; state: 'ok' | 'dormant' }> = [
        { label: 'Fetch', state: (engine?.runsCount ?? 0) > 0 ? 'ok' : 'dormant' },
        { label: 'Dedupe', state: (engine?.runsCount ?? 0) > 0 ? 'ok' : 'dormant' },
        { label: 'Parse', state: (engine?.runsCount ?? 0) > 0 ? 'ok' : 'dormant' },
        { label: 'Chunk', state: (corpus?.chunks ?? 0) > 0 ? 'ok' : 'dormant' },
        { label: 'Embed', state: (corpus?.chunksEmbedded ?? 0) > 0 ? 'ok' : 'dormant' },
        { label: 'Index', state: ((corpus?.judgments ?? 0) + (corpus?.instruments ?? 0)) > 0 ? 'ok' : 'dormant' },
    ];
    const STAGE_STYLE: Record<string, string> = {
        ok: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
        dormant: 'bg-slate-50 dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500',
    };

    // Interactive stat tile (2026-11-22): every metric opens its inspector
    // bucket — no dead-end cards. ADR-0004: this file is raw-form-free, so
    // the tile is a div role="button" (the same house pattern as the
    // Switch above), never a raw form element.
    const statTile = (label: string, value: number | string, bucket: string, sub?: string) => (
        <div
            key={label}
            role="button"
            tabIndex={0}
            onClick={() => openInspector(bucket)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInspector(bucket); } }}
            className="text-left bg-slate-50 dark:bg-zinc-900/60 rounded-lg border border-slate-200 dark:border-zinc-700 p-3 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            aria-label={`Inspect ${label}`}
        >
            <div className="flex items-center justify-between gap-1">
                <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
                <svg className="w-3 h-3 text-slate-300 dark:text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{value}</p>
            {sub && <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{sub}</p>}
        </div>
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Legal Ingestion Engine</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {engine?.enabled
                        ? 'Running by itself — every 15 minutes, no laptop needed'
                        : 'The autonomous Nigerian legal-corpus crawler'}
                </p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-4">
                {/* Backend-not-deployed hint (defensive) */}
                {loadError && !dash && (
                    <div className={CARD}>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Ingestion backend not deployed yet</p>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                    This screen needs the new <span className="font-mono">legal/engine</span> + <span className="font-mono">legal/worker</span> Convex modules.
                                    Run the <span className="font-semibold">convex-production-deploy</span> workflow once and reopen this view.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Engine control */}
                <div className={CARD}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${engine?.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'}`} />
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Engine</h3>
                                <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${engine?.enabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'}`}>
                                    {engine?.enabled ? 'ON' : 'PAUSED'}
                                </span>
                            </div>
                            <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed max-w-md">
                                Crawls Nigerian judgments, statutes, SEC regulations and more — politely (one page per
                                site per run, robots.txt respected), verifies every document with SHA-256, and feeds
                                ALOA's strictly-cited legal answers. Runs every 15 minutes by itself.
                            </p>
                        </div>
                        <Switch
                            checked={!!engine?.enabled}
                            onToggle={toggleEngine}
                            label={engine?.enabled ? 'Pause ingestion engine' : 'Start ingestion engine'}
                        />
                    </div>

                    {engine && (
                        <>
                        {/* Pipeline stages — the end-to-end chain at a glance:
                            Fetch → Dedupe → Parse → Chunk → Embed → Index.
                            A slate chip is a DORMANT stage (by design), a
                            green chip is live. */}
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700">
                            <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Pipeline</p>
                            <div className="flex flex-wrap gap-1.5">
                                {stages.map((s) => (
                                    <span key={s.label} className={`px-2 py-1 rounded-md border text-2xs font-bold ${STAGE_STYLE[s.state]}`}>
                                        {s.state === 'ok' ? '●' : '○'} {s.label}
                                    </span>
                                ))}
                            </div>
                            {(corpus?.chunksEmbedded ?? 0) === 0 && (corpus?.chunks ?? 0) > 0 && (
                                <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1.5 leading-relaxed">
                                    {corpus?.embeddingConfigured
                                        ? 'Embed pass pending: the engine embeds chunks in-run with the platform Gemini key and backfills vector-less chunks every 15-minute cycle — this clears itself.'
                                        : 'Embed is dormant: no GEMINI_API_KEY is configured in the Convex environment. Keyword search works today; set the key and the engine will embed every chunk by itself.'}
                                </p>
                            )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                            <div className="text-2xs text-slate-500 dark:text-zinc-400">
                                <span className="font-bold text-slate-700 dark:text-zinc-300">{engine.runsCount}</span> runs
                                · last {timeAgo(engine.lastRunAt)} · {engine.maxTasksPerRun} pages/run
                            </div>
                            {lastSummary && (
                                <div className="flex flex-wrap gap-1.5">
                                    {([
                                        ['completed', 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'],
                                        ['notModified', 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'],
                                        ['dedupSkipped', 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'],
                                        ['failed', 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'],
                                        ['pdfDeferred', 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'],
                                        ['purgedBlocked', 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'],
                                    ] as const).map(([key, cls]) =>
                                        lastSummary[key] > 0 ? (
                                            <span key={key} className={`px-2 py-0.5 rounded-full text-2xs font-bold ${cls}`}>
                                                {key === 'notModified' ? '304 free' : key === 'pdfDeferred' ? 'PDFs deferred' : key === 'purgedBlocked' ? 'junk purged' : key}: {lastSummary[key]}
                                            </span>
                                        ) : null,
                                    )}
                                    {lastSummary.chunksIngested > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                            {lastSummary.chunksIngested} new chunks
                                        </span>
                                    )}
                                </div>
                            )}
                            <div className="ml-auto">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    loading={busy === 'run'}
                                    disabled={!engine.enabled}
                                    onClick={runNow}
                                    minTouchTarget
                                >
                                    Run Now
                                </Button>
                            </div>
                        </div>
                        </>
                    )}

                    {notice && (
                        <div className="mt-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3 text-xs text-primary-700 dark:text-primary-300 leading-relaxed">
                            {notice}
                        </div>
                    )}
                    {loadError && dash && (
                        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-500 font-medium">
                            {loadError}
                        </div>
                    )}
                </div>

                {/* Corpus + queue stats — every tile opens its inspector */}
                {corpus && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {statTile('Judgments', corpus.judgments, 'judgments')}
                        {statTile('Instruments', corpus.instruments, 'instruments')}
                        {statTile('Chunks', corpus.chunks, 'chunks', corpus.chunksEmbedded > 0 ? `${corpus.chunksEmbedded} embedded` : '0 embedded — tap to see why')}
                        {statTile('Raw artifacts', corpus.rawArtifacts, 'artifacts', 'stored once, hashed')}
                    </div>
                )}
                {dash && (
                    <div className={CARD}>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Queue</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {statTile('Queued', queue.queued ?? 0, 'queued')}
                            {statTile('In progress', queue.in_progress ?? 0, 'in_progress')}
                            {statTile('Completed', queue.completed ?? 0, 'completed')}
                            {statTile('Dedup / 304', queue.skipped_dedup ?? 0, 'skipped_dedup')}
                            {statTile('Failed', queue.failed ?? 0, 'failed', 'tap for URL + error')}
                        </div>
                        {Array.isArray(dash.queuedPreview) && dash.queuedPreview.length > 0 && (
                            <div className="mt-3 space-y-1">
                                <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Next up</p>
                                {dash.queuedPreview.slice(0, 5).map((q: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400">
                                        <CategoryChip category={q.domainCategory} />
                                        <span className="truncate">{q.sourceUrl}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Seed sources */}
                {Array.isArray(dash?.seeds) && dash.seeds.length > 0 && (
                    <div className={CARD}>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Authoritative sources</h3>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-3">
                            The weekly freshness sweep re-checks every enabled source; disabling stops future sweeps of it.
                        </p>
                        <div className="space-y-2">
                            {dash.seeds.map((s: any) => (
                                <div key={s.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <CategoryChip category={s.domainCategory} />
                                            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{s.authority}</span>
                                        </div>
                                        <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate mt-0.5">{s.sourceUrl} · swept {timeAgo(s.lastSweptAt)}</p>
                                    </div>
                                    <Switch
                                        checked={!!s.enabled}
                                        onToggle={() => toggleSeed(s.id, !s.enabled)}
                                        label={`${s.enabled ? 'Disable' : 'Enable'} ${s.authority}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add a URL by hand */}
                {engine?.enabled && (
                    <div className={CARD}>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Add a URL</h3>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-3">
                            Point the engine at a specific judgment or instrument page — it is classified and queued at curated priority.
                        </p>
                        <div className="flex gap-2 items-start">
                            <div className="flex-1">
                                <Input
                                    placeholder="https://nigerialii.org/…"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    styleVariant="bare"
                                    inputClassName="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <Button variant="secondary" size="sm" loading={busy === 'addurl'} disabled={!urlInput.trim()} onClick={addUrl} minTouchTarget>
                                Add
                            </Button>
                        </div>
                    </div>
                )}

                {/* Recent documents */}
                {dash && ((dash.recentJudgments?.length ?? 0) > 0 || (dash.recentInstruments?.length ?? 0) > 0) && (
                    <div className={CARD}>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Recent documents</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {dash.recentJudgments?.length > 0 && (
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Judgments</p>
                                    {dash.recentJudgments.map((j: any, i: number) => (
                                        <div key={i} className="py-1.5 border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                                            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{j.citation}</p>
                                            <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">{j.court} · {j.dateDelivered}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {dash.recentInstruments?.length > 0 && (
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Instruments</p>
                                    {dash.recentInstruments.map((ins: any, i: number) => (
                                        <div key={i} className="py-1.5 border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                                            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{ins.title}</p>
                                            <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">{ins.instrumentType.replace(/_/g, ' ')} · {ins.status}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Coverage gaps */}
                {dash?.recentGaps?.length > 0 && (
                    <div className={CARD}>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Coverage gaps</h3>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-2">
                            What users searched for that the corpus could not confidently answer — the engine queues these first (priority 0).
                        </p>
                        {dash.recentGaps.map((g: any, i: number) => (
                            <div key={i} className="py-1.5 border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                                <p className="text-xs text-slate-700 dark:text-zinc-300 truncate">
                                    {g.payload?.reason || g.payload?.sourceUrl || 'gap detected'}
                                </p>
                                <p className="text-2xs text-slate-400 dark:text-zinc-500">{timeAgo(g.createdAt)}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Activity feed */}
                {dash?.recentAudit?.length > 0 && (
                    <div className={CARD}>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Activity</h3>
                        <div className="space-y-1.5">
                            {dash.recentAudit.map((a: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-2xs">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                    <span className="font-mono font-bold text-slate-600 dark:text-zinc-300 flex-shrink-0">{a.eventType}</span>
                                    <span className="text-slate-400 dark:text-zinc-500 truncate flex-1 min-w-0">
                                        {a.payload?.documentKey || a.payload?.outcome || a.payload?.source || (a.payload?.count !== undefined ? `${a.payload.count} urls` : '')}
                                    </span>
                                    <span className="text-slate-400 dark:text-zinc-500 flex-shrink-0">{timeAgo(a.createdAt)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {!dash && !loadError && (
                    <div className={CARD}>
                        <div className="text-center py-8">
                            <div className="w-8 h-8 mx-auto border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400 mt-3">Loading the ingestion engine…</p>
                        </div>
                    </div>
                )}

                <p className="text-center text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed px-4">
                    Honest boundaries: PDFs are deferred to the desktop ingester (pypdf); embeddings stay optional — keyword
                    search works now, the vector leg joins when embeddings run. Every step is audit-logged with SHA-256 provenance.
                    Junk URLs (cdn-cgi, cookie pages, blogs) are rejected before the queue and purged from it every run.
                </p>
            </div>

            {/* ── Inspector drawer (2026-11-22) ────────────────────────────
                Bottom sheet listing the rows behind any metric tile: where
                records live, why chunks aren't embedded, and the exact URL +
                error for every failed item. Closes on veil tap or the X. */}
            {inspectorBucket && (
                <>
                    <div
                        className={`fixed inset-0 ${Z_CLASS.bottomNavVeil} bg-black/40 backdrop-blur-[2px]`}
                        onClick={() => setInspectorBucket(null)}
                    />
                    <div className={`fixed bottom-0 left-0 right-0 ${Z_CLASS.bottomNavSheet} max-h-[78vh] flex flex-col bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl animate-slide-in-up origin-bottom`}>
                        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-200 dark:border-zinc-700">
                            <div className="min-w-0">
                                <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Inspector</p>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">{String(inspectorBucket).replace(/_/g, ' ')}</h3>
                                {inspector?.hint && (
                                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">{inspector.hint}</p>
                                )}
                            </div>
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setInspectorBucket(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspectorBucket(null); } }}
                                className="p-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 flex-shrink-0 cursor-pointer"
                                aria-label="Close inspector"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-3 space-y-2">
                            {inspectorLoading && (
                                <div className="py-8 text-center">
                                    <div className="w-7 h-7 mx-auto border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                                    <p className="text-2xs text-slate-400 mt-2">Loading rows…</p>
                                </div>
                            )}
                            {!inspectorLoading && (inspector?.rows?.length ?? 0) === 0 && (
                                <p className="text-2xs text-slate-400 dark:text-zinc-500 text-center py-8">
                                    Nothing here yet — this bucket is empty.
                                </p>
                            )}
                            {!inspectorLoading && (inspector?.rows ?? []).map((row: any, i: number) => (
                                <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700">
                                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 break-words leading-snug">{row.title}</p>
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 break-words leading-relaxed">{row.sub}</p>
                                    {row.sourceUrl && row.sourceUrl !== row.title && (
                                        <p className="text-2xs text-primary-600 dark:text-primary-400 mt-1 break-all">{row.sourceUrl}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
