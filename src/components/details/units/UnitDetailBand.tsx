/**
 * UnitDetailBand — the Layer-2 expansion (§3.3 "detail band").
 * A calm inset panel BELOW the row (no grid reflow). Everything the old
 * expanded card carried survives here, re-homed and de-duplicated:
 *
 *   • Tenancy block   — the old 9-item detail grid, re-laid-out
 *   • Statutory line  — the 7 eviction badge variants → one calm sentence
 *   • Tenancy ledger  — the existing UnitTenancySection, mounted as-is
 *                       (allocate / record / renew / transfer / end /
 *                       document / history — same mutations, same guards)
 *   • Billing strips  — the existing ServiceChargeBars in expanded mode
 *   • Actions         — the old tier-1 + secondary rows, grouped and muted
 */
import React from 'react';
import { Button } from '../../ui';
import { ServiceChargeBars } from '../ServiceChargeBars';
import { UnitTenancySection } from '../TenancyLifecyclePanel';
import { resolveServiceCharge, serviceChargeDebugTitle } from '../../../utils/serviceCharge';
import { serviceChargeTimeline } from '../../../utils/leaseTimeline';
import NairaSymbol from '../../NairaSymbol';
import { formatNaira } from '../../../utils/formatting';
import { evictionSummaryLine } from './evictionTracker';
import { Receipt, Megaphone, MessageSquare, Share2, LogOut, CheckCircle, Scale, Wrench, Trash2 } from 'lucide-react';
import { EditIcon } from './rowIcons';
import type { UnitEntry, UnitsActions, UnitDisplay } from './types';
import type { TenancyStatusEntry, TenancyPanelUnit } from '../TenancyLifecyclePanel';
import type { Property, Contact } from '../../../types';

