import React, { useState } from 'react';
import { Button, Select } from '../../../components/ui';

/**
 * AtriumEstate — the "Estate, at a glance" signature moment for /atrium.
 *
 * Owner direction (R38): "make this more interactive — when the user
 * clicks on the squares there, it should show on the mockup phone what
 * that resident's status is." Owner direction (R39): the band deepens —
 *
 *   · COLOUR SEMANTICS — blue is reserved for PREPAID (advance payment).
 *     Partial moves to violet so the two can never be confused:
 *       PAID / CLEAR   emerald
 *       DUE            amber
 *       PARTIAL        violet
 *       PREPAID        blue  (paid ahead — months in hand)
 *       OVERDUE        rose
 *       VACANT         clay, dashed
 *   · VACANT-UNIT EVENTS READ GRAY — turnover cleaning and renovation
 *     quotes are operations, not money trouble; they never borrow the
 *     amber/rose of the payment states.
 *   · A REAL PHONE — the modern-handset arrangement (time left, camera
 *     pill centred, camera-in-use dot beside it, home indicator), a
 *     scrollable portal body, and tappable tabs: Balance / Months /
 *     Notices. The Months tab shows the resident's year — which months
 *     were paid on time, which are due, how many are sitting PREPAID.
 *   · SMALLER, LIVE CARDS — the two giant stat figures become compact
 *     dropdown-driven chips, and the grid carries a filter row: tap a
 *     state, the other units recede. The band behaves like the monitor
 *     it is selling.
 *
 * The unit grid is LIVE: every unit is a real button; selecting one
 * renders that resident's portal on the phone. Default selection stays
 * the OVERDUE C4 — the defaulter dashboard is the story the band tells.
 * Interactive controls use the ui/Button and ui/Select primitives
 * (ADR-0004).
 */

type UnitStatus = 'paid' | 'due' | 'partial' | 'prepaid' | 'overdue' | 'vacant';

/** A month in the resident's ledger, with its own status colour. */
type MonthStatus = 'Paid' | 'Due' | 'Prepaid' | 'Partial' | 'Overdue';

interface MonthRow {
    month: string;
    status: MonthStatus;
}

interface UnitData {
    id: string;
    status: UnitStatus;
    resident: string;
    /** Portal balance line — the amount shown on the balance card. */
    balance: string;
    /** Balance card sub-line (what it is / when it's due). */
    balanceNote: string;
    /** The resident's monthly ledger — the Months tab of the portal. */
    months: MonthRow[];
    /** Summary line over the months ledger (e.g. prepaid months in hand). */
    monthsNote?: string;
    /** Optional maintenance ticket shown on the portal. */
    maintenance?: { title: string; note: string };
    /** Optional one-line note (notices, lease events). */
    note?: string;
}

const STATUS_ORDER: UnitStatus[] = ['paid', 'due', 'partial', 'prepaid', 'overdue', 'vacant'];

const STATUS_LABEL: Record<UnitStatus, string> = {
    paid: 'Paid',
    due: 'Due',
    partial: 'Partial',
    prepaid: 'Prepaid',
    overdue: 'Overdue',
    vacant: 'Vacant',
};

/** The 2026 calendar, Jan–Dec. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Build a month ledger from a compact status pattern (cycled if short). */
const months = (pattern: MonthStatus[]): MonthRow[] =>
    MONTHS.map((m, i) => ({ month: m, status: pattern[i % pattern.length] }));

/** A settled resident — the portal's quiet state. */
const paidUnit = (id: string, resident: string, maintenance?: UnitData['maintenance']): UnitData => ({
    id,
    status: 'paid',
    resident,
    balance: '₦0.00',
    balanceNote: 'All settled · nothing due',
    months: months(Array(12).fill('Paid')),
    monthsNote: 'Every month of 2026 paid on time.',
    maintenance,
});

