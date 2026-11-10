/**
 * TenancyLifecyclePanel — ROUND E (Wave E1): the tenancy lifecycle console.
 * ─────────────────────────────────────────────────────────────────────────
 * Rendered inside PropertyDetailView (Units tab; and on the Summary tab for
 * single-unit non-leased properties). For every unit of the property it
 * shows the tenancy-ledger state and the contextual lifecycle actions:
 *
 *   vacant + no ledger row          → "Allocate Resident" (guided wizard)
 *   occupied + no ledger row        → "Record Current Tenancy" (backfill
 *                                     bridge for units let before the ledger)
 *   active ledger row               → "Renew" / "End" / "Transfer"
 *   any                             → "History" (ledger + attributed payments)
 *
 * Conventions honored here:
 *   - ui/ primitives ONLY (Button/Input/Select/Card/Badge) — no raw
 *     button/input/select/textarea (ADR-0004 ratchet).
 *   - Inline field validation via Input's `error` prop (first adopter of
 *     the inline-error contract), toasts via useToastFeedback.
 *   - Confirmation before consequential changes via useConfirm (End and
 *     Transfer are danger-confirmed).
 *   - Duplicate-resident detection reuses matchResidentContact (phone-first
 *     against the firm's contact directory) so staff link instead of re-type.
 *   - A stable idempotencyKey per form mount guards against double-click
 *     double-submits (the server re-checks the active-tenancy invariant).
 */
import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { Button, Input, Select, Card, Badge, EmptyState, useToastFeedback, useConfirm } from '../ui';
import { matchResidentContact } from '../../utils/residentContactSync';
import { formatNaira } from '../../utils/formatting';
// ROUND E (Wave E4): template document generation per tenancy row.
import { TenancyDocumentGenerator } from './TenancyDocumentGenerator';
import { UserPlus, ClipboardCheck, RefreshCw, LogOut, ArrowLeftRight, History as HistoryIcon, Home, FileText } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TenancyPanelUnit {
    /** Unit key in any of the 4 shapes the server resolver handles. */
    id: string;
    label: string;
    unitName: string;
    status?: string;
    tenantName?: string;
    tenantPhone?: string;
    tenantEmail?: string;
    rentAmount?: number;
    rentFrequency?: string;
    leaseStart?: string;
    leaseEnd?: string;
}

interface TenancyPanelContact {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    category?: string;
}

interface TenancyLifecyclePanelProps {
    firmId: string;
    propertyAddress: string;
    units: TenancyPanelUnit[];
    contacts: TenancyPanelContact[];
    /** E4: the property id — stamps propertyId on generated documents. */
    propertyId?: string;
}

type FormKind = 'allocate' | 'renew' | 'end' | 'transfer' | 'history' | 'document';

