import React from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaFinalCTA — /vega's replacement for the shared final-CTA band.
 *
 * "The Night Chambers" register: the close is the COLOPHON — the
 * title page returned to at the end of the volume, on the night ground
 * with the hero's lights mirrored behind it (the bookend). Parchment
 * serif headline, the same thin gilt rule the hero carries, and square
 * CTAs: a brass primary, a gilt-outline ghost. Left-aligned like the
 * hero — not a centered band.
 *
 * R21: the Komplete and bespoke-systems cross-sells were relocated here
 * from the retired rate-card band — the pricing TIERS are gone (owner
 * direction) but these PracticePro offerings stay on the page, restyled
 * as compact rounded cards beneath the colophon (R26).
 *
 * CTAs use the ui/Button primitive (ADR-0004); R26: pill CTAs, orange
 * primary, warm outline ghost.
 */
export const VegaFinalCTA: React.FC<{
    onSignup: (productOverride?: unknown) => void;
    onContactSales: (source: string) => void;
}> = ({ onSignup, onContactSales }) => (
    <section
        aria-labelledby="vega-final-cta-heading"
        className="relative overflow-hidden vg-grain py-20 md:py-28 border-t border-white/10"
        style={{ background: 'var(--color-paper)' }}
    >
        {/* The colophon lights — the hero's glows, mirrored */}
        <div className="vg-cta-bg" aria-hidden="true" />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="max-w-2xl" data-vg-reveal>
                <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright" aria-hidden="true" />
                    The Chambers Standard
                </p>
                <h2
                    id="vega-final-cta-heading"
                    className="font-vega text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.015em] mb-8 text-vega-parchment"
                >
                    Ready to run a{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">sharper practice?</span>
                </h2>
                {/* The hero's gilt rule, returned */}
                <div className="h-px w-24 bg-vega-gilt mb-8" aria-hidden="true" />
                <p className="text-base md:text-lg leading-[1.7] text-slate-300 mb-10">
                    Join Nigerian law firms who have already switched to
                    PracticePro Vega — matter management, AI drafting, and
                    court-rule-aware calendaring built for the way you actually
                    work.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <Button
                        variant="bare"
                        onClick={() => onSignup()}
                        className="rounded-full px-8 py-4 text-base font-bold bg-vega-gilt text-vega-night hover:bg-vega-gilt-bright transition-colors focus-visible:ring-vega-gilt"
                    >
                        Start Free Trial
                    </Button>
                    <Button
                        variant="bare"
                        onClick={() => onContactSales('Final CTA')}
                        className="rounded-full px-8 py-4 text-base font-bold border border-vega-gilt/50 text-vega-gilt-bright hover:bg-vega-gilt/10 transition-colors focus-visible:ring-vega-gilt"
                    >
                        Talk to Sales
                    </Button>
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-500 mt-8">
                    NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                </p>
            </div>

            {/* Ruled cross-sells — relocated from the retired rate-card band.
                Compact, subordinate, in register — night panels with a gilt
                spine. */}
            <div className="mt-16 md:mt-20 grid md:grid-cols-2 gap-5 max-w-4xl" data-vg-reveal style={{ '--vg-d': '120ms' } as React.CSSProperties}>
                <div className="rounded-2xl border border-white/10 border-l-2 border-l-vega-gilt bg-vega-night-2 px-6 py-7 shadow-[0_18px_36px_-18px_rgb(0_0_0/0.45)]">
                    <h3 className="font-vega text-xl font-semibold text-vega-parchment mb-2 tracking-tight">
                        Are you a Real Estate Lawyer?
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-5">
                        Discover <strong className="text-vega-gilt-bright">Komplete</strong> — our specialized, unified workspace designed
                        exclusively for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy
                        portfolios, and track chamber matters from a single secure terminal.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onSignup('unified')}
                        className="rounded-full px-6 py-3 text-sm font-bold bg-vega-gilt text-vega-night hover:bg-vega-gilt-bright transition-colors focus-visible:ring-vega-gilt"
                    >
                        Explore Komplete
                    </Button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-vega-night-2 px-6 py-7 shadow-[0_18px_36px_-18px_rgb(0_0_0/0.45)]">
                    <h3 className="font-vega text-xl font-semibold text-vega-parchment mb-2 tracking-tight">
                        Need Custom Automations or Tailored Management Tools?
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed mb-5">
                        PracticePro develops bespoke operational systems, specialized CRMs, and custom workflow automations tailored
                        to your organization&rsquo;s precise processes. Talk to us about building high-performance management tools
                        engineered around your specific business architecture.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onContactSales('Custom Automation Pipeline')}
                        className="rounded-full px-6 py-3 text-sm font-bold border border-white/25 text-vega-parchment hover:border-vega-gilt hover:text-vega-gilt-bright transition-colors focus-visible:ring-vega-gilt"
                    >
                        Contact Sales
                    </Button>
                </div>
            </div>
        </div>
    </section>
);
