/**
 * ngPhone.test.ts — TASK 94 (2026-11-25) canonical Nigerian phone
 * normalisation. The SERVER and CLIENT twins are pinned to AGREE, and the
 * full real-world shape matrix is locked: local prefixes (080/070/081/
 * 090/091/020…), international (+234/234), and the double-prefix
 * mistakes ("0234801…", "2340801…", "00234801…") — repaired, never
 * re-prefixed (234 never lands twice).
 */
import { describe, it, expect } from 'vitest';

import { normaliseNgPhone as serverNormalise, isValidNgPhone as serverIsValid, formatNgPhoneE164 as serverFmt } from '../../convex/ngPhone';
import { normaliseNgPhone as clientNormalise, isValidNgPhone as clientIsValid, formatNgPhoneE164 as clientFmt } from '../../src/utils/ngPhone';

// ─── The matrix both twins must agree on ──────────────────────────────────
// [input, expected E.164 digits]
const MATRIX: Array<[string, string]> = [
  // Local Nigerian mobile prefixes (owner's list)
  ['08012345678', '2348012345678'],
  ['07012345678', '2347012345678'],
  ['08123456789', '2348123456789'],
  ['09012345678', '2349012345678'],
  ['09123456789', '2349123456789'],
  // Lagos-style 02x local
  ['02012345678', '2342012345678'],
  // Local without leading zero
  ['8012345678', '2348012345678'],
  ['2012345678', '2342012345678'],
  // Already international
  ['+2348012345678', '2348012345678'],
  ['2348012345678', '2348012345678'],
  // Double-prefix mistakes — repaired, never prefixed twice
  ['02348012345678', '2348012345678'],   // local 0 + country code + national
  ['23408012345678', '2348012345678'],    // country code + local-with-0
  ['002348012345678', '2348012345678'],   // international dial-out prefix (00 + 234 + national)
  // Formatted input
  ['+234 801 234 5678', '2348012345678'],
  ['0801-234-5678', '2348012345678'],
  ['(+234) 8012345678', '2348012345678'],
];

const INVALID: Array<string> = [
  '',
  'abc',
  '123',          // too short
  '234',          // country code only
  '12345678901234567890', // 20 digits — not a phone
];

describe('ngPhone — server and client twins agree on the full matrix', () => {
  it('normalises every real-world shape to the same E.164 digits', () => {
    for (const [input, expected] of MATRIX) {
      expect(serverNormalise(input), `server: ${input}`).toBe(expected);
      expect(clientNormalise(input), `client: ${input}`).toBe(expected);
    }
  });

  it('rejects unparseable inputs with "" (never a silently wrong number)', () => {
    for (const input of INVALID) {
      expect(serverNormalise(input)).toBe('');
      expect(clientNormalise(input)).toBe('');
    }
  });

  it('isValidNgPhone mirrors normalisation truth', () => {
    expect(serverIsValid('08012345678')).toBe(true);
    expect(clientIsValid('08012345678')).toBe(true);
    expect(serverIsValid('12')).toBe(false);
    expect(clientIsValid('12')).toBe(false);
  });

  it('formatNgPhoneE164 renders the human-readable hint form', () => {
    expect(serverFmt('2348012345678')).toBe('+234 801 234 5678');
    expect(clientFmt('2348012345678')).toBe('+234 801 234 5678');
    expect(serverFmt('')).toBe('');
    expect(clientFmt('')).toBe('');
  });

  it('the double-prefix repair never yields 2340… (no embedded local zero)', () => {
    for (const input of ['02348012345678', '23408012345678', '00234801234567']) {
      expect(clientNormalise(input)).not.toMatch(/^2340/);
      expect(serverNormalise(input)).not.toMatch(/^2340/);
    }
  });
});

describe('ngPhone — the WhatsApp chain uses the canonical form end to end', () => {
  it('communications.normalisePhoneForMeta delegates to ngPhone (server twin)', async () => {
    const { normalisePhoneForMeta } = await import('../../convex/communications');
    expect(normalisePhoneForMeta('08012345678')).toBe('2348012345678');
    expect(normalisePhoneForMeta('23408012345678')).toBe('2348012345678'); // the old normaliser passed this through BROKEN
    expect(normalisePhoneForMeta('nonsense')).toBeNull();
  });

  it('whatsappShare.normalizePhoneForWa delegates to ngPhone (client twin)', async () => {
    const mod: any = await import('../../src/utils/whatsappShare');
    expect(mod.normalizePhoneForWa('02012345678')).toBe('2342012345678'); // 02x locals now normalise (previously passed through raw)
    expect(mod.normalizePhoneForWa('02348012345678')).toBe('2348012345678');
    expect(mod.normalizePhoneForWa('0234801234567')).toBe(''); // unrecoverable 0-prefixed shape — invalid, never passthrough
    expect(mod.whatsappShareUrl('08012345678', 'hi')).toBe('https://wa.me/2348012345678?text=hi');
  });

  it('generateVisitorToken stores the NORMALISED number and rejects garbage up front', async () => {
    const vm = (await import('node:fs')).readFileSync('convex/visitorManagement.ts', 'utf8');
    expect(vm).toContain('visitorPhone: visitorPhoneE164');
    expect(vm).toContain('VISITOR_PHONE_INVALID');
  });
});
