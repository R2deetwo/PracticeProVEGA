import React from 'react';

/**
 * VegaProcedure — /vega's replacement for the shared 3-step how-it-works
 * card row.
 *
 * "The Chambers Standard" register: the three steps read as a PROCEDURE
 * SCHEDULE — three columns divided by vertical hairlines (no boxes, no
 * cards, no icon chips): a serif numeral, the step title in serif, the
 * body in the body face. On mobile the schedule stacks, divided by
 * horizontal rules. Numerals are 1/2/3 — plain, per the audit's
 * legibility convention.
 *
 * Copy is the shipped Vega step copy, verbatim (Matter Ingestion Wizard,
 * DraftPro). Presentational only — zero buttons, zero hardcoded hexes.
 */
const STEPS = [
    {
        num: '1',
        title: 'Create your firm workspace',
        body: 'Sign up in 2 minutes. No credit card required for trial. Choose Vega and invite your team.',
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
        className="py-20 md:py-28 bg-white border-t border-slate-200"
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            {/* Numbered hairline section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-claret-deep mb-7">
                05 — Procedure
            </p>
            <h2
                id="vega-procedure-heading"
                className="font-vega text-3xl md:text-4xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5"
                style={{ color: 'var(--color-ink)' }}
            >
                Get started in 3 steps
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-600 max-w-2xl mb-12 md:mb-16">
                From sign-up to your first legal draft — in minutes, not weeks.
            </p>

            {/* The schedule — columns divided by hairlines, never boxed */}
            <div className="grid md:grid-cols-3 md:divide-x md:divide-slate-200 border-t border-slate-200 md:border-t-0">
                {STEPS.map((step) => (
                    <div key={step.num} className="py-8 md:py-4 md:px-8 first:md:pl-0 last:md:pr-0 border-b md:border-b-0 border-slate-200 last:border-b-0">
                        <p className="font-vega text-5xl font-semibold text-vega-claret-deep leading-none mb-5">
                            {step.num}
                        </p>
                        <h3 className="font-vega text-xl font-semibold text-slate-900 mb-3">
                            {step.title}
                        </h3>
                        <p className="text-sm leading-[1.7] text-slate-600">
                            {step.body}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);
