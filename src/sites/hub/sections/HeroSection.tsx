import React from 'react';
import { ChevronDownIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import NetworkScene from '../scenes/NetworkScene';

/**
 * HubHero — R42, the glassmorphic daylight hero.
 *
 * Owner direction (R42): move on from the living orb — "something to do
 * with some kind of networking… how systems get connected together…
 * systems sort of coming together to become one process", still
 * interactive and 3D, the mouse having an effect, and nothing plopping
 * onto the screen. Layout brief (owner-supplied, SmartEsq-referenced):
 * a light ambient hero — glassmorphic floating nav, LEFT-aligned
 * headline block with an eyebrow tag, a solid accent-green primary CTA,
 * and a floating featured-solution card anchored bottom-right.
 *
 * The ambient background is the NetworkScene itself (see
 * scenes/NetworkScene.tsx): six system constellations converging into
 * one ringed process, pulses travelling the arcs, pointer parallax +
 * proximity glow + click-to-pulse. A soft paper gradient keeps the ink
 * copy perfectly crisp on the left. The old dark hero furniture
 * (w7-dark, vignette, grain, bottom fade) retired with the orb.
 *
 * Copy is the owner-supplied R42 brief, kept verbatim.
 */
export const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
    onOpenVega?: () => void;
}> = ({ onContactSales, scrollTo, onOpenVega }) => {
    const openVega = () => {
        if (onOpenVega) onOpenVega();
        else window.open('/vega', '_blank', 'noopener,noreferrer');
    };

    return (
        <section
            id="home"
            className="relative overflow-hidden min-h-[92vh] flex items-center r42-hero"
        >
            {/* Layer 0 — the paper ground (matches the page surface) */}
            <div className="absolute inset-0 bg-[#FBFBF9]" aria-hidden="true" />
            {/* Soft ambient washes — calm, high-trust daylight */}
            <div className="absolute -top-24 right-[12%] w-[38rem] h-[26rem] rounded-full bg-emerald-100/50 blur-[120px] pointer-events-none" aria-hidden="true" />
            <div className="absolute bottom-[-6rem] left-[6%] w-[30rem] h-[22rem] rounded-full bg-teal-50/70 blur-[110px] pointer-events-none" aria-hidden="true" />

            {/* Layer 1 — the living network (WebGL; CSS fallback behind it),
                arriving through its own build-in choreography. */}
            <div className="absolute inset-0 r42-net-fallback" aria-hidden="true" />
            <div className="absolute inset-0 w8-scene-enter" aria-hidden="true">
                <NetworkScene className="absolute inset-0" />
            </div>

            {/* Layer 2 — legibility wash: the left column stays crisp ink
                over whatever the field is doing behind it. */}
            <div className="absolute inset-y-0 left-0 w-full lg:w-[62%] bg-gradient-to-r from-[#FBFBF9] via-[#FBFBF9]/85 to-transparent pointer-events-none" aria-hidden="true" />

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

                    <p className="text-lg md:text-xl leading-[1.75] text-slate-600 mb-10 max-w-xl">
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

                    {/* Mobile/stacked anchor for the featured card — the same
                        card the desktop view floats bottom-right. */}
                    <div className="mt-12 lg:hidden r42-card-in">
                        <FeaturedSolutionCard onOpen={openVega} />
                    </div>
                </div>
            </div>

            {/* Floating proof card — anchored bottom-right of the hero,
                overlapping the network field (desktop). */}
            <div className="hidden lg:block absolute bottom-10 right-6 xl:right-10 z-10 w-[380px] r42-card-in">
                <FeaturedSolutionCard onOpen={openVega} />
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

/** The featured-solution card — white, soft-shadowed, clickable through
 *  to the Vega suite (R42 brief: "FEATURED SOLUTION", the Vega Legal &
 *  Property Suite, one honest sentence, an affordance to explore). */
const FeaturedSolutionCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
    <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/15 hover:-translate-y-0.5 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
        aria-label="Featured solution — Vega Legal and Property Suite. Explore the suite."
    >
        <p className="font-mono text-2xs font-medium uppercase tracking-[0.22em] text-emerald-700 mb-3">
            Featured Solution
        </p>
        <h3 className="font-display text-xl font-semibold text-slate-900 leading-snug mb-2">
            Vega Legal &amp; Property Suite
        </h3>
        <p className="text-sm leading-[1.65] text-slate-600 mb-4">
            Discover how custom-built workflow automation and integrated payment
            systems transformed operations.
        </p>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 group-hover:gap-2.5 transition-all">
            Explore the suite
            <span aria-hidden="true">→</span>
        </span>
    </button>
);
