import React, { useState } from 'react';
import { Button } from '../../ui';
import {
    getDisplayTiersForProduct,
    formatTierPrice,
    DISPLAY_TIER_IDS,
    type TierId,
} from '../../../constants/tiers';

/**
 * VegaPricingLedger — /vega's replacement for the shared 4-tier pricing
 * card grid.
 *
 * "The Chambers Standard" register: the rate card is a LEDGER — each tier
 * is a full-width ruled ROW (not a rounded card): mono tier numeral, serif
 * tier name, mono tabular price, features as a ruled two-column list, and
 * a square CTA. The highlighted tier carries a 2px amber left rule and a
 * square "Most Popular" stamp — no dark card, no floating badge. The
 * Monthly/Annual control is a square segmented toggle, not a pill.
 *
 * ALL pricing data is unchanged: the same tiers, prices, descriptions,
 * CTAs, the Monthly/Annual cycle, Save 20%, the 30-day money-back
 * guarantee, the Komplete banner and the bespoke-systems banner — only
 * the presentation idiom changes. Vega has no SCE (that is Atrium's
 * device). Interactive elements use the ui/Button primitive (ADR-0004).
 */

const TIER_DESCRIPTIONS: Record<TierId, string> = {
    Core: 'For Solo Practitioners & Boutiques',
    Growth: 'For Expanding Firms & Partnerships',
    Pro: 'For Enterprise Operations',
    Enterprise: '',
};

const TIER_CTAS: Record<TierId, string> = {
    Core: 'Get Started',
    Growth: 'Start Growth',
    Pro: 'Start Pro Trial',
    Enterprise: 'Contact Sales',
};

type PricingLedgerProps = {
    onSignup: (productOverride?: unknown) => void;
    onContactSales: (source: string) => void;
};

