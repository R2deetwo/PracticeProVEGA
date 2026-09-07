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
