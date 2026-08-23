/**
 * Card components — Two card types, enforced.
 *
 * SurfaceCard: Solid surface for dashboard widgets, lists, settings panels.
 *   Uses bg-white/dark:bg-zinc-800 + border + shadow. The grounded layer.
 *
 * GlassCard: Glassmorphism for overlays, floating panels, premium highlights.
 *   Uses backdrop-blur + semi-transparent bg. The floating layer.
 *
 * Usage:
 *   <SurfaceCard className="p-4">
 *     <h3>Revenue Summary</h3>
 *     <p>₦1,234,567.00</p>
 *   </SurfaceCard>
 *
 *   <GlassCard className="p-4">
 *     <p>Floating tooltip content</p>
 *   </GlassCard>
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

// ─── SurfaceCard ───────────────────────────────────────────────────────────
// The grounded, solid surface. Used for dashboard widgets, lists, settings,
// and any content that should feel "attached" to the page.
export const SurfaceCard: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => (
  <div
    onClick={onClick}
    className={`
      bg-white dark:bg-zinc-800
      border border-slate-200 dark:border-zinc-700
      rounded-xl shadow-sm
      ${hoverable ? 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''}
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `.trim()}
  >
    {children}
  </div>
);

// ─── GlassCard ─────────────────────────────────────────────────────────────
// The floating, glassmorphism surface. Used for overlays, dropdowns,
// tooltips, mobile bottom sheets, and premium highlight cards.
// Reserved for elements that float ABOVE the content layer.
export const GlassCard: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => (
  <div
    onClick={onClick}
    className={`
      glass-card
      ${hoverable ? 'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''}
      ${onClick ? 'cursor-pointer' : ''}
      ${className}
    `.trim()}
  >
    {children}
  </div>
);

export { SurfaceCard, GlassCard };
export default SurfaceCard;
