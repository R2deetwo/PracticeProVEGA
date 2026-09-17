/**
 * relationshipTypes — client-side property use-relationship constants,
 * label resolution and UI helpers.
 *
 * MIRRORS convex/propertyRelationships.ts (SYSTEM_RELATIONSHIP_TYPES) —
 * KEEP IN SYNC. The server validates every relationship write against its
 * copy; this module renders labels, role names and status/consent chips,
 * and feeds dropdowns from the firm's registry (system + custom) fetched
 * via api.propertyRelationships.getRelationshipTypes.
 */

export type LegalNature =
  | 'estate_in_land'
  | 'license'
  | 'servitude'
  | 'security_interest'
  | 'co_ownership'
  | 'transactional'
  | 'management';

export interface RelationshipTypeOption {
  key: string;
  label: string;
  legalNature: LegalNature;
  grantorRole: string;
  granteeRole: string;
  requiresGovernorConsent: boolean;
  drivesRentLedger: boolean;
  lawBasis: string;
  isSystem: boolean;
}

export const LEGAL_NATURE_LABELS: Record<LegalNature, string> = {
  estate_in_land: 'Estate in land',
  license: 'License (no estate)',
  servitude: 'Servitude over another\u2019s land',
  security_interest: 'Security interest',
  co_ownership: 'Co-ownership',
  transactional: 'Transactional (pre-completion)',
  management: 'Management / agency',
};

