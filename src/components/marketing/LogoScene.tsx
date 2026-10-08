import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * LogoScene — W12 "the mark powers the system".
 *
 * Owner direction (after the W10 facet-flight review): the logo must NEVER
 * be broken apart to decorate the page — retire that idea entirely, and put
 * something else that is cool in its place.
 *
 * The new story: the mark is the POWER SOURCE. It sits in its display box
 * — intact, exactly like the header, never altered by a single pixel — with
 * connector pads on its lower edge like a chip package. As the visitor
 * scrolls, glowing circuit traces route themselves PCB-style (45° bends)
 * from those pads down into the capability cards below. Light pulses travel
 * the traces continuously like data on a bus, and each card's port switches
 * ON when its trace arrives: the capability icon (briefcase, link,
 * payments…) ignites. The mark does not turn into the cards — it POWERS
 * them. We build systems; the logo literally wires the system together.
 *
 * How it works (pure SVG/DOM — no WebGL, so there is no fallback state that
 * could ever look wrong):
 *
 *   1. Rest state — the display box carries the exact PracticePro mark
 *      (public/logo.svg geometry, 1:1). A one-shot scan sweep crosses the
 *      mark on entry; engineering corner brackets frame it.
 *   2. Scroll state (p 0→1, measured between the box and the bento grid):
 *      traces draw from pad i to card port i (staggered), each led by a
 *      bright drawing head; two light pulses then loop along every drawn
 *      trace. The box glow powers up as the routing runs.
 *   3. Landing — when a trace completes, the card's port ignites (dashed
 *      frame fills green, the capability icon pops in) and stays lit for
 *      the rest of the page.
 *
 * Everything is a pure function of p, so the whole sequence is fully
 * reversible by scrolling back up. prefers-reduced-motion skips the
 * routing (ports show their lit icons statically). Mobile: the same math —
 * pads and ports are measured live, so a stacked grid just means the
 * traces run further down the page.
 */

/** One trace per capability card — keep in sync with WHAT_WE_DO. */
const TRACE_COUNT = 7;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const r2 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);

/**
 * PCB-style routing: drop, 45° bend, horizontal lane, 45° bend, drop.
 * Lanes are spread per-trace so parallel traces run like a bus on a board.
 * When there is no room for diagonals it falls back to a clean Manhattan
 * (90°) route — both are authentic board routing.
 */
const route = (x0: number, y0: number, x1: number, y1: number, i: number): string => {
    const span = y1 - y0;
    const dx = x1 - x0;
    const s = dx >= 0 ? 1 : -1;
    let lane = y0 + span * 0.42 + (i - (TRACE_COUNT - 1) / 2) * 12;
    lane = Math.max(y0 + 24, Math.min(y1 - 24, lane));
    const d = Math.min(Math.abs(dx) * 0.5, 120, lane - y0 - 4, y1 - lane - 4);
    if (d < 2) {
        const my = r2((y0 + y1) / 2);
        return `M${r2(x0)} ${r2(y0)}L${r2(x0)} ${my}L${r2(x1)} ${my}L${r2(x1)} ${r2(y1)}`;
    }
    return [
        `M${r2(x0)} ${r2(y0)}`,
        `L${r2(x0)} ${r2(lane - d)}`,
        `L${r2(x0 + s * d)} ${r2(lane)}`,
        `L${r2(x1 - s * d)} ${r2(lane)}`,
        `L${r2(x1)} ${r2(lane + d)}`,
        `L${r2(x1)} ${r2(y1)}`,
    ].join('');
};

// ─── The scene ─────────────────────────────────────────────────────────────

const P_PATH = 'M20 12V34H26V26H38C42 26 44 23 44 18C44 13 42 10 38 10H20Z';
const COUNTER_PATH = 'M26 16H38C39.5 16 40 17.5 40 18C40 18.5 39.5 20 38 20H26V16Z';

