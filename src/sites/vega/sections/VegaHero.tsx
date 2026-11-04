import React from 'react';
import { HeroVideo } from '../../../components/HeroVideo';

/**
 * VegaHero — R56: the light-enterprise hero; R65: the lifestyle-video hero.
 *
 * Owner direction: transform /vega from "a dark-themed, text-heavy page"
 * into "a clean, modern, light-themed, enterprise-grade landing page" —
 * significantly lighter, crisp, executive-level. The Reading Room's
 * full-screen photograph (and its dark gradient) is RETIRED with the
 * espresso register; what replaces it:
 *
 *   - R65: a calm lifestyle-video hero — the user-supplied clip of the
 *     lawyer at her laptop, full-bleed as the section background under a
 *     uniform pale wash (bg-white/55) plus a left-side fade, with the
 *     subject anchored lower-right and the copy kept dark on top. The
 *     R56 grid + pastel ribbon are retired (the video is the ground now);
 *     copy, fonts, spacing and CTAs are untouched.
 *   - a crisp headline on legal workflow automation in Nigeria,
 *   - dual CTAs: solid navy "Get Started" + outline "View Live Demo"
 *     (R64: opens the demo-access modal — the Vega | Atrium toggle —
 *     pre-toggled to Vega; the Core Suite showcase below keeps the
 *     real captures),
 *   - the product's REAL dashboard capture (owner, R28: "use stuff from
 *     the app so we are not showing false images") in a clean light
 *     browser container with a soft drop shadow.
 *
 * Presentational only — the CTAs arrive via props from the site index.
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
            {/* R65/R67: the lifestyle-video ground — the looping clip of the
                lawyer at her laptop, full-width at the clip's own 16:9 (zero
                crop: the whole scene, typing included, is always visible),
                under a composition-tuned pale veil with the copy kept dark.
                The R56 hairline grid + pastel ribbon are retired. */}
            <HeroVideo />

            <div className="relative z-10 pt-32 pb-20 lg:pt-40 lg:pb-24 px-4 sm:px-6">
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

                    {/* The product UI dashboard preview — the REAL capture in a
                        clean light browser container with a soft drop shadow.
                        R67: on lg+ the container is pushed below the video
                        band (56.25vw = the band's height at any width, minus
                        the measured 638px from the band's top to where the
                        margin begins + a 30px gap) — the dashboard card used
                        to start at y=748 and covered the clip's typing zone
                        (y 752-1021) 100%. Below lg the band is shorter than
                        the copy block, so the old mt-14 stands. */}
                    <div
                        className="relative max-w-5xl mx-auto mt-14 lg:mt-[max(5rem,calc(56.25vw_-_39.875rem))]"
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
                </div>
            </div>
        </section>
    );
};
