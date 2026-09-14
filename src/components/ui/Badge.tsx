import React from 'react';

/**
 * Badge — the shared status-pill primitive (design-system Chunk A).
 *
 * Tone vocabulary and color strings deliberately mirror
 * ui/FinancialStatusBadge.tsx (the existing de-facto standard:
 * bg-X-100 text-X-700 dark:bg-X-900/30 dark:text-X-400) so the two
 * components render identically for the same tone and can converge later.
 *
 * Use FinancialStatusBadge when you have a raw payment/lease status STRING
 * that needs mapping; use Badge when you already know the tone.
 */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'xs' | 'sm';
  children: React.ReactNode;
}

const TONES: Record<BadgeTone, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
  outline: 'border border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-400',
};

const SIZES = {
  xs: 'text-2xs px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...rest
}) => (
  <span
    className={`inline-flex items-center font-semibold rounded-md whitespace-nowrap ${TONES[tone]} ${SIZES[size]} ${className}`}
    {...rest}
  >
    {children}
  </span>
);

Badge.displayName = 'Badge';
