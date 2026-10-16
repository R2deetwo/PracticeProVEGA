import React from 'react';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaRealWorkspace — the "this is the actual product" band (R28).
 *
 * Owner direction: "The images do not look like what the app looks like —
 * let us use stuff from the app so that we are not showing false images."
 * This band carries the live captures: the dashboard, the matters ledger
 * and the document vault, framed in the page's lit paper sheets on the
 * espresso ground — the Warm Chambers register the captured skin shares.
 * Every other product band can illustrate; this one is proof.
 *
 * Captures: public/assets/landing/app/ (scripts/r28-app-shots.cjs).
 * Presentational only — zero buttons (ADR-0004).
 */
export const VegaRealWorkspace: React.FC = () => (
    <section id="workspace" aria-labelledby="vega-workspace-heading" className="py-20 md:py-28 bg-vega-night text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8" data-vg-reveal>
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                III — The Workspace
            </p>
            <h2
                id="vega-workspace-heading"
                className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-parchment"
            >
                The workspace, <span className="font-vega-italic text-vega-gilt-bright">as it ships.</span>
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-400 max-w-2xl mb-12 md:mb-16">
                Live captures from the product — the same screens your team works in every
                day. The Warm Chambers register you are reading is the register the app
                runs: nothing on this page is staged.
            </p>

            <div className="space-y-10 md:space-y-14 max-w-6xl">
                <VegaAppShot
                    src="/assets/landing/app/dashboard.jpg"
                    alt="Vega dashboard — active matters, invoices and today's calendar at a glance"
                    caption="LIVE CAPTURE — THE DASHBOARD: MATTERS, FEES AND TODAY'S DATES AT A GLANCE"
                />
                <div className="grid md:grid-cols-2 gap-8 md:gap-10">
                    <VegaAppShot
                        src="/assets/landing/app/matters.jpg"
                        alt="Vega matters ledger — every case with client, stage and court"
                        caption="LIVE CAPTURE — THE MATTERS LEDGER"
                    />
                    <VegaAppShot
                        src="/assets/landing/app/documents.jpg"
                        alt="Vega document vault — filings and drafts organized by matter"
                        caption="LIVE CAPTURE — THE DOCUMENT VAULT"
                    />
                </div>
            </div>
        </div>
    </section>
);
