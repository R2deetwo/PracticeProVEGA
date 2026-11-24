/**
 * coreInstruments — the curated core-authorities seed list (2026-11-25
 * Antigravity audit response: "Legal KB Corpus Emptiness"). These tests pin
 * the METADATA invariants — every citation fact was verified against live
 * authoritative sources on 2026-11-25 before landing (PLAC consolidated
 * texts, FRN Official Gazette copies, WIPO Lex, the NBA's October 2024
 * compliance notice).
 *
 * House rule 2 (no invented legal specifics) enforced structurally:
 * structure arrays MUST be empty — statutory text only ever arrives through
 * the ingestion pipeline with SHA-256 provenance, never from this seed.
 */
import { describe, it, expect } from 'vitest';
import { CORE_INSTRUMENTS } from '../../convex/legal/coreInstruments';
import { deriveCurrencyStatus } from '../../convex/legal/currency';

const currencyOf = (d: (typeof CORE_INSTRUMENTS)[number]) =>
  deriveCurrencyStatus({
    status: d.status,
    amended: d.amendmentTracker.amended,
    repealed: d.amendmentTracker.repealed,
    verified: true,
  });

describe('coreInstruments — the eight high-frequency Nigerian authorities', () => {
  it('the exact key set is pinned (additions are deliberate, not accidental)', () => {
    expect(CORE_INSTRUMENTS.map((d) => d.key)).toEqual([
      'constitution_1999',
      'cama_2020',
      'evidence_act_2011',
      'land_use_act',
      'fhc_civil_rules_2019',
      'lagos_hc_civil_rules_2019',
      'rpc_2023',
      'rpc_2007',
    ]);
  });

  it('keys are stable slugs and unique', () => {
    const keys = CORE_INSTRUMENTS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9_]+$/);
  });

  it('every source URL is https and unique (the dedup key of the scrape queue)', () => {
    const urls = CORE_INSTRUMENTS.map((d) => d.sourceUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url.startsWith('https://')).toBe(true);
  });

  it('statuses use the legacy vocabulary the currency derivation reads', () => {
    const allowed = ['in_force', 'amended', 'repealed'];
    for (const d of CORE_INSTRUMENTS) expect(allowed).toContain(d.status);
  });

  it('NO statutory text is fabricated: structure arrays are empty by design', () => {
    for (const d of CORE_INSTRUMENTS) expect(d.structure).toEqual([]);
  });

  it('an amended instrument always names its amending laws; a repealed one names its repeal', () => {
    for (const d of CORE_INSTRUMENTS) {
      if (d.amendmentTracker.amended) {
        expect(d.amendmentTracker.amendmentRefs.length).toBeGreaterThan(0);
      }
      if (d.amendmentTracker.repealed) {
        expect(d.amendmentTracker.repealRef).toBeTruthy();
      }
    }
  });

  it('titles and summaries are ASCII-only (the WhatsApp round-1 em-dash lesson applies to legal strings too)', () => {
    for (const d of CORE_INSTRUMENTS) {
      expect(/[\u0080-\uFFFF]/.test(d.title)).toBe(false);
      expect(/[\u0080-\uFFFF]/.test(d.summary ?? '')).toBe(false);
    }
  });

  it('summaries are present for every instrument (the currency badge needs context)', () => {
    for (const d of CORE_INSTRUMENTS) expect((d.summary ?? '').length).toBeGreaterThan(0);
  });

  it('domain categories come from the pipeline vocabulary', () => {
    const allowed = ['statutes', 'rules_of_court', 'subsidiary'];
    for (const d of CORE_INSTRUMENTS) expect(allowed).toContain(d.domainCategory);
  });
});

describe('coreInstruments — currency derivation (mirrors the ingest path)', () => {
  it('the in-force consolidations derive active_verified', () => {
    for (const key of ['cama_2020', 'land_use_act', 'fhc_civil_rules_2019', 'lagos_hc_civil_rules_2019', 'rpc_2023']) {
      const d = CORE_INSTRUMENTS.find((x) => x.key === key)!;
      expect(currencyOf(d)).toBe('active_verified');
    }
  });

  it('the amended instruments derive amended_partial (never silently in-force)', () => {
    for (const key of ['constitution_1999', 'evidence_act_2011']) {
      const d = CORE_INSTRUMENTS.find((x) => x.key === key)!;
      expect(currencyOf(d)).toBe('amended_partial');
    }
  });

  it('the superseded RPC 2007 derives superseded_or_repealed (honest tombstone)', () => {
    const d = CORE_INSTRUMENTS.find((x) => x.key === 'rpc_2007')!;
    expect(currencyOf(d)).toBe('superseded_or_repealed');
  });

  it('rpc_2023 records the 2024 commencement and names its issuing body exactly', () => {
    const rpc = CORE_INSTRUMENTS.find((x) => x.key === 'rpc_2023')!;
    expect(rpc.commencementDate).toBe('2024-01-01');
    expect(rpc.issuingBody).toBe('General Council of the Bar');
  });
});