export const VegaPricingLedger: React.FC<PricingLedgerProps> = ({ onSignup, onContactSales }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const tiers = getDisplayTiersForProduct('legal');

    const rows = DISPLAY_TIER_IDS.map((id: TierId) => {
        const tier = tiers[id];
        const { price, per } = formatTierPrice(tier, billingCycle);
        const features = tier.features.map((text) => ({
            text,
            note: id === 'Core' && text.includes('ALOA') ? 'Growth+' : undefined,
        }));
        return {
            id,
            name: tier.label,
            description: TIER_DESCRIPTIONS[id],
            price,
            per,
            features,
            highlighted: !!tier.recommended,
            cta: TIER_CTAS[id],
        };
    });

    return (
        <section
            id="pricing"
            aria-labelledby="vega-pricing-heading"
            className="py-20 md:py-28 border-t border-slate-200"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                {/* Numbered hairline section head */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-amber-deep mb-7">
                    05 — The Rate Card
                </p>
                <h2
                    id="vega-pricing-heading"
                    className="font-vega text-3xl md:text-4xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl"
                    style={{ color: 'var(--color-ink)' }}
                >
                    Transparent Pricing. Professional Grade.
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-600 max-w-2xl mb-10">
                    Equip your firm with the tools to manage complex cases and
                    scale efficiently.
                </p>

                {/* Controls — square segmented cycle toggle + guarantee line */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-10 md:mb-14">
                    <div className="flex items-stretch border border-slate-300 w-fit" role="group" aria-label="Billing cycle">
                        <Button
                            variant="bare"
                            onClick={() => setBillingCycle('monthly')}
                            aria-pressed={billingCycle === 'monthly'}
                            className={`px-6 py-2.5 font-mono text-xs tracking-widest transition-colors focus-visible:ring-vega-amber ${
                                billingCycle === 'monthly'
                                    ? 'bg-vega-ink text-white'
                                    : 'bg-transparent text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            Monthly
                        </Button>
                        <div className="w-px bg-slate-300" aria-hidden="true" />
                        <Button
                            variant="bare"
                            onClick={() => setBillingCycle('annual')}
                            aria-pressed={billingCycle === 'annual'}
                            className={`px-6 py-2.5 font-mono text-xs tracking-widest transition-colors focus-visible:ring-vega-amber ${
                                billingCycle === 'annual'
                                    ? 'bg-vega-ink text-white'
                                    : 'bg-transparent text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            Annual
                        </Button>
                        <span className="flex items-center px-3 font-mono text-2xs tracking-widest text-vega-amber-deep border border-l-0 border-vega-amber/40 bg-vega-amber/5 whitespace-nowrap">
                            Save 20%
                        </span>
                    </div>
                    <p className="flex items-center gap-2.5 font-mono text-2xs tracking-widest text-slate-500 uppercase">
                        <span className="inline-block w-1.5 h-1.5 bg-vega-amber" aria-hidden="true" />
                        30-day money-back guarantee on annual plans
                    </p>
                </div>

                {/* The ledger — one ruled row per tier */}
                <div className="border-t-2 border-t-slate-900">
                    {rows.map((row, i) => (
                        <article
                            key={row.id}
                            className={`grid lg:grid-cols-12 gap-6 lg:gap-8 py-10 border-b border-slate-200 px-2 sm:px-4 relative ${
                                row.highlighted ? 'bg-white border-l-2 border-l-vega-amber' : ''
                            }`}
                        >
                            {/* Tier identification */}
                            <div className="lg:col-span-3">
                                <div className="flex items-baseline gap-3">
                                    <span className="font-mono text-xs tracking-widest text-slate-400">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="font-vega text-2xl font-semibold text-slate-900">
                                        {row.name}
                                    </h3>
                                </div>
                                {row.highlighted && (
                                    <p className="mt-2.5 inline-block font-mono text-2xs tracking-widest text-vega-amber-deep border border-vega-amber/50 bg-vega-amber/10 px-2 py-1">
                                        MOST POPULAR
                                    </p>
                                )}
                                <p className="text-sm text-slate-500 mt-3 leading-snug">
                                    {row.description}
                                </p>
                            </div>

                            {/* Price — mono tabular, the ledger's numerals */}
                            <div className="lg:col-span-2 flex lg:flex-col items-baseline lg:items-start gap-2">
                                <p className="vg-ledger text-2xl md:text-3xl text-slate-900 whitespace-nowrap">
                                    {row.price}
                                </p>
                                {row.per && (
                                    <p className="font-mono text-2xs tracking-widest text-slate-400 whitespace-nowrap">
                                        {row.per.toUpperCase()}
                                    </p>
                                )}
                            </div>

                            {/* Features — ruled two-column list */}
                            <ul className="lg:col-span-5 grid sm:grid-cols-2 gap-x-8 gap-y-2.5 border-t lg:border-t-0 border-slate-100 pt-5 lg:pt-1 content-start">
                                {row.features.map((f, j) => (
                                    <li key={j} className="flex items-start gap-2.5 text-sm text-slate-600 leading-snug">
                                        <span className="inline-block w-1.5 h-1.5 bg-vega-amber mt-[7px] flex-shrink-0" aria-hidden="true" />
                                        <span>
                                            {f.text}
                                            {f.note && (
                                                <span className="ml-2 font-mono text-3xs tracking-widest text-vega-amber-deep border border-vega-amber/40 bg-vega-amber/5 px-1.5 py-0.5 whitespace-nowrap">
                                                    {f.note}
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA — square */}
                            <div className="lg:col-span-2 flex items-start">
                                <Button
                                    variant="bare"
                                    fullWidth
                                    onClick={row.id === 'Enterprise' ? () => onContactSales('Enterprise Pricing CTA') : () => onSignup()}
                                    className={`w-full px-6 py-3.5 text-sm font-bold transition-colors focus-visible:ring-vega-amber ${
                                        row.highlighted
                                            ? 'bg-vega-ink text-white hover:bg-vega-ink-soft'
                                            : 'border border-vega-ink/25 text-vega-ink hover:border-vega-ink hover:bg-vega-ink hover:text-white'
                                    }`}
                                >
                                    {row.cta}
                                </Button>
                            </div>
                        </article>
                    ))}
                </div>

                {/* Komplete banner — ruled box, square, in register */}
                <div className="mt-12 border border-slate-200 border-l-2 border-l-vega-amber bg-white px-6 py-8 sm:px-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="font-vega text-2xl font-semibold text-slate-900 mb-2 tracking-tight">
                                Are you a Real Estate Lawyer?
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                                Discover <strong className="text-vega-amber-deep">Komplete</strong> — our specialized, unified workspace designed
                                exclusively for real estate attorneys to coordinate high-stakes property legal operations, manage tenancy
                                portfolios, and track chamber matters from a single secure terminal.
                            </p>
                        </div>
                        <Button
                            variant="bare"
                            onClick={() => onSignup('unified')}
                            className="whitespace-nowrap px-7 py-3.5 text-sm font-bold bg-vega-ink text-white hover:bg-vega-ink-soft transition-colors flex items-center gap-2 focus-visible:ring-vega-amber"
                        >
                            Explore Komplete
                        </Button>
                    </div>
                </div>

                {/* Bespoke systems banner — ruled box, hairline */}
                <div className="mt-5 border border-slate-200 bg-white px-6 py-8 sm:px-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="font-vega text-2xl font-semibold text-slate-900 mb-2 tracking-tight">
                                Need Custom Automations or Tailored Management Tools?
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                                PracticePro develops bespoke operational systems, specialized CRMs, and custom workflow automations tailored
                                to your organization&rsquo;s precise processes. Talk to us about building high-performance management tools
                                engineered around your specific business architecture.
                            </p>
                        </div>
                        <Button
                            variant="bare"
                            onClick={() => onContactSales('Custom Automation Pipeline')}
                            className="whitespace-nowrap px-7 py-3.5 text-sm font-bold border border-vega-ink/25 text-vega-ink hover:border-vega-ink hover:bg-vega-ink hover:text-white transition-colors focus-visible:ring-vega-amber"
                        >
                            Contact Sales
                        </Button>
                    </div>
                </div>

                {/* Footnote — verbatim */}
                <p className="font-mono text-2xs tracking-widest text-slate-400 mt-10 text-center uppercase">
                    Start for free. Upgrade when you need to scale. Framework compliant with NDPA 2023.
                </p>
            </div>
        </section>
    );
};
