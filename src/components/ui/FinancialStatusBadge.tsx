/**
 * FinancialStatusBadge — Single source of truth for financial status
 * styling across PracticePro.
 *
 * Replaces 8+ hand-rolled status-color implementations across
 * BillingView, LedgerManager, ServiceChargeMonitor, TrustAccountTab,
 * InvoiceDetailView, ClientDashboard, TenantPortal, and more.
 *
 * Usage:
 *   <FinancialStatusBadge status="Paid" />
 *   <FinancialStatusBadge status="Overdue" size="sm" />
 *   <FinancialStatusBadge status="pending" />
 *
 * The status prop is case-insensitive and handles the various status
 * string values found across the app:
 *   - Paid / paid / CLEARED / cleared → success (emerald)
 *   - Overdue / overdue / Defaulted / defaulted → danger (rose)
 *   - Pending / pending / Staged / staged → warning (amber)
 *   - Partial / PARTIALLY_PAID / partial → info (blue)
 *   - Draft / draft → neutral (slate)
 *   - Sent / sent → success (emerald, lighter)
 *   - Failed / failed → danger (rose)
 *   - Cancelled / cancelled / Expired / expired → neutral (slate)
 *   - Active / active / Occupied / occupied → success (emerald)
 *   - Vacant / vacant → neutral (slate)
 */

import React from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface FinancialStatusBadgeProps {
  status: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
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

  // Warning states
  if (['pending', 'staged', 'in_progress', 'in-progress', 'todo', 'draft', 'trial'].includes(s)) {
    return 'warning';
  }

  // Info states
  if (['partial', 'partially_paid', 'partially-paid'].includes(s)) {
    return 'info';
  }

  // Neutral states (vacant, archived, inactive, etc.)
  return 'neutral';
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
      className={`inline-flex items-center gap-1 rounded font-bold uppercase tracking-wider ${variantStyle} ${sizeStyle} ${className}`}
    >
      {label}
    </span>
  );
};

export default FinancialStatusBadge;
