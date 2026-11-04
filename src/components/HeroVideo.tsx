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
    <div aria-hidden="true" className={`absolute inset-x-0 top-0 overflow-hidden ${className}`}>
      {/* R67: the band is pinned to the clip's own 16:9. The old inset-0 +
          object-cover had to fill this whole ~1900px-tall section, forcing a
          ~1.76x zoom that cropped the lawyer (and her typing) out of frame;
          the 75%/100% anchor only made it worse by favouring the empty
          right-hand bookshelf. At exactly 16:9 the clip fits edge-to-edge
          with ZERO crop or zoom at any viewport width — the full scene,
          typing included, is always visible. Content that runs past the
          band simply sits on the section's own bg-white. */}
      <div className="relative w-full aspect-video">
      {still ? (
        <img src="/video/vega-hero-poster.jpg" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <video
          ref={ref}
          className="absolute inset-0 h-full w-full object-cover"
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
      {/* R67 veil stack — composition-driven, replacing R66's uniform /65 +
          LEFT-anchored gradient. The clip's real composition (measured, see
          scripts/r67-wash-*.py + download/r67-video-fit/): the lawyer sits
          CENTER (x 41-66%) directly behind the centered copy; the laptop and
          her typing hands live in the bottom third (y >= 68%); the old left
          gradient veiled exactly that typing zone while serving no text.
          The stack now:
            1. uniform /30 base — the whole scene stays recognizable;
            2. a plateau veil: /65 held through the copy (to y=45%), falling
               to clear by y=68% so the typing zone stays vivid. Worst-frame
               WCAG behind the copy: h1 9.99, navy span 5.90, subcopy 6.62
               (gates 3.0 / 3.0 / 4.5);
            3. the microcopy row rides on its own opaque white pill in
               VegaHero (its backdrop is near-black at y~60% — no uniform
               veil short of ~90% could carry slate text there). */}
      <div className="absolute inset-0 bg-white/30" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.65)_0%,rgba(255,255,255,0.65)_45%,rgba(255,255,255,0)_68%)]" />
      {/* blend the band's foot into the white section below — the hands and
          keyboard live at y >= 68% of the frame, so a 7% fade only ever
          touches the desk surface, never the typing */}
      <div className="absolute inset-x-0 bottom-0 h-[7%] bg-gradient-to-b from-transparent to-white" />
      </div>
    </div>
  );
}
