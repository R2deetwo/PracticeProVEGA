// ── Message-type labels: SINGLE source of truth ────────────────────────────
// MESSAGES OVERHAUL: this map was previously duplicated (with drifting
// labels) in ComposeModal, AutomationCenter, AtriumInbox, ScheduledTab and
// OutboxTab. Every surface now imports from here so a resident sees the
// SAME name for the same message type everywhere.
import { AutomationMessageType } from '../types';

export const MSG_TYPE_LABELS: Record<AutomationMessageType, string> = {
  custom: 'Custom Message',
  rent_reminder: 'Rent Reminder',
  late_notice: 'Late Notice',
  payment_receipt: 'Payment Receipt',
  service_charge_alert: 'Service Charge Alert',
  access_restriction: 'Access Restriction',
  penalty_notice: 'Penalty Notice',
  lease_renewal: 'Lease Renewal',
  welcome_note: 'Welcome Note',
  promotion: 'Promotion/Offer',
  vendor_update: 'New Vendor Alert',
  general_announcement: 'General Announcement',
  maintenance_update: 'Maintenance Update',
};

/** Human label for any message type — falls back to Title-Case of the key. */
export function getMsgTypeLabel(type: string): string {
  return (
    (MSG_TYPE_LABELS as Record<string, string>)[type] ||
    type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  );
}

// ── Type-driven financials: which figures a message may use ─────────────────
// ROOT FIX (user feedback 2026-09-08): "I'm talking about the service charge
// but it adds up figures it ought not to have added." Previously EVERY
// template's {{TOTAL_PAYABLE}} summed rent + service charge + caution +
// legal + agency, so a service-charge alert (₦40,000) could end with
// "Total Payable: ₦1,920,000". Now each type declares:
//   • fields  — the inputs the composer SHOWS for this type (everything
//     else is hidden, which keeps the form simple);
//   • total   — the ONLY figures that may be summed into the message's
//     "Total Payable" line (a receipt states what was received, an
//     alert states only the charge it is about);
//   • note    — the plain-language explanation shown under the composer's
//     live total preview so the user can see what will be summed.
export type FinanceField =
  | 'amount'
  | 'serviceCharge'
  | 'cautionDeposit'
  | 'legalFee'
  | 'agencyFee'
  | 'dueDate';

export interface TypeFinance {
  /** Fields shown in the composer for this type. Empty = no financial section at all. */
  fields: FinanceField[];
  /** Fields summed into the message's Total Payable. Empty = the message states no total. */
  total: Exclude<FinanceField, 'dueDate'>[];
  /** Plain-language explanation for the live total preview. */
  note: string;
}

const FULL_BREAKDOWN: FinanceField[] = [
  'amount', 'serviceCharge', 'cautionDeposit', 'legalFee', 'agencyFee', 'dueDate',
];
const SUM_EVERYTHING: Exclude<FinanceField, 'dueDate'>[] = [
  'amount', 'serviceCharge', 'cautionDeposit', 'legalFee', 'agencyFee',
];

export const MSG_TYPE_FINANCE: Record<AutomationMessageType, TypeFinance> = {
  // Free-form types carry no figures at all — the composer hides the
  // financial section entirely for these.
  custom:              { fields: [], total: [], note: 'No figures — free text' },
  lease_renewal:       { fields: [], total: [], note: 'No figures — free text' },
  welcome_note:        { fields: [], total: [], note: 'No figures — free text' },
  promotion:           { fields: [], total: [], note: 'No figures — free text' },
  vendor_update:       { fields: [], total: [], note: 'No figures — free text' },
  general_announcement:{ fields: [], total: [], note: 'No figures — free text' },
  maintenance_update:  { fields: [], total: [], note: 'No figures — free text' },

  // Formal demands legitimately total everything owed.
  rent_reminder: {
    fields: FULL_BREAKDOWN,
    total: SUM_EVERYTHING,
    note: 'Rent + every listed charge — a formal demand for the full amount',
  },
  late_notice: {
    fields: FULL_BREAKDOWN,
    total: SUM_EVERYTHING,
    note: 'Full outstanding balance — everything currently owed',
  },
  access_restriction: {
    fields: FULL_BREAKDOWN,
    total: SUM_EVERYTHING,
    note: 'All outstanding charges behind the restriction',
  },
  penalty_notice: {
    fields: FULL_BREAKDOWN,
    total: SUM_EVERYTHING,
    note: 'Revised total payable including the penalty',
  },

  // Targeted types total ONLY the figure they are about.
  service_charge_alert: {
    fields: ['serviceCharge', 'dueDate'],
    total: ['serviceCharge'],
    note: 'Service charge only — rent and fees are never added',
  },
  payment_receipt: {
    fields: ['amount', 'dueDate'],
    total: ['amount'],
    note: 'Amount received only — a receipt never adds unrelated charges',
  },
};

/** Finance config for ANY message key (custom firm templates fall back to `custom`). */
export function getTypeFinance(type: string): TypeFinance {
  return (
    (MSG_TYPE_FINANCE as Record<string, TypeFinance>)[type] ||
    MSG_TYPE_FINANCE.custom
  );
}