const DetailItem: React.FC<{ label: string; value: React.ReactNode; subText?: string }> = ({ label, value, subText }) => (
    <div className="min-w-0 break-words">
        <p className="text-3xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">{value}</div>
        {subText && <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight break-words">{subText}</p>}
    </div>
);

interface UnitDetailBandProps {
    entry: UnitEntry;
    actions: UnitsActions;
    property: Property;
    tenancyUnits: TenancyPanelUnit[];
    tenancyStatus: Record<string, TenancyStatusEntry> | undefined;
    contacts: Contact[] | any[];
    firmId: string;
}

const UnitDetailBand: React.FC<UnitDetailBandProps> = ({ entry, actions, property, tenancyUnits, tenancyStatus, contacts, firmId }) => {
    const { unit, display: d, health } = entry;
    const rental = (unit.rentalDetails || {}) as any;
    const uStatus = String(unit.status || 'Vacant');
    const occupied = uStatus === 'Occupied';
    const tenantPhone: string = rental.tenantPhone || (unit as any).tenantPhone || '';
    const tenantEmail: string = rental.tenantEmail || (unit as any).tenantEmail || '';

    // The unit's tenancy-ledger entry (same id shape as the shared feed).
    const tUnit: TenancyPanelUnit = tenancyUnits.find(t => t.id === String(unit.id)) || {
        id: String(unit.id),
        label: d.name || 'Unit',
        unitName: String((unit as any).unitName || (unit as any).name || ''),
        status: uStatus,
        tenantName: d.tenantName || rental.tenantName,
        tenantPhone,
        tenantEmail,
        rentAmount: Number(rental.rentAmount ?? d.rentAmount ?? 0) || 0,
        rentFrequency: rental.rentFrequency,
        leaseStart: rental.leaseStart || d.leaseStart,
        leaseEnd: rental.leaseEnd || d.leaseEnd,
    };

    // LIVE billing state (same engine as the old expanded card).
    const scTimeline = serviceChargeTimeline({ unit, rental: unit.rentalDetails, defaultProperty: property });
    const scLive = scTimeline.summary.state;
    const scOutstandingLive = Math.round(scTimeline.summary.outstandingTotal);
    const scRes = resolveServiceCharge({ unit, rental: unit.rentalDetails, defaultProperty: property });
    const outstanding = scLive !== 'none' && scLive !== 'clear'
        ? scOutstandingLive
        : Number(d.outstandingServiceChargeBalance || rental.outstandingServiceChargeBalance || 0);

    const evictionLine = evictionSummaryLine(health.eviction);
    const quitServed = health.eviction.quitNoticeStatus === 'served';
    const sevenDayDue = health.eviction.sevenDayNoticeStatus === 'due' && health.eviction.sevenDayNoticeDueDate != null && Date.now() >= health.eviction.sevenDayNoticeDueDate;

    const scBadge = () => {
        if (d.remindersPaused) return <span className="ml-1 text-3xs font-black px-1 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Reminders Paused</span>;
        if (scLive === 'clear') return <span className="ml-1 text-3xs font-black px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Clear</span>;
        if (scLive === 'due') return <span className="ml-1 text-3xs font-black px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Due</span>;
        if (scLive === 'overdue') return <span className="ml-1 text-3xs font-black px-1 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{scTimeline.summary.overdueCount > 1 ? `${scTimeline.summary.overdueCount} cycles` : 'Outstanding'}</span>;
        const scSt = d.serviceChargeStatus || rental.serviceChargeStatus || (unit as any).serviceChargeStatus;
        if (scSt === 'PAID_FULLY' || scSt === 'PAID') return <span className="ml-1 text-3xs font-black px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Clear</span>;
        if (scSt === 'PARTIALLY_PAID') return <span className="ml-1 text-3xs font-black px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>;
        return null;
    };

    const ActionChip: React.FC<{
        icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void;
        tone?: 'default' | 'danger' | 'success' | 'amber'; muted?: boolean; title?: string;
    }> = ({ icon: Icon, label, onClick, tone = 'default', muted, title }) => (
        <Button
            size="sm"
            variant="bare"
            icon={Icon}
            onClick={onClick}
            title={title || label}
            className={`h-8 px-3 text-xs font-semibold rounded-md border ${
                muted
                    ? 'opacity-60 border-slate-300 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:opacity-100'
                    : tone === 'danger'
                        ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        : tone === 'success'
                            ? 'border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            : tone === 'amber'
                                ? 'border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
        >
            {label}
        </Button>
    );

    return (
        <div className="mx-1 sm:mx-2 mb-2 rounded-2xl border border-primary-200/70 dark:border-primary-800/40 bg-white dark:bg-zinc-800/80 shadow-sm animate-fade-in" role="region" aria-label={`${d.name} details`}>
            <div className="p-3 sm:p-4 space-y-4">
                {/* ── Statutory line — one calm sentence instead of 7 badges ── */}
                {evictionLine && (
                    <p className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-semibold bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-lg px-3 py-2">
                        <Scale className="w-3.5 h-3.5 flex-shrink-0" />
                        {evictionLine}
                    </p>
                )}

                {/* ── Tenancy block — the old 9-item detail grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                    {d.tenantName && <DetailItem label="Resident" value={d.tenantName} />}
                    {actions.rentCollecting && d.rentAmount > 0 && (
                        <DetailItem label="Rent" value={<><NairaSymbol />{formatNaira(d.rentAmount)} <span className="text-2xs text-slate-400 font-normal">/{d.rentFrequency === 'Monthly' ? 'mo' : 'yr'}</span></>} />
                    )}
                    {d.leaseEnd && <DetailItem label="Lease End" value={(() => { try { return new Date(d.leaseEnd).toLocaleDateString('en-GB'); } catch { return d.leaseEnd; } })()} />}
                    {tenantPhone && <DetailItem label="Phone" value={tenantPhone} />}
                    {tenantEmail && <DetailItem label="Email" value={<span className="truncate block">{tenantEmail}</span>} />}
                    {scRes.amount > 0 && (
                        <DetailItem label="Service Charge" value={
                            <span data-sc-source={import.meta.env.DEV ? scRes.source : undefined} title={serviceChargeDebugTitle(scRes.source)}>
                                <NairaSymbol />{formatNaira(scRes.amount)}{scBadge()}
                            </span>
                        } />
                    )}
                    {outstanding > 0 && <DetailItem label="Outstanding" value={<span className="text-rose-600 dark:text-rose-400 font-bold"><NairaSymbol />{formatNaira(outstanding)}</span>} />}
                    {Number(rental.legalFee || (unit as any).legalFee || 0) > 0 && <DetailItem label="Legal Fee" value={<><NairaSymbol />{formatNaira(Number(rental.legalFee || (unit as any).legalFee || 0))}</>} />}
                    {Number(rental.agencyFee || (unit as any).agencyFee || 0) > 0 && <DetailItem label="Agency Fee" value={<><NairaSymbol />{formatNaira(Number(rental.agencyFee || (unit as any).agencyFee || 0))}</>} />}
                    {Number(rental.cautionDeposit || (unit as any).cautionDeposit || 0) > 0 && <DetailItem label="Caution Deposit" value={<><NairaSymbol />{formatNaira(Number(rental.cautionDeposit || (unit as any).cautionDeposit || 0))}</>} />}
                    {d.termProgress !== null && (
                        <DetailItem label="Term Progress" value={
                            <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden max-w-[80px]">
                                    <div className={`h-full rounded-full transition-all ${d.isPastHalfway ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.round(d.termProgress * 100)}%` }} />
                                </div>
                                <span className="text-3xs font-bold text-slate-600 dark:text-zinc-300">{Math.round(d.termProgress * 100)}%</span>
                            </div>
                        } />
                    )}
                </div>

                {/* ── Billing strips — existing ServiceChargeBars, expanded ── */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-700/60 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                        <p className="text-3xs font-black text-slate-400 uppercase tracking-widest">Billing &amp; Payment History</p>
                        <p className="text-3xs text-slate-400 dark:text-zinc-500">auto-tracked from lease dates &amp; recorded payments</p>
                    </div>
                    <ServiceChargeBars
                        unit={unit}
                        expanded={true}
                        includeRent={actions.rentCollecting}
                        onCollectRent={d.tenantName ? () => actions.onCollectRent(unit, d) : undefined}
                        onUpdate={(updatedRental) => { actions.onUpdateRental(unit, updatedRental); }}
                    />
                </div>

                {/* ── Tenancy ledger — existing UnitTenancySection, as-is ── */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-700/60">
                    <UnitTenancySection
                        variant="card"
                        unit={tUnit}
                        units={tenancyUnits}
                        statusMap={tenancyStatus}
                        firmId={firmId}
                        propertyAddress={property.address || ''}
                        propertyId={property.id}
                        contacts={contacts}
                    />
                </div>

                {/* ── Actions — grouped, muted, state-gated exactly as before ── */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-700/60 space-y-2">
                    {/* Money */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {occupied && actions.rentCollecting && (
                            <ActionChip icon={Receipt} label="Receipt" tone="success" onClick={() => actions.onCollectRent(unit, d)} title="Record Payment & Issue Receipt" />
                        )}
                        {occupied && actions.rentCollecting && (
                            <ActionChip icon={Megaphone} label="Demand" tone="amber" onClick={() => actions.onDraftAction('Rent Demand Notice', 'Demand', unit)} title="Rent Demand Notice" />
                        )}
                        <ActionChip icon={MessageSquare} label="Message" onClick={() => actions.onCompose(unit, d)} title="Message Resident" />
                        <ActionChip icon={EditIcon} label="Edit" onClick={() => actions.onEditUnit(unit)} title="Edit Unit" />
                        {(uStatus === 'Vacant' || uStatus === 'Listed') && (
                            <ActionChip icon={Share2} label="Share" onClick={() => actions.onShareLink(unit, d)} title="Copy public application link" />
                        )}
                    </div>
                    {/* Statutory — same gating as the old card */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <ActionChip
                            icon={LogOut}
                            label={quitServed ? 'Supersede' : 'Quit Notice'}
                            tone="danger"
                            muted={quitServed}
                            onClick={() => actions.onQuitNoticeDrafted(unit)}
                            title={quitServed ? 'Active notice exists — click to supersede with fresh notice' : 'Draft Notice to Quit'}
                        />
                        {actions.canUseEviction && health.eviction.quitNoticeStatus === 'drafted' && (
                            <ActionChip icon={CheckCircle} label="Mark Served" tone="amber" onClick={() => actions.onMarkQuitNoticeServed(unit)} title="Mark Quit Notice as Served — activates statutory countdown" />
                        )}
                        {actions.canUseEviction && (sevenDayDue || health.eviction.sevenDayNoticeStatus === 'due') && (
                            <ActionChip
                                icon={Scale}
                                label={sevenDayDue ? '7-Day Due!' : '7-Day'}
                                tone="danger"
                                onClick={() => actions.onDraftSevenDayNotice(unit)}
                                title={sevenDayDue ? "7-Day Notice is now due — draft it now" : "Draft 7-Day Notice of Owner's Intention to Recover Premises"}
                            />
                        )}
                        {actions.canUseEviction && health.eviction.sevenDayNoticeStatus === 'drafted' && (
                            <ActionChip icon={CheckCircle} label="7-Day Served" tone="amber" onClick={() => { actions.onUpdateEvictionTracker(unit, { sevenDayNoticeStatus: 'served' }); }} title="Mark 7-Day Notice as Served" />
                        )}
                        {actions.canUseEviction && health.eviction.sevenDayNoticeStatus === 'served' && (
                            <ActionChip icon={CheckCircle} label="7-Day Delivered" tone="success" onClick={() => { actions.onUpdateEvictionTracker(unit, { sevenDayNoticeStatus: 'delivered' }); }} title="Confirm delivery of 7-Day Notice" />
                        )}
                    </div>
                    {/* Operations */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <ActionChip icon={Scale} label="Legal File" onClick={() => actions.onInitializeMatter(unit)} title="Initialize Legal/Management File" />
                        <ActionChip icon={Wrench} label="Maintenance" tone="amber" onClick={() => actions.onSetStatus(unit, 'Maintenance', d)} title="Mark unit for maintenance" />
                        {uStatus !== 'Vacant' && (
                            <ActionChip icon={CheckCircle} label="Mark Vacant" onClick={() => actions.onSetStatus(unit, 'Vacant', d)} title="Mark as Vacant" />
                        )}
                        {uStatus === 'Vacant' && (
                            <ActionChip icon={CheckCircle} label="Mark Occupied" tone="success" onClick={() => actions.onSetStatus(unit, 'Occupied', d)} title="Mark as Occupied" />
                        )}
                        <ActionChip icon={Trash2} label="Remove" tone="danger" onClick={() => actions.onRemoveUnit(unit, d)} title="Archive this unit (history preserved)" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnitDetailBand;
