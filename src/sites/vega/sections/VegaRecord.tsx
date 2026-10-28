import React from 'react';
import VegaScalesScene from '../scenes/VegaScalesScene';

/**
 * VegaRecord — /vega's trust band: THE BALANCE & THE RECORD.
 *
 * The band's verifiable figures were already the honest-claims discipline
 * (no vanity metrics, no invented counts). Its certifying body is the
 * practice's own instrument — the scales, drafted in pure geometry: a
 * hairline beam on a pyramid fulcrum, pans hanging level, a plumb line
 * through the pivot, dark-bronze gimbal rings precessing around it all.
 * The beam runs on a damped spring — it weighs the pointer, overshoots
 * once, and settles back to equilibrium. The Balance answers "says who?";
 * the figures answer "show me."
 *
 * Every figure is verifiable in the running product or the platform's
 * published terms. Presentational only — zero buttons (ADR-0004), zero
 * hardcoded component hexes (the scene's WebGL constants are engine
 * values, like MorphScene's).
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
        className="py-20 md:py-28 border-t border-vega-night/10 overflow-hidden"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 lg:items-center">
                {/* Left — THE BALANCE: the practice's instrument. The
                    beam weighs the pointer and settles to equilibrium,
                    inside a slowly rotating certification ring. */}
                <div className="lg:col-span-5 order-last lg:order-first" data-vg-reveal>
                    <div className="relative mx-auto w-full max-w-[440px] aspect-square">
                        {/* The certification ring — a mono micro-caption
                            circling the instrument, the notary's stamp. */}
                        <svg
                            viewBox="0 0 400 400"
                            className="vg-cert-ring absolute inset-0 w-full h-full"
                            aria-hidden="true"
                        >
                            <defs>
                                <path
                                    id="vg-cert-ring-path"
                                    d="M200,200 m-176,0 a176,176 0 1,1 352,0 a176,176 0 1,1 -352,0"
                                />
                            </defs>
                            <text
                                fill="rgb(142 38 30 / 0.55)"
                                fontSize="12.5"
                                letterSpacing="3.5"
                                fontFamily="'IBM Plex Mono', monospace"
                            >
                                <textPath href="#vg-cert-ring-path" textLength="1102" lengthAdjust="spacing">
                                    THE CHAMBERS STANDARD · PRACTICE MANAGEMENT FOR NIGERIAN LAW FIRMS · EST. LAGOS · NDPA 2023 · TLS 1.3 ·
                                </textPath>
                            </text>
                        </svg>
                        {/* The instrument (lazy three.js; SVG fallback beneath) */}
                        <VegaScalesScene className="absolute inset-[6%] rounded-2xl" />
                    </div>
                    <p className="font-mono text-2xs tracking-[0.2em] text-slate-500 mt-2 text-center">
                        THE BALANCE — THE PRACTICE&rsquo;S OWN INSTRUMENT, HELD IN EQUILIBRIUM
                    </p>
                </div>

                {/* Right — the record, stated plainly */}
                <div className="lg:col-span-7" data-vg-reveal>
                    {/* Section head */}
                    <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                        The Record — Stated Plainly
                    </p>
                    <h2
                        id="vega-record-heading"
                        className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-2xl text-vega-night"
                    >
                        Trusted on the record,{' '}
                        <span className="font-vega-italic text-vega-gilt-bright">not on vanity.</span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-600 max-w-2xl mb-10 md:mb-12">
                        Every figure below is verifiable in the running product or the
                        platform&rsquo;s published terms. We do not publish counts we cannot
                        defend in a courtroom.
                    </p>

                    {/* The figures (R26) — big outlined numerals, LawPavilion's
                        stats move, now certified by the Balance. */}
                    <div className="border-t border-b border-vega-night/10 grid sm:grid-cols-2">
                        {RECORD.map((r, i) => (
                            <div
                                key={r.figure}
                                className={`py-8 px-5 sm:px-7 ${i < 2 ? 'border-b sm:border-b' : ''} ${
                                    i % 2 === 0 ? 'sm:border-r' : ''
                                } ${i >= 2 ? 'border-b-0' : 'lg:border-b-0'} border-vega-night/10`}
                            >
                                <p className="vg-figure-outline font-vega text-4xl md:text-[2.6rem] font-semibold tracking-tight leading-none mb-4 whitespace-nowrap">
                                    {r.figure}
                                </p>
                                <p className="font-mono text-2xs tracking-[0.18em] text-vega-night/90 mb-3">
                                    {r.label}
                                </p>
                                <p className="text-sm leading-[1.7] text-slate-600">{r.note}</p>
                            </div>
                        ))}
                    </div>

                    <p className="font-mono text-2xs tracking-widest text-slate-600 mt-6 uppercase">
                        Verified against the live platform · TLS 1.3 · EST. Lagos
                    </p>
                </div>
            </div>
        </div>
    </section>
);
