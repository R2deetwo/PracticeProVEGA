import React, { useState } from 'react';
import { PrimaryButton, GhostButton } from '../../shared/ctas';
import { VEGA_TIERS, formatTierPrice, type TierId } from '../../../constants/tiers';

/**
 * VegaPricing — R56: the light-enterprise pricing band.
 *
 * The R49 matrix structure survives (VEGA_TIERS from src/constants/tiers.ts
 * — the single source of truth the in-app subscription page renders, so
 * prices can never drift); the espresso cards become white cards with
 * delicate slate borders and refined shadows. The recommended tier wears
 * the navy border ring.
 *
 * The FAQ band (VegaFAQInk, retired as a standalone section in the R56
 * consolidation) folds in here in compact form — the cost answer carries
 * the 30-day money-back guarantee promise (pinned by refunds.test.ts),
 * the reminder cadence and the security answer.
 */

const ORDER: TierId[] = ['Core', 'Growth', 'Pro', 'Enterprise'];

const FAQS = [
    {
        q: 'How much does Vega cost?',
        a: 'Vega for law firms starts free — the Free plan carries the core practice management. Paid plans start at \u20A645,000/mo (annual saves 20%), and every paid plan includes a 30-day money-back guarantee.',
    },
    {
        q: 'How do court date reminders reach me?',
        a: 'Automated reminders are sent 7, 3, and 1 day before each hearing to assigned lawyers by email and in-app notification. Client-facing reminders are opt-in per matter.',
    },
    {
        q: 'Is my data secure?',
        a: 'Yes — NDPA 2023 compliant, TLS 1.3 in transit, data encrypted at rest, and client data never trains a model.',
    },
];

const CARD_BASE =
    'rounded-2xl border bg-white p-6 flex flex-col relative overflow-hidden transition-shadow';
const CARD_PLAIN = `${CARD_BASE} border-slate-200/80 shadow-sm hover:shadow-md`;
const CARD_RECO = `${CARD_BASE} border-[#1E3A8A]/60 shadow-md`;

export const VegaPricing: React.FC<{
    onContactSales: (source?: string) => void;
    onSignup: () => void;
}> = ({ onContactSales, onSignup }) => {
    const [open, setOpen] = useState<number>(0);

    return (
        <section
            id="pricing"
            aria-labelledby="vega-pricing-heading"
            className="py-20 md:py-28 bg-white border-t border-slate-200/70"
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8" data-vg-reveal>
                {/* Section head */}
                <div className="max-w-3xl mb-10 md:mb-14">
                    <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 font-mono text-2xs font-medium uppercase tracking-[0.18em] text-indigo-700 mb-6">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                        Plans & Add-ons
                    </p>
                    <h2
                        id="vega-pricing-heading"
                        className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                    >
                        One workspace.{' '}
                        <span className="text-[#1E3A8A]">DraftPro standard.</span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.75] text-slate-600 max-w-2xl">
                        Every plan carries the core: full practice management, billing, case
                        tracking — and standard AI contract analysis. The Regulatory
                        Cross-Referencing engine rides with Enterprise, or as an add-on.
                    </p>
                </div>

                {/* The matrix — from VEGA_TIERS (single source of truth) */}
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6 max-w-6xl">
                    {ORDER.map((id) => {
                        const t = VEGA_TIERS[id];
                        const { price, per } = formatTierPrice(t, 'monthly');
                        const isReco = !!t.recommended;
                        return (
                            <div key={id} className={isReco ? CARD_RECO : CARD_PLAIN}>
                                {isReco && (
                                    <span className="absolute top-0 right-0 font-mono text-2xs uppercase tracking-widest text-white bg-[#1E3A8A] px-3 py-1.5 rounded-bl-lg">
                                        Recommended
                                    </span>
                                )}
                                <p className="font-display text-xl font-semibold tracking-tight text-slate-900">{t.label}</p>
                                <p className="mt-3 mb-1">
                                    <span className="font-display text-3xl font-semibold text-slate-900">{price}</span>
                                    {per && <span className="text-sm text-slate-500 ml-1.5">{per === 'Per Annum' ? '/yr' : per}</span>}
                                </p>
                                <p className="font-mono text-2xs tracking-widest text-slate-400 mb-5">
                                    {id === 'Enterprise' ? 'Custom — sized to the firm' : 'Annual saves 20%'}
                                </p>
                                <ul className="space-y-2.5">
                                    {t.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600 leading-[1.6]">
                                            <span className="mt-[7px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-auto pt-6">
                                    {id === 'Enterprise' ? (
                                        <GhostButton onClick={() => onContactSales('Vega Pricing')} tone="vega" className="w-full text-sm px-6 py-3">
                                            Talk to Sales
                                        </GhostButton>
                                    ) : (
                                        <PrimaryButton onClick={onSignup} tone="vega" className="w-full text-sm px-6 py-3">
                                            {id === 'Core' ? 'Start free' : `Choose ${t.label}`}
                                        </PrimaryButton>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* The add-on note — soft indigo pill row. */}
                <div className="max-w-6xl mb-16 md:mb-20">
                    <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
                        <span className="font-semibold">Vega Core + DraftPro&trade;</span>
                        <span className="text-indigo-400">·</span>
                        <span>on every plan</span>
                        <span className="text-indigo-400">·</span>
                        <span className="font-semibold">Regulatory Compliance Cross-Referencing</span>
                        <span className="text-indigo-400">·</span>
                        <span>Included with Enterprise. Available as an add-on.</span>
                    </p>
                </div>

                {/* The compact FAQ — the retired FAQ band's load-bearing answers. */}
                <div className="max-w-3xl">
                    <h3 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                        Questions? Answered.
                    </h3>
                    <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
                        {FAQS.map((f, i) => (
                            <div key={f.q}>
                                <button
                                    onClick={() => setOpen(open === i ? -1 : i)}
                                    aria-expanded={open === i}
                                    className="w-full flex items-center justify-between gap-4 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-sm"
                                >
                                    <span className="font-semibold text-slate-900 text-[15px]">{f.q}</span>
                                    <span
                                        className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open === i ? 'rotate-45' : ''}`}
                                        aria-hidden="true"
                                    >
                                        +
                                    </span>
                                </button>
                                {open === i && (
                                    <p className="pb-5 pr-8 text-sm leading-[1.7] text-slate-600">{f.a}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
