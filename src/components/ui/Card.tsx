import React from 'react';

/**
 * Card — the shared card-surface primitive (design-system Chunk A).
 *
 * Imports CARD_BASE / CARD_WIDGET / CARD_PAD from utils/designTokens.ts,
 * finally giving that zero-adoption token file real consumers (audit 1.1:
 * "the single highest-leverage fix in the repo"). The strings match the
 * dominant card pattern in the codebase exactly (bg-white dark:bg-zinc-800
 * border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm), so
 * adoption is zero-visual-change.
 */

import { CARD_BASE, CARD_WIDGET, CARD_PAD } from '../../utils/designTokens';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Widget cards use rounded-2xl (dashboards, stat tiles). */
  variant?: 'base' | 'widget';
  padding?: 'none' | 'sm' | 'md';
  children?: React.ReactNode;
}

const PADDING: Record<'none' | 'sm' | 'md', string> = {
  none: '',
  sm: 'p-3',
  md: CARD_PAD,
};

export const Card: React.FC<CardProps> = ({
  variant = 'base',
  padding = 'md',
  className = '',
  children,
  ...rest
}) => (
  <div
    className={`${variant === 'widget' ? CARD_WIDGET : CARD_BASE} ${PADDING[padding]} ${className}`}
    {...rest}
  >
    {children}
  </div>
);

Card.displayName = 'Card';
