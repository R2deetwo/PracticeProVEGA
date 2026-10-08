import React, { useEffect, useRef } from 'react';

/**
 * SystemSquares — W9 "the living page": the logo's squares, riding on.
 *
 * In the What-We-Do section the 3D mark assembles and little squares peel
 * off it (LogoScene). This layer picks up the story: from that section to
 * the end of the page, a sparse field of small brand squares — moss,
 * emerald, amber — drifts downward past the content, sways with the
 * scroll, and leans away from the cursor. The page stays one continuous
 * system; the squares are its modules on the move.
 *
 * Deliberately quiet: ~20 squares at low alpha, rounded, slow. Frozen out
 * entirely under prefers-reduced-motion (the canvas is display:none — see
 * the W9 reduced-motion block in index.css). Pointer-events: none, so it
 * never interferes with reading or clicking.
 */
const SystemSquares: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // The corporate hub scrolls inside its own element; the squares
        // ride the whole viewport regardless of which element scrolls.
        const scroller = document.querySelector('[data-public-page]') as HTMLElement | null;

        let w = 0, h = 0, dpr = 1;
        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            w = window.innerWidth;
            h = window.innerHeight;
            canvas!.width = Math.round(w * dpr);
            canvas!.height = Math.round(h * dpr);
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        // ── The squares ─────────────────────────────────────────────
        const COLORS = ['#16A34A', '#059669', '#D97706', '#34D399', '#F59E0B'];
        interface Sq {
            x: number; y: number; size: number; color: string;
            vy: number; swayA: number; swayW: number; phase: number;
            rot: number; spin: number; alpha: number;
            ox: number; oy: number; // cursor-repulsion offset (decays)
        }
        const COUNT = w < 700 ? 10 : 20;
        const squares: Sq[] = [];
        for (let i = 0; i < COUNT; i++) {
            squares.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 5 + Math.random() * 11,
                color: COLORS[i % COLORS.length],
                vy: 9 + Math.random() * 16, // px/s downward
                swayA: 14 + Math.random() * 26,
                swayW: 0.25 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
                rot: Math.random() * Math.PI,
                spin: (Math.random() - 0.5) * 0.5,
                alpha: 0.05 + Math.random() * 0.05,
                ox: 0, oy: 0,
            });
        }

        // ── Inputs: cursor + scroll wind ────────────────────────────
        let mx = -9999, my = -9999;
        const onPointer = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };
        window.addEventListener('pointermove', onPointer, { passive: true });

        let lastScroll = scroller?.scrollTop ?? window.scrollY;
        let wind = 0; // horizontal impulse from scrolling

        // ── Visibility gate: live only once the logo section is passed,
        //    so the squares literally follow the logo's assembly. ─────
        let live = false;
        let sectionEl: HTMLElement | null = null;
        const io = new IntersectionObserver(() => { /* presence tracked in the frame loop */ }, { threshold: 0 });
        const attach = () => {
            sectionEl = document.getElementById('whatWeDo');
            if (sectionEl) io.observe(sectionEl);
        };
        attach();
        // The section mounts with this component's parent — retry once
        // on the next frame to be safe against ordering.
        requestAnimationFrame(attach);

        const onVis = () => { running = running && !document.hidden; if (!document.hidden) { running = true; rafId = requestAnimationFrame(loop); } };
        let rafId: number | null = null;
        let running = true;
        document.addEventListener('visibilitychange', onVis);

        const REPEL_R = 120;
        let last = performance.now();
        const loop = (now: number) => {
            if (!running) { rafId = null; return; }
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            // Scroll wind + liveness.
            const st = scroller?.scrollTop ?? window.scrollY;
            const dst = st - lastScroll;
            lastScroll = st;
            wind += Math.max(-30, Math.min(30, dst * 0.35));
            wind *= 0.9;
            if (sectionEl) {
                const r = sectionEl.getBoundingClientRect();
                const shouldLive = r.bottom < h * 0.75; // past the logo stage
                if (shouldLive !== live) {
                    live = shouldLive;
                    canvas!.classList.toggle('is-live', live);
                }
            }

            ctx!.clearRect(0, 0, w, h);
            const t = now / 1000;
            for (const sq of squares) {
                sq.y += sq.vy * dt;
                sq.x += Math.sin(t * sq.swayW + sq.phase) * sq.swayA * dt + wind * dt * 2.2;
                sq.rot += sq.spin * dt;

                // Cursor repulsion — squares lean away, then drift back.
                const dx = sq.x + sq.ox - mx;
                const dy = sq.y + sq.oy - my;
                const d = Math.hypot(dx, dy);
                if (d < REPEL_R && d > 0.01) {
                    const f = (REPEL_R - d) / REPEL_R;
                    sq.ox += (dx / d) * f * 90 * dt;
                    sq.oy += (dy / d) * f * 90 * dt;
                }
                sq.ox *= 0.92; sq.oy *= 0.92;

                // Wrap vertically: exiting the bottom re-enters on top.
                if (sq.y - sq.size > h) { sq.y = -sq.size - Math.random() * 60; sq.x = Math.random() * w; }
                if (sq.y + sq.size < -80) sq.y = h + sq.size;
                if (sq.x - sq.size > w + 40) sq.x = -sq.size;
                if (sq.x + sq.size < -40) sq.x = w + sq.size;

                ctx!.save();
                ctx!.translate(sq.x + sq.ox, sq.y + sq.oy);
                ctx!.rotate(sq.rot);
                ctx!.globalAlpha = sq.alpha;
                ctx!.fillStyle = sq.color;
                const s = sq.size;
                if (typeof ctx!.roundRect === 'function') {
                    ctx!.beginPath();
                    ctx!.roundRect(-s / 2, -s / 2, s, s, s * 0.22);
                    ctx!.fill();
                } else {
                    ctx!.fillRect(-s / 2, -s / 2, s, s);
                }
                ctx!.restore();
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        return () => {
            running = false;
            if (rafId !== null) cancelAnimationFrame(rafId);
            window.removeEventListener('resize', resize);
            window.removeEventListener('pointermove', onPointer);
            document.removeEventListener('visibilitychange', onVis);
            io.disconnect();
        };
    }, []);

    // aria-hidden + pointer-events-none: this is atmosphere, not content.
    return <canvas ref={canvasRef} className="w9-squares-canvas" aria-hidden="true" />;
};

export default SystemSquares;
