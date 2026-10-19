import React from 'react';

/**
 * AtriumFinalCTA — /atrium's own closing band ("The Terracotta Estate",
 * R32).
 *
 * No dark bands: the close is the warmest sand panel on the page, warm
 * ink headline in Bricolage, clay capsule primary, ink-outline secondary
 * — radius discipline holds to the last frame (the old rounded-sm CTAs
 * were Vega-adjacent squareness). The estate stays well-lit to the end.
 * Kowalski press physics; NO hover:scale (the R30 law).
 */

export const AtriumFinalCTA: React.FC<{ onSignup: () => void; onContactSales: () => void }> = ({ onSignup, onContactSales }) => {
    return (
        <section
            className="py-20 md:py-28"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
                <p className="font-mono text-2xs font-bold uppercase tracking-[0.3em] text-atrium-clay mb-5">
                    The estate starts here
                </p>
                <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-atrium-ink">
                    Keep your estate well-run.
                </h2>
                <p className="text-lg mt-4 max-w-2xl mx-auto text-slate-600">
                    Join Nigerian property managers who run rent collection, resident portals and
                    revenue intelligence on Atrium — one system, built for portfolios that scale.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    {/* TASK 54: no-arg invocation — never leak the click event
                        into the product override. */}
                    <button
                        onClick={() => onSignup()}
                        className="px-8 py-4 rounded-full font-semibold transition-all duration-150 active:scale-[0.98] bg-atrium-clay text-white hover:bg-atrium-clay-bright shadow-lg shadow-atrium-clay/20"
                    >
                        Start Free Trial
                    </button>
                    <button
                        onClick={onContactSales}
                        className="px-8 py-4 rounded-full font-semibold transition-all duration-150 active:scale-[0.98] bg-transparent border-2 border-atrium-ink/60 text-atrium-ink hover:bg-atrium-ink/5"
                    >
                        Talk to Sales
                    </button>
                </div>
                <p className="text-sm mt-6 text-slate-500">
                    No credit card · 30-day trial · Cancel anytime
                </p>
            </div>
        </section>
    );
};
