import React from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaFinalCTA — R56: the light-enterprise close.
 *
 * The colophon concept survives, re-registered: a DEEP NAVY BAND (the
 * executive accent as the page's one saturated moment) with white type,
 * pill CTAs, and the compact cross-sell cards returned on white stock
 * below. Left-aligned like the hero — not a centered band.
 *
 * R21 (kept): the Komplete and bespoke-systems cross-sells live here.
 * CTAs use the ui/Button primitive (ADR-0004).
 */
export const VegaFinalCTA: React.FC<{
    onSignup: (productOverride?: unknown) => void;
    onContactSales: (source: string) => void;
}> = ({ onSignup, onContactSales }) => (
    <section
        aria-labelledby="vega-final-cta-heading"
        className="relative overflow-hidden py-20 md:py-28"
    >
        {/* The navy band — the page's one saturated moment. */}
        <div className="bg-[#1E3A8A]">
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl py-16 md:py-20">
                <div className="max-w-2xl" data-vg-reveal>
                    <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-indigo-300 mb-7">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                        Vega — Legal Workflow Automation
                    </p>
                    <h2
                        id="vega-final-cta-heading"
                        className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.08] tracking-tight mb-8 text-white"
                    >
                        Ready to run a{' '}
                        <span className="text-indigo-300">sharper practice?</span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-blue-100 mb-10">
                        Join Nigerian law firms who have already switched to
                        Vega — matter management, AI drafting, and
                        court-rule-aware calendaring built for the way you actually
                        work.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                        <Button
                            variant="bare"
                            onClick={() => onSignup()}
                            className="rounded-full px-8 py-4 text-base font-bold bg-white text-[#1E3A8A] hover:bg-indigo-50 transition-all duration-150 active:scale-[0.98] focus-visible:ring-white"
                        >
                            Start Free Trial
                        </Button>
                        <Button
                            variant="bare"
                            onClick={() => onContactSales('Final CTA')}
                            className="rounded-full px-8 py-4 text-base font-bold border border-white/40 text-white hover:border-white hover:bg-white/10 transition-all duration-150 active:scale-[0.98] focus-visible:ring-white"
                        >
                            Talk to Sales
                        </Button>
                    </div>
                    <p className="font-mono text-2xs tracking-widest text-blue-200/80 mt-8">
                        NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                    </p>
                </div>
            </div>
        </div>

        {/* The cross-sells — relocated from the retired rate-card band
            (R21). Compact, subordinate, white stock on the light ground. */}
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="mt-12 md:mt-16 grid md:grid-cols-2 gap-5 max-w-4xl" data-vg-reveal style={{ '--vg-d': '120ms' } as React.CSSProperties}>
                <div className="rounded-2xl border border-slate-200/80 border-l-2 border-l-[#1E3A8A] bg-white px-6 py-7 shadow-sm">
                    <h3 className="font-display text-xl font-semibold text-slate-900 mb-2 tracking-tight">
                        Are you a Real Estate Lawyer?
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-5">
                        Discover <strong className="text-[#1E3A8A]">Komplete</strong> — Vega and Atrium in one workspace, built
                        for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy
                        portfolios, and track chamber matters from a single secure terminal.
                    </p>
                    <Button
                        variant="bare"
                        onClick={() => onSignup('unified')}
                        className="rounded-full px-6 py-3 text-sm font-bold bg-[#1E3A8A] text-white hover:bg-[#1E40AF] transition-all duration-150 active:scale-[0.98] focus-visible:ring-[#1E3A8A]"
                    >
                        Explore Komplete
                    </Button>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-7 shadow-sm">
                    <h3 className="font-display text-xl font-semibold text-slate-900 mb-2 tracking-tight">
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
                        className="rounded-full px-6 py-3 text-sm font-bold border border-slate-300 text-slate-700 hover:border-[#1E3A8A] hover:text-[#1E3A8A] transition-all duration-150 active:scale-[0.98] focus-visible:ring-[#1E3A8A]"
                    >
                        Contact Sales
                    </Button>
                </div>
            </div>
        </div>
    </section>
);
