/**
 * FluidSeam + MarqueeStrip — the W18 liquid seams and the dark
 * capabilities ticker, restored verbatim.
 */
import React, { useEffect, useRef } from 'react';

// ─── FLUID SEAMS (W8 → W9 → W10) ───────────────────────────────────────────────
// W10: the curvature is BACK and impossible to miss. Each seam is now a
// true SVG wave — the previous section's colour pours into the next through
// a visible arc whose crest slides and breathes as the seam crosses the
// viewport (plus a slow ambient drift). The W9 organic-radius blob read
// as a straight cut; this is a real curve again, and it morphs as you
// scroll from page to page.

export const FluidSeam: React.FC<{ from: string; to: string; phase?: number }> = ({ from, to, phase = 0 }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    useEffect(() => {
        const host = hostRef.current;
        const path = pathRef.current;
        if (!host || !path) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // p: 0 as the seam enters from the bottom, 1 as it leaves the top.
        // The wave's crest slides horizontally and its amplitude breathes
        // with the seam's viewport position — morphing, never static.
        // The fill paints the region ABOVE the curve with the previous
        // section's colour, which then pours into the next section below —
        // dark at top, flowing to light at the bottom, through a living arc.
        const draw = (p: number, t: number) => {
            const breath = 0.5 + 0.5 * Math.sin(Math.PI * p);          // peaks mid-viewport
            const amp = 13 + 15 * breath;                              // 13–28 of 100 units
            const slide = Math.sin(t * 0.35 + phase * 1.7) * 8;         // slow ambient drift
            const cRest = Math.sin(p * Math.PI * 1.3 + phase) * amp;
            const cLead = Math.cos(p * Math.PI * 1.1 + phase * 0.8) * amp;
            const a = 46 - cRest * 0.35 + slide * 0.5;
            const b = 54 + cLead * 0.35 - slide * 0.5;
            path.setAttribute('d',
                `M0,0 L100,0 L100,${b.toFixed(2)} C70,${(b - amp * 0.9).toFixed(2)} 30,${(a + amp * 0.9).toFixed(2)} 0,${a.toFixed(2)} Z`);
        };
        if (reduced) { draw(0.5, 0); return; }
        let inView = true;
        let rafId: number | null = null;
        const t0 = performance.now();
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
            if (inView && rafId === null) rafId = requestAnimationFrame(frame);
        }, { threshold: 0 });
        io.observe(host);
        const frame = (now: number) => {
            const rect = host.getBoundingClientRect();
            const vh = window.innerHeight;
            const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
            draw(p, (now - t0) / 1000);
            rafId = inView ? requestAnimationFrame(frame) : null;
        };
        rafId = requestAnimationFrame(frame);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            io.disconnect();
        };
    }, [phase]);
    return (
        <div ref={hostRef} className="relative h-24 sm:h-32 overflow-hidden w10-seam" style={{ background: to }} aria-hidden="true">
            {/* The previous section's colour, hanging into this one through a
                living curve — the wave shape is the liquid boundary. */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path ref={pathRef} fill={from} d="M0,0 L100,0 L100,54 C70,42 30,58 0,46 Z" />
            </svg>
        </div>
    );
};

// ─── MARQUEE (W7) — the capabilities ticker ─────────────────────────────────
// A slow infinite band that carries the builder's vocabulary across the
// seam between the dark hero and the light body. Pure CSS animation;
// frozen under prefers-reduced-motion.

const MARQUEE_ITEMS = [
    'Custom Systems',
    'Custom Integrations',
    'Customer Portals',
    'Payments & Billing',
    'Workflow Automation',
    'AI & Automation',
    'Mobile Apps',
    'Web Platforms',
    'Security & Compliance',
];

export const MarqueeStrip: React.FC = () => (
    <div className="relative overflow-hidden border-y border-white/5 bg-[#0A101C] py-5" aria-label="What we build">
        <div className="w7-marquee-track flex items-center gap-10 whitespace-nowrap w-max">
            {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
                    {MARQUEE_ITEMS.map((item) => (
                        <span key={`${dup}-${item}`} className="flex items-center gap-10">
                            {/* R33: the ticker speaks the engineering register —
                                IBM Plex Mono caps, the system-readout voice. */}
                            <span className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.28em] text-slate-500">
                                {item}
                            </span>
                            <span className="w-1.5 h-1.5 rotate-45 bg-gradient-to-br from-emerald-300 to-emerald-500 opacity-70" aria-hidden="true" />
                        </span>
                    ))}
                </div>
            ))}
        </div>
        {/* Edge fades so the band dissolves instead of clipping */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0A101C] to-transparent pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0A101C] to-transparent pointer-events-none" aria-hidden="true" />
    </div>
);