/** Paid ahead — the year settled PLUS months of 2027 already in hand. */
const prepaidUnit = (id: string, resident: string): UnitData => ({
    id,
    status: 'prepaid',
    resident,
    balance: '₦0.00',
    balanceNote: '2026 settled · 3 months of 2027 in hand',
    months: [
        ...months(Array(12).fill('Paid')),
        { month: 'Jan 2027', status: 'Prepaid' },
        { month: 'Feb 2027', status: 'Prepaid' },
        { month: 'Mar 2027', status: 'Prepaid' },
    ],
    monthsNote: 'Prepaid through March 2027 — paid ahead by three months.',
});

const UNITS: UnitData[] = [
    paidUnit('A1', 'Adaeze Nwosu'),
    paidUnit('A2', 'Tunde Bakare'),
    prepaidUnit('A3', 'Folake Adeyemi'),
    paidUnit('A4', 'Chinedu Obi'),
    {
        id: 'A5',
        status: 'vacant',
        resident: 'Unit A5',
        balance: 'Vacant',
        balanceNote: 'Listing active · 3 enquiries this week',
        months: [],
        note: 'Turnover cleaning scheduled for 09 Nov 2026.',
    },
    paidUnit('A6', 'Ibrahim Yusuf'),
    paidUnit('B1', 'Grace Okonkwo'),
    {
        id: 'B2',
        status: 'overdue',
        resident: 'Emeka Nwachukwu',
        balance: '₦450,000.00',
        balanceNote: 'Service charge · 47 days overdue',
        months: months([...Array(6).fill('Paid'), ...Array(6).fill('Overdue')]),
        monthsNote: 'Rent current — service charge Q3 & Q4 outstanding.',
        note: 'Rent demand notice drafted — ready to serve.',
    },
    paidUnit('B3', 'Chioma Iheanacho'),
    {
        id: 'B4',
        status: 'due',
        resident: 'Segun Alabi',
        balance: '₦180,000.00',
        balanceNote: 'Service charge · due 30 Nov 2026',
        months: months([...Array(10).fill('Paid'), 'Due', 'Due']),
        monthsNote: 'Ten months on time — Q4 falls due 30 Nov.',
    },
    paidUnit('B5', 'Fatima Bello'),
    {
        id: 'B6',
        status: 'vacant',
        resident: 'Unit B6',
        balance: 'Vacant',
        balanceNote: 'Listing active · 1 enquiry this week',
        months: [],
        note: 'Renovation quote under review.',
    },
    paidUnit('C1', 'Olu Adeoye'),
    paidUnit('C2', 'Ngozi Umeh'),
    paidUnit('C3', 'Kemi Afolayan'),
    {
        id: 'C4',
        status: 'overdue',
        resident: 'Obinna Okeke',
        balance: '₦720,000.00',
        balanceNote: 'Rent + service charge · 62 days overdue',
        months: months([...Array(6).fill('Paid'), ...Array(6).fill('Overdue')]),
        monthsNote: 'Nothing received since June — six months in arrears.',
        note: "7-Day Notice of Owner's Intention available to draft.",
    },
    {
        id: 'C5',
        status: 'partial',
        resident: 'Halima Musa',
        balance: '₦270,000.00',
        balanceNote: '₦90,000 of ₦360,000 paid · balance due 30 Nov',
        months: months([...Array(10).fill('Paid'), 'Partial', 'Due']),
        monthsNote: '₦90,000 received toward Q4 — ₦270,000 to go.',
    },
    paidUnit('C6', 'Kelechi Nnamdi'),
    paidUnit('D1', 'Bisi Ogunleye'),
    paidUnit('D2', 'Yusuf Ibrahim'),
    {
        id: 'D3',
        status: 'due',
        resident: 'Chuka Eneh',
        balance: '₦60,000.00',
        balanceNote: 'Service charge · due 30 Nov 2026',
        months: months([...Array(10).fill('Paid'), 'Due', 'Due']),
        monthsNote: 'Ten months on time — Q4 falls due 30 Nov.',
    },
    paidUnit('D4', 'Amaka Obiora'),
    paidUnit('D5', 'Femi Ogunbiyi', { title: 'Kitchen sink drainage', note: 'Maintenance · in progress' }),
    paidUnit('D6', 'Ronke Adesanya'),
];

