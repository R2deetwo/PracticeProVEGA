/**
 * SentryReportsPanel — ROUND SENTRY 5 (estate-admin reports)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The §5 report suite, mounted on the Security & Access page (firm admin).
 * Four pulls, each a deliberate button press (a mutation on purpose — every
 * run writes an audit_logs row BEFORE returning the data):
 *
 *   Daily      — every pass whose visitDate is the chosen day, with counts
 *                (expected / on-site / completed / expired / revoked).
 *   On-site    — checked in, not yet out, right now.
 *   Historical — visitDate range, capped at 500, truncation flagged.
 *   Security   — denied entries + rejected pass attempts + vms throttles
 *                from securityEvents over the last 7 days.
 *
 * The four calls are AUTHENTICATED (requireFirmUser — bearer session,
 * firm-scoped). The public gatehouse endpoints never reach these; the
 * gatehouse board stays its minimal public projection.
 *
 * Every element uses the ui/ primitives (Button/Input/Select) — the
 * ui-primitives ratchet stays held.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button, Input, Select } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import { GateIcon, SearchIcon, ClockIcon, UserIcon, MapPinIcon } from '../../constants';

type ReportKind = 'daily' | 'onsite' | 'historical' | 'security';

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const fmtDT = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '—';
const fmtT = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';

const statusPill = (status: string, checkedInAt?: number, checkedOutAt?: number) => {
    if (checkedInAt && !checkedOutAt) return { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Inside' };
    if (checkedInAt && checkedOutAt) return { cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400', label: 'Completed' };
    if (status === 'expired') return { cls: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400', label: 'Expired' };
    if (status === 'revoked') return { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', label: 'Revoked' };
    return { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Active' };
};

export const SentryReportsPanel: React.FC = () => {
    const { currentUser, bearerToken } = useAuth();
    const firmId = currentUser?.firmId || '';
    const sessionToken = bearerToken ?? undefined;
    const userEmail = currentUser?.email;

    const [kind, setKind] = useState<ReportKind>('daily');
    const [day, setDay] = useState(today());
    const [from, setFrom] = useState(daysAgo(30));
    const [to, setTo] = useState(today());
    const [propertyId, setPropertyId] = useState('all');
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [pulling, setPulling] = useState(false);
    const [lastPulledAt, setLastPulledAt] = useState<number | null>(null);

    // Estate picker (same minimal public directory the gatehouse uses)
    const properties = useQuery(
        api.visitorManagement.getGatekeeperProperties,
        firmId ? { firmId } : 'skip'
    );

    // ─── The four pulls (mutations: each writes its audit row first) ────
    const pullDaily = useMutation(api.visitorManagement.getSentryDailyReport);
    const pullOnSite = useMutation(api.visitorManagement.getSentryOnSite);
    const pullHistorical = useMutation(api.visitorManagement.getSentryHistorical);
    const pullSecurity = useMutation(api.visitorManagement.getSentrySecurityReport);

    const scopeProperty = propertyId === 'all' ? undefined : propertyId;

    const run = async () => {
        setPulling(true);
        setError(null);
        try {
            let out: any = null;
            if (kind === 'daily') {
                out = await pullDaily({ propertyId: scopeProperty, date: day, userEmail, sessionToken });
            } else if (kind === 'onsite') {
                out = await pullOnSite({ propertyId: scopeProperty, userEmail, sessionToken });
            } else if (kind === 'historical') {
                out = await pullHistorical({ propertyId: scopeProperty, from, to, limit: 200, userEmail, sessionToken });
            } else {
                out = await pullSecurity({ from: Date.now() - 7 * 24 * 60 * 60 * 1000, to: Date.now(), propertyId: scopeProperty, userEmail, sessionToken });
            }
            setResult(out);
            setLastPulledAt(Date.now());
        } catch (err: any) {
            setResult(null);
            setError(err.message || 'The report could not be pulled.');
        } finally {
            setPulling(false);
        }
    };

    const estateOptions = useMemo(() => {
        const opts = [{ value: 'all', label: 'All estates' }];
        for (const p of properties ?? []) opts.push({ value: p.id, label: p.name });
        return opts;
    }, [properties]);

    const kindTabs: { id: ReportKind; label: string; hint: string }[] = [
        { id: 'daily', label: 'Daily log', hint: 'Every pass for the chosen day' },
        { id: 'onsite', label: 'On-site now', hint: 'Checked in, not yet out' },
        { id: 'historical', label: 'Historical', hint: 'A date range, capped at 500' },
        { id: 'security', label: 'Security', hint: 'Denials + rejected passes (7 days)' },
    ];

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <GateIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sentry Reports</h2>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400">Daily logs · on-site · historical access · denied entries and rejected passes</p>
                </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">
                Each pull is authenticated, firm-scoped, and audit-logged before the data is
                returned (who pulled what, when, at what scope). Nothing here is reachable
                from the public gatehouse terminal.
            </p>

            {/* Controls */}
            <div className="space-y-3 mb-4">
                <div className="flex flex-wrap gap-2">
                    {kindTabs.map(t => (
                        <Button
                            key={t.id}
                            size="sm"
                            variant={kind === t.id ? 'primary' : 'ghost'}
                            onClick={() => { setKind(t.id); setResult(null); setError(null); }}
                            title={t.hint}
                        >
                            {t.label}
                        </Button>
                    ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <Select
                        label="Estate"
                        value={propertyId}
                        onChange={(e: any) => setPropertyId(e.target.value)}
                        options={estateOptions}
                    />
                    {kind === 'daily' && (
                        <Input label="Day" type="date" value={day} onChange={(e: any) => setDay(e.target.value)} />
                    )}
                    {kind === 'historical' && (
                        <div className="grid grid-cols-2 gap-2">
                            <Input label="From" type="date" value={from} onChange={(e: any) => setFrom(e.target.value)} />
                            <Input label="To" type="date" value={to} onChange={(e: any) => setTo(e.target.value)} />
                        </div>
                    )}
                    {kind === 'onsite' && (
                        <div className="flex items-end">
                            <p className="text-2xs text-slate-400 pb-2">A live snapshot — pull to refresh.</p>
                        </div>
                    )}
                    {kind === 'security' && (
                        <div className="flex items-end">
                            <p className="text-2xs text-slate-400 pb-2">Covers the last 7 days of security events.</p>
                        </div>
                    )}
                </div>
                <Button variant="primary" size="md" className="w-full" disabled={pulling || !firmId} onClick={run}>
                    {pulling ? 'Pulling…' : 'Pull report'}
                </Button>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900 mb-3">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{error}</p>
                    {!firmId && <p className="text-2xs text-rose-600 dark:text-rose-500 mt-1">No firm on this account — reports are firm-scoped.</p>}
                </div>
            )}

            {/* ── Daily ─────────────────────────────────────────────── */}
            {kind === 'daily' && result && (
                <div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                        {[
                            ['Expected', result.counts.expected, 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'],
                            ['On-site', result.counts.onSite, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'],
                            ['Completed', result.counts.completed, 'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400'],
                            ['Expired', result.counts.expired, 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'],
                            ['Revoked', result.counts.revoked, 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'],
                        ].map(([label, count, cls]: any) => (
                            <div key={label} className={`p-3 rounded-lg text-center ${cls}`}>
                                <p className="text-xl font-black">{count}</p>
                                <p className="text-3xs font-bold uppercase tracking-wider">{label}</p>
                            </div>
                        ))}
                    </div>
                    <ReportRows rows={result.visitors} emptyText="No passes for that day." />
                </div>
            )}

            {/* ── On-site ───────────────────────────────────────────── */}
            {kind === 'onsite' && result && (
                <ReportRows rows={result} emptyText="Nobody is on-site right now." showDuration />
            )}

            {/* ── Historical ────────────────────────────────────────── */}
            {kind === 'historical' && result && (
                <div>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-2">
                        {result.total} records{result.truncated ? ` — capped at ${result.records.length}, narrow the range for the rest` : ''}.
                    </p>
                    <ReportRows rows={result.records} emptyText="No records in that range." />
                </div>
            )}

            {/* ── Security ──────────────────────────────────────────── */}
            {kind === 'security' && result && (
                <div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                            ['Denied entry', result.counts.denied, 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'],
                            ['Rejected passes', result.counts.rejectedPassAttempts, 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'],
                            ['Throttled', result.counts.throttled, 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'],
                        ].map(([label, count, cls]: any) => (
                            <div key={label} className={`p-3 rounded-lg text-center ${cls}`}>
                                <p className="text-xl font-black">{count}</p>
                                <p className="text-3xs font-bold uppercase tracking-wider">{label}</p>
                            </div>
                        ))}
                    </div>
                    {result.events.length === 0 ? (
                        <p className="text-xs text-slate-400">No denied entries, rejected passes or throttles in the last 7 days.</p>
                    ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {result.events.map((e: any, i: number) => (
                                <div key={i} className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                                            {e.eventType === 'sentry_denied_entry' ? 'Denied entry'
                                             : e.eventType === 'sentry_pass_attempt_rejected' ? 'Rejected pass'
                                             : 'Throttled'}
                                        </span>
                                        <span className="text-2xs text-slate-400">{fmtDT(e.timestamp)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                        {e.detail?.visitorName && <span>{e.detail.visitorName}</span>}
                                        {e.detail?.tokenCode && <span className="font-mono">{e.detail.tokenCode}</span>}
                                        {e.detail?.passRef && <span className="font-mono">{e.detail.passRef}</span>}
                                        {e.detail?.unitName && <span>· {e.detail.unitName}</span>}
                                    </div>
                                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 italic">
                                        {e.detail?.reason || e.raw}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {lastPulledAt && (
                <p className="text-3xs text-slate-400 mt-3 text-right">
                    Pulled {fmtT(lastPulledAt)} · audit-logged (resource sentry_report)
                </p>
            )}
        </div>
    );
};

/** Shared compact row renderer for pass-centric reports. */
const ReportRows: React.FC<{ rows: any[]; emptyText: string; showDuration?: boolean }> = ({ rows, emptyText, showDuration }) => {
    if (!rows || rows.length === 0) {
        return <p className="text-xs text-slate-400">{emptyText}</p>;
    }
    return (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {rows.map((r: any, i: number) => {
                const pill = statusPill(r.status, r.checkedInAt, r.checkedOutAt);
                return (
                    <div key={i} className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <UserIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.visitorName}</span>
                                    {r.unitName && (
                                        <span className="text-2xs text-slate-500 dark:text-zinc-400 inline-flex items-center gap-0.5">
                                            <MapPinIcon className="w-3 h-3" />{r.unitName}
                                        </span>
                                    )}
                                    <span className="text-2xs font-mono text-slate-400">{r.tokenCode}</span>
                                </div>
                                <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                    {showDuration ? (
                                        <span className="inline-flex items-center gap-1">
                                            <ClockIcon className="w-3 h-3" /> in {fmtDT(r.checkedInAt)} · since {fmtT(r.checkedInAt)}
                                        </span>
                                    ) : (
                                        <>
                                            {r.checkedInAt && <span>in {fmtT(r.checkedInAt)}</span>}
                                            {r.checkedOutAt && <span>· out {fmtT(r.checkedOutAt)}</span>}
                                            {!r.checkedInAt && r.expectedArrival && <span>expected ~{r.expectedArrival}</span>}
                                            {!r.checkedInAt && !r.expectedArrival && <span>not arrived</span>}
                                        </>
                                    )}
                                    {r.revokedReason && <span className="italic">· revoked: {r.revokedReason}</span>}
                                    {r.accessNote && <span className="italic truncate max-w-[12rem]">· “{r.accessNote}”</span>}
                                </div>
                            </div>
                            <span className={`text-3xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${pill.cls}`}>{pill.label}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SentryReportsPanel;