export const SYSTEM_RELATIONSHIP_TYPES: RelationshipTypeOption[] = [
  { key: 'tenancy', label: 'Tenancy (Lease)', legalNature: 'estate_in_land', grantorRole: 'Landlord', granteeRole: 'Tenant', requiresGovernorConsent: false, drivesRentLedger: true, lawBasis: 'State tenancy / recovery-of-premises law governs; long terms can qualify as subleases needing Governor\u2019s consent.', isSystem: true },
  { key: 'sublease', label: 'Sublease / Sub-underlease', legalNature: 'estate_in_land', grantorRole: 'Head Tenant', granteeRole: 'Subtenant', requiresGovernorConsent: true, drivesRentLedger: true, lawBasis: 'Estate carved from the head lease; LUA s.22 consent where the term exceeds the state threshold.', isSystem: true },
  { key: 'license', label: 'License (bare permission)', legalNature: 'license', grantorRole: 'Licensor', granteeRole: 'Licensee', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Personal permission to use land; no estate, no title; revocable per its terms.', isSystem: true },
  { key: 'easement', label: 'Easement (right of way etc.)', legalNature: 'servitude', grantorRole: 'Servient Owner', granteeRole: 'Dominant Owner', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Right exercisable over servient land benefiting the dominant tenement; runs with the land.', isSystem: true },
  { key: 'profit_a_prendre', label: 'Profit \u00e0 Prendre', legalNature: 'servitude', grantorRole: 'Servient Owner', granteeRole: 'Profit Holder', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Right to take part of the land\u2019s produce or profits (timber, fish).', isSystem: true },
  { key: 'leasehold_mortgage', label: 'Legal Mortgage (by deed / sublease)', legalNature: 'security_interest', grantorRole: 'Mortgagor', granteeRole: 'Mortgagee', requiresGovernorConsent: true, drivesRentLedger: false, lawBasis: 'Legal mortgage of a right of occupancy; LUA s.22 consent; redemption / power of sale tracking.', isSystem: true },
  { key: 'equitable_mortgage', label: 'Equitable Mortgage (deposit of title deeds)', legalNature: 'security_interest', grantorRole: 'Mortgagor', granteeRole: 'Mortgagee', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Created by deposit of title documents; weaker than a legal mortgage — record which documents are held.', isSystem: true },
  { key: 'customary_tenancy', label: 'Customary Tenancy (family land)', legalNature: 'estate_in_land', grantorRole: 'Overlord / Family Head', granteeRole: 'Customary Tenant', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Possessory right under customary law from the overlord family; tribute may be owed; customary rules govern.', isSystem: true },
  { key: 'customary_pledge', label: 'Customary Pledge of Land', legalNature: 'security_interest', grantorRole: 'Pledgor', granteeRole: 'Pledgee', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Possession passes as security; redeemable on repayment (no forfeiture for default).', isSystem: true },
  { key: 'caretaker', label: 'Caretaker Arrangement', legalNature: 'management', grantorRole: 'Owner', granteeRole: 'Caretaker', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Caretaker occupies / keeps the property or collects dues for the owner; rarely documented — record the terms.', isSystem: true },
  { key: 'joint_ownership', label: 'Joint Ownership (survivorship)', legalNature: 'co_ownership', grantorRole: 'Co-Owner A', granteeRole: 'Co-Owner B', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Joint tenancy with survivorship; alienation of a share severs it into a tenancy in common.', isSystem: true },
  { key: 'tenancy_in_common', label: 'Tenancy in Common (distinct shares)', legalNature: 'co_ownership', grantorRole: 'Co-Owner A', granteeRole: 'Co-Owner B', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Concurrent ownership in defined shares without survivorship — common for family holdings.', isSystem: true },
  { key: 'sale_pending', label: 'Contract of Sale (pre-completion)', legalNature: 'transactional', grantorRole: 'Vendor', granteeRole: 'Purchaser', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Equitable interest on contract; track deposit, completion date, then consent + registration.', isSystem: true },
  { key: 'assignment', label: 'Assignment of Right of Occupancy', legalNature: 'transactional', grantorRole: 'Assignor', granteeRole: 'Assignee', requiresGovernorConsent: true, drivesRentLedger: false, lawBasis: 'Transfer of the whole right of occupancy by deed; LUA s.22 consent + registration.', isSystem: true },
  { key: 'trust', label: 'Trust / Beneficial Interest', legalNature: 'estate_in_land', grantorRole: 'Trustee', granteeRole: 'Beneficiary', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Trustee holds the right of occupancy on trust; the beneficial interest binds in equity.', isSystem: true },
  { key: 'management_agency', label: 'Management Agency', legalNature: 'management', grantorRole: 'Principal (Owner)', granteeRole: 'Agent (Manager)', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: 'Property-management mandate: rent collection, maintenance, service-charge administration for a fee.', isSystem: true },
];

export const RELATIONSHIP_STATUSES = ['pending', 'active', 'expired', 'terminated', 'disputed', 'redeemed'] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

export const CONSENT_STATUSES = ['not_required', 'not_applied', 'applied', 'approved', 'rejected'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSIDERATION_FREQUENCIES = [
  { key: 'one_off', label: 'One-off' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'bi_annually', label: 'Bi-annually' },
  { key: 'annually', label: 'Annually' },
] as const;

export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-gray-100 text-gray-600',
  terminated: 'bg-gray-200 text-gray-700',
  disputed: 'bg-red-100 text-red-700',
  redeemed: 'bg-blue-100 text-blue-700',
};

export const CONSENT_STYLES: Record<string, string> = {
  not_required: 'bg-gray-100 text-gray-600',
  not_applied: 'bg-amber-100 text-amber-800',
  applied: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
};

const prettify = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Human label for a stored typeKey. Registry → system → prettified key. */
export function relationshipTypeLabel(key: string, registry?: RelationshipTypeOption[]): string {
  const custom = registry?.find((t) => t.key === key && !t.isSystem);
  if (custom) return custom.label;
  const system = SYSTEM_RELATIONSHIP_TYPES.find((t) => t.key === key);
  if (system) return system.label;
  return prettify(key);
}

/** Dropdown options: system ontology + the firm's active custom types. */
export function relationshipTypeOptions(registry?: RelationshipTypeOption[]): RelationshipTypeOption[] {
  const custom = (registry ?? []).filter((t) => !t.isSystem);
  return [...SYSTEM_RELATIONSHIP_TYPES, ...custom];
}
