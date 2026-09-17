/**
 * Property use-relationship ontology tests (Task 52).
 *
 * PART 1 — ONTOLOGY (pure data, convex/propertyRelationships.ts):
 *   - 16 system relationship types with unique keys and valid legal natures
 *   - the Nigerian land-law essentials are present and correctly flagged
 *     (tenancy drives the rent ledger; sublease/legal mortgage/assignment
 *     require Governor's consent under LUA s.22; licenses do not)
 *
 * PART 2 — SCHEMA + WIRING CONTRACTS (source-scanned so removal fails CI):
 *   - relationship_types + property_relationships tables with the right indexes
 *   - createRelationship validates the type against the registry and keys
 *     relationships on the CANONICAL Convex property id (legacy-id fallback)
 *   - the tenancy import is idempotent (skips already-imported units)
 *   - client mirror (src/utils/relationshipTypes.ts) has no drift
 *   - PropertyDetailView ships the relationships tab
 *   - api.d.ts registers the new module (sandbox can't run convex codegen)
 *
 * PART 3 — CLIENT MIRROR (pure logic): labels, options, style maps.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SYSTEM_RELATIONSHIP_TYPES } from '../../convex/propertyRelationships';
import {
  SYSTEM_RELATIONSHIP_TYPES as CLIENT_TYPES,
  RELATIONSHIP_STATUSES,
  CONSENT_STATUSES,
  relationshipTypeLabel,
  relationshipTypeOptions,
  STATUS_STYLES,
  CONSENT_STYLES,
  LEGAL_NATURE_LABELS,
  RelationshipTypeOption,
} from '../../src/utils/relationshipTypes';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const VALID_NATURES = [
  'estate_in_land', 'license', 'servitude', 'security_interest',
  'co_ownership', 'transactional', 'management',
];

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — ONTOLOGY
// ─────────────────────────────────────────────────────────────────────────────

describe('Property use-relationship ontology (Task 52)', () => {
  it('ships 16 system types with unique keys and valid legal natures', () => {
    expect(SYSTEM_RELATIONSHIP_TYPES.length).toBe(16);
    const keys = SYSTEM_RELATIONSHIP_TYPES.map((t) => t.key);
    expect(new Set(keys).size).toBe(16);
    for (const t of SYSTEM_RELATIONSHIP_TYPES) {
      expect(VALID_NATURES).toContain(t.legalNature);
      expect(t.label.length).toBeGreaterThan(3);
      expect(t.grantorRole.length).toBeGreaterThan(1);
      expect(t.granteeRole.length).toBeGreaterThan(1);
      expect(t.lawBasis.length).toBeGreaterThan(20); // substantive legal note
    }
  });

  it('covers the Nigerian land-law relationship spectrum', () => {
    const keys = new Set<string>(SYSTEM_RELATIONSHIP_TYPES.map((t) => t.key as string));
    for (const expected of [
      'tenancy', 'sublease', 'license', 'easement', 'profit_a_prendre',
      'leasehold_mortgage', 'equitable_mortgage', 'customary_tenancy',
      'customary_pledge', 'caretaker', 'joint_ownership', 'tenancy_in_common',
      'sale_pending', 'assignment', 'trust', 'management_agency',
    ]) {
      expect(keys.has(expected), `missing ontology type ${expected}`).toBe(true);
    }
  });

  it('flags LUA s.22 consent on alienating types only', () => {
    const byKey = new Map<string, (typeof SYSTEM_RELATIONSHIP_TYPES)[number]>(
      SYSTEM_RELATIONSHIP_TYPES.map((t) => [t.key as string, t])
    );
    // Alienations of a right of occupancy → consent required
    for (const k of ['sublease', 'leasehold_mortgage', 'assignment']) {
      expect(byKey.get(k)!.requiresGovernorConsent, `${k} should require consent`).toBe(true);
    }
    // Non-alienating interests → no consent flag
    for (const k of ['tenancy', 'license', 'easement', 'customary_tenancy', 'caretaker', 'joint_ownership']) {
      expect(byKey.get(k)!.requiresGovernorConsent, `${k} should not require consent`).toBe(false);
    }
  });

  it('drives the rent ledger from tenancy-family types only', () => {
    const byKey = new Map<string, (typeof SYSTEM_RELATIONSHIP_TYPES)[number]>(
      SYSTEM_RELATIONSHIP_TYPES.map((t) => [t.key as string, t])
    );
    expect(byKey.get('tenancy')!.drivesRentLedger).toBe(true);
    expect(byKey.get('sublease')!.drivesRentLedger).toBe(true);
    for (const k of ['easement', 'trust', 'management_agency', 'joint_ownership']) {
      expect(byKey.get(k)!.drivesRentLedger, `${k} should not drive the rent ledger`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — SCHEMA + WIRING CONTRACTS (source-scanned)
// ─────────────────────────────────────────────────────────────────────────────

describe('Relationship schema + wiring contracts (Task 52)', () => {
  const schema = read('convex/schema.ts');
  const module = read('convex/propertyRelationships.ts');
  const propertyDetail = read('src/components/details/PropertyDetailView.tsx');
  const tab = read('src/components/details/PropertyRelationshipsTab.tsx');
  const apiDts = read('convex/_generated/api.d.ts');

  it('defines the registry + records tables with retrieval indexes', () => {
    expect(schema).toContain('relationship_types: defineTable');
    expect(schema).toContain('property_relationships: defineTable');
    expect(schema).toContain('.index("by_firm_key", ["firmId", "key"])');
    expect(schema).toContain('.index("by_property", ["propertyId"])');
    expect(schema).toContain('.index("by_firm_type", ["firmId", "typeKey"])');
  });

  it('validates relationship types on the write path and resolves canonical property ids', () => {
    expect(module).toContain('assertValidRelationshipType(ctx, firmId, args.typeKey)');
    // Canonical id resolution: Convex _id first, legacy by_custom_id fallback,
    // firm ownership check — so legacy-id callers key consistently.
    expect(module).toContain('async function resolvePropertyId');
    expect(module).toContain('by_custom_id');
    expect(module).toContain('propertyId: canonicalPropertyId');
  });

  it('makes the tenancy import idempotent', () => {
    expect(module).toContain('importTenanciesAsRelationships');
    expect(module).toContain('existingKeys.has');
    expect(module).toContain('imported_unit');
    expect(module).toContain('imported_tenancy');
  });

  it('mirrors the ontology client-side — no server/client drift', () => {
    expect(CLIENT_TYPES.map((t) => t.key)).toEqual(SYSTEM_RELATIONSHIP_TYPES.map((t) => t.key));
    for (const [server, client] of SYSTEM_RELATIONSHIP_TYPES.map(
      (t) => [t, CLIENT_TYPES.find((c) => c.key === t.key) as RelationshipTypeOption]
    )) {
      expect(client?.label).toBe(server.label);
      expect(client?.legalNature).toBe(server.legalNature);
      expect(client?.grantorRole).toBe(server.grantorRole);
      expect(client?.granteeRole).toBe(server.granteeRole);
      expect(client?.requiresGovernorConsent).toBe(server.requiresGovernorConsent);
      expect(client?.drivesRentLedger).toBe(server.drivesRentLedger);
    }
  });

  it('ships the relationships tab on the property detail view', () => {
    expect(propertyDetail).toContain("'relationships'");
    expect(propertyDetail).toContain('PropertyRelationshipsTab');
    expect(propertyDetail).toContain('activeTab === \'relationships\'');
    // The tab component calls the new API end-to-end
    expect(tab).toContain('api.propertyRelationships.getRelationshipTypes');
    expect(tab).toContain('api.propertyRelationships.getRelationships');
    expect(tab).toContain('api.propertyRelationships.createRelationship');
    expect(tab).toContain('api.propertyRelationships.importTenanciesAsRelationships');
  });

  it('registers the module in the generated api.d.ts', () => {
    expect(apiDts).toContain('import type * as propertyRelationships');
    expect(apiDts).toContain('propertyRelationships: typeof propertyRelationships');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3 — CLIENT MIRROR (pure logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('Relationship client mirror (Task 52)', () => {
  it('resolves labels: system → custom registry → prettified fallback', () => {
    expect(relationshipTypeLabel('tenancy')).toBe('Tenancy (Lease)');
    expect(relationshipTypeLabel('assignment')).toBe('Assignment of Right of Occupancy');
    const registry: RelationshipTypeOption[] = [
      { key: 'church_lease', label: 'Church Lease (Sunday use)', legalNature: 'license', grantorRole: 'Owner', granteeRole: 'Church', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: '', isSystem: false },
    ];
    expect(relationshipTypeLabel('church_lease', registry)).toBe('Church Lease (Sunday use)');
    // Archived/unknown keys still render sensibly
    expect(relationshipTypeLabel('church_lease')).toBe('Church Lease');
  });

  it('merges system ontology + custom types for dropdowns', () => {
    const custom: RelationshipTypeOption[] = [
      { key: 'event_space_license', label: 'Event Space License', legalNature: 'license', grantorRole: 'Owner', granteeRole: 'Organizer', requiresGovernorConsent: false, drivesRentLedger: false, lawBasis: '', isSystem: false },
    ];
    const options = relationshipTypeOptions(custom);
    expect(options.length).toBe(17);
    expect(options.map((o) => o.key)).toContain('event_space_license');
    // No registry loaded yet → system-only fallback
    expect(relationshipTypeOptions(undefined).every((o) => o.isSystem)).toBe(true);
  });

  it('styles every lifecycle and consent status (no undefined class chips)', () => {
    for (const s of RELATIONSHIP_STATUSES) expect(STATUS_STYLES[s]).toBeTruthy();
    for (const s of CONSENT_STATUSES) expect(CONSENT_STYLES[s]).toBeTruthy();
    for (const nature of Object.values(LEGAL_NATURE_LABELS)) {
      expect(nature.length).toBeGreaterThan(3);
    }
  });
});
