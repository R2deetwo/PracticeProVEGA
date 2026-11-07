/**
 * FluidSeam + MarqueeStrip — the W18 liquid seams and the capabilities
 * ticker. R72: the ticker is no longer a free-floating band behind its own
 * seam — it is the hero's docked base bar (see the marquee note below).
 */
import React, { useEffect, useRef } from 'react';

// ─── FLUID SEAMS (W8 → W9 → W10 → R73) ──────────────────────────────────────
// W10: the curvature is BACK and impossible to miss. Each seam is now a
// true SVG wave — the previous section's colour pours into the next through
// a visible arc whose crest slides and breathes as the seam crosses the
// viewport (plus a slow ambient drift). The W9 organic-radius blob read
// as a straight cut; this is a real curve again, and it morphs as you
// scroll from page to page.
//
// R73 (the silk pass): all seams share ONE rAF pass. Each seam used to run
// its own loop that read getBoundingClientRect() and then wrote the path
// `d` — with several seams on the page those reads and writes interleaved
// every frame, forcing a synchronous layout per seam (the classic
// layout-thrash stutter while scrolling). The shared pass measures EVERY
// visible seam first (reads only — at most one layout pass per frame),
// then paints every path. Same wave, same timing, no thrash.

type SeamJob = { measure: () => void; paint: (now: number) => void };
const seamJobs = new Set<SeamJob>();
let seamRaf = 0;
const runSeamFrame = (now: number) => {
    seamRaf = 0;
    if (seamJobs.size === 0) return;
    seamJobs.forEach((job) => job.measure());
    seamJobs.forEach((job) => job.paint(now));
    if (seamJobs.size > 0) seamRaf = requestAnimationFrame(runSeamFrame);
};
const scheduleSeamFrame = () => {
    if (!seamRaf) seamRaf = requestAnimationFrame(runSeamFrame);
};

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
        const t0 = performance.now();
        let p = 0.5;
        const job: SeamJob = {
            measure: () => {
                const rect = host.getBoundingClientRect();
                const vh = window.innerHeight;
                p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
            },
            paint: (now: number) => draw(p, (now - t0) / 1000),
        };
        const io = new IntersectionObserver((entries) => {
            if (entries.some((en) => en.isIntersecting)) {
                seamJobs.add(job);
                scheduleSeamFrame();
            } else {
                seamJobs.delete(job);
            }
        }, { threshold: 0 });
        io.observe(host);
        return () => {
            seamJobs.delete(job);
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

// ─── MARQUEE (W7 → R72) — the capabilities ticker, docked ──────────────────
// R72 (owner direction): the ticker stops sitting on its own strip. It rode
// a liquid seam below the hero — a light wave gap that read as "a separate
// thing floating under the page" ("why does it sit separately on that
// strip… attach it to the bottom of the first page"). Now it IS the bottom
// of the first page: the hero cedes exactly one 3rem base bar, the ticker
// sits flush against it on the same navy ground behind a single hairline,
// and the pair fills the first viewport together (hero
// min-h-[calc(100dvh-3rem)] + this h-12 strip = 100dvh). Slimmer and
// neater: a fixed 48px band (was ~62px of padding plus a 96–128px seam
// above it), 12px mono caps, 4px diamonds, tighter tracking. The seam
// below pours the hero's own navy into the white body. Slow infinite loop,
// pure CSS; frozen under prefers-reduced-motion.

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
    <div
        className="relative h-12 overflow-hidden border-t border-white/10 bg-[#050B18]"
        aria-label="What we build"
    >
        <div className="w7-marquee-track flex h-full items-center gap-8 whitespace-nowrap w-max">
            {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center gap-8" aria-hidden={dup === 1}>
                    {MARQUEE_ITEMS.map((item) => (
                        <span key={`${dup}-${item}`} className="flex items-center gap-8">
                            {/* R33: the ticker speaks the engineering register —
                                IBM Plex Mono caps, the system-readout voice. */}
                            <span className="font-mono text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                                {item}
                            </span>
                            <span className="w-1 h-1 rotate-45 bg-gradient-to-br from-emerald-300 to-emerald-500 opacity-70" aria-hidden="true" />
                        </span>
                    ))}
                </div>
            ))}
        </div>
        {/* Edge fades so the band dissolves instead of clipping */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#050B18] to-transparent pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#050B18] to-transparent pointer-events-none" aria-hidden="true" />
    </div>
);
