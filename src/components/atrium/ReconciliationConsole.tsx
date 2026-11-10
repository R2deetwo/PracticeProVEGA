/**
 * ReconciliationConsole — ROUND F (Wave F2): the interactive reconciliation
 * workflow, the §4 capstone of the owner brief.
 * ─────────────────────────────────────────────────────────────────────────────
 * Round B built the DETECTION (the daily checker); this console is the
 * CONTROL CENTER on top of it:
 *   - the checker's latest verdict + the founder-gated "run now",
 *   - the unallocated queue: settled payments with no obligation attached
 *     (match them to the charge they were paying — audited, reversible) and
 *     overpayment credit waiting to be applied by the next cycle,
 *   - the match ledger with its authorized reversal (reason-gated, the
 *     charge restored from the stored before-snapshot, the money untouched).
 *
 * Conventions honored here:
 *   - every action goes through the SERVER's guards (requireStaffCaller +
 *     firm scoping + REQUIRED reason + idempotency). The UI never decides
 *     authorization — it renders the server's answer.
 *   - ui/ primitives ONLY (Button / Input / Select / Badge / EmptyState) —
 *     ADR-0004; zero raw interactive elements.
 *   - every figure renders exactly as the server returned it.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, Button, EmptyState, Input, Select } from '../ui';
import { formatNaira } from '../../utils/formatting';
import {
    Scale, Inbox, Wallet, History, Undo2, Link2, ShieldCheck, RefreshCw,
} from 'lucide-react';

export interface ReconciliationConsoleProps {
    firmId: string;
}

const day = (ms: any) => {
    const t = Number(ms);
    if (!isFinite(t) || !t) return '—';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const ReconciliationConsole: React.FC<ReconciliationConsoleProps> = ({ firmId }) => {
    const { currentUser, bearerToken } = useAuth() as { currentUser: any; bearerToken: string | null };
    const sessionArgs = firmId
        ? { firmId, userEmail: currentUser?.email, sessionToken: bearerToken ?? undefined }
        : 'skip';
    const isFounder = String(currentUser?.role ?? '') === 'Founder';

    // ── Reads. ────────────────────────────────────────────────────────────
    const queue: any = useQuery(api.reconciliationWorkflow.getUnallocatedPayments, sessionArgs);
    const matches: any[] = useQuery(api.reconciliationWorkflow.getReconciliationMatches, sessionArgs) ?? [];
    const reports: any[] = useQuery(api.reconciliationWorkflow.getReconciliationReportHistory, sessionArgs) ?? [];
    const charges: any[] = useQuery(
        api.sentry.getServiceChargesByFirm,
        sessionArgs
    ) ?? [];

    // ── Actions. ──────────────────────────────────────────────────────────
    const runNow = useMutation(api.financialIntegrity.runFinancialReconciliationNow);
    const matchProof = useMutation(api.reconciliationWorkflow.matchProofToCharge);
    const reverseMatchMutation = useMutation(api.reconciliationWorkflow.reverseMatch);

    // ── Local state: the match form + the reverse form. ───────────────────
    const [matchProofId, setMatchProofId] = useState<string | null>(null);
    const [matchChargeId, setMatchChargeId] = useState('');
    const [matchReason, setMatchReason] = useState('');
    const [matchError, setMatchError] = useState<string | null>(null);
    const [matchBusy, setMatchBusy] = useState(false);

    const [reverseMatchId, setReverseMatchId] = useState<string | null>(null);
    const [reverseReason, setReverseReason] = useState('');
    const [reverseError, setReverseError] = useState<string | null>(null);
    const [reverseBusy, setReverseBusy] = useState(false);
    const [runNowError, setRunNowError] = useState<string | null>(null);
    const [runNowBusy, setRunNowBusy] = useState(false);

    // Open charges only (an obligation with something left to match against).
    const openCharges = useMemo(
        () => (charges || []).filter((c: any) => String(c.serviceChargeStatus ?? '') !== 'PAID_FULLY'),
        [charges]
    );

    if (queue === undefined) {
        return <div className="p-6 text-sm text-slate-500 dark:text-zinc-400">Loading the reconciliation console…</div>;
    }

    const latestReport: any = reports?.[0] ?? null;
    const unmatched: any[] = queue?.unmatchedProofs ?? [];
    const credits: any[] = queue?.creditsWaiting ?? [];

    const submitMatch = async () => {
        if (!matchProofId) return;
        setMatchBusy(true);
        setMatchError(null);
        try {
            await matchProof({
                firmId,
                proofId: matchProofId,
                chargeId: matchChargeId,
                reason: matchReason,
                sessionToken: bearerToken ?? undefined,
                userEmail: currentUser?.email,
            });
            setMatchProofId(null);
            setMatchChargeId('');
            setMatchReason('');
        } catch (e: any) {
            setMatchError(String(e?.message ?? 'The match was refused by the server.'));
        } finally {
            setMatchBusy(false);
        }
    };

    const submitReverse = async () => {
        if (!reverseMatchId) return;
        setReverseBusy(true);
        setReverseError(null);
        try {
            await reverseMatchMutation({
                firmId,
                matchId: reverseMatchId,
                reason: reverseReason,
                sessionToken: bearerToken ?? undefined,
                userEmail: currentUser?.email,
            });
            setReverseMatchId(null);
            setReverseReason('');
        } catch (e: any) {
            setReverseError(String(e?.message ?? 'The reversal was refused by the server.'));
        } finally {
            setReverseBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ── The checker: latest verdict + run now (founder-only) ── */}
            <div className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" /> Integrity checker
                        </p>
                        {latestReport ? (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                {day(latestReport.ranAt)} · {latestReport.ok ? 'all books consistent' : 'discrepancies found'} ·
                                {' '}unmatched payments {latestReport.unmatchedSettledProofs ?? 0} · credits waiting {latestReport.creditsWaiting ?? 0}
                            </p>
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">No report yet — run it once to start the history.</p>
                        )}
                    </div>
                    {isFounder && (
                        <Button
                            variant="primary"
                            loading={runNowBusy}
                            onClick={async () => {
                                setRunNowBusy(true);
                                setRunNowError(null);
                                try {
                                    await runNow({ sessionToken: bearerToken ?? undefined, userEmail: currentUser?.email });
                                } catch (e: any) {
                                    setRunNowError(String(e?.message ?? 'The run was refused.'));
                                } finally {
                                    setRunNowBusy(false);
                                }
                            }}
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Run now
                        </Button>
                    )}
                </div>
                {runNowError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{runNowError}</p>}
                {reports && reports.length > 1 && (
                    <div className="mt-3 space-y-1">
                        {reports.slice(1, 5).map((r: any) => (
                            <div key={String(r.id)} className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-slate-500 dark:text-zinc-400">{day(r.ranAt)}</span>
                                <span className="flex items-center gap-1.5">
                                    <Badge tone={r.ok ? 'success' : 'danger'}>{r.ok ? 'ok' : 'discrepancies'}</Badge>
                                    <span className="text-slate-400 dark:text-zinc-500">
                                        queue {r.unmatchedSettledProofs ?? 0} / {r.creditsWaiting ?? 0}
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Queue section 1: settled payments with no obligation attached ── */}
            <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Inbox className="w-4 h-4" /> Unmatched payments
                    <Badge tone={unmatched.length > 0 ? 'warning' : 'success'}>{unmatched.length}</Badge>
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">
                    Settled proofs whose money booked to the ledger (Round B guarantees that part) but was never tied to an
                    obligation. Matching settles the charge and is audited + reversible.
                </p>
                {unmatched.length === 0 ? (
                    <EmptyState
                        title="Nothing unmatched"
                        description="Every settled payment is tied to its obligation (or its obligation link)."
                        icon={<Inbox className="w-8 h-8" />}
                    />
                ) : (
                    <div className="space-y-2">
                        {unmatched.map((p: any) => {
                            const expanded = matchProofId === String(p.id);
                            return (
                                <div key={String(p.id)} className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                                {p.tenantName || p.tenantEmail || 'Tenant'} · {formatNaira(Number(p.amount))}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                                {p.period ?? 'no period'}{p.method ? ` · ${String(p.method)}` : ''} · settled {day(p.settledAt)}
                                            </p>
                                        </div>
                                        <Button
                                            variant={expanded ? 'ghost' : 'secondary'}
                                            size="sm"
                                            onClick={() => {
                                                setMatchProofId(expanded ? null : String(p.id));
                                                setMatchError(null);
                                                setMatchChargeId('');
                                            }}
                                        >
                                            <Link2 className="w-3.5 h-3.5" /> {expanded ? 'Cancel' : 'Match to charge'}
                                        </Button>
                                    </div>
                                    {expanded && (
                                        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 p-3">
                                            <Select
                                                label="Open service charge"
                                                placeholder="Choose the charge this payment was for…"
                                                value={matchChargeId}
                                                onChange={(e: any) => setMatchChargeId(String(e.target.value))}
                                                options={openCharges.map((c: any) => ({
                                                    value: String(c._id),
                                                    label: `${String(c.category ?? 'Charge')} · ${formatNaira(Number(c.amount))} · ${c.outstandingBalance != null ? `${formatNaira(Number(c.outstandingBalance))} left` : 'unsettled'}`,
                                                }))}
                                            />
                                            <Input
                                                label="Reason (required — this is the audit trail)"
                                                value={matchReason}
                                                onChange={(e: any) => setMatchReason(String(e.target.value))}
                                                placeholder="e.g. Bank alert for October diesel levy"
                                            />
                                            {matchError && <p className="text-xs text-red-600 dark:text-red-400">{matchError}</p>}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    loading={matchBusy}
                                                    disabled={!matchChargeId || matchReason.trim().length < 3}
                                                    onClick={submitMatch}
                                                >
                                                    Confirm match
                                                </Button>
                                                <span className="text-xs text-slate-400 dark:text-zinc-500">
                                                    Moves no money — the payment is already booked; this ties it to its obligation.
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Queue section 2: overpayment credit waiting ── */}
            <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" /> Credit waiting to be applied
                    <Badge tone={credits.length > 0 ? 'warning' : 'success'}>{credits.length}</Badge>
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">
                    Tenant overpayments held as creditCarriedForward — the next cycle's reset and the wallet auto-deduct
                    consume them automatically; no manual action needed.
                </p>
                {credits.length === 0 ? (
                    <EmptyState
                        title="No credit waiting"
                        description="No charge holds unapplied overpayment credit."
                        icon={<Wallet className="w-8 h-8" />}
                    />
                ) : (
                    <div className="space-y-1.5">
                        {credits.map((c: any) => (
                            <div key={String(c.id)} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 px-3 py-2">
                                <span className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                    {String(c.category ?? 'Charge')}{c.unitId ? ` · ${String(c.unitId)}` : ''}
                                </span>
                                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
                                    {formatNaira(Number(c.credit))} credit
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── The match ledger ── */}
            <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <History className="w-4 h-4" /> Match ledger
                    <Badge tone="neutral">{matches.length}</Badge>
                </p>
                {matches.length === 0 ? (
                    <EmptyState
                        title="No matches yet"
                        description="Matches appear here with their reason, actor and status — reversible while active."
                        icon={<Scale className="w-8 h-8" />}
                    />
                ) : (
                    <div className="space-y-2">
                        {matches.map((m: any) => {
                            const active = String(m.status) === 'active';
                            const expanding = reverseMatchId === String(m.id);
                            return (
                                <div key={String(m.id)} className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                                {formatNaira(Number(m.matchedAmount))} · {day(m.matchedAt)}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                                {m.reason ?? '—'}{m.matchedBy ? ` · by ${String(m.matchedBy)}` : ''}
                                                {m.status === 'reversed' && m.reversalReason ? ` · reversed: ${String(m.reversalReason)}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <Badge tone={active ? 'success' : 'neutral'}>{active ? 'active' : 'reversed'}</Badge>
                                            {active && (
                                                <Button
                                                    variant={expanding ? 'ghost' : 'secondary'}
                                                    size="sm"
                                                    onClick={() => {
                                                        setReverseMatchId(expanding ? null : String(m.id));
                                                        setReverseError(null);
                                                        setReverseReason('');
                                                    }}
                                                >
                                                    <Undo2 className="w-3.5 h-3.5" /> {expanding ? 'Cancel' : 'Reverse'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {expanding && (
                                        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 p-3">
                                            <Input
                                                label="Reason (required — this is the audit trail)"
                                                value={reverseReason}
                                                onChange={(e: any) => setReverseReason(String(e.target.value))}
                                                placeholder="e.g. Matched to the wrong charge — reversing to re-match correctly"
                                            />
                                            {reverseError && <p className="text-xs text-red-600 dark:text-red-400">{reverseError}</p>}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    loading={reverseBusy}
                                                    disabled={reverseReason.trim().length < 3}
                                                    onClick={submitReverse}
                                                >
                                                    Confirm reversal
                                                </Button>
                                                <span className="text-xs text-slate-400 dark:text-zinc-500">
                                                    Restores the charge to its exact pre-match state; the payment stays booked and re-opens in the queue.
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReconciliationConsole;
