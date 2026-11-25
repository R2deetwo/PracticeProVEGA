import React from 'react';

/**
 * AtriumFinalCTA — /atrium's own closing band ("The Well-Kept Estate").
 *
 * No dark bands: the close is the warmest sage panel on the page, ink
 * headline, emerald solid primary, ink-outline secondary. The estate
 * stays well-lit to the last frame. The deliberate opposite of Vega's
 * ink colophon.
 *
 * Extracted from the retired shared FinalCTASection (Pass B): atrium
 * branch only, now living in an Atrium-owned file.
 */

export const AtriumFinalCTA: React.FC<{ onSignup: () => void; onContactSales: () => void }> = ({ onSignup, onContactSales }) => {
    return (
        <section
            className="py-20 md:py-28"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
                <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                    Ready to stop managing chaos?
                </h2>
                <p className="text-lg mt-4 max-w-2xl mx-auto text-slate-600">
                    Run a tighter portfolio — start free, decide in 30 days.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    {/* TASK 54: no-arg invocation — never leak the click event
                        into the product override. */}
                    <button
                        onClick={() => onSignup()}
                        className="px-8 py-4 rounded-sm font-semibold hover:scale-[1.02] transition-all shadow-lg bg-atrium-emerald text-white hover:bg-emerald-700"
                    >
                        Get Started
                    </button>
                    <button
                        onClick={onContactSales}
                        className="px-8 py-4 rounded-sm font-semibold transition-all bg-transparent border-2 border-slate-900/70 text-slate-900 hover:bg-slate-900/5"
                    >
                        Talk to Sales
                    </button>
                </div>
                <p className="text-sm mt-6 text-slate-500">
                    No credit card · 30-day trial · Cancel anytime
                </p>
                {/* 2026-11-23 (owner direction): the starting-price anchor
                    (annual-only — no monthly framing, no discounts) and the
                    money-back line surfaced next to the CTA instead of
                    buried in the FAQ. Figure mirrors ATRIUM_TIERS.Core in
                    src/constants/tiers.ts (₦490,000/yr, 10 included units). */}
                <p className="text-sm mt-2 text-slate-500">
                    Portfolios start at ₦490,000/year (up to 10 units) · 30-day money-back guarantee on annual plans
                </p>
            </div>
        </section>
    );
};
