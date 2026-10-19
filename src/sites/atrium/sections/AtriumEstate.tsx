import React from 'react';

/**
 * AtriumEstate — the "occupancy" and "resident portal" signature moments
 * for /atrium, presented as one editorial spread: the portfolio as a warm
 * grid of units (occupied emerald / vacant clay — not a data table), and
 * the residents' portal as a phone mockup lit consistently with the
 * photography. Numbers that matter are set large in tabular mono on cream.
 *
 * Presentational only — zero raw form elements (the mockup's "buttons"
 * are styled divs inside an aria-hidden exhibit).
 */

/** 24 units, Phase 2 — true = occupied (clay), false = vacant (tan).
 * R32: 22 occupied · 2 vacant (B3, D4) — matching the hero's master plan
 * and the displayed 22/24 · 91.7% (the old array had 3 vacant, a count
 * bug the rebrand's one-estate story surfaced). */
const UNITS: boolean[] = [
    true, true, true, true, true, true,
    true, true, false, true, true, true,
    true, true, true, true, true, true,
    true, true, true, false, true, true,
];

const unitId = (i: number) => `${String.fromCharCode(65 + Math.floor(i / 6))}${(i % 6) + 1}`;

const ResidentsPortalPhone: React.FC = () => (
    <div className="at-phone w-[290px] mx-auto" aria-hidden="true">
        <div className="at-phone__screen">
            {/* Status bar */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <span className="font-mono text-2xs text-slate-400">9:41</span>
                <span className="w-16 h-4 rounded-full bg-atrium-ink/90 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-atrium-clay" />
                </span>
            </div>
            {/* Greeting */}
            <div className="px-5 pt-2 pb-4">
                <p className="text-sm font-semibold text-slate-900">Adaeze Nwosu</p>
                <p className="text-xs text-slate-500">Unit B14 · Wemabod Estate</p>
            </div>
            {/* Balance card */}
            <div className="mx-4 rounded-xl bg-white border border-slate-200/70 shadow-sm p-4">
                <p className="font-mono text-2xs uppercase tracking-widest text-slate-400">
                    Balance due
                </p>
                <p className="font-mono nums-tabular text-xl font-semibold text-slate-900 mt-1">
                    &#8358;360,000.00
                </p>
                <p className="text-2xs text-slate-500 mt-0.5">Service charge · due 31 Dec 2026</p>
                <div className="at-phone__btn mt-3 py-2.5 text-center text-sm font-semibold">
                    Pay now
                </div>
            </div>
            {/* Ledger history */}
            <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Rent (annual) 2026</span>
                    <span className="font-mono text-2xs font-semibold text-atrium-clay-deep uppercase tracking-wider">
                        Paid
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Service charge Q3</span>
                    <span className="font-mono text-2xs font-semibold text-atrium-clay-deep uppercase tracking-wider">
                        Paid
                    </span>
                </div>
            </div>
            {/* Maintenance */}
            <div className="mx-4 mb-4 rounded-xl bg-atrium-tan/10 border border-atrium-tan/30 p-3.5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-atrium-tan/20 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-atrium-tan" />
                </span>
                <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">Leaking kitchen tap</p>
                    <p className="text-2xs text-slate-500">Maintenance · in progress</p>
                </div>
            </div>
            {/* Visitor pass */}
            <div className="mx-4 mb-5 rounded-xl bg-white border border-slate-200/70 p-3.5 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-atrium-clay/10 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-atrium-clay" />
                </span>
                <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800">Visitor pass #2231</p>
                    <p className="text-2xs text-slate-500">Sentry Pass · expires 6:00 PM today</p>
                </div>
            </div>
        </div>
    </div>
);

export const AtriumEstate: React.FC = () => (
    <section
        aria-labelledby="atrium-estate-heading"
        className="py-20 md:py-28"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            {/* Section head — warm, human, unhurried */}
            <div className="max-w-2xl mb-12 md:mb-16">
                <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-clay mb-5">
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
                    financial analytics. Know which residents are overdue and which properties
                    are underperforming — and give every resident a portal that answers their
                    questions before they call you.
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

                        {/* The warm grid of units */}
                        <div className="grid grid-cols-6 gap-2.5">
                            {UNITS.map((occupied, i) => (
                                <div
                                    key={unitId(i)}
                                    className={`at-unit ${occupied ? 'at-unit--occupied' : 'at-unit--vacant'} h-11 flex items-center justify-center`}
                                    title={occupied ? `Unit ${unitId(i)} — occupied` : `Unit ${unitId(i)} — vacant`}
                                >
                                    <span className="font-mono text-2xs">{unitId(i)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Legend + summary */}
                        <div className="flex flex-wrap items-center justify-between gap-4 mt-7">
                            <div className="flex items-center gap-5">
                                <span className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-atrium-clay/20 border border-atrium-clay/45" />
                                    Occupied
                                </span>
                                <span className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed border-atrium-tan/70" />
                                    Vacant
                                </span>
                            </div>
                            <p className="font-mono nums-tabular text-sm text-slate-700">
                                22 / 24 OCCUPIED · <span className="font-semibold text-atrium-clay-deep">91.7%</span>
                            </p>
                        </div>
                    </div>

                    {/* Numbers that matter — large tabular mono on cream.
                        R32: the 98.2% collection figure lives once, in the
                        hero's register card; this band carries the estate's
                        own occupancy + collections story. */}
                    <div className="grid grid-cols-2 gap-6 mt-8 px-2">
                        <div>
                            <p className="font-mono nums-tabular text-3xl md:text-4xl font-semibold text-atrium-clay-deep">
                                91.7%
                            </p>
                            <p className="text-sm text-slate-500 mt-1.5">portfolio occupancy, live</p>
                        </div>
                        <div>
                            <p className="font-mono nums-tabular text-3xl md:text-4xl font-semibold text-atrium-clay-deep">
                                &#8358;48.6M
                            </p>
                            <p className="text-sm text-slate-500 mt-1.5">collected YTD, demo estate</p>
                        </div>
                    </div>
                </div>

                {/* Right — the residents' portal phone mockup */}
                <div className="lg:col-span-5 flex flex-col items-center">
                    <ResidentsPortalPhone />
                    <p className="font-mono text-2xs tracking-wider text-slate-500 mt-6 text-center">
                        RESIDENTS&rsquo; PORTAL — LEDGER, MAINTENANCE &amp; VISITOR PASSES
                    </p>
                </div>
            </div>
        </div>
    </section>
);
