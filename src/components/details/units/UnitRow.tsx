/**
 * UnitRow — one quiet, work-first row (§3.3).
 * Columns: health dot · unit (+floor/type/tickets subline) · occupancy chip
 * (click = the existing quick status dropdown) · resident · lease (with
 * +Nd overstayed in red, "Not recorded" in amber) · arrears tokens · ⋯ menu
 * (every quick action from the old card). Click = expand the detail band
 * below the row — no grid reflow.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../ui';
import { Receipt, Megaphone, MessageSquare, EditIcon, Share2, MoreHorizontal, Wrench, Scale, Trash2, ChevronDown } from './rowIcons';
import UnitHealthBadge from './UnitHealthBadge';
import { arrearsTokens } from './useUnitHealth';
import { STATUS_CLASS } from './statusClasses';
import type { UnitEntry, UnitsActions } from './types';

const STATUSES = ['Occupied', 'Vacant', 'Maintenance', 'Listed'] as const;

/** Dismiss the open dropdown when clicking anywhere else. */
const useDismiss = (open: boolean, onClose: () => void) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, onClose]);
    return ref;
};

interface UnitRowProps {
    entry: UnitEntry;
    actions: UnitsActions;
    expanded: boolean;
    onToggleExpand: () => void;
    isCursor: boolean;
    highlighted: boolean;
}

