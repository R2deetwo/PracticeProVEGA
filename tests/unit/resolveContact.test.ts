/**
 * Task 64 — resolveContactById: resilient matter→client resolution.
 *
 * The bug: matters created before the stable client-UUID link carry a
 * clientId in EITHER form — the client-side UUID (custom `id` on the
 * contact doc) or the raw Convex `_id` (the legacy backfill wrote the
 * local optimistic uuid which did not survive the backend merge → every
 * fresh matter displayed "Deleted Client"). The resolver matches BOTH.
 */
import { describe, it, expect } from 'vitest';
import { resolveContactById } from '../../src/utils/resolveContact';

const CONTACTS = [
  { id: 'contact_uuid_1', _id: 'k57abcdef', name: 'Adaeze Okonkwo' },
  { id: 'contact_uuid_2', _id: 'k57ghijkl', name: 'Chinedu Eze' },
  // Legacy contact: no custom id, only the Convex _id mirrored to id.
  { id: 'k57mnopqr', _id: 'k57mnopqr', name: 'Legacy Client' },
];

describe('resolveContactById (Task 64 — Deleted Client bug)', () => {
  it('resolves by the custom client uuid (the new stable link)', () => {
    expect(resolveContactById(CONTACTS, 'contact_uuid_1')?.name).toBe('Adaeze Okonkwo');
  });

  it('resolves by the raw Convex _id (legacy backfill form)', () => {
    expect(resolveContactById(CONTACTS, 'k57ghijkl')?.name).toBe('Chinedu Eze');
  });

  it('resolves legacy matters whose clientId holds a mirrored _id', () => {
    expect(resolveContactById(CONTACTS, 'k57mnopqr')?.name).toBe('Legacy Client');
  });

  it('returns undefined for an unknown id (renders the fallback label)', () => {
    expect(resolveContactById(CONTACTS, 'contact_uuid_404')).toBeUndefined();
  });

  it('handles null/undefined id and empty/missing contact lists safely', () => {
    expect(resolveContactById(CONTACTS, null)).toBeUndefined();
    expect(resolveContactById(CONTACTS, undefined)).toBeUndefined();
    expect(resolveContactById([], 'contact_uuid_1')).toBeUndefined();
    expect(resolveContactById(undefined, 'contact_uuid_1')).toBeUndefined();
    expect(resolveContactById(null, 'contact_uuid_1')).toBeUndefined();
  });

  it('string-coerces non-string ids (defensive against numeric ids)', () => {
    const numericContacts = [{ id: 12345, _id: 'k57numeric', name: 'Numeric Id Client' }];
    expect(resolveContactById(numericContacts as any, '12345')?.name).toBe('Numeric Id Client');
  });
});
