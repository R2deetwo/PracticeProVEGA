import React, { useEffect, useRef } from 'react';

/**
 * SwirlBands — the shared silk-band canvas for the PracticePro and Vega
 * heroes (R50, Prompt 3).
 *
 * Owner direction: custom, silky-smooth swirling line/band animations on
 * both heroes, inspired by Bitnomial's fluid motion but adapted to the
 * Practice Pro brand palette. Each band is drawn as a single stroked path
 * whose vertical position is the sum of three harmonics of a base
 * frequency (octaves at 1×, ~2.3× and ~4.1× with decaying amplitudes) —
 * the brand's fractal character, in motion: the bands twist and morph
 * together without ever cycling back to a recognizable loop.
 *
 * Performance & accessibility, per the brief:
 *   - one <canvas>, requestAnimationFrame, no layout reads in the loop
 *     (all geometry is recomputed only on resize);
 *   - high-DPI aware (devicePixelRatio capped at 2);
 *   - pauses its work when the section is offscreen (IntersectionObserver)
 *     or the tab is hidden (visibilitychange);
 *   - prefers-reduced-motion: draws ONE static frame and never animates.
 *
 * Layering contract (the caller owns it): the canvas sits at z-0 behind
 * the faded hero image + dark gradient overlay (z-10) and the hero
 * typography (z-20).
 *
 * Variants:
 *   hub  — PracticePro Systems: translucent deep navy, dark slate and
 *          muted gold line accents, 15–30% opacity.
 *   vega — legal-tech: subtle cyan and gold highlights, so Vega feels
 *          distinct while staying visually connected to the parent brand.
 */

type SwirlVariant = 'hub' | 'vega';

/** Per-variant stroke palettes (cycled across bands) and drift rates. */
const VARIANTS: Record<SwirlVariant, {
    strokes: string[];
    /** Radians per second — the silk speed. */
    baseSpeed: number;
}> = {
    hub: {
        // deep navy → dark slate (slate-400 reads on slate-950) → muted gold
        strokes: ['#3B5E8C', '#94A3B8', '#C9A227'],
        baseSpeed: 0.16,
    },
    vega: {
        // legal-tech cyan + warm gold
        strokes: ['#67E8F9', '#D4AF6A', '#67E8F9'],
        baseSpeed: 0.2,
    },
};

/** Static band geometry — recomputed against the canvas size on resize. */
interface Band {
    yc: number;        // y-centre as a fraction of height
    amp: number;       // amplitude as a fraction of height
    k: number;         // base frequency, radians per width
    phase: number;     // initial phase
    speed: number;     // radians per second (signed drift)
    width: number;     // stroke width
    alpha: number;     // 0.15–0.30 per the brief
    color: string;
}

const BAND_SPECS: Array<Pick<Band, 'yc' | 'amp' | 'k' | 'phase' | 'speed' | 'width' | 'alpha'>> = [
    { yc: 0.30, amp: 0.060, k: 1.55, phase: 0.0, speed: 1.00, width: 1.0, alpha: 0.30 },
    { yc: 0.38, amp: 0.075, k: 1.90, phase: 1.7, speed: -0.75, width: 1.7, alpha: 0.225 },
    { yc: 0.47, amp: 0.052, k: 1.25, phase: 3.1, speed: 0.60, width: 2.4, alpha: 0.15 },
    { yc: 0.56, amp: 0.088, k: 2.20, phase: 0.9, speed: -1.15, width: 1.2, alpha: 0.30 },
    { yc: 0.64, amp: 0.064, k: 1.65, phase: 2.4, speed: 0.85, width: 1.9, alpha: 0.225 },
    { yc: 0.72, amp: 0.048, k: 2.45, phase: 4.0, speed: -0.55, width: 1.0, alpha: 0.15 },
];

export const SwirlBands: React.FC<{ variant: SwirlVariant; className?: string }> = ({ variant, className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { strokes, baseSpeed } = VARIANTS[variant];
        const bands: Band[] = BAND_SPECS.map((s, i) => ({
            ...s,
            speed: s.speed * baseSpeed,
            color: strokes[i % strokes.length],
        }));

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let raf = 0;
        let visible = true;
        let w = 0;
        let h = 0;
        let last = performance.now();

        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = Math.max(1, Math.round(rect.width));
            h = Math.max(1, Math.round(rect.height));
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        /** One band path: three octaves of the base frequency — the
         *  fractal meander. x goes 0..w in 24 steps; the curve is smooth
         *  at any size because the harmonics are phase-locked. */
        const drawBand = (b: Band, t: number) => {
            ctx.beginPath();
            const steps = 28;
            for (let s = 0; s <= steps; s++) {
                const x = (s / steps) * w;
                const u = (s / steps) * b.k * Math.PI * 2;
                const y =
                    b.yc * h +
                    b.amp * h * (
                        Math.sin(u + t * b.speed + b.phase) +
                        0.45 * Math.sin(2.3 * u - t * b.speed * 0.7 + b.phase * 2) +
                        0.18 * Math.sin(4.1 * u + t * b.speed * 1.3 + b.phase * 3)
                    );
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.globalAlpha = b.alpha;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = b.width;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.globalAlpha = 1;
        };

        const draw = (t: number) => {
            ctx.clearRect(0, 0, w, h);
            for (const b of bands) drawBand(b, t);
        };

        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            if (!visible || document.hidden) { last = now; return; }
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            time += dt;
            draw(time);
        };

        let time = 0;
        resize();

        if (reduced) {
            // One pleasing static composition, never animated.
            draw(11.3);
            const ro = new ResizeObserver(() => { resize(); draw(11.3); });
            ro.observe(canvas.parentElement!);
            return () => ro.disconnect();
        }

        const onVisibility = () => { last = performance.now(); };
        document.addEventListener('visibilitychange', onVisibility);

        const io = new IntersectionObserver(
            (entries) => { visible = entries.some((e) => e.isIntersecting); },
            { threshold: 0 }
        );
        io.observe(canvas);

        const ro = new ResizeObserver(() => { resize(); });
        if (canvas.parentElement) ro.observe(canvas.parentElement);

        raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [variant]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
        />
    );
};
