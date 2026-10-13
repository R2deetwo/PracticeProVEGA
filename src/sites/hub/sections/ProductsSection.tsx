import React from 'react';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';
import { useScrollReveal } from '../hooks';

/**
 * ProductsSection (P1 C2) — "01 — PRODUCTS". Two ruled rows, not cards:
 * each product's own mark, name, one-line descriptor, three facts, and a
 * link to its own page (opened in a new tab, per R21). Komplete is one
 * line under the rows.
 */
const PRODUCTS = [
    {
        name: 'Vega',
        mark: 'vega' as const,
        descriptor: 'The legal practice OS for Nigerian law firms — cases, drafting, calendaring and billing.',
        facts: [
            'AI-assisted drafting with ALOA, set to Nigerian court practice',
            'Court-rule-aware deadlines and Cause Book chronologies',
            'Client portal with live case tracking',
        ],
        href: '/vega',
        linkLabel: 'Explore Vega',
    },
    {
        name: 'Atrium',
        mark: 'atrium' as const,
        descriptor: 'The property management OS — rent and service-charge collection with the tenancy law of 36 states and the FCT.',
        facts: [
            "Residents' portal with statements and maintenance requests",
            'Revenue intelligence and defaulter tracking',
            'Receipts, reminders and reconciliation computed for you',
        ],
        href: '/atrium',
        linkLabel: 'Explore Atrium',
    },
];

export const ProductsSection: React.FC<{
    onOpenProduct: (p: 'vega' | 'atrium') => void;
}> = ({ onOpenProduct }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="products" className="hub-section" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8">01 — PRODUCTS</p>
                <div ref={ref} className="hub-reveal">
                    {PRODUCTS.map((p, i) => (
                        <div
                            key={p.name}
                            className="hub-grid items-start py-8 lg:py-10"
                            style={{ borderTop: i === 0 ? 'none' : '1px solid rgb(var(--hub-rule))' }}
                        >
                            <div className="col-span-12 md:col-span-5 lg:col-span-4 flex items-start gap-4">
                                {p.mark === 'vega'
                                    ? <VegaMark className="w-10 h-10 flex-shrink-0 mt-1" />
                                    : <AtriumMark className="w-10 h-10 flex-shrink-0 mt-1" />}
                                <div>
                                    <h3 className="hub-display text-2xl" style={{ fontWeight: 700 }}>{p.name}</h3>
                                    <p className="text-sm leading-[1.7] mt-2 max-w-[36ch]" style={{ color: 'rgb(var(--hub-mute))' }}>
                                        {p.descriptor}
                                    </p>
                                </div>
                            </div>
                            <ul className="col-span-12 md:col-span-5 lg:col-span-6 md:pl-6 mt-5 md:mt-1 space-y-2.5">
                                {p.facts.map((f) => (
                                    <li key={f} className="flex items-start gap-3 text-sm leading-[1.65]" style={{ color: 'rgb(var(--hub-ink))' }}>
                                        <span className="w-1.5 h-1.5 flex-shrink-0 mt-[7px]" style={{ background: 'rgb(var(--hub-signal))' }} aria-hidden="true" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <div className="col-span-12 md:col-span-2 lg:col-span-2 md:text-right mt-5 md:mt-1">
                                <button
                                    onClick={() => onOpenProduct(p.mark)}
                                    className="hub-link text-sm"
                                    aria-label={`${p.linkLabel} — opens in a new tab`}
                                >
                                    {p.linkLabel} ↗
                                </button>
                            </div>
                        </div>
                    ))}
                    <p className="text-sm pt-6" style={{ borderTop: '1px solid rgb(var(--hub-rule))', color: 'rgb(var(--hub-mute))' }}>
                        Komplete: Vega and Atrium together, for real-estate attorneys.
                    </p>
                </div>
            </div>
        </section>
    );
};
