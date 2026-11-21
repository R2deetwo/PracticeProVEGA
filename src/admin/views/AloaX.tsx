/**
 * AloaX — the founder app's platform watchdog home (2026-11-19).
 *
 * OWNER SPEC: "we can have aloa x that is in charge of all the other apps
 * and ensures there are no problems." Every 15 minutes the backend
 * watchdog (convex/alox.ts) sweeps every surface — backend errors, the
 * Legal KB ingestion engine, financial reconciliation, backups, DB
 * capacity, founder-account security, messaging dispatch, alert reach —
 * and pushes the founder's phone when something turns unhealthy. This
 * view is its control room: live surface health, the open alert queue,
 * the founder login audit feed (the login push alerts land here when
 * tapped), manual "Run checks now", and "Send test alert" to prove the
 * phone channel works.
 *
 * 2026-11-22 (founder audit round):
 *   - Every surface card that has a dedicated screen is CLICKABLE and
 *     deep-links there (Backend & API → System Status, Legal KB Engine →
 *     the Ingestion console) — no dead-end cards.
 *   - The "info" check state (e.g. backups not configured) renders as an
 *     honest slate "NOT CONFIGURED" card instead of a false alarm or a
 *     reassuring green dot.
 *   - Cryptic labels decoded: the Database card names the table in plain
 *     English ("AI proactive insights — 407 rows"), the Legal KB card
 *     shows real operational telemetry (runs, completed, corpus, last
 *     run), and the financial books card shows the reconciliation
 *     figures behind the badge.
 *   - The founder-login feed explains WHY it can be empty while sessions
 *     are active (tracking began 19 Nov 2026; long-lived sessions opened
 *     before that don't re-fire verifyLogin).
 *
 * DEFENSIVE QUERY PATTERN (house convention): convex.query inside
 * useEffect + try/catch, NOT useQuery — api.alox.* needs a Convex deploy;
 * a synchronous useQuery throw would black-screen the whole founder app
 * pre-deploy. The card grid renders with "—" placeholders until the
 * backend catches up.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';
import type { AdminView } from '../AdminApp';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';
const BTN = 'px-3 py-2 rounded-lg text-2xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function timeAgo(ts: number | null | undefined): string {
    if (!ts) return 'never';
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

type Sev = 'critical' | 'warning' | 'ok' | 'info';

interface Check {
    checkKey: string;
    surface: string;
    status: 'ok' | 'problem' | 'info';
    severity?: string;
    title?: string;
    detail?: string;
}

/** Worst severity across the checks whose key starts with `prefix`. */
function surfaceSeverity(checks: Check[] | undefined, prefix: string): Sev {
    if (!checks) return 'ok';
    const relevant = checks.filter((c) => c.checkKey.startsWith(prefix));
    if (relevant.some((c) => c.status === 'problem' && c.severity === 'critical')) return 'critical';
    if (relevant.some((c) => c.status === 'problem')) return 'warning';
    if (relevant.some((c) => c.status === 'info')) return 'info';
    return 'ok';
}

const DOT: Record<Sev, string> = {
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500 animate-pulse',
    info: 'bg-slate-400',
};

const SEV_BADGE: Record<string, string> = {
    critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
};

/** Where does tapping this checkKey's alert/card go? Mirrors the backend's
 * linkViewFor routing so pushes and in-app taps land in the same place. */
function targetViewForCheck(checkKey: string): AdminView | null {
    if (checkKey.startsWith('backend.')) return 'system';
    if (checkKey.startsWith('ingestion.')) return 'ingestion';
    return null;
}

