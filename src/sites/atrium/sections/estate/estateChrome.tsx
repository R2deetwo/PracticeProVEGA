/**
 * estateChrome — the shared, interactive replica of the Atrium workspace
 * that both estate-band frames run (R41).
 *
 * WHY A REPLICA: the owner asked for the estate band to become something
 * a visitor can "almost play around with it" — hover a property for a
 * hint, click it open, open a unit the way it opens in the app, pull the
 * menu, press More for the rest. The real app needs Convex + auth, so it
 * cannot be embedded; instead this module reproduces the workspace from
 * the app's OWN markup (the exact classNames of PropertyManagerView,
 * PropertyDetailView and SplitMasterDetail — same build, same Tailwind)
 * running on the app's own demo estate (estateDemoData). It is the real
 * interface, real data, guided — and it is labelled as an interactive
 * preview, never as a screenshot.
 *
 * Interaction contract (owner's "maximum depth"): property -> Units tab ->
 * unit card expands to its larger form (Tier 1 quick actions) -> More
 * reveals the full detail card + the full action set (Tier 2). Buttons
 * that would mutate data answer with an honest preview toast instead of
 * faking the mutation. This file is therefore interactive BY OWNER
 * DIRECTION (R41) — the ADR-0004 "presentational only" rule that governed
 * the R40 capture band is superseded here, and only here.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
    Home, Building2, ListTodo, FileText, MessageSquare, CalendarDays, Users,
    Wallet, BarChart3, Cog, Receipt, Megaphone, Pencil, Share2, Wrench, Scale,
    LogOut, Eye, Trash2, ClipboardList, Link2, Radio, AlertTriangle,
    Calendar as CalIcon, Search, Plus, ChevronDown,
} from 'lucide-react';
import {
    DemoProperty, DemoUnit, ESTATE_PROPERTIES, fmtDate, fmtNaira, daysUntil,
    termProgress, occupancy, unitCountText, rentRange,
} from './estateDemoData';

export type PropertyTab = 'summary' | 'units' | 'notices' | 'financials' | 'relationships' | 'tracking';

/** Unit-status badge colours — PropertyDetailView's own statusColors map. */
export const UNIT_STATUS_COLORS: Record<string, string> = {
    Occupied: 'bg-green-50 text-green-700 border-green-200',
    Vacant: 'bg-slate-50 text-slate-600 border-slate-200',
    Maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
};

/** Property-card status chip colours — PropertyManagerView's own mapping. */
const propStatusCls = (status: string): string =>
    status === 'Occupied'
        ? 'text-green-600 bg-green-50'
        : 'text-slate-400 bg-slate-50';

// ─── shared explorer state ──────────────────────────────────────────────────

/** The interaction state both frames run on (each frame keeps its own). */
export function useEstateExplorerState() {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tab, setTab] = useState<PropertyTab>('units');
    const [unitId, setUnitId] = useState<string | null>(null);
    const [more, setMore] = useState(false);
    const [touched, setTouched] = useState(false);
    const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (text: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ id: Date.now(), text });
        toastTimer.current = setTimeout(() => setToast(null), 3000);
    };
    useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

    const property = ESTATE_PROPERTIES.find(p => p.id === selectedId) || null;

    return {
        property, selectedId, tab, unitId, more, touched, toast,
        openProperty: (p: DemoProperty) => {
            setSelectedId(p.id);
            setTab(p.units.length > 1 ? 'units' : 'summary');
            setUnitId(null);
            setMore(false);
            setTouched(true);
        },
        closeProperty: () => { setSelectedId(null); setUnitId(null); setMore(false); },
        setTab, setTouched, showToast,
        clickUnit: (u: DemoUnit) => {
            setUnitId(prev => (prev === u.id ? null : u.id));
            setMore(false);
        },
        toggleMore: () => setMore(v => !v),
    };
}

export type EstateState = ReturnType<typeof useEstateExplorerState>;

