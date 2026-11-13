/**
 * UnitsCardsView — the calm spatial alternative (§3.6).
 * Cards remain for managers who prefer spatial scanning (typically small
 * portfolios), dieted to FIVE signals: name + subline, occupancy chip,
 * health dot + label, resident, ONE key line (the single most important
 * fact) and — when Action — one primary button (the fix). Clicking a card
 * opens the same detail content in a right drawer. No washes, no badge
 * stacks, no inline forms in the card.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Z_CLASS } from '../../../overlays/constants';
import { Button, Card } from '../../ui';
import UnitHealthBadge from './UnitHealthBadge';
import UnitDetailBand from './UnitDetailBand';
import { STATUS_CLASS } from './statusClasses';
import { ClipboardCheck } from './rowIcons';
import type { UnitEntry, UnitsActions } from './types';
import type { TenancyStatusEntry, TenancyPanelUnit } from '../TenancyLifecyclePanel';
import type { Property } from '../../../types';

interface UnitsCardsViewProps {
    entries: UnitEntry[];
    actions: UnitsActions;
    property: Property;
    tenancyUnits: TenancyPanelUnit[];
    tenancyStatus: Record<string, TenancyStatusEntry> | undefined;
    contacts: any[];
    firmId: string;
    expandedId: string | null;
    onOpen: (entry: UnitEntry) => void;
    onClose: () => void;
}

/** The single most important fact about a unit, one line. */
const keyLine = (entry: UnitEntry): { text: string; cls: string } => {
    const { health, display: d } = entry;
    const uStatus = String(entry.unit.status || 'Vacant');
    if (health.daysOverstayed > 0) return { text: `Lease ended +${health.daysOverstayed}d overstayed`, cls: 'text-rose-600 dark:text-rose-400' };
    const overdue = health.reasons.find(r => r.includes('overdue'));
    if (overdue) return { text: overdue, cls: 'text-rose-600 dark:text-rose-400' };
    if (uStatus === 'Vacant') return { text: 'Vacant — share the application link', cls: 'text-slate-400 dark:text-zinc-500' };
    if (uStatus === 'Maintenance') return { text: 'Under maintenance', cls: 'text-amber-600 dark:text-amber-400' };
    if (health.reasons.some(r => r.includes('without a tenancy ledger'))) return { text: 'Tenancy not recorded', cls: 'text-amber-600 dark:text-amber-400' };
    const due = health.reasons.find(r => r.includes('due this cycle'));
    if (due) return { text: due, cls: 'text-amber-600 dark:text-amber-400' };
    if (health.reasons.some(r => r.includes('Missing'))) return { text: 'Records incomplete', cls: 'text-amber-600 dark:text-amber-400' };
    return { text: 'Everything on track', cls: 'text-emerald-600/80 dark:text-emerald-400/80' };
};

/** The fix — one primary button for the most urgent need. */
const PrimaryFix: React.FC<{ entry: UnitEntry; actions: UnitsActions }> = ({ entry, actions }) => {
    const { health, display: d, unit } = entry;
    if (health.level !== 'action') return null;
    if (health.reasons.some(r => r.includes('without a tenancy ledger'))) {
        return <Button size="sm" variant="primary" icon={ClipboardCheck} fullWidth onClick={(e) => { e.stopPropagation(); actions.onEditUnit(unit); }}>Record tenancy</Button>;
    }
    if (health.reasons.some(r => r.toLowerCase().includes('overdue')) && d.tenantName && actions.rentCollecting) {
        return <Button size="sm" variant="primary" fullWidth onClick={(e) => { e.stopPropagation(); actions.onCollectRent(unit, d); }}>Collect rent</Button>;
    }
    if (health.reasons.some(r => r.includes('records incomplete'))) {
        return <Button size="sm" variant="primary" fullWidth onClick={(e) => { e.stopPropagation(); actions.onEditUnit(unit); }}>Complete records</Button>;
    }
    return null;
};

const UnitsCardsView: React.FC<UnitsCardsViewProps> = ({
    entries, actions, property, tenancyUnits, tenancyStatus, contacts, firmId, expandedId, onOpen, onClose,
}) => {
    const drawerEntry = entries.find(e => String(e.unit.id) === String(expandedId));
    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {entries.map(entry => {
                    const { unit, display: d, health } = entry;
                    const uStatus = String(unit.status || 'Vacant');
                    const line = keyLine(entry);
                    return (
                        <Card
                            key={unit.id}
                            padding="md"
                            className={`cursor-pointer transition-all hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 ${
                                health.level === 'action' ? 'border-rose-200 dark:border-rose-900/50' : ''
                            }`}
                            onClick={() => onOpen(entry)}
                        >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{d.name}</p>
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">
                                        {[d.floor ? `Floor ${d.floor}` : '', (unit as any).propertyType || ''].filter(Boolean).join(' · ') || 'Unit'}
                                    </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wide border flex-shrink-0 ${STATUS_CLASS[uStatus] || STATUS_CLASS['Vacant']}`}>
                                    {uStatus}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <UnitHealthBadge health={health} />
                                {d.tenantName && <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">{d.tenantName}</span>}
                            </div>
                            <p className={`text-xs font-semibold mb-2 ${line.cls}`}>{line.text}</p>
                            <PrimaryFix entry={entry} actions={actions} />
                        </Card>
                    );
                })}
            </div>

            {/* Right drawer — the detail band in a drawer shell (§3.6) */}
            {drawerEntry && createPortal(
                <div className={`fixed inset-0 ${Z_CLASS.drawer}`} role="dialog" aria-modal="true" aria-label={`${drawerEntry.display.name} details`}>
                    <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} />
                    <div className="absolute right-0 top-0 bottom-0 w-full sm:max-w-xl bg-slate-50 dark:bg-zinc-900 shadow-2xl overflow-y-auto animate-fade-in">
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 bg-white/95 dark:bg-zinc-800/95 backdrop-blur border-b border-slate-200 dark:border-zinc-700">
                            <div className="min-w-0">
                                <p className="text-3xs font-bold text-primary-500 uppercase tracking-widest">Unit Detail</p>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{drawerEntry.display.name}</h4>
                            </div>
                            <Button size="sm" variant="secondary" onClick={onClose} aria-label="Close drawer">Close</Button>
                        </div>
                        <div className="p-3">
                            <UnitDetailBand
                                entry={drawerEntry}
                                actions={actions}
                                property={property}
                                tenancyUnits={tenancyUnits}
                                tenancyStatus={tenancyStatus}
                                contacts={contacts}
                                firmId={firmId}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default UnitsCardsView;
