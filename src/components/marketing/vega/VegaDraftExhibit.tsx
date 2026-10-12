import React from 'react';

/**
 * VegaDraftExhibit — the "drafting" signature moment for /vega.
 *
 * DraftPro/ALOA shown as tracked-changes annotations on a settlement
 * clause — not a chat screenshot. A white sheet on the ink ALOA band:
 * amber-underlined insertions, struck deletions, and mono margin notes
 * (one ALOA drafting suggestion, one PII Shield receipt) joined to the
 * clause by hairline leaders.
 *
 * Presentational only — zero buttons (ADR-0004), zero hardcoded hexes.
 */

export const VegaDraftExhibit: React.FC = () => (
    <figure
        className="vg-doc px-5 py-6 sm:px-7 sm:py-7 m-0"
        aria-label="Exhibit — a settlement clause with DraftPro tracked changes and ALOA annotations"
    >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 mb-5">
            <p className="font-mono text-2xs tracking-widest text-slate-800">
                TERMS OF SETTLEMENT — TRACKED CHANGES
            </p>
            <div className="flex items-center gap-2">
                <span className="font-mono text-2xs tracking-widest text-vega-claret-deep border border-vega-claret/40 bg-vega-claret/5 px-2 py-0.5">
                    2 INSERTIONS
                </span>
                <span className="font-mono text-2xs tracking-widest text-slate-500 border border-slate-300 px-2 py-0.5">
                    1 DELETION
                </span>
            </div>
        </div>

        {/* The clause — set in Times New Roman, the register of the
            instrument itself */}
        <div className="vg-pleading text-sm sm:text-base leading-[1.7] text-slate-800">
            <p className="vg-doc__line vg-doc__body">
                3. The Defendant shall pay the Claimant the sum of &#8358;2,450,000.00 (Two
                Million, Four Hundred and Fifty Thousand Naira only){' '}
                <span className="vg-ins">within 21 days of the date of this Order</span>,{' '}
                <span className="vg-del">failing which interest shall accrue</span>{' '}
                <span className="vg-ins">together with interest at 10% per annum from the date of
                this Order until final payment</span>.
            </p>
        </div>

        {/* Margin notes — joined to the clause by a hairline */}
        <div className="border-t border-slate-200 mt-6 pt-4 space-y-3">
            <div className="flex items-start gap-3">
                <span className="inline-block w-4 h-px bg-vega-claret mt-2.5 flex-shrink-0" aria-hidden="true" />
                <p className="vg-note text-vega-claret-deep">
                    ALOA — DEFINE &ldquo;FINAL PAYMENT&rdquo;, OR SUBSTITUTE &ldquo;FULL LIQUIDATION OF THE
                    JUDGMENT SUM&rdquo;.
                </p>
            </div>
            <div className="flex items-start gap-3">
                <span className="inline-block w-4 h-px bg-slate-300 mt-2.5 flex-shrink-0" aria-hidden="true" />
                <p className="vg-note text-slate-500">
                    PII SHIELD — 2 IDENTIFIERS REDACTED BEFORE DRAFTING · NDPA 2023
                </p>
            </div>
        </div>

        <figcaption className="flex items-center justify-between border-t border-slate-200 mt-5 pt-3">
            <span className="font-mono text-2xs tracking-widest text-slate-400">
                DRAFTPRO · TERMS OF SETTLEMENT, CLAUSE 3 OF 11
            </span>
            <span className="font-mono text-2xs tracking-widest text-slate-400">REV 4</span>
        </figcaption>
    </figure>
);
