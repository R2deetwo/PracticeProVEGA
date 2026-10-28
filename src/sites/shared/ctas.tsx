import React from 'react';

/** Primary CTA button — the ramp fill (brand.md §4.1 sanctioned gradient
 *  #2) on the 6px interactive radius, neutral elevation only.
 *  tone='vega' is the Daylight Chambers register (R37): a notary-claret
 *  PILL with cream text — the accent fill on the ivory ground (claret is
 *  the Vega accent, not page decoration).
 *  tone='atrium' is the Well-Kept Estate register: a flat emerald fill
 *  (the Atrium accent #059669), never a gradient, never moss. */
export const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; tone?: 'green' | 'vega' | 'atrium' }> = ({ onClick, children, className = '', tone = 'green' }) => (
    <button
        onClick={onClick}
        className={`relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            tone === 'vega'
                ? 'bg-vega-gilt text-vega-parchment hover:bg-vega-claret-bright shadow-sm !rounded-full'
                : tone === 'atrium'
                ? 'bg-atrium-emerald text-white hover:bg-emerald-700 shadow-sm'
                : 'text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md'
        } ${className}`}
    >
        {children}
    </button>
);

/** Ghost/secondary button — tone='vega' is the espresso-outline pill
 *  variant for the ivory ground (a quiet ink rule that warms to claret on
 *  hover — R37);
 *  tone='atrium' is the warm emerald-outline variant for the photo hero. */
export const GhostButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; tone?: 'green' | 'vega' | 'atrium' }> = ({ onClick, children, className = '', tone = 'green' }) => (
    <button
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            tone === 'vega'
                ? 'bg-transparent text-vega-night border border-vega-night/25 hover:border-vega-gilt hover:text-vega-gilt-bright !rounded-full'
                : tone === 'atrium'
                ? 'bg-white/85 text-emerald-700 border border-emerald-600/40 backdrop-blur-sm hover:border-emerald-600 hover:bg-white'
                : 'bg-white/70 text-slate-800 border border-slate-200 backdrop-blur-sm hover:bg-white'
        } ${className}`}
    >
        {children}
    </button>
);
