/**
 * ResidentProfilePanel — ROUND E (Wave E2): the consolidated resident profile.
 * ─────────────────────────────────────────────────────────────────────────
 * The manager-side aggregated view the owner brief asked for (§2): personal
 * + contact identity, current + previous tenancies with attributed payments,
 * outstanding service-charge balances, maintenance requests, documents filed
 * on the resident's tenancy properties, and portal communications — one
 * screen, no jumping between unrelated surfaces.
 *
 * Hosted twice:
 *   - ContactDetailView — for a contact who is/was a resident (the panel
 *     stays hidden for contacts with no ledger rows: not a resident → no
 *     section, no noise).
 *   - ResidentDirectory (Financials → Residents) — under the selected row.
 *
 * Conventions honored here:
 *   - READ-ONLY. No lifecycle action lives in this panel — allocations,
 *     renewals, endings and transfers stay in TenancyLifecyclePanel (E1)
 *     where they are confirmed and idempotency-keyed.
 *   - ui/ primitives ONLY (Badge / EmptyState) — zero raw interactive
 *     elements (ADR-0004 ratchet).
 *   - Privacy (owner brief §2): staff-only surface. The server enforces
 *     requireStaffCaller + firm scoping; residents see their own portal,
 *     never each other's profiles.
 *   - History is never deleted (E1(c)): a past resident's profile is
 *     complete by construction — the ledger rows survive move-outs.
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge, EmptyState } from '../ui';
import { formatNaira } from '../../utils/formatting';
import { ResidentBillPanel } from '../atrium/ResidentBillPanel';
import {
    Home, Wallet, Wrench, FileText, MessageSquare, AlertTriangle, ShieldCheck, Phone, Mail, UserRound,
} from 'lucide-react';

export interface ResidentProfilePanelProps {
    firmId: string;
    /** Lookup keys — any one suffices; the server matches rows on ANY. */
    contactId?: string | null;
    tenantUserId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    /** Directory embeds the panel under a row — indent it slightly. */
    embedded?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const day = (v: any): string => {
    if (v === null || v === undefined || v === '') return '—';
    const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
};

const chargeBadgeTone = (status: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (status === 'PAID_FULLY') return 'success';
    if (status === 'PARTIALLY_PAID') return 'warning';
    if (status === 'UNPAID') return 'danger';
    return 'neutral';
};

const tenancyBadge = (t: any): { tone: 'success' | 'neutral'; label: string } => {
    if (String(t.status ?? '') === 'active') return { tone: 'success', label: 'Active lease' };
    const reason = String(t.endReason ?? '');
    const label =
    reason === 'renewed' ? 'Ended — renewed'
        : reason === 'transferred' ? 'Ended — transferred'
            : reason === 'move_out' ? 'Ended — moved out'
                : reason === 'terminated' ? 'Ended — terminated'
                    : 'Ended';
    return { tone: 'neutral', label };
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
    <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
            {icon}{title}
        </p>
        {right}
    </div>
);

const KV: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <p className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white break-words">{value}</p>
    </div>
);

