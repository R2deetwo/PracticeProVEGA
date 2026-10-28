import React, { useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * AtriumReceipt — the collection band for /atrium, R39 edition.
 *
 * Owner direction (R39): the old paper "Estate Receipt" was confusing —
 * the band now shows THE APP'S OWN INVOICE, the way the resident
 * receives it:
 *
 *   · ISSUED BY THE MANAGEMENT COMPANY — Ashford Property Managers
 *     Ltd., billed to the resident, invoice number in the app's own
 *     INV-[initials]-[sequence] format (invoiceHelpers.ts). Never
 *     "Estate Receipt", never Atrium's name — Atrium issues FOR the
 *     manager; the manager's residents see the manager's paper.
 *   · REGULAR LINE ITEMS ONLY — rent and service charge. Sentry Pass
 *     is an add-on the ESTATE MANAGER pays for; it never appears on a
 *     resident's paper (removed).
 *   · RECEIPT DELIVERY — a confirmed payment manifests as a receipt
 *     SENT to the resident's email and phone (and waiting in the
 *     portal), not as a rubber stamp.
 *   · PAYMENT OPTIONS — on time, in part, or AHEAD (prepaid): three
 *     options on the left, one tap re-renders the invoice. Prepaid
 *     months read blue — the same coding the estate band teaches.
 *   · The demo-estate vanity figures (₦48.6M collected YTD, "receipts
 *     typed by hand: 0") are retired (owner direction).
 *
 * Naira amounts in tabular IBM Plex Mono. Interactive controls use the
 * ui/Button primitive (ADR-0004), never raw elements.
 */

type PayOption = 'ontime' | 'part' | 'ahead';

/** The invoice's line items for each payment option — the resident's
 *  paper, re-rendered by the option chosen. Amounts consistent with
 *  the estate band's Unit A3 (Mrs. Folake Adeyemi — the prepaid unit). */
const RENT = 2400000;
const SC = 360000;

const OPTION_LINES: Record<PayOption, Array<{ label: string; note?: string; amount: string; status: 'Paid' | 'Partial' | 'Prepaid' }>> = {
    ontime: [
        { label: 'Rent (annual)', note: 'Jan — Dec 2026', amount: '2,400,000.00', status: 'Paid' },
        { label: 'Service charge', note: 'Q4 2026', amount: '360,000.00', status: 'Paid' },
    ],
    part: [
        { label: 'Rent (annual)', note: 'Jan — Dec 2026', amount: '2,400,000.00', status: 'Paid' },
        { label: 'Service charge', note: 'Q4 2026 · ₦120,000 of ₦360,000 received', amount: '120,000.00', status: 'Partial' },
    ],
    ahead: [
        { label: 'Rent (annual)', note: 'Jan — Dec 2026', amount: '2,400,000.00', status: 'Paid' },
        { label: 'Service charge', note: 'Q4 2026', amount: '360,000.00', status: 'Paid' },
        { label: 'Service charge', note: 'Q1 2027 · paid in advance', amount: '360,000.00', status: 'Prepaid' },
    ],
};

const OPTION_TOTALS: Record<PayOption, string> = {
    ontime: '2,760,000.00',
    part: '2,520,000.00',
    ahead: '3,120,000.00',
};

/** Ledger-row status chip colours — the same R39 coding as the estate
 *  band: emerald Paid, violet Partial, blue Prepaid. */
const ROW_CHIP: Record<string, string> = {
    Paid: 'text-emerald-700',
    Partial: 'text-violet-600',
    Prepaid: 'text-blue-600',
};

const PAY_OPTIONS: Array<{ key: PayOption; label: string; blurb: string }> = [
    { key: 'ontime', label: 'On time', blurb: 'Paid in full by the due date — the receipt lands the moment the transfer is confirmed.' },
    { key: 'part', label: 'In part', blurb: 'A part payment is receipted for exactly what arrived; the balance stays on the ledger.' },
    { key: 'ahead', label: 'Ahead', blurb: 'Months paid in advance — prepaid lines read blue in the ledger, the estate band\u2019s own coding.' },
];

/** The envelope glyph — the receipt's journey, not a rubber stamp. */
const SentGlyph: React.FC = () => (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
        <path d="M2 4.5 8 9l6-4.5" />
    </svg>
);

export const AtriumReceipt: React.FC = () => {
    const [option, setOption] = useState<PayOption>('ahead');
    const lines = OPTION_LINES[option];

    return (
        <section
            aria-labelledby="atrium-receipt-heading"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                    {/* Left — framing copy + the payment options */}
                    <div className="lg:col-span-5">
                        <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-emerald mb-5">
                            Rent &amp; Service-Charge Collection
                        </p>
                        <h2
                            id="atrium-receipt-heading"
                            className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-[1.15] mb-6"
                            style={{ color: 'var(--color-ink)' }}
                        >
                            Every payment,{' '}
                            <span className="text-atrium-emerald">receipted</span> — automatically.
                        </h2>
                        <p className="text-base md:text-lg leading-[1.7] text-slate-600 mb-4">
                            Collect rent in Naira with payment reminders, invoice generation, and
                            payment tracking. The moment a transfer is confirmed, the receipt is
                            issued in your management company&rsquo;s name, mapped to the right
                            unit, and sent to the resident&rsquo;s email and phone — no phone
                            calls, no &ldquo;where is my receipt?&rdquo;.
                        </p>
                        <p className="text-sm leading-[1.7] text-slate-500 mb-8">
                            The invoice below is the app&rsquo;s own — billed by the estate
                            manager, line by line, exactly as the resident receives it.
                        </p>

                        {/* The payment options — tap one, the invoice
                            re-renders. Prepaid is a first-class choice. */}
                        <p className="text-2xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                            How residents pay
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Payment options">
                            {PAY_OPTIONS.map((o) => {
                                const on = option === o.key;
                                return (
                                    <Button
                                        key={o.key}
                                        variant="bare"
                                        aria-pressed={on}
                                        onClick={() => setOption(o.key)}
                                        className={`rounded-full px-4 py-2 text-xs font-bold tracking-tight transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-atrium-emerald ${
                                            on
                                                ? 'bg-atrium-emerald text-white'
                                                : 'border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        {o.label}
                                    </Button>
                                );
                            })}
                        </div>
                        <p className="text-sm text-slate-600 leading-[1.7] min-h-[3.5rem]" aria-live="polite">
                            {PAY_OPTIONS.find((o) => o.key === option)?.blurb}
                        </p>
                    </div>

                    {/* Right — the app's invoice, as the resident receives it */}
                    <div className="lg:col-span-7 flex justify-center lg:justify-end">
                        <div className="w-full max-w-md">
                            <figure
                                className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_0_rgb(75_50_35/0.08),0_18px_28px_-12px_rgb(75_50_35/0.16)] px-6 sm:px-7 py-7 m-0"
                                aria-label="Exhibit — the app's invoice for a resident, with the receipt delivered to email and phone"
                            >
                                {/* Letterhead — the MANAGEMENT COMPANY'S paper,
                                    never Atrium's name, never "Estate Receipt". */}
                                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 mb-5">
                                    <div>
                                        <div className="flex items-center gap-2.5 mb-1">
                                            <span className="w-7 h-7 rounded-md bg-atrium-emerald/10 border border-atrium-emerald/25 flex items-center justify-center" aria-hidden="true">
                                                <svg className="w-3.5 h-3.5 text-atrium-emerald" viewBox="0 0 20 20" fill="currentColor"><path d="M3 8.5 10 3l7 5.5V17h-5v-4.5h-4V17H3V8.5Z"/></svg>
                                            </span>
                                            <p className="text-sm font-bold text-slate-900 leading-tight">
                                                Ashford Property Managers Ltd.
                                            </p>
                                        </div>
                                        <p className="text-2xs text-slate-500 leading-relaxed">
                                            Estate managers — Wemabod Estate, Phase 2, Ikeja
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-display text-xl font-bold text-slate-900 tracking-tight">INVOICE</p>
                                        <p className="font-mono text-2xs text-slate-500 mt-1">NO. INV-APM-0147</p>
                                        <p className="font-mono text-2xs text-slate-500">12 OCT 2026</p>
                                    </div>
                                </div>

                                {/* Billed to */}
                                <div className="mb-5">
                                    <p className="text-2xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-1.5">Billed to</p>
                                    <p className="text-sm font-semibold text-slate-800">Mrs. Folake Adeyemi</p>
                                    <p className="text-xs text-slate-500">Unit A3, Wemabod Estate, Phase 2 · Ikeja</p>
                                </div>

                                {/* Line items — rent and service charge only.
                                    No add-ons: Sentry Pass is the manager's
                                    tool, not the resident's charge. */}
                                <div className="space-y-3 mb-5">
                                    {lines.map((line) => (
                                        <div key={`${line.label}-${line.note}`} className="flex items-baseline justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="text-sm text-slate-700">{line.label}</span>
                                                {line.note && (
                                                    <span className="font-mono text-2xs text-slate-400 ml-2 whitespace-nowrap">{line.note}</span>
                                                )}
                                                <span className={`block font-mono text-2xs font-bold uppercase tracking-wider mt-0.5 ${ROW_CHIP[line.status]}`}>
                                                    {line.status}
                                                </span>
                                            </span>
                                            <span className="font-mono nums-tabular text-sm text-slate-900 whitespace-nowrap">
                                                &#8358;{line.amount}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Total */}
                                <div className="flex items-baseline justify-between border-t border-slate-200 pt-4 mb-2">
                                    <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                        {option === 'part' ? 'Received' : 'Total'}
                                    </span>
                                    <span className="font-mono nums-tabular text-base font-semibold text-slate-900">
                                        &#8358;{OPTION_TOTALS[option]}
                                    </span>
                                </div>
                                {option === 'part' && (
                                    <p className="text-2xs text-violet-600 font-semibold text-right mb-1">
                                        Balance &#8358;240,000.00 — due 30 Nov 2026
                                    </p>
                                )}
                                <p className="font-mono text-2xs tracking-wider text-slate-400 text-right mb-5">
                                    BANK TRANSFER · GTB · ASHFORD PROPERTY MANAGERS LTD.
                                </p>

                                {/* RECEIPT DELIVERY — the confirmed payment
                                    manifests as a receipt SENT, not stamped. */}
                                <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/70 px-4 py-3.5 flex items-start gap-3">
                                    <span className="w-7 h-7 rounded-full bg-atrium-emerald/12 flex items-center justify-center flex-shrink-0 text-atrium-emerald">
                                        <SentGlyph />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-emerald-800">
                                            Receipt sent
                                        </p>
                                        <p className="text-2xs text-emerald-700/85 leading-relaxed mt-0.5">
                                            folake.adeyemi@gmail.com · +234 803 ··· 4567 — the
                                            moment the transfer was confirmed{option === 'ahead' ? ', one receipt per prepaid quarter' : ''}.
                                            Also waiting in her portal.
                                        </p>
                                    </div>
                                </div>
                            </figure>
                            <p className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center">
                                THE APP&rsquo;S OWN INVOICE — ISSUED BY THE ESTATE MANAGER · TAP AN OPTION TO RE-RENDER IT
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
