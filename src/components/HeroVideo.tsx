import { useEffect, useRef, useState } from 'react';

export function HeroVideo({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // R65: initialised synchronously (not inside useEffect) so reduced-motion /
  // save-data users never mount the <video> — a post-render swap still lets
  // the browser fire the preload="metadata" request before the effect runs.
  const [still, setStill] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator as any).connection?.saveData === true)
  );

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as any).connection?.saveData === true;
    if (reduce || saveData) { setStill(true); return; }

    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => setStill(true));
      else v.pause();
    });
    io.observe(v);
    const onVis = () => (document.hidden ? v.pause() : v.play().catch(() => {}));
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`}>
      {still ? (
        <img src="/video/vega-hero-poster.jpg" alt="" fetchPriority="high" className="h-full w-full object-cover" style={{ objectPosition: '75% 100%' }} />
      ) : (
        <video
          ref={ref}
          className="h-full w-full object-cover"
          style={{ objectPosition: '75% 100%' }}
          autoPlay muted loop playsInline preload="metadata"
          // fetchpriority=high on the video raises the poster (the LCP
          // resource) fetch priority — React's types don't declare it on
          // <video> yet, hence the cast.
          {...({ fetchPriority: 'high' } as Record<string, string>)}
          poster="/video/vega-hero-poster.jpg"
        >
          <source src="/video/vega-hero.webm" type="video/webm" />
          <source src="/video/vega-hero.mp4" type="video/mp4" />
        </video>
      )}
      {/* uniform pale wash: this is what keeps dark text readable over any frame
          (R65: raised 55 -> 65 after WCAG sampling — at 55 the darkest frames
          behind the centred subcopy dipped below 4.5:1; the subcopy also moved
          slate-600 -> slate-800, which clears the worst mobile pixel at 65
          with margin while keeping the subject clearly visible) */}
      <div className="absolute inset-0 bg-white/65" />
      {/* extra fade on the text side */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/30 to-transparent" />
    </div>
  );
}
