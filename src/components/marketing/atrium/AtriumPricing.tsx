import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, SparklesIcon } from '../../../constants';
import {
    getDisplayTiersForProduct,
    formatTierPrice,
    DISPLAY_TIER_IDS,
    type ProductMode,
    type TierId,
    type TierDef,
} from '../../../constants/tiers';

/**
 * AtriumPricing — /atrium's own pricing band ("The Well-Kept Estate").
 *
 * Warm rounded-card register: 40px-radius cards, emerald Most-Popular
 * treatment on white (no dark slate card), SCE shown per unit with the
 * interactive SCE Calculator, monthly/annual toggle, 30-day money-back
 * badge, and the Custom Automation banner on warm sage with clay
 * warmth. The deliberate opposite of Vega's ruled rate-card ledger.
 * The Komplete banner is NOT here — it renders on Vega only.
 *
 * Extracted from the retired shared PricingSection (Pass B): atrium
 * branch only, now living in an Atrium-owned file. Keeps the #pricing
 * anchor the nav and audit key on.
 */

const TIER_DESCRIPTIONS: Record<TierId, string> = {
    Core: 'For Individual Landlords & Micro-Agents',
    Growth: 'For Professional Estate Managers',
    Pro: 'For Large-Scale Estate Portfolios',
    Enterprise: '',
};

const TIER_CTAS: Record<TierId, string> = {
    Core: 'Get Started',
    Growth: 'Start Growth',
    Pro: 'Start Pro Trial',
    Enterprise: 'Contact Sales',
};

// ─── SCE CALCULATOR MODAL ──────────────────────────────────────────────────
// Interactive slider-based calculator that lets property managers:
//   1. Drag a slider to set their unit count (1-500)
//   2. Toggle between monthly and annual billing
//   3. See live-updating per-tenant SCE for each tier
//   4. Visualise "absorbability" — whether residents will notice the cost
//      on their service charge invoice (based on Lagos SC benchmarks)

