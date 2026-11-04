import React from 'react';

/** Primary CTA button — the ramp fill (brand.md §4.1 sanctioned gradient
 *  #2) on the 6px interactive radius, neutral elevation only.
 *  tone='vega' is the R56 light-enterprise register: a deep navy pill
 *  (#1E3A8A→#1E40AF, the executive accent) with white text.
 *  tone='atrium' is the Well-Kept Estate register: a flat emerald fill
 *  (the Atrium accent #059669), never a gradient, never moss. */
export const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; tone?: 'green' | 'vega' | 'atrium' }> = ({ onClick, children, className = '', tone = 'green' }) => (
    <button
        onClick={onClick}
        className={`relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            tone === 'vega'
                ? 'bg-[#1E3A8A] text-white hover:bg-[#1E40AF] shadow-sm !rounded-full'
                : tone === 'atrium'
                ? 'bg-atrium-emerald text-white hover:bg-emerald-700 shadow-sm'
                : 'text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md'
        } ${className}`}
    >
        {children}
    </button>
);

/** Ghost/secondary button — tone='vega' is the R56 light-enterprise
 *  outline: slate hairline that warms to navy on hover, for the white
 *  ground;
 *  tone='atrium' is the warm emerald-outline variant for the photo hero. */
export const GhostButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string; tone?: 'green' | 'vega' | 'atrium' }> = ({ onClick, children, className = '', tone = 'green' }) => (
    <button
        onClick={onClick}
        className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm transition-all duration-300 active:scale-[0.97] ${
            tone === 'vega'
                ? 'bg-white text-slate-700 border border-slate-300 hover:border-[#1E3A8A] hover:text-[#1E3A8A] !rounded-full'
                : tone === 'atrium'
                ? 'bg-white/85 text-emerald-700 border border-emerald-600/40 backdrop-blur-sm hover:border-emerald-600 hover:bg-white'
                : 'bg-white/70 text-slate-800 border border-slate-200 backdrop-blur-sm hover:bg-white'
        } ${className}`}
    >
        {children}
    </button>
);
