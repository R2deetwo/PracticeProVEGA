import React, { useEffect, useRef } from 'react';
import { ScalesIcon, LockClosedIcon, KeyIcon } from '../../../constants';

/**
 * AtriumTrust — /atrium's own trust strip ("The Well-Kept Estate").
 *
 * The quiet compliance strip between the stats band and the features
 * grid: rounded icon coins on white, the estate's papers-in-order feel.
 * Extracted verbatim from the retired shared TrustBadgesStrip (Pass B).
 */

const BADGES = [
    { label: 'NDPA 2023 Compliant', Icon: ScalesIcon },
    { label: 'TLS 1.3 Encrypted', Icon: LockClosedIcon },
    { label: 'Data Encrypted at Rest*', Icon: KeyIcon },
];

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

export const AtriumTrust: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <div ref={ref} className="scroll-reveal bg-white border-y border-slate-200/60 py-5 px-4 sm:px-6">
            <div className="container mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-10">
                {BADGES.map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                        <div className="trust-badge-icon w-8 h-8 rounded-full bg-slate-50 shadow-sm border border-slate-200/60 flex items-center justify-center">
                            <b.Icon className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-2xs sm:text-xs font-semibold text-slate-600 tracking-wide whitespace-nowrap">
                            {b.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
