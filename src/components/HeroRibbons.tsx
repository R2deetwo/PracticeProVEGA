import { useEffect, useRef } from 'react';
import { drawRibbons, RIBBON_PRESET } from '@/lib/ribbons';

export function HeroRibbons({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, t = reduce ? 2 : 0, last = 0, raf = 0, visible = true;

    const draw = () => drawRibbons(ctx, W, H, t, RIBBON_PRESET);

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; // clamp: no jump after tab switch
      last = now;
      t += dt;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && !reduce && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); }
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    resize();
    start();
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-40 md:opacity-100 ${className}`}
    />
  );
}
