import React from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaFinalCTA — /vega's close (R38, daylight edition).
 *
 * The close is the COLOPHON — the title page returned to at the end of
 * the volume, on the ivory ground with the hero's daylight washes
 * mirrored behind it (the bookend). Espresso serif headline, the same
 * thin claret rule the hero carries, and pill CTAs: a claret primary,
 * a hairline ghost. Left-aligned like the hero — not a centered band.
 *
 * R21 (kept): the Komplete and bespoke-systems cross-sells live here,
 * restyled as compact CREAM CARDS on the page's stock (R38) — one with
 * the claret spine — with espresso type and slate body copy, never the
 * old dark panels.
 *
 * CTAs use the ui/Button primitive (ADR-0004).
 */
export const VegaFinalCTA: React.FC<{
    onSignup: (productOverride?: unknown) => void;
    onContactSales: (source: string) => void;
}> = ({ onSignup, onContactSales }) => (
    <section
        aria-labelledby="vega-final-cta-heading"
        className="relative overflow-hidden vg-grain py-20 md:py-28 border-t border-vega-night/10"
        style={{ background: 'var(--color-paper)' }}
    >
        {/* The colophon lights — the hero's daylight washes, mirrored */}
        <div className="vg-cta-bg" aria-hidden="true" />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="max-w-2xl" data-vg-reveal>
                <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright" aria-hidden="true" />
                    The Chambers Standard
                </p>
                <h2
                    id="vega-final-cta-heading"
                    className="font-vega text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.015em] mb-8 text-vega-night"
                >
                    Ready to run a{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">sharper practice?</span>
                </h2>
                {/* The hero's claret rule, returned */}
                <div className="h-px w-24 bg-vega-gilt mb-8" aria-hidden="true" />
                <p className="text-base md:text-lg leading-[1.7] text-slate-700 mb-10">
                    Join Nigerian law firms who have already switched to
                    Vega — matter management, AI drafting, and
                    court-rule-aware calendaring built for the way you actually
                    work.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <Button
                        variant="bare"
                        onClick={() => onSignup()}
                        className="rounded-full px-8 py-4 text-base font-bold bg-vega-gilt text-vega-parchment hover:bg-vega-gilt-bright transition-all duration-150 active:scale-[0.98] focus-visible:ring-vega-gilt"
                    >
                        Start Free Trial
                    </Button>
                    <Button
                        variant="bare"
                        onClick={() => onContactSales('Final CTA')}
                        className="rounded-full px-8 py-4 text-base font-bold border border-vega-night/30 text-vega-night hover:border-vega-gilt-bright hover:text-vega-gilt-bright hover:bg-vega-gilt/[0.05] transition-all duration-150 active:scale-[0.98] focus-visible:ring-vega-gilt"
                    >
                        Talk to Sales
                    </Button>
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-600 mt-8">
                    NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                </p>
            </div>

            {/* Ruled cross-sells — relocated from the retired rate-card band
                (R21). Compact, subordinate, cream stock with a claret spine. */}
            <div className="mt-16 md:mt-20 grid md:grid-cols-2 gap-5 max-w-4xl" data-vg-reveal style={{ '--vg-d': '120ms' } as React.CSSProperties}>
                <div className="rounded-2xl border border-vega-night/12 border-l-2 border-l-vega-gilt bg-vega-parchment px-6 py-7 shadow-[0_14px_30px_-20px_rgb(42_33_24/0.30)]">
                    <h3 className="font-vega text-xl font-semibold text-vega-night mb-2 tracking-tight">
                        Are you a Real Estate Lawyer?
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-5">
                        Discover <strong className="text-vega-gilt-bright">Komplete</strong> — Vega and Atrium in one workspace, built
                        for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy
                        portfolios, and track chamber matters from a single secure terminal.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onSignup('unified')}
                        className="rounded-full px-6 py-3 text-sm font-bold bg-vega-gilt text-vega-parchment hover:bg-vega-gilt-bright transition-all duration-150 active:scale-[0.98] focus-visible:ring-vega-gilt"
                    >
                        Explore Komplete
                    </Button>
                </div>
                <div className="rounded-2xl border border-vega-night/12 bg-vega-parchment px-6 py-7 shadow-[0_14px_30px_-20px_rgb(42_33_24/0.30)]">
                    <h3 className="font-vega text-xl font-semibold text-vega-night mb-2 tracking-tight">
                        Need Custom Automations or Tailored Management Tools?
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-5">
                        PracticePro develops bespoke operational systems, specialized CRMs, and custom workflow automations tailored
                        to your organization&rsquo;s precise processes. Talk to us about building high-performance management tools
                        engineered around your specific business architecture.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onContactSales('Custom Automation Pipeline')}
                        className="rounded-full px-6 py-3 text-sm font-bold border border-vega-night/30 text-vega-night hover:border-vega-gilt-bright hover:text-vega-gilt-bright hover:bg-vega-gilt/[0.05] transition-all duration-150 active:scale-[0.98] focus-visible:ring-vega-gilt"
                    >
                        Contact Sales
                    </Button>
                </div>
            </div>
        </div>
    </section>
);
