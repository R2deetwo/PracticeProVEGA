/**
 * ResidentBillPanel — ROUND F (Wave F1): the per-resident rent bill statement.
 * ─────────────────────────────────────────────────────────────────────────────
 * The owner brief §2 gap: the ledger backend was complete but there was no
 * bill view. This panel renders ONE resident's money as a statement for
 * their unit: brought-forward balance, this window's obligations (service
 * charges + rent derived from the lease terms), their attributed payments,
 * voided entries as visible-but-excluded adjustments, the overpayment credit
 * applied once at the end, and the amount currently due.
 *
 * Conventions honored here:
 *   - READ-ONLY (no lifecycle action lives here — voids/reinstates stay in
 *     the surfaces that own them, always reason-gated and audited).
 *   - ui/ primitives ONLY (Badge / EmptyState) — zero raw interactive
 *     elements (ADR-0004 ratchet).
 *   - Staff-only surface: the server enforces requireStaffCaller + firm
 *     scoping on getResidentBill; residents see their own portal.
 *   - All money figures come from the server — computed in kobo there and
 *     rendered here exactly as returned (never recomputed client-side).
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, EmptyState } from '../ui';
import { formatNaira } from '../../utils/formatting';
import { Receipt, ArrowDownToLine, ArrowUpFromLine, Ban, Wallet, CalendarClock } from 'lucide-react';

export interface ResidentBillPanelProps {
    firmId: string;
    /** The unit the bill is for (any id shape the E1 resolver accepts). */
    unitId: string;
    /** Resident identity keys — any one suffices (same union as the profile). */
    contactId?: string | null;
    tenantUserId?: string | null;
    contactEmail?: string | null;
    contactName?: string | null;
    /** Optional statement window (ISO); defaults to the last 30 days. */
    from?: string;
    to?: string;
}

const day = (ms: any) => {
    const t = Number(ms);
    if (!isFinite(t) || !t) return '—';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const kindTone: Record<string, 'info' | 'warning' | 'danger' | 'neutral' | 'success'> = {
    charge: 'warning',
    rent: 'info',
    payment: 'success',
    penalty: 'danger',
    adjustment: 'neutral',
    credit_applied: 'success',
};

const kindLabel: Record<string, string> = {
    charge: 'Charge',
    rent: 'Rent',
    payment: 'Payment',
    penalty: 'Penalty',
    adjustment: 'Adjustment',
    credit_applied: 'Credit',
};

export const ResidentBillPanel: React.FC<ResidentBillPanelProps> = ({
    firmId, unitId, contactId, tenantUserId, contactEmail, contactName, from, to,
}) => {
    const { bearerToken } = useAuth() as { bearerToken: string | null };
    const hasKey = !!(contactId || tenantUserId || contactEmail || contactName);
    const bill: any = useQuery(
        api.tenancyLifecycle.getResidentBill,
        hasKey && firmId && unitId
            ? {
                firmId,
                unitId,
                sessionToken: bearerToken ?? undefined,
                tenantContactId: contactId ?? undefined,
                tenantUserId: tenantUserId ?? undefined,
                tenantEmail: contactEmail ?? undefined,
                tenantName: contactName ?? undefined,
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
            }
            : 'skip'
    );

    if (bill === undefined) return null;
    if (!bill || bill === null) return null;

    const ending = Number(bill.endingBalance ?? 0);
    const positiveDue = ending > 0;

    return (
        <div className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-4">
            {/* ── Statement header ── */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Receipt className="w-4 h-4" />
                        Rent bill — {bill.unitLabel || 'Unit'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {bill.residentName ? `${bill.residentName} · ` : ''}
                        {day(bill.period?.from)} → {day(bill.period?.to)}
                    </p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-black ${positiveDue ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatNaira(Math.abs(ending))}
                    </p>
                    <p className="text-2xs font-semibold text-slate-500 dark:text-zinc-400">
                        {positiveDue ? 'currently due' : ending < 0 ? 'in credit' : 'settled'}
                    </p>
                </div>
            </div>

            {(!bill.lines || bill.lines.length === 0) && Number(bill.openingBalance ?? 0) === 0 ? (
                <EmptyState
                    title="Nothing on the books for this window"
                    description="No obligations due and no payments recorded for this resident's unit in the statement window."
                    icon={<Receipt className="w-8 h-8" />}
                />
            ) : (
                <>
                    {/* ── Opening balance ── */}
                    <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/50 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5" />
                                Brought forward
                            </p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{bill.openingNote}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-white flex-shrink-0">
                            {formatNaira(Number(bill.openingBalance ?? 0))}
                        </span>
                    </div>

                    {/* ── Statement lines ── */}
                    <div className="space-y-1.5">
                        {bill.lines.map((l: any, i: number) => {
                            const isAdjustment = l.kind === 'adjustment';
                            return (
                                <div
                                    key={`${l.kind}-${l.date}-${i}`}
                                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                                        isAdjustment
                                            ? 'bg-slate-50/60 dark:bg-zinc-900/30 border border-dashed border-slate-300 dark:border-zinc-700'
                                            : 'bg-slate-50 dark:bg-zinc-900/50'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <p className={`text-sm font-semibold truncate ${isAdjustment
                                            ? 'text-slate-400 dark:text-zinc-500 line-through'
                                            : 'text-slate-800 dark:text-white'}`}>
                                            {l.label}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                            {day(l.date)}
                                            {l.detail ? ` · ${l.detail}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2.5 flex-shrink-0">
                                        <Badge tone={kindTone[l.kind] ?? 'neutral'}>{kindLabel[l.kind] ?? l.kind}</Badge>
                                        {Number(l.debit) > 0 && (
                                            <span className="flex items-center gap-1 text-sm font-bold text-slate-800 dark:text-white">
                                                <ArrowUpFromLine className="w-3.5 h-3.5 text-slate-400" />
                                {formatNaira(Number(l.debit))}
                                            </span>
                                        )}
                                        {Number(l.credit) > 0 && (
                                            <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                {formatNaira(Number(l.credit))}
                                            </span>
                                        )}
                                        {isAdjustment && (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 dark:text-zinc-500">
                                                <Ban className="w-3.5 h-3.5" /> excluded
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Totals strip ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg bg-slate-50 dark:bg-zinc-900/50 p-3">
                            <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Charges + rent</p>
                            <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{formatNaira(Number(bill.totals?.charges ?? 0))}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-zinc-900/50 p-3">
                            <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Payments</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatNaira(Number(bill.totals?.payments ?? 0))}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-zinc-900/50 p-3">
                            <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                                Adjustments (excluded)
                            </p>
                            <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                                {bill.totals?.adjustmentsExcluded ?? 0} shown
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-zinc-900/50 p-3">
                            <p className="text-2xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Credit applied</p>
                            <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                                {formatNaira(Number(bill.totals?.creditApplied ?? 0))}
                            </p>
                        </div>
                    </div>

                    {/* ── Ending note ── */}
                    <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
                        {bill.endingNote}
                    </p>
                </>
            )}
        </div>
    );
};

export default ResidentBillPanel;
