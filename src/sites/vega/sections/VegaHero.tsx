import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaHero — "The Reading Room" hero for /vega (R38–R40).
 *
 * R39 put real people in the right column; R40 (owner direction:
 * "we don't need this border around it — just work with the image
 * itself") strips the exhibit chrome: no frame, no header label, no
 * mono caption. The photographs stand on their own — three real scenes
 * of the practice, crossfading every 6s (reduced-motion holds frame
 * one), with quiet pagination dots. No raw form elements (ADR-0004);
 * reveals stay opt-in [data-vg-reveal].
 */

/** One photograph of the practice at work. */
const HERO_PHOTOS: Array<{
    src: string;
    alt: string;
}> = [
    {
        src: '/assets/landing/vega-hero-2.jpg',
        alt: 'Counsel and an associate reviewing a brief together in a law library',
    },
    {
        src: '/assets/landing/vega-hero-3.jpg',
        alt: 'A solicitor drafting at his desk in chambers, certificates on the wall',
    },
    {
        src: '/assets/landing/vega-hero-1.jpg',
        alt: 'Counsel in robes outside the courthouse after a hearing',
    },
];

export const VegaHero: React.FC<{
    /** Pinned attribution string — owned by the site index. */
    eyebrow: string;
    /** The primary CTA node (Vega-styled button), passed in by the site index. */
    cta: React.ReactNode;
}> = ({ eyebrow, cta }) => {
    // R39: cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    const photos = HERO_PHOTOS.map((p) => ({ ...p, src: `${p.src}?v=${buildSha}` }));

    // The gallery cycles every 6 seconds; reduced-motion holds frame one.
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), 6000);
        return () => clearInterval(t);
    }, [photos.length]);

    return (
        <section id="home" className="relative overflow-hidden vg-grain" style={{ background: 'var(--color-paper)' }}>
            {/* The daylight atmosphere — a whisper of claret behind the exchange,
                a warm breath low-left. A wash, not a lamp. */}
            <div className="vg-hero-bg" aria-hidden="true" />

            {/* The watermark — a seriffed section mark at the edge of sight */}
            <span
                className="vg-watermark hidden lg:block text-[26rem] right-[-3.5rem] top-1/2 -translate-y-1/2"
                aria-hidden="true"
            >
                §
            </span>

            <div className="relative z-10 pt-24 pb-20 sm:pb-20 lg:pt-28 lg:pb-24 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
                    {/* Left — the title page of the volume */}
                    {/* R37 mobile-overflow fix: min-w-0 lets the implicit mobile
                        grid track size to the container instead of the eyebrow's
                        max-content — the column can no longer push past the viewport. */}
                    <div className="lg:col-span-7 min-w-0">
                        {/* Attribution eyebrow — mono micro-label with the claret mark */}
                        <p
                            className="flex flex-wrap items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-6"
                            data-vg-reveal
                        >
                            <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright" aria-hidden="true" />
                            {eyebrow}
                        </p>

                        {/* Headline — law-report scale, THREE lines at 1440. */}
                        <h1
                            className="font-vega text-[2.5rem] sm:text-6xl lg:text-[clamp(2.75rem,6.2vw,5.25rem)] font-semibold leading-[1.04] tracking-[-0.015em] mb-0 text-vega-night"
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

                        {/* Thin claret rule — the page's only accent bar */}
                        <div
                            className="h-px w-24 bg-vega-gilt mt-7 mb-7"
                            aria-hidden="true"
                            data-vg-reveal
                            style={{ '--vg-d': '150ms' } as React.CSSProperties}
                        />

                        {/* Sub-copy — shipped capability copy, verbatim */}
                        <p
                            className="text-base md:text-lg max-w-xl leading-[1.7] text-slate-700 mb-8"
                            data-vg-reveal
                            style={{ '--vg-d': '210ms' } as React.CSSProperties}
                        >
                            Case management, AI-assisted drafting, and billing that respects Nigerian court
                            practice — from intake to judgment, in one workspace.
                        </p>

                        {/* CTA — rendered by the site index. */}
                        <div className="flex flex-wrap items-center gap-4 mb-5" data-vg-reveal style={{ '--vg-d': '280ms' } as React.CSSProperties}>
                            {cta}
                        </div>

                        <p
                            className="font-mono text-2xs tracking-widest text-slate-600"
                            data-vg-reveal
                            style={{ '--vg-d': '340ms' } as React.CSSProperties}
                        >
                            NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                        </p>
                    </div>

                    {/* Right — the practice at work (R39): a cycling
                        gallery of the people Vega is built for. R40: zero
                        chrome — no frame, no grade, no shadow; the
                        photograph stands alone. */}
                    <div className="lg:col-span-5 relative min-w-0" data-vg-reveal style={{ '--vg-d': '200ms' } as React.CSSProperties}>
                        {/* The photographs — crossfading scenes, untreated */}
                        <div className="relative aspect-[4/3]">
                            {photos.map((p, i) => (
                                <img
                                    key={p.src}
                                    src={p.src}
                                    alt={p.alt}
                                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out"
                                    style={{
                                        opacity: i === idx ? 1 : 0,
                                        zIndex: i === idx ? 2 : 1,
                                    }}
                                    loading={i === 0 ? 'eager' : 'lazy'}
                                    decoding="async"
                                />
                            ))}
                        </div>

                        {/* Pagination dots — which scene is up */}
                        <div className="flex gap-2 justify-center items-center pt-4" role="group" aria-label="Hero gallery">
                            {photos.map((p, i) => (
                                <Button
                                    key={p.src}
                                    variant="bare"
                                    onClick={() => setIdx(i)}
                                    aria-label={`View scene ${i + 1} of ${photos.length}`}
                                    aria-pressed={i === idx}
                                    className="p-1.5 flex items-center justify-center focus-visible:ring-vega-gilt"
                                >
                                    <span
                                        className="h-1.5 rounded-full transition-all duration-300 block"
                                        style={{
                                            width: i === idx ? 22 : 7,
                                            backgroundColor: i === idx ? 'var(--color-vega-gilt-bright)' : 'rgb(203 213 225)',
                                        }}
                                    />
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
