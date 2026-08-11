import { useMemo } from 'react';
import { Property } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

/** A single selectable unit within a property group */
export interface UnitOption {
  id: string;
  /** Primary label for dropdown display — e.g. "Flat 2A — John Doe" or "12 Marina — Jane Smith" */
  label: string;
  /** Short unit identifier — e.g. "Flat 2A", "Unit 3B", or empty for standalone */
  unitName: string;
  /** Full property address */
  address: string;
  /** Shortened address (first line before comma) */
  shortAddress: string;
  /** The parent property ID — needed for portal messaging thread resolution */
  propertyId?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  rentAmount?: number;
  serviceCharge?: number;
  legalFee?: number;
  agencyFee?: number;
  cautionDeposit?: number;
  /** Original property record for any extra data */
  _raw?: Property;
}

/** A group of units sharing the same building address */
export interface PropertyGroup {
  /** Normalized address used as group key */
  addressKey: string;
  /** Display address (original casing) */
  address: string;
  /** Shortened address (first line before comma) */
  shortAddress: string;
  /** How many units in this building */
  unitCount: number;
  /** Whether this is a multi-unit building (unitCount > 1) */
  isMultiUnit: boolean;
  /** The individual units */
  units: UnitOption[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const normalizeAddr = (addr: string) => (addr || '').trim().toLowerCase();

/** Extract a short unit name from property data */
const getUnitName = (p: Property): string => {
  // 1. Explicit unitName in rentalDetails
  if ((p as any).rentalDetails?.unitName) return (p as any).rentalDetails.unitName;
  // 2. Try to extract from description like "(Flat 2A)"
  const match = p.description?.match(/\(([^)]+)\)/);
  if (match) return match[1];
  // 3. If property has numberOfUnits > 1, use a generic identifier
  if ((p as any).numberOfUnits > 1 && p.id) return `Unit ${p.id.slice(-3)}`;
  return '';
};

/** Build a smart display label for a unit */
const buildLabel = (p: Property, isMultiUnit: boolean, unitName: string): string => {
  const tenantName = (p as any).rentalDetails?.tenantName || (p as any).tenantName || '';
  const shortAddr = p.address?.split(',')[0] || 'Property';

  if (isMultiUnit && unitName) {
    // Multi-unit building with a unit name — show unit + tenant (no address needed)
    return unitName + (tenantName ? ` — ${tenantName}` : '');
  } else if (isMultiUnit) {
    // Multi-unit but no unitName — use short address + tenant
    return shortAddr + (tenantName ? ` — ${tenantName}` : '');
  } else {
    // Standalone single-tenant property — show short address + tenant
    return shortAddr + (tenantName ? ` — ${tenantName}` : '');
  }
};

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Groups properties by address, detects multi-unit buildings,
 * and produces smart labels that avoid repeating the same address.
 */
export function usePropertyGroups(properties: Property[]): {
  groups: PropertyGroup[];
  flatUnits: UnitOption[];
  /** Quick lookup: propertyId → UnitOption */
  unitById: Map<string, UnitOption>;
} {
  return useMemo(() => {
    const allProps = properties || [];
    const unitById = new Map<string, UnitOption>();

    // Step 1: Count how many property records share each address
    const addressCount = new Map<string, number>();
    for (const p of allProps) {
      const key = normalizeAddr(p.address);
      if (key) addressCount.set(key, (addressCount.get(key) || 0) + 1);
    }

    // Step 2: Build flat unit list with smart labels
    const flatUnits: UnitOption[] = [];

    for (const p of allProps) {
      const addrKey = normalizeAddr(p.address);
      const isMultiUnit = addrKey ? (addressCount.get(addrKey) || 0) > 1 : false;

      // Handle properties with embedded units array
      if ((p as any).units && (p as any).units.length > 0) {
        for (const unit of (p as any).units) {
          const tenantName = unit.tenantName || (p as any).rentalDetails?.tenantName || '';
          const unitName = unit.unitName || unit.id || '';
          const label = unitName + (tenantName ? ` — ${tenantName}` : '');
          const option: UnitOption = {
            id: `${p.id}_${unit.id || unit.unitName}`,
            label,
            unitName,
            address: p.address,
            shortAddress: p.address?.split(',')[0] || 'Property',
            propertyId: p.id,
            tenantName,
            tenantPhone: unit.tenantPhone || (p as any).rentalDetails?.tenantPhone || '',
            tenantEmail: unit.tenantEmail || (p as any).rentalDetails?.tenantEmail || '',
            rentAmount: unit.rentAmount || (p as any).rentalDetails?.rentAmount,
            serviceCharge: unit.serviceCharge || (p as any).rentalDetails?.serviceCharge,
            legalFee: unit.legalFee || (p as any).rentalDetails?.legalFee,
            agencyFee: unit.agencyFee || (p as any).rentalDetails?.agencyFee,
            cautionDeposit: unit.cautionDeposit || (p as any).rentalDetails?.cautionDeposit,
          };
          flatUnits.push(option);
          unitById.set(option.id, option);
        }
      } else {
        // Standard property record (possibly one of several at the same address)
        const unitName = getUnitName(p);
        const label = buildLabel(p, isMultiUnit, unitName);
        const rental = (p as any).rentalDetails || {};
        const option: UnitOption = {
          id: p.id,
          label,
          unitName,
          address: p.address,
          shortAddress: p.address?.split(',')[0] || 'Property',
          propertyId: p.id,
          tenantName: rental.tenantName || (p as any).tenantName,
          tenantPhone: rental.tenantPhone || (p as any).tenantPhone,
          tenantEmail: rental.tenantEmail || (p as any).tenantEmail,
          rentAmount: rental.rentAmount || (p as any).rentAmount,
          serviceCharge: rental.serviceCharge,
          legalFee: rental.legalFee,
          agencyFee: rental.agencyFee,
          cautionDeposit: rental.cautionDeposit,
          _raw: p,
        };
        flatUnits.push(option);
        unitById.set(p.id, option);
      }
    }

    // Step 3: Group by address for collapsible sections
    const groupMap = new Map<string, PropertyGroup>();
    for (const u of flatUnits) {
      const key = normalizeAddr(u.address);
      if (!key) continue;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          addressKey: key,
          address: u.address,
          shortAddress: u.shortAddress,
          unitCount: 0,
          isMultiUnit: false,
          units: [],
        });
      }
      const group = groupMap.get(key)!;
      group.units.push(u);
      group.unitCount = group.units.length;
      group.isMultiUnit = group.unitCount > 1;
    }

    const groups = Array.from(groupMap.values());

    // Sort: multi-unit buildings first, then single properties
    groups.sort((a, b) => {
      if (a.isMultiUnit !== b.isMultiUnit) return a.isMultiUnit ? -1 : 1;
      return a.shortAddress.localeCompare(b.shortAddress);
    });

    return { groups, flatUnits, unitById };
  }, [properties]);
}

/**
 * Build a simple flat list of {id, label} for <select> dropdowns.
 * Uses smart labels that disambiguate multi-unit buildings.
 */
export function useUnitDropdownOptions(properties: Property[], filter?: (p: Property) => boolean): { id: string; label: string }[] {
  const { flatUnits } = usePropertyGroups(properties);
  return useMemo(() => {
    let units = flatUnits;
    if (filter) {
      // Only include units whose _raw property passes the filter
      units = flatUnits.filter(u => u._raw && filter(u._raw));
    }
    return units.map(u => ({ id: u.id, label: u.label }));
  }, [flatUnits, filter]);
}
