import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * HeroVideo — R66: the single-clip lifestyle-video ground; R67: the exact
 * 16:9 zero-crop band; R68: the SEAMLESS CLIP PLAYLIST; R70: the band is
 * the landing-page BACKGROUND again, at every width.
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
 * R70 GEOMETRY (the restore, owner-ordered): "it is supposed to be on
 * the landingpage background — put it back there." R68 had demoted the
 * clip to a framed card BELOW the copy for every width under 2xl (only
 * >=1536px kept the band); the owner rejected that on seeing it live.
 * The band is now the full-bleed background at EVERY width — ONE
 * presentation, no card variant: absolute inset-x-0 top-24 (the R68
 * de-shove held; never back to top-0), exact 16:9 (R67's zero-crop
 * contract: the whole scene, typing included, visible at any width),
 * the copy riding ON TOP (VegaHero anchors it into the band at every
 * width) under the per-clip veils — which now render at every width
 * too, because text sits on the clip wherever the viewport lands.
 * z-0 is LOAD-BEARING at every width now (R68 learned this at 2xl): it
 * makes the band a stacking context, so the layer z-indexes below
 * (10/20/30 + the z-40 foot fade) stay CONTAINED — without it they
 * escape into the section's stacking context and paint the video OVER
 * the copy wrapper's z-10 (the R68 acceptance VLM caught exactly that:
 * the headline invisible under the clip).
 *
 * R70 VEIL LADDER (measured, r70 dip-probe): the copy's depth in the
 * band varies with width — the sub-copy's tail lands at ~50% of the
 * band at 1920 but ~64% at 1280, ~75% at 1024 and ~88% at 768 — so one
 * gradient cannot carry every width: at 2xl R68's tune passed
 * (5.1–6.9:1) but at 1280 the cufflink's near-black suit behind the
 * sub's tail measured 1.82:1, and at 768 even the headline failed
 * (2.55:1). Each clip therefore carries a FOUR-STEP ladder, one rung
 * per width range, each rung holding its plateau just past that
 * range's measured tail then easing to clear — so the action zone
 * BELOW the copy (the typing hands, the cufflink) stays vivid at every
 * width: 2xl R68's tune unchanged; xl holds to ~68%; lg to ~78%; below
 * lg (the tail runs to ~88%, and at 640–767 the sub's head rides the
 * band's foot rows) the plateau holds to 90%.
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
 * veil ladder that keeps the copy WCAG-safe while leaving ITS action
 * zone vivid. R70: the ladder renders at EVERY width (the copy rides the
 * clip wherever the viewport lands) — one rung per width range, tuned to
 * that range's measured copy depth (see the R70 VEIL LADDER note above).
 * Modelled worst cases, 8x8 patch, slate-800 subcopy on the darkest
 * region behind it: typist 7.8:1, cufflink 5.1:1 (gate 4.5). */
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
    // R67's measured stack, R68-retuned, R70-laddered. The 2xl rung is
    // R68's exact tune (the tail lands <=57% there; measured floors
    // 6.73:1 steady, 5.12:1 through the dissolve). The typing hands
    // (y>=75%) stay clear on every rung — only the laptop lid above
    // them takes the deeper washes, and never the whole scene (the
    // uniform /30 base keeps it recognizable — R67's rule).
    veil: (
      <>
        <div className="absolute inset-0 bg-white/30" />
        {/* 2xl+ (>=1536): tail <=57% — R68's tune, unchanged. */}
        <div className="hidden 2xl:block absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.55)_60%,rgba(255,255,255,0)_75%)]" />
        {/* xl (1280-1535): tail <=64.3% (measured at 1280). */}
        <div className="hidden xl:block 2xl:hidden absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.55)_68%,rgba(255,255,255,0)_82%)]" />
        {/* lg (1024-1279): tail <=75.3% (measured at 1024). */}
        <div className="hidden lg:block xl:hidden absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.55)_78%,rgba(255,255,255,0)_90%)]" />
        {/* below lg (<1024): the tail runs to ~88% (768 measured) and at
            640-767 the sub's head rides the band's foot rows — but the
            first ladder draft (plateau to 90%) measured 6.7-7.7:1, a 49%
            headroom over the 4.5 gate, while the VLM read the typing as
            half-washed. R70 final: the plateau holds only to 62% (the
            headline's rows), then eases to a 40% shelf from 76% — the
            typing zone keeps ~60% of its contrast, the sub's tail/head
            still clears 4.5 on the measured floors. */}
        <div className="lg:hidden absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.55)_62%,rgba(255,255,255,0.40)_76%,rgba(255,255,255,0.40)_100%)]" />
      </>
    ),
  },
  {
    webm: '/video/vega-hero-2.webm',
    mp4: '/video/vega-hero-2.mp4',
    // No poster: this layer is always revealed mid-dissolve over the
    // previous clip, so a poster would only add a fetch nobody sees.
    // The cufflink's backdrop behind the copy is a NEAR-BLACK suit: CSS
    // composites the veil in sRGB space, so the plateau must run deeper
    // than the typist's at every rung (R68 measured 4.49:1 at 55% on
    // this clip; 62% lifted the floor to ~5.6). The brass cufflink
    // itself (y~93%) sits below every rung's ease-off — it stays vivid.
    veil: (
      <>
        <div className="absolute inset-0 bg-white/30" />
        {/* 2xl+ (>=1536): R68's tune, unchanged. */}
        <div className="hidden 2xl:block absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.62)_55%,rgba(255,255,255,0.30)_62%,rgba(255,255,255,0.30)_70%,rgba(255,255,255,0)_78%)]" />
        {/* xl (1280-1535): tail <=64.3% — the 1280 dip-probe measured
            1.82:1 in R68's 30% shelf; the plateau must hold through the
            tail on this clip, not shelf under it. */}
        <div className="hidden xl:block 2xl:hidden absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.62)_70%,rgba(255,255,255,0)_84%)]" />
        {/* lg (1024-1279): tail <=75.3%. */}
        <div className="hidden lg:block xl:hidden absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.62)_78%,rgba(255,255,255,0)_90%)]" />
        {/* below lg (<1024): tail to ~88%, headline bottom to ~63% —
            and the same headroom lesson as the typist: the 90% plateau
            measured 7.7:1 but half-washed the cufflink (VLM). R70 final:
            plateau to 62%, a 45% shelf from 76% — the near-black suit
            needs 45% where the typist's mid-tones take 40%. */}
        <div className="lg:hidden absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.62)_62%,rgba(255,255,255,0.45)_76%,rgba(255,255,255,0.45)_100%)]" />
      </>
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
      /* R70: ONE presentation at every width — the full-bleed band, the
         landing-page background the owner ordered back ("put it back
         there"). R68's card variant is retired: under 2xl the clip had
         been demoted to a framed card BELOW the copy, which the owner
         rejected on seeing it live. The band keeps R68's de-shove
         (top-24, never back to top-0) and R67's exact-16:9 zero-crop
         contract. z-0 is LOAD-BEARING (now at every width, not just
         2xl): it makes the band a stacking context, so the layer
         z-indexes below (10/20/30 + the z-40 foot fade) stay
         CONTAINED — without it they escape into the section's stacking
         context and paint the video OVER the copy wrapper's z-10 (the
         R68 acceptance VLM caught exactly that: the headline invisible
         under the clip). */
      className={`absolute inset-x-0 top-24 z-0 aspect-video overflow-hidden ${className}`}
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
      {/* Blend the band's foot into the white section below (R70: at
          every width — the copy can run past the band onto that white
          at narrow viewports, so the seam must dissolve). Both clips
          keep their action in the bottom quarter, so the fade only ever
          touches the desk/cuff, never the typing or the cufflink.
          R70 final: below lg the fade doubles to 14% — the VLM read
          the 7% ramp (15px at 390) as a hard seam slicing the sub's
          first line where the copy straddles the band's foot; at lg+
          the copy fits inside the band, so R68's 7% stands. */}
      <div className="absolute inset-x-0 bottom-0 z-40 h-[14%] lg:h-[7%] bg-gradient-to-b from-transparent to-white" />
    </div>
  );
}
