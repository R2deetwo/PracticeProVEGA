import React from 'react';

/**
 * VegaRecord — /vega's trust band (the LawPavilion arrangement).
 *
 * LawPavilion carries a stats band under its products grid ("Trusted by
 * Top Legal Minds" — 29,000 practitioners, years of pioneering, team,
 * fulfilled clients). Vega's equivalent is THE RECORD: big serif numerals
 * between hairlines. Every figure is verifiable in the running product or
 * the platform's published terms — no vanity metrics, no invented counts
 * (the honest-claims discipline that removed the fake WhatsApp/SSO claims).
 *
 * Presentational only — zero buttons (ADR-0004), zero hardcoded hexes.
 */

const RECORD = [
    {
        figure: '36 + FCT',
        label: 'JURISDICTIONS WITH COURT RULES ENCODED',
        note: 'Federal and State High Courts — the Civil Procedure Rules each deadline is computed from.',
    },
    {
        figure: '7 · 3 · 1',
        label: 'DAYS BEFORE EACH HEARING',
        note: 'The reminder cadence the Court Rules Agent fires to assigned counsel, by email and in-app.',
    },
    {
        figure: 'NDPA 2023',
        label: 'DATA PROTECTION COMPLIANT',
        note: 'PII Shield strips names, NIN, BVN and bank details before anything reaches an AI model.',
    },
    {
        figure: '30 days',
        label: 'FREE TRIAL — NO CREDIT CARD',
        note: 'Every Vega subscription starts on trial; annual plans carry a 30-day money-back guarantee.',
    },
];

export const VegaRecord: React.FC = () => (
    <section
        id="record"
        aria-labelledby="vega-record-heading"
        className="py-20 md:py-28 border-t border-white/10"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
            {/* Section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                The Record — Stated Plainly
            </p>
            <h2
                id="vega-record-heading"
                className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-parchment"
            >
                Trusted on the record,{' '}
                <span className="font-vega-italic text-vega-gilt-bright">not on vanity.</span>
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-400 max-w-2xl mb-12 md:mb-16">
                Every figure below is verifiable in the running product or the
                platform&rsquo;s published terms. We do not publish counts we cannot
                defend in a courtroom.
            </p>

            {/* The figures — big serif numerals between hairlines */}
            <div className="border-t border-b border-white/10 grid sm:grid-cols-2 lg:grid-cols-4">
                {RECORD.map((r, i) => (
                    <div
                        key={r.figure}
                        className={`py-10 px-6 sm:px-8 ${i < RECORD.length - 1 ? 'border-b sm:border-b-0' : ''} ${
                            i % 2 === 0 ? 'sm:border-r' : ''
                        } ${i < 2 ? 'lg:border-b-0' : ''} ${i < RECORD.length - 1 ? 'lg:border-r' : ''} border-white/10`}
                    >
                        <p className="font-vega text-4xl md:text-5xl font-semibold tracking-tight text-vega-gilt leading-none mb-4 whitespace-nowrap">
                            {r.figure}
                        </p>
                        <p className="font-mono text-2xs tracking-[0.18em] text-vega-parchment/90 mb-3">
                            {r.label}
                        </p>
                        <p className="text-sm leading-[1.7] text-slate-400">{r.note}</p>
                    </div>
                ))}
            </div>

            <p className="font-mono text-2xs tracking-widest text-slate-600 mt-6 uppercase">
                Verified against the live platform · TLS 1.3 · EST. Lagos
            </p>
        </div>
    </section>
);
