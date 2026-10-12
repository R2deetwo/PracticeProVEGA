import React from 'react';

/**
 * VegaCredentials — /vega's replacement for the shared "Why run on"
 * icon-card section (+ the shared trust-badge strip).
 *
 * "The Chambers Standard" register: the firm's credentials read as
 * ATTESTATIONS — full-width ruled rows with mono numerals and serif
 * titles, no icon chips, no cards. The trust badges (NDPA 2023, TLS 1.3,
 * encryption at rest) that the shared strip carried are folded into the
 * section's mono colophon line — one strip of record, not three chips.
 *
 * Copy is the shipped Vega capability copy, verbatim (honest marketing,
 * P8: verifiable statements only). Presentational only.
 */
const ATTESTATIONS = [
    {
        title: 'Drafted for Nigerian courts',
        body: "DraftPro formats writs, affidavits and motions to Nigerian court practice — caption blocks, parties' designations, NWLR and NSC citations — paginated to A4, ready to file.",
    },
    {
        title: "Deadlines by the right state's rules",
        body: 'The Court Rules Agent calculates filing deadlines from the Civil Procedure Rules of the correct state, so the firm diary keeps itself.',
    },
    {
        title: 'Client data never trains a model',
        body: 'PII Shield strips names, phone numbers, NIN and BVN before anything reaches an AI model. Firm data stays isolated and NDPA 2023 compliant.',
    },
];

export const VegaCredentials: React.FC = () => (
    <section
        aria-labelledby="vega-credentials-heading"
        className="py-20 md:py-28"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            {/* Numbered hairline section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-claret-deep mb-7">
                06 — Credentials
            </p>
            <h2
                id="vega-credentials-heading"
                className="font-vega text-3xl md:text-4xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl"
                style={{ color: 'var(--color-ink)' }}
            >
                Why firms run on Vega
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-600 max-w-2xl mb-12 md:mb-16">
                How Vega helps Nigerian law firms stay on top of matters,
                drafts, and billable work.
            </p>

            {/* The attestations — ruled rows, no cards, no icons */}
            <div className="border-t border-slate-200">
                {ATTESTATIONS.map((a, i) => (
                    <div
                        key={a.title}
                        className="grid sm:grid-cols-12 gap-2 sm:gap-6 py-8 border-b border-slate-200"
                    >
                        <p className="sm:col-span-1 font-mono text-xs tracking-widest text-vega-claret-deep">
                            {String(i + 1).padStart(2, '0')}
                        </p>
                        <h3 className="sm:col-span-4 font-vega text-xl font-semibold text-slate-900 leading-snug">
                            {a.title}
                        </h3>
                        <p className="sm:col-span-7 text-sm leading-[1.7] text-slate-600">
                            {a.body}
                        </p>
                    </div>
                ))}
            </div>

            {/* The colophon — the trust strip, folded into the record */}
            <p className="font-mono text-2xs tracking-[0.22em] text-slate-400 mt-8 uppercase">
                NDPA 2023 Compliant <span className="text-vega-claret mx-1">·</span> TLS 1.3
                Encrypted <span className="text-vega-claret mx-1">·</span> Data Encrypted at Rest{' '}
                <span className="text-vega-claret mx-1">·</span> 2FA Available
            </p>
        </div>
    </section>
);
