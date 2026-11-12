/**
 * FinancialStatusBadge — Single source of truth for financial status
 * styling across PracticePro (UX-02/UX-20).
 *
 * The variant palette is expressed in the semantic status TOKENS (the
 * status Tailwind family backed by the --status-* CSS vars in index.css;
 * see tailwind.config.ts), so it is theme-aware by construction: the same
 * badge reads correctly in light and dark and every theme that overrides
 * the CSS vars. Hand-rolled hue maps elsewhere converge here.
 *
 * Usage:
 *   <FinancialStatusBadge status="Paid" />
 *   <FinancialStatusBadge status="Overdue" size="sm" />
 *   <FinancialStatusBadge status="pending" />
 *
 * The status prop is case-insensitive and handles the various status
 * string values found across the app:
 *   - Paid / paid / CLEARED / cleared / Sent / Active / Occupied → success
 *   - Overdue / Defaulted / Failed / Rejected / Void → danger (struck)
 *   - Pending / Staged / Draft / Unpaid / Trial → warning
 *   - Partial / PARTIALLY_PAID / partial → info
 *   - Cancelled / Expired / Reversed / Vacant / archived → neutral (Reversed struck)
 */

import React from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface FinancialStatusBadgeProps {
  status: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

// UX-02: token-based, theme-aware. A 10% tint of the semantic hue carries
// the background; the same hue carries the text — identical treatment for
// every status on every screen, in both themes.
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-status-success/10 text-status-success',
  danger: 'bg-status-danger/10 text-status-danger',
  warning: 'bg-status-warning/10 text-status-warning',
  info: 'bg-status-info/10 text-status-info',
  neutral: 'bg-dim-100 text-dim-600 dark:bg-dim-800 dark:text-dim-400',
};

const SIZE_STYLES: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-3xs',
  sm: 'px-2 py-0.5 text-2xs',
  md: 'px-2.5 py-1 text-xs',
};

function statusToVariant(status: string): BadgeVariant {
  const s = (status || '').toLowerCase().trim();

  // Success states
  if (['paid', 'cleared', 'sent', 'active', 'occupied', 'approved', 'completed', 'done', 'resolved'].includes(s)) {
    return 'success';
  }

  // Danger states
  if (['overdue', 'defaulted', 'failed', 'cancelled', 'expired', 'rejected', 'void'].includes(s)) {
    return 'danger';
  }

  // Warning states (UX-02: 'unpaid' joins pending/draft — an unpaid invoice
  // is money expected, the same semantic as Pending, not neutral)
  if (['pending', 'staged', 'in_progress', 'in-progress', 'todo', 'draft', 'trial', 'unpaid'].includes(s)) {
    return 'warning';
  }

  // Info states
  if (['partial', 'partially_paid', 'partially paid', 'partially-paid'].includes(s)) {
    return 'info';
  }

  // Neutral states (vacant, archived, inactive, reversed, etc.)
  return 'neutral';
}

// Retired statuses render struck-through — the record exists for the audit
// trail but no longer counts (the same contract as the invoice list's
// Void/Reversed treatment).
function isRetiredStatus(status: string): boolean {
  const s = (status || '').toLowerCase().trim();
  return ['void', 'reversed', 'cancelled', 'expired'].includes(s);
}

function statusToLabel(status: string): string {
  const s = (status || '').toLowerCase().trim();
  const labelMap: Record<string, string> = {
    'partially_paid': 'Partial',
    'partially-paid': 'Partial',
    'in_progress': 'In Progress',
    'in-progress': 'In Progress',
  };
  if (labelMap[s]) return labelMap[s];
  // Title case for unknown statuses
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export const FinancialStatusBadge: React.FC<FinancialStatusBadgeProps> = ({
  status,
  size = 'sm',
  className = '',
}) => {
  const variant = statusToVariant(status);
  const label = statusToLabel(status);
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.sm;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm font-bold uppercase tracking-wider ${variantStyle} ${sizeStyle} ${isRetiredStatus(status) ? 'line-through' : ''} ${className}`}
    >
      {label}
    </span>
  );
};

export default FinancialStatusBadge;