/** The honest preview toast — every would-be mutation answers with this. */
export const EstateToast: React.FC<{ toast: { id: number; text: string } | null }> = ({ toast }) => (
    <div
        className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-50 transition-all duration-300"
        style={{ opacity: toast ? 1 : 0, transform: `translateX(-50%) translateY(${toast ? 0 : 8}px)` }}
        role="status"
        aria-live="polite"
    >
        {toast && (
            <div className="flex items-center gap-2 bg-slate-900 text-white text-2xs font-semibold px-3.5 py-2 rounded-lg shadow-lg max-w-[300px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="leading-snug">{toast.text}</span>
            </div>
        )}
    </div>
);

/** First-visit coach chip — the hover/tap hint until the visitor plays. */
export const CoachHint: React.FC<{ visible: boolean; label: string }> = ({ visible, label }) => (
    <div
        className="transition-all duration-500 overflow-hidden"
        style={{ maxHeight: visible ? 40 : 0, opacity: visible ? 1 : 0 }}
    >
        <div className="mx-3 mt-2 mb-0.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary-600 text-white self-start w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse flex-shrink-0" />
            <span className="text-3xs font-black uppercase tracking-widest whitespace-nowrap">{label}</span>
        </div>
    </div>
);

// ─── middle panel — the properties list ─────────────────────────────────────

