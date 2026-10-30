import React, { useEffect, useRef } from 'react';
import { ChevronDownIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';

/**
 * HubHero — R45, the ambient workspace, quietly alone.
 *
 * Owner direction (R45): the internet-map clusters are GONE ("get rid
 * of the internet clusters") and the ambient image must not glitch —
 * the loop is re-encoded as one smooth single-pass Ken Burns (see
 * scripts/r45-ambient-video.sh: subpixel-stepped at 1920 wide, CRF 18,
 * stillimage tune — no more macroblock swimming, no double encode).
 * What remains is exactly the R44 brief the owner loved: "a video that
 * fills that background landing page" — a Nigerian professional at his
 * laptop — with the featured-solutions card, now SLIMMER, telling OUR
 * product story and exploring DOWN to the products on this page.
 *
 * Layers, back to front:
 *   0. The paper ground (never transparent to the body).
 *   1. THE AMBIENT VIDEO — 24s seamless Ken Burns loop (1920 wide,
 *      high-bitrate). Muted, looping, inline; paused under
 *      prefers-reduced-motion and when the hero is offscreen; the
 *      poster frame is the fallback.
 *   2. A paper wash over the video — strong on the left (the ink copy
 *      stays crisp), letting the workspace breathe on the right.
 *   3. The left legibility gradient + the content column.
 *
 * Typography stays the site's own system throughout (owner, R44: "let's
 * ensure the font still matches across"): Space Grotesk display for the
 * H1 (font-display), Figtree for body (font-sans default), IBM Plex
 * Mono for the eyebrow/badge labels (font-mono) — the same stacks every
 * other section wears. Copy is the R42 owner-supplied brief, kept.
 */
export const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
    onOpenProduct?: (p: 'vega' | 'atrium') => void;
}> = ({ onContactSales, scrollTo, onOpenProduct }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Ambient video etiquette: never autoplay under reduced motion; pause
    // when the hero leaves the viewport (the poster stays); resume on
    // return. Errors (no codec / blocked) fall back to the poster frame.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) { video.pause(); return; }
        const io = new IntersectionObserver((entries) => {
            const visible = entries.some((en) => en.isIntersecting);
            if (visible && video.paused) video.play().catch(() => {});
            else if (!visible && !video.paused) video.pause();
        }, { threshold: 0 });
        io.observe(video);
        return () => io.disconnect();
    }, []);

    const openProduct = (p: 'vega' | 'atrium') => {
        if (onOpenProduct) onOpenProduct(p);
        else window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer');
    };

    return (
        <section
            id="home"
            className="relative overflow-hidden min-h-[92vh] flex items-center r42-hero"
        >
            {/* Layer 0 — the paper ground */}
            <div className="absolute inset-0 bg-[#FBFBF9]" aria-hidden="true" />

            {/* Layer 0.5 — the ambient workspace video (a Nigerian
                professional at his laptop; 24s seamless loop). R45: on
                phones the 16:9 frame crops to ~21% of its width — the
                default centre window slices the subject's face at the
                crop edge through the zoom cycle. Small screens anchor the
                window at 58% (chosen by frame-extract test at both ends
                of the zoom: face, typing hand and laptop stay composed
                inside the crop); sm and up re-centre (the frame is wide
                enough to hold it all). */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover object-[58%_center] sm:object-center"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/assets/landing/hero/ambient-poster.jpg"
                aria-hidden="true"
                tabIndex={-1}
            >
                <source src="/assets/landing/hero/ambient-loop.mp4" type="video/mp4" />
            </video>

            {/* Layer 1 — the paper wash: the left column stays crisp ink,
                the workspace breathes on the right. */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FBFBF9]/95 via-[#FBFBF9]/80 to-[#FBFBF9]/45 pointer-events-none" aria-hidden="true" />
            {/* A soft top wash keeps the floating nav pill glassy. */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#FBFBF9]/80 to-transparent pointer-events-none" aria-hidden="true" />

            {/* Layer 3 — legibility wash under the copy column. */}
            <div className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-[#FBFBF9]/70 via-[#FBFBF9]/40 to-transparent pointer-events-none" aria-hidden="true" />

            {/* Content — left-aligned, one column, generous air. pb-24 on
                mobile clears the chat FAB (bottom-24 = 96px). */}
            <div className="hero-stagger relative z-10 container mx-auto px-4 sm:px-6 pt-32 pb-28 sm:pt-36 sm:pb-24 w-full">
                <div className="max-w-2xl">
                    {/* Eyebrow badge */}
                    <p className="inline-flex items-center gap-2.5 rounded-full border border-emerald-600/20 bg-white/70 backdrop-blur-sm px-4 py-1.5 mb-8">
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="font-mono text-2xs sm:text-xs font-medium uppercase tracking-[0.22em] text-emerald-800">
                            End-to-End Digital Infrastructure
                        </span>
                    </p>

                    <h1 className="font-display text-[2.4rem] sm:text-5xl md:text-6xl leading-[1.06] tracking-[-0.02em] mb-7 text-slate-900">
                        We design, build, and run custom business solutions.
                    </h1>

                    <p className="text-lg md:text-xl leading-[1.75] text-slate-700 mb-10 max-w-xl">
                        From custom software and system integrations to domain management and
                        operational tech—we build and manage the complete digital foundation
                        your business needs.
                    </p>

                    {/* CTAs — the one conversation + the work, both honest. */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-600/30 hover:shadow-[0_0_44px_-8px_rgba(5,150,105,0.65)] transition-all duration-300 active:scale-[0.97]"
                        >
                            Talk to Us <span aria-hidden="true">→</span>
                        </Button>
                        <Button
                            variant="bare"
                            onClick={() => scrollTo('ourWork')}
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm text-slate-700 bg-white/70 backdrop-blur-sm border border-slate-300/80 hover:border-slate-400 hover:bg-white transition-all duration-300 active:scale-[0.97]"
                        >
                            See what we&apos;ve built
                        </Button>
                    </div>

                    {/* Mobile/stacked anchor for the featured solutions —
                        the same card the desktop view floats bottom-right. */}
                    <div className="mt-12 lg:hidden r42-card-in">
                        <FeaturedSolutionsCard onOpenProduct={openProduct} onExplore={() => scrollTo('ourWork')} />
                    </div>
                </div>
            </div>

            {/* Floating featured-solutions card — anchored bottom-right of
                the hero (desktop). R44: OUR products, correctly named;
                Explore scrolls DOWN to the products. R45: a SLIMMER form
                factor — 330px, tighter air, one quiet line per product. */}
            <div className="hidden lg:block absolute bottom-10 right-6 xl:right-10 z-10 w-[330px] r42-card-in">
                <FeaturedSolutionsCard onOpenProduct={openProduct} onExplore={() => scrollTo('ourWork')} />
            </div>

            {/* Scroll cue — invites the descent into the story. */}
            <Button
                variant="bare"
                onClick={() => scrollTo('whatWeDo')}
                aria-label="Scroll to what we do"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 p-2 text-slate-400 hover:text-emerald-700 transition-colors w7-scroll-cue"
            >
                <ChevronDownIcon className="w-6 h-6" />
            </Button>
        </section>
    );
};

/** The featured solutions — Vega and Atrium, in their own names (R44:
 *  the owner: "there's Vega and there's Atrium... I don't think that's
 *  what it's called, and if you click on Explore it should take you
 *  down to products"). R45: a SLIMMER form factor (the owner: "ensure
 *  the featured solutions have a slimmer form factor") — 330px wide,
 *  tighter air, smaller marks, one quiet line per product, a thin
 *  Explore rail. Each product row opens ITS page (new tab, R21 routing
 *  keep); the Explore affordance scrolls to Our Work — the products
 *  live on this page. */
const FeaturedSolutionsCard: React.FC<{
    onOpenProduct: (p: 'vega' | 'atrium') => void;
    onExplore: () => void;
}> = ({ onOpenProduct, onExplore }) => (
    <div className="bg-white/90 backdrop-blur-md rounded-lg shadow-lg shadow-slate-900/10 border border-slate-100 overflow-hidden transition-all duration-300">
        <div className="px-5 pt-4 pb-3">
            <p className="font-mono text-2xs font-medium uppercase tracking-[0.22em] text-emerald-700 mb-2.5">
                Featured Solutions
            </p>
            <div className="space-y-1.5">
                <button
                    type="button"
                    onClick={() => onOpenProduct('vega')}
                    className="group w-full text-left flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-emerald-50/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.99]"
                    aria-label="Vega — the legal practice operating system. Opens the Vega page."
                >
                    <VegaMark className="w-6 h-6 flex-shrink-0" />
                    <span className="min-w-0">
                        <span className="flex items-baseline gap-1.5">
                            <span className="font-display text-[15px] font-semibold text-slate-900">Vega</span>
                            <span className="font-mono text-2xs uppercase tracking-widest text-emerald-700">Legal Practice OS</span>
                        </span>
                        <span className="block text-[13px] leading-[1.45] text-slate-600">
                            Matters, drafting, court-rule diaries and billing for law firms.
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onOpenProduct('atrium')}
                    className="group w-full text-left flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-emerald-50/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 active:scale-[0.99]"
                    aria-label="Atrium — the property management operating system. Opens the Atrium page."
                >
                    <AtriumMark className="w-6 h-6 flex-shrink-0" />
                    <span className="min-w-0">
                        <span className="flex items-baseline gap-1.5">
                            <span className="font-display text-[15px] font-semibold text-slate-900">Atrium</span>
                            <span className="font-mono text-2xs uppercase tracking-widest text-emerald-700">Property Management OS</span>
                        </span>
                        <span className="block text-[13px] leading-[1.45] text-slate-600">
                            Estates, tenants, rent and receipts in one well-kept system.
                        </span>
                    </span>
                </button>
            </div>
        </div>
        <button
            type="button"
            onClick={onExplore}
            className="group w-full flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50/80 hover:bg-emerald-50/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 active:scale-[0.99]"
            aria-label="Explore both products — scroll to Our Work"
        >
            <span className="text-[13px] font-semibold text-emerald-800">Explore both products</span>
            <span className="text-emerald-700 group-hover:translate-y-0.5 transition-transform" aria-hidden="true">↓</span>
        </button>
    </div>
);
