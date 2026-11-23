import React from 'react';

/**
 * AtriumDiaspora — the diaspora property-owner callout for /atrium.
 *
 * 2026-11-23 (owner direction): promote the diaspora landlord/property
 * owner FAQ content into a concise, dedicated callout block — "Managing
 * Nigerian property from abroad — full visibility into rent collection,
 * arrears, and recovery without relying on an unverified local proxy."
 *
 * Every line is grounded in the shipped product (the FAQ answer it
 * promotes): real-time collections, service charges, maintenance tickets
 * and resident communications on the dashboard; residents on the
 * Residents' Portal; an optional local manager with granular access
 * controls. No invented metrics, no testimonial personas.
 *
 * Register: the warm paper ground between the sage capability band
 * (AtriumWhyRunOn) and the white FAQ — one emerald callout card, the
 * same emerald-50 treatment the receipt-delivery callout uses.
 * Presentational only (ADR-0004).
 */
export const AtriumDiaspora: React.FC = () => {
    return (
        <section
            aria-labelledby="atrium-diaspora-heading"
            className="py-16 md:py-20"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 px-6 py-8 md:px-10 md:py-10">
                    <p className="text-2xs font-bold uppercase tracking-[0.3em] text-atrium-emerald mb-4">
                        For diaspora property owners
                    </p>
                    <h2
                        id="atrium-diaspora-heading"
                        className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-[1.15] mb-4"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        Managing Nigerian property from abroad.
                    </h2>
                    <p className="text-base md:text-lg leading-[1.7] text-slate-600 mb-4">
                        Full visibility into rent collection, arrears, and recovery —
                        without relying on an unverified local proxy.
                    </p>
                    <p className="text-sm leading-[1.7] text-slate-500">
                        Watch collections, service charges, maintenance tickets and
                        resident communications in real time on the dashboard. Your
                        residents use the Residents&rsquo; Portal for payments and
                        requests. And if you want boots on the ground, assign a local
                        property manager with granular access controls — or run
                        everything yourself remotely.
                    </p>
                </div>
            </div>
        </section>
    );
};