const RENT_FREQUENCIES = ['Annually', 'Bi-Annually', 'Quarterly', 'Monthly'];
const END_REASON_OPTIONS = [
    { value: 'move_out', label: 'Move-out (resident left)' },
    { value: 'terminated', label: 'Terminated (ended early)' },
    { value: 'other', label: 'Other' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Lease end default = same cycle length after the new start (sensible default). */
function defaultLeaseEnd(start: string, frequency?: string): string {
    const d = new Date(start);
    const f = (frequency || '').toLowerCase();
    if (f.includes('bi')) d.setMonth(d.getMonth() + 6);
    else if (f.includes('quarter')) d.setMonth(d.getMonth() + 3);
    else if (f.includes('month')) d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

// ── Main panel ──────────────────────────────────────────────────────────────

export const TenancyLifecyclePanel: React.FC<TenancyLifecyclePanelProps> = ({
    firmId,
    propertyAddress,
    units,
    contacts,
    propertyId,
}) => {
    const { bearerToken } = useAuth() as { bearerToken: string | null };
    const toast = useToastFeedback();
    const { confirm, ConfirmDialog } = useConfirm();
    // E4: firm identity + the firm's own document templates feed the
    // tenancy document generator (firm templates take precedence over the
    // built-in starter pack).
    const { coreState } = useCoreState();
    const firmTemplates = (coreState as any).documentTemplates || [];
    const firmName = (coreState as any).firmDetails?.name || '';
    const [open, setOpen] = useState<{ unitId: string; kind: FormKind } | null>(null);

    const unitIds = useMemo(() => units.map((u) => u.id).slice(0, 60), [units]);

    const status = useQuery(
        api.tenancyLifecycle.getUnitsTenancyStatus,
        firmId && bearerToken && unitIds.length > 0
            ? { firmId, unitIds, sessionToken: bearerToken }
            : 'skip'
    ) as Record<string, { resolved: boolean; unitKey?: string; active: any | null; total: number }> | undefined;

    const recordExisting = useMutation(api.tenancyLifecycle.recordExistingTenancy);

    const handleRecordExisting = async (unit: TenancyPanelUnit) => {
        try {
            const res: any = await recordExisting({ firmId, sessionToken: bearerToken ?? undefined, unitId: unit.id });
            if (res?.alreadyRecorded) {
                toast.info('This unit already has a recorded tenancy.');
            } else {
                toast.success(`Current tenancy recorded for ${unit.label}.`);
            }
            setOpen({ unitId: unit.id, kind: 'history' });
        } catch (e: any) {
            toast.error(String(e?.message || e));
        }
    };

    if (!units.length) {
        return (
            <Card padding="md" className="mt-6">
                <EmptyState
                    icon={<Home className="w-6 h-6" />}
                    title="No units yet"
                    description={`Add units to ${propertyAddress} from the property form to start recording tenancies.`}
                />
            </Card>
        );
    }

    return (
        <Card padding="md" className="mt-6">
            <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-primary-500" />
                    Tenancy Lifecycle
                </h3>
                {status && (
                    <span className="text-2xs text-slate-400 dark:text-zinc-500">
                        {Object.values(status).filter((s) => s.active).length} active ·{' '}
                        {Object.values(status).reduce((n, s) => n + (s.total || 0), 0)} recorded
                    </span>
                )}
            </div>
            <p className="text-2xs text-slate-400 dark:text-zinc-500 mb-4">
                One ledger row per occupancy — allocations, renewals, transfers and move-outs are recorded here. Payment and
                ledger history is always preserved when a resident leaves.
            </p>

            <div className="space-y-2">
                {units.map((unit) => {
                    const s = status?.[unit.id];
                    const active = s?.active ?? null;
                    const isInformallyOccupied =
                        !active && (String(unit.status || '').toLowerCase() === 'occupied' || !!unit.tenantName);
                    const isOpen = open?.unitId === unit.id;
                    return (
                        <div
                            key={unit.id}
                            className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-800/40 p-3"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{unit.label}</p>
                                        {active ? (
                                            <Badge tone="success" size="xs">Active tenancy</Badge>
                                        ) : isInformallyOccupied ? (
                                            <Badge tone="warning" size="xs">Occupied — not recorded</Badge>
                                        ) : (
                                            <Badge tone="neutral" size="xs">Vacant</Badge>
                                        )}
                                        {!!s && s.total > 0 && (
                                            <Badge tone="outline" size="xs">{s.total} recorded</Badge>
                                        )}
                                    </div>
                                    {active ? (
                                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                            {active.tenantName || 'Resident'}
                                            {active.startDate ? ` · from ${active.startDate}` : ''}
                                            {active.endDate ? ` to ${active.endDate}` : ''}
                                            {typeof active.rentAmount === 'number' && active.rentAmount > 0
                                                ? ` · ${formatNaira(active.rentAmount)} ${active.paymentFrequency || ''}`.trim()
                                                : ''}
                                        </p>
                                    ) : isInformallyOccupied ? (
                                        <p className="text-2xs text-amber-600 dark:text-amber-400 mt-0.5">
                                            {unit.tenantName || 'A resident'} is recorded on the unit but has no tenancy ledger
                                            row. Record the current tenancy to enable renewals, transfers and history.
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {active ? (
                                        <>
                                            {/* E4: generate paperwork for the ACTIVE tenancy from
                                                the firm's templates / built-in starter pack. */}
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                icon={FileText}
                                                onClick={() => setOpen(isOpen && open?.kind === 'document' ? null : { unitId: unit.id, kind: 'document' })}
                                            >
                                                Document
                                            </Button>
                                            <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => setOpen({ unitId: unit.id, kind: 'renew' })}>
                                                Renew
                                            </Button>
                                            <Button size="sm" variant="secondary" icon={ArrowLeftRight} onClick={() => setOpen({ unitId: unit.id, kind: 'transfer' })}>
                                                Transfer
                                            </Button>
                                            <Button size="sm" variant="danger-soft" icon={LogOut} onClick={() => setOpen({ unitId: unit.id, kind: 'end' })}>
                                                End
                                            </Button>
                                        </>
                                    ) : isInformallyOccupied ? (
                                        <Button size="sm" variant="primary" icon={ClipboardCheck} onClick={() => handleRecordExisting(unit)}>
                                            Record Current Tenancy
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setOpen({ unitId: unit.id, kind: 'allocate' })}>
                                            Allocate Resident
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        icon={HistoryIcon}
                                        onClick={() => setOpen(isOpen && open?.kind === 'history' ? null : { unitId: unit.id, kind: 'history' })}
                                    >
                                        History
                                    </Button>
                                </div>
                            </div>

                            {isOpen && open?.kind === 'allocate' && (
                                <AllocateForm
                                    unit={unit}
                                    firmId={firmId}
                                    bearer={bearerToken}
                                    contacts={contacts}
                                    onDone={() => { setOpen({ unitId: unit.id, kind: 'history' }); }}
                                    onCancel={() => setOpen(null)}
                                />
                            )}
                            {isOpen && open?.kind === 'renew' && active && (
                                <RenewForm
                                    unit={unit}
                                    tenancy={active}
                                    firmId={firmId}
                                    bearer={bearerToken}
                                    onDone={() => { setOpen({ unitId: unit.id, kind: 'history' }); }}
                                    onCancel={() => setOpen(null)}
                                />
                            )}
                            {isOpen && open?.kind === 'end' && active && (
                                <EndForm
                                    unit={unit}
                                    tenancy={active}
                                    firmId={firmId}
                                    bearer={bearerToken}
                                    confirm={confirm}
                                    onDone={() => { setOpen({ unitId: unit.id, kind: 'history' }); }}
                                    onCancel={() => setOpen(null)}
                                />
                            )}
                            {isOpen && open?.kind === 'transfer' && active && (
                                <TransferForm
                                    unit={unit}
                                    tenancy={active}
                                    units={units}
                                    status={status}
                                    firmId={firmId}
                                    bearer={bearerToken}
                                    confirm={confirm}
                                    onDone={() => { setOpen({ unitId: unit.id, kind: 'history' }); }}
                                    onCancel={() => setOpen(null)}
                                />
                            )}
                            {isOpen && open?.kind === 'document' && active && (
                                <div className="mt-3">
                                    <TenancyDocumentGenerator
                                        tenancy={active}
                                        unitLabel={unit.label}
                                        propertyAddress={propertyAddress}
                                        propertyId={propertyId || unit.id}
                                        firmName={firmName}
                                        firmTemplates={firmTemplates}
                                        onDone={() => setOpen(null)}
                                    />
                                </div>
                            )}
                            {isOpen && open?.kind === 'history' && (
                                <HistoryBlock
                                    unitId={unit.id}
                                    unitLabel={unit.label}
                                    firmId={firmId}
                                    bearer={bearerToken}
                                    propertyAddress={propertyAddress}
                                    propertyId={propertyId}
                                    firmName={firmName}
                                    firmTemplates={firmTemplates}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
            {ConfirmDialog}
        </Card>
    );
};

// ── Allocate (guided wizard form) ───────────────────────────────────────────

const AllocateForm: React.FC<{
    unit: TenancyPanelUnit;
    firmId: string;
    bearer: string | null;
    contacts: TenancyPanelContact[];
    onDone: () => void;
    onCancel: () => void;
}> = ({ unit, firmId, bearer, contacts, onDone, onCancel }) => {
    const toast = useToastFeedback();
    const allocateTenant = useMutation(api.tenancyLifecycle.allocateTenant);
    const idemKey = useRef(`alloc-${unit.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [leaseStart, setLeaseStart] = useState(todayIso());
    const [leaseEnd, setLeaseEnd] = useState(defaultLeaseEnd(todayIso(), unit.rentFrequency || 'Annually'));
    const [rentAmount, setRentAmount] = useState(String(unit.rentAmount ?? 0));
    const [rentFrequency, setRentFrequency] = useState(unit.rentFrequency || 'Annually');
    const [cautionDeposit, setCautionDeposit] = useState('');
    const [emName, setEmName] = useState('');
    const [emPhone, setEmPhone] = useState('');
    const [emRel, setEmRel] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    // Duplicate-resident detection: phone-first match against the firm's
    // contact directory (the same policy as the property form's sync).
    const matchedContact = useMemo(
        () => matchResidentContact({ contacts, tenantPhone: phone, tenantEmail: email }),
        [contacts, phone, email]
    );

    const submit = async () => {
        const next: Record<string, string> = {};
        if (!name.trim()) next.name = 'Resident name is required.';
        if (!leaseStart) next.leaseStart = 'Lease start is required.';
        if (leaseEnd && leaseStart && leaseEnd <= leaseStart) next.leaseEnd = 'Lease end must be after the start.';
        const rent = Number(rentAmount);
        if (!Number.isFinite(rent) || rent < 0) next.rentAmount = 'Enter a valid rent amount (0 or more).';
        if ((emName.trim() && !emPhone.trim()) || (emPhone.trim() && !emName.trim())) {
            next.emName = 'Emergency contact needs both a name and a phone.';
        }
        setErrors(next);
        if (Object.keys(next).length) return;

        setBusy(true);
        try {
            await allocateTenant({
                firmId,
                sessionToken: bearer ?? undefined,
                unitId: unit.id,
                tenantName: name.trim(),
                tenantPhone: phone.trim() || undefined,
                tenantEmail: email.trim() || undefined,
                tenantContactId: matchedContact?.id,
                leaseStart,
                leaseEnd: leaseEnd || undefined,
                rentAmount: rent,
                rentFrequency,
                cautionDeposit: cautionDeposit.trim() ? Number(cautionDeposit) : undefined,
                emergencyContactName: emName.trim() || undefined,
                emergencyContactPhone: emPhone.trim() || undefined,
                emergencyContactRelationship: emRel.trim() || undefined,
                idempotencyKey: idemKey,
            });
            toast.success(`${name.trim()} allocated to ${unit.label}.`);
            onDone();
        } catch (e: any) {
            toast.error(String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 space-y-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Allocate a resident to {unit.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Resident name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
                <Input label="Phone (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)} hint="Digits compared — +234 vs 0803 match" />
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input
                    label="Rent amount (₦)"
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    error={errors.rentAmount}
                    inputMode="numeric"
                />
                <Select
                    label="Rent frequency"
                    options={RENT_FREQUENCIES.map((f) => ({ value: f, label: f }))}
                    value={rentFrequency}
                    onChange={(e) => setRentFrequency(e.target.value)}
                />
                <Input label="Caution deposit (₦, optional)" value={cautionDeposit} onChange={(e) => setCautionDeposit(e.target.value)} inputMode="numeric" />
                <Input label="Lease start" required type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} error={errors.leaseStart} />
                <Input label="Lease end" type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} error={errors.leaseEnd} />
            </div>
            {matchedContact && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 px-3 py-2">
                    <p className="text-2xs text-blue-700 dark:text-blue-300">
                        Matches existing contact <span className="font-bold">{matchedContact.name || matchedContact.id}</span> — the
                        tenancy will be linked to this contact instead of creating a duplicate.
                    </p>
                </div>
            )}
            <details className="group">
                <summary className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 cursor-pointer select-none list-none">
                    Emergency contact (optional)
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <Input label="Name" value={emName} onChange={(e) => setEmName(e.target.value)} error={errors.emName} />
                    <Input label="Phone" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} />
                    <Input label="Relationship" value={emRel} onChange={(e) => setEmRel(e.target.value)} />
                </div>
            </details>
            <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button size="sm" variant="primary" loading={busy} onClick={submit}>Allocate Resident</Button>
            </div>
        </div>
    );
};

// ── Renew ───────────────────────────────────────────────────────────────────

const RenewForm: React.FC<{
    unit: TenancyPanelUnit;
    tenancy: any;
    firmId: string;
    bearer: string | null;
    onDone: () => void;
    onCancel: () => void;
}> = ({ unit, tenancy, firmId, bearer, onDone, onCancel }) => {
    const toast = useToastFeedback();
    const renewTenancy = useMutation(api.tenancyLifecycle.renewTenancy);
    const [start, setStart] = useState(tenancy?.endDate || todayIso());
    const [end, setEnd] = useState(defaultLeaseEnd(tenancy?.endDate || todayIso(), tenancy?.paymentFrequency || 'Annually'));
    const [rent, setRent] = useState(tenancy?.rentAmount != null ? String(tenancy.rentAmount) : '');
    const [frequency, setFrequency] = useState(tenancy?.paymentFrequency || 'Annually');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const next: Record<string, string> = {};
        if (!start) next.start = 'New lease start is required.';
        if (end && start && end <= start) next.end = 'New lease end must be after the start.';
        const rentNum = rent.trim() === '' ? null : Number(rent);
        if (rentNum != null && (!Number.isFinite(rentNum) || rentNum < 0)) next.rent = 'Enter a valid rent amount.';
        setErrors(next);
        if (Object.keys(next).length) return;

        setBusy(true);
        try {
            await renewTenancy({
                firmId,
                sessionToken: bearer ?? undefined,
                tenancyId: String(tenancy._id),
                newLeaseStart: start,
                newLeaseEnd: end || undefined,
                newRentAmount: rentNum ?? undefined,
                newRentFrequency: frequency,
            });
            toast.success(`Lease renewed for ${tenancy?.tenantName || 'the resident'}.`);
            onDone();
        } catch (e: any) {
            toast.error(String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 space-y-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Renew {tenancy?.tenantName || 'the resident'}&apos;s lease on {unit.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="New lease start" required type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errors.start} />
                <Input label="New lease end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={errors.end} />
                <Input label="New rent amount (₦)" value={rent} onChange={(e) => setRent(e.target.value)} error={errors.rent} inputMode="numeric" hint="Leave as-is to keep the current rent" />
                <Select
                    label="Rent frequency"
                    options={RENT_FREQUENCIES.map((f) => ({ value: f, label: f }))}
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                />
            </div>
            <p className="text-2xs text-slate-400 dark:text-zinc-500">
                The current ledger row is closed as &ldquo;renewed&rdquo; and a successor row starts — payment history is untouched.
            </p>
            <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button size="sm" variant="primary" loading={busy} onClick={submit}>Renew Lease</Button>
            </div>
        </div>
    );
};

// ── End (confirm-gated) ─────────────────────────────────────────────────────

const EndForm: React.FC<{
    unit: TenancyPanelUnit;
    tenancy: any;
    firmId: string;
    bearer: string | null;
    confirm: (opts: any) => Promise<boolean>;
    onDone: () => void;
    onCancel: () => void;
}> = ({ unit, tenancy, firmId, bearer, confirm, onDone, onCancel }) => {
    const toast = useToastFeedback();
    const endTenancy = useMutation(api.tenancyLifecycle.endTenancy);
    const [end, setEnd] = useState(todayIso());
    const [reason, setReason] = useState('move_out');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!end) { setErrors({ end: 'End date is required.' }); return; }
        setErrors({});
        const ok = await confirm({
            title: 'End this tenancy?',
            message: `This closes ${tenancy?.tenantName || 'the resident'}'s tenancy on ${unit.label} and marks the unit vacant. Payment history, receipts and the tenancy record itself are preserved permanently — only the unit's current-resident fields are cleared.`,
            context: tenancy?.tenantName ? `${tenancy.tenantName} · ${unit.label}` : unit.label,
            confirmLabel: 'End Tenancy',
            danger: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            await endTenancy({
                firmId,
                sessionToken: bearer ?? undefined,
                tenancyId: String(tenancy._id),
                endDate: end,
                endReason: reason,
                notes: notes.trim() || undefined,
                markUnitVacant: true,
            });
            toast.success(`Tenancy ended for ${tenancy?.tenantName || 'the resident'} — history preserved.`);
            onDone();
        } catch (e: any) {
            toast.error(String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 space-y-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-rose-500">
                End {tenancy?.tenantName || 'the resident'}&apos;s tenancy on {unit.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Effective end date" required type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={errors.end} />
                <Select label="Reason" options={END_REASON_OPTIONS} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="sm:col-span-2">
                    <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button size="sm" variant="danger" loading={busy} onClick={submit}>End Tenancy</Button>
            </div>
        </div>
    );
};

// ── Transfer (confirm-gated) ────────────────────────────────────────────────

const TransferForm: React.FC<{
    unit: TenancyPanelUnit;
    tenancy: any;
    units: TenancyPanelUnit[];
    status: Record<string, { resolved: boolean; active: any | null; total: number }> | undefined;
    firmId: string;
    bearer: string | null;
    confirm: (opts: any) => Promise<boolean>;
    onDone: () => void;
    onCancel: () => void;
}> = ({ unit, tenancy, units, status, firmId, bearer, confirm, onDone, onCancel }) => {
    const toast = useToastFeedback();
    const transferTenant = useMutation(api.tenancyLifecycle.transferTenant);
    const eligible = units.filter(
        (u) =>
            u.id !== unit.id &&
            !status?.[u.id]?.active &&
            String(u.status || '').toLowerCase() !== 'occupied' &&
            !u.tenantName
    );
    const [target, setTarget] = useState(eligible[0]?.id || '');
    const [start, setStart] = useState(todayIso());
    const [end, setEnd] = useState(defaultLeaseEnd(todayIso(), tenancy?.paymentFrequency || 'Annually'));
    const [rent, setRent] = useState(tenancy?.rentAmount != null ? String(tenancy.rentAmount) : '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const next: Record<string, string> = {};
        if (!target) next.target = 'Pick a vacant target unit.';
        if (!start) next.start = 'New lease start is required.';
        if (end && start && end <= start) next.end = 'New lease end must be after the start.';
        const rentNum = rent.trim() === '' ? null : Number(rent);
        if (rentNum != null && (!Number.isFinite(rentNum) || rentNum < 0)) next.rent = 'Enter a valid rent amount.';
        setErrors(next);
        if (Object.keys(next).length) return;

        const targetLabel = units.find((u) => u.id === target)?.label || target;
        const ok = await confirm({
            title: 'Transfer this resident?',
            message: `${tenancy?.tenantName || 'The resident'} moves from ${unit.label} to ${targetLabel}. The old unit is vacated and a new tenancy starts on the target — in one atomic step. History is preserved on both units.`,
            context: tenancy?.tenantName ? `${tenancy.tenantName}: ${unit.label} → ${targetLabel}` : `${unit.label} → ${targetLabel}`,
            confirmLabel: 'Transfer Resident',
            danger: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            await transferTenant({
                firmId,
                sessionToken: bearer ?? undefined,
                tenancyId: String(tenancy._id),
                targetUnitId: target,
                newLeaseStart: start,
                newLeaseEnd: end || undefined,
                newRentAmount: rentNum ?? undefined,
                newRentFrequency: tenancy?.paymentFrequency || undefined,
            });
            toast.success(`${tenancy?.tenantName || 'The resident'} transferred to ${targetLabel}.`);
            onDone();
        } catch (e: any) {
            toast.error(String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    if (!eligible.length) {
        return (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700">
                <p className="text-2xs text-amber-600 dark:text-amber-400">
                    No vacant target units on this property. Free up a unit (end its tenancy) or use Allocate after moving the
                    resident out.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 space-y-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Transfer {tenancy?.tenantName || 'the resident'} from {unit.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                    label="Target unit"
                    options={eligible.map((u) => ({ value: u.id, label: u.label }))}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    error={errors.target}
                />
                <Input label="New lease start" required type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errors.start} />
                <Input label="New lease end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={errors.end} />
                <Input label="Rent at new unit (₦)" value={rent} onChange={(e) => setRent(e.target.value)} error={errors.rent} inputMode="numeric" />
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button size="sm" variant="primary" loading={busy} onClick={submit}>Transfer Resident</Button>
            </div>
        </div>
    );
};

// ── History (ledger + attributed payments) ──────────────────────────────────

interface HistoryBlockProps {
    unitId: string;
    unitLabel?: string;
    firmId: string;
    bearer: string | null;
    /** E4: context for per-row document generation. */
    propertyAddress: string;
    propertyId?: string;
    firmName: string;
    firmTemplates: any[];
}

const HistoryBlock: React.FC<HistoryBlockProps> = ({
    unitId,
    unitLabel,
    firmId,
    bearer,
    propertyAddress,
    propertyId,
    firmName,
    firmTemplates,
}) => {
    const history = useQuery(
        api.tenancyLifecycle.getUnitTenancyHistory,
        firmId && bearer ? { firmId, unitId, sessionToken: bearer } : 'skip'
    ) as any;
    // E4: which history row has its generator open (by tenancy _id).
    const [docRowId, setDocRowId] = useState<string | null>(null);

    if (history === undefined) {
        return <p className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 text-2xs text-slate-400">Loading history…</p>;
    }
    if (!history?.tenancies?.length) {
        return (
            <p className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 text-2xs text-slate-400 dark:text-zinc-500">
                No tenancies recorded for this unit yet.
            </p>
        );
    }
    return (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 space-y-2">
            {history.tenancies.map((t: any) => {
                const rowId = String(t._id);
                return (
                <div key={rowId} className="rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        {String(t.status) === 'active' ? (
                            <Badge tone="success" size="xs">Active</Badge>
                        ) : (
                            <Badge tone="neutral" size="xs">Ended · {String(t.endReason || '—').replace('_', ' ')}</Badge>
                        )}
                        <p className="text-2xs font-bold text-slate-700 dark:text-zinc-200">{t.tenantName || 'Resident'}</p>
                        <span className="text-2xs text-slate-400 dark:text-zinc-500">
                            {t.startDate || '?'} → {t.endedAt || t.endDate || 'open'}
                        </span>
                        {typeof t.rentAmount === 'number' && t.rentAmount > 0 && (
                            <span className="text-2xs text-slate-400 dark:text-zinc-500">
                                {formatNaira(t.rentAmount)} {t.paymentFrequency || ''}
                            </span>
                        )}
                        {/* E4: per-row document generation (renewal letters, demand
                            notices, move-out confirmations for PAST residents too —
                            the ledger row carries everything the template needs). */}
                        <Button
                            size="sm"
                            variant="ghost"
                            icon={FileText}
                            onClick={() => setDocRowId(docRowId === rowId ? null : rowId)}
                        >
                            Document
                        </Button>
                    </div>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                        {Array.isArray(t.payments) ? t.payments.length : 0} payment{Array.isArray(t.payments) && t.payments.length === 1 ? '' : 's'} in
                        window · {formatNaira(Number(t.totalPaid) || 0)} collected
                        {t.tenantPhone ? ` · ${t.tenantPhone}` : ''}
                    </p>
                    {t.emergencyContactName && (
                        <p className="text-2xs text-slate-400 dark:text-zinc-500">
                            Emergency: {t.emergencyContactName}
                            {t.emergencyContactPhone ? ` (${t.emergencyContactPhone})` : ''}
                            {t.emergencyContactRelationship ? ` — ${t.emergencyContactRelationship}` : ''}
                        </p>
                    )}
                    {docRowId === rowId && (
                        <div className="mt-2">
                            <TenancyDocumentGenerator
                                tenancy={t}
                                unitLabel={unitLabel || 'Unit'}
                                propertyAddress={propertyAddress}
                                propertyId={propertyId || unitId}
                                firmName={firmName}
                                firmTemplates={firmTemplates}
                                onDone={() => setDocRowId(null)}
                            />
                        </div>
                    )}
                </div>
                );
            })}
        </div>
    );
};

export default TenancyLifecyclePanel;
