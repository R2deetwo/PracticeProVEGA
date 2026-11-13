/**
 * UnitsConsole — the reimagined Units tab (UNITS_PAGE_REDESIGN.md §3/§4).
 * ─────────────────────────────────────────────────────────────────────────
 * The orchestrator replacing the ~1,000-line inline IIFE in
 * PropertyDetailView. Three moves, per the approved design:
 *
 *   1. Two axes instead of one soup — occupancy (what the unit is) and
 *      health (how the tenancy is going) are separate, tiny signals.
 *   2. Triage first — the attention bar answers "what needs me today?" in
 *      one line; rows sort attention-first by default.
 *   3. Rows, not cards, as the default canvas — equally pleasant at 4 and
 *      400 units. Cards remain as the calm secondary view.
 *
 * Zero backend changes: same Convex queries, same hardened mutations
 * (updateItem / tenancyLifecycle.* / collectRent), same V1–V3 guardrails,
 * audit trails and RBAC — everything is re-homed, nothing is rewritten.
 *
 * Also carries the workspace-change obligations (owner direction):
 *   • Onboarding — a first-run intro card (dismiss once, remembered).
 *   • Settings   — the Console/Cards preference persists per user via
 *                  users.defaultViewModes.units (same pattern as matters).
 *   • Help       — the "?" button + footer hint open the shortcuts modal,
 *                  which documents the Units console keys.
 *   • Keyboard   — ↑/↓ cursor · Enter expand · Esc collapse/clear · /
 *                  search · g then c/v switch view — deliberately the same
 *                  navigation contract as the planned grid engine
 *                  (GRID_MODE_ARCHITECTURE.md §4.1) so muscle memory
 *                  transfers when Grid mode ships.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button, Card, EmptyState, Input, Select } from '../../ui';
import { useUI } from '../../../contexts/UIContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useDataActions } from '../../../contexts/DataContext';
import { Home, Plus, Keyboard as KeyboardIcon } from 'lucide-react';
import { Property, Contact } from '../../../types';
import { getUnitDisplay } from '../../../utils/propertyPayload';
import { deriveUnitHealth, compareUnitsByAttention, unitGroupLabel, type UnitGroupKey, type UnitHealth } from './useUnitHealth';
import UnitRow from './UnitRow';
import UnitDetailBand from './UnitDetailBand';
import UnitsToolbar, { type UnitsViewMode, type UnitFilter } from './UnitsToolbar';
import UnitsAttentionBar, { type AttentionBreakdown } from './UnitsAttentionBar';
import UnitsCardsView from './UnitsCardsView';
import type { TenancyStatusEntry, TenancyPanelUnit } from '../TenancyLifecyclePanel';
import type { UnitEntry, UnitsActions, UnitDisplay } from './types';

const INTRO_STORAGE_KEY = 'units_console_intro_v1';

interface UnitsConsoleProps {
    property: Property;
    owner: Contact | null;
    allUnits: Property[];
    archivedUnits: Property[];
    tenancyUnits: TenancyPanelUnit[];
    tenancyStatus: Record<string, TenancyStatusEntry> | undefined;
    ticketsByUnit: Record<string, any[]>;
    contacts: any[];
    firmId: string;
    /** Deep-link support (notification banners) — same contract as before. */
    highlightTarget: string | null;
    selectedUnit: Property | null;
    onSelectUnit: (u: Property | null) => void;
    /* Re-homed handlers — closures over property context, unchanged logic. */
    onCollectRent: (unit: Property, d: UnitDisplay) => void;
    onCompose: (unit: Property, d: UnitDisplay) => void;
    onEditUnit: (unit: Property) => void;
    onDraftAction: (actionTitle: string, type: string, unit?: Property) => void;
    onQuitNoticeDrafted: (unit: any) => void;
    onMarkQuitNoticeServed: (unit: any) => void;
    onDraftSevenDayNotice: (unit: any) => void;
    onInitializeMatter: (unit?: any) => void;
    onUpdateEvictionTracker: (unit: any, updates: any) => void;
    canUseEviction: boolean;
}

