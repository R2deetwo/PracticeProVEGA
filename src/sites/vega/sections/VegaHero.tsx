import React, { useState } from 'react';
import { HeroVideo } from '../../../components/HeroVideo';
import { Button } from '../../../components/ui';
import { CollabPresence } from './CollabPresence';
import { AppShotLightbox, ExpandHint, type LightboxGroup } from './AppShotLightbox';
import { SUITE_GROUPS } from './VegaSuite';

/**
 * VegaHero — R56: the light-enterprise hero; R65/R67: the lifestyle-video
 * hero; R68: the de-shove; R69: the eyebrow pill retires; R70: the band is
 * the landing-page background at EVERY width again.
 *
 * Owner direction, R70 (verbatim shape): "it is supposed to be on the
 * landingpage background — put it back there." R68 had demoted the clip
 * to a framed card below the copy for every width under 2xl (only
 * >=1536px kept the background band); the owner rejected that on seeing
 * it live. The wrapper now anchors the copy INTO the band at every
 * width and is min-h'd to the band's box, so the dashboard always
 * starts past the band foot. R68's de-shove (top-24, never top-0) and
 * R67's exact-16:9 zero-crop are held; the R69 copy seat is untouched.
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
 * R69 also lands the live-capture upgrades on the dashboard card: the
 * CollabPresence overlay in the app header's bell→profile gap and
 * click-to-expand into the shared lightbox gallery — the hero's
 * Dashboard capture plus every suite exhibit, so "Tasks, Calendar,
 * Notes" (and the rest) are reachable from the hero without a detour.
 *
 * Copy (headline, sub-copy, CTAs, micro pill), fonts and spacing rhythm
 * are untouched since R56/R65. Presentational only — the CTAs arrive via
 * props.
 */
export const VegaHero: React.FC<{
    /** The primary CTA node (Vega-styled buttons), passed in by the site index. */
    cta: React.ReactNode;
    /** The secondary "View Live Demo" node — R64: opens the demo-access
     *  modal (the Vega | Atrium toggle), pre-toggled to Vega. */
    demoCta: React.ReactNode;
    /** R69: signup hand-off for the capture overlays' demo note. */
    onSignup?: () => void;
}> = ({ cta, demoCta, onSignup }) => {
    // R39: cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();
    // R69: the lightbox — the Dashboard capture plus every suite exhibit.
    const [lightbox, setLightbox] = useState<number | null>(null);

    const groups: LightboxGroup[] = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            exhibits: [{
                src: '/assets/landing/app/dashboard.jpg',
                alt: 'Vega dashboard — the practice at a glance: matters, hearings, billing and tasks',
                caption: 'LIVE CAPTURE — THE VEGA DASHBOARD, AS THE FIRM SEES IT EACH MORNING',
                label: 'Dashboard',
            }],
        },
        ...SUITE_GROUPS,
    ];

    return (
        <section id="home" className="relative overflow-hidden bg-white">
            {/* ── The copy — riding ON the band at EVERY width (R70: the
                restore — "it is supposed to be on the landingpage
                background; put it back there"). The wrapper is sized to
                AT LEAST the band's box (6rem = the band's top-24 offset,
                56.25vw = the 16:9 band height at any width) so the
                dashboard below always starts past the band foot; min-h,
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

            {/* ── The clip playlist — the full-bleed band (absolute)
                behind the copy wrapper above, at EVERY width (R70: the
                under-2xl card variant is retired — see HeroVideo). ── */}
            <HeroVideo />

            {/* ── The product UI dashboard preview — the REAL capture in a
                clean light browser container with a soft drop shadow.
                R70: the wrapper above is min-h'd to the band's box at
                every width, so this always starts past the band foot.
                R69: the capture carries the team presence overlay and is
                click-to-expand into the shared gallery (Dashboard + every
                suite exhibit). ── */}
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
                    <div
                        className="relative group cursor-zoom-in"
                        style={{ containerType: 'inline-size' }}
                    >
                        <img
                            src={`/assets/landing/app/dashboard.jpg?v=${buildSha}`}
                            alt="Vega dashboard — the practice at a glance: matters, hearings, billing and tasks"
                            loading="eager"
                            decoding="async"
                            width={1440}
                            height={900}
                            className="block w-full h-auto"
                        />
                        {/* R69: the team-presence overlay + the expand
                            affordance (the stack sits above the expand
                            hit-area, so presence clicks open the roster). */}
                        <CollabPresence onSignup={onSignup} />
                        <Button
                            variant="bare"
                            onClick={() => setLightbox(0)}
                            aria-label="Expand the Dashboard view"
                            className="absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                        />
                        <ExpandHint />
                    </div>
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-500 text-center mt-4">
                    LIVE CAPTURE — THE VEGA DASHBOARD, AS THE FIRM SEES IT EACH MORNING
                </p>
            </div>

            {/* R69: the shared gallery — Dashboard plus every suite
                exhibit, one flat walk. */}
            {lightbox !== null && (
                <AppShotLightbox
                    groups={groups}
                    index={lightbox}
                    onNavigate={setLightbox}
                    onClose={() => setLightbox(null)}
                    onSignup={onSignup}
                />
            )}
        </section>
    );
};
