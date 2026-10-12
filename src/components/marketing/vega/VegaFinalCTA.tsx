import React from 'react';
import { Button } from '../../ui';

/**
 * VegaFinalCTA — /vega's replacement for the shared final-CTA band.
 *
 * "The Chambers Standard" register: the close is the COLOPHON — the
 * title page returned to at the end of the volume. Paper ground, serif
 * headline, the same thin claret rule the hero carries (the page's
 * bookend), and square CTAs: an ink primary, a claret-outline ghost.
 * Left-aligned like the hero — not a centered band.
 *
 * R21: the Komplete and bespoke-systems cross-sells were relocated here
 * from the retired rate-card section — the pricing TIERS are gone (owner
 * direction) but these PracticePro offerings stay on the page, restyled
 * as compact ruled rows beneath the colophon.
 *
 * CTAs use the ui/Button primitive (ADR-0004).
 */
export const VegaFinalCTA: React.FC<{
    onSignup: (productOverride?: unknown) => void;
    onContactSales: (source: string) => void;
}> = ({ onSignup, onContactSales }) => (
    <section
        aria-labelledby="vega-final-cta-heading"
        className="py-20 md:py-28 border-t border-slate-200"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="max-w-2xl">
                <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-claret-deep mb-7">
                    <span className="inline-block w-1.5 h-1.5 bg-vega-claret" aria-hidden="true" />
                    The Chambers Standard
                </p>
                <h2
                    id="vega-final-cta-heading"
                    className="font-vega text-3xl sm:text-4xl md:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-8"
                    style={{ color: 'var(--color-ink)' }}
                >
                    Ready to run a sharper practice?
                </h2>
                {/* The hero's claret rule, returned */}
                <div className="h-px w-16 bg-vega-claret mb-8" aria-hidden="true" />
                <p className="text-base md:text-lg leading-[1.7] text-slate-600 mb-10">
                    Join Nigerian law firms who have already switched to
                    PracticePro Vega — matter management, AI drafting, and
                    court-rule-aware calendaring built for the way you actually
                    work.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <Button
                        variant="bare"
                        onClick={() => onSignup()}
                        className="px-8 py-4 text-base font-bold bg-vega-ink text-white hover:bg-vega-ink-soft transition-colors focus-visible:ring-vega-claret"
                    >
                        Start Free Trial
                    </Button>
                    <Button
                        variant="bare"
                        onClick={() => onContactSales('Final CTA')}
                        className="px-8 py-4 text-base font-bold border border-vega-claret/60 text-vega-claret-deep hover:bg-vega-claret/10 transition-colors focus-visible:ring-vega-claret"
                    >
                        Talk to Sales
                    </Button>
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-400 mt-8">
                    NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                </p>
            </div>

            {/* Ruled cross-sells — relocated from the retired rate-card band.
                Compact, subordinate, in register. */}
            <div className="mt-16 md:mt-20 grid md:grid-cols-2 gap-5 max-w-4xl">
                <div className="border border-slate-200 border-l-2 border-l-vega-claret bg-white px-6 py-7">
                    <h3 className="font-vega text-xl font-semibold text-slate-900 mb-2 tracking-tight">
                        Are you a Real Estate Lawyer?
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-5">
                        Discover <strong className="text-vega-claret-deep">Komplete</strong> — our specialized, unified workspace designed
                        exclusively for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy
                        portfolios, and track chamber matters from a single secure terminal.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onSignup('unified')}
                        className="px-6 py-3 text-sm font-bold bg-vega-ink text-white hover:bg-vega-ink-soft transition-colors focus-visible:ring-vega-claret"
                    >
                        Explore Komplete
                    </Button>
                </div>
                <div className="border border-slate-200 bg-white px-6 py-7">
                    <h3 className="font-vega text-xl font-semibold text-slate-900 mb-2 tracking-tight">
                        Need Custom Automations or Tailored Management Tools?
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-5">
                        PracticePro develops bespoke operational systems, specialized CRMs, and custom workflow automations tailored
                        to your organization&rsquo;s precise processes. Talk to us about building high-performance management tools
                        engineered around your specific business architecture.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onContactSales('Custom Automation Pipeline')}
                        className="px-6 py-3 text-sm font-bold border border-vega-ink/25 text-vega-ink hover:border-vega-ink hover:bg-vega-ink hover:text-white transition-colors focus-visible:ring-vega-claret"
                    >
                        Contact Sales
                    </Button>
                </div>
            </div>
        </div>
    </section>
);
