import React from 'react';
import { ChevronDownIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import MorphScene from '../scenes/MorphScene';

/**
 * HubHero — the W18 cinematic hero, restored (hub-revert-rubbish task).
 *
 * The owner's verdict on the Phase C diorama ("One order, start to finish"):
 * "particularly rubbish and not well done". This reverts the hero to the
 * pre-diorama state: the LIVING ORB (MorphScene, W8→W14) full-bleed behind
 * centred text — the presentation the owner originally asked to restore —
 * while keeping the honest plain-language copy from Phase C (C3) and its
 * two CTAs. The diorama file is deleted; its stage captions, progress
 * dots and aspect-box are gone with it.
 *
 * Kept from Phase C (owner-approved content, no complaint):
 *   - C3 copy: "Your orders, payments and customers, finally in one place."
 *     + the Lagos line (Vega / Atrium / custom systems, 21 words).
 *   - CTAs: "Talk to us" (drawer) + "See what we've built" (scrolls to work).
 *   - The emerald breath blobs, vignette and grain stage furniture.
 *
 * Restored from W18 (the part the owner actually liked):
 *   - The living lattice full-bleed (absolute inset-0) behind centred text
 *     — with its structural CSS fallback (w8-lattice-fallback) and one
 *     slow settle (w8-scene-enter).
 *   - Centred, text-only column (flex items-center text-center) — the orb
 *     is the stage, the copy floats above it under the headline shadow.
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
            {/* Layer 1 — the living lattice (WebGL; a structural CSS fallback
                sits behind it), arriving with one slow settle. */}
            <div className="absolute inset-0 w8-lattice-fallback" aria-hidden="true" />
            <div className="absolute inset-0 w8-scene-enter" aria-hidden="true">
                <MorphScene className="absolute inset-0" />
            </div>
            {/* Layer 2 — vignette + grain so the headline always reads */}
            <div className="absolute inset-0 w7-vignette pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            {/* pb-24 on mobile clears the chat FAB (bottom-24 = 96px). */}
            <div className="hero-stagger relative z-10 container mx-auto px-4 sm:px-6 pt-28 pb-24 sm:pt-32 sm:pb-20 flex flex-col items-center text-center">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] mb-6 text-emerald-400/90">
                    We design, build &amp; run business software
                </p>

                <h1 className="font-display text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[4.5rem] leading-[1.08] mb-7 max-w-3xl mx-auto text-white w7-headline-shadow tracking-tight">
                    Your orders, payments and customers, finally in one place.
                </h1>

                <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-[1.75] text-slate-300/95">
                    We build business software in Lagos: Vega for law firms, Atrium for property managers, and custom systems for businesses like yours.
                </p>

                {/* CTAs — ui/Button (bare) per ADR-0004. */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
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