/** Ledger-row status chip colours — R39 semantics: emerald Paid, amber
 * Due, violet Partial, blue Prepaid (paid ahead), rose Overdue. */
const ROW_CHIP: Record<string, string> = {
    Paid: 'text-emerald-700',
    Due: 'text-amber-600',
    Partial: 'text-violet-600',
    Prepaid: 'text-blue-600',
    Overdue: 'text-rose-600',
};

/** The portal badge for the balance card header. */
const STATUS_CHIP: Record<UnitStatus, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    due: 'bg-amber-100 text-amber-700',
    partial: 'bg-violet-100 text-violet-700',
    prepaid: 'bg-blue-100 text-blue-700',
    overdue: 'bg-rose-100 text-rose-700',
    vacant: 'bg-slate-100 text-slate-500',
};

/** Balance-card accent (left edge). */
const STATUS_ACCENT: Record<UnitStatus, string> = {
    paid: 'border-l-emerald-500',
    due: 'border-l-amber-500',
    partial: 'border-l-violet-500',
    prepaid: 'border-l-blue-500',
    overdue: 'border-l-rose-500',
    vacant: 'border-l-slate-400',
};

const countByStatus = (s: UnitStatus) => UNITS.filter((u) => u.status === s).length;

/* ── The phone: a modern handset with a scrollable, tappable portal ── */

/** Status-bar glyphs — signal, wi-fi, battery — inline SVG, no emoji. */
const SignalGlyph: React.FC = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
        <rect x="0" y="8" width="2.6" height="4" rx="0.6" />
        <rect x="4.2" y="5.6" width="2.6" height="6.4" rx="0.6" />
        <rect x="8.4" y="3" width="2.6" height="9" rx="0.6" />
        <rect x="12.6" y="0.4" width="2.6" height="11.6" rx="0.6" opacity="0.35" />
    </svg>
);
const WifiGlyph: React.FC = () => (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M1.5 4.2C5.2 0.9 10.8 0.9 14.5 4.2" />
        <path d="M4 6.8C6.3 4.8 9.7 4.8 12 6.8" />
        <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </svg>
);
const BatteryGlyph: React.FC = () => (
    <span className="flex items-center gap-0.5" aria-hidden="true">
        <span className="block w-6 h-3 rounded-[3.5px] border border-slate-900/70 p-[2px]">
            <span className="block w-4/5 h-full bg-slate-900 rounded-[1px]" />
        </span>
        <span className="block w-[2px] h-1.5 rounded-r bg-slate-900/50" />
    </span>
);

