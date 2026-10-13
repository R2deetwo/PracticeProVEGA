import React from 'react';
import { ChevronDownIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import HubScene from '../scenes/HubScene';

/**
 * HubHero — Phase C (the relatable hero).
 *
 * C2: headline + CTAs on the left, the scene on the right (stacked below
 *     the text on mobile). The scene is a grid cell — it can NEVER sit
 *     behind text. Its box reserves its height (aspect ratio) so loading
 *     it causes zero layout shift.
 * C3: plain language. H1: "Your orders, payments and customers, finally in
 *     one place." Sub (25 words max): the Lagos line — Vega for law firms,
 *     Atrium for property managers, custom systems for businesses like
 *     yours. CTAs: "Talk to us" (the drawer) + "See what we've built".
 *
 * The stage keeps the W18 dark ground, grain and vignette; the abstract
 * hero lattice is retired — a polyhedron meant nothing to a shop owner. In
 * its place: one order, start to finish.
 */
export const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
}> = ({ onContactSales, scrollTo }) => {
    return (
        <section id="home" className="relative overflow-hidden min-h-[92vh] flex items-center w7-dark">
            {/* Layer 0 — deep ink base */}
            <div className="absolute inset-0 bg-[#070D18]" aria-hidden="true" />
            {/* Soft emerald breath either side of the stage */}
            <div className="absolute -top-32 right-[8%] w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-[10%] w-[30rem] h-[22rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            {/* Layer 2 — vignette + grain so the headline always reads */}
            <div className="absolute inset-0 w7-vignette pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            {/* pb-24 on mobile clears the chat FAB (bottom-24 = 96px). */}
            <div className="hero-stagger relative z-10 container mx-auto px-4 sm:px-6 pt-28 pb-24 sm:pt-32 sm:pb-20 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center max-w-6xl mx-auto">
                    {/* Text column — the promise, in plain language. */}
                    <div className="text-center lg:text-left">
                        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] mb-6 text-emerald-400/90">
                            We design, build &amp; run business software
                        </p>

                        <h1 className="font-display text-[2.25rem] sm:text-5xl md:text-6xl leading-[1.08] mb-7 max-w-2xl mx-auto lg:mx-0 text-white w7-headline-shadow tracking-tight">
                            Your orders, payments and customers, finally in one place.
                        </h1>

                        <p className="text-lg md:text-xl max-w-xl mx-auto lg:mx-0 mb-10 leading-[1.75] text-slate-300/95">
                            We build business software in Lagos: Vega for law firms, Atrium for property managers, and custom systems for businesses like yours.
                        </p>

                        {/* CTAs — ui/Button (bare) per ADR-0004. */}
                        <div className="flex flex-col sm:flex-row gap-4 sm:justify-start justify-center w-full sm:w-auto">
                            <Button
                                variant="bare"
                                onClick={onContactSales}
                                className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.97]"
                            >
                                Talk to us
                            </Button>
                            <Button
                                variant="bare"
                                onClick={() => scrollTo('ourWork')}
                                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm bg-white/10 text-white border border-white/15 backdrop-blur-sm hover:bg-white/15 hover:border-white/25 transition-all duration-300 active:scale-[0.97]"
                            >
                                See what we&apos;ve built
                            </Button>
                        </div>
                    </div>

                    {/* Scene column — a grid cell, never behind the text. */}
                    <div className="relative w-full max-w-xl mx-auto lg:max-w-none">
                        <HubScene />
                    </div>
                </div>
            </div>

            {/* Scroll cue — invites the descent into the story. */}
            <Button
                variant="bare"
                onClick={() => scrollTo('whatWeDo')}
                aria-label="Scroll to what we do"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 p-2 text-slate-500 hover:text-slate-200 transition-colors w7-scroll-cue"
            >
                <ChevronDownIcon className="w-6 h-6" />
            </Button>

            {/* Bottom fade into the marquee band */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#070D18] pointer-events-none" aria-hidden="true" />
        </section>
    );
};