const UnitRow: React.FC<UnitRowProps> = ({ entry, actions, expanded, onToggleExpand, isCursor, highlighted }) => {
    const { unit, display: d, health } = entry;
    const [statusOpen, setStatusOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const statusRef = useDismiss(statusOpen, () => setStatusOpen(false));
    const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));

    const uStatus = String(unit.status || 'Vacant');
    const occupied = uStatus === 'Occupied';
    const tokens = arrearsTokens(health.streams);
    const ticketsOpen = entry.tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress');

    const leaseCell = () => {
        if (health.daysOverstayed > 0 || (occupied && d.leaseEnd && new Date(d.leaseEnd).getTime() < Date.now())) {
            return (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    Ended {new Date(d.leaseEnd!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} <span className="whitespace-nowrap">+{health.daysOverstayed}d</span>
                </span>
            );
        }
        if (d.leaseEnd) {
            const pct = health.termProgress !== null ? Math.round(health.termProgress * 100) : null;
            return (
                <span className="text-xs text-slate-600 dark:text-zinc-300">
                    Ends {new Date(d.leaseEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    {pct !== null && pct >= 75 && <span className="text-amber-600 dark:text-amber-400 font-bold"> · {pct}%</span>}
                </span>
            );
        }
        if (occupied) return <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Not recorded</span>;
        return <span className="text-xs text-slate-300 dark:text-zinc-600">—</span>;
    };

    const arrearsCell = () => {
        if (tokens.length > 0) {
            return (
                <span className="flex items-center gap-1 flex-wrap">
                    {tokens.map((t, i) => (
                        <span
                            key={i}
                            className={`text-2xs font-black px-1.5 py-0.5 rounded ${
                                t.tone === 'overdue'
                                    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}
                        >
                            {t.label}
                        </span>
                    ))}
                </span>
            );
        }
        if (health.level === 'watch' && health.reasons.some(r => r.includes('needs info'))) {
            return <span className="text-2xs font-bold text-amber-500 dark:text-amber-400 italic">needs info</span>;
        }
        if (health.streams.sc.state === 'clear' || health.streams.rent.state === 'clear') {
            return <span className="text-2xs font-bold text-emerald-600/70 dark:text-emerald-400/70">clear</span>;
        }
        return <span className="text-xs text-slate-300 dark:text-zinc-600">—</span>;
    };

    return (
        <div
            data-unit-id={unit.id}
            data-unit-convex-id={(unit as any)._id}
            id={`unit-row-${String(unit.id).replace(/[^a-zA-Z0-9-]/g, '_')}`}
            role="row"
            aria-selected={expanded}
            tabIndex={isCursor ? 0 : -1}
            onClick={onToggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
            className={`group grid grid-cols-[1.25rem,minmax(0,1.35fr),auto,minmax(0,1fr),minmax(0,1fr),minmax(0,0.9fr),2rem] sm:grid-cols-[1.25rem,minmax(0,1.2fr),auto,minmax(0,1fr),minmax(0,1.1fr),minmax(0,1fr),2.25rem] items-center gap-x-2 sm:gap-x-3 px-2 sm:px-3 py-2 cursor-pointer border-b border-slate-100 dark:border-zinc-800 transition-colors ${
                expanded
                    ? 'bg-primary-50/70 dark:bg-primary-900/15'
                    : isCursor
                        ? 'bg-slate-50 dark:bg-zinc-800/60 ring-1 ring-inset ring-primary-400/50'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
            } ${highlighted ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}
        >
            {/* Health */}
            <div role="gridcell" className="flex justify-center">
                <UnitHealthBadge health={health} withLabel={false} />
            </div>

            {/* Unit */}
            <div role="gridcell" className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">{d.name}</p>
                <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate leading-tight">
                    {[d.floor ? `Floor ${d.floor}` : '', (unit as any).propertyType || (unit as any).unitType || '', ticketsOpen.length > 0 ? `${ticketsOpen.length} ticket${ticketsOpen.length > 1 ? 's' : ''}` : '']
                        .filter(Boolean).join(' · ') || '\u00A0'}
                </p>
            </div>

            {/* Occupancy chip + quick dropdown (preserved interaction) */}
            <div role="gridcell" className="relative" onClick={(e) => e.stopPropagation()}>
                <div ref={statusRef}>
                    <Button
                        size="sm"
                        variant="bare"
                        onClick={() => setStatusOpen(v => !v)}
                        title="Click to change status"
                        aria-haspopup="listbox"
                        aria-expanded={statusOpen}
                        className={`px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wide border ${STATUS_CLASS[uStatus] || STATUS_CLASS['Vacant']}`}
                    >
                        <span className="hidden sm:inline">{uStatus}</span>
                        <span className="sm:hidden">{uStatus.slice(0, 3)}</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                    </Button>
                    {statusOpen && (
                        <div className="absolute left-0 top-full mt-1 z-40 w-36 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg py-1" role="listbox">
                            {STATUSES.map(s => (
                                <Button
                                    key={s}
                                    size="sm"
                                    variant="bare"
                                    onClick={() => { actions.onSetStatus(unit, s, d); setStatusOpen(false); }}
                                    className={`w-full justify-start px-3 py-1.5 text-xs rounded-none ${uStatus === s ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-600 dark:text-zinc-300'}`}
                                    role="option"
                                    aria-selected={uStatus === s}
                                >
                                    {s}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Resident */}
            <div role="gridcell" className="min-w-0 hidden sm:block">
                {d.tenantName ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xs font-black text-slate-500 dark:text-zinc-300">{d.tenantName.charAt(0).toUpperCase()}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100 truncate">{d.tenantName}</span>
                    </div>
                ) : (
                    <span className="text-xs text-slate-300 dark:text-zinc-600">—</span>
                )}
            </div>

            {/* Lease */}
            <div role="gridcell" className="min-w-0 hidden sm:block">
                {leaseCell()}
            </div>

            {/* Arrears tokens */}
            <div role="gridcell" className="min-w-0">
                {arrearsCell()}
            </div>

            {/* ⋯ menu */}
            <div role="gridcell" className="flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                <div ref={menuRef}>
                    <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        icon={MoreHorizontal}
                        onClick={() => setMenuOpen(v => !v)}
                        aria-label={`Actions for ${d.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 h-7 w-7 text-slate-400"
                    />
                    {menuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg py-1" role="menu">
                            {occupied && actions.rentCollecting && (
                                <MenuItem icon={Receipt} label="Receipt" onClick={() => { setMenuOpen(false); actions.onCollectRent(unit, d); }} />
                            )}
                            {occupied && actions.rentCollecting && (
                                <MenuItem icon={Megaphone} label="Demand Notice" onClick={() => { setMenuOpen(false); actions.onDraftAction('Rent Demand Notice', 'Demand', unit); }} />
                            )}
                            <MenuItem icon={MessageSquare} label="Message" onClick={() => { setMenuOpen(false); actions.onCompose(unit, d); }} />
                            <MenuItem icon={EditIcon} label="Edit" onClick={() => { setMenuOpen(false); actions.onEditUnit(unit); }} />
                            {(uStatus === 'Vacant' || uStatus === 'Listed') && (
                                <MenuItem icon={Share2} label="Share link" onClick={() => { setMenuOpen(false); actions.onShareLink(unit, d); }} />
                            )}
                            <MenuItem icon={Wrench} label="Maintenance" onClick={() => { setMenuOpen(false); actions.onSetStatus(unit, 'Maintenance', d); }} />
                            <MenuItem icon={Scale} label="Legal file" onClick={() => { setMenuOpen(false); actions.onInitializeMatter(unit); }} />
                            <div className="my-1 border-t border-slate-100 dark:border-zinc-700" />
                            <MenuItem icon={Trash2} label="Remove" danger onClick={() => { setMenuOpen(false); actions.onRemoveUnit(unit, d); }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MenuItem: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }> = ({ icon: Icon, label, onClick, danger }) => (
    <Button
        size="sm"
        variant="bare"
        onClick={onClick}
        role="menuitem"
        className={`w-full justify-start px-3 py-1.5 text-xs rounded-none gap-2 ${
            danger ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20' : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
        }`}
    >
        <Icon className="w-3.5 h-3.5" />
        {label}
    </Button>
);

export default UnitRow;
