import React from 'react';

/**
 * AtriumSentryPass — the gatehouse moment for /atrium.
 *
 * Photography-led band (the companion piece to the golden-hour hero): a
 * warm photograph of an estate gatehouse, with a small verification
 * exhibit sliding over its corner — a 6-digit pass code being checked at
 * the terminal. Copy is the shipped Sentry Pass feature copy (kept
 * verbatim); the band only art-directs it. Rounded-2xl frames, soft
 * shadows, clay warmth throughout — never a dark section. Presentational
 * only, zero raw form elements.
 */

export const AtriumSentryPass: React.FC = () => {
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    return (
        <section
            aria-labelledby="atrium-sentry-heading"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    {/* Left — the photograph, framed warm */}
                    <div className="lg:col-span-7 order-first">
                        <div className="relative">
                            <div className="rounded-2xl overflow-hidden shadow-elevation-2 border border-white/60">
                                <img
                                    src={`/assets/landing/atrium-gatehouse.jpg?v=${buildSha}`}
                                    alt="An estate gatehouse at a Nigerian residential community — the security terminal where visitor passes are verified"
                                    className="w-full aspect-[16/10] object-cover"
                                    loading="lazy"
                                />
                            </div>

                            {/* Verification exhibit — slides over the photo's corner */}
                            <div
                                className="absolute -bottom-6 right-4 md:-right-6 w-[240px] rounded-2xl bg-white border border-atrium-clay/25 shadow-elevation-2 p-5"
                                aria-label="Exhibit — a Sentry Pass visitor code being verified at the gatehouse terminal"
                            >
                                <p className="font-mono text-2xs uppercase tracking-widest text-slate-400 mb-3">
                                    Gatehouse terminal
                                </p>
                                <p className="font-mono nums-tabular text-2xl font-semibold tracking-[0.2em] text-slate-900">
                                    48 29 17
                                </p>
                                <div className="flex items-center gap-2 mt-3">
                                    <span className="w-2 h-2 rounded-full bg-atrium-clay" aria-hidden="true" />
                                    <p className="font-mono text-2xs font-semibold uppercase tracking-wider text-atrium-clay-deep">
                                        Pass valid · expires 6:00 PM
                                    </p>
                                </div>
                                <p className="font-mono text-2xs tracking-wider text-slate-400 mt-2">
                                    VISITOR · T. ADEYEMI · UNIT B14
                                </p>
                            </div>
                        </div>
                        <p className="font-mono text-2xs tracking-wider text-slate-500 mt-12 md:mt-10">
                            SENTRY PASS — GATEHOUSE VERIFICATION, WITH OFFLINE FALLBACK
                        </p>
                    </div>

                    {/* Right — framing copy (feature copy kept verbatim) */}
                    <div className="lg:col-span-5">
                        <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-clay mb-5">
                            Sentry Pass
                        </p>
                        <h2
                            id="atrium-sentry-heading"
                            className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-[1.15] mb-6"
                            style={{ color: 'var(--color-ink)' }}
                        >
                            Every visitor, <span className="text-atrium-clay">expected</span>.
                        </h2>
                        <p className="text-base md:text-lg leading-[1.7] text-slate-600 mb-8">
                            Generate 6-digit visitor access codes for guests, contractors, and delivery
                            personnel. Gatekeepers verify codes at the security terminal via PIN or QR
                            code scan. Full audit trail with check-in/check-out timestamps. Includes
                            offline fallback for unreliable gatehouse connectivity.
                        </p>
                        <div className="flex flex-wrap gap-6">
                            <div>
                                <p className="font-mono nums-tabular text-2xl font-semibold text-atrium-clay-deep">
                                    100
                                </p>
                                <p className="text-sm text-slate-500 mt-1">visitors cached offline</p>
                            </div>
                            <div>
                                <p className="font-mono nums-tabular text-2xl font-semibold text-atrium-clay-deep">
                                    30 days
                                </p>
                                <p className="text-sm text-slate-500 mt-1">free trial, then &#8358;7,500/mo</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