/** One property card — PropertyListItem's markup + the R41 hover hint. */
export const PropertyListCard: React.FC<{
    property: DemoProperty;
    active: boolean;
    onOpen: () => void;
}> = ({ property, active, onOpen }) => {
    const isOccupied = property.status === 'Occupied';
    // The primary lease end on the card drives the urgency chip (the app
    // reads rentalDetails.leaseEnd; here it is the longest-running lease).
    const leaseEnds = property.units.map(u => u.leaseEnd).filter(Boolean) as Date[];
    const daysLeft = leaseEnds.length ? Math.min(...leaseEnds.map(d => daysUntil(d) ?? Infinity)) : null;
    const leaseUrgent = daysLeft !== null && daysLeft > 0 && daysLeft <= 90;
    const range = rentRange(property);

    return (
        <div
            onClick={onOpen}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
            aria-label={`Open ${property.address}`}
            className={`group relative p-3 mb-2 rounded-lg border-l-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:bg-slate-50 overflow-hidden ${
                active ? 'border-l-primary-600 bg-primary-50/60' : leaseUrgent ? 'border-l-amber-400 bg-white shadow-sm' : 'bg-white border-slate-200 shadow-sm'
            }`}
        >
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-primary-600 transition-colors leading-tight">
                                {property.address}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-slate-100 text-slate-600">
                                    {unitCountText(property)}
                                </span>
                                <span className="text-2xs text-slate-500 font-medium truncate max-w-[90px]">{property.owner}</span>
                                {range ? (
                                    <span className="text-2xs font-bold text-emerald-600 whitespace-nowrap">
                                        {range[0] !== range[1]
                                            ? <>{fmtNaira(range[0])} – {fmtNaira(range[1])}<span className="font-normal text-slate-400">/yr</span></>
                                            : <>{fmtNaira(range[0])}<span className="font-normal text-slate-400">/yr</span></>}
                                    </span>
                                ) : !isOccupied && property.category === 'Property For Sale' ? (
                                    <span className="text-2xs font-bold text-blue-600 whitespace-nowrap">For Sale</span>
                                ) : (
                                    <span className="text-2xs font-medium text-slate-400 italic">Vacant</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {leaseUrgent && (
                                <span className="text-3xs font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" />{daysLeft}d
                                </span>
                            )}
                            <span className={`text-3xs px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${propStatusCls(property.status)}`}>
                                {property.status}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            {/* The R41 hover hint — this card is clickable. */}
            <span className="absolute bottom-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-3xs font-black uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
                Open →
            </span>
        </div>
    );
};

/** The whole middle panel: heading, filters, list header, cards. */
export const PropertiesPanel: React.FC<{
    state: EstateState;
    hintLabel: string;
    compact?: boolean;
}> = ({ state, hintLabel, compact }) => (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 overflow-hidden">
        <div className="flex-shrink-0 py-3 px-3 border-b border-slate-100 bg-white z-10 space-y-2.5">
            <div className="flex items-center justify-between">
                <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-slate-900 tracking-tight`}>Properties</h2>
                <button
                    onClick={() => state.showToast('Preview — in the product, this opens the New Property form.')}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-1.5 text-2xs font-bold"
                >
                    <Plus className="w-3.5 h-3.5" /> New
                </button>
            </div>
            <div className="flex items-center gap-1.5 text-2xs text-slate-700 font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer">
                <span>All</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-auto" />
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <div className="w-full pl-8 pr-3 py-1.5 text-2xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                    Search properties...
                </div>
            </div>
        </div>
        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded border-2 border-slate-300" />
                <span className="text-3xs font-black text-slate-400 uppercase tracking-widest">Select all</span>
            </div>
            <span className="text-3xs font-black text-slate-400 uppercase tracking-widest">{ESTATE_PROPERTIES.length} Total Properties</span>
        </div>
        <CoachHint visible={!state.touched} label={hintLabel} />
        <div className="flex-grow overflow-y-auto custom-scrollbar p-2 pb-4">
            {ESTATE_PROPERTIES.map(p => (
                <PropertyListCard
                    key={p.id}
                    property={p}
                    active={state.selectedId === p.id}
                    onOpen={() => state.openProperty(p)}
                />
            ))}
        </div>
    </div>
);

// ─── detail pane — the property detail (tabs + content) ─────────────────────

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="min-w-0">
        <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-xs font-semibold text-slate-900 leading-snug break-words">{value}</div>
    </div>
);

/** A month pill on the billing strip. */
const MonthPill: React.FC<{ label: string; tone: 'paid' | 'due' | 'overdue' }> = ({ label, tone }) => (
    <span className={`text-3xs font-black uppercase px-1.5 py-0.5 rounded ${
        tone === 'paid' ? 'bg-emerald-100 text-emerald-700'
        : tone === 'due' ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'
    }`}>{label}</span>
);

const lastMonths = (n: number): string[] => {
    const out: string[] = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        out.push(m.toLocaleDateString('en-GB', { month: 'short' }));
    }
    return out;
};

/** The billing strip — RENT plus SC where the unit carries one. */
const BillingStrip: React.FC<{ unit: DemoUnit }> = ({ unit }) => {
    const months = lastMonths(4);
    const sc = unit.serviceCharge;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-3xs font-black text-slate-400 uppercase tracking-widest w-8">Rent</span>
                {months.map((m, i) => <MonthPill key={m + i} label={m} tone={i === months.length - 1 ? 'due' : 'paid'} />)}
            </div>
            {sc && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-3xs font-black text-slate-400 uppercase tracking-widest w-8">SC</span>
                    {months.map((m, i) => (
                        <MonthPill
                            key={m + i}
                            label={m}
                            tone={sc.status === 'UNPAID' ? 'overdue' : i === months.length - 1 && sc.status !== 'PAID_FULLY' ? 'due' : 'paid'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/** One unit card — compact, then the expanded larger form, then More. */
export const UnitCard: React.FC<{
    unit: DemoUnit;
    expanded: boolean;
    more: boolean;
    variant: 'desktop' | 'mobile';
    onClick: () => void;
    onToggleMore: () => void;
    showToast: (t: string) => void;
}> = ({ unit, expanded, more, variant, onClick, onToggleMore, showToast }) => {
    const tp = termProgress(unit);
    const isPastHalfway = tp !== null && tp >= 0.5;
    const border = unit.status === 'Occupied' ? '#22C55E' : '#94A3B8';
    const occupied = unit.status === 'Occupied';
    const preview = (what: string) => () => showToast(`Preview — in the product, ${what}`);
    const cardRef = useRef<HTMLDivElement>(null);

    // The pane (never the page) scrolls the open form into view — the
    // marketing frame must read as an app that anticipates the click,
    // not one that clips its own menu.
    const scrollPaneToCard = (pinTop: boolean) => {
        const el = cardRef.current;
        const pane = el?.closest('.overflow-y-auto') as HTMLElement | null;
        if (!el || !pane) return;
        const pr = pane.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        if (pinTop ? er.top < pr.top + 8 || er.top > pr.top + 40 : er.top < pr.top + 8 || er.bottom > pr.bottom) {
            pane.scrollBy({ top: er.top - pr.top - 10, behavior: 'smooth' });
        }
    };
    useEffect(() => { if (expanded) scrollPaneToCard(false); }, [expanded]);
    useEffect(() => { if (more) scrollPaneToCard(true); }, [more]);

    return (
        <div
            ref={cardRef}
            onClick={e => { e.stopPropagation(); onClick(); }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            aria-label={`${unit.name}${expanded ? ' — expanded' : ''}`}
            aria-expanded={expanded}
            style={{ borderLeftColor: expanded ? undefined : border, borderLeftWidth: 4 }}
            className={`bg-blue-50/40 rounded-lg border shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${
                expanded
                    ? `${variant === 'desktop' ? 'col-span-2' : ''} border-primary-400 ring-2 ring-primary-100 p-4`
                    : 'border-slate-200 hover:border-primary-300 p-3'
            }`}
        >
            {/* Card header */}
            <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1 pr-2">
                    <p className="font-bold text-slate-900 text-sm truncate">{unit.name}</p>
                    {unit.floor != null && <p className="text-2xs text-slate-400 mt-0.5">Floor {unit.floor}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wide border flex-shrink-0 ${UNIT_STATUS_COLORS[unit.status]}`}>
                    {unit.status}
                </span>
            </div>

            {/* Micro-profile: tenant + tenancy end */}
            <div className="space-y-1 text-xs min-w-0 overflow-hidden">
                {unit.tenantName && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xs font-black text-slate-500">{unit.tenantName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-slate-800 text-xs font-semibold truncate min-w-0">{unit.tenantName}</p>
                            {unit.leaseEnd && (
                                <p className="text-2xs text-slate-500 mt-0.5">
                                    <span className="font-bold text-slate-400 uppercase tracking-wider mr-1">Tenancy Ends:</span>
                                    {fmtDate(unit.leaseEnd)}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Billing chips — the live-timeline grammar */}
                {occupied && (
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-3xs font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Rent Due</span>
                        {unit.serviceCharge?.status === 'PARTIALLY_PAID' && (
                            <span className="text-3xs font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">SC Partial · {fmtNaira(unit.serviceCharge.outstanding)} left</span>
                        )}
                        {unit.serviceCharge?.status === 'UNPAID' && (
                            <span className="text-3xs font-black uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">SC Overdue</span>
                        )}
                    </div>
                )}
                {isPastHalfway && !expanded && (
                    <div className="flex items-center gap-1" title="Statutory notice window is active">
                        <CalIcon className="w-3 h-3 text-orange-500" />
                        <span className="text-3xs font-black text-orange-600 uppercase">{Math.round(tp * 100)}% Elapsed</span>
                    </div>
                )}
            </div>

            {/* Footer badge */}
            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100/80 pt-2 min-w-0 gap-1">
                {occupied ? (
                    <span className="text-3xs font-black px-2 py-0.5 rounded-full uppercase tracking-wide text-green-700 bg-green-50">
                        Info Complete
                    </span>
                ) : <span />}
                {!expanded && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-3xs font-black uppercase tracking-widest text-primary-700">
                        Open ▾
                    </span>
                )}
            </div>

            {/* ── Tier 1: quick actions (always when expanded) ── */}
            {expanded && (
                <div className="mt-3 pt-3 border-t border-primary-200/60 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {occupied && (
                            <button
                                onClick={preview('this records the payment and issues the resident\u2019s receipt.')}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-2xs font-bold rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                            >
                                <Receipt className="w-3 h-3" /> Receipt
                            </button>
                        )}
                        {occupied && (
                            <button
                                onClick={preview('this drafts the Rent Demand Notice on the firm\u2019s letterhead.')}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-2xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-amber-200"
                            >
                                <Megaphone className="w-3 h-3" /> Demand
                            </button>
                        )}
                        <button
                            onClick={preview('this opens the unified composer with this resident pre-selected.')}
                            className="px-2.5 py-1.5 bg-white text-slate-600 hover:bg-slate-100 text-2xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-slate-200"
                        >
                            <MessageSquare className="w-3 h-3" /> Message
                        </button>
                        <button
                            onClick={preview('this opens the unit\u2019s edit form — lease, rent, fees, everything.')}
                            className="px-2.5 py-1.5 bg-white text-slate-600 hover:bg-slate-100 text-2xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-slate-200"
                        >
                            <Pencil className="w-3 h-3" /> Edit
                        </button>
                        {!occupied && (
                            <button
                                onClick={preview('this copies the public application link for prospective tenants.')}
                                className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-2xs font-bold rounded-lg flex items-center gap-1 transition-colors border border-indigo-200"
                            >
                                <Share2 className="w-3 h-3" /> Share
                            </button>
                        )}
                        <button
                            onClick={onToggleMore}
                            aria-label="Full unit details and more actions"
                            className={`ml-auto px-3 py-1.5 text-2xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                                more ? 'bg-primary-600 text-white shadow-sm' : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
                            }`}
                        >
                            {more ? 'Less' : 'More'}
                        </button>
                    </div>

                    {/* ── Tier 2: full detail card (on "More") ── */}
                    {more && (
                        <div className="mt-3 pt-3 border-t border-slate-200 animate-fade-in">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-3xs font-bold text-primary-500 uppercase tracking-widest mb-0.5">Unit Detail</p>
                                    <h4 className="text-sm font-bold text-slate-900">{unit.name}</h4>
                                    {unit.floor != null && <p className="text-2xs text-slate-400">Floor {unit.floor}</p>}
                                </div>
                                <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wide ${UNIT_STATUS_COLORS[unit.status]}`}>
                                    {unit.status} ▾
                                </span>
                            </div>

                            <div className={`grid ${variant === 'desktop' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-x-4 gap-y-2.5 mb-3`}>
                                {unit.tenantName && <DetailItem label="Resident" value={unit.tenantName} />}
                                <DetailItem label="Rent" value={<>{fmtNaira(unit.rentAmount)} <span className="text-2xs text-slate-400 font-normal">/{unit.rentFrequency === 'Monthly' ? 'mo' : 'yr'}</span></>} />
                                {unit.leaseEnd && <DetailItem label="Lease End" value={fmtDate(unit.leaseEnd)} />}
                                {unit.tenantPhone && <DetailItem label="Phone" value={unit.tenantPhone} />}
                                {unit.serviceCharge && (
                                    <DetailItem
                                        label="Service Charge"
                                        value={
                                            <span className="flex items-center gap-1">
                                                {fmtNaira(unit.serviceCharge.amount)}/{unit.serviceCharge.category}
                                                <span className={`text-3xs font-black px-1 py-0.5 rounded-full ${
                                                    unit.serviceCharge.status === 'PAID_FULLY' ? 'bg-emerald-100 text-emerald-700'
                                                    : unit.serviceCharge.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {unit.serviceCharge.status === 'PAID_FULLY' ? 'Clear' : unit.serviceCharge.status === 'PARTIALLY_PAID' ? 'Partial' : 'Outstanding'}
                                                </span>
                                            </span>
                                        }
                                    />
                                )}
                                {tp !== null && (
                                    <DetailItem
                                        label="Term Progress"
                                        value={
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-[80px]">
                                                    <div className={`h-full rounded-full ${isPastHalfway ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.round(tp * 100)}%` }} />
                                                </div>
                                                <span className="text-3xs font-bold text-slate-600">{Math.round(tp * 100)}%</span>
                                            </div>
                                        }
                                    />
                                )}
                            </div>

                            {/* Billing & payment history */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-3xs font-black text-slate-400 uppercase tracking-widest">Billing &amp; Payment History</p>
                                    <p className="text-3xs text-slate-400 italic">auto-tracked from lease dates &amp; recorded payments</p>
                                </div>
                                <div className="flex items-center gap-3 mb-1.5">
                                    <span className="flex items-center gap-1 text-3xs font-bold text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid</span>
                                    <span className="flex items-center gap-1 text-3xs font-bold text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Due</span>
                                    <span className="flex items-center gap-1 text-3xs font-bold text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Overdue</span>
                                    <span className="flex items-center gap-1 text-3xs font-bold text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Advance</span>
                                </div>
                                <BillingStrip unit={unit} />
                            </div>

                            {/* The full action set */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    onClick={preview('this starts the quit-notice workflow with the statutory notice periods.')}
                                    className="px-2.5 py-1.5 text-2xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-rose-600 flex items-center gap-1"
                                    title="Eviction workflow available via Quit Notice"
                                >
                                    <LogOut className="w-3 h-3" /> Quit Notice
                                </button>
                                <button
                                    onClick={preview('this initializes the legal/management file for this tenancy.')}
                                    className="px-2.5 py-1.5 text-2xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-indigo-700 flex items-center gap-1"
                                >
                                    <Scale className="w-3 h-3" /> Legal File
                                </button>
                                <button
                                    onClick={preview('this logs a maintenance ticket for this unit.')}
                                    className="px-2.5 py-1.5 text-2xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-amber-700 flex items-center gap-1"
                                >
                                    <Wrench className="w-3 h-3" /> Maintenance
                                </button>
                                {occupied ? (
                                    <button
                                        onClick={preview('this marks the unit vacant when the tenancy ends.')}
                                        className="px-2.5 py-1.5 text-2xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center gap-1"
                                    >
                                        <Eye className="w-3 h-3" /> Vacant
                                    </button>
                                ) : (
                                    <button
                                        onClick={preview('this marks the unit occupied once a lease starts.')}
                                        className="px-2.5 py-1.5 text-2xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-green-700 flex items-center gap-1"
                                    >
                                        <Eye className="w-3 h-3" /> Occupied
                                    </button>
                                )}
                                <button
                                    onClick={preview('this archives the unit — history preserved.')}
                                    className="px-2.5 py-1.5 text-2xs font-medium rounded-md border border-rose-300 bg-white hover:bg-rose-50 text-rose-600 flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" /> Remove
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/** The property detail — header, tabs, and the six tab contents. */
export const PropertyDetail: React.FC<{
    property: DemoProperty;
    state: EstateState;
    variant: 'desktop' | 'mobile';
    onBack?: () => void;
}> = ({ property, state, variant, onBack }) => {
    const occ = occupancy(property);
    const tabs: { id: PropertyTab; label: string; icon: React.ReactNode }[] = [
        { id: 'summary', label: 'Summary', icon: <ClipboardList className="w-3.5 h-3.5 inline mr-1" /> },
        ...(property.units.length > 0 ? [{ id: 'units' as PropertyTab, label: 'Units', icon: <Home className="w-3.5 h-3.5 inline mr-1" /> }] : []),
        { id: 'notices', label: 'Notice Board', icon: <Megaphone className="w-3.5 h-3.5 inline mr-1" /> },
        { id: 'financials', label: 'Finance', icon: <Wallet className="w-3.5 h-3.5 inline mr-1" /> },
        { id: 'relationships', label: 'Relationships', icon: <Link2 className="w-3.5 h-3.5 inline mr-1" /> },
        { id: 'tracking', label: 'Activity & Tracking', icon: <Radio className="w-3.5 h-3.5 inline mr-1" /> },
    ];

    return (
        <div className="flex flex-col bg-slate-50 h-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white z-20 shadow-sm">
                <div className="px-3 py-2.5 flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {onBack && (
                            <button
                                onClick={onBack}
                                aria-label="Back to properties"
                                className="text-slate-500 hover:text-slate-800 transition-colors text-2xs font-bold uppercase flex items-center gap-1 flex-shrink-0"
                            >
                                ←
                            </button>
                        )}
                        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`p-1.5 rounded-lg flex-shrink-0 ${property.status === 'Vacant' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-none">{property.address}</h2>
                                <p className="text-2xs text-slate-500 mt-0.5 truncate">
                                    {property.propertyType} • {property.owner}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => state.showToast('Preview — in the product, this opens the full property form.')}
                        className="px-2 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-slate-600 text-2xs font-bold flex items-center gap-1 flex-shrink-0"
                    >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                <nav className="px-2 -mb-px flex space-x-3 overflow-x-auto no-scrollbar whitespace-nowrap">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => state.setTab(t.id)}
                            className={`whitespace-nowrap py-2.5 px-1 border-b-2 font-semibold text-2xs transition-colors flex-shrink-0 ${
                                state.tab === t.id
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t.icon}{t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar overscroll-contain">
                <div className={`${variant === 'mobile' ? 'p-3 pb-16' : 'p-3 pb-8'} min-w-0`}>

                    {state.tab === 'summary' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                                    <h3 className="text-xs font-bold text-slate-800">Property Information</h3>
                                    <span className={`text-3xs px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${propStatusCls(property.status)}`}>
                                        {property.status}
                                    </span>
                                </div>
                                <div className={`grid ${variant === 'desktop' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} gap-x-4 gap-y-3`}>
                                    <DetailItem label="Address" value={property.address} />
                                    <DetailItem label="Owner" value={property.owner} />
                                    <DetailItem label="Type" value={property.propertyType} />
                                    <DetailItem label="Units" value={unitCountText(property)} />
                                    <DetailItem label="Portfolio Value" value={fmtNaira(property.value)} />
                                    {property.saleTarget && <DetailItem label="Target Price" value={fmtNaira(property.saleTarget)} />}
                                </div>
                                {property.units.length > 1 && (
                                    <button
                                        onClick={() => state.setTab('units')}
                                        className="mt-4 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 rounded-lg text-2xs font-bold transition-colors"
                                    >
                                        View all {property.units.length} units →
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {state.tab === 'units' && property.units.length > 0 && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Occupancy pills — the app's own at-a-glance row */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="bg-green-50 rounded-lg px-3 py-1.5 border border-green-100 flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-base font-black text-green-700">{occ.occupied}</span>
                                    <span className="text-2xs font-bold text-green-600 uppercase tracking-wider">Occupied</span>
                                </div>
                                <div className="bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200 flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-base font-black text-slate-700">{occ.vacant}</span>
                                    <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">Vacant</span>
                                </div>
                                <div className="bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-100 flex items-center gap-1.5 flex-shrink-0">
                                    <span className="text-base font-black text-amber-700">{occ.maintenance}</span>
                                    <span className="text-2xs font-bold text-amber-600 uppercase tracking-wider">Maintenance</span>
                                </div>
                            </div>

                            {/* Unit grid */}
                            <div className={`grid ${variant === 'desktop' ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}>
                                {property.units.map(u => (
                                    <UnitCard
                                        key={u.id}
                                        unit={u}
                                        variant={variant}
                                        expanded={state.unitId === u.id}
                                        more={state.unitId === u.id && state.more}
                                        onClick={() => state.clickUnit(u)}
                                        onToggleMore={state.toggleMore}
                                        showToast={state.showToast}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {state.tab === 'notices' && (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                <Megaphone className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-xs font-bold text-slate-500">No notices served</p>
                            <p className="text-2xs text-slate-400 mt-1 max-w-[240px]">
                                Quit notices, rent demands and 7-day notices appear here the moment they are drafted.
                            </p>
                        </div>
                    )}

                    {state.tab === 'financials' && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-800">Payments</h3>
                                </div>
                                {property.payments.length === 0 ? (
                                    <p className="px-4 py-6 text-2xs text-slate-400 text-center">No payment history for this property yet.</p>
                                ) : property.payments.map(p => (
                                    <div key={p.id} className="px-4 py-2.5 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-2xs font-semibold text-slate-800 truncate">{p.description}</p>
                                            <p className="text-3xs text-slate-400">{fmtDate(p.date)}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-2xs font-bold text-slate-800">{fmtNaira(p.amount)}</p>
                                            <span className={`text-3xs font-black uppercase ${
                                                p.status === 'paid' ? 'text-emerald-600' : p.status === 'pending' ? 'text-amber-600' : 'text-red-600'
                                            }`}>{p.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {state.tab === 'relationships' && (
                        <div className="space-y-2.5 animate-fade-in">
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                                    {property.owner.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{property.owner}</p>
                                    <p className="text-2xs text-slate-400">Owner</p>
                                </div>
                            </div>
                            {property.units.filter(u => u.tenantName).map(u => (
                                <div key={u.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black flex-shrink-0">
                                        {u.tenantName!.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">{u.tenantName}</p>
                                        <p className="text-2xs text-slate-400">Resident · {u.name}</p>
                                    </div>
                                    <span className={`text-3xs px-1.5 py-0.5 rounded-md font-bold uppercase border ${UNIT_STATUS_COLORS[u.status]}`}>{u.status}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {state.tab === 'tracking' && (
                        <div className="space-y-2.5 animate-fade-in">
                            {property.timeline.map(e => (
                                <div key={e.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex items-start gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        e.type === 'inspection' ? 'bg-blue-50 text-blue-600'
                                        : e.type === 'maintenance' ? 'bg-amber-50 text-amber-600'
                                        : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                        {e.type === 'inspection' ? <Eye className="w-3.5 h-3.5" /> : e.type === 'maintenance' ? <Wrench className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-2xs font-semibold text-slate-800 leading-snug">{e.description}</p>
                                        <p className="text-3xs text-slate-400 mt-0.5">{fmtDate(e.date)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/** The empty detail pane — SplitMasterDetail's own placeholder. */
export const DetailEmptyState: React.FC<{ showToast: (t: string) => void }> = ({ showToast }) => (
    <div className="h-full flex flex-col items-center justify-center text-slate-300 animate-fade-in p-6 text-center relative">
        <div className="mb-5 opacity-50 text-slate-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">Select an item to view details</p>
        {/* The ALOA FAB — present in the real workspace, honest here */}
        <button
            onClick={() => showToast('That\u2019s the assistant — see it at work in the band above.')}
            aria-label="The assistant"
            className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 transition-colors"
        >
            <span className="text-sm">✦</span>
        </button>
    </div>
);

/** The workspace nav the frames share (labels from the app's sidebar). */
export const WORKSPACE_NAV: { label: string; icon: React.ReactNode }[] = [
    { label: 'Home', icon: <Home className="w-3.5 h-3.5" /> },
    { label: 'Properties', icon: <Building2 className="w-3.5 h-3.5" /> },
    { label: 'Tasks', icon: <ListTodo className="w-3.5 h-3.5" /> },
    { label: 'Documents', icon: <FileText className="w-3.5 h-3.5" /> },
    { label: 'Messages', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { label: 'Calendar', icon: <CalendarDays className="w-3.5 h-3.5" /> },
    { label: 'Contacts', icon: <Users className="w-3.5 h-3.5" /> },
];

export const WORKSPACE_NAV_OPS: { label: string; icon: React.ReactNode }[] = [
    { label: 'Financials', icon: <Wallet className="w-3.5 h-3.5" /> },
    { label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { label: 'Settings', icon: <Cog className="w-3.5 h-3.5" /> },
];
