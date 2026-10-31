import React, { useState } from 'react';

/**
 * VegaHero — R53: the clean photograph hero.
 *
 * Owner direction (Prompt 4): "I like the Vega website... but I don't
 * know why you've put those lines inside it, and then you didn't even
 * get it right." The R50 silk-line overlay is RETIRED from Vega — the
 * page keeps what the owner likes: the single stable, full-screen
 * faded photograph (counsel and an associate reviewing a brief) behind
 * the matching dark gradient overlay (from-slate-950/80 via-
 * slate-900/70 to-slate-950), with the copy in light on the dark
 * ground. The flowing-bands treatment lives on the PracticePro Systems
 * hero, where the owner asked for it; Vega stays the quiet legal
 * register.
 *
 * The image arrives through a 1s opacity ease
 * (transition-opacity duration-1000 ease-in-out); after that, nothing
 * in the hero moves.
 *
 * Layers: z-10 faded image + dark gradient · z-20 the copy. The copy
 * flips to light on the dark ground — white headline, the gilt accents
 * survive (they were born for this), slate-300 body. The § watermark
 * stays, ghosted white.
 */
export const VegaHero: React.FC<{
    /** Pinned attribution string — owned by the site index. */
    eyebrow: string;
    /** The primary CTA node (Vega-styled button), passed in by the site index. */
    cta: React.ReactNode;
}> = ({ eyebrow, cta }) => {
    // R39: cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();

    // The image arrives through a soft 1s fade (0 → its faded 0.5 value).
    const [imageIn, setImageIn] = useState(false);

    return (
        <section id="home" className="relative overflow-hidden min-h-[100dvh] flex items-center bg-slate-950">
            {/* z-10 — THE STILL: one photograph of the practice, faded.
                Single and stable — the carousel is retired, and the R50
                silk-line layer beneath it is retired with it (the bands
                belong to the hub hero now). */}
            <img
                src={`/assets/landing/vega-hero-2.jpg?v=${buildSha}`}
                alt="Counsel and an associate reviewing a brief together in a law library"
                loading="eager"
                decoding="async"
                onLoad={() => setImageIn(true)}
                className="absolute inset-0 z-10 w-full h-full object-cover object-[62%_center] pointer-events-none transition-opacity duration-1000 ease-in-out"
                style={{ opacity: imageIn ? 0.5 : 0 }}
            />

            {/* z-10 — the matching dark gradient overlay
                (from-slate-950/80 via-slate-900/70 to-slate-950). */}
            <div
                className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-slate-950 pointer-events-none"
                aria-hidden="true"
            />

            {/* z-20 — the title page of the volume, light on dark. */}
            <div className="relative z-20 w-full pt-28 pb-24 lg:pt-32 lg:pb-28 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="max-w-3xl min-w-0">
                        {/* Attribution eyebrow — mono micro-label with the claret mark. */}
                        <p
                            className="flex flex-wrap items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-6"
                            data-vg-reveal
                        >
                            <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright" aria-hidden="true" />
                            {eyebrow}
                        </p>

                        {/* Headline — law-report scale on the dark ground. */}
                        <h1
                            className="font-vega text-[2.5rem] sm:text-6xl lg:text-[clamp(2.75rem,6.2vw,5.25rem)] font-semibold leading-[1.04] tracking-[-0.015em] mb-0 text-white"
                            data-vg-reveal
                            style={{ '--vg-d': '90ms' } as React.CSSProperties}
                        >
                            Practice
                            <br />
                            management for
                            <br />
                            <span className="font-vega-italic text-vega-gilt-bright">
                                Nigerian law firms.
                            </span>
                        </h1>

                        {/* Thin claret rule — the page's only accent bar. */}
                        <div
                            className="h-px w-24 bg-vega-gilt mt-7 mb-7"
                            aria-hidden="true"
                            data-vg-reveal
                            style={{ '--vg-d': '150ms' } as React.CSSProperties}
                        />

                        {/* Sub-copy — R49: Vega ships with DraftPro. */}
                        <p
                            className="text-base md:text-lg max-w-xl leading-[1.7] text-slate-300 mb-8"
                            data-vg-reveal
                            style={{ '--vg-d': '210ms' } as React.CSSProperties}
                        >
                            Case management, billing — and DraftPro™ built in: AI contract
                            analysis for Nigerian commercial practice. Vega reads every
                            commercial agreement, flags the toxic clauses instantly, and
                            redlines them to Nigerian-law-compliant drafts. Hours of review
                            become minutes.
                        </p>

                        {/* CTA — rendered by the site index. */}
                        <div className="flex flex-wrap items-center gap-4 mb-5" data-vg-reveal style={{ '--vg-d': '280ms' } as React.CSSProperties}>
                            {cta}
                        </div>

                        <p
                            className="font-mono text-2xs tracking-widest text-slate-400"
                            data-vg-reveal
                            style={{ '--vg-d': '340ms' } as React.CSSProperties}
                        >
                            NO CREDIT CARD · 30-DAY TRIAL · DRAFTPRO INCLUDED
                        </p>
                    </div>
                </div>
            </div>

            {/* The watermark — a seriffed section mark at the edge of sight,
                ghosted white on the dark ground. */}
            <span
                className="vg-watermark hidden lg:block text-[26rem] right-[-3.5rem] top-1/2 -translate-y-1/2"
                style={{ color: 'rgb(255 255 255 / 0.04)' }}
                aria-hidden="true"
            >
                §
            </span>
        </section>
    );
};
