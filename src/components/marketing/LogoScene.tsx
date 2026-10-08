import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * LogoScene — W10 "the mark becomes the system".
 *
 * Owner direction (after the W9 3D assembly read as "twisted"):
 * the logo should already be there — CORRECT and INTACT, exactly like it
 * looks in the header — inside a box. Then, as the user scrolls down, the
 * mark disassembles: the P flattens into its triangular facets, and those
 * triangles fly across the page into the capability boxes below
 * ("Custom business systems", "Portals", …) — becoming the elements of
 * those cards. The pieces of the logo literally become the page.
 *
 * How it works (pure SVG/DOM — no WebGL, so there is no fallback box that
 * could ever look wrong):
 *
 *   1. Rest state — a clean display box carries the exact PracticePro mark
 *      (public/logo.svg geometry, 1:1): green square, the three white
 *      blocks, and the green P cut out of the top block.
 *   2. Scroll state (p 0→1, measured between the box and the bento grid):
 *      the solid P crossfades into seven shard polygons that tile the P
 *      exactly (same silhouette at the swap frame), then the shards peel
 *      off one after another — each flying a curved path (quadratic bezier,
 *      alternating sides) into its card's socket, rotating and shrinking to
 *      the socket's glyph size.
 *   3. Landing — when a shard arrives, its card socket (a dashed outline)
 *      fills with the landed facet: the triangles now form the elements of
 *      the boxes for the rest of the page. The display box keeps the three
 *      blocks with a dashed ghost of the P that left.
 *
 * Everything is a pure function of p, so the whole sequence is fully
 * reversible by scrolling back up. prefers-reduced-motion skips the flight
 * (cards show their glyphs statically). Mobile: same math — sockets are
 * measured live, so a stacked grid just means the pieces stream further
 * down the page.
 */

// ─── The shard set — the P, flattened into 7 facets (64-unit logo space) ───
// Coordinates trace public/logo.svg's P path 1:1. Union of the 7 shards
// tiles the solid P exactly; the counter hole (x26-40, y16-20) stays open.
// See the analysis in the repo worklog (task-80) for the triangulation.

export interface ShardDef {
    /** SVG polygon points, "x,y x,y …" in the 64-unit logo space. */
    pts: string;
    /** Landing rotation for this facet, degrees. */
    angle: number;
}

export const LOGO_SHARDS: ShardDef[] = [
    { pts: '20,10 26,10 20,34', angle: -14 },                  // stem, left
    { pts: '26,10 26,34 20,34', angle: 10 },                   // stem, right
    { pts: '26,10 38,10 26,16', angle: -8 },                   // bowl, top-left
    { pts: '38,10 43.9,16 26,16', angle: 16 },                 // bowl, top-right
    { pts: '40,16 43.9,16 43.9,20 40,20', angle: -18 },        // bowl, right sliver
    { pts: '26,20 38,26 26,26', angle: 6 },                    // bowl, bottom-left
    { pts: '26,20 43.9,20 43.3,23 38,26', angle: -12 },        // bowl, bottom-right
];

/** Tight viewBox around the P for card glyphs (64-space, padded). */
export const SHARD_VIEWBOX = '14 4 36 36';

// Per-shard derived geometry (computed once): centroid + bounding size.
type ShardGeom = { cx: number; cy: number; maxDim: number };
const shardGeom = (pts: string): ShardGeom => {
    const xs: number[] = [], ys: number[] = [];
    for (const pair of pts.trim().split(/\s+/)) {
        const [x, y] = pair.split(',').map(Number);
        xs.push(x); ys.push(y);
    }
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    const maxDim = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return { cx, cy, maxDim };
};
const SHARD_GEOMS = LOGO_SHARDS.map((s) => shardGeom(s.pts));

/** Per-shard centroids (64-unit space) — card glyphs rotate around these. */
export const SHARD_CENTERS: Array<{ cx: number; cy: number }> = SHARD_GEOMS.map((g) => ({ cx: g.cx, cy: g.cy }));

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const quad = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

// ─── The scene ─────────────────────────────────────────────────────────────

const P_PATH = 'M20 12V34H26V26H38C42 26 44 23 44 18C44 13 42 10 38 10H20Z';
const COUNTER_PATH = 'M26 16H38C39.5 16 40 17.5 40 18C40 18.5 39.5 20 38 20H26V16Z';

