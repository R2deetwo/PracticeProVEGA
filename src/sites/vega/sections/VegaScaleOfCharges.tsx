import React from 'react';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaScaleOfCharges — the "Scale of Charges" signature moment for /vega.
 *
 * Billing compliance rendered as a LEDGER, not a feature card: a fee note
 * computed under the Scale of Charges (Remuneration Order 2023), set in
 * IBM Plex Mono with tabular numerals, hairline row rules and the classic
 * accounting double-rule under the total. Naira amounts in tabular mono.
 * On the night page the ledger stays a lit paper sheet — the fee note on
 * the desk — while the framing copy runs on the dark ground.
 *
 * Presentational only — zero buttons (ADR-0004), zero hardcoded hexes.
 */

type LedgerRow = {
    item: string;
    particulars: string;
    basis: string;
    amount: string;
};

const LEDGER_ROWS: LedgerRow[] = [
    { item: '01', particulars: 'Consultation & case assessment', basis: 'FIXED FEE', amount: '150,000.00' },
    { item: '02', particulars: 'Writ of Summons & statement of claim', basis: 'ITEM 2, SCALE', amount: '450,000.00' },
    { item: '03', particulars: 'Affidavit of personal service', basis: 'ITEM 4, SCALE', amount: '60,000.00' },
    { item: '04', particulars: 'Motion on notice (interlocutory)', basis: 'ITEM 7, SCALE', amount: '250,000.00' },
    { item: '05', particulars: 'Pre-trial conference appearance', basis: 'ITEM 12, SCALE', amount: '180,000.00' },
];

const LEDGER_TOTAL = '1,090,000.00';

export const VegaScaleOfCharges: React.FC = () => (
    <section
        id="scale-of-charges"
        aria-labelledby="vega-scale-heading"
        className="py-20 md:py-28 border-t border-vega-night/10"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* The LawPavilion panel rhythm alternates — the Scale of
                    Charges band flips the earlier bands: exhibit LEFT, framing
                    copy RIGHT, so the page reads like their alternating
                    feature panels (Elite / AI / Prime / Primsol). */}
                {/* Left — the ledger exhibit (wide, first on reading order) */}
                <div className="lg:col-span-8">
                    {/* R28 — a LIVE CAPTURE of the billing workspace (owner:
                        "use stuff from the app so we are not showing false
                        images"). The designed fee-note ledger it replaced was
                        an illustration; this is the shipping fee surface. */}
                    <VegaAppShot
                        src="/assets/landing/app/billing.jpg"
                        alt="Vega billing — invoices and fee notes in the live workspace"
                        caption="LIVE CAPTURE — FEE NOTES IN THE WORKSPACE, COMPUTED ON THE SCALE OF CHARGES (REMUNERATION ORDER 2023)"
                    />
                </div>

                {/* Right — framing copy on the night ground (narrow) */}
                <div className="lg:col-span-4">
                    <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                        IV — Scale of Charges
                    </p>
                    <h2
                        id="vega-scale-heading"
                        className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-6 text-vega-night"
                    >
                        Fees that follow the{' '}
                        <span className="font-vega-italic text-vega-gilt-bright">
                            Remuneration Order.
                        </span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-700">
                        When Vega bills a matter, every line item is computed on the Scale of
                        Charges under the Remuneration Order 2023 — the schedule your clients
                        and the profession expect to see. Track billable work, apply the right
                        rates, and let the fee note build itself.
                    </p>
                    <p className="font-mono text-2xs tracking-widest text-slate-600 mt-8">
                        EXHIBIT — FEE NOTE COMPUTED ON THE SCALE OF CHARGES (REMUNERATION ORDER 2023)
                    </p>
                </div>
            </div>
        </div>
    </section>
);
