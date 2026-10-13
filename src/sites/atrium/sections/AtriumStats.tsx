import React, { useEffect, useRef } from 'react';

/**
 * AtriumStats — /atrium's own stat band ("The Well-Kept Estate" register).
 *
 * The sage section break between the photography hero and the features
 * grid: values go BIG tabular mono — the ledger/receipt numerals that
 * carry Atrium's money register — on the warm sage surface. Rounded,
 * centered, hospitable; the deliberate opposite of Vega's ink spine.
 *
 * Extracted verbatim from the retired shared StatsDemarcator (Pass B):
 * the atrium branch only, now living in an Atrium-owned file.
 */

const ATRIUM_STATS = [
    { value: '20–∞', label: 'Managed Units' },
    { value: 'End-to-End', label: 'Rent Collection' },
    { value: '99.9%', label: 'Platform Uptime' },
    { value: 'NDPA 2023', label: 'Data Compliant' },
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
            className="scroll-reveal w-full py-10 sm:py-16 lg:py-20 px-4 sm:px-6"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4 text-center">
                    {ATRIUM_STATS.map((s, i) => (
                        <div key={i} className="flex flex-col items-center">
                            <p
                                className="font-mono nums-tabular font-bold mb-2 whitespace-nowrap text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
                                style={{ color: 'var(--color-ink)' }}
                            >
                                {s.value}
                            </p>
                            <p className="leading-tight tracking-wide text-xs md:text-sm text-slate-600">
                                {s.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
