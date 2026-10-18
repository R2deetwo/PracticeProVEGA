/**
 * HubFinalCTASection — the W18 aurora close, restored verbatim.
 */
import React from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';

// ─── HUB FINAL CTA (corporate hub) ─────────────────────────────────────────

export const HubFinalCTASection: React.FC<{ onContactSales: () => void; scrollTo: (id: string) => void }> = ({ onContactSales, scrollTo }) => {
    // W7: the closing argument goes dark — an aurora of the brand colors
    // breathing behind the headline, so the page ends the way it began.
    // W9: it settles in with the same soft reveal as the rest of the page.
    const ref = useScrollReveal<HTMLDivElement>();
    return (
    <section className="relative py-20 md:py-28 overflow-hidden w7-dark">
        <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />
        {/* Aurora — two brand-green clouds drifting on a slow loop */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[46rem] h-[26rem] rounded-full bg-emerald-600/15 blur-[120px] w7-aurora-a" aria-hidden="true" />
        <div className="absolute -bottom-40 left-1/4 w-[30rem] h-[22rem] rounded-full bg-emerald-300/10 blur-[110px] w7-aurora-b" aria-hidden="true" />
        <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

        <div ref={ref} className="w9-reveal container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl relative">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-display">
                Have a process that should{' '}
                <span className="text-transparent bg-clip-text inline-block" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                    run itself?
                </span>
            </h2>
            <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto">
                Tell us how your business works today — we&apos;ll show you what its system could
                look like. If one of the two products already fits, we&apos;ll say so. If it
                doesn&apos;t, we&apos;ll build the one that does.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button
                    variant="bare"
                    onClick={onContactSales}
                    className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-semibold hover:bg-slate-100 hover:scale-[1.02] transition-all shadow-xl shadow-black/40"
                >
                    Tell us what you need
                </Button>
                <Button
                    variant="bare"
                    onClick={() => scrollTo('ourWork')}
                    className="bg-transparent border-2 border-white/20 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-white/10 hover:border-white/30 transition-all"
                >
                    Explore both products
                </Button>
            </div>
            <p className="text-sm text-slate-500 mt-6">
                We reply within 24 hours.
            </p>
        </div>
    </section>
    );
};
