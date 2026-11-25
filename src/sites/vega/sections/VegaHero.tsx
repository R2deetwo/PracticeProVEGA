import React from 'react';
import { HeroVideo } from '../../../components/HeroVideo';

/**
 * VegaHero — R56: the light-enterprise hero; R65/R67: the lifestyle-video
 * hero; R68: the de-shove; R69: the eyebrow pill retires; R70: the band is
 * the landing-page background at EVERY width again.
 *
 * 2026-11-25 — the hero carries ONE honest primary CTA ("Get Started",
 * passed via the cta prop). The secondary outline button that used to sit
 * beside it is retired with the false-demo removal round: it opened the
 * LeadCaptureModal ("Access Interactive Demo"), whose production behavior
 * was a lead-capture hand-off to signup — a bait-and-switch that no longer
 * has a place on the page.
 *
 * Owner direction, R70 (verbatim shape): "it is supposed to be on the
 * landingpage background — put it back there." R68 had demoted the clip
 * to a framed card below the copy for every width under 2xl (only
 * >=1536px kept the background band); the owner rejected that on seeing
 * it live. The wrapper now anchors the copy INTO the band at every
 * width and is min-h'd to the band's box, so whatever follows the band
 * always starts past the band foot. R68's de-shove (top-24, never
 * top-0) and R67's exact-16:9 zero-crop are held; the R69 copy seat is
 * untouched.
 *
 * Owner direction, R69 (verbatim shape): "Remove the small pill badge at
 * the top of the hero section" — the indigo attribution pill above the
 * headline is gone; the 2xl copy anchor rises to compensate (the pill's
 * block was ~58px at 1920, so the anchor moves 8.4375vw -> 11.5vw and
 * the headline lands where it always did — the R67/R68 WCAG geometry
 * behind it is unchanged). The attribution itself is not lost: the
 * footer carries "A PracticePro product" (D8) and the hub keeps the
 * built-by line.
 *
 * OWNER DIRECTION (2026-11-22): the standalone Dashboard viewer card
 * (the framed app-domain capture with its multi-still switcher) that
 * lived between the clip band and "One workspace, every workflow" is
 * RETIRED — scrolling down from the hero/video now goes DIRECTLY to
 * the suite band. The interactive preview and the whole app-view walk
 * live inside the suite's See All gallery (Overview → … → Team), not
 * as a separate section above it.
 * The hero is the copy + the clip band, nothing else.
 *
 * Copy (headline, sub-copy, CTAs, micro pill), fonts and spacing rhythm
 * are untouched since R56/R65. Presentational only — the CTAs arrive via
 * props.
 */
export const VegaHero: React.FC<{
    /** The primary CTA node (Vega-styled button), passed in by the site index. */
    cta: React.ReactNode;
}> = ({ cta }) => (
    <section id="home" className="relative overflow-hidden bg-white">
        {/* ── The copy — riding ON the band at EVERY width (R70: the
            restore — "it is supposed to be on the landingpage
            background; put it back there"). The wrapper is sized to
            AT LEAST the band's box (6rem = the band's top-24 offset,
            56.25vw = the 16:9 band height at any width) so whatever
            follows the hero always starts past the band foot; min-h,
            not h (R68 had 2xl:h), because at narrow widths the copy
            is TALLER than the band — it runs on past the foot onto
            the section's white (R67's mobile behaviour, held). The
            copy is top-anchored into the band at 11.5vw — R69's
            measured seat (the headline keeps its exact y=317 at
            1920). ── */}
        <div className="relative z-10 px-4 sm:px-6 pt-[calc(6rem+11.5vw)] min-h-[calc(6rem+56.25vw)]">
            <div className="max-w-7xl mx-auto">
                <div className="max-w-3xl mx-auto text-center">
                    {/* Headline — crisp, deep slate, tight tracking. */}
                    <h1
                        className="font-display text-[2.5rem] sm:text-6xl lg:text-[4.25rem] font-semibold leading-[1.05] tracking-tight text-slate-900 mb-6"
                        data-vg-reveal
                        style={{ '--vg-d': '90ms' } as React.CSSProperties}
                    >
                        Legal workflow automation
                        <br />
                        for{' '}
                        <span className="text-[#1E3A8A]">
                            Nigerian law firms.
                        </span>
                    </h1>

                    {/* Sub-copy — the one-system story, R49 DraftPro keeps. */}
                    <p
                        className="text-base md:text-lg leading-[1.75] text-slate-800 max-w-2xl mx-auto mb-9"
                        data-vg-reveal
                        style={{ '--vg-d': '150ms' } as React.CSSProperties}
                    >
                        Matters, court-rule deadlines, DraftPro&trade; drafting and naira
                        billing — one light, fast workspace that runs the whole practice:
                        from intake to judgment, with every hearing reminder fired on time.
                    </p>

                    {/* The primary CTA — Get Started (Vega-scoped signup). */}
                    <div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5"
                        data-vg-reveal
                        style={{ '--vg-d': '210ms' } as React.CSSProperties}
                    >
                        {cta}
                    </div>

                    {/* R67: the trial microcopy rides on an opaque white
                        pill (mirroring the eyebrow pill above) — its video
                        backdrop at this depth is near-black (worst-frame
                        patch lum 0.003), so slate-600 on solid white
                        (6.98:1, deterministic) is the only reliable carry. */}
                    <p
                        className="inline-block rounded-full border border-slate-200 bg-white px-5 py-1.5 font-mono text-2xs tracking-widest text-slate-600"
                        data-vg-reveal
                        style={{ '--vg-d': '270ms' } as React.CSSProperties}
                    >
                        NO CREDIT CARD · 30-DAY TRIAL · DRAFTPRO INCLUDED
                    </p>
                </div>
            </div>
        </div>

        {/* ── The clip playlist — the full-bleed band (absolute)
            behind the copy wrapper above, at EVERY width (R70: the
            under-2xl card variant is retired — see HeroVideo). Below
            the band foot the section ends and the suite band ("One
            workspace, every workflow") begins directly — no dashboard
            viewer block between them (2026-11-22 owner direction). ── */}
        <HeroVideo />
    </section>
);