const LogoScene: React.FC<{ className?: string }> = ({ className = '' }) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const solidPRef = useRef<SVGPathElement>(null);
    const ghostPRef = useRef<SVGPathElement>(null);
    const capARef = useRef<HTMLSpanElement>(null);
    const capBRef = useRef<HTMLSpanElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const overlaySvgRef = useRef<SVGSVGElement>(null);
    const polyRefs = useRef<Array<SVGPolygonElement | null>>([]);

    useEffect(() => {
        const box = boxRef.current;
        const svg = svgRef.current;
        if (!box || !svg) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const host = box.closest('section') ?? box;
        const sockets = () => Array.from(document.querySelectorAll<HTMLElement>('[data-shard-socket]'));

        const apply = () => {
            const vh = window.innerHeight;
            const boxRect = box.getBoundingClientRect();
            const svgRect = svg.getBoundingClientRect();
            const grid = document.querySelector<HTMLElement>('[data-shard-grid]');
            const gridRect = grid?.getBoundingClientRect();

            // ── p: 0 while the box centres the view, 1 once the bento top
            //    reaches the upper third. All rect math (works under the
            //    landing page's inner scroller).
            const boxCy = boxRect.top + boxRect.height / 2;
            const offset = boxCy - (gridRect ? gridRect.top : boxRect.bottom);
            const cyAtStart = 0.62 * vh;
            const cyAtEnd = 0.30 * vh + offset;
            let p: number;
            if (cyAtEnd >= cyAtStart) {
                // Degenerate span (very short viewports) — fall back to a
                // fixed 320px of travel so the sequence still plays.
                const travel = Math.max(1, cyAtStart - cyAtEnd + 320);
                p = clamp01((cyAtStart - boxCy) / travel);
                if (gridRect && gridRect.top <= 0.30 * vh) p = 1;
            } else {
                p = clamp01((cyAtStart - boxCy) / (cyAtStart - cyAtEnd));
            }

            // ── The box: solid P out (shattering), dashed ghost in.
            const pFade = clamp01((p - 0.02) / 0.08);
            if (solidPRef.current) solidPRef.current.style.opacity = String(1 - pFade);
            if (ghostPRef.current) ghostPRef.current.style.opacity = String(0.5 * clamp01((p - 0.06) / 0.30));
            if (capARef.current) capARef.current.style.opacity = String(1 - clamp01((p - 0.40) / 0.12));
            if (capBRef.current) capBRef.current.style.opacity = String(clamp01((p - 0.46) / 0.12));

            // ── The flight overlay.
            const overlay = overlayRef.current;
            const oSvg = overlaySvgRef.current;
            if (!overlay || !oSvg) return;
            const w = window.innerWidth, h = window.innerHeight;
            if (oSvg.getAttribute('width') !== String(w)) { oSvg.setAttribute('width', String(w)); oSvg.setAttribute('height', String(h)); }

            const active = p > 0.02 && p < 0.985;
            overlay.style.display = active ? 'block' : 'none';
            if (!active) {
                document.querySelectorAll<HTMLElement>('[data-shard-socket]').forEach((s) => {
                    s.classList.toggle('shard-landed', p >= 0.985);
                });
                return;
            }

            const k64 = svgRect.width / 256 * 4; // px per 64-unit
            const sockEls = sockets();
            for (let i = 0; i < LOGO_SHARDS.length; i++) {
                const poly = polyRefs.current[i];
                const sock = sockEls[i];
                if (!poly) continue;
                const g = SHARD_GEOMS[i];
                const land = 0.58 + i * 0.058;      // staggered arrivals
                const t = clamp01((p - 0.10) / (land - 0.10));
                const e = easeInOutCubic(t);

                if (sock) sock.classList.toggle('shard-landed', p >= land);
                if (t <= 0) { poly.style.opacity = '0'; continue; }

                const ax = svgRect.left + g.cx * k64;
                const ay = svgRect.top + g.cy * k64;
                let bx = ax, by = ay, endScale = k64;
                if (sock) {
                    const r = sock.getBoundingClientRect();
                    bx = r.left + r.width / 2;
                    by = r.top + r.height / 2;
                    endScale = (Math.min(r.width, r.height) * 0.68) / g.maxDim;
                }
                // Curved path: control point off the straight line, sides
                // alternating so the fan reads as a scatter, not a march.
                const dx = bx - ax, dy = by - ay;
                const len = Math.hypot(dx, dy) || 1;
                const side = i % 2 === 0 ? 1 : -1;
                const bulge = len * (0.16 + 0.12 * ((i * 37) % 10) / 10) * side;
                const cx = (ax + bx) / 2 + (-dy / len) * bulge;
                const cyq = (ay + by) / 2 + (dx / len) * bulge;

                const x = quad(ax, cx, bx, e);
                const y = quad(ay, cyq, by, e);
                const s = k64 + (endScale - k64) * e;
                const ang = LOGO_SHARDS[i].angle * e;
                poly.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(2)}) scale(${s.toFixed(4)}) translate(${-g.cx} ${-g.cy})`);
                poly.style.opacity = t > 0.9 ? String(1 - (t - 0.9) / 0.1) : '1';
            }
        };

        if (reduced) {
            // No flight: the box stays intact, cards carry their glyphs.
            document.querySelectorAll<HTMLElement>('[data-shard-socket]').forEach((s) => s.classList.add('shard-landed'));
            if (capARef.current) capARef.current.style.opacity = '1';
            return;
        }

        let inView = true;
        let rafId: number | null = null;
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
            if (inView && rafId === null) rafId = requestAnimationFrame(tick);
        }, { threshold: 0 });
        io.observe(host);
        const tick = () => {
            apply();
            rafId = inView ? requestAnimationFrame(tick) : null;
        };
        rafId = requestAnimationFrame(tick);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            io.disconnect();
        };
    }, []);

    return (
        <>
            {createPortal(
                <div ref={overlayRef} className="w10-shard-overlay" style={{ display: 'none' }} aria-hidden="true">
                    <svg ref={overlaySvgRef} width="100%" height="100%">
                        {LOGO_SHARDS.map((sh, i) => (
                            <polygon
                                key={i}
                                ref={(el) => { polyRefs.current[i] = el; }}
                                points={sh.pts}
                                fill="url(#w10-shard-grad)"
                                style={{ opacity: 0 }}
                            />
                        ))}
                    </svg>
                </div>,
                document.body
            )}

            <div ref={boxRef} className={`w10-logo-box ${className}`}>
                <span className="w10-logo-glow" aria-hidden="true" />
                {/* Shared paint server for overlay + card glyphs. */}
                <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
                    <defs>
                        <linearGradient id="w10-shard-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="#16A34A" />
                            <stop offset="1" stopColor="#059669" />
                        </linearGradient>
                    </defs>
                </svg>
                <svg ref={svgRef} className="w10-logo-mark" viewBox="0 0 256 256" role="img" aria-label="The PracticePro mark">
                    <rect width="256" height="256" rx="0" fill="#16A34A" />
                    <g transform="scale(4.0)">
                        <path d="M10 54C10 55.1046 10.8954 56 12 56H52C53.1046 56 54 55.1046 54 54V48C54 46.8954 53.1046 46 52 46H12C10.8954 46 10 46.8954 10 48V54Z" fill="#FFFFFF" opacity="0.6" />
                        <path d="M12 44C12 45.1046 12.8954 46 14 46H50C51.1046 46 52 45.1046 52 44V38C52 36.8954 51.1046 36 50 36H14C12.8954 36 12 36.8954 12 38V44Z" fill="#FFFFFF" opacity="0.8" />
                        <path d="M14 34C14 35.1046 14.8954 36 16 36H48C49.1046 36 50 35.1046 50 34V10C50 8.89543 49.1046 8 48 8H16C14.8954 8 14 8.89543 14 10V34Z" fill="#FFFFFF" />
                        <path ref={solidPRef} d={P_PATH} fill="#16A34A" />
                        <path d={COUNTER_PATH} fill="#FFFFFF" />
                        <path ref={ghostPRef} d={P_PATH} fill="none" stroke="#16A34A" strokeWidth="0.55" strokeDasharray="2 1.6" opacity="0" />
                    </g>
                </svg>
                <p className="w10-logo-caption" aria-hidden="true">
                    <span ref={capARef}>The PracticePro mark</span>
                    <span ref={capBRef} style={{ opacity: 0 }}>…and it becomes your system</span>
                </p>
            </div>
        </>
    );
};

export default LogoScene;
