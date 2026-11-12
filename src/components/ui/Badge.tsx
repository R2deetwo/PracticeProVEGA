import React from 'react';

/**
 * Badge — the shared status-pill primitive (design-system Chunk A).
 *
 * UX-02: the tone palette is expressed in the SAME semantic status tokens
 * as FinancialStatusBadge (bg-status-X/10 + text-status-X on the status
 * family) — one vocabulary,
 * theme-aware by construction, identical rendering for the same tone in
 * both components.
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
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
  danger: 'bg-status-danger/10 text-status-danger',
  info: 'bg-status-info/10 text-status-info',
  neutral: 'bg-dim-100 text-dim-600 dark:bg-dim-800 dark:text-dim-400',
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
    className={`inline-flex items-center font-semibold rounded-sm whitespace-nowrap ${TONES[tone]} ${SIZES[size]} ${className}`}
    {...rest}
  >
    {children}
  </span>
);

Badge.displayName = 'Badge';
