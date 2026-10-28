import React from 'react';

/**
 * VegaProcedure — /vega's replacement for the shared 3-step how-it-works
 * card row.
 *
 * "The Night Chambers" register: the three steps read as a PROCEDURE
 * SCHEDULE — three columns divided by vertical hairlines (no boxes, no
 * cards, no icon chips): a large serif numeral in gilt, the step title
 * in parchment serif, the body in the body face. On mobile the schedule
 * stacks, divided by horizontal rules. Numerals are 1/2/3 — plain, per
 * the audit's legibility convention.
 *
 * Copy is the shipped Vega step copy, verbatim (Matter Ingestion Wizard,
 * DraftPro). Presentational only — zero buttons, zero hardcoded hexes.
 */
const STEPS = [
    {
        num: '1',
        title: 'Create your firm workspace',
        body: 'Sign up in minutes — no credit card required for trial. Choose Vega and invite your team.',
    },
    {
        num: '2',
        title: 'Add your matters',
        body: 'Use the Matter Ingestion Wizard to bulk-import case files from a folder, or create matters one at a time. Link clients, documents, and court dates.',
    },
    {
        num: '3',
        title: 'Start practicing',
        body: 'Draft your first legal document with DraftPro, send a court date reminder, or run an AI case analysis.',
    },
];

export const VegaProcedure: React.FC = () => (
    <section
        id="howItWorks"
        aria-labelledby="vega-procedure-heading"
        className="py-20 md:py-28 border-t border-vega-night/10"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
            {/* Roman-numeral hairline section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                V — Procedure
            </p>
            <h2
                id="vega-procedure-heading"
                className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 text-vega-night"
            >
                Open your chambers in three steps
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                From sign-up to your first legal draft — in minutes, not weeks.
            </p>

            {/* The schedule — columns divided by hairlines, never boxed */}
            <div className="grid md:grid-cols-3 md:divide-x md:divide-vega-night/10 border-t border-vega-night/10 md:border-t-0">
                {STEPS.map((step) => (
                    <div key={step.num} className="py-8 md:py-4 md:px-8 first:md:pl-0 last:md:pr-0 border-b md:border-b-0 border-vega-night/10 last:border-b-0">
                        <p className="font-vega text-6xl font-semibold text-vega-gilt leading-none mb-5">
                            {step.num}
                        </p>
                        <h3 className="font-vega text-xl font-semibold text-vega-night mb-3">
                            {step.title}
                        </h3>
                        <p className="text-sm leading-[1.7] text-slate-700">
                            {step.body}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);
