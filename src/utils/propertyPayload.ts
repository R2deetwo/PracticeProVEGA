import { Property } from '../types';
import { resolveServiceCharge } from './serviceCharge';

export interface UnitRentalInput {
  id: string;
  unitName: string;
  unitDescription?: string;
  rentAmount: number;
  rentFrequency: 'Annually' | 'Bi-Annually' | 'Quarterly' | 'Monthly';
  leaseStart: string;
  leaseEnd: string;
  tenantName: string;
  occupantTitle?: string;
  occupantFirstName?: string;
  occupantLastName?: string;
  tenantPhone: string;
  tenantEmail?: string;
  nextRentReview: string;
  isPeriodicReviewEnabled: boolean;
  tenancyPeriod?: string;
  serviceCharge?: number;
  serviceChargeAmount?: number;
  serviceChargeFrequency?: 'Annually' | 'Bi-Annually' | 'Quarterly' | 'Monthly';
  serviceChargeStatus?: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID';
  outstandingServiceChargeBalance?: number;
  legalFee?: number;
  legalFeePercentage?: number;
  isLegalNA?: boolean;
  agencyFee?: number;
  agencyFeePercentage?: number;
  isAgencyNA?: boolean;
  cautionDeposit?: number;
  isCautionNA?: boolean;
  /** Months of service charge payable in advance at move-in (0 = pay as billed). */
  serviceChargeMonthsInAdvance?: number;
  status: Property['status'];
  _id?: string;
  /** Per-period SC tracking (used by OnboardUnitLedgerModal + ServiceChargeBars) */
  scPeriods?: import('../types').ServiceChargePeriod[];
  /** Per-period MV tracking */
  mvPeriods?: import('../types').ServiceChargePeriod[];
  /** Whether reminders are muted for this unit */
  remindersMuted?: boolean;
  /** Whether reminders are auto-paused (cool-off) */
  remindersPaused?: boolean;
  /** Consecutive reminder count */
  consecutiveReminderCount?: number;
}

const cleanDate = (d?: string): string | null => (d && d.trim() ? d.trim() : null);

