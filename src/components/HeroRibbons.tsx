import { useEffect, useRef } from 'react';
import { drawRibbons, RIBBON_PRESET, type RibbonOptions } from '@/lib/ribbons';
import { RIBBON_TIERS, createPacer } from '@/lib/ribbonPacer';

export function HeroRibbons({ className = '', ground = '#050B18' }: { className?: string; ground?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, heroW = 0, ox = 0, t = reduce ? 2 : 0, last = 0, raf = 0, visible = true;

    // R82: quality is a TIER (dpr scale, line count, frame-rate floor) chosen by
    // measurement, not a fixed 10 fps throttle. Tiers only ever step DOWN.
    const pacer = createPacer(0);
    const optsFor = (tier: number): RibbonOptions => ({ ...RIBBON_PRESET, lines: RIBBON_TIERS[tier].lines });
    let opts = optsFor(0);

    const draw = () => drawRibbons(ctx, W, H, t, opts, { heroW, ox });

    // Scrolling no longer FREEZES the ribbons (the freeze/resume read as a
    // glitch). While the scroll host moves, paints halve to ~30 fps but time
    // keeps advancing, so motion never stops or jumps.
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

    let lastPaint = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick); // schedule first: a throw in draw() can never kill the loop
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; // clamp: no jump after tab switch
      const dtMs = last ? now - last : 0;
      last = now;
      t += dt; // time ALWAYS advances, painted or not

      const tier = RIBBON_TIERS[pacer.tier()];
      const scrolling = now < scrollUntil;
      const minGap = scrolling ? Math.max(tier.minFrameMs, 33) : tier.minFrameMs;
      // 2ms slack so rAF jitter around a 33ms cadence never skips to 50ms
      if (minGap && now - lastPaint < minGap - 2) return;
      lastPaint = now;
      if (W > 0 && H > 0) draw();

      // judge only frames that were free to run at full rate
      if (!scrolling && tier.minFrameMs === 0) {
        const next = pacer.push(dtMs);
        if (next !== null) { opts = optsFor(next); resize(); }
      }
    };
    const start = () => {
      if (!raf && !reduce && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); }
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    function resize() {
      const tier = RIBBON_TIERS[pacer.tier()];
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2) * tier.dprScale);
      const r = canvas!.getBoundingClientRect();
      const hero = canvas!.parentElement?.getBoundingClientRect();
      W = r.width; H = r.height;
      heroW = hero?.width ?? r.width;          // geometry base: the FULL hero
      ox = hero ? r.left - hero.left : 0;      // canvas left edge inside the hero
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    const ro = new ResizeObserver(resize); ro.observe(canvas);
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

  // Vertical end-fade: two STATIC gradient layers in the hero ground colour.
  // On a flat ground this equals fading the stroke alpha, at no per-frame cost.
  const fadePct = `${RIBBON_PRESET.fade * 100}%`;
  const box = 'pointer-events-none absolute right-0 w-[54%]';
  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 right-0 h-full w-[54%] opacity-40 md:opacity-100 ${className}`}
      />
      <div aria-hidden="true" className={`${box} top-0`} style={{ height: fadePct, background: `linear-gradient(to bottom, ${ground}, ${ground}00)` }} />
      <div aria-hidden="true" className={`${box} bottom-0`} style={{ height: fadePct, background: `linear-gradient(to top, ${ground}, ${ground}00)` }} />
    </>
  );
}