const LOGIN_EVENT: Record<string, { label: string; cls: string }> = {
    success: { label: 'Signed in', cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
    failed: { label: 'Failed attempt', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    locked: { label: 'LOCKED OUT', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
};

/**
 * 2026-11-22: cryptic metric decoded. The Database card used to read
 * "top: proactive_insights (407)" — a raw table name and a bare number.
 * Each monitored table now has a plain-English label + one-line
 * explanation of what the rows actually are.
 */
const TABLE_LABELS: Record<string, { name: string; what: string }> = {
    proactive_insights: { name: 'AI proactive insights', what: 'AI-generated deadline alerts, anomaly briefings and morning briefings for users' },
    notifications: { name: 'in-app notifications', what: 'bell entries delivered to users (reminders, messages, alerts)' },
    analytics_events: { name: 'product analytics events', what: 'usage telemetry powering the Analytics view' },
    presence: { name: 'presence pings', what: 'who-is-online heartbeats' },
    firms: { name: 'firms', what: 'workspaces on the platform' },
    users: { name: 'users', what: 'all accounts across every firm' },
    matters: { name: 'matters', what: 'legal matters/cases' },
    contacts: { name: 'contacts', what: 'clients and contacts' },
    tasks: { name: 'tasks', what: 'tasks across matters' },
    documents: { name: 'documents', what: 'files and generated documents' },
    invoices: { name: 'invoices', what: 'issued invoices' },
    ledger_entries: { name: 'ledger entries', what: 'financial ledger rows' },
    service_charges: { name: 'service charges', what: 'property service charges' },
    payment_proofs: { name: 'payment proofs', what: 'uploaded payment evidence awaiting reconciliation' },
    scheduled_messages: { name: 'scheduled messages', what: 'WhatsApp/email messages queued for delivery' },
    portal_messages: { name: 'portal messages', what: 'resident↔firm portal conversations' },
    portal_conversations: { name: 'portal conversations', what: 'portal conversation threads' },
    maintenance_tickets: { name: 'maintenance tickets', what: 'property maintenance requests' },
    archive: { name: 'archive', what: 'archived records' },
    automation_logs: { name: 'automation logs', what: 'automation engine run history' },
    leads_pipeline: { name: 'leads pipeline', what: 'sales leads' },
};

function tableLabel(table: string): { name: string; what: string } {
    return TABLE_LABELS[table] ?? { name: table.replace(/_/g, ' '), what: 'platform data table' };
}

export const AloaX: React.FC<{ onNavigate?: (view: AdminView) => void }> = ({ onNavigate }) => {
    const { bearerToken } = useFounderAuth();
    const { addToast } = useFounderToast();
    const convex = useConvex();
    const sessionToken = bearerToken ?? undefined;

    const [data, setData] = useState<any>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!convex || !sessionToken) return;
        try {
            const result = await convex.query(api.alox.getAloxStatus, { sessionToken });
            setData(result);
            setLoadError(null);
        } catch (e: any) {
            setLoadError(e?.message || 'Could not load the watchdog dashboard.');
        }
    }, [convex, sessionToken]);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 30_000);
        return () => clearInterval(interval);
    }, [refresh]);

    const runNow = async () => {
        if (!convex || !sessionToken) return;
        setBusy('run');
        try {
            const result: any = await convex.action(api.alox.runAloxWatchdogNow, { sessionToken });
            addToast(`Sweep complete — ${result?.openCount ?? 0} open alert${result?.openCount === 1 ? '' : 's'} across ${result?.checksRun ?? 0} checks.`, { type: 'success' });
            await refresh();
        } catch (e: any) {
            addToast(e?.message || 'Sweep failed.', { type: 'error' });
        } finally {
            setBusy(null);
        }
    };

    const sendTest = async () => {
        if (!convex || !sessionToken) return;
        setBusy('test');
        try {
            await convex.mutation(api.alox.sendAloxTestAlert, { sessionToken });
            addToast('Test alert sent — check your phone (Aloa X Watchdog channel).', { type: 'success' });
        } catch (e: any) {
            addToast(e?.message || 'Test alert failed.', { type: 'error' });
        } finally {
            setBusy(null);
        }
    };

    const checks: Check[] = data?.checks ?? [];
    const openAlerts: any[] = data?.openAlerts ?? [];
    const resolved: any[] = data?.recentResolved ?? [];
    const signals = data?.signals;
    const state = data?.state;

    const criticalCount = checks.filter((c) => c.status === 'problem' && c.severity === 'critical').length;
    const warningCount = checks.filter((c) => c.status === 'problem' && c.severity !== 'critical').length;
    const overall: Sev | 'unknown' = !state
        ? 'unknown'
        : criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok';

    const overallMeta = {
        ok: { ring: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', label: 'All clear', text: 'text-emerald-600 dark:text-emerald-400' },
        warning: { ring: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20', label: `${warningCount} warning${warningCount === 1 ? '' : 's'}`, text: 'text-amber-600 dark:text-amber-400' },
        critical: { ring: 'border-red-500 bg-red-50 dark:bg-red-900/20', label: `${criticalCount} critical`, text: 'text-red-600 dark:text-red-400' },
        unknown: { ring: 'border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-800', label: 'Not run yet', text: 'text-slate-500 dark:text-zinc-400' },
    }[overall];

    // ── Surface card model ────────────────────────────────────────────────
    // `target` (optional) makes a card clickable — it deep-links to the
    // screen with the details for that surface. No dead-end cards.
    const surfaces: Array<{ key: string; name: string; icon: string; stat: string; sub: string; target?: AdminView }> = [
        {
            key: 'backend', name: 'Backend & API',
            icon: 'M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2zM3 13h18M9 21h6',
            stat: signals ? `${signals.backend.errors24h} errors / 24h` : '—',
            sub: signals ? `${signals.backend.errors7d} in the last 7 days — tap for each failure + stack trace` : 'loading…',
            target: 'system',
        },
        {
            key: 'ingestion', name: 'Legal KB Engine',
            icon: 'M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z',
            // 2026-11-22: real telemetry instead of a bare "ON" — run count,
            // last run, queue progress and the corpus it built.
            stat: signals ? (signals.ingestion.enabled ? `ON — ran ${timeAgo(signals.ingestion.lastRunAt)}` : 'PAUSED') : '—',
            sub: signals
                ? `${signals.ingestion.runsCount} runs · ${signals.ingestion.completed} completed · ${signals.ingestion.failed} failed · ${signals.ingestion.queued} queued — corpus: ${signals.ingestion.corpus.judgments} judgments, ${signals.ingestion.corpus.instruments} instruments, ${signals.ingestion.corpus.chunks} chunks`
                : 'loading…',
            target: 'ingestion',
        },
        {
            key: 'finance', name: 'Financial Books',
            icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 0v-.375c0-.621.504-1.125 1.125-1.125H21a.75.75 0 01.75.75v.375m0 0V9.75M3.75 14.25V9.75',
            // The badge is backed by financial_reconciliation_reports — the
            // daily 07:15 UTC reconciliation cron's real figures ride along.
            stat: signals ? (signals.finance ? (signals.finance.ok ? 'BALANCED' : 'RED REPORT') : 'NEVER RUN') : '—',
            sub: signals?.finance
                ? `last check ${timeAgo(signals.finance.ranAt)} · ${signals.finance.unmatchedSettledProofs} unmatched proofs · ${signals.finance.creditsWaiting} credits waiting (daily 07:15 UTC reconciliation)`
                : 'no reconciliation report yet — the daily 07:15 UTC checker has not recorded a run',
        },
        {
            key: 'backups', name: 'Backups',
            icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375',
            // 2026-11-22: unconfigured ≠ failing. When no target env vars
            // are set the nightly job skips by design — say THAT instead
            // of "never completed".
            stat: signals
                ? (signals.backups.targetsConfigured?.length
                    ? timeAgo(signals.backups.lastSuccessAt)
                    : 'NOT CONFIGURED')
                : '—',
            sub: signals
                ? (signals.backups.targetsConfigured?.length
                    ? `last success ${timeAgo(signals.backups.lastSuccessAt)} · target: ${signals.backups.target ?? signals.backups.targetsConfigured.join(' + ')}`
                    : 'the nightly 02:00 UTC export job exists but no target is set — add GITHUB_BACKUP_* or TELEGRAM_* env vars (Runbook → Backups)')
                : 'loading…',
        },
        {
            key: 'security', name: 'Security',
            icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
            stat: signals ? `${signals.security.founderCount} founder · ${signals.security.failedLogins24h} failed/24h` : '—',
            sub: signals ? signals.security.founders.map((f: any) => `${f.email}: ${f.activeSessions} session${f.activeSessions === 1 ? '' : 's'}, ${f.activeTokens} device${f.activeTokens === 1 ? '' : 's'}`).join(' · ') : 'loading…',
        },
        {
            key: 'messaging', name: 'Messaging',
            icon: 'M10.34 15.84a3 3 0 100-5.68 3 3 0 000 5.68zM7.51 7.34a6 6 0 018.98 0M4.66 4.49a10 10 0 0114.69 0',
            stat: signals ? `${signals.messaging.backlog} overdue` : '—',
            sub: 'scheduled messages past their delivery time',
        },
        {
            key: 'alerts', name: 'Alert Reach',
            icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
            stat: signals ? `${signals.push.foundersWithActiveTokens} device${signals.push.foundersWithActiveTokens === 1 ? '' : 's'} registered` : '—',
            sub: 'phones Aloa X can push to',
        },
        {
            key: 'db', name: 'Database',
            icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
            // 2026-11-22: decoded. Was: "top: proactive_insights (407)" — a
            // raw table name + bare count. Now: what the table IS, how many
            // rows, and when it was measured.
            stat: signals?.db?.topTables?.[0]
                ? `Largest: ${tableLabel(signals.db.topTables[0].table).name} — ${signals.db.topTables[0].rowCount} rows`
                : '—',
            sub: signals?.db?.topTables?.[0]
                ? `${tableLabel(signals.db.topTables[0].table).what}${signals.db.topTables[0].capped ? ' · at the 5000-row monitoring cap' : ''} · measured ${timeAgo(signals.db.recordedAt ? Date.parse(signals.db.recordedAt) : null)}`
                : 'no capacity recording yet',
        },
    ];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            Aloa X
                            <span className="px-2 py-0.5 rounded-full text-3xs font-black bg-gradient-to-r from-primary-600 to-violet-600 text-white">WATCHDOG</span>
                        </h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            In charge of all the apps — sweeps every surface every 15 minutes and pushes your phone when something is wrong.
                            {state ? ` Last sweep ${timeAgo(state.lastRunAt)} (${state.checksRun} checks).` : ' The watchdog has not run yet on this backend.'}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className={`px-3 py-1.5 rounded-lg border-2 font-black text-xs ${overallMeta.ring} ${overallMeta.text}`}>{overallMeta.label}</div>
                    </div>
                </div>
                <div className="flex gap-2 mt-3">
                    <button onClick={runNow} disabled={!!busy} className={`${BTN} bg-primary-600 text-white hover:bg-primary-700`}>
                        {busy === 'run' ? 'Sweeping…' : 'Run checks now'}
                    </button>
                    <button onClick={sendTest} disabled={!!busy} className={`${BTN} bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-600`}>
                        {busy === 'test' ? 'Sending…' : 'Send test alert'}
                    </button>
                    <button onClick={refresh} disabled={!!busy} className={`${BTN} bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-600`}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-6">
                {loadError && (
                    <div className={`${CARD} border-red-200 dark:border-red-900`}>
                        <p className="text-xs font-bold text-red-600 dark:text-red-400">Could not reach the watchdog</p>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1">{loadError}</p>
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">The backend may need a Convex deploy for the new alox module — everything else in the app keeps working.</p>
                    </div>
                )}

                {/* Open alerts — each routes to its surface's detail screen */}
                {openAlerts.length > 0 && (
                    <div>
                        <p className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">Open alerts ({openAlerts.length})</p>
                        <div className="space-y-2">
                            {[...openAlerts].sort((a: any, b: any) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1)).map((a: any) => {
                                const target = targetViewForCheck(a.checkKey);
                                return (
                                <div
                                    key={a._id}
                                    role={target ? 'button' : undefined}
                                    tabIndex={target ? 0 : undefined}
                                    onClick={() => target && onNavigate?.(target)}
                                    onKeyDown={(e) => { if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onNavigate?.(target); } }}
                                    className={`${CARD} ${a.severity === 'critical' ? 'border-red-200 dark:border-red-900' : 'border-amber-200 dark:border-amber-900'} ${target ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className={`px-2 py-0.5 rounded-full text-3xs font-black flex-shrink-0 mt-0.5 ${SEV_BADGE[a.severity] || SEV_BADGE.warning}`}>
                                            {a.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</p>
                                            <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{a.detail}</p>
                                            <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                                                {a.surface} · first seen {timeAgo(a.firstSeenAt)} · notified {a.notifyCount ?? 1}×
                                                {target ? ' · tap for details' : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Surface grid — cards with a detail screen are clickable */}
                <div>
                    <p className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">All apps &amp; surfaces</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {surfaces.map((s) => {
                            const sev = surfaceSeverity(checks, s.key);
                            const clickable = !!s.target && !!onNavigate;
                            return (
                                <div
                                    key={s.key}
                                    role={clickable ? 'button' : undefined}
                                    tabIndex={clickable ? 0 : undefined}
                                    onClick={() => clickable && onNavigate!(s.target!)}
                                    onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onNavigate!(s.target!); } }}
                                    className={`${CARD} ${clickable ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 transition-colors' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <svg className="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                                            </svg>
                                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{s.name}</p>
                                        </div>
                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[sev]}`} aria-label={sev} />
                                    </div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">{s.stat}</p>
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 break-words">{s.sub}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Founder login feed */}
                <div>
                    <p className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">Founder account logins</p>
                    <div className={CARD}>
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 mb-3">
                            Every login attempt on a founder account is pushed to your phone and recorded here — a wrong password anywhere in the world makes your phone buzz.
                        </p>
                        {/* 2026-11-22: the honest explanation for the empty
                            feed. A session opened before 19 Nov 2026 (or kept
                            alive via "remember me") never re-fires verifyLogin,
                            so "no events" + "active sessions" is EXPECTED,
                            not a tracking bug. */}
                        {signals && signals.recentLogins.length === 0 && (
                            <div className="rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700 p-3 mb-2">
                                <p className="text-2xs font-bold text-slate-600 dark:text-zinc-300">No login events recorded yet — and that can be normal.</p>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                    Login-event tracking began 19 Nov 2026. Sessions opened before that (or kept alive with “remember me”) don’t sign in again, so they never appear here.
                                    {signals.security.founders?.length ? ` Active sessions right now: ${signals.security.founders.reduce((n: number, f: any) => n + (f.activeSessions || 0), 0)} across ${signals.security.founders.length} founder account${signals.security.founders.length === 1 ? '' : 's'}.` : ''}
                                    {' '}Sign out and back in to seed this feed.
                                </p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            {(signals?.recentLogins ?? []).map((e: any, i: number) => {
                                const meta = LOGIN_EVENT[e.event] || LOGIN_EVENT.failed;
                                return (
                                    <div key={i} className="flex items-center gap-2 min-w-0">
                                        <span className={`px-2 py-0.5 rounded-full text-3xs font-black flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                                        <p className="text-2xs text-slate-600 dark:text-zinc-300 truncate flex-1">
                                            {e.email}
                                            {e.clientHint ? ` · ${e.clientHint === 'founder-apk' ? 'Founder APK' : e.clientHint}` : ''}
                                            {typeof e.attemptsRemaining === 'number' ? ` · ${e.attemptsRemaining} attempts left` : ''}
                                        </p>
                                        <p className="text-2xs text-slate-400 dark:text-zinc-500 flex-shrink-0">{timeAgo(e.createdAt)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Recently resolved */}
                {resolved.length > 0 && (
                    <div>
                        <p className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2 px-1">Recently resolved</p>
                        <div className={CARD}>
                            <div className="space-y-1.5">
                                {resolved.map((a: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 min-w-0">
                                        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <p className="text-2xs text-slate-600 dark:text-zinc-300 truncate flex-1">{a.title}</p>
                                        <p className="text-2xs text-slate-400 dark:text-zinc-500 flex-shrink-0">cleared {timeAgo(a.resolvedAt)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
