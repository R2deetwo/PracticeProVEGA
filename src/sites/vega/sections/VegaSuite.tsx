import React from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaSuite — /vega's product catalogue band (the LawPavilion arrangement).
 *
 * LawPavilion opens with a grid of its products (Prime, AI, Elite, MOJ,
 * Primsol) — name, one line, an Explore link. Vega's equivalent: the six
 * instruments of the practice, laid out as a ruled catalogue on the night
 * ground. Each entry: mono numeral, serif title, one honest line, and an
 * Explore link that walks the visitor down to the matching deep-dive band
 * — the same "products first, detail below" arrangement.
 *
 * "The Night Chambers" register: a ruled table of a law report, not a
 * floating card grid — hairline cell borders, square corners, no shadows.
 * Copy is the shipped capability copy, verbatim (honest marketing, P8).
 * Interactive entries use the ui/Button primitive (ADR-0004).
 */

type Instrument = {
    num: string;
    title: string;
    line: string;
    exploreLabel: string;
    exploreTarget: string; // element id, scrolled into view
};

const INSTRUMENTS: Instrument[] = [
    {
        num: '01',
        title: 'Matter Management',
        line: 'Cases organised by court, jurisdiction and matter type — documents, parties and deadlines in one workspace.',
        exploreLabel: 'Explore matters',
        exploreTarget: 'features',
    },
    {
        num: '02',
        title: 'DraftPro Editor',
        line: 'A4 pagination, Nigerian legal fonts, and placeholder guardrails that block printing until every blank is filled.',
        exploreLabel: 'Explore drafting',
        exploreTarget: 'ai-capabilities',
    },
    {
        num: '03',
        title: 'ALOA AI Copilot',
        line: 'Drafts, case summaries and precedent research — trained on Nigerian legal terminology and court rules.',
        exploreLabel: 'Explore ALOA',
        exploreTarget: 'ai-capabilities',
    },
    {
        num: '04',
        title: 'Court Rules Agent',
        line: 'Filing deadlines computed from the Civil Procedure Rules of the matter\u2019s court — 36 states and the FCT.',
        exploreLabel: 'Explore calendaring',
        exploreTarget: 'court-rules',
    },
    {
        num: '05',
        title: 'Billing on the Scale',
        line: 'Fee notes computed under the Scale of Charges (Remuneration Order 2023), with naira-first bank transfer flows.',
        exploreLabel: 'Explore billing',
        exploreTarget: 'scale-of-charges',
    },
    {
        num: '06',
        title: 'Client Portal',
        line: 'Clients track milestones, upload documents and submit KYC at any hour — without calling your office.',
        exploreLabel: 'Explore the portal',
        exploreTarget: 'features',
    },
];

export const VegaSuite: React.FC = () => {
    const explore = (target: string) => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <section
            id="suite"
            aria-labelledby="vega-suite-heading"
            className="py-20 md:py-28 border-t border-white/10"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
                {/* Section head — the suite is the catalogue page of the volume */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    The Suite — Six Instruments
                </p>
                <h2
                    id="vega-suite-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-parchment"
                >
                    One system,{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">six instruments.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-400 max-w-2xl mb-12 md:mb-16">
                    Everything a Nigerian practice runs on, in one workspace. Each
                    instrument below is live in the running product — explore it in
                    the detail bands that follow.
                </p>

                {/* The catalogue — a ruled table, hairline cell borders, square corners */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/10">
                    {INSTRUMENTS.map((ins) => (
                        <div
                            key={ins.num}
                            className="group flex flex-col border-r border-b border-white/10 p-7 sm:p-8 transition-colors hover:bg-white/[0.03]"
                        >
                            <p className="font-mono text-xs tracking-widest text-vega-gilt-bright mb-5">
                                {ins.num}
                            </p>
                            <h3 className="font-vega text-xl font-semibold text-vega-parchment leading-snug mb-3">
                                {ins.title}
                            </h3>
                            <p className="text-sm leading-[1.7] text-slate-400 mb-6 flex-1">
                                {ins.line}
                            </p>
                            <Button
                                variant="bare"
                                onClick={() => explore(ins.exploreTarget)}
                                className="self-start px-0 py-1 text-sm font-semibold text-vega-gilt-bright hover:text-vega-gilt transition-colors focus-visible:ring-vega-gilt"
                            >
                                {ins.exploreLabel}
                                <span aria-hidden="true" className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                                    &darr;
                                </span>
                            </Button>
                        </div>
                    ))}
                </div>

                <p className="font-mono text-2xs tracking-widest text-slate-600 mt-6">
                    CATALOGUE — 6 INSTRUMENTS · EVERY ENTRY LIVE IN THE RUNNING PRODUCT
                </p>
            </div>
        </section>
    );
};
