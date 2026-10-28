import React from 'react';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaCourtRules — the "court rules" signature moment for /vega.
 *
 * Court-rule-aware calendaring rendered as a PROCEDURAL TIMELINE — a legal
 * chronology, not a feature card: mono dates, court names, and deadlines
 * the Court Rules Agent computes from the Civil Procedure Rules of the
 * matter's court. Computed deadlines carry the claret node; filed events
 * carry the neutral node. On the night page the framing copy runs on the
 * dark ground while the chronology stays a lit paper sheet. Grounded in
 * the shipped behaviour the marketing copy already claims (reminders
 * 7/3/1 days before each date; rules for Federal and State High Courts
 * across 36 states + FCT).
 *
 * Presentational only — zero buttons (ADR-0004), zero hardcoded hexes.
 */

type ChronoEntry = {
    date: string;
    title: string;
    detail: string;
    computed: boolean;
};

const CHRONOLOGY: ChronoEntry[] = [
    {
        date: '14 AUG 2026',
        title: 'Matter opened — Okafor v. Meridian Logistics Ltd',
        detail: 'INTAKE · HIGH COURT OF LAGOS STATE, IKEJA DIVISION',
        computed: false,
    },
    {
        date: '02 NOV 2026',
        title: 'Writ of Summons filed',
        detail: 'REGISTRY · E-FILING CONFIRMED · SUIT NO. IKD/1287/2026',
        computed: false,
    },
    {
        date: '09 NOV 2026',
        title: 'Service on Defendant effected',
        detail: 'SHERIFF · 42-DAY DEFENCE WINDOW OPENS',
        computed: false,
    },
    {
        date: '21 DEC 2026',
        title: 'Defence due',
        detail: 'COMPUTED — 42 DAYS AFTER SERVICE · HCCPR 2019',
        computed: true,
    },
    {
        date: '04 JAN 2027',
        title: 'Pre-trial conference',
        detail: 'REMINDERS TO ASSIGNED COUNSEL — 7 · 3 · 1 DAYS PRIOR',
        computed: true,
    },
    {
        date: '18 JAN 2027',
        title: 'Claimant\u2019s reply due',
        detail: 'COMPUTED — 14 DAYS AFTER SERVICE OF DEFENCE',
        computed: true,
    },
];

export const VegaCourtRules: React.FC = () => (
    <section
        id="court-rules"
        aria-labelledby="vega-court-rules-heading"
        className="py-20 md:py-28 border-t border-vega-night/10"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Left — framing copy on the night ground */}
                <div className="lg:col-span-5 lg:sticky lg:top-24">
                    <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                        III — Court-Rule Calendaring
                    </p>
                    <h2
                        id="vega-court-rules-heading"
                        className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-6 text-vega-night"
                    >
                        The firm diary that{' '}
                        <span className="font-vega-italic text-vega-gilt-bright">
                            keeps itself.
                        </span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-700 mb-8">
                        Vega computes every filing and service deadline from the Civil Procedure
                        Rules of the court your matter sits in — Federal and State High Courts,
                        36 states and the FCT — then reminds the assigned lawyer 7, 3 and 1 days
                        before each date. The diary writes itself; the practice never misses it.
                    </p>

                    {/* Legend — the chronology's key, in the ledger's voice */}
                    <div className="border-t border-vega-night/10 pt-5 space-y-2">
                        <p className="flex items-center gap-2.5 font-mono text-2xs tracking-widest text-slate-600">
                            <span className="inline-block w-2 h-2 rounded-full bg-vega-claret-bright" aria-hidden="true" />
                            DEADLINE COMPUTED BY THE COURT RULES AGENT
                        </p>
                        <p className="flex items-center gap-2.5 font-mono text-2xs tracking-widest text-slate-600">
                            <span className="inline-block w-2 h-2 rounded-full border border-slate-600 bg-transparent" aria-hidden="true" />
                            EVENT RECORDED FROM THE MATTER FILE
                        </p>
                    </div>
                </div>

                {/* Right — R28: a LIVE CAPTURE of the court-rule-aware
                    calendar in the real workspace (owner: "use stuff from
                    the app"). The designed chronology it replaced was an
                    illustration; this is the shipping deadline engine. */}
                <div className="lg:col-span-7">
                    <VegaAppShot
                        src="/assets/landing/app/calendar.jpg"
                        alt="Vega calendar — hearings and statutory deadlines computed from the matter's court rules"
                        caption="LIVE CAPTURE — DEADLINES COMPUTED UNDER THE CIVIL PROCEDURE RULES OF THE MATTER'S COURT"
                    />
                </div>
            </div>
        </div>
    </section>
);
