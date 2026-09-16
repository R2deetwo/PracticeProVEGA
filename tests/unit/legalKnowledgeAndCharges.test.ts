/**
 * Legal Knowledge Engine + Extensible Charges contract tests (Task 51).
 *
 * TWO PRODUCTS, ONE TASK:
 *
 * PART 1 — LEGAL CORPUS INTEGRITY (pure data, convex/legalCorpus.ts):
 *   - provisions reference instruments that actually exist in the corpus
 *   - forms reference institutions that actually exist
 *   - every provision/form carries non-empty content + a verificationStatus
 *   - 37 state judiciaries with unique keys and unique rules citations
 *
 * PART 2 — SCHEMA + WIRING CONTRACTS (source-scanned so removal fails CI):
 *   - the 5 knowledge tables + charge_types exist with the right indexes
 *   - ledger_entries.type and service_charges.category are REGISTRY-validated
 *     strings (the hardcoded 5-value unions are gone)
 *   - addLedgerEntry / upsertServiceCharge call assertValidChargeType
 *   - ALOA retrieval is wired end-to-end: AloaChat searchLegalRepo →
 *     geminiService legalKnowledgeContext (both paths) → AgencyHub prompt
 *   - the client index builder (Build Legal Index) writes embedded:true
 *
 * PART 3 — CHARGE TYPE REGISTRY (pure logic):
 *   - system types always valid; unknown types rejected without registry
 *   - src/utils/chargeTypeUtils mirrors convex/chargeTypes (no drift)
 *   - label resolution: system → custom registry → prettified fallback
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FEDERAL_INSTITUTIONS,
  REGISTRY_INSTITUTIONS,
  STATE_JUDICIARIES,
  FEDERAL_INSTRUMENTS,
  LAGOS_INSTRUMENTS,
  PROVISIONS,
  FORMS,
} from '../../convex/legalCorpus';
import { SYSTEM_LEDGER_TYPES, SYSTEM_SERVICE_CATEGORIES } from '../../convex/chargeTypes';
import {
  chargeTypeLabel,
  chargeTypeOptions,
  SYSTEM_LEDGER_TYPES as CLIENT_LEDGER,
  SYSTEM_SERVICE_CATEGORIES as CLIENT_SERVICE,
  ChargeTypeOption,
} from '../../src/utils/chargeTypeUtils';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — LEGAL CORPUS INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

describe('Legal corpus integrity (Task 51)', () => {
  const stateInstrumentKeys = STATE_JUDICIARIES.map(
    (s) => `${s.key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_hc_rules`
  );
  const stateInstitutionKeys = STATE_JUDICIARIES.map(
    (s) => `${s.key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_judiciary`
  );
  const allInstrumentKeys = new Set([
    ...FEDERAL_INSTRUMENTS.map((i) => i.key),
    ...LAGOS_INSTRUMENTS.map((i) => i.key),
    ...stateInstrumentKeys,
  ]);
  const allInstitutionKeys = new Set([
    ...FEDERAL_INSTITUTIONS.map((i) => i.key),
    ...REGISTRY_INSTITUTIONS.map((i) => i.key),
    ...stateInstitutionKeys,
  ]);

  it('covers all 37 state/FCT judiciaries with unique keys and citations', () => {
    expect(STATE_JUDICIARIES.length).toBe(37);
    const keys = new Set(STATE_JUDICIARIES.map((s) => s.key));
    expect(keys.size).toBe(37);
    const rules = new Set(STATE_JUDICIARIES.map((s) => s.rules));
    expect(rules.size).toBe(37); // no copy-paste citation collisions
    expect(keys.has('Lagos')).toBe(true);
    expect(keys.has('FCT')).toBe(true);
    expect(keys.has('Zamfara')).toBe(true);
  });

  it('seeds every provision against an instrument that exists', () => {
    expect(PROVISIONS.length).toBeGreaterThanOrEqual(25);
    for (const p of PROVISIONS) {
      expect(allInstrumentKeys.has(p.instrumentKey), `unknown instrument ${p.instrumentKey}`).toBe(true);
      expect(p.ref.trim().length).toBeGreaterThan(0);
      expect(p.heading.trim().length).toBeGreaterThan(0);
      expect(p.text.trim().length).toBeGreaterThan(80); // substantive, not a stub
      expect(['verbatim', 'summary', 'practice_note']).toContain(p.textType);
    }
  });

  it('seeds every form against an institution that exists', () => {
    expect(FORMS.length).toBeGreaterThanOrEqual(15);
    for (const f of FORMS) {
      expect(allInstitutionKeys.has(f.institutionKey), `unknown institution ${f.institutionKey}`).toBe(true);
      expect(f.title.trim().length).toBeGreaterThan(0);
      expect(f.fields.length).toBeGreaterThan(0);
      expect(f.verificationStatus).toBe('needs_founder_review'); // honesty contract
    }
  });

  it('flags corpus honesty: provisions default to needs_founder_review', () => {
    for (const p of PROVISIONS) {
      expect(['founder_reviewed', 'needs_founder_review', undefined]).toContain(p.verificationStatus);
    }
    // The honesty contract: unless explicitly marked reviewed, seeded
    // practice content must be flagged for verification.
    const flagged = PROVISIONS.filter((p) => p.verificationStatus === 'needs_founder_review');
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('carries jurisdiction tags on state-scoped provisions', () => {
    const lagos = PROVISIONS.filter((p) => p.instrumentKey.startsWith('lagos_'));
    expect(lagos.length).toBeGreaterThan(0);
    for (const p of lagos) expect(p.jurisdictionKey).toBe('Lagos');
  });

  it('includes the deep core: Lagos HC, FHC, CFRN, CAMA, Evidence, Tenancy, Sheriffs, NICN', () => {
    for (const key of [
      'lagos_hc_cpr_2019',
      'fhc_cpr_2019',
      'cfrn_1999',
      'cama_2020',
      'evidence_act_2011',
      'lagos_tenancy_law_2011',
      'sheriffs_act',
      'nicn_cpr_2017',
    ]) {
      expect(allInstrumentKeys.has(key), `missing core instrument ${key}`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — SCHEMA + WIRING CONTRACTS (source-scanned)
// ─────────────────────────────────────────────────────────────────────────────

describe('Legal knowledge + charge registry wiring (Task 51)', () => {
  const schema = read('convex/schema.ts');
  const sentry = read('convex/sentry.ts');
  const aloaChat = read('src/components/aloa/AloaChat.tsx');
  const gemini = read('src/services/geminiService.ts');
  const agency = read('src/agents/AgencyHub.ts');
  const settings = read('src/components/settings/AgentSettings.tsx');
  const legalKnowledge = read('convex/legalKnowledge.ts');
  const seed = read('convex/seedLegalKnowledge.ts');

  it('defines the five knowledge tables with retrieval indexes', () => {
    for (const table of ['institutions', 'instruments', 'instrument_provisions', 'court_forms', 'instrument_changes']) {
      expect(schema).toContain(`${table}: defineTable`);
    }
    // vector retrieval on both content tables (slice between the real table
    // definitions — not the header comments)
    const provIdx = schema.indexOf('instrument_provisions: defineTable');
    const provBlock = schema.slice(provIdx, schema.indexOf('court_forms: defineTable'));
    expect(provBlock).toContain('vectorIndex');
    expect(provBlock).toContain('by_embedded');
    const formsIdx = schema.indexOf('court_forms: defineTable');
    const formsBlock = schema.slice(formsIdx, schema.indexOf('instrument_changes: defineTable'));
    expect(formsBlock).toContain('vectorIndex');
    expect(formsBlock).toContain('by_embedded');
  });

  it('defines the charge_types registry table', () => {
    expect(schema).toContain('charge_types: defineTable');
    expect(schema).toContain('.index("by_firm_key", ["firmId", "key"])');
  });

  it('replaces the hardcoded charge unions with registry-validated strings', () => {
    // The old 5-value unions must NOT remain on the write paths…
    expect(schema.includes('v.literal("service_charge"), v.literal("penalty")')).toBe(false);
    expect(schema.includes('v.literal("Diesel"), v.literal("Security")')).toBe(false);
    // …and both charge fields are now free strings…
    expect(schema).toMatch(/type: v\.string\(\)/);
    expect(schema).toMatch(/category: v\.string\(\)/);
    // …validated in BOTH write mutations.
    expect(sentry).toContain('assertValidChargeType(ctx, auth.firmId, "ledger", args.type)');
    expect(sentry).toContain('assertValidChargeType(ctx, auth.firmId, "service", args.category)');
  });

  it('wires ALOA retrieval end-to-end (chat → service → prompt)', () => {
    expect(aloaChat).toContain('searchLegalRepo');
    expect(aloaChat).toContain('api.legalKnowledge.searchKnowledge');
    expect(aloaChat).toContain('pending founder verification');
    // BOTH message paths (sendMessage + streamMessage) consume + forward it
    const forwards = gemini.split('legalKnowledgeContext').length - 1;
    expect(forwards).toBeGreaterThanOrEqual(6); // 2 decls + 2 calls + 2 param passes
    expect(gemini).toContain("context.searchLegalRepo(lastUserMsg)");
    // The prompt block enforces citation + no-invention grounding
    expect(agency).toContain('NIGERIAN LEGAL AUTHORITY RETRIEVAL');
    expect(agency).toContain('NEVER invent rule numbers');
  });

  it('ships the client-side index builder (embed → write embedded:true)', () => {
    expect(settings).toContain('BuildLegalIndexButton');
    expect(settings).toContain('getPendingLegalIndex');
    expect(settings).toContain('writeLegalEmbeddings');
    expect(legalKnowledge).toContain('embedded: true');
  });

  it('guards the change-tracking intake (founder-only) and review stamps', () => {
    expect(legalKnowledge).toContain('requireFounderCaller');
    expect(legalKnowledge).toContain('logInstrumentChange');
    expect(legalKnowledge).toContain('reviewChange');
    expect(legalKnowledge).toContain('lastVerifiedAt');
  });

  it('seeds institutions + instruments + provisions + forms idempotently', () => {
    expect(seed).toContain('requireFounderCaller');
    expect(seed).toContain('withIndex("by_key"');
    expect(seed).toContain('embedded: existing?.embedded ?? false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PART 3 — CHARGE TYPE REGISTRY (pure logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('Charge type registry (Task 51)', () => {
  it('keeps the five system types on each surface', () => {
    expect(SYSTEM_LEDGER_TYPES.map((t) => t.key)).toEqual([
      'rent', 'service_charge', 'penalty', 'deposit', 'management_fee',
    ]);
    expect(SYSTEM_SERVICE_CATEGORIES.map((t) => t.key)).toEqual([
      'Diesel', 'Security', 'Cleaning', 'Water', 'Other',
    ]);
  });

  it('mirrors the client constants — no server/client drift', () => {
    expect(CLIENT_LEDGER.map((t) => t.key)).toEqual(SYSTEM_LEDGER_TYPES.map((t) => t.key));
    expect(CLIENT_SERVICE.map((t) => t.key)).toEqual(SYSTEM_SERVICE_CATEGORIES.map((t) => t.key));
    for (const [server, client] of [
      [SYSTEM_LEDGER_TYPES, CLIENT_LEDGER],
      [SYSTEM_SERVICE_CATEGORIES, CLIENT_SERVICE],
    ] as const) {
      for (const t of server) {
        const mirror = (client as readonly ChargeTypeOption[]).find((c) => c.key === t.key);
        expect(mirror?.participatesInDunning).toBe(t.participatesInDunning);
        expect(mirror?.refundable).toBe(t.refundable);
      }
    }
  });

  it('resolves labels: system → custom registry → prettified fallback', () => {
    expect(chargeTypeLabel('rent')).toBe('Rent');
    expect(chargeTypeLabel('service_charge')).toBe('Service Charge');
    expect(chargeTypeLabel('Diesel')).toBe('Diesel');
    const registry: ChargeTypeOption[] = [
      { key: 'waste_management', label: 'Waste Management', kind: 'service', category: 'utility', defaultCycle: 'Monthly', defaultAmount: null, isSystem: false, participatesInDunning: true, refundable: false },
    ];
    expect(chargeTypeLabel('waste_management', registry)).toBe('Waste Management');
    // Archived/unknown keys still render sensibly instead of "undefined"
    expect(chargeTypeLabel('diesel_levy')).toBe('Diesel Levy');
    expect(chargeTypeLabel('legal_fees', registry)).toBe('Legal Fees');
  });

  it('merges system + custom options per surface without blocking on the registry', () => {
    // No registry loaded yet (undefined) → system-only fallback
    const fallback = chargeTypeOptions('ledger', undefined);
    expect(fallback.map((o) => o.key)).toContain('rent');
    expect(fallback.every((o) => o.isSystem)).toBe(true);

    const custom: ChargeTypeOption[] = [
      { key: 'diesel_levy', label: 'Diesel Levy', kind: 'ledger', category: 'utility', defaultCycle: 'Monthly', defaultAmount: 5000, isSystem: false, participatesInDunning: true, refundable: false },
      { key: 'waste_management', label: 'Waste Management', kind: 'service', category: 'utility', defaultCycle: 'Monthly', defaultAmount: null, isSystem: false, participatesInDunning: true, refundable: false },
    ];
    const ledger = chargeTypeOptions('ledger', custom);
    const service = chargeTypeOptions('service', custom);
    expect(ledger.map((o) => o.key)).toContain('diesel_levy');
    expect(ledger.map((o) => o.key)).not.toContain('waste_management'); // kind-scoped
    expect(service.map((o) => o.key)).toContain('waste_management');
    expect(ledger.filter((o) => o.key === 'rent')[0].isSystem).toBe(true);
    expect(ledger.filter((o) => o.key === 'diesel_levy')[0].isSystem).toBe(false);
  });
});
