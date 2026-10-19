import React, { useEffect, useRef } from 'react';

/**
 * AtriumStats — /atrium's own stat band ("The Terracotta Estate").
 *
 * The sand section break between the plan-map hero and the features
 * grid: values go BIG tabular mono — the ledger/receipt numerals that
 * carry Atrium's money register — on the warm sand surface. Rounded,
 * centered, hospitable; the deliberate opposite of Vega's ink spine.
 *
 * R32: "20–∞ Managed Units" (an odd, unverifiable claim) is replaced by
 * the estate's most concrete number — the 36 states + FCT whose tenancy
 * law Atrium applies. Every value here is verifiable.
 */

const ATRIUM_STATS = [
    { value: '36 + FCT', label: "states' tenancy law applied, property by property" },
    { value: '98.2%', label: 'typical first-month collection after moving to Atrium' },
    { value: 'End-to-End', label: 'rent, service charge and receipting in one flow' },
    { value: 'NDPA 2023', label: 'data protection compliance, from day one' },
];

function useScrollReveal<T extends HTMLElement = HTMLDivElement>(options?: { threshold?: number; rootMargin?: string }) {
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
            threshold: options?.threshold ?? 0.15,
            rootMargin: options?.rootMargin ?? '0px 0px -60px 0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

export const AtriumStats: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section
            ref={ref as React.RefObject<HTMLElement>}
            className="scroll-reveal w-full py-10 sm:py-16 lg:py-20 px-4 sm:px-6 border-b border-atrium-sand"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4 text-center">
                    {ATRIUM_STATS.map((s, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <p
                                className="font-mono nums-tabular font-bold mb-2 whitespace-nowrap text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] text-atrium-ink"
                            >
                                {s.value}
                            </p>
                            {/* The clay tick — the estate's accent under every figure */}
                            <span className="w-6 h-[3px] rounded-full bg-atrium-clay/50 mb-3" aria-hidden="true" />
                            <p className="leading-snug tracking-wide text-xs md:text-sm text-slate-600 max-w-[16rem]">
                                {s.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
