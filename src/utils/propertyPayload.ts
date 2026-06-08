import { Property } from '../types';

export interface UnitRentalInput {
  id: string;
  unitName: string;
  rentAmount: number;
  rentFrequency: 'Annually' | 'Bi-Annually' | 'Quarterly' | 'Monthly';
  leaseStart: string;
  leaseEnd: string;
  tenantName: string;
  occupantTitle?: string;
  occupantFirstName?: string;
  occupantLastName?: string;
  tenantPhone: string;
  nextRentReview: string;
  isPeriodicReviewEnabled: boolean;
  tenancyPeriod?: string;
  serviceCharge?: number;
  serviceChargeAmount?: number;
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
  status: Property['status'];
  _id?: string;
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

  pd.description =
    normalized.unitName ||
    (propertyData.description ? `${propertyData.description} (${normalized.unitName})` : normalized.unitName);

  pd.rentalDetails = {
    ...normalized,
    leaseStart: cleanDate(normalized.leaseStart),
    leaseEnd: cleanDate(normalized.leaseEnd),
    nextRentReview: cleanDate(normalized.nextRentReview),
  };

  return pd;
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
  const scAmount = Number(rd.serviceChargeAmount ?? rd.serviceCharge ?? 0);
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
