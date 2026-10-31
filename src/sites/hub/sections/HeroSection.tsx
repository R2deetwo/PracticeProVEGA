import React from 'react';
import { ChevronDownIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';
import { SwirlBands } from '../../shared/SwirlBands';

/**
 * HubHero — R50, the full-screen faded hero.
 *
 * Owner direction (Prompt 3, Part 1): the hero's primary image becomes a
 * full-screen, backdrop layer — h/min-h 100dvh, bg-cover bg-center — with
 * a subtle dark gradient overlay (from-slate-950/85 via-slate-900/75 to
 * slate-950) so it sits in the background gracefully while text, badges
 * and primary buttons stay crisp and legible. The same still photograph
 * the owner approved in R46 stays STOPPED — what moves now is the abstract
 * layer behind it: the shared silk-band canvas (SwirlBands), deep navy /
 * dark slate / muted gold at 15–30% opacity, pointer-events-none.
 *
 * Layers, back to front (the brief's exact hierarchy):
 *   z-0  — the swirling canvas.
 *   z-10 — the faded full-screen image + the dark gradient overlay.
 *   z-20 — the hero typography, CTAs and interactive elements.
 *
 * Mobile & desktop (dvh viewport units): the still is full-bleed at EVERY
 * breakpoint, anchored at 72% so the subject sits in the dark right zone, away from the copy column
 * window — the R46 framed panel is retired; the heavy darkening is what
 * keeps the photograph a texture rather than a looming face. The one-time
 * entrance staggers (r42-hero/hero-stagger/r42-card-in) survive; nothing
 * in the hero itself animates after arrival. Reduced-motion users get a
 * static canvas frame (see SwirlBands).
 */
export const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
    onOpenProduct?: (p: 'vega' | 'atrium') => void;
}> = ({ onContactSales, scrollTo, onOpenProduct }) => {
    const openProduct = (p: 'vega' | 'atrium') => {
        if (onOpenProduct) onOpenProduct(p);
        else window.open(p === 'vega' ? '/vega' : '/atrium', '_blank', 'noopener,noreferrer');
    };

    return (
        <section
            id="home"
            className="relative overflow-hidden min-h-[100dvh] flex items-center r42-hero bg-slate-950"
        >
            {/* Layer 0 (z-0) — the silk bands: navy / slate / muted gold at
                15–30% opacity, twisting behind everything. */}
            <div className="absolute inset-0 z-0" aria-hidden="true">
                <SwirlBands variant="hub" />
            </div>

            {/* Layer 1 (z-10) — THE STILL: the workspace photograph, faded.
                Full-bleed at every breakpoint, anchored at 72% so the
                subject stays composed in the cover window; translucent so
                the bands breathe through it. */}
            <img
                src="/assets/landing/hero/ambient-still.jpg"
                alt=""
                aria-hidden="true"
                tabIndex={-1}
                loading="eager"
                decoding="async"
                className="absolute inset-0 z-10 w-full h-full object-cover object-[72%_center] opacity-[0.40] pointer-events-none"
            />

            {/* Layer 2 (z-10, above the still) — the dark gradient overlay:
                the image sits in the background gracefully; the copy stays
                crisp. from-slate-950/85 via-slate-900/75 to-slate-950. */}
            <div
                className="absolute inset-0 z-10 bg-gradient-to-b from-slate-950/85 via-slate-900/75 to-slate-950 pointer-events-none"
                aria-hidden="true"
            />

            {/* Layer 3 (z-20) — the content column, light on dark. */}
            <div className="hero-stagger relative z-20 container mx-auto px-4 sm:px-6 pt-32 pb-28 sm:pt-36 sm:pb-24 w-full">
                <div className="max-w-2xl">
                    {/* Eyebrow badge — glass on the dark ground. */}
                    <p className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/25 bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-8">
                        <span className="inline-flex rounded-full h-2 w-2 bg-emerald-400" aria-hidden="true" />
                        <span className="font-mono text-2xs sm:text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">
                            End-to-End Digital Infrastructure
                        </span>
                    </p>

                    <h1 className="font-display text-[2.4rem] sm:text-5xl md:text-6xl leading-[1.06] tracking-[-0.02em] mb-7 text-white">
                        We design, build, and run custom business solutions.
                    </h1>

                    <p className="text-lg md:text-xl leading-[1.75] text-slate-300 mb-10 max-w-xl">
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
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm text-white bg-white/10 backdrop-blur-sm border border-white/20 hover:border-white/40 hover:bg-white/20 transition-all duration-300 active:scale-[0.97]"
                        >
                            See what we&apos;ve built
                        </Button>
                    </div>

                    {/* Mobile/stacked anchor for the featured solutions —
                        the same card the desktop view floats bottom-right.
                        R50: dark glass on the dark hero. */}
                    <div className="mt-10 lg:hidden r42-card-in">
                        <FeaturedSolutionsCard onOpenProduct={openProduct} onExplore={() => scrollTo('ourWork')} />
                    </div>
                </div>
            </div>

            {/* Floating featured-solutions card — anchored bottom-right of
                the hero (desktop). R44: OUR products, correctly named;
                R45: the slimmer 330px form factor; R50: dark glass. */}
            <div className="hidden lg:block absolute bottom-10 right-6 xl:right-10 z-20 w-[330px] r42-card-in">
                <FeaturedSolutionsCard onOpenProduct={openProduct} onExplore={() => scrollTo('ourWork')} />
            </div>

            {/* Scroll cue — it rests (no bob); light enough on the dark. */}
            <Button
                variant="bare"
                onClick={() => scrollTo('whatWeDo')}
                aria-label="Scroll to what we do"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 p-2 text-slate-400 hover:text-emerald-300 transition-colors"
            >
                <ChevronDownIcon className="w-6 h-6" />
            </Button>
        </section>
    );
};

