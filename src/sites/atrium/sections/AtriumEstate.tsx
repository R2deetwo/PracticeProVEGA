import React, { useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * AtriumEstate — the "Estate, at a glance" signature moment for /atrium.
 *
 * Owner direction (R38): "There is an inconsistency between what we have
 * on the site and what we have in the actual app… is it possible to get
 * it looking a little closer to the one in the app, and let us make this
 * more interactive — when the user clicks on the squares there, it should
 * show on the mockup phone what that resident's status is… it need not
 * be a direct replica, but it should allow the user to see how we have
 * arranged it and how we use colour coding in the app."
 *
 * So the band now mirrors the APP's colour language — the same coding the
 * unit ledger runs on:
 *
 *   PAID / CLEAR   emerald (solid tint)
 *   DUE            amber
 *   PARTIAL        blue
 *   OVERDUE        rose
 *   VACANT         clay, dashed (the estate's own vacant register)
 *
 * The grid is LIVE: every unit is a real button; selecting one renders
 * that resident's portal on the phone mockup — balance, ledger rows in
 * the status colours, maintenance and (for defaulters) the demand-notice
 * state. Vacant units show the listing view. Default selection is an
 * OVERDUE unit — the defaulter dashboard is the story the band tells.
 *
 * Presentational exhibit: the phone's "buttons" stay styled divs inside
 * the aria-hidden mockup; the unit grid uses the ui/Button primitive
 * (ADR-0004).
 */

type UnitStatus = 'paid' | 'due' | 'partial' | 'overdue' | 'vacant';

interface UnitData {
    id: string;
    status: UnitStatus;
    resident: string;
    /** Portal balance line — the amount shown on the balance card. */
    balance: string;
    /** Balance card sub-line (what it is / when it's due). */
    balanceNote: string;
    /** Ledger rows, each carrying its own status colour. */
    rows: Array<{ label: string; status: 'Paid' | 'Due' | 'Partial' | 'Overdue' | 'Active' }>;
    /** Optional maintenance ticket shown on the portal. */
    maintenance?: { title: string; note: string };
    /** Optional one-line note (notices, lease events). */
    note?: string;
}

const STATUS_ORDER: UnitStatus[] = ['paid', 'due', 'partial', 'overdue', 'vacant'];

const STATUS_LABEL: Record<UnitStatus, string> = {
    paid: 'Paid',
    due: 'Due',
    partial: 'Partial',
    overdue: 'Overdue',
    vacant: 'Vacant',
};

/** A settled resident — the portal's quiet state. */
const paidUnit = (id: string, resident: string, maintenance?: UnitData['maintenance']): UnitData => ({
    id,
    status: 'paid',
    resident,
    balance: '₦0.00',
    balanceNote: 'All settled · nothing due',
    rows: [
        { label: 'Rent (annual) 2026', status: 'Paid' },
        { label: 'Service charge Q4', status: 'Paid' },
    ],
    maintenance,
});

const UNITS: UnitData[] = [
    paidUnit('A1', 'Adaeze Nwosu'),
    paidUnit('A2', 'Tunde Bakare'),
    paidUnit('A3', 'Folake Adeyemi'),
    paidUnit('A4', 'Chinedu Obi'),
    {
        id: 'A5',
        status: 'vacant',
        resident: 'Unit A5',
        balance: 'Vacant',
        balanceNote: 'Listing active · 3 enquiries this week',
        rows: [
            { label: 'Listing status', status: 'Active' },
            { label: 'Last inspection', status: 'Paid' },
        ],
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
        rows: [
            { label: 'Rent (annual) 2026', status: 'Paid' },
            { label: 'Service charge Q3 · Q4', status: 'Overdue' },
        ],
        note: 'Rent demand notice drafted — ready to serve.',
    },
    paidUnit('B3', 'Chioma Iheanacho'),
    {
        id: 'B4',
        status: 'due',
        resident: 'Segun Alabi',
        balance: '₦180,000.00',
        balanceNote: 'Service charge · due 30 Nov 2026',
        rows: [
            { label: 'Rent (annual) 2026', status: 'Paid' },
            { label: 'Service charge Q4', status: 'Due' },
        ],
    },
    paidUnit('B5', 'Fatima Bello'),
    {
        id: 'B6',
        status: 'vacant',
        resident: 'Unit B6',
        balance: 'Vacant',
        balanceNote: 'Listing active · 1 enquiry this week',
        rows: [
            { label: 'Listing status', status: 'Active' },
            { label: 'Last inspection', status: 'Paid' },
        ],
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
        rows: [
            { label: 'Rent (annual) 2026', status: 'Overdue' },
            { label: 'Service charge Q3 · Q4', status: 'Overdue' },
        ],
        note: "7-Day Notice of Owner's Intention available to draft.",
    },
    {
        id: 'C5',
        status: 'partial',
        resident: 'Halima Musa',
        balance: '₦270,000.00',
        balanceNote: '₦90,000 of ₦360,000 paid · balance due 30 Nov',
        rows: [
            { label: 'Rent (annual) 2026', status: 'Paid' },
            { label: 'Service charge Q4', status: 'Partial' },
        ],
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
        rows: [
            { label: 'Rent (annual) 2026', status: 'Paid' },
            { label: 'Service charge Q4', status: 'Due' },
        ],
    },
    paidUnit('D4', 'Amaka Obiora'),
    paidUnit('D5', 'Femi Ogunbiyi', { title: 'Kitchen sink drainage', note: 'Maintenance · in progress' }),
    paidUnit('D6', 'Ronke Adesanya'),
];

/** Ledger-row status chip colours — the app's FinancialStatusBadge
 * language: emerald Paid, amber Due, blue Partial, rose Overdue. */
const ROW_CHIP: Record<string, string> = {
    Paid: 'text-emerald-700',
    Due: 'text-amber-600',
    Partial: 'text-blue-600',
    Overdue: 'text-rose-600',
    Active: 'text-atrium-emerald',
};

/** The portal badge for the balance card header. */
const STATUS_CHIP: Record<UnitStatus, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    due: 'bg-amber-100 text-amber-700',
    partial: 'bg-blue-100 text-blue-700',
    overdue: 'bg-rose-100 text-rose-700',
    vacant: 'bg-atrium-clay/15 text-atrium-clay',
};

/** Balance-card accent (left edge + amount). */
const STATUS_ACCENT: Record<UnitStatus, string> = {
    paid: 'border-l-emerald-500',
    due: 'border-l-amber-500',
    partial: 'border-l-blue-500',
    overdue: 'border-l-rose-500',
    vacant: 'border-l-atrium-clay',
};

const countByStatus = (s: UnitStatus) => UNITS.filter((u) => u.status === s).length;

/** The residents' portal phone — now driven by the selected unit. */
const ResidentsPortalPhone: React.FC<{ unit: UnitData }> = ({ unit }) => {
    const vacant = unit.status === 'vacant';
    return (
        <div className="at-phone w-[290px] mx-auto" aria-hidden="true">
            <div className="at-phone__screen" key={unit.id}>
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 pt-3 pb-2">
                    <span className="font-mono text-2xs text-slate-400">9:41</span>
                    <span className="w-16 h-4 rounded-full bg-slate-900/90 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-atrium-emerald" />
                    </span>
                </div>
                {/* Greeting */}
                <div className="px-5 pt-2 pb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{unit.resident}</p>
                        <p className="text-xs text-slate-500">Unit {unit.id} · Wemabod Estate</p>
                    </div>
                    <span className={`flex-shrink-0 font-mono text-2xs font-bold uppercase tracking-wider px-2 py-1 rounded ${STATUS_CHIP[unit.status]}`}>
                        {STATUS_LABEL[unit.status]}
                    </span>
                </div>
                {/* Balance card — the status colour carries the story */}
                <div className={`mx-4 rounded-xl bg-white border border-slate-200/70 border-l-4 ${STATUS_ACCENT[unit.status]} shadow-sm p-4`}>
                    <p className="font-mono text-2xs uppercase tracking-widest text-slate-400">
                        {vacant ? 'Unit status' : 'Balance due'}
                    </p>
                    <p className="font-mono nums-tabular text-xl font-semibold text-slate-900 mt-1">
                        {unit.balance}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">{unit.balanceNote}</p>
                    {!vacant && (
                        <div className="at-phone__btn mt-3 py-2.5 text-center text-sm font-semibold">
                            {unit.status === 'paid' ? 'View receipts' : 'Pay now'}
                        </div>
                    )}
                </div>
                {/* Ledger rows — each in its status colour, like the app */}
                <div className="px-5 py-4 space-y-3">
                    {unit.rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                            <span className="text-xs text-slate-600">{row.label}</span>
                            <span className={`font-mono text-2xs font-bold uppercase tracking-wider ${ROW_CHIP[row.status]}`}>
                                {row.status}
                            </span>
                        </div>
                    ))}
                </div>
                {/* Notice / lease event, when there is one */}
                {unit.note && (
                    <div className="mx-4 mb-3 rounded-xl bg-rose-50 border border-rose-200/70 p-3.5 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                        <p className="text-2xs text-slate-700 leading-relaxed">{unit.note}</p>
                    </div>
                )}
                {/* Maintenance */}
                {unit.maintenance ? (
                    <div className="mx-4 mb-4 rounded-xl bg-atrium-clay/10 border border-atrium-clay/25 p-3.5 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-atrium-clay/20 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-atrium-clay" />
                        </span>
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-800">{unit.maintenance.title}</p>
                            <p className="text-2xs text-slate-500">{unit.maintenance.note}</p>
                        </div>
                    </div>
                ) : (
                    <div className="mx-4 mb-5 rounded-xl bg-white border border-slate-200/70 p-3.5 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-atrium-emerald/10 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-atrium-emerald" />
                        </span>
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-800">Visitor pass #2231</p>
                            <p className="text-2xs text-slate-500">Sentry Pass · expires 6:00 PM today</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const AtriumEstate: React.FC = () => {
    // The defaulter dashboard is the story — default to an overdue unit.
    const [selectedId, setSelectedId] = useState('C4');
    const selected = UNITS.find((u) => u.id === selectedId) ?? UNITS[0];

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
                        shows — the resident&rsquo;s balance, their ledger, and the same colour
                        coding your managers work with every day: green for settled, amber for
                        due, blue for partial, red for overdue.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
                    {/* Left — the occupancy grid on a warm card */}
                    <div className="lg:col-span-7">
                        <div className="rounded-2xl bg-white border border-slate-200/70 shadow-elevation-2 p-6 md:p-8">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
                                    Occupancy — Wemabod Estate, Phase 2
                                </p>
                                <p className="font-mono text-2xs tracking-wider text-slate-400">
                                    UPDATED 12 OCT 2026
                                </p>
                            </div>

                            {/* The live grid of units — click a square, the
                                phone answers. */}
                            <div
                                className="grid grid-cols-6 gap-2.5"
                                role="group"
                                aria-label="Estate units by payment status"
                            >
                                {UNITS.map((u) => {
                                    const on = u.id === selected.id;
                                    return (
                                        <Button
                                            key={u.id}
                                            variant="bare"
                                            aria-pressed={on}
                                            title={`Unit ${u.id} — ${STATUS_LABEL[u.status]}${u.status !== 'vacant' ? ` · ${u.resident}` : ''}`}
                                            onClick={() => setSelectedId(u.id)}
                                            className={`at-unit at-unit--${u.status} h-11 flex items-center justify-center ${on ? 'is-selected' : ''}`}
                                        >
                                            <span className="font-mono text-2xs">{u.id}</span>
                                        </Button>
                                    );
                                })}
                            </div>

                            {/* Legend + summary — the app's colour key, with counts */}
                            <div className="flex flex-wrap items-center justify-between gap-4 mt-7">
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

                        {/* Numbers that matter — large tabular mono on cream */}
                        <div className="grid grid-cols-2 gap-6 mt-8 px-2">
                            <div>
                                <p className="font-mono nums-tabular text-3xl md:text-4xl font-semibold text-atrium-emerald">
                                    98.2%
                                </p>
                                <p className="text-sm text-slate-500 mt-1.5">collection rate this quarter</p>
                            </div>
                            <div>
                                <p className="font-mono nums-tabular text-3xl md:text-4xl font-semibold text-atrium-emerald">
                                    91.7%
                                </p>
                                <p className="text-sm text-slate-500 mt-1.5">portfolio occupancy</p>
                            </div>
                        </div>
                    </div>

                    {/* Right — the residents' portal phone, live with the
                        selected unit's status */}
                    <div className="lg:col-span-5 flex flex-col items-center">
                        <div aria-live="polite" className="w-full flex flex-col items-center">
                            <ResidentsPortalPhone unit={selected} />
                        </div>
                        <p className="font-mono text-2xs tracking-wider text-slate-500 mt-6 text-center">
                            RESIDENTS&rsquo; PORTAL — SELECT A UNIT TO SEE ITS STATUS · ILLUSTRATIVE
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
