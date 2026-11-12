/**
 * Property defaults — the ONE fee-default chain (UX-35).
 *
 * PropertyForm seeds its field with this value when a property has never
 * had a fee configured; CollectRentModal invoices with the same default.
 * An EXPLICIT 0 (the landlord and agent agreed no fee) stays 0 everywhere —
 * `??` (never `||`) so a deliberate zero is not overwritten.
 */
export const DEFAULT_MANAGEMENT_FEE_PERCENT = 10;