const SceCalculatorModal: React.FC<{
    tiers: Record<Exclude<TierId, 'Enterprise'>, TierDef>;
    onClose: () => void;
    onSignup: (productOverride?: ProductMode) => void;
}> = ({ tiers, onClose, onSignup }) => {
    const [unitCount, setUnitCount] = useState<number>(50);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

    const units = Math.max(1, unitCount);

    const calculations = (['Core', 'Growth', 'Pro'] as const).map(id => {
        const tier = tiers[id];
        const annualPrice = tier.annualPrice || 0;
        const monthlyPrice = tier.monthlyPrice || 0;

        const scePerTenantMonthly = billingCycle === 'annual'
            ? (units > 0 ? Math.round(annualPrice / 12 / units) : 0)
            : (units > 0 ? Math.round(monthlyPrice / units) : 0);

        const totalAnnual = annualPrice;
        const totalMonthly = monthlyPrice;

        let absorbability: 'easy' | 'moderate' | 'tight' = 'easy';
        if (scePerTenantMonthly > 5000) absorbability = 'tight';
        else if (scePerTenantMonthly > 2000) absorbability = 'moderate';

        const absorbabilityPct = Math.min(100, Math.round((scePerTenantMonthly / 10000) * 100));

        const tierMaxUnits = tier.maxUnits;
        const isBestFit = tierMaxUnits !== null && units <= tierMaxUnits;
        const exceedsCapacity = tierMaxUnits !== null && units > tierMaxUnits;

        let overageUnits = 0;
        let overageCost = 0;
        if (tier.overageRate && tier.overageStartUnit && units >= tier.overageStartUnit) {
            overageUnits = units - (tier.overageStartUnit - 1);
            overageCost = overageUnits * tier.overageRate;
        }

        return {
            id,
            tierName: tier.label,
            tierMaxUnits,
            scePerTenantMonthly,
            totalAnnual,
            totalMonthly,
            overageCost,
            overageUnits,
            absorbability,
            absorbabilityPct,
            isBestFit,
            exceedsCapacity,
        };
    });

    const fmtNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

    // Render at document.body level — escapes any transformed parent
    // (like <main className="animate-swap-in">).
    return createPortal(
        <div
            className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sce-calc-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="relative bg-white rounded-t-md sm:rounded-md shadow-md w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
                {/* Brand accent bar — Atrium register: emerald */}
                <div className="h-1.5 w-full bg-emerald-500 rounded-t-md sm:rounded-t-md" />

                {/* Header */}
                <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 id="sce-calc-title" className="font-display text-lg font-bold text-slate-900">SCE Calculator</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Drag the slider to see your per-resident cost</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        aria-label="Close calculator"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-5 space-y-5">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-xs text-emerald-900 leading-relaxed">
                            <strong>Service Charge Equivalent (SCE)</strong> is your Atrium subscription divided across your residents — shown as a per-resident monthly amount. You can add this line to your service charge invoices to recover the cost. It is <strong>not</strong> an extra fee from Atrium.
                        </p>
                    </div>

                    {/* Primary slider: Units under management */}
                    <div className="space-y-3">
                        <div className="flex items-baseline justify-between">
                            <label htmlFor="sce-units-slider" className="text-sm font-semibold text-slate-700">
                                Units under management
                            </label>
                            <div className="flex items-baseline gap-1">
                                <span className="font-display text-2xl font-extrabold text-emerald-600 nums-tabular transition-all duration-150">
                                    {units.toLocaleString('en-NG')}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">units</span>
                            </div>
                        </div>

                        <div className="relative pt-1">
                            <input
                                id="sce-units-slider"
                                type="range"
                                min="1"
                                max="500"
                                step="1"
                                value={units}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    const step = val <= 25 ? 1 : val <= 100 ? 5 : 10;
                                    const snapped = Math.round(val / step) * step;
                                    setUnitCount(Math.max(1, Math.min(500, snapped)));
                                }}
                                className="sce-slider w-full"
                                aria-valuemin={1}
                                aria-valuemax={500}
                                aria-valuenow={units}
                                style={{ '--sce-fill-pct': `${((units - 1) / 499) * 100}%` } as React.CSSProperties}
                            />
                            <div className="flex justify-between mt-2 text-3xs text-slate-400 font-medium">
                                <span>1</span>
                                <span>50</span>
                                <span>100</span>
                                <span>250</span>
                                <span>500+</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[10, 25, 50, 100, 250].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setUnitCount(n)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all touch-target ${
                                        units === n
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Billing cycle toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Billing cycle</p>
                            <p className="text-xs text-slate-500">
                                {billingCycle === 'annual' ? 'Save 20% with annual billing' : 'Flexibility of monthly billing'}
                            </p>
                        </div>
                        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    billingCycle === 'monthly'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    billingCycle === 'annual'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Annual
                            </button>
                        </div>
                    </div>

                    {/* Tier cards (live-updating) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {calculations.map(calc => {
                            const absorbabilityStyles = {
                                easy: {
                                    text: 'text-emerald-600',
                                    bg: 'bg-emerald-500',
                                    label: 'Easy',
                                },
                                moderate: {
                                    text: 'text-amber-600',
                                    bg: 'bg-amber-500',
                                    label: 'Moderate',
                                },
                                tight: {
                                    text: 'text-red-600',
                                    bg: 'bg-red-500',
                                    label: 'Tight',
                                },
                            }[calc.absorbability];

                            return (
                                <div
                                    key={calc.id}
                                    className={`relative rounded-lg border-2 p-4 transition-all duration-300 ${
                                        calc.isBestFit
                                            ? 'border-emerald-500 bg-emerald-50/30 shadow-lg scale-[1.02]'
                                            : calc.exceedsCapacity
                                            ? 'border-slate-200 bg-slate-50/50 opacity-75'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    {calc.isBestFit && (
                                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-white text-3xs font-black uppercase tracking-wider rounded-full shadow-sm whitespace-nowrap">
                                            Best fit
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <h3 className="font-display font-bold text-slate-900 text-sm">{calc.tierName}</h3>
                                        <p className="text-3xs text-slate-500 font-medium">
                                            {calc.tierMaxUnits ? `Up to ${calc.tierMaxUnits} units` : 'Unlimited units'}
                                            {calc.exceedsCapacity && (
                                                <span className="text-amber-600 font-bold ml-1">· Over capacity</span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="mb-3">
                                        <p className="text-3xs text-slate-400 uppercase tracking-wider font-bold mb-0.5">SCE per resident / mo</p>
                                        <p className={`font-display text-2xl font-extrabold nums-tabular transition-all duration-150 ${absorbabilityStyles.text}`}>
                                            {fmtNaira(calc.scePerTenantMonthly)}
                                        </p>
                                    </div>

                                    <div className="mb-3">
                                        <p className="text-3xs text-slate-400 uppercase tracking-wider font-bold mb-0.5">
                                            {billingCycle === 'annual' ? 'Annual total' : 'Monthly total'}
                                        </p>
                                        <p className="text-sm font-bold text-slate-900 nums-tabular">
                                            {billingCycle === 'annual'
                                                ? fmtNaira(calc.totalAnnual)
                                                : fmtNaira(calc.totalMonthly)
                                            }
                                        </p>
                                        {calc.overageUnits > 0 && (
                                            <p className="text-3xs text-amber-600 font-semibold mt-0.5">
                                                + {fmtNaira(calc.overageCost)}/mo for {calc.overageUnits} extra units
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-3xs text-slate-400 uppercase tracking-wider font-bold">Absorbability</span>
                                            <span className={`text-3xs font-bold uppercase tracking-wider ${absorbabilityStyles.text}`}>
                                                {absorbabilityStyles.label}
                                            </span>
                                        </div>
                                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="absolute inset-0 flex">
                                                <div className="w-1/3 bg-emerald-100" />
                                                <div className="w-1/3 bg-amber-100" />
                                                <div className="w-1/3 bg-red-100" />
                                            </div>
                                            <div
                                                className={`relative h-full ${absorbabilityStyles.bg} transition-all duration-300 ease-out`}
                                                style={{ width: `${calc.absorbabilityPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-xs font-bold text-slate-700 mb-2">How to use this number</p>
                        <ol className="space-y-1.5 text-xs text-slate-600 leading-relaxed list-decimal list-inside">
                            <li>Pick the tier whose SCE feels comfortable for your residents.</li>
                            <li>Add the SCE as a line item on your monthly service charge invoice.</li>
                            <li>Your residents pay it as part of their normal service charge — no separate collection needed.</li>
                            <li>The subscription cost is recovered; the platform effectively pays for itself.</li>
                        </ol>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">What the colors mean:</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle"></span> <strong>Easy</strong> — under ₦2,000/mo. Residents barely notice it on their service charge invoice.</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle"></span> <strong>Moderate</strong> — ₦2,000-5,000/mo. Noticeable but reasonable vs typical Nigerian service charges.</p>
                        <p><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle"></span> <strong>Tight</strong> — over ₦5,000/mo. Consider a higher tier with more units to spread the cost.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 pb-safe border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        {units.toLocaleString('en-NG')} units · {billingCycle === 'annual' ? 'Annual billing' : 'Monthly billing'}
                    </p>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => { onClose(); onSignup('atrium'); }}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm transition-all"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (!('IntersectionObserver' in window)) {
            el.classList.add('is-visible');
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -60px 0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

export const AtriumPricing: React.FC<{
    onSignup: (productOverride?: ProductMode) => void;
    onContactSales: (source: string) => void;
}> = ({ onSignup, onContactSales }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    // SCE Calculator modal state
    const [showSceCalculator, setShowSceCalculator] = useState(false);
    // Tooltip hover state for the "SCE shown per unit" pill (desktop only).
    const [isHoveringArea, setIsHoveringArea] = useState(false);
    const tiers = getDisplayTiersForProduct('property');

    const headerRef = useScrollReveal<HTMLDivElement>();
    const gridRef = useScrollReveal<HTMLDivElement>();
    const ctaRef = useScrollReveal<HTMLDivElement>();

    const dynamicPlans = DISPLAY_TIER_IDS.map((id: TierId) => {
        const tier = tiers[id as keyof typeof tiers];
        const { price, per } = formatTierPrice(tier, billingCycle);
        const tenantContribution = tier.scePer || '';
        const description = TIER_DESCRIPTIONS[id];
        const features = tier.features.map((text) => ({
            text,
            note: (id === 'Core' && (text.includes('ARIA') || text.includes('ALOA'))) ? 'Growth+' : undefined,
        }));
        return {
            id,
            name: tier.label,
            price,
            per,
            tenantContribution,
            features,
            description,
            highlighted: tier.recommended,
            cta: TIER_CTAS[id],
        };
    });

    return (
    <section id="pricing" className="min-h-[100dvh] pt-16 pb-16 px-4 sm:px-6" style={{ background: 'var(--color-paper)' }}>
        <div className="container mx-auto max-w-7xl">
            {/* Header */}
            <div ref={headerRef} className="scroll-reveal text-center mb-10 md:mb-16">
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.12]" style={{ color: 'var(--color-ink)' }}>
                    Institutional Property Management. Simplified.
                </h2>
                <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed mb-6">
                    Frame your technology cost as a service benefit to your residents.
                </p>

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
                    <button
                        onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                        className="relative w-16 h-9 bg-slate-200 rounded-full transition-colors"
                        aria-label="Toggle billing cycle"
                    >
                        <div className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow-md transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-7' : ''}`} />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}>Annual</span>
                        <span className="text-2xs font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full border border-emerald-200">
                            Save 20%
                        </span>
                    </div>
                </div>

                {/* 30-day money-back guarantee badge */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        <span className="text-sm font-semibold text-emerald-700">30-day money-back guarantee on annual plans</span>
                    </div>
                </div>

                <div
                    className="flex flex-col sm:flex-row justify-center items-center mt-4 gap-3 relative"
                >
                    {/* SCE explanation tooltip — shows when hovering the pill (desktop only) */}
                    <div
                        className="group relative"
                        onMouseEnter={() => setIsHoveringArea(true)}
                        onMouseLeave={() => setIsHoveringArea(false)}
                    >
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200 whitespace-nowrap cursor-help">
                            SCE shown per unit<span className="text-emerald-500 font-bold">*</span>
                        </span>
                        <div
                            className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 max-w-[90vw] rounded-lg bg-slate-900 px-4 py-3 text-xs leading-relaxed text-white shadow-2xl transition-all duration-300 pointer-events-none ${
                                isHoveringArea ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                            }`}
                        >
                            <strong className="block mb-1">What is SCE?</strong>
                            Service Charge Equivalent is your annual Atrium subscription divided across your resident base — shown as a per-resident monthly amount. You can itemize this on service charge invoices to offset the cost. It is not an additional fee charged by Atrium.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                        </div>
                    </div>

                    {/* Calculate button — ALWAYS visible, full-width on mobile */}
                    <button
                        onClick={() => setShowSceCalculator(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold border border-emerald-700 hover:bg-emerald-700 active:scale-95 transition-all duration-200 whitespace-nowrap shadow-md hover:shadow-lg touch-target"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <span>Calculate your SCE</span>
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div
                ref={gridRef}
                className="scroll-reveal scroll-reveal-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8 items-stretch pb-12 max-w-5xl mx-auto"
            >
                {dynamicPlans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`pricing-card group rounded-3xl sm:rounded-[40px] border p-5 sm:p-8 md:p-10 flex flex-col relative ${plan.highlighted
                            ? 'bg-white border-2 border-emerald-500 shadow-elevation-2 lg:-translate-y-4'
                            : 'bg-white border-slate-200 shadow-lg shadow-slate-900/5 hover:shadow-2xl hover:border-primary-300'
                            }`}
                    >
                        {plan.highlighted && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 text-2xs font-black uppercase tracking-wide-label shadow-md z-20 whitespace-nowrap bg-emerald-600 text-white rounded-full">
                                Most Popular
                            </div>
                        )}

                        <h3 className="font-display text-xl font-bold mb-1 text-slate-900">{plan.name}</h3>
                        <p className="text-sm mb-6 text-slate-500">{plan.description}</p>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className="font-display nums-tabular text-4xl font-extrabold tracking-tight text-slate-900">{plan.price}</span>
                            <span className="text-sm text-slate-500">{plan.per}</span>
                        </div>

                        {/* SCE per tenant as a clean inline line */}
                        {plan.tenantContribution && (
                            <p className="text-xs mb-2 text-slate-500">
                                <span className="font-semibold">~{plan.tenantContribution}</span> per resident/mo (SCE)
                            </p>
                        )}

                        {/* Spacer to keep card heights consistent */}
                        <div className="mb-8" />

                        {/* Features */}
                        <ul className="space-y-3.5 mb-8 flex-1">
                            {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <CheckIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600`} />
                                    <span className={`text-sm leading-snug ${plan.highlighted ? 'text-slate-700' : 'text-slate-700'}`}>
                                        {f.text}
                                        {f.note && (
                                            <span className="ml-2 text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                {f.note}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* CTA */}
                        <button
                            onClick={plan.id === 'Enterprise' ? () => onContactSales('Enterprise Pricing CTA') : () => onSignup()}
                            className={`w-full py-3.5 rounded-sm font-bold text-sm transition-all active:scale-[0.98] shadow-md ${
                                plan.highlighted
                                    ? 'bg-atrium-emerald text-white hover:bg-emerald-700'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                        >
                            {plan.cta}
                        </button>
                    </div>
                ))}
            </div>

            {/* ── Custom Automation Pipeline — PracticePro Bespoke Systems.
                ATRIUM REGISTER: warm sage panel with clay warmth — no dark
                bands on /atrium. */}
            <div ref={ctaRef} className="scroll-reveal max-w-5xl mx-auto mt-10 mb-12 space-y-5">
                <div className="relative overflow-hidden p-8 md:p-10 border rounded-2xl border-atrium-clay/30 shadow-elevation-2" style={{ background: 'var(--color-sage)' }}>
                    <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-atrium-emerald/10" />
                    <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none bg-atrium-clay/20" />
                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="text-2xl font-extrabold mb-2 tracking-tight text-slate-900">
                                Need Custom Automations or Tailored Management Tools?
                            </h4>
                            <p className="text-sm leading-relaxed max-w-xl text-slate-600">
                                PracticePro develops bespoke operational systems, specialized CRMs, and custom workflow automations tailored to your organization's precise processes. Talk to us about building high-performance management tools engineered around your specific business architecture.
                            </p>
                        </div>
                        <button
                            onClick={() => onContactSales('Custom Automation Pipeline')}
                            className="whitespace-nowrap px-7 py-3.5 rounded-sm text-sm font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 bg-atrium-emerald text-white hover:bg-emerald-700"
                        >
                            Contact Sales
                        </button>
                    </div>
                </div>
            </div>

            {/* Footnote */}
            <p className="text-center text-slate-400 text-xs mt-10">
                Start for free. Upgrade when you need to scale. Framework compliant with NDPA 2023.
            </p>
        </div>

        {/* SCE Calculator Modal */}
        {showSceCalculator && (
            <SceCalculatorModal
                tiers={tiers}
                onClose={() => setShowSceCalculator(false)}
                onSignup={onSignup}
            />
        )}
    </section>
    );
};
