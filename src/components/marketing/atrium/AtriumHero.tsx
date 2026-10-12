import React from 'react';

/**
 * AtriumHero — "The Well-Kept Estate" photography-led hero for /atrium.
 *
 * The opposite of Vega's title page: a full-width warm photograph of a
 * Nigerian residential estate at golden hour, with the headline and CTA
 * composed ON the image (a photographic scrim, never text gradients).
 * Beneath it the page breathes — cream surfaces, sage breaks, no hairlines.
 *
 * Voice: geometric sans (Space Grotesk display) — notices, receipts and
 * ledgers, never legalistic. Emerald as the single accent; no amber,
 * no moss green, no gradient text.
 *
 * Presentational only — CTAs arrive as nodes from LandingPage (ADR-0004:
 * zero raw form elements). The eyebrow string is pinned in
 * LandingPage.tsx and passed via prop.
 */

export const AtriumHero: React.FC<{
    /** Pinned attribution string — owned by LandingPage.tsx. */
    eyebrow: string;
    /** CTA nodes (Atrium: emerald primary + warm-neutral ghost). */
    cta: React.ReactNode;
}> = ({ eyebrow, cta }) => {
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    return (
        <section id="home" className="relative">
            {/* Full-bleed golden-hour photograph */}
            <div className="relative min-h-[92vh] md:min-h-[88vh] lg:min-h-[92vh] flex items-end">
                <img
                    src={`/assets/landing/atrium-estate-hero.jpg?v=${buildSha}`}
                    alt="A well-kept Nigerian residential estate at golden hour — palm-lined courtyard and warm low-rise blocks"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                />
                {/* Photographic scrim — legibility treatment, not decoration */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(to top, rgba(20, 24, 18, 0.82) 0%, rgba(20, 24, 18, 0.45) 38%, rgba(20, 24, 18, 0.12) 70%, rgba(20, 24, 18, 0.18) 100%)',
                    }}
                    aria-hidden="true"
                />

                {/* Headline composed ON the image */}
                <div className="relative z-10 container mx-auto px-4 sm:px-6 pt-36 pb-24 md:pb-28">
                    <div className="max-w-2xl">
                        {/* Attribution eyebrow — the register of a notice board */}
                        <p className="text-2xs sm:text-xs font-bold uppercase tracking-[0.3em] text-emerald-300 mb-6">
                            {eyebrow}
                        </p>
                        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.12] text-white mb-6">
                            Revenue Monitor for{' '}
                            <span className="text-emerald-300">Property Managers</span>
                        </h1>
                        <p className="text-lg leading-[1.7] text-white/85 max-w-xl mb-10">
                            Rent and service-charge collection, a residents&rsquo; portal, maintenance
                            workflows, and revenue intelligence — built for Nigerian property
                            portfolios, at home or from abroad.
                        </p>

                        {/* CTAs — hidden on mobile (MobileStickyCTA carries them) */}
                        <div className="hidden md:flex items-center gap-4">{cta}</div>
                    </div>
                </div>
            </div>

            {/* Asymmetric editorial strip beneath the photo — the estate's
                notice board: two quiet facts, warm paper sliding over the
                photograph's bottom edge. */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
                <div className="-mt-14 md:-mt-16 max-w-3xl rounded-2xl bg-white/95 backdrop-blur-sm border border-white/60 shadow-elevation-2 p-6 md:p-8 flex flex-col sm:flex-row gap-6 sm:gap-10 sm:items-center">
                    <div className="flex-1">
                        <p className="font-mono nums-tabular text-2xl md:text-3xl font-semibold text-atrium-emerald">
                            98.2%
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                            typical first-month collection rate on estates that move to Atrium
                        </p>
                    </div>
                    <div className="w-px self-stretch bg-slate-200 hidden sm:block" aria-hidden="true" />
                    <div className="flex-1">
                        <p className="font-mono nums-tabular text-2xl md:text-3xl font-semibold text-atrium-emerald">
                            36 + FCT
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                            states whose tenancy laws Atrium applies, property by property
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
