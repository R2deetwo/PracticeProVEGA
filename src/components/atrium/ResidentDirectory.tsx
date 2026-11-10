/**
 * ResidentDirectory — ROUND E (Wave E2): the firm-wide resident directory.
 * ─────────────────────────────────────────────────────────────────────────
 * The roster the owner brief asked for (§2): every resident the tenancy
 * ledger knows about — INCLUDING residents who were never linked to a
 * Contact row (the E1 allocation only links a contact when
 * matchResidentContact finds one) and residents whose only record is a
 * pre-ledger backfill. One row per resident:
 *
 *   - union-merged across the ledger server-side (a row that bridges a
 *     contact-less identity and a contact-linked one merges them — the
 *     "same person twice" failure mode cannot happen),
 *   - current lease + outstanding service-charge balance at a glance,
 *   - select a row → the consolidated profile (ResidentProfilePanel).
 *
 * Hosted in BillingView as the "Residents" tab (product scope: Property),
 * beside its sibling consoles (Vacancies, Maintenance).
 *
 * Conventions honored here:
 *   - ui/ primitives ONLY for interactive elements (Input / Select) —
 *     zero raw interactive elements (ADR-0004 ratchet).
 *   - READ-ONLY console: lifecycle actions stay in TenancyLifecyclePanel
 *     (E1) — this surface is for finding and understanding residents.
 *   - Staff-only data: getResidentDirectory enforces requireStaffCaller +
 *     firm scoping server-side.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { Badge, EmptyState, Input, Select } from '../ui';
import { ResidentProfilePanel } from '../details/ResidentProfilePanel';
import { formatNaira } from '../../utils/formatting';
import { Users, Wallet, Wrench, ChevronDown, ChevronRight, Search } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

type DirectoryEntry = {
    key: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    contactId: string | null;
    userId: string | null;
    hasPortalAccount: boolean;
    active: boolean;
    currentTenancy: {
        unitId: string | null; unitKey: string | null; unitLabel: string;
        propertyId: string | null; startDate: string | null; endDate: string | null;
        rentAmount: number; paymentFrequency: string | null;
    } | null;
    totals: { tenancies: number; maintenanceCount: number };
    outstanding: { amount: number; charges: number; unpaid: number; partial: number; paid: number; defaulters: number } | null;
};

const day = (v: any): string => {
    if (v === null || v === undefined || v === '') return '—';
    const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
};

export const ResidentDirectory: React.FC = () => {
    const { currentUser, bearerToken } = useAuth();
    const { coreState } = useCoreState();
    const firmId = coreState.firmDetails?.id || (currentUser as any)?.firmId || '';

    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'past'>('all');
    const [search, setSearch] = useState('');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const directory = useQuery(
        api.tenancyLifecycle.getResidentDirectory,
        firmId ? { firmId, userEmail: currentUser?.email, sessionToken: bearerToken ?? undefined } : 'skip'
    ) as { residents: DirectoryEntry[]; counts: { total: number; active: number; withOutstanding: number } } | undefined;

    const residents = directory?.residents ?? [];

    const filtered = useMemo(() => {
        let rows = residents;
        if (statusFilter === 'active') rows = rows.filter((r) => r.active);
        if (statusFilter === 'past') rows = rows.filter((r) => !r.active);
        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((r) =>
                (r.name || '').toLowerCase().includes(q) ||
                (r.email || '').toLowerCase().includes(q) ||
                (r.phone || '').toLowerCase().includes(q) ||
                (r.currentTenancy?.unitLabel || '').toLowerCase().includes(q)
            );
        }
        return rows;
    }, [residents, statusFilter, search]);

    if (directory === undefined) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* KPI chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Residents</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{directory.counts.total}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Active leases</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{directory.counts.active}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Wallet className="w-3 h-3" /> With balance due</p>
                    <p className="text-2xl font-black text-red-600 dark:text-red-400">{directory.counts.withOutstanding}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Wrench className="w-3 h-3" /> Open maintenance</p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        {residents.reduce((s, r) => s + (r.totals?.maintenanceCount ?? 0), 0)}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-56">
                    <Select
                        label="Status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'past')}
                        options={[
                            { value: 'all', label: 'All residents' },
                            { value: 'active', label: 'Active leases' },
                            { value: 'past', label: 'Past residents' },
                        ]}
                    />
                </div>
                <div className="flex-1">
                    <Input
                        label="Search"
                        placeholder="Name, phone, email, or unit…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Roster */}
            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-10 text-center">
                    {residents.length === 0 ? (
                        <EmptyState
                            title="No residents yet"
                            description="Allocate a unit (a property's Units tab → Tenancy Lifecycle) or record a sitting tenancy — every resident the ledger knows about appears here with their full history."
                            icon={<Users className="w-8 h-8" />}
                        />
                    ) : (
                        <p className="text-sm text-slate-400">No residents match the current filters.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((r) => {
                        const isOpen = selectedKey !== null && r.key === selectedKey;
                        const outstanding = r.outstanding;
                        return (
                            <div key={r.key ?? r.name ?? 'resident'} className="space-y-2">
                                <div
                                    className={`bg-white dark:bg-zinc-800 rounded-lg border p-4 cursor-pointer transition-colors ${
                                        isOpen
                                            ? 'border-primary-400 dark:border-primary-900'
                                            : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                                    }`}
                                    onClick={() => setSelectedKey(isOpen ? null : (r.key ?? null))}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                                {r.name || 'Resident'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                                                {r.currentTenancy
                                                    ? `${r.currentTenancy.unitLabel} · ${day(r.currentTenancy.startDate)} → ${day(r.currentTenancy.endDate)}${r.currentTenancy.rentAmount ? ` · ${formatNaira(r.currentTenancy.rentAmount)}${r.currentTenancy.paymentFrequency ? ` / ${String(r.currentTenancy.paymentFrequency).toLowerCase()}` : ''}` : ''}`
                                                    : `${r.totals.tenancies} past tenanc${r.totals.tenancies === 1 ? 'y' : 'ies'}`}
                                            </p>
                                            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                                                {r.phone || '—'}{r.email ? ` · ${r.email}` : ''}
                                                {` · linked contact: ${r.contactId ? 'yes' : 'no'}`}
                                                {r.hasPortalAccount ? ' · portal account' : ''}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                            {r.active
                                                ? (outstanding && outstanding.amount > 0
                                                    ? <Badge tone="danger">{formatNaira(outstanding.amount)} due</Badge>
                                                    : <Badge tone="success">Active · no balance</Badge>)
                                                : <Badge tone="neutral">Past resident</Badge>}
                                            {outstanding && outstanding.defaulters > 0 && (
                                                <span className="text-2xs font-bold text-amber-600 dark:text-amber-400">
                                                    {outstanding.defaulters} defaulter charge{outstanding.defaulters === 1 ? '' : 's'}
                                                </span>
                                            )}
                                            {isOpen
                                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                                : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                        </div>
                                    </div>
                                </div>
                                {isOpen && (
                                    <ResidentProfilePanel
                                        embedded
                                        firmId={firmId}
                                        contactId={r.contactId}
                                        tenantUserId={r.userId}
                                        contactName={r.name}
                                        contactEmail={r.email}
                                        contactPhone={r.phone}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {residents.length > 0 && (
                <p className="text-2xs text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    The roster is derived from the tenancy ledger — residents never linked to a contact row still appear. Lifecycle actions live on the property (Units tab → Tenancy Lifecycle).
                </p>
            )}
        </div>
    );
};

export default ResidentDirectory;