const UnitsConsole: React.FC<UnitsConsoleProps> = ({
    property, owner, allUnits, archivedUnits, tenancyUnits, tenancyStatus,
    ticketsByUnit, contacts, firmId, highlightTarget, selectedUnit, onSelectUnit,
    onCollectRent, onCompose, onEditUnit, onDraftAction, onQuitNoticeDrafted,
    onMarkQuitNoticeServed, onDraftSevenDayNotice, onInitializeMatter,
    onUpdateEvictionTracker, canUseEviction,
}) => {
    const { openModal, addToast, navigateTo } = useUI();
    const { currentUser, updateCurrentUser } = useAuth();
    const { updateItem, addUnit, handleUpdateUser } = useDataActions() as any;

    const rentCollecting = property.rentCollectionMode !== 'Management Only (No Rent)';

    // ── Merge units (allUnits + embedded legacy rows) — same construction ──
    const units: Property[] = useMemo(() => {
        const legacyUnits = ((property as any)?.units || [])
            .map((u: any, idx: number) => ({ ...u, id: u.id || `temp-unit-${idx}` }))
            .filter((u: any) => u);
        const merged = [...(allUnits || [])]
            .map(u => (u && u.id ? u : null))
            .filter((u): u is Property => u !== null);
        legacyUnits.forEach((lu: any) => {
            if (!merged.some(u => u.id === lu.id || (u as any).name === lu.name)) merged.push(lu);
        });
        return merged;
    }, [allUnits, property]);
    const isEmbeddedUnit = useCallback(
        (unit: Property) => ((property as any)?.units || []).some((lu: any) => lu.id === unit.id),
        [property]
    );

    // ── Per-unit derivation — once, centrally (the old card did this 15×) ──
    const entries: UnitEntry[] = useMemo(() => units.map(unit => {
        const display = getUnitDisplay(unit);
        const health = deriveUnitHealth({
            unit, property, includeRent: rentCollecting,
            tenancyStatus: tenancyStatus?.[String(unit.id)],
            tickets: ticketsByUnit[String(unit.id)] || [],
        });
        return { unit, display, health, tickets: ticketsByUnit[String(unit.id)] || [] };
    }), [units, property, rentCollecting, tenancyStatus, ticketsByUnit]);

    // ── View state (session) — URL as source of truth via replaceState ──
    const readParams = (): { view: UnitsViewMode; filters: UnitFilter[]; group: UnitGroupKey; q: string } => {
        try {
            const p = new URLSearchParams(window.location.search);
            const view = p.get('uview') === 'cards' ? 'cards' : 'console';
            const filters = (p.get('ufilter') || '').split(',').filter(Boolean) as UnitFilter[];
            const group = (p.get('ugroup') || 'none') as UnitGroupKey;
            const q = p.get('uq') || '';
            return { view, filters, group, q };
        } catch { return { view: 'console' as UnitsViewMode, filters: [] as UnitFilter[], group: 'none' as UnitGroupKey, q: '' }; }
    };
    const initial = useRef(readParams()).current;
    const [view, setView] = useState<UnitsViewMode>(initial.view);
    const [activeFilters, setActiveFilters] = useState<UnitFilter[]>(initial.filters);
    const [groupBy, setGroupBy] = useState<UnitGroupKey>(initial.group);
    const [search, setSearch] = useState(initial.q);
    const [attentionDismissed, setAttentionDismissed] = useState(false);
    const [showIntro, setShowIntro] = useState(false);
    const [showAddUnitForm, setShowAddUnitForm] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitType, setNewUnitType] = useState<'Residential' | 'Commercial'>('Residential');
    const [cursorIdx, setCursorIdx] = useState(0);
    const [gPending, setGPending] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // First-run onboarding — show once per device, remembered in localStorage.
    useEffect(() => {
        try { if (!localStorage.getItem(INTRO_STORAGE_KEY)) setShowIntro(true); } catch { /* private mode */ }
    }, []);
    const dismissIntro = () => {
        setShowIntro(false);
        try { localStorage.setItem(INTRO_STORAGE_KEY, 'dismissed'); } catch { /* ignore */ }
    };

    // Mirror state to the URL (replaceState — no history spam).
    useEffect(() => {
        try {
            const p = new URLSearchParams(window.location.search);
            const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
            set('uview', view === 'cards' ? 'cards' : '');
            set('ufilter', activeFilters.join(','));
            set('ugroup', groupBy !== 'none' ? groupBy : '');
            set('uq', search);
            window.history.replaceState(null, '', `${window.location.pathname}${p.toString() ? `?${p}` : ''}${window.location.hash}`);
        } catch { /* ignore */ }
    }, [view, activeFilters, groupBy, search]);

    // ── Settings: per-user view persistence (defaultViewModes.units) ──
    const persistedView = (currentUser as any)?.defaultViewModes?.units as UnitsViewMode | undefined;
    useEffect(() => {
        if (persistedView && persistedView !== view && !window.location.search.includes('uview=')) {
            setView(persistedView);
        }
        // Only sync on mount / user change — explicit toggles win afterwards.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persistedView, currentUser?.id]);

    // ── Filters / search / grouping ──
    const counts = useMemo(() => {
        const c: Record<'all' | UnitFilter, number> = { all: entries.length, occupied: 0, vacant: 0, maintenance: 0, listed: 0, action: 0, watch: 0 };
        for (const e of entries) {
            const s = String(e.unit.status || 'Vacant').toLowerCase();
            if (s === 'occupied') c.occupied++;
            else if (s === 'vacant') c.vacant++;
            else if (s === 'maintenance') c.maintenance++;
            else if (s === 'listed') c.listed++;
            if (e.health.level === 'action') c.action++;
            else if (e.health.level === 'watch') c.watch++;
        }
        return c;
    }, [entries]);

    const visible: UnitEntry[] = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = entries.filter(e => {
            const s = String(e.unit.status || 'Vacant').toLowerCase();
            if (activeFilters.length > 0) {
                const statusOk = activeFilters.every(f => {
                    if (f === 'action') return e.health.level === 'action';
                    if (f === 'watch') return e.health.level === 'watch';
                    return true; // health filters don't constrain status; status filters checked below
                });
                const hasStatusFilter = activeFilters.some(f => ['occupied', 'vacant', 'maintenance', 'listed'].includes(f));
                const statusMatch = !hasStatusFilter || activeFilters.some(f => f === s);
                if (!statusOk || !statusMatch) return false;
            }
            if (q) {
                const hay = `${e.display.name} ${e.display.tenantName || ''} ${(e.unit as any).unitName || ''} ${(e.unit as any).name || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        list = [...list].sort((a, b) => compareUnitsByAttention(
            { health: a.health, name: a.display.name },
            { health: b.health, name: b.display.name }
        ));
        return list;
    }, [entries, activeFilters, search]);

    const grouped = useMemo(() => {
        if (groupBy === 'none') return [{ key: '', label: '', entries: visible }];
        const groups: { key: string; label: string; entries: UnitEntry[] }[] = [];
        const order: string[] = [];
        const map = new Map<string, UnitEntry[]>();
        for (const e of visible) {
            const label = unitGroupLabel(groupBy, e.unit, e.health);
            if (!map.has(label)) { map.set(label, []); order.push(label); }
            map.get(label)!.push(e);
        }
        // Health groups keep their severity order; others sort naturally.
        if (groupBy === 'health') {
            const rank: Record<string, number> = { 'Needs action': 0, Watch: 1, OK: 2, 'No tenancy': 3 };
            order.sort((a, b) => (rank[a] ?? 9) - (rank[b] ?? 9));
        } else {
            order.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }
        for (const label of order) {
            const es = map.get(label)!;
            groups.push({ key: label, label, entries: es });
        }
        return groups;
    }, [visible, groupBy]);

    // ── Attention bar breakdown (same rubric as the rows) ──
    const attention: AttentionBreakdown = useMemo(() => {
        const b: AttentionBreakdown = { total: 0, expired: 0, arrears: 0, unrecorded: 0, incomplete: 0, staleTickets: 0, eviction: 0 };
        for (const e of entries) {
            if (e.health.level !== 'action') continue;
            b.total++;
            if (e.health.daysOverstayed > 0) b.expired++;
            if (e.health.reasons.some(r => r.includes('overdue'))) b.arrears++;
            if (e.health.reasons.some(r => r.includes('without a tenancy ledger'))) b.unrecorded++;
            if (e.health.reasons.some(r => r.includes('records incomplete'))) b.incomplete++;
            if (e.health.reasons.some(r => r.includes('ticket pending'))) b.staleTickets++;
            if (e.health.reasons.some(r => r.includes('Quit notice') || r.includes('7-Day'))) b.eviction++;
        }
        return b;
    }, [entries]);

    // ── Actions bundle — every handler re-homed, none rewritten ──
    const actions: UnitsActions = useMemo(() => ({
        onCollectRent,
        onCompose,
        onEditUnit,
        onDraftAction,
        onQuitNoticeDrafted,
        onMarkQuitNoticeServed,
        onDraftSevenDayNotice,
        onInitializeMatter,
        onRemoveUnit: (unit: any, d: UnitDisplay) => {
            openModal('deleteConfirmation', unit.id, {
                title: 'Remove Unit',
                message: `Remove "${d.name}" from this property? The unit will be archived — ledger entries, receipts, and historical records will be preserved.`,
                onConfirm: async () => {
                    try {
                        // SOFT-DELETE — status 'Deleted' + timestamp; all financial
                        // and legal history preserved (ARCHIVED UNITS FIX).
                        const full = allUnits.find((u: Property) => u.id === unit.id) || unit;
                        const updatePayload: any = { ...full, status: 'Deleted', deletedAt: new Date().toISOString() };
                        if ((full as any)._id) updatePayload._id = (full as any)._id;
                        await updateItem('properties', updatePayload, 'Property');
                        addToast(`Unit "${d.name}" archived. Historical records preserved.`, { type: 'success' });
                        onSelectUnit(null);
                    } catch { addToast('Failed to archive unit.', { type: 'error' }); }
                },
                confirmText: 'Archive Unit',
            });
        },
        onUpdateEvictionTracker,
        onShareLink: (unit: Property, d: UnitDisplay) => {
            const sharePropertyId = isEmbeddedUnit(unit) ? property.id : unit.id;
            const url = `${window.location.origin}/apply/${sharePropertyId}?unit=${encodeURIComponent(d.name)}`;
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(url)
                    .then(() => addToast(`Application link for ${d.name} copied — share it with prospective tenants.`, { type: 'success' }))
                    .catch(() => addToast(`Copy failed. Link: ${url}`, { type: 'info', duration: 8000 }));
            } else {
                addToast(`Link: ${url}`, { type: 'info', duration: 8000 });
            }
        },
        onSetStatus: (unit: Property, status: string, d: UnitDisplay) => {
            // Same _id + id payload discipline as the old card (id-shape fix).
            const full = allUnits.find((u: Property) => u.id === unit.id) || unit;
            const updatePayload: any = { ...full, status };
            if ((full as any)._id) updatePayload._id = (full as any)._id;
            updateItem('properties', updatePayload, 'Property');
            addToast(`${d.name} marked as ${status}`, { type: 'success' });
        },
        onUpdateRental: (unit: Property, updatedRental: any) => {
            const full = units.find((u: Property) => u.id === unit.id) || unit;
            updateItem('properties', { ...full, rentalDetails: updatedRental }, 'Property');
        },
        onOpenTickets: (unit: Property) => {
            const tickets = ticketsByUnit[String(unit.id)] || [];
            const open = tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress');
            const targetConv = open.map((t: any) => t.conversationId).find(Boolean);
            if (targetConv) navigateTo('messaging', null, { initialTab: 'inbox', selectedInboxId: String(targetConv) });
            else navigateTo('messaging' as any);
        },
        canUseEviction,
        rentCollecting,
    }), [onCollectRent, onCompose, onEditUnit, onDraftAction, onQuitNoticeDrafted, onMarkQuitNoticeServed, onDraftSevenDayNotice, onInitializeMatter, onUpdateEvictionTracker, canUseEviction, rentCollecting, allUnits, units, property, ticketsByUnit, openModal, addToast, updateItem, onSelectUnit, isEmbeddedUnit, navigateTo]);

    // ── Add Unit (moved verbatim from the IIFE) ──
    const handleAddUnitSubmit = async () => {
        if (!newUnitName.trim()) { addToast('Unit name is required', { type: 'error' }); return; }
        const newUnit = {
            id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            unitName: newUnitName.trim(),
            name: newUnitName.trim(),
            propertyType: newUnitType,
            status: 'Vacant',
            rentAmount: 0,
            rentalDetails: {
                unitName: newUnitName.trim(), rentAmount: 0, rentFrequency: 'Annually',
                leaseStart: '', leaseEnd: '', tenantName: '', tenantPhone: '', tenantEmail: '',
                serviceCharge: 0, serviceChargeAmount: 0, serviceChargeStatus: 'UNPAID',
                legalFee: 0, agencyFee: 0, cautionDeposit: 0,
            },
        };
        try {
            await addUnit(property.id, newUnit);
            setNewUnitName('');
            setNewUnitType('Residential');
            setShowAddUnitForm(false);
        } catch { addToast('Failed to add unit.', { type: 'error' }); }
    };

    // ── View switching (with per-user persistence) ──
    const changeView = (v: UnitsViewMode) => {
        setView(v);
        if (currentUser) {
            // Same pattern as the matters list/board toggle (App.tsx):
            // optimistic local update + server persistence via handleUpdateUser.
            const payload = { defaultViewModes: { ...(currentUser as any).defaultViewModes, units: v } } as any;
            try { handleUpdateUser?.(currentUser.id, payload); } catch { /* persistence is best-effort; the toggle still works */ }
            updateCurrentUser(payload);
        }
    };

    // ── Keyboard model (§3.8) — same contract as the planned grid engine ──
    const flatGroups = useMemo(() => grouped.flatMap(g => g.entries), [grouped]);
    const moveCursor = useCallback((delta: number) => {
        setCursorIdx(idx => {
            const next = Math.max(0, Math.min(flatGroups.length - 1, idx + delta));
            const el = listRef.current?.querySelector(`#unit-row-${visible[next]?.unit.id}`.replace(/[^a-zA-Z0-9-_#]/g, '')) ||
                document.getElementById(`unit-row-${String(visible[next]?.unit.id ?? '').replace(/[^a-zA-Z0-9-]/g, '_')}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return next;
        });
    }, [flatGroups.length, visible]);

    const toggleExpand = useCallback((entry: UnitEntry) => {
        onSelectUnit(selectedUnit?.id === entry.unit.id ? null : entry.unit);
    }, [selectedUnit, onSelectUnit]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            if (e.key === 'Escape') {
                if (typing && target instanceof HTMLElement) { (target as HTMLInputElement).blur?.(); return; }
                if (search) { setSearch(''); return; }
                if (selectedUnit) { onSelectUnit(null); return; }
                return;
            }
            if (typing) return;

            if (e.key === '/') { e.preventDefault(); searchInputRef.current?.focus(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); if (view === 'console') moveCursor(1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); if (view === 'console') moveCursor(-1); return; }
            if (e.key === 'Enter') {
                if (view === 'console' && flatGroups[cursorIdx]) { e.preventDefault(); toggleExpand(flatGroups[cursorIdx]); }
                return;
            }
            if (e.key === 'g' || e.key === 'G') { setGPending(true); setTimeout(() => setGPending(false), 1200); return; }
            if (gPending) {
                if (e.key === 'c' || e.key === 'C') { changeView('console'); setGPending(false); }
                if (e.key === 'v' || e.key === 'V') { changeView('cards'); setGPending(false); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, search, selectedUnit, cursorIdx, flatGroups, gPending, moveCursor, toggleExpand]);

    // Keep cursor valid when the visible list changes.
    useEffect(() => { setCursorIdx(idx => Math.min(idx, Math.max(0, flatGroups.length - 1))); }, [flatGroups.length]);

    const reviewAttention = () => {
        const next = ['action' as UnitFilter];
        setActiveFilters(next);
        setCursorIdx(0);
        const first = flatGroups.find(e => e.health.level === 'action') || flatGroups[0];
        if (first && view === 'console') {
            setCursorIdx(flatGroups.indexOf(first));
            setTimeout(() => {
                document.getElementById(`unit-row-${String(first.unit.id).replace(/[^a-zA-Z0-9-]/g, '_')}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 60);
        }
    };

    const expandedId = selectedUnit ? String(selectedUnit.id) : null;

    const renderGroup = (g: { key: string; label: string; entries: UnitEntry[] }) => (
        <div key={g.key || 'all'}>
            {g.label && (
                <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-slate-100/95 dark:bg-zinc-800/95 backdrop-blur border-y border-slate-200 dark:border-zinc-700">
                    <span className="text-2xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">{g.label}</span>
                    <span className="text-2xs text-slate-400 dark:text-zinc-500">
                        {g.entries.length} unit{g.entries.length > 1 ? 's' : ''}
                        {g.entries.some(e => e.health.level === 'action') && (
                            <span className="text-rose-500 font-bold"> · {g.entries.filter(e => e.health.level === 'action').length} action</span>
                        )}
                    </span>
                </div>
            )}
            {g.entries.map(entry => {
                const isExpanded = expandedId === String(entry.unit.id);
                const globalIdx = flatGroups.indexOf(entry);
                const highlighted = !!highlightTarget && (
                    highlightTarget === entry.unit.id ||
                    String(highlightTarget) === String(entry.unit.id) ||
                    String(highlightTarget) === String((entry.unit as any)._id) ||
                    highlightTarget === 'overdue'
                );
                return (
                    <div key={entry.unit.id}>
                        <UnitRow
                            entry={entry}
                            actions={actions}
                            expanded={isExpanded}
                            onToggleExpand={() => toggleExpand(entry)}
                            isCursor={view === 'console' && globalIdx === cursorIdx}
                            highlighted={highlighted}
                        />
                        {isExpanded && (
                            <UnitDetailBand
                                entry={entry}
                                actions={actions}
                                property={property}
                                tenancyUnits={tenancyUnits}
                                tenancyStatus={tenancyStatus}
                                contacts={contacts}
                                firmId={firmId}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-4 animate-fade-in" data-testid="units-console">
            {/* First-run onboarding (once per device) */}
            {showIntro && (
                <div className="rounded-2xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/15 px-4 py-3">
                    <div className="flex items-start gap-3">
                        <KeyboardIcon className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
                            <p className="font-bold text-slate-800 dark:text-white text-sm">The Units tab is now a work-first console</p>
                            <p>One quiet list, sorted by what needs you. The <span className="font-bold">health dot</span> summarizes each unit (● Action · ◐ Watch · ● OK) — hover it for the reasons. Filters, search and group-by narrow the list; your Console / Cards choice is remembered.</p>
                            <p className="text-slate-500 dark:text-zinc-400">Keyboard: <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">↓</kbd> move · <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">Enter</kbd> expand · <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">/</kbd> search · press <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">?</kbd> anytime for all shortcuts.</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={dismissIntro} aria-label="Dismiss intro">Got it</Button>
                    </div>
                </div>
            )}

            <UnitsToolbar
                counts={counts}
                activeFilters={activeFilters}
                onToggleFilter={(f) => setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                onClearFilters={() => setActiveFilters([])}
                search={search}
                onSearchChange={setSearch}
                searchInputRef={searchInputRef}
                groupBy={groupBy}
                onGroupChange={setGroupBy}
                view={view}
                onViewChange={changeView}
                onAddUnit={() => setShowAddUnitForm(v => !v)}
                onHelp={() => openModal('keyboardShortcuts')}
            />

            {!attentionDismissed && attention.total > 0 && (
                <UnitsAttentionBar breakdown={attention} onReview={reviewAttention} onDismiss={() => setAttentionDismissed(true)} />
            )}

            {/* Add Unit inline form (moved verbatim; ui/ primitives) */}
            {showAddUnitForm && (
                <Card padding="md" className="border-primary-200 dark:border-primary-700">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary-500" /> Add New Unit
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                            label={<>Unit Name / Number <span className="text-rose-500">*</span></>}
                            value={newUnitName}
                            onChange={e => setNewUnitName(e.target.value)}
                            placeholder="e.g. Unit 1A, Flat 3, Shop 2"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleAddUnitSubmit(); if (e.key === 'Escape') setShowAddUnitForm(false); }}
                            inputClassName="text-sm"
                        />
                        <Select
                            label="Unit Type"
                            value={newUnitType}
                            onChange={e => setNewUnitType(e.target.value as 'Residential' | 'Commercial')}
                            selectClassName="text-sm"
                        >
                            <option value="Residential">Residential</option>
                            <option value="Commercial">Commercial</option>
                        </Select>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        <Button variant="primary" size="sm" onClick={handleAddUnitSubmit}>Add Unit</Button>
                        <Button variant="secondary" size="sm" onClick={() => { setShowAddUnitForm(false); setNewUnitName(''); }}>Cancel</Button>
                    </div>
                </Card>
            )}

            {/* The console / cards canvas */}
            {units.length === 0 ? (
                <Card padding="md">
                    <EmptyState
                        icon={<Home className="w-6 h-6" />}
                        title="No units yet"
                        description={`Add units to ${property.address || 'this property'} to start recording tenancies.`}
                    />
                </Card>
            ) : visible.length === 0 ? (
                <Card padding="md">
                    <EmptyState
                        icon={<Home className="w-6 h-6" />}
                        title="No units match"
                        description="Try clearing the filters or searching for something else."
                    />
                </Card>
            ) : view === 'console' ? (
                <div>
                    <div className="rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 overflow-hidden">
                        {/* Header row — same grid as UnitRow */}
                        <div role="row" aria-hidden="true"
                            className="hidden sm:grid grid-cols-[1.25rem,minmax(0,1.2fr),auto,minmax(0,1fr),minmax(0,1.1fr),minmax(0,1fr),2.25rem] items-center gap-x-3 px-3 py-2 border-b border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-800/80">
                            <span className="text-3xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 text-center">●</span>
                            <span className="text-3xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Unit</span>
                            <span className="text-3xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 w-[76px]">Status</span>
                            <span className="text-3xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Resident</span>
                            <span className="text-3xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Lease</span>
                            <span className="text-3xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Arrears</span>
                            <span />
                        </div>
                        <div ref={listRef} role="grid" aria-rowcount={visible.length} aria-label="Units">
                            {grouped.map(renderGroup)}
                        </div>
                        {/* Live footer — the console's fixed aggregates */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-800/80">
                            <p className="text-2xs text-slate-400 dark:text-zinc-500">
                                <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">↑↓</kbd> navigate ·
                                <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">Enter</kbd> expand ·
                                <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">Esc</kbd> collapse ·
                                <kbd className="px-1 py-0.5 rounded bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 font-mono">/</kbd> search
                            </p>
                            <p className="text-2xs font-bold text-slate-500 dark:text-zinc-400">
                                {visible.length} shown · {counts.action} need attention
                                {search && ` · matching “${search}”`}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <UnitsCardsView
                    entries={visible}
                    actions={actions}
                    property={property}
                    tenancyUnits={tenancyUnits}
                    tenancyStatus={tenancyStatus}
                    contacts={contacts}
                    firmId={firmId}
                    expandedId={expandedId}
                    onOpen={(entry) => onSelectUnit(entry.unit)}
                    onClose={() => onSelectUnit(null)}
                />
            )}

            {/* Archived units (restorable) — unchanged pattern */}
            {archivedUnits.length > 0 && (
                <details className="group">
                    <summary className="list-none cursor-pointer select-none">
                        <div className="flex items-center gap-2 px-1 py-1">
                            <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                                Archived Units ({archivedUnits.length})
                            </span>
                            <span className="text-2xs text-slate-400 dark:text-zinc-600">
                                hidden from the list — restore to bring them back
                            </span>
                        </div>
                    </summary>
                    <div className="mt-2 space-y-2">
                        {archivedUnits.map((unit: Property) => {
                            const d = getUnitDisplay(unit);
                            return (
                                <div key={unit.id} className="flex items-center justify-between gap-3 p-3 bg-slate-100/60 dark:bg-zinc-800/50 rounded-2xl border border-slate-200/60 dark:border-zinc-800 opacity-75">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300 truncate">{d.name}</p>
                                        <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">
                                            {(unit as any).deletedAt ? `Archived ${new Date((unit as any).deletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Archived'}
                                            {(unit as any).rentalDetails?.tenantName ? ` · ${((unit as any).rentalDetails as any).tenantName}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                const full = archivedUnits.find((u: Property) => u.id === unit.id) || unit;
                                                const updatePayload: any = { ...full, status: 'Vacant', deletedAt: null };
                                                if ((full as any)._id) updatePayload._id = (full as any)._id;
                                                updateItem('properties', updatePayload, 'Property').then(() => {
                                                    addToast(`Unit "${d.name}" restored to the Units tab.`, { type: 'success' });
                                                }).catch(() => {
                                                    addToast('Failed to restore unit.', { type: 'error' });
                                                });
                                            }}
                                            title="Restore this unit"
                                        >
                                            Restore
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </details>
            )}
        </div>
    );
};

export default UnitsConsole;
