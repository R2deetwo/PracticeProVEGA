import React from 'react';

/**
 * AtriumReceipt — the "resident receipt" signature moment for /atrium.
 *
 * Atrium's equivalent of Vega's legal document, and its deliberate
 * opposite: a rounded 20px warm paper card with a soft shadow and a
 * TERRACOTTA PAID stamp (R32 — rubber-stamp ink is clay-red in the real
 * world) — tactile, hospitable, financially transparent. Naira amounts
 * in tabular IBM Plex Mono; dotted leaders; reference numbers in mono.
 * Presentational only — zero raw form elements.
 */

const RECEIPT_LINES: Array<{ label: string; amount: string; note?: string }> = [
    { label: 'Rent (annual)', amount: '2,400,000.00' },
    { label: 'Service charge', amount: '360,000.00', note: 'Q4 2026' },
    { label: 'Sentry Pass add-on', amount: '7,500.00', note: 'OCT 2026' },
];

export const AtriumReceipt: React.FC = () => (
    <section
        aria-labelledby="atrium-receipt-heading"
        className="py-20 md:py-28"
        style={{ background: 'var(--color-sage)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                {/* Left — framing copy */}
                <div className="lg:col-span-5">
                    <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-clay mb-5">
                        Rent &amp; Service-Charge Collection
                    </p>
                    <h2
                        id="atrium-receipt-heading"
                        className="font-display text-3xl md:text-4xl font-bold tracking-tight leading-[1.15] mb-6"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        Every payment,{' '}
                        <span className="text-atrium-clay">receipted</span> — automatically.
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-600 mb-8">
                        Collect rent in Naira with payment reminders, receipt generation, and
                        payment tracking. The moment a transfer is confirmed, the receipt is
                        issued, mapped to the right unit, and waiting in the resident&rsquo;s
                        portal — no phone calls, no &ldquo;where is my receipt?&rdquo;.
                    </p>
                    <div className="flex flex-wrap gap-6">
                        <div>
                            <p className="font-mono nums-tabular text-2xl font-semibold text-atrium-clay-deep">
                                0
                            </p>
                            <p className="text-sm text-slate-500 mt-1">receipts typed by hand</p>
                        </div>
                        <div>
                            <p className="font-mono nums-tabular text-2xl font-semibold text-atrium-clay-deep">
                                1 tap
                            </p>
                            <p className="text-sm text-slate-500 mt-1">to share any notice to WhatsApp</p>
                        </div>
                    </div>
                </div>

                {/* Right — the receipt card */}
                <div className="lg:col-span-7 flex justify-center lg:justify-end">
                    <div className="relative w-full max-w-md">
                        <figure className="at-receipt px-7 py-8 m-0" aria-label="Exhibit — a resident's rent receipt generated automatically by Atrium">
                            {/* Receipt header */}
                            <div className="flex items-baseline justify-between mb-6">
                                <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-800">
                                    Estate Receipt
                                </p>
                                <p className="font-mono text-2xs tracking-wider text-slate-500">
                                    NO. ATR-2026-0847
                                </p>
                            </div>

                            {/* Resident */}
                            <p className="text-sm font-semibold text-slate-800">Mrs. Adaeze Nwosu</p>
                            <p className="text-sm text-slate-500 mb-6">
                                Unit B14, Phase 2 · Wemabod Estate, Ikeja
                            </p>

                            {/* Line items with dotted leaders */}
                            <div className="space-y-3.5 mb-6">
                                {RECEIPT_LINES.map((line) => (
                                    <div key={line.label} className="at-receipt__row">
                                        <span className="text-sm text-slate-700 whitespace-nowrap">
                                            {line.label}
                                            {line.note && (
                                                <span className="font-mono text-2xs text-slate-400 ml-2">
                                                    {line.note}
                                                </span>
                                            )}
                                        </span>
                                        <span className="at-receipt__leader" aria-hidden="true" />
                                        <span className="font-mono nums-tabular text-sm text-slate-900 whitespace-nowrap">
                                            &#8358;{line.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="at-receipt__row border-t border-slate-200 pt-4">
                                <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                    Total
                                </span>
                                <span className="at-receipt__leader" aria-hidden="true" />
                                <span className="font-mono nums-tabular text-base font-semibold text-slate-900">
                                    &#8358;2,767,500.00
                                </span>
                            </div>

                            {/* PAID stamp — the emerald ink stamp */}
                            <div className="flex justify-center mt-7 mb-2">
                                <span className="at-stamp font-mono text-sm font-semibold uppercase tracking-[0.3em] px-5 py-2">
                                    Paid
                                </span>
                            </div>
                            <p className="font-mono text-2xs tracking-wider text-slate-400 text-center">
                                BANK TRANSFER · CONFIRMED 09 OCT 2026 · ISSUED BY ATRIUM
                            </p>
                        </figure>
                        <p className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center">
                            RECEIPT NO. ATR-2026-0847 — GENERATED AUTOMATICALLY
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>
);
