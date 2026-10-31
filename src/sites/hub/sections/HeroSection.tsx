import React from 'react';
import { ChevronDownIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';
import { BandsBackground } from '../../shared/BandsBackground';

/** The hub bands palette (R53): deep navy ground, navy/slate bands,
 * steel-blue bright folds, gilt razor lines — the PracticePro register
 * of the reference look. bg (#050B18) IS the hero's background colour,
 * which is what makes the shader's left fade seamless. */
const HUB_BANDS_PALETTE: [string, string, string, string] = [
    '#050B18', // bg — the hero ground
    '#1B3358', // mid — the navy band body
    '#3D6CA8', // bright — the lit fold
    '#D8B45C', // line — the gilt contour razor
];

/**
 * HubHero — R53, the flowing-bands hero.
 *
 * Owner direction (Prompt 4): "the Practice Pro Systems is not supposed
 * to have the image anymore in the background, it's supposed to have
 * this new thing I wanted to incorporate" — the reference being the
 * silky, fractal, slowly drifting contour bands of bitnomial.com's
 * hero, which the R50 thin-line overlay did not capture ("you can
 * hardly even see it... they're not just supposed to be random
 * lines").
 *
 * So: the photograph is RETIRED, and the flowing bands become the hero
 * itself — a full-bleed WebGL2 shader (BandsBackground →
 * createBandsRenderer, dependency-free) drawing layered contour bands
 * that fold into each other, drifting slowly, with razor-thin gilt
 * lines and a dithered silky gradient. The shader masks the effect to
 * the right side and blends to the ground colour toward the left, so
 * the copy column sits on clean navy and the hero's edge is seamless.
 *
 * Layers, back to front:
 *   z-0  — the flowing-bands canvas (the hero IS the background).
 *   z-20 — the hero typography, CTAs, the featured card, the cue.
 * (No image layer, no gradient overlay — nothing to fade.)
 *
 * The entrance staggers (r42-hero/hero-stagger/r42-card-in) survive.
 * Reduced-motion users get ONE static composition (never animated);
 * without WebGL2 the hero falls back to a quiet navy gradient.
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
            className="relative overflow-hidden min-h-[100dvh] flex items-center r42-hero"
            style={{ background: HUB_BANDS_PALETTE[0] }}
        >
            {/* Layer 0 (z-0) — THE HERO ITSELF: the flowing bands. Full-bleed
                WebGL2 contour field, masked to the right, blending to the
                ground colour under the copy column. The canvas never takes
                pointer events; the shader tracks the pointer through the
                window and warps the field subtly. */}
            <div className="absolute inset-0 z-0" aria-hidden="true">
                <BandsBackground
                    palette={HUB_BANDS_PALETTE}
                    bandCount={9}
                    speed={0.55}
                />
            </div>

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
