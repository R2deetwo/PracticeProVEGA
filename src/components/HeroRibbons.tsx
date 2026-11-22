import { useEffect, useRef } from 'react';
import { drawRibbons, RIBBON_PRESET } from '@/lib/ribbons';

export function HeroRibbons({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, heroW = 0, ox = 0, t = reduce ? 2 : 0, last = 0, raf = 0, visible = true;

    const draw = () => drawRibbons(ctx, W, H, t, RIBBON_PRESET, { heroW, ox });

    // R73 (the silk pass): the sway is a slow ~11s breath — a 60fps redraw
    // doubles the CPU/GPU cost for motion nobody can perceive. The loop
    // still ticks on every rAF and accumulates skipped time into `t`, so
    // the sway SPEED is identical to a 60fps loop. R79 (the calm pass)
    // widens the budget 33ms → 100ms after profiling: the ribbons were the
    // single heaviest thing on the landing page — a full-viewport
    // additively-blended canvas whose per-paint compositor upload pushed
    // median frame times from 16.7ms to 50ms. The JS draw itself measures
    // ~1ms; the cost is the canvas→compositor texture upload, which scales
    // with paint FREQUENCY. At an 11s sway, adjacent 100ms poses differ by
    // ~1–2px — the motion reads continuous; film judder needs far larger
    // per-frame displacements. Result: ~10 pose updates/s instead of 30.
    const FRAME_MIN_MS = 100;
    let lastPaint = 0;
    let acc = 0;

    // R79 (the calm pass): SCROLL MUTE. The page scrolls inside a div
    // container (not the window), and that container's scroll work is
    // exactly when main-thread contention is felt as jank. While the
    // scroll host moves — and for 150ms after it stops — the loop drops
    // its accumulated time and paints nothing: the ribbons hold their
    // pose (invisible during motion) and the main thread is left entirely
    // to the scroll/transition work. The sway resumes where it left off.
    let scrollUntil = 0;
    const scrollHost = (() => {
      let node: HTMLElement | null = canvas.parentElement;
      while (node && node !== document.body) {
        const oy = getComputedStyle(node).overflowY;
        if (oy === 'auto' || oy === 'scroll') return node;
        node = node.parentElement;
      }
      return window;
    })();
    const onScroll = () => { scrollUntil = performance.now() + 150; };
    scrollHost.addEventListener('scroll', onScroll, { passive: true });

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; // clamp: no jump after tab switch
      last = now;
      if (now < scrollUntil) {
        acc = 0; // scrolling: hold the pose, drop the time
      } else {
        acc += dt;
        if (now - lastPaint >= FRAME_MIN_MS) {
          lastPaint = now;
          t += acc;
          acc = 0;
          if (W > 0 && H > 0) draw();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && !reduce && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); }
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    const resize = () => {
      // R79: DPR capped at 1.5 (was 2). The ribbons are 1.1px additive
      // hairlines — at 1.5× they are visually identical to 2× on every
      // screen tested, and fill cost falls ~44% ((1.5/2)^2).
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const r = canvas.getBoundingClientRect();
      const hero = canvas.parentElement?.getBoundingClientRect();
      W = r.width; H = r.height;
      heroW = hero?.width ?? r.width;          // geometry base — the FULL hero
      ox = hero ? r.left - hero.left : 0;      // canvas left edge inside the hero
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const ro = new ResizeObserver(resize); ro.observe(canvas);
    // R62: when the hero scrolls out of view the loop already stops —
    // and now the canvas element hides too, so the compositor drops the
    // (huge, additive-blended) layer entirely instead of carrying it
    // around off-screen. A frozen-but-present canvas layer was measured
    // starving main-thread transitions further down the page on
    // software-composited devices; hidden, the layer costs nothing.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      canvas.style.visibility = visible ? 'visible' : 'hidden';
      visible ? start() : stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    resize();
    start();
    return () => {
      stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
      scrollHost.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 right-0 h-full w-[54%] opacity-40 md:opacity-100 ${className}`}
    />
  );
}
