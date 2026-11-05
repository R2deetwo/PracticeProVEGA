import React from 'react';
import { HeroVideo } from '../../../components/HeroVideo';

/**
 * VegaHero — R56: the light-enterprise hero; R65/R67: the lifestyle-video
 * hero; R68: the de-shoved clip hero.
 *
 * Owner direction, R68 (verbatim shape): "i dont like the manner the
 * vidoe is shoved to the top of the screen" — R67's band was absolute
 * top-0, i.e. wallpaper glued to the very top of the screen behind the
 * navbar, with the copy and dashboard hanging below it. The R68 layout:
 *
 *   - Below 2xl (phone → laptop): COPY FIRST on the clean white ground
 *     (headline lands immediately, nothing fights it), then the clip as
 *     a framed 16:9 CARD (rounded, ringed, shadowed — the visual family
 *     of the dashboard capture below it), then the dashboard. The clip
 *     plays UNCROPPED at its own 16:9, no text on it, no veil — the
 *     whole frame, typing and cufflinks included, at full vividness.
 *   - At 2xl+ (desktop): the clip becomes the full-bleed band, now
 *     LIFTED OFF the navbar (2xl:top-24 — a deliberate white gap between
 *     the glass nav and the band, so it reads as a mounted cinema screen
 *     rather than wallpaper shoved to the top of the screen). The copy
 *     rides on top under the per-clip veil; the copy wrapper is sized
 *     to EXACTLY the band's box (2xl:h-[calc(6rem+56.25vw)], copy
 *     top-anchored at 15% of the band — R67's measured geometry), so
 *     the dashboard simply follows in flow; R67's vw-minus-rem margin
 *     push-hack is retired — no absolute/flow coordination any more.
 *   - The clip cycles through the owner's playlist (see HeroVideo):
 *     the typist first, the cufflink man next, further clips as they
 *     arrive — dissolving clip-to-clip with no seam.
 *
 * Copy, fonts, spacing, CTAs: untouched since R56/R65 (owner: no copy
 * rewrites). Presentational only — the CTAs arrive via props.
 */
export const VegaHero: React.FC<{
    /** Pinned attribution string — owned by the site index. */
    eyebrow: string;
    /** The primary CTA node (Vega-styled buttons), passed in by the site index. */
    cta: React.ReactNode;
    /** The secondary "View Live Demo" node — R64: opens the demo-access
     *  modal (the Vega | Atrium toggle), pre-toggled to Vega. */
    demoCta: React.ReactNode;
}> = ({ eyebrow, cta, demoCta }) => {
    // R39: cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();

    return (
        <section id="home" className="relative overflow-hidden bg-white">
            {/* ── The copy — FIRST in flow. Below 2xl it sits on white;
                at 2xl the wrapper is sized to exactly the band's box
                (6rem = the band's top-24 offset, 56.25vw = the 16:9 band
                height at any width) with the copy top-anchored 15% into
                the band — the geometry R67 measured WCAG against. ── */}
            <div className="relative z-10 px-4 sm:px-6 pt-28 sm:pt-32 2xl:pt-[calc(6rem+8.4375vw)] 2xl:h-[calc(6rem+56.25vw)]">
                <div className="max-w-7xl mx-auto">
                    <div className="max-w-3xl mx-auto text-center">
                        {/* Soft indigo status pill — the eyebrow. */}
                        <p
                            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 font-mono text-2xs sm:text-xs font-medium uppercase tracking-[0.18em] text-indigo-700 mb-7"
                            data-vg-reveal
                        >
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                            {eyebrow}
                        </p>

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

                        {/* Dual CTAs — Get Started (navy) + View Live Demo (outline). */}
                        <div
                            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5"
                            data-vg-reveal
                            style={{ '--vg-d': '210ms' } as React.CSSProperties}
                        >
                            {cta}
                            {demoCta}
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

            {/* ── The clip playlist — SECOND in flow: below 2xl the framed
                card after the copy; at 2xl the full-bleed band (absolute)
                behind the copy wrapper above. One element, two
                presentations — see HeroVideo. ── */}
            <HeroVideo />

            {/* ── The product UI dashboard preview — the REAL capture in a
                clean light browser container with a soft drop shadow.
                R68: plain flow spacing — the copy wrapper already occupies
                exactly the band's box at 2xl, so the card lands below the
                band's foot with a simple mt; the typing zone is never
                covered. R67's vw-minus-rem margin push-hack is retired
                with it. ── */}
            <div
                className="relative max-w-5xl mx-auto px-4 sm:px-6 mt-14 2xl:mt-16 mb-20 2xl:mb-24"
                data-vg-reveal
                style={{ '--vg-d': '340ms' } as React.CSSProperties}
            >
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
                    {/* Browser chrome — three dots + the address bar. */}
                    <div className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50 px-4 py-3">
                        <div className="flex gap-1.5" aria-hidden="true">
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                        </div>
                        <div className="flex-1 max-w-sm mx-auto rounded-md bg-white border border-slate-200 px-3 py-1 text-center text-xs text-slate-500 truncate">
                            app.practicepro.ng — Dashboard
                        </div>
                        <div className="w-10" aria-hidden="true" />
                    </div>
                    <img
                        src={`/assets/landing/app/dashboard.jpg?v=${buildSha}`}
                        alt="Vega dashboard — the practice at a glance: matters, hearings, billing and tasks"
                        loading="eager"
                        decoding="async"
                        width={1440}
                        height={900}
                        className="block w-full h-auto"
                    />
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-500 text-center mt-4">
                    LIVE CAPTURE — THE VEGA DASHBOARD, AS THE FIRM SEES IT EACH MORNING
                </p>
            </div>
        </section>
    );
};