export function composeTenantName(unit: UnitRentalInput): string {
  const fromParts = [unit.occupantTitle, unit.occupantFirstName, unit.occupantLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fromParts || unit.tenantName?.trim() || '';
}

export function normalizeUnitRental(unit: UnitRentalInput): UnitRentalInput {
  const tenantName = composeTenantName(unit);
  return {
    ...unit,
    tenantName,
    serviceChargeMonthsInAdvance: Math.max(0, Math.min(24, Math.round(Number(unit.serviceChargeMonthsInAdvance) || 0))),
    leaseStart: cleanDate(unit.leaseStart) ?? '',
    leaseEnd: cleanDate(unit.leaseEnd) ?? '',
    nextRentReview: cleanDate(unit.nextRentReview) ?? '',
    rentAmount: Number(unit.rentAmount) || 0,
    serviceCharge: Number(unit.serviceCharge) || 0,
    serviceChargeAmount: Number(unit.serviceChargeAmount) || Number(unit.serviceCharge) || 0,
    serviceChargeStatus: unit.serviceChargeStatus || 'UNPAID',
    outstandingServiceChargeBalance: Number(unit.outstandingServiceChargeBalance) || 0,
    legalFee: unit.isLegalNA ? 0 : Number(unit.legalFee) || 0,
    legalFeePercentage: Number(unit.legalFeePercentage) || 0,
    agencyFee: unit.isAgencyNA ? 0 : Number(unit.agencyFee) || 0,
    agencyFeePercentage: Number(unit.agencyFeePercentage) || 0,
    cautionDeposit: unit.isCautionNA ? 0 : Number(unit.cautionDeposit) || 0,
  };
}

export function buildPropertyRecord(
  unit: UnitRentalInput,
  propertyData: Partial<Property>,
  unitId: string
): Property {
  const normalized = normalizeUnitRental(unit);
  const pd = {
    ...propertyData,
    id: unitId,
    status: normalized.status || 'Occupied',
    managementFeePercentage:
      propertyData.managementFeePercentage != null && !Number.isNaN(Number(propertyData.managementFeePercentage))
        ? Number(propertyData.managementFeePercentage)
        : 10,
    images: propertyData.images ?? [],
    amenities: propertyData.amenities ?? [],
  } as Property;

  if (unit._id) (pd as Property & { _id?: string })._id = unit._id;

  // BUILDING-LEVEL DESCRIPTION ONLY (Task 58). The unit row's description
  // is exactly what the manager typed for the property — NEVER derived from
  // unit fields. The old chain (`unitDescription || unitName ||
  // `${description} (${unitName})`) overwrote the typed property description
  // with "Unit 1" on every save of a fresh unit, which is precisely the
  // reported data-loss bug. Unit-level notes live in
  // rentalDetails.unitDescription and stay fully independent.
  pd.description = propertyData.description ?? '';

  pd.rentalDetails = {
    ...normalized,
    leaseStart: cleanDate(normalized.leaseStart),
    leaseEnd: cleanDate(normalized.leaseEnd),
    nextRentReview: cleanDate(normalized.nextRentReview),
  };

  return pd;
}

/**
 * Recover the building-level description from a legacy unit row (Task 58).
 * Old saves wrote `${description} (Unit 2)` — or just `Unit 2` — into each
 * unit row's description. Strip the mangled forms so the edit form shows
 * the manager's original text (or empty when the row only ever carried
 * unit-name noise).
 */
export function deriveBuildingDescription(
  rawDescription: string | undefined | null,
  unitName?: string
): string {
  let desc = (rawDescription || '').trim();
  if (!desc) return '';
  // Strip a trailing "(Unit X)" suffix the legacy writer appended.
  const suffix = desc.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (suffix) {
    const inner = suffix[2].trim();
    const looksLikeUnitTag =
      (!!unitName && inner.toLowerCase() === unitName.toLowerCase()) ||
      /^unit\b/i.test(inner);
    if (looksLikeUnitTag) desc = suffix[1].trim();
  }
  // A "description" that is nothing but the unit label is mangled data —
  // the real description was never persisted. Surface empty so the manager
  // retypes it rather than shipping "Unit 1" as a building description.
  if (!desc) return '';
  if (/^unit\s*\d*$/i.test(desc)) return '';
  if (unitName && desc.toLowerCase() === unitName.toLowerCase()) return '';
  return desc;
}

// ─── Service-charge cycle math (Task 59) ────────────────────────────────────
// The form captures ONE figure — the amount per billing cycle — in
// `serviceChargeAmount`. The legacy monthly rate (`serviceCharge`) is
// DERIVED from it so every existing reader (billing timeline via
// resolveCadence, ServiceChargeMonitor, portals, message financials,
// OnboardUnitLedgerModal) keeps working unchanged.

/** Months in one service-charge billing cycle for a frequency label. */
export function scCycleMonths(freq?: string): 1 | 3 | 6 | 12 {
  switch ((freq || '').trim()) {
    case 'Quarterly': return 3;
    case 'Bi-Annually': return 6;
    case 'Annually': return 12;
    default: return 1;
  }
}

/**
 * The per-cycle amount the form should load for a unit's service charge.
 * Mirrors the readers' semantics (resolveCadence):
 *   monthly cadence  → the monthly rate (serviceCharge) wins, else the total
 *   longer cadences  → the per-cycle total (serviceChargeAmount) wins, else the rate
 */
export function loadServiceChargeCycle(rental?: {
  serviceCharge?: number | string;
  serviceChargeAmount?: number | string;
  serviceChargeFrequency?: string;
} | null): number {
  const r = (rental || {}) as Record<string, unknown>;
  const rate = Number(r.serviceCharge) || 0;
  const total = Number(r.serviceChargeAmount) || 0;
  return scCycleMonths(r.serviceChargeFrequency as string | undefined) === 1
    ? (rate > 0 ? rate : total)
    : (total > 0 ? total : rate);
}

/** Monthly rate implied by a per-cycle amount + frequency (2dp). */
export function monthlyServiceChargeRate(perCycle: number, freq?: string): number {
  const months = scCycleMonths(freq);
  const amt = Number(perCycle) || 0;
  return Math.round((amt / months) * 100) / 100;
}

export function propertyExistsInDb(
  properties: Property[],
  unitId: string,
  unitConvexId?: string
): boolean {
  return properties.some(
    (p) => p.id === unitId || (p as { _id?: string })._id === unitId || (unitConvexId && (p as { _id?: string })._id === unitConvexId)
  );
}

/**
 * Compute the tenancy term progress as a fraction (0..1).
 * Returns null if dates are missing or invalid.
 */
export function computeTermProgress(leaseStart?: string, leaseEnd?: string): number | null {
  if (!leaseStart || !leaseEnd) return null;
  const start = new Date(leaseStart).getTime();
  const end = new Date(leaseEnd).getTime();
  const now = Date.now();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const progress = (now - start) / (end - start);
  return Math.max(0, Math.min(1, progress));
}

/** Display fields for unit cards (Property rows store tenant/rent in rentalDetails). */
export function getUnitDisplay(unit: Property & { rentalDetails?: Record<string, unknown> }) {
  const rd = (unit.rentalDetails || unit) as Record<string, unknown>;
  const unitName =
    (rd.unitName as string) ||
    unit.description?.match(/\((.*?)\)/)?.[1] ||
    '';
  const sc = resolveServiceCharge({ unit, rental: (unit.rentalDetails ?? undefined) as Record<string, unknown> | undefined });
  const scAmount = sc.amount;
  const scStatus = (rd.serviceChargeStatus as string) || '';
  const outstandingBalance = Number(rd.outstandingServiceChargeBalance ?? 0);
  const leaseStart = rd.leaseStart as string | undefined;
  const leaseEnd = rd.leaseEnd as string | undefined;
  const termProgress = computeTermProgress(leaseStart, leaseEnd);

  // Determine what's missing for contextual tooltips
  const missingFields: string[] = [];
  const actionItems: string[] = [];

  const tenantName = (rd.tenantName as string) || '';
  const tenantPhone = (rd.tenantPhone as string) || '';
  const rentAmount = Number(rd.rentAmount ?? 0);
  const uStatus = String(unit.status || 'Vacant');

  if (uStatus === 'Occupied') {
    if (!tenantName) missingFields.push('Tenant name');
    if (!leaseEnd) missingFields.push('Lease end date');
    if (!tenantPhone) missingFields.push('Tenant phone');
    if (rentAmount <= 0) missingFields.push('Rent amount');

    // Action items based on status
    if (scStatus === 'UNPAID') actionItems.push('Service charge unpaid');
    if (scStatus === 'PARTIALLY_PAID') actionItems.push('Outstanding service charge balance');
    if (termProgress !== null && termProgress >= 0.5) actionItems.push('Past halfway mark — statutory notice window');
  }

  return {
    name: unitName || 'Unnamed',
    tenantName,
    rentAmount,
    rentFrequency: (rd.rentFrequency as string) || 'Annually',
    leaseEnd,
    leaseStart,
    floor: (rd.floor as string) || '',
    unitId: unit.id,
    convexId: (unit as { _id?: string })._id,
    serviceChargeAmount: scAmount,
    /** Which priority level produced serviceChargeAmount — dev-mode debug field. */
    serviceChargeSource: sc.source,
    serviceChargeStatus: scStatus as 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' | '',
    outstandingServiceChargeBalance: outstandingBalance,
    /** Term progress 0..1 (null if dates missing) */
    termProgress,
    /** Whether the tenancy has crossed 50% */
    isPastHalfway: termProgress !== null && termProgress >= 0.5,
    /** Human-readable list of missing data fields */
    missingFields,
    /** Human-readable list of action items */
    actionItems,
    /** Tooltip text for the status badge */
    statusTooltip: missingFields.length > 0
      ? `Missing: ${missingFields.join(', ')}`
      : actionItems.length > 0
        ? actionItems.join('; ')
        : 'All data complete',
    /** Whether reminders are muted for this unit */
    remindersMuted: (rd.remindersMuted as boolean) || false,
    /** Whether reminders are auto-paused (cool-off) */
    remindersPaused: (rd.remindersPaused as boolean) || false,
  };
}
