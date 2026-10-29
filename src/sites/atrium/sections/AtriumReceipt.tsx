import React from 'react';

/**
 * AtriumReceipt — the collection band for /atrium, R40 edition.
 *
 * Owner direction (R40): "let's use live mockups for the invoice — how
 * it actually looks." The band now carries a REAL capture of the app's
 * own invoice (INV/RENT/24-001 in the demo estate, opened from
 * Financials) instead of the hand-built invoice card.
 *
 *   · THE APP'S OWN INVOICE — issued by the management company, billed
 *     to the resident, line by line. Never "Estate Receipt", never
 *     Atrium's name — Atrium issues FOR the manager; the manager's
 *     residents see the manager's paper.
 *   · RECEIPT DELIVERY — a confirmed payment manifests as a receipt
 *     SENT to the resident's email and phone (and waiting in the
 *     portal), not as a rubber stamp.
 *   · PAYMENT OPTIONS — ON TIME or AHEAD. "In part" is retired from
 *     the site (owner direction, R40: property managers don't want to
 *     advertise part-payment) — the capability itself stays in the app,
 *     where a manager records whatever actually arrived.
 *
 * Presentational only — zero interactive controls (ADR-0004).
 */
export const AtriumReceipt: React.FC = () => {
    // Cache-busted like every landing asset (VITE_BUILD_SHA).
    const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();

    return (
        <section
            aria-labelledby="atrium-receipt-heading"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    {/* Left — framing copy + how residents pay */}
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
                            The invoice on the right is the app&rsquo;s own — captured from the
                            running product, exactly as the resident receives it.
                        </p>

                        {/* How residents pay — on time or ahead. (In part stays
                            an in-app capability; the site no longer advertises
                            it, per owner direction R40.) */}
                        <p className="text-2xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                            How residents pay
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 rounded-lg bg-white/70 border border-slate-200/80 px-4 py-3.5">
                                <span className="w-2 h-2 rounded-full bg-atrium-emerald mt-1.5 flex-shrink-0" aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-bold text-slate-800">On time</p>
                                    <p className="text-2xs leading-relaxed text-slate-600 mt-0.5">
                                        Paid in full by the due date — the receipt lands the moment
                                        the transfer is confirmed.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg bg-white/70 border border-slate-200/80 px-4 py-3.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Ahead</p>
                                    <p className="text-2xs leading-relaxed text-slate-600 mt-0.5">
                                        Months paid in advance — prepaid lines read blue in the
                                        ledger, the same coding the estate band teaches.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right — the app's own invoice, as the resident receives it */}
                    <div className="lg:col-span-7 flex justify-center lg:justify-end">
                        <figure className="m-0 w-full max-w-xl">
                            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_0_rgb(75_50_35/0.08),0_18px_28px_-12px_rgb(75_50_35/0.16)] p-2.5 sm:p-3">
                                <div className="rounded-lg overflow-hidden border border-slate-200/70 bg-white">
                                    <img
                                        src={`/assets/landing/app/atrium-invoice.jpg?v=${buildSha}`}
                                        alt="The app's own invoice — INV/RENT/24-001 from the management company to the resident: line items, totals and bank details, exactly as received"
                                        className="w-full h-auto block"
                                        loading="lazy"
                                        decoding="async"
                                        width={1440}
                                        height={900}
                                    />
                                </div>
                            </div>
                            <figcaption className="font-mono text-2xs tracking-wider text-slate-500 mt-5 text-center">
                                LIVE CAPTURE — THE APP&rsquo;S OWN INVOICE, OPENED FROM FINANCIALS · ISSUED BY THE ESTATE MANAGER, NOT &ldquo;ESTATE RECEIPTS&rdquo;
                            </figcaption>
                        </figure>
                    </div>
                </div>

                {/* Receipt delivery — the confirmed payment, manifested */}
                <div className="mt-12 md:mt-14 max-w-3xl mx-auto rounded-2xl bg-emerald-50/70 border border-emerald-200/70 px-5 py-4 flex items-start gap-3.5">
                    <span className="w-8 h-8 rounded-full bg-atrium-emerald/12 flex items-center justify-center flex-shrink-0 text-atrium-emerald" aria-hidden="true">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
                            <path d="M2 4.5 8 9l6-4.5" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-800">
                            Receipt sent — email, phone, and the portal
                        </p>
                        <p className="text-2xs text-emerald-700/85 leading-relaxed mt-1">
                            The moment a transfer is confirmed, the receipt leaves in your
                            management company&rsquo;s name to the resident&rsquo;s email and
                            phone — a receipt for every payment, prepaid quarters included — and
                            it is waiting in their portal the next time they sign in.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