/** The featured solutions — Vega and Atrium, in their own names (R44).
 * R45: the slimmer form factor (330px, one quiet line per product).
 * R50: dark glass — translucent white on the dark hero, the marks carry
 * the colour. Each row opens ITS page (new tab); Explore scrolls to
 * Our Work. */
const FeaturedSolutionsCard: React.FC<{
    onOpenProduct: (p: 'vega' | 'atrium') => void;
    onExplore: () => void;
}> = ({ onOpenProduct, onExplore }) => (
    <div className="bg-slate-950/60 backdrop-blur-md rounded-lg shadow-lg shadow-black/30 border border-white/15 overflow-hidden transition-all duration-300">
        <div className="px-5 pt-4 pb-3">
            <p className="font-mono text-2xs font-medium uppercase tracking-[0.22em] text-emerald-300 mb-2.5">
                Featured Solutions
            </p>
            <div className="space-y-1.5">
                <button
                    type="button"
                    onClick={() => onOpenProduct('vega')}
                    className="group w-full text-left flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99]"
                    aria-label="Vega — the legal practice operating system. Opens the Vega page."
                >
                    <VegaMark className="w-6 h-6 flex-shrink-0" />
                    <span className="min-w-0">
                        <span className="flex items-baseline gap-1.5">
                            <span className="font-display text-[15px] font-semibold text-white">Vega</span>
                            <span className="font-mono text-2xs uppercase tracking-widest text-emerald-300">Legal Practice OS</span>
                        </span>
                        <span className="block text-[13px] leading-[1.45] text-slate-300">
                            Matters, drafting, court-rule diaries and billing for law firms.
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => onOpenProduct('atrium')}
                    className="group w-full text-left flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.99]"
                    aria-label="Atrium — the property management operating system. Opens the Atrium page."
                >
                    <AtriumMark className="w-6 h-6 flex-shrink-0" />
                    <span className="min-w-0">
                        <span className="flex items-baseline gap-1.5">
                            <span className="font-display text-[15px] font-semibold text-white">Atrium</span>
                            <span className="font-mono text-2xs uppercase tracking-widest text-emerald-300">Property Management OS</span>
                        </span>
                        <span className="block text-[13px] leading-[1.45] text-slate-300">
                            Estates, tenants, rent and receipts in one well-kept system.
                        </span>
                    </span>
                </button>
            </div>
        </div>
        <button
            type="button"
            onClick={onExplore}
            className="group w-full flex items-center justify-between px-5 py-2.5 border-t border-white/10 bg-white/5 hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 active:scale-[0.99]"
            aria-label="Explore both products — scroll to Our Work"
        >
            <span className="text-[13px] font-semibold text-emerald-300">Explore both products</span>
            <span className="text-emerald-300 group-hover:translate-y-0.5 transition-transform" aria-hidden="true">↓</span>
        </button>
    </div>
);