export const ResidentProfilePanel: React.FC<ResidentProfilePanelProps> = ({
    firmId, contactId, tenantUserId, contactName, contactEmail, contactPhone, embedded,
}) => {
    const { bearerToken } = useAuth() as { bearerToken: string | null };
    const hasKey = !!(contactId || tenantUserId || contactEmail || contactName);
    const profile: any = useQuery(
        api.tenancyLifecycle.getResidentProfile,
        hasKey && firmId
            ? {
                firmId,
                sessionToken: bearerToken ?? undefined,
                tenantContactId: contactId ?? undefined,
                tenantUserId: tenantUserId ?? undefined,
                tenantEmail: contactEmail ?? undefined,
                tenantName: contactName ?? undefined,
            }
            : 'skip'
    );

    // Loading: render nothing (no layout jump inside the hosts).
    if (profile === undefined) return null;
    // Not a resident on the ledger (and no name-matched maintenance) → hide.
    if (!profile.tenancies?.length && !profile.maintenance?.length) return null;

    const { resident, tenancies, maintenance, balances, documents, communications, totals } = profile;
    const activeTenancy: any = tenancies.find((t: any) => String(t.status ?? '') === 'active') ?? null;
    const outstandingTotal: number = totals?.outstanding ?? 0;

    return (
        <div className={`bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 space-y-5 ${embedded ? 'border-l-4 border-l-primary-200 dark:border-l-primary-900' : ''}`}>
            {/* ── Identity header ── */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {resident?.name || contactName || 'Resident'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                        {resident?.phone || contactPhone || '—'}
                        {resident?.email || contactEmail ? ` · ${resident?.email || contactEmail}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                    {activeTenancy
                        ? <Badge tone="success">Active lease</Badge>
                        : <Badge tone="neutral">Past resident</Badge>}
                    {resident?.hasPortalAccount && <Badge tone="info">Portal account</Badge>}
                    {contactId && <Badge tone="neutral">Linked contact</Badge>}
                </div>
            </div>

            {/* ── Identity + emergency contact ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KV label="Phone" value={resident?.phone || contactPhone || '—'} />
                <KV label="Email" value={resident?.email || contactEmail || '—'} />
                <KV
                    label="Emergency contact"
                    value={resident?.emergencyContact?.name
                        ? `${resident.emergencyContact.name}${resident.emergencyContact.relationship ? ` (${resident.emergencyContact.relationship})` : ''}${resident.emergencyContact.phone ? ` · ${resident.emergencyContact.phone}` : ''}`
                        : 'Not recorded'}
                />
            </div>

            {/* ── Current lease ── */}
            {activeTenancy && (
                <div>
                    <SectionTitle icon={<Home className="w-3.5 h-3.5" />} title="Current lease" />
                    <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <KV label="Unit" value={activeTenancy.unitLabel || '—'} />
                        <KV label="Lease window" value={`${day(activeTenancy.startDate)} → ${day(activeTenancy.endDate || activeTenancy.endedAt)}`} />
                        <KV label="Rent" value={activeTenancy.rentAmount ? `${formatNaira(Number(activeTenancy.rentAmount))}${activeTenancy.paymentFrequency ? ` / ${String(activeTenancy.paymentFrequency).toLowerCase()}` : ''}` : '—'} />
                        <KV label="Deposits" value={activeTenancy.cautionDeposit ? formatNaira(Number(activeTenancy.cautionDeposit)) : '—'} />
                    </div>
                </div>
            )}

            {/* ── Balances (current-state service charges on the active unit) ── */}
            {balances?.charges?.length ? (
                <div>
                    <SectionTitle
                        icon={<Wallet className="w-3.5 h-3.5" />}
                        title="Service charge balances"
                        right={
                            <span className={`text-sm font-black ${outstandingTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatNaira(outstandingTotal)} outstanding
                            </span>
                        }
                    />
                    <div className="space-y-1.5">
                        {balances.charges.map((c: any) => (
                            <div key={String(c._id)} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/50 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                        {c.category || 'Service charge'} · {c.cycle ? String(c.cycle).toLowerCase() : '—'}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                                        {formatNaira(Number(c.amount || 0))}
                                        {c.nextDueDate ? ` · due ${day(c.nextDueDate)}` : ''}
                                        {c.daysOverdue ? ` · ${c.daysOverdue}d overdue` : ''}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <Badge tone={chargeBadgeTone(c.serviceChargeStatus)}>
                                        {c.serviceChargeStatus === 'PAID_FULLY' ? 'Paid in full'
                                            : c.serviceChargeStatus === 'PARTIALLY_PAID' ? 'Partially paid'
                                                : c.serviceChargeStatus === 'UNPAID' ? 'Unpaid'
                                                    : 'Legacy row'}
                                    </Badge>
                                    {c.outstanding > 0 && (
                                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{formatNaira(Number(c.outstanding))} due</span>
                                    )}
                                    {c.isDefaulter && (
                                        <span className="flex items-center gap-1 text-2xs font-bold text-amber-600 dark:text-amber-400">
                                            <AlertTriangle className="w-3 h-3" /> defaulter
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* ── ROUND F (Wave F1): the rent bill statement for the active unit ── */}
            {activeTenancy?.unitId ? (
                <ResidentBillPanel
                    firmId={firmId}
                    unitId={String(activeTenancy.unitId)}
                    contactId={contactId ?? null}
                    tenantUserId={tenantUserId ?? null}
                    contactEmail={contactEmail ?? null}
                    contactName={contactName ?? null}
                />
            ) : null}

            {/* ── Lease history (never deleted — E1(c)) ── */}
            <div>
                <SectionTitle
                    icon={<FileText className="w-3.5 h-3.5" />}
                    title={`Lease history (${tenancies.length})`}
                    right={<span className="text-xs text-slate-400 dark:text-zinc-500">{totals?.paymentsCount ?? 0} attributed receipts · {formatNaira(Number(totals?.totalPaid ?? 0))} paid</span>}
                />
                {tenancies.length === 0 ? (
                    <EmptyState title="No lease history" description="This resident has no tenancy ledger rows." icon={<FileText className="w-8 h-8" />} />
                ) : (
                    <div className="space-y-1.5">
                        {tenancies.map((t: any) => {
                            const badge = tenancyBadge(t);
                            return (
                                <div key={String(t._id)} className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                            {t.unitLabel || 'Unit'} · {day(t.startDate)} → {day(t.endDate || t.endedAt)}
                                        </p>
                                        <Badge tone={badge.tone}>{badge.label}</Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                        {t.rentAmount ? `${formatNaira(Number(t.rentAmount))}${t.paymentFrequency ? ` / ${String(t.paymentFrequency).toLowerCase()}` : ''}` : 'Rent not recorded'}
                                        {` · ${Array.isArray(t.payments) ? t.payments.length : 0} receipt(s)`}
                                        {typeof t.totalPaid === 'number' ? ` · ${formatNaira(Number(t.totalPaid))} attributed` : ''}
                                    </p>
                                    {t.endNotes && (
                                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">End notes: {t.endNotes}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Maintenance requests ── */}
            <div>
                <SectionTitle icon={<Wrench className="w-3.5 h-3.5" />} title={`Maintenance (${maintenance.length})`} />
                {maintenance.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500">No maintenance requests recorded for this resident.</p>
                ) : (
                    <div className="space-y-1.5">
                        {maintenance.slice(0, 8).map((m: any) => (
                            <div key={String(m._id)} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/50 rounded-lg px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{m.subject || 'Request'}</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">{day(m.createdAt)}</p>
                                </div>
                                <Badge tone={m.status === 'open' ? 'warning' : m.status === 'in_progress' ? 'info' : m.status === 'cancelled' ? 'neutral' : 'success'}>
                                    {m.status ? String(m.status).replace('_', ' ') : '—'}
                                </Badge>
                            </div>
                        ))}
                        {maintenance.length > 8 && (
                            <p className="text-xs text-slate-400 dark:text-zinc-500">+ {maintenance.length - 8} earlier request(s)…</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Documents (filed on the resident's tenancy properties) ── */}
            <div>
                <SectionTitle icon={<FileText className="w-3.5 h-3.5" />} title={`Documents (${documents.length})`} />
                {documents.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500">No documents filed on this resident's tenancy properties yet.</p>
                ) : (
                    <div className="space-y-1">
                        {documents.slice(0, 6).map((d: any) => (
                            <p key={String(d._id)} className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                                <span className="font-semibold">{d.title || 'Untitled document'}</span>
                                {d.dateFiled ? ` · ${day(d.dateFiled)}` : ''}
                            </p>
                        ))}
                        {documents.length > 6 && (
                            <p className="text-xs text-slate-400 dark:text-zinc-500">+ {documents.length - 6} more…</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Communications (portal conversations) ── */}
            <div>
                <SectionTitle icon={<MessageSquare className="w-3.5 h-3.5" />} title={`Communications (${communications.length})`} />
                {communications.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                        {resident?.hasPortalAccount
                            ? 'No portal conversations yet.'
                            : 'No portal account — invite the resident from the property to open messaging.'}
                    </p>
                ) : (
                    <div className="space-y-1">
                        {communications.slice(0, 5).map((c: any) => (
                            <p key={String(c._id)} className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                                <span className={`font-semibold ${c.lastMessageBy === 'participant' ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                                    {c.lastMessageBy === 'participant' ? 'Resident' : 'Firm'}
                                </span>
                                {c.lastMessagePreview ? `: ${c.lastMessagePreview}` : ''}
                                {c.lastMessageAt ? ` · ${day(c.lastMessageAt)}` : ''}
                            </p>
                        ))}
                        {communications.length > 5 && (
                            <p className="text-xs text-slate-400 dark:text-zinc-500">+ {communications.length - 5} earlier conversation(s)…</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Totals + privacy line ── */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-2xs text-slate-400 dark:text-zinc-500">
                    {`Tenancies ${totals?.tenancies ?? 0} · receipts ${totals?.paymentsCount ?? 0} · paid ${formatNaira(Number(totals?.totalPaid ?? 0))} · outstanding ${formatNaira(Number(outstandingTotal))}`}
                </p>
                <p className="flex items-center gap-1 text-2xs text-slate-400 dark:text-zinc-500">
                    <ShieldCheck className="w-3 h-3" /> Staff-only · firm-scoped · history never deleted
                </p>
            </div>
        </div>
    );
};

export default ResidentProfilePanel;
