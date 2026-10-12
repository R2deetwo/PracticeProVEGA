import React from 'react';

/**
 * VegaIndexLine — /vega's replacement for the shared stat-chip row.
 *
 * "The Chambers Standard" register: NOT four stat cards, but ONE mono
 * index line set between hairlines — the running head of a law report.
 * Every claim is verifiable and already shipped copy: the company works
 * from Lagos, the platform is NDPA 2023 compliant, 99.9% uptime, TLS 1.3.
 *
 * Presentational only — zero buttons (ADR-0004), zero hardcoded hexes.
 */
export const VegaIndexLine: React.FC = () => (
    <div
        className="w-full border-t border-b border-slate-200 px-4 sm:px-6 py-4"
        style={{ background: 'var(--color-paper)' }}
        role="doc-subtitle"
        aria-label="PracticePro Vega — key facts"
    >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1.5 sm:gap-6">
            <p className="font-mono text-2xs sm:text-xs tracking-[0.22em] text-slate-600 text-center sm:text-left whitespace-normal sm:whitespace-nowrap">
                EST. LAGOS <span className="text-vega-amber mx-1">·</span> NDPA 2023{' '}
                <span className="text-vega-amber mx-1">·</span> 99.9% UPTIME{' '}
                <span className="text-vega-amber mx-1">·</span> TLS 1.3
            </p>
            <p className="font-mono text-2xs tracking-[0.22em] text-slate-400 text-center sm:text-right whitespace-nowrap">
                PRACTICEPRO VEGA — LEGAL PRACTICE OS
            </p>
        </div>
    </div>
);