const LogoScene: React.FC<{ className?: string }> = ({ className = '' }) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const capARef = useRef<HTMLSpanElement>(null);
    const capBRef = useRef<HTMLSpanElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const overlaySvgRef = useRef<SVGSVGElement>(null);
    const casingRefs = useRef<Array<SVGPathElement | null>>([]);
    const pathRefs = useRef<Array<SVGPathElement | null>>([]);
    const headRefs = useRef<Array<SVGCircleElement | null>>([]);
    const headGlowRefs = useRef<Array<SVGCircleElement | null>>([]);
    const pulseRefs = useRef<Array<SVGCircleElement | null>>([]);
    const padRefs = useRef<Array<HTMLSpanElement | null>>([]);

    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const host = box.closest('section') ?? box;
        const sockets = () => Array.from(document.querySelectorAll<HTMLElement>('[data-trace-socket]'));

        const apply = (now: number) => {
            const vh = window.innerHeight;
            const boxRect = box.getBoundingClientRect();
            const grid = document.querySelector<HTMLElement>('[data-trace-grid]');
            const gridRect = grid?.getBoundingClientRect();

            // ── p: 0 while the box centres the view, 1 once the bento top
            //    reaches the upper third. All rect math is viewport-based,
            //    so it works under the landing page's inner scroller.
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

            // ── The mark itself NEVER changes — only its glow powers up as
            //    the routing runs (it is the source, after all).
            box.style.setProperty('--w12-power', clamp01(p * 1.5).toFixed(3));

            // ── Caption crossfade.
            if (capARef.current) capARef.current.style.opacity = String(1 - clamp01((p - 0.40) / 0.12));
            if (capBRef.current) capBRef.current.style.opacity = String(clamp01((p - 0.46) / 0.12));

            // ── The routing overlay.
            const overlay = overlayRef.current;
            const oSvg = overlaySvgRef.current;
            if (!overlay || !oSvg) return;
            const w = window.innerWidth, h = window.innerHeight;
            if (oSvg.getAttribute('width') !== String(w)) {
                oSvg.setAttribute('width', String(w));
                oSvg.setAttribute('height', String(h));
            }

            const sockEls = sockets();
            const active = p > 0.02 && p < 0.985;
            overlay.style.display = active ? 'block' : 'none';
            if (!active) {
                const done = p >= 0.985;
                sockEls.forEach((s) => s.classList.toggle('trace-landed', done));
                padRefs.current.forEach((pad) => pad?.classList.toggle('is-live', done));
                return;
            }

            for (let i = 0; i < TRACE_COUNT; i++) {
                const casing = casingRefs.current[i];
                const main = pathRefs.current[i];
                const head = headRefs.current[i];
                const headGlow = headGlowRefs.current[i];
                const pad = padRefs.current[i];
                const sock = sockEls[i];
                if (!casing || !main || !head || !headGlow || !pad) continue;

                const land = 0.58 + i * 0.058;      // staggered arrivals
                const t = clamp01((p - 0.10) / (land - 0.10));
                const e = easeInOutCubic(t);

                if (sock) sock.classList.toggle('trace-landed', p >= land);
                pad.classList.toggle('is-live', t > 0.02);

                if (!sock || e <= 0) {
                    casing.style.opacity = '0';
                    main.style.opacity = '0';
                    head.style.opacity = '0';
                    headGlow.style.opacity = '0';
                    for (const pulse of [pulseRefs.current[i * 2], pulseRefs.current[i * 2 + 1]]) {
                        if (pulse) pulse.style.opacity = '0';
                    }
                    continue;
                }
                casing.style.opacity = '1';
                main.style.opacity = '1';

                const pr = pad.getBoundingClientRect();
                const sr = sock.getBoundingClientRect();
                const d = route(
                    pr.left + pr.width / 2, pr.bottom - 3,
                    sr.left + sr.width / 2, sr.top + 3,
                    i,
                );
                casing.setAttribute('d', d);
                main.setAttribute('d', d);

                const L = main.getTotalLength();
                main.style.strokeDasharray = `${r2(L)}`;
                main.style.strokeDashoffset = `${r2(L * (1 - e))}`;
                casing.style.strokeDasharray = `${r2(L)}`;
                casing.style.strokeDashoffset = `${r2(L * (1 - e))}`;

                // ── The drawing head — a bright tip with a soft halo.
                if (e > 0.002 && e < 0.998) {
                    const pt = main.getPointAtLength(L * e);
                    head.setAttribute('cx', r2(pt.x));
                    head.setAttribute('cy', r2(pt.y));
                    headGlow.setAttribute('cx', r2(pt.x));
                    headGlow.setAttribute('cy', r2(pt.y));
                    head.style.opacity = '1';
                    headGlow.style.opacity = '1';
                } else {
                    head.style.opacity = '0';
                    headGlow.style.opacity = '0';
                }

                // ── Data pulses riding the drawn portion (two per trace,
                //    half a cycle apart — like packets on a bus).
                for (let k = 0; k < 2; k++) {
                    const pulse = pulseRefs.current[i * 2 + k];
                    if (!pulse) continue;
                    if (e < 0.30) { pulse.style.opacity = '0'; continue; }
                    const phase = ((now * 0.00030) + i * 0.16 + k * 0.5) % 1;
                    const pt = main.getPointAtLength(L * e * phase);
                    pulse.setAttribute('cx', r2(pt.x));
                    pulse.setAttribute('cy', r2(pt.y));
                    pulse.style.opacity = String(0.35 + 0.65 * Math.sin(phase * Math.PI));
                }
            }
        };

        if (reduced) {
            // No routing: the box stays intact, ports carry their lit icons.
            document.querySelectorAll<HTMLElement>('[data-trace-socket]').forEach((s) => s.classList.add('trace-landed'));
            padRefs.current.forEach((pad) => pad?.classList.add('is-live'));
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
        const tick = (now: number) => {
            apply(now);
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
                <div ref={overlayRef} className="w12-trace-overlay" style={{ display: 'none' }} aria-hidden="true">
                    <svg ref={overlaySvgRef} width="100%" height="100%">
                        <defs>
                            <linearGradient id="w12-trace-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" stopColor="#16A34A" />
                                <stop offset="1" stopColor="#34D399" />
                            </linearGradient>
                        </defs>
                        {Array.from({ length: TRACE_COUNT }, (_, i) => (
                            <g key={i}>
                                <path
                                    ref={(el) => { casingRefs.current[i] = el; }}
                                    fill="none"
                                    stroke="#16A34A"
                                    strokeOpacity="0.20"
                                    strokeWidth="5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ opacity: 0 }}
                                />
                                <path
                                    ref={(el) => { pathRefs.current[i] = el; }}
                                    fill="none"
                                    stroke="url(#w12-trace-grad)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ opacity: 0 }}
                                />
                                <circle ref={(el) => { headGlowRefs.current[i] = el; }} r="8" fill="#22C55E" opacity="0" />
                                <circle ref={(el) => { headRefs.current[i] = el; }} r="3.2" fill="#22C55E" opacity="0" />
                                <circle ref={(el) => { pulseRefs.current[i * 2] = el; }} r="2.4" fill="#A7F3D0" opacity="0" />
                                <circle ref={(el) => { pulseRefs.current[i * 2 + 1] = el; }} r="2.4" fill="#A7F3D0" opacity="0" />
                            </g>
                        ))}
                    </svg>
                </div>,
                document.body
            )}

            <div ref={boxRef} className={`w10-logo-box ${className}`}>
                <span className="w10-logo-glow" aria-hidden="true" />
                <div className="w10-logo-stage">
                    <span className="w12-brackets" aria-hidden="true">
                        <i /><i /><i /><i />
                    </span>
                    <svg className="w10-logo-mark" viewBox="0 0 256 256" role="img" aria-label="The PracticePro mark">
                        <rect width="256" height="256" rx="0" fill="#16A34A" />
                        <g transform="scale(4.0)">
                            <path d="M10 54C10 55.1046 10.8954 56 12 56H52C53.1046 56 54 55.1046 54 54V48C54 46.8954 53.1046 46 52 46H12C10.8954 46 10 46.8954 10 48V54Z" fill="#FFFFFF" opacity="0.6" />
                            <path d="M12 44C12 45.1046 12.8954 46 14 46H50C51.1046 46 52 45.1046 52 44V38C52 36.8954 51.1046 36 50 36H14C12.8954 36 12 36.8954 12 38V44Z" fill="#FFFFFF" opacity="0.8" />
                            <path d="M14 34C14 35.1046 14.8954 36 16 36H48C49.1046 36 50 35.1046 50 34V10C50 8.89543 49.1046 8 48 8H16C14.8954 8 14 8.89543 14 10V34Z" fill="#FFFFFF" />
                            <path d={P_PATH} fill="#16A34A" />
                            <path d={COUNTER_PATH} fill="#FFFFFF" />
                        </g>
                    </svg>
                    <span className="w12-scan" aria-hidden="true" />
                </div>
                <p className="w10-logo-caption" aria-hidden="true">
                    <span ref={capARef}>The PracticePro mark</span>
                    <span ref={capBRef} style={{ opacity: 0 }}>One mark. Every system.</span>
                </p>
                {/* Connector pads — the traces leave the box from here. */}
                <div className="w12-pads" aria-hidden="true">
                    {Array.from({ length: TRACE_COUNT }, (_, i) => (
                        <span key={i} ref={(el) => { padRefs.current[i] = el; }} className="w12-pad" />
                    ))}
                </div>
            </div>
        </>
    );
};

export default LogoScene;
