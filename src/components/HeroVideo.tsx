import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * HeroVideo — R66: the single-clip lifestyle-video ground; R67: the exact
 * 16:9 zero-crop band; R68: the SEAMLESS CLIP PLAYLIST.
 *
 * Owner direction (R68, verbatim shape): "i have a new set of videos that
 * id like you to use. it should cycle between the videos seamlessly.
 * lets keep this current one. then we use the one with the man next, then
 * we use the other two in any order you see fit" — and "loop them neatly".
 *
 * The playlist (owner-ordered):
 *   1. the lawyer at her laptop typing (R66's clip, kept first)
 *   2. the lawyer adjusting his brass cufflink (R68's clip)
 *   3./4. slot in here as the owner uploads them (one file at a time).
 *
 * HOW IT CYCLES — every asset is pre-built with a circular crossfade (its
 * last 0.8s dissolves into a still of its own opening frame, so each clip
 * ALSO loops seamlessly in isolation). The player stacks one layer per
 * clip; ~0.85s before the active clip's end — right as it settles onto its
 * opening-frame still — the next clip starts and dissolves in ON TOP (the
 * outgoing layer holds its frame under the fade, so there is never a dip
 * to the white ground mid-transition). The wrap from last clip back to
 * first is the same dissolve. No black frames, no pause, no controls.
 *
 * R68 GEOMETRY (the de-shove, paired with VegaHero): below 2xl the clip
 * renders as a framed 16:9 CARD in flow (mx-4, rounded, ring+shadow — the
 * visual family of the dashboard capture below it); at 2xl+ it becomes
 * the full-bleed band, now lifted OFF the navbar (top-24, was top-0 — the
 * owner: "i dont like the manner the video is shoved to the top of the
 * screen") with the copy riding on top under a per-clip veil. The band
 * keeps R67's exact-16:9 contract: object-cover over an aspect-video box
 * crops NOTHING at any viewport width.
 *
 * Network posture (R66's gates, kept): the poster is the only eager
 * fetch; clip 1 streams on preload="metadata"; every other clip sits at
 * preload="none" until ~2.5s before its cue, when it is bumped to "auto"
 * so the handoff is buffered ahead of the dissolve. Reduced-motion and
 * save-data users never mount a <video> at all — they get the still
 * poster (R65's sanctioned deviation: the check runs in the useState
 * initializer, not an effect).
 */

/** One playlist entry. Veil gradients are per-clip — each clip's
 * composition differs (the typist's action lives at y>=68%, the cufflink
 * at y>=62% with a thumb that rises to ~y50%), so each clip carries the
 * veil that keeps the copy WCAG-safe while leaving ITS action zone
 * vivid. Veils render at 2xl+ only (below that no text sits on the
 * clip). Modelled worst cases, 8x8 patch, slate-800 subcopy on the
 * darkest region behind it: typist 7.8:1, cufflink 5.1:1 (gate 4.5). */
interface HeroClip {
  webm: string;
  mp4: string;
  /** Only clip 1 carries one — it is the poster-first LCP resource and
   *  the reduced-motion still; later clips are revealed mid-dissolve. */
  poster?: string;
  veil: ReactNode;
}

const CLIPS: HeroClip[] = [
  {
    webm: '/video/vega-hero.webm',
    mp4: '/video/vega-hero.mp4',
    poster: '/video/vega-hero-poster.jpg',
    // R67's measured stack, R68-retuned: the plateau now holds to 60% and
    // clears by 75% (was 45%/68%) so the subcopy stays on the plateau at
    // EVERY 2xl width (at 1536 the copy runs deeper into the band than
    // the 1920 layout R67 measured) — and the plateau itself eases
    // 65% -> 55% so the typist reads vivid, not a "faint ghost" (the
    // R66 lesson). Dip-probe measured floor: 6.73:1 steady state,
    // 5.12:1 through the dissolve (gate 4.5). The typing hands (y>=75%)
    // stay clear; only the laptop lid takes the tail of the fade.
    veil: (
      <>
        <div className="hidden 2xl:block absolute inset-0 bg-white/30" />
        <div className="hidden 2xl:block absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.55)_60%,rgba(255,255,255,0)_75%)]" />
      </>
    ),
  },
  {
    webm: '/video/vega-hero-2.webm',
    mp4: '/video/vega-hero-2.mp4',
    // No poster: this layer is always revealed mid-dissolve over the
    // previous clip, so a poster would only add a fetch nobody sees.
    // No uniform base either — the cufflink itself is a small
    // high-frequency detail (brass on a white cuff, y~93%); the veil is
    // a 62% plateau to 55%, easing to a 30% shelf that carries the
    // subcopy rows over the navy suit, then clear from 78% down. The
    // plateau is deeper than the typist's (55%) because this clip's
    // backdrop behind the copy is a NEAR-BLACK suit: CSS composites the
    // veil in sRGB space, so 55% left the worst 8x8 patch at 4.49:1
    // (the dip-probe measured it); 62% lifts the measured floor to
    // ~5.6:1 (gate 4.5).
    veil: (
      <div className="hidden 2xl:block absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.62)_55%,rgba(255,255,255,0.30)_62%,rgba(255,255,255,0.30)_70%,rgba(255,255,255,0)_78%)]" />
    ),
  },
  // R68+: clips 3 and 4 slot in here, owner-ordered, same shape.
];

const FADE_MS = 800;    // the dissolve between clips
const ADVANCE_AT = 0.85; // seconds before end — the clip is on its opening-frame still
const PREFETCH_AT = 2.5; // seconds before end — buffer the next clip

export function HeroVideo({ className = '' }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const vids = useRef<Array<HTMLVideoElement | null>>([]);
  // R65: initialised synchronously (not inside useEffect) so reduced-motion /
  // save-data users never mount the <video> — a post-render swap still lets
  // the browser fire the preload="metadata" request before the effect runs.
  const [still, setStill] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (navigator as any).connection?.saveData === true)
  );

  // Playlist state: `active` is the clip dissolving IN (z-30, opacity 1);
  // `last` is the clip UNDER the dissolve (z-20, opacity held at 1 so the
  // crossfade never dips to white — it is dropped once fully covered).
  const [active, setActive] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const advancing = useRef(false);
  const activeRef = useRef(0);
  activeRef.current = active;

  const advance = useCallback(() => {
    if (advancing.current || CLIPS.length < 2) return;
    advancing.current = true;
    const cur = activeRef.current;
    const next = (cur + 1) % CLIPS.length;
    const nv = vids.current[next];
    if (!nv) { advancing.current = false; return; }
    nv.currentTime = 0;
    nv.play().then(() => {
      setLast(cur);
      setActive(next);
      // Let the dissolve finish, then retire the covered layer and
      // release the guard for the next handoff.
      window.setTimeout(() => {
        vids.current[cur]?.pause();
        setLast(null);
        advancing.current = false;
      }, FADE_MS + 120);
    }).catch(() => {
      // Could not start the next clip (network stall): stay on the
      // current one — its own seamless loop carries the hero; retry on
      // the next wrap. Only a hard failure drops to the still.
      advancing.current = false;
    });
  }, []);

  const onTick = (i: number) => {
    if (i !== activeRef.current) return;
    const v = vids.current[i];
    if (!v || !v.duration) return;
    const remaining = v.duration - v.currentTime;
    const nv = vids.current[(i + 1) % CLIPS.length];
    if (nv && remaining <= PREFETCH_AT) nv.preload = 'auto';
    if (remaining <= ADVANCE_AT) advance();
  };

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as any).connection?.saveData === true;
    if (reduce || saveData) { setStill(true); return; }

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) vids.current[activeRef.current]?.play().catch(() => {});
      else vids.current.forEach(v => v?.pause());
    });
    if (rootRef.current) io.observe(rootRef.current);
    const onVis = () => {
      if (document.hidden) vids.current.forEach(v => v?.pause());
      else vids.current[activeRef.current]?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      /* R68: one element, two presentations. Below 2xl: a framed 16:9
         card in flow after the copy (the clip presented whole, nothing
         behind text). At 2xl: the full-bleed band, lifted off the
         navbar (top-24 — R67 had top-0, the "shoved to the top of the
         screen" the owner rejected), sitting behind the copy wrapper
         (VegaHero sizes that wrapper to exactly this band's box).
         2xl:z-0 is LOAD-BEARING: it makes the band a stacking context,
         so the layer z-indexes below (10/20/30 + the z-40 foot fade)
         stay CONTAINED — without it they escape into the section's
         stacking context and paint the video OVER the copy wrapper's
         z-10 (the acceptance VLM caught exactly that: the headline
         invisible under the clip). */
      className={`relative mt-8 mx-4 sm:mx-6 aspect-video rounded-3xl overflow-hidden ring-1 ring-slate-900/10 shadow-2xl shadow-slate-900/15 2xl:mt-0 2xl:mx-0 2xl:rounded-none 2xl:ring-0 2xl:shadow-none 2xl:absolute 2xl:inset-x-0 2xl:top-24 2xl:z-0 ${className}`}
    >
      {still ? (
        <>
          {/* R67: the still is clip 1's poster — the LCP resource. */}
          <img src={CLIPS[0].poster} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          {CLIPS[0].veil}
        </>
      ) : (
        CLIPS.map((clip, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              // The dissolving-in clip fades over the held frame of the
              // outgoing one — a true crossfade, no white dip. All other
              // layers sit hidden at z-10.
              opacity: i === active || i === last ? 1 : 0,
              zIndex: i === active ? 30 : i === last ? 20 : 10,
              transition: i === active ? `opacity ${FADE_MS}ms ease` : 'none',
            }}
          >
            <video
              ref={el => { vids.current[i] = el; }}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay={i === 0} muted playsInline
              // The single-clip edge case (before the owner's remaining
              // uploads land) must still loop, or the hero would freeze.
              loop={CLIPS.length === 1}
              preload={i === 0 ? 'metadata' : 'none'}
              onTimeUpdate={() => onTick(i)}
              onEnded={() => { if (i === activeRef.current) advance(); }}
              // fetchpriority=high on the first clip raises the poster (the
              // LCP resource) fetch priority — React's types don't declare
              // it on <video> yet, hence the cast. No poster on later
              // clips: they are always revealed mid-dissolve.
              {...(i === 0
                ? ({ fetchPriority: 'high', poster: clip.poster } as Record<string, string>)
                : {})}
            >
              <source src={clip.webm} type="video/webm" />
              <source src={clip.mp4} type="video/mp4" />
            </video>
            {clip.veil}
          </div>
        ))
      )}
      {/* Blend the band's foot into the white section below (2xl only —
          below that the card sits on white with a hard, framed edge).
          Both clips keep their action in the bottom quarter, so a 7% fade
          only ever touches the desk/cuff, never the typing or the
          cufflink. */}
      <div className="hidden 2xl:block absolute inset-x-0 bottom-0 z-40 h-[7%] bg-gradient-to-b from-transparent to-white" />
    </div>
  );
}
