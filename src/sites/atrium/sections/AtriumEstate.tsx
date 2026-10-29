import React from 'react';
import { EstateExplorer } from './estate/EstateExplorer';
import { EstatePhoneExplorer } from './estate/EstatePhoneExplorer';

/**
 * AtriumEstate — the "Estate, at a glance" band for /atrium.
 *
 * R40 carried two live captures (laptop + phone). R41 owner direction
 * took it further: "I need you to figure out how we can do it so the
 * users or the potential customers can look at this and just almost
 * play around with it… hover… click on one of the properties… also be
 * able to click on units, and when they open the unit, they should be
 * able to see the menu… if you click on more, it should show you the
 * rest… even if it's in this small space… also on the phone."
 *
 * So the band now runs the workspace itself (both frames are the
 * estateChrome replica on the app's own demo estate): the laptop frame
 * on the left, the phone frame on the right — a proper screen, edge to
 * edge, no letterboxing. Interactive BY OWNER DIRECTION (R41); labelled
 * honestly as an interactive preview, never as a capture.
 *
 * The colour semantics the page teaches elsewhere (emerald settled,
 * amber due, rose overdue) remain the app's own.
 */
export const AtriumEstate: React.FC = () => {
    return (
        <section
            aria-labelledby="atrium-estate-heading"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                {/* Section head — warm, human, unhurried */}
                <div className="max-w-2xl mb-12 md:mb-16">
                    <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-emerald mb-5">
                        Revenue Monitor
                    </p>
                    <h2
                        id="atrium-estate-heading"
                        className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-[1.15] mb-6"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        The estate, at a glance.
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-600">
                        Every unit, every tenant, every lease — the portfolio as it actually
                        stands. Both windows below are the app itself, running on a real demo
                        estate: on the laptop, the workspace; on the phone, the manager&rsquo;s
                        app. Click into them — open a property, open a unit, pull its menu.
                        No dashboards to build, no spreadsheets to reconcile; the moment a
                        lease ends or a unit turns over, this view already knows.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                    {/* Left — the WORKSPACE, playable */}
                    <div className="lg:col-span-8">
                        <figure className="m-0">
                            <div className="rounded-2xl bg-white border border-slate-200/70 shadow-elevation-2 p-2.5 sm:p-3">
                                {/* The screen — the live workspace fills it edge to edge */}
                                <div className="rounded-lg overflow-hidden border border-slate-200/80 bg-white h-[560px] sm:h-[580px]">
                                    <EstateExplorer />
                                </div>
                                {/* The deck — a thin base under the screen */}
                                <div className="mx-auto mt-2.5 h-2 w-1/4 rounded-full bg-slate-200/90" aria-hidden="true" />
                            </div>
                            <figcaption className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center">
                                INTERACTIVE PREVIEW — THE WORKSPACE ITSELF · CLICK A PROPERTY, OPEN A UNIT, PULL ITS MENU
                            </figcaption>
                        </figure>
                    </div>

                    {/* Right — the PHONE: a proper screen, no void (R43:
                        the bezel now shrink-wraps the screen — w-fit — so
                        the handset keeps real proportions and the app fills
                        it edge to edge; the caption wraps instead of
                        stretching the frame). */}
                    <div className="lg:col-span-4 flex flex-col items-center">
                        <figure className="m-0 flex flex-col items-center">
                            {/* The handset — a dark bezel hugging the running app */}
                            <div className="w-fit rounded-[2.2rem] bg-slate-900 p-[10px] shadow-[0_24px_48px_-20px_rgb(28_25_23/0.5)]">
                                <div className="rounded-[1.6rem] overflow-hidden bg-white">
                                    <EstatePhoneExplorer />
                                </div>
                            </div>
                            <figcaption className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center max-w-[290px] mx-auto">
                                THE SAME PREVIEW, POCKET-SIZED · TAP A PROPERTY — THE MANAGER&rsquo;S APP, LIVE
                            </figcaption>
                        </figure>
                    </div>
                </div>

                {/* The reading — what the statuses mean, in the app's own coding */}
                <div className="mt-12 md:mt-14 max-w-4xl mx-auto border-t border-slate-200/80 pt-6">
                    <p className="text-sm leading-[1.8] text-slate-600 text-center">
                        <span className="font-semibold text-slate-800">Occupied</span> units carry
                        their tenant, phone and lease end; <span className="font-semibold text-slate-800">vacant</span>{' '}
                        and <span className="font-semibold text-slate-800">maintenance</span> units read
                        as operations, not money trouble; rent due dates and service-charge
                        states sit on each card — the same colour coding the{' '}
                        <span className="font-semibold text-atrium-emerald">default monitor</span> and the
                        residents&rsquo; portal use, so everyone in the estate reads the same ledger.
                    </p>
                </div>
            </div>
        </section>
    );
};
