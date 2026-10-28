import React from 'react';

/**
 * VegaCredentials — /vega's replacement for the shared "Why run on"
 * icon-card section (+ the shared trust-badge strip).
 *
 * "The Night Chambers" register: the firm's credentials read as
 * ATTESTATIONS — full-width ruled rows with mono numerals and serif
 * titles on the night ground, no icon chips, no cards. The trust badges
 * (NDPA 2023, TLS 1.3, encryption at rest) that the shared strip
 * carried are folded into the section's mono colophon line — one strip
 * of record, not three chips.
 *
 * R33 (owner: "you have started removing human beings from the sites …
 * we need to do a personalization so we are selling to real people"):
 * the band carries the practice's face again — portraits of counsel in
 * chambers beside the attestations. It continues the hero's story (the
 * practitioner ALOA was speaking with): the evening exchange ends, the
 * file is drafted, the deadlines are diarised, and counsel keeps the
 * evening. R39 (owner: "two images — no whitespace"): the right column
 * carries BOTH frames of that evening — the file reviewed with the
 * associate, and the chambers at dusk — a two-image stack where the
 * single tall portrait used to leave the column breathing empty. A
 * vignette in the page's own voice — no invented star ratings, no
 * fabricated quotes.
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

export const VegaCredentials: React.FC = () => {
    // R33: cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    return (
    <section
        aria-labelledby="vega-credentials-heading"
        className="py-20 md:py-28"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
            {/* Roman-numeral hairline section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                VI — Credentials
            </p>
            <h2
                id="vega-credentials-heading"
                className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
            >
                Why firms run on Vega
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                How Vega helps Nigerian law firms stay on top of matters,
                drafts, and billable work.
            </p>

            <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
                {/* The attestations — ruled rows, no cards, no icons */}
                <div className="lg:col-span-7 border-t border-vega-night/10">
                    {ATTESTATIONS.map((a, i) => (
                        <div
                            key={a.title}
                            className="grid sm:grid-cols-12 gap-2 sm:gap-6 py-8 border-b border-vega-night/10"
                        >
                            <p className="sm:col-span-1 font-mono text-xs tracking-widest text-vega-gilt-bright">
                                {String(i + 1).padStart(2, '0')}
                            </p>
                            <h3 className="sm:col-span-4 font-vega text-xl font-semibold text-vega-night leading-snug">
                                {a.title}
                            </h3>
                            <p className="sm:col-span-7 text-sm leading-[1.7] text-slate-700">
                                {a.body}
                            </p>
                        </div>
                    ))}
                </div>

                {/* R33 + R39: the practice's face, in TWO frames — the
                    hero's evening exchange, closed: the review with the
                    associate, then chambers at dusk. The stack fills the
                    column the single portrait used to leave empty. */}
                <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
                    <figure>
                        <div className="relative rounded-2xl overflow-hidden border border-vega-night/12 shadow-[0_18px_36px_-20px_rgb(42_33_24/0.35)]">
                            <img
                                src={`/assets/landing/vega-hero-2.jpg?v=${buildSha}`}
                                alt="Counsel and her associate reviewing the file together in the law library"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-[220px] sm:h-[240px] object-cover"
                            />
                            {/* Espresso scrim — the caption composed ON the
                                photograph, the Atrium hero's legibility
                                treatment in Vega's ground. */}
                            <div
                                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#22170F]/95 via-[#22170F]/45 to-transparent p-5 pt-16"
                                aria-hidden="true"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-5">
                                <p className="font-mono text-2xs tracking-[0.25em] text-vega-claret-bright mb-2">
                                    THE FILE, REVIEWED — 4:20 PM
                                </p>
                                <p className="font-vega text-lg text-vega-parchment leading-snug">
                                    Counsel and associate, before the Registry closes.
                                </p>
                            </div>
                        </div>
                    </figure>
                    <figure>
                        <div className="relative rounded-2xl overflow-hidden border border-vega-night/12 shadow-[0_18px_36px_-20px_rgb(42_33_24/0.35)]">
                            <img
                                src={`/assets/landing/people/vega-counsel.jpg?v=${buildSha}`}
                                alt="Counsel reviewing a document in warm lamplight in her chambers at dusk"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-[260px] sm:h-[300px] object-cover"
                            />
                            {/* Espresso scrim — the caption composed ON the
                                photograph, the Atrium hero's legibility
                                treatment in Vega's ground. */}
                            <div
                                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#22170F]/95 via-[#22170F]/45 to-transparent p-6 pt-20"
                                aria-hidden="true"
                            />
                            <div className="absolute inset-x-0 bottom-0 p-6">
                                <p className="font-mono text-2xs tracking-[0.25em] text-vega-claret-bright mb-2">
                                    IN CHAMBERS, IKEJA — 6:40 PM
                                </p>
                                <p className="font-vega text-xl text-vega-parchment leading-snug">
                                    The draft is filed, the deadlines diarised.
                                    The practice keeps its evening.
                                </p>
                            </div>
                        </div>
                        <figcaption className="font-mono text-2xs tracking-[0.18em] text-slate-600 mt-4 uppercase">
                            Built for the practitioner behind the file — the same counsel ALOA
                            was drafting with at the top of this page
                        </figcaption>
                    </figure>
                </div>
            </div>

            {/* The colophon — the trust strip, folded into the record */}
            <p className="font-mono text-2xs tracking-[0.22em] text-slate-600 mt-8 uppercase">
                NDPA 2023 Compliant <span className="text-vega-gilt-bright mx-1">·</span> TLS 1.3
                Encrypted <span className="text-vega-gilt-bright mx-1">·</span> Data Encrypted at Rest{' '}
                <span className="text-vega-gilt-bright mx-1">·</span> 2FA Available
            </p>
        </div>
    </section>
    );
};
