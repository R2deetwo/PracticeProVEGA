import React from 'react';

/**
 * VegaScaleOfCharges — the "Scale of Charges" signature moment for /vega.
 *
 * Billing compliance rendered as a LEDGER, not a feature card: a fee note
 * computed under the Scale of Charges (Remuneration Order 2023), set in
 * IBM Plex Mono with tabular numerals, hairline row rules and the classic
 * accounting double-rule under the total. Naira amounts in tabular mono.
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
        aria-labelledby="vega-scale-heading"
        className="py-20 md:py-28 border-t border-slate-200"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Left — framing copy */}
                <div className="lg:col-span-4">
                    <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-amber-deep mb-7">
                        04 — Scale of Charges
                    </p>
                    <h2
                        id="vega-scale-heading"
                        className="font-vega text-3xl md:text-4xl font-semibold leading-[1.12] tracking-[-0.01em] mb-6"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        Fees that follow the{' '}
                        <span className="font-vega-italic font-medium">
                            Remuneration Order.
                        </span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-600">
                        When Vega bills a matter, every line item is computed on the Scale of
                        Charges under the Remuneration Order 2023 — the schedule your clients
                        and the profession expect to see. Track billable work, apply the right
                        rates, and let the fee note build itself.
                    </p>
                </div>

                {/* Right — the ledger exhibit */}
                <div className="lg:col-span-8">
                    <div className="vg-doc px-5 py-6 sm:px-8 sm:py-8 overflow-x-auto">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-4 mb-2">
                            <p className="font-mono text-2xs tracking-widest text-slate-800">
                                FEE NOTE — OKAFOR v. MERIDIAN LOGISTICS LTD
                            </p>
                            <p className="font-mono text-2xs tracking-widest text-slate-400">
                                SUIT NO. LD/ADR/2026/0847
                            </p>
                        </div>

                        <table className="vg-ledger w-full text-left text-xs sm:text-sm">
                            <thead>
                                <tr className="text-slate-500">
                                    <th scope="col" className="font-normal text-2xs tracking-widest py-3 pr-2">ITEM</th>
                                    <th scope="col" className="font-normal text-2xs tracking-widest py-3 pr-2">PARTICULARS</th>
                                    <th scope="col" className="font-normal text-2xs tracking-widest py-3 pr-2 hidden sm:table-cell">BASIS</th>
                                    <th scope="col" className="font-normal text-2xs tracking-widest py-3 text-right">AMOUNT (&#8358;)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {LEDGER_ROWS.map((row) => (
                                    <tr key={row.item}>
                                        <td className="py-3.5 pr-2 text-slate-400 align-baseline">{row.item}</td>
                                        <td className="py-3.5 pr-2 text-slate-800 align-baseline">{row.particulars}</td>
                                        <td className="py-3.5 pr-2 text-slate-400 align-baseline hidden sm:table-cell">{row.basis}</td>
                                        <td className="py-3.5 text-right text-slate-900 align-baseline">{row.amount}</td>
                                    </tr>
                                ))}
                                <tr data-total="true">
                                    <td colSpan={2} className="py-4 pr-2 text-slate-900 font-medium">
                                        TOTAL FEES
                                    </td>
                                    <td className="py-4 pr-2 hidden sm:table-cell" />
                                    <td className="py-4 text-right text-vega-amber-deep font-medium">
                                        {LEDGER_TOTAL}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
                            <p className="font-mono text-2xs tracking-widest text-slate-400">
                                VAT &amp; DISBURSEMENTS BILLED SEPARATELY
                            </p>
                            <p className="font-mono text-2xs tracking-widest text-slate-400">
                                COMPUTED IN VEGA BILLING · 12 OCT 2026
                            </p>
                        </div>
                    </div>
                    <p className="font-mono text-2xs tracking-widest text-slate-500 mt-5">
                        EXHIBIT — FEE NOTE COMPUTED ON THE SCALE OF CHARGES (REMUNERATION ORDER 2023)
                    </p>
                </div>
            </div>
        </div>
    </section>
);
