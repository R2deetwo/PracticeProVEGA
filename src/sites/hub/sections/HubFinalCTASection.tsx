/**
 * HubFinalCTASection — the aurora close, rebuilt R33 with a technical
 * stage (owner: "make it look more tech… keep my PracticePro Systems
 * brand colors").
 *
 * The close now ends the way the page began — on geometry. Behind the
 * argument: a BLUEPRINT GROUND — an SVG grid of hairline construction
 * lines (major + minor rulings like drafting paper) with two slow
 * elements that never fight the copy:
 *   1. a large hairline ring, dashed like a compass construction,
 *      rotating once a minute — the drafting instrument's arc;
 *   2. the aurora itself (kept from W18 — the brand's emerald breath).
 * The copy column settles in with the page's staggered reveal, and the
 * headline's gradient words stay exactly the brand mint/emerald ramp.
 *
 * Reduced motion holds a static composed frame (grid + ring, no spin).
 */
import React from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';

// ─── HUB FINAL CTA (corporate hub) ─────────────────────────────────────────

export const HubFinalCTASection: React.FC<{ onContactSales: () => void; scrollTo: (id: string) => void }> = ({ onContactSales, scrollTo }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
    <section className="relative py-20 md:py-28 overflow-hidden w7-dark">
        <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />

        {/* R33: the blueprint ground — drafting-paper rulings on the night
            ground. Two densities (100 / 20 unit cells), emerald hairlines
            at 4–6% so the grid reads as structure, never noise. */}
        <div className="absolute inset-0 opacity-100" aria-hidden="true">
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <defs>
                    <pattern id="hub-cta-grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M20 0 L0 0 0 20" fill="none" stroke="rgb(52 211 153 / 0.05)" strokeWidth="0.5" />
                    </pattern>
                    <pattern id="hub-cta-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
                        <rect width="100" height="100" fill="url(#hub-cta-grid-minor)" />
                        <path d="M100 0 L0 0 0 100" fill="none" stroke="rgb(52 211 153 / 0.09)" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hub-cta-grid-major)" />
            </svg>
            {/* The grid dissolves toward the edges — the stage, lit center */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,16,28,0.55)_62%,#0A101C_100%)]" />
        </div>

        {/* R33: the construction ring — a compass arc, dashed, rotating
            once a minute behind the argument. Presence, not performance. */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[44rem] h-[44rem] max-w-[140vw] max-h-[140vw] pointer-events-none" aria-hidden="true">
            <svg viewBox="0 0 400 400" className="w-full h-full hub-cta-ring">
                <circle cx="200" cy="200" r="196" fill="none" stroke="rgb(110 231 183 / 0.14)" strokeWidth="0.6" strokeDasharray="2 6" />
                <circle cx="200" cy="200" r="168" fill="none" stroke="rgb(52 211 153 / 0.10)" strokeWidth="0.6" />
                {/* cardinal ticks — the drafting instrument's index */}
                {[0, 90, 180, 270].map((deg) => (
                    <line
                        key={deg}
                        x1="200" y1="4" x2="200" y2="18"
                        stroke="rgb(110 231 183 / 0.28)" strokeWidth="1"
                        transform={`rotate(${deg} 200 200)`}
                    />
                ))}
            </svg>
        </div>

        {/* Aurora — two brand-green clouds drifting on a slow loop (W18) */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[46rem] h-[26rem] rounded-full bg-emerald-600/15 blur-[120px] w7-aurora-a" aria-hidden="true" />
        <div className="absolute -bottom-40 left-1/4 w-[30rem] h-[22rem] rounded-full bg-emerald-300/10 blur-[110px] w7-aurora-b" aria-hidden="true" />
        <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

        <div ref={ref} className="w9-reveal container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl relative">
            {/* R33: a mono microlabel — the register of a build ticket,
                carrying the same promise the copy below makes. */}
            <p className="font-mono text-2xs sm:text-xs tracking-[0.3em] uppercase text-emerald-400/80 mb-6">
                Next build — yours
            </p>
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
                    className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-semibold hover:bg-slate-100 transition-all duration-150 active:scale-[0.98] shadow-lg shadow-black/30"
                >
                    Tell us what you need
                </Button>
                <Button
                    variant="bare"
                    onClick={() => scrollTo('ourWork')}
                    className="bg-transparent border border-white/20 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-white/10 hover:border-white/30 transition-all duration-150 active:scale-[0.98]"
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
