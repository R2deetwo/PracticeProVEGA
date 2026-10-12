import React from 'react';
import { Button } from '../../ui';

/**
 * VegaFinalCTA — /vega's replacement for the shared final-CTA band.
 *
 * "The Chambers Standard" register: the close is the COLOPHON — the
 * title page returned to at the end of the volume. Paper ground, serif
 * headline, the same thin amber rule the hero carries (the page's
 * bookend), and square CTAs: an ink primary, an amber-outline ghost.
 * Left-aligned like the hero — not a centered band.
 *
 * Copy is the shipped Vega CTA copy, verbatim. CTAs use the ui/Button
 * primitive (ADR-0004).
 */
export const VegaFinalCTA: React.FC<{
    onSignup: () => void;
    onContactSales: () => void;
}> = ({ onSignup, onContactSales }) => (
    <section
        aria-labelledby="vega-final-cta-heading"
        className="py-20 md:py-28 border-t border-slate-200"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="max-w-2xl">
                <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-amber-deep mb-7">
                    <span className="inline-block w-1.5 h-1.5 bg-vega-amber" aria-hidden="true" />
                    The Chambers Standard
                </p>
                <h2
                    id="vega-final-cta-heading"
                    className="font-vega text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-8"
                    style={{ color: 'var(--color-ink)' }}
                >
                    Ready to run a sharper practice?
                </h2>
                {/* The hero's amber rule, returned */}
                <div className="h-px w-16 bg-vega-amber mb-8" aria-hidden="true" />
                <p className="text-base md:text-lg leading-[1.7] text-slate-600 mb-10">
                    Join Nigerian law firms who have already switched to
                    PracticePro Vega — matter management, AI drafting, and
                    court-rule-aware calendaring built for the way you actually
                    work.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <Button
                        variant="bare"
                        onClick={onSignup}
                        className="px-8 py-4 text-base font-bold bg-vega-ink text-white hover:bg-vega-ink-soft transition-colors focus-visible:ring-vega-amber"
                    >
                        Start Free Trial
                    </Button>
                    <Button
                        variant="bare"
                        onClick={onContactSales}
                        className="px-8 py-4 text-base font-bold border border-vega-amber/60 text-vega-amber-deep hover:bg-vega-amber/10 transition-colors focus-visible:ring-vega-amber"
                    >
                        Talk to Sales
                    </Button>
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-400 mt-8">
                    NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                </p>
            </div>
        </div>
    </section>
);