/** One portal tab button. */
const PortalTab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <Button
        variant="bare"
        aria-pressed={active}
        onClick={onClick}
        className={`flex-1 rounded-lg py-1.5 text-2xs font-bold uppercase tracking-widest transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-atrium-emerald ${
            active ? 'bg-atrium-emerald text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
    >
        {children}
    </Button>
);

/** The residents' portal phone — a modern handset, scrollable and
 *  tappable, driven by the selected unit. Keyed by unit id upstream so
 *  tab state resets when the resident changes. */
const ResidentsPortalPhone: React.FC<{ unit: UnitData }> = ({ unit }) => {
    const [tab, setTab] = useState<'balance' | 'months' | 'notices'>('balance');
    const vacant = unit.status === 'vacant';
    return (
        <div className="at-phone w-[300px] mx-auto">
            <div className="at-phone__screen h-[600px]">
                {/* Status bar — the modern arrangement: time LEFT, camera
                    pill CENTRED, indicators RIGHT. The green dot beside
                    the pill is the camera-in-use indicator. */}
                <div className="flex items-center justify-between px-6 pt-3 pb-2 shrink-0">
                    <span className="font-mono text-xs font-semibold text-slate-900 w-10">9:41</span>
                    <span className="flex items-center gap-2">
                        <span className="at-phone__island" aria-hidden="true">
                            <span className="w-2 h-2 rounded-full bg-[#26313b] ring-1 ring-white/10" />
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" title="Camera in use" />
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-900 w-10 justify-end">
                        <SignalGlyph />
                        <WifiGlyph />
                        <BatteryGlyph />
                    </span>
                </div>

                {/* Greeting */}
                <div className="px-4 pt-1.5 pb-3 flex items-start justify-between gap-2.5 shrink-0">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{unit.resident}</p>
                        <p className="text-xs text-slate-500">Unit {unit.id} · Wemabod Estate</p>
                    </div>
                    <span className={`flex-shrink-0 font-mono text-2xs font-bold uppercase tracking-wider px-2 py-1 rounded ${STATUS_CHIP[unit.status]}`}>
                        {STATUS_LABEL[unit.status]}
                    </span>
                </div>

                {/* The tappable tabs — Balance / Months / Notices */}
                <div className="px-4 pb-3 shrink-0">
                    <div className="flex gap-1 p-1 rounded-lg bg-slate-100/80" role="group" aria-label="Portal sections">
                        <PortalTab active={tab === 'balance'} onClick={() => setTab('balance')}>Balance</PortalTab>
                        <PortalTab active={tab === 'months'} onClick={() => setTab('months')}>Months</PortalTab>
                        <PortalTab active={tab === 'notices'} onClick={() => setTab('notices')}>Notices</PortalTab>
                    </div>
                </div>

                {/* The scrollable portal body */}
                <div className="at-phone__scroll flex-1 px-4 pb-2" key={`${unit.id}-${tab}`}>
                    {tab === 'balance' && (
                        <div className="panel-in origin-top">
                            {/* Balance card — the status colour carries the story */}
                            <div className={`rounded-lg bg-white border border-slate-200/70 border-l-4 ${STATUS_ACCENT[unit.status]} shadow-sm p-3.5`}>
                                <p className="font-mono text-2xs uppercase tracking-widest text-slate-400">
                                    {vacant ? 'Unit status' : 'Balance due'}
                                </p>
                                <p className="font-mono nums-tabular text-xl font-semibold text-slate-900 mt-1">
                                    {unit.balance}
                                </p>
                                <p className="text-2xs text-slate-500 mt-0.5 leading-relaxed">{unit.balanceNote}</p>
                                {!vacant && (
                                    <div className="at-phone__btn mt-3 py-2.5 text-center text-sm font-semibold">
                                        {unit.status === 'paid' ? 'View receipts' : 'Pay now'}
                                    </div>
                                )}
                            </div>
                            {/* Pay-ahead option on the settled states */}
                            {!vacant && (unit.status === 'paid' || unit.status === 'prepaid') && (
                                <div className="mt-2.5 rounded-lg border border-blue-200/80 bg-blue-50/60 p-3.5">
                                    <p className="text-xs font-semibold text-blue-800">Pay ahead</p>
                                    <p className="text-2xs text-blue-700/80 mt-0.5 leading-relaxed">
                                        Settle next quarter or next year in advance — prepaid months show blue in the ledger.
                                    </p>
                                </div>
                            )}
                            {/* Quick ledger summary — the year at a glance */}
                            {!vacant && (
                                <div className="mt-2.5 rounded-lg bg-white border border-slate-200/70 p-3.5 space-y-2.5">
                                    <p className="font-mono text-2xs uppercase tracking-widest text-slate-400">2026 at a glance</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Months paid on time</span>
                                        <span className={`font-mono text-2xs font-bold uppercase tracking-wider ${ROW_CHIP.Paid}`}>
                                            {unit.months.filter((m) => m.status === 'Paid').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Due / outstanding</span>
                                        <span className={`font-mono text-2xs font-bold uppercase tracking-wider ${ROW_CHIP.Due}`}>
                                            {unit.months.filter((m) => m.status === 'Due' || m.status === 'Overdue' || m.status === 'Partial').length}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600">Prepaid months in hand</span>
                                        <span className={`font-mono text-2xs font-bold uppercase tracking-wider ${ROW_CHIP.Prepaid}`}>
                                            {unit.months.filter((m) => m.status === 'Prepaid').length}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'months' && !vacant && (
                        <div className="panel-in origin-top space-y-2 pb-2">
                            <p className="text-xs text-slate-500 px-0.5">{unit.monthsNote}</p>
                            <div className="rounded-lg bg-white border border-slate-200/70 divide-y divide-slate-100">
                                {unit.months.map((m) => (
                                    <div key={m.month} className="flex items-center justify-between px-3.5 py-2">
                                        <span className="text-xs text-slate-700">{m.month}</span>
                                        <span className={`font-mono text-2xs font-bold uppercase tracking-wider ${ROW_CHIP[m.status]}`}>
                                            {m.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="font-mono text-2xs tracking-wider text-slate-400 text-center pt-1">
                                SCROLL FOR THE FULL YEAR · TAP A TAB ABOVE
                            </p>
                        </div>
                    )}

                    {tab === 'months' && vacant && (
                        <div className="panel-in origin-top rounded-lg bg-white border border-slate-200/70 p-4 text-center">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                No payment ledger — this unit is between residents.
                            </p>
                        </div>
                    )}

                    {tab === 'notices' && (
                        <div className="panel-in origin-top space-y-2.5">
                            {/* The note — money trouble reads rose; vacant-unit
                                OPERATIONS (turnover cleans, renovation quotes)
                                read NEUTRAL GRAY, never amber/rose. */}
                            {unit.note && (
                                <div
                                    className={`rounded-lg p-3.5 flex items-center gap-3 ${
                                        unit.status === 'vacant' ? 'at-chip--neutral' : 'bg-rose-50 border border-rose-200/70'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${unit.status === 'vacant' ? 'bg-slate-400' : 'bg-rose-500'}`} />
                                    <p className="text-2xs text-slate-700 leading-relaxed">{unit.note}</p>
                                </div>
                            )}
                            {!unit.note && (
                                <div className="rounded-lg bg-white border border-slate-200/70 p-3.5 flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                                    <p className="text-2xs text-slate-700 leading-relaxed">No notices — everything quiet.</p>
                                </div>
                            )}
                            {unit.maintenance ? (
                                <div className="rounded-lg bg-atrium-clay/10 border border-atrium-clay/25 p-3.5 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-atrium-clay/20 flex items-center justify-center flex-shrink-0">
                                        <span className="w-2 h-2 rounded-full bg-atrium-clay" />
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-slate-800">{unit.maintenance.title}</p>
                                        <p className="text-2xs text-slate-500">{unit.maintenance.note}</p>
                                    </div>
                                </div>
                            ) : !vacant ? (
                                <div className="rounded-lg bg-white border border-slate-200/70 p-3.5 flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-atrium-emerald/10 flex items-center justify-center flex-shrink-0">
                                        <span className="w-2 h-2 rounded-full bg-atrium-emerald" />
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-slate-800">Visitor pass #2231</p>
                                        <p className="text-2xs text-slate-500">Sentry Pass · expires 6:00 PM today</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg bg-white border border-slate-200/70 p-3.5">
                                    <p className="text-xs font-semibold text-slate-800 mb-2">Listing pipeline</p>
                                    <div className="space-y-1.5">
                                        <p className="text-2xs text-slate-600">Enquiries this week · 3</p>
                                        <p className="text-2xs text-slate-600">Viewings scheduled · 1 (Sat 10:00)</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* The bottom nav — the portal's own rails, decorative */}
                <div className="shrink-0 border-t border-slate-200/80 bg-white/70 px-5 pt-2 pb-1 flex items-center justify-between text-slate-400" aria-hidden="true">
                    <span className="flex flex-col items-center gap-0.5 text-atrium-emerald">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5 2.5 9h2v8h4v-5h3v5h4V9h2L10 2.5Z"/></svg>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Home</span>
                    </span>
                    <span className="flex flex-col items-center gap-0.5">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4h14v3H3V4Zm0 5h14v7H3V9Zm2 2v3h6v-3H5Z"/></svg>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Payments</span>
                    </span>
                    <span className="flex flex-col items-center gap-0.5">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3h8l3 3v11H5V3Zm2 6h7v1.5H7V9Zm0 3.5h7V14H7v-1.5Z"/></svg>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Receipts</span>
                    </span>
                    <span className="flex flex-col items-center gap-0.5">
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="7" r="3.2"/><path d="M4 17c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5H4Z"/></svg>
                        <span className="text-[8px] font-bold uppercase tracking-widest">Profile</span>
                    </span>
                </div>
                {/* Home indicator — the modern handset's rail */}
                <div className="shrink-0 flex justify-center pb-2.5 pt-1.5" aria-hidden="true">
                    <span className="block h-1 w-24 rounded-full bg-slate-900/80" />
                </div>
            </div>
        </div>
    );
};

/* ── The section ─────────────────────────────────────────────────── */

const selectCls =
    'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-2xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-atrium-emerald cursor-pointer';

export const AtriumEstate: React.FC = () => {
    // The defaulter dashboard is the story — default to an overdue unit.
    const [selectedId, setSelectedId] = useState('C4');
    const selected = UNITS.find((u) => u.id === selectedId) ?? UNITS[0];

    // R39: the grid filter — tap a state, the other units recede.
    const [filter, setFilter] = useState<UnitStatus | 'all'>('all');

    // R39: the compact stat cards carry their own dropdowns — the period
    // and scope drive the figure, like the app's monitor.
    const [period, setPeriod] = useState('q4');
    const collectionRate = period === 'q3' ? '96.4%' : period === 'ytd' ? '97.1%' : '98.2%';
    const [scope, setScope] = useState('phase2');
    const occupancy = scope === 'all' ? '88.9%' : '91.7%';

    return (
        <section
            aria-labelledby="atrium-estate-heading"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                {/* Section head — warm, human, unhurried */}
                <div className="max-w-2xl mb-12 md:mb-16">
                    <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-emerald mb-5">
                        Revenue Monitor
                    </p>
                    <h2
                        id="atrium-estate-heading"
                        className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-[1.15] mb-6"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        The estate, at a glance.
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-600">
                        Real-time defaulter dashboard, rent collection tracking, and portfolio-level
                        financial analytics. Select any unit below to see exactly what the app
                        shows — the resident&rsquo;s balance, their month-by-month ledger, and the
                        same colour coding your managers work with every day: green for settled,
                        amber for due, violet for partial, blue for prepaid months in hand, red
                        for overdue.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
                    {/* Left — the occupancy grid on a warm card */}
                    <div className="lg:col-span-7">
                        <div className="rounded-2xl bg-white border border-slate-200/70 shadow-elevation-2 p-6 md:p-8">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                                    Occupancy — Wemabod Estate, Phase 2
                                </p>
                                <p className="font-mono text-2xs tracking-wider text-slate-400">
                                    UPDATED 12 OCT 2026
                                </p>
                            </div>

                            {/* R39: the filter row — tap a state, the grid
                                focuses. The monitor's own gesture. */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-5" role="group" aria-label="Filter units by status">
                                <Button
                                    variant="bare"
                                    aria-pressed={filter === 'all'}
                                    onClick={() => setFilter('all')}
                                    className={`rounded-full px-3 py-1 text-2xs font-bold uppercase tracking-wider transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-atrium-emerald ${
                                        filter === 'all'
                                            ? 'bg-slate-900 text-white'
                                            : 'border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                    }`}
                                >
                                    All · 24
                                </Button>
                                {STATUS_ORDER.map((s) => {
                                    const on = filter === s;
                                    const n = countByStatus(s);
                                    if (n === 0) return null;
                                    return (
                                        <Button
                                            key={s}
                                            variant="bare"
                                            aria-pressed={on}
                                            onClick={() => setFilter(on ? 'all' : s)}
                                            className={`rounded-full px-3 py-1 text-2xs font-bold uppercase tracking-wider transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-atrium-emerald ${
                                                on
                                                    ? 'bg-slate-900 text-white'
                                                    : 'border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                            }`}
                                        >
                                            {STATUS_LABEL[s]} · {n}
                                        </Button>
                                    );
                                })}
                            </div>

                            {/* The live grid of units — click a square, the
                                phone answers. A filter dims the rest. */}
                            <div
                                className="grid grid-cols-6 gap-2"
                                role="group"
                                aria-label="Estate units by payment status"
                            >
                                {UNITS.map((u) => {
                                    const on = u.id === selected.id;
                                    const dim = filter !== 'all' && u.status !== filter && !on;
                                    return (
                                        <Button
                                            key={u.id}
                                            variant="bare"
                                            aria-pressed={on}
                                            title={`Unit ${u.id} — ${STATUS_LABEL[u.status]}${u.status !== 'vacant' ? ` · ${u.resident}` : ''}`}
                                            onClick={() => setSelectedId(u.id)}
                                            className={`at-unit at-unit--${u.status} h-10 flex items-center justify-center ${on ? 'is-selected' : ''} ${dim ? 'is-dimmed' : ''}`}
                                        >
                                            <span className="font-mono text-2xs">{u.id}</span>
                                        </Button>
                                    );
                                })}
                            </div>

                            {/* Legend + summary — the colour key, with counts */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    {STATUS_ORDER.map((s) => (
                                        <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <span className={`at-swatch at-swatch--${s}`} aria-hidden="true" />
                                            {STATUS_LABEL[s]}
                                            <span className="font-mono text-2xs text-slate-400">{countByStatus(s)}</span>
                                        </span>
                                    ))}
                                </div>
                                <p className="font-mono nums-tabular text-sm text-slate-700">
                                    22 / 24 OCCUPIED · <span className="font-semibold text-atrium-emerald">91.7%</span>
                                </p>
                            </div>
                        </div>

                        {/* Numbers that matter — compact dropdown-driven
                            chips (R39): smaller cards, live controls. */}
                        <div className="grid grid-cols-2 gap-4 mt-5">
                            <div className="rounded-lg bg-white border border-slate-200/70 shadow-sm p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <p className="text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Collection rate
                                    </p>
                                    <div className="w-[118px]">
                                        <Select
                                            styleVariant="bare"
                                            selectClassName={selectCls}
                                            aria-label="Collection rate period"
                                            value={period}
                                            onChange={(e) => setPeriod(e.target.value)}
                                            options={[
                                                { value: 'q4', label: 'This quarter' },
                                                { value: 'q3', label: 'Last quarter' },
                                                { value: 'ytd', label: 'Year to date' },
                                            ]}
                                        />
                                    </div>
                                </div>
                                <p className="font-mono nums-tabular text-2xl font-semibold text-atrium-emerald">
                                    {collectionRate}
                                </p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200/70 shadow-sm p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <p className="text-2xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                        Occupancy
                                    </p>
                                    <div className="w-[118px]">
                                        <Select
                                            styleVariant="bare"
                                            selectClassName={selectCls}
                                            aria-label="Occupancy scope"
                                            value={scope}
                                            onChange={(e) => setScope(e.target.value)}
                                            options={[
                                                { value: 'phase2', label: 'Phase 2' },
                                                { value: 'all', label: 'All phases' },
                                            ]}
                                        />
                                    </div>
                                </div>
                                <p className="font-mono nums-tabular text-2xl font-semibold text-atrium-emerald">
                                    {occupancy}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right — the residents' portal phone, live with the
                        selected unit's status */}
                    <div className="lg:col-span-5 flex flex-col items-center">
                        <div aria-live="polite" className="w-full flex flex-col items-center">
                            {/* Keyed by unit: the portal resets to its Balance
                                tab when a new resident is selected. */}
                            <ResidentsPortalPhone key={selected.id} unit={selected} />
                        </div>
                        <p className="font-mono text-2xs tracking-wider text-slate-500 mt-6 text-center">
                            RESIDENTS&rsquo; PORTAL — SELECT A UNIT · TAP THE TABS · ILLUSTRATIVE
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
