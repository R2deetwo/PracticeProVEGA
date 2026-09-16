/**
 * chargeTypeUtils — client-side charge-type constants + label resolution.
 *
 * MIRRORS convex/chargeTypes.ts (SYSTEM_LEDGER_TYPES / SYSTEM_SERVICE_
 * CATEGORIES) — KEEP IN SYNC. The server validates every charge write against
 * its copy; this module renders labels and feeds dropdowns from the firm's
 * registry (system + custom) fetched via api.chargeTypes.getChargeTypes.
 */

export interface ChargeTypeOption {
  key: string;
  label: string;
  kind: 'ledger' | 'service';
  category: string;
  defaultCycle: string | null;
  defaultAmount: number | null;
  isSystem: boolean;
  participatesInDunning: boolean;
  refundable: boolean;
}

export const SYSTEM_LEDGER_TYPES: ChargeTypeOption[] = [
  { key: 'rent', label: 'Rent', kind: 'ledger', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'service_charge', label: 'Service Charge', kind: 'ledger', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'penalty', label: 'Penalty', kind: 'ledger', category: 'system', defaultCycle: null, defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'deposit', label: 'Deposit', kind: 'ledger', category: 'system', defaultCycle: null, defaultAmount: null, isSystem: true, participatesInDunning: false, refundable: true },
  { key: 'management_fee', label: 'Management Fee', kind: 'ledger', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
];

export const SYSTEM_SERVICE_CATEGORIES: ChargeTypeOption[] = [
  { key: 'Diesel', label: 'Diesel', kind: 'service', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'Security', label: 'Security', kind: 'service', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'Cleaning', label: 'Cleaning', kind: 'service', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'Water', label: 'Water', kind: 'service', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
  { key: 'Other', label: 'Other', kind: 'service', category: 'system', defaultCycle: 'Monthly', defaultAmount: null, isSystem: true, participatesInDunning: true, refundable: false },
];

/**
 * Human label for a stored charge type/category value. Resolution order:
 * firm registry (custom types) → system constants → prettified raw key, so
 * archived types and legacy values still render sensibly.
 */
export function chargeTypeLabel(value: string, registry?: ChargeTypeOption[]): string {
  const custom = registry?.find((t) => t.key === value && !t.isSystem);
  if (custom) return custom.label;
  const system = [...SYSTEM_LEDGER_TYPES, ...SYSTEM_SERVICE_CATEGORIES].find((t) => t.key === value);
  if (system) return system.label;
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Dropdown options for a charge surface: system types + the firm's active
 * custom types of that kind. Falls back to system-only before the registry
 * loads, so charge forms never block on the registry query.
 */
export function chargeTypeOptions(kind: 'ledger' | 'service', registry?: ChargeTypeOption[]): ChargeTypeOption[] {
  const system = kind === 'ledger' ? SYSTEM_LEDGER_TYPES : SYSTEM_SERVICE_CATEGORIES;
  const custom = (registry ?? []).filter((t) => t.kind === kind && !t.isSystem);
  return [...system, ...custom];
}
