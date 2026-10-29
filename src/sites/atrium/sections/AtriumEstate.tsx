import React from 'react';

/**
 * AtriumEstate — the "Estate, at a glance" band for /atrium (R40).
 *
 * Owner direction (R40): the hand-built occupancy grid and the fake
 * portal phone are RETIRED — "why don't we have the real-life thing?
 * How it will look on the laptop on the left-hand side and how it looks
 * on the phone on the right-hand side." The band now carries TWO REAL
 * captures of the running product:
 *
 *   · LAPTOP (left)  — the Units tab of a live property: every unit,
 *     its tenant, lease end, rent and status badge (occupied, vacant,
 *     maintenance), exactly as the manager works it.
 *   · PHONE (right)  — the same portfolio in the pocket: the manager's
 *     app on a handset, bottom navigation and all.
 *
 * Both frames are screenshots of the shipping app (demo estate,
 * captured by scripts/r40-capture*.cjs); nothing is staged. The colour
 * semantics the page teaches elsewhere (emerald settled, amber due,
 * violet partial, blue prepaid, rose overdue) are the app's own.
 *
 * Presentational only — zero interactive controls (ADR-0004).
 */
export const AtriumEstate: React.FC = () => {
    // Cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();

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
                        stands. The captures below are the app itself: on the laptop, the
                        estate&rsquo;s unit ledger with live occupancy status; on the phone, the
                        same portfolio in a manager&rsquo;s pocket. No dashboards to build, no
                        spreadsheets to reconcile — the moment a lease ends or a unit turns
                        over, this view already knows.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                    {/* Left — the LAPTOP capture: the Units tab, live */}
                    <div className="lg:col-span-7">
                        <figure className="m-0">
                            <div className="rounded-2xl bg-white border border-slate-200/70 shadow-elevation-2 p-2.5 sm:p-3">
                                {/* The screen — a hairline inset carries the display */}
                                <div className="rounded-xl overflow-hidden border border-slate-200/80 bg-white">
                                    <img
                                        src={`/assets/landing/app/atrium-estate-units.jpg?v=${buildSha}`}
                                        alt="The Atrium app on desktop — a property's Units tab: unit cards with tenants, lease end dates, rent amounts and occupancy status badges"
                                        className="w-full h-auto block"
                                        loading="lazy"
                                        decoding="async"
                                        width={1440}
                                        height={900}
                                    />
                                </div>
                                {/* The deck — a thin base under the screen */}
                                <div className="mx-auto mt-2.5 h-2 w-1/4 rounded-full bg-slate-200/90" aria-hidden="true" />
                            </div>
                            <figcaption className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center">
                                LIVE CAPTURE — THE UNITS TAB ON DESKTOP: EVERY UNIT, TENANT, LEASE AND STATUS · NOTHING STAGED
                            </figcaption>
                        </figure>
                    </div>

                    {/* Right — the PHONE capture: the same estate, pocket-sized */}
                    <div className="lg:col-span-5 flex flex-col items-center">
                        <figure className="m-0">
                            {/* The handset — a dark bezel around the running app */}
                            <div className="rounded-[2.4rem] bg-slate-900 p-[10px] shadow-[0_24px_48px_-20px_rgb(28_25_23/0.5)]">
                                <div className="rounded-[1.9rem] overflow-hidden bg-white w-[248px] sm:w-[268px]">
                                    <img
                                        src={`/assets/landing/app/atrium-estate-mobile.jpg?v=${buildSha}`}
                                        alt="The Atrium app on a phone — the manager's properties list with bottom navigation, the same portfolio pocket-sized"
                                        className="w-full h-auto block"
                                        loading="lazy"
                                        decoding="async"
                                        width={390}
                                        height={844}
                                    />
                                </div>
                            </div>
                            <figcaption className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center">
                                LIVE CAPTURE — THE SAME PORTFOLIO, IN THE POCKET · THE MANAGER&rsquo;S APP ON A PHONE
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
