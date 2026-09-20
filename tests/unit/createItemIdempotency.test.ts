/**
 * Task 64 — createItem idempotency lookup.
 *
 * The bug: on flaky networks the same logical create reached the server
 * more than once (pending Convex mutations committing on reconnect +
 * draft-restored resubmits + offline-queue replays after mid-replay
 * reloads or from a second tab). Every execution inserted a fresh document
 * — "the matter saved multiple times". findDocByClientId is the lookup
 * that lets createItem dedupe on the client-supplied stable id.
 *
 * Mocked ctx.db mirrors the Convex query-builder surface used by the
 * helper (withIndex for INDEXED_CUSTOM_ID_TABLES, filter otherwise).
 */
import { describe, it, expect } from 'vitest';

// Import from the Convex source the same way resolveRecordForUpdate tests do.
import { findDocByClientId } from '../../convex/myFunctions';

type Doc = { id?: string; firmId?: string; [k: string]: any };

function makeCtx(docsByTable: Record<string, Doc[]>) {
  return {
    db: {
      query: (table: string) => {
        const docs = docsByTable[table] || [];
        return {
          withIndex: (_name: string, fn: (q: any) => any) => ({
            first: async () => {
              // Emulate by_custom_id: q.eq("id", value) returns a predicate.
              let matchValue: string | null = null;
              fn({
                eq: (_field: string, value: string) => {
                  matchValue = value;
                  return value;
                },
              });
              return docs.find(d => d.id === matchValue) || null;
            },
          }),
          filter: (fn: (q: any) => any) => ({
            first: async () => {
              // Emulate q.field("id") equality filtering.
              let matchValue: string | null = null;
              fn({
                eq: (pred: { field: string }, value: string) => {
                  if (pred?.field === 'id') matchValue = value;
                  return value;
                },
                field: (f: string) => ({ field: f }),
              });
              return docs.find(d => d.id === matchValue) || null;
            },
          }),
        };
      },
    },
  } as any;
}

describe('findDocByClientId (Task 64 — offline duplicate creates)', () => {
  it('finds an existing doc by custom id on an indexed table (matters)', async () => {
    const ctx = makeCtx({
      matters: [
        { id: 'matter_uuid_1', firmId: 'firm_a', title: 'A v B' },
        { id: 'matter_uuid_2', firmId: 'firm_a', title: 'C v D' },
      ],
    });
    const found = await findDocByClientId(ctx, 'matters', 'matter_uuid_2');
    expect(found?.title).toBe('C v D');
  });

  it('returns null when no document carries the client id (fresh create)', async () => {
    const ctx = makeCtx({ matters: [{ id: 'matter_uuid_1', firmId: 'firm_a' }] });
    expect(await findDocByClientId(ctx, 'matters', 'matter_uuid_new')).toBeNull();
  });

  it('uses the filtered path for non-indexed tables', async () => {
    const ctx = makeCtx({
      someOtherTable: [{ id: 'other_uuid_1', firmId: 'firm_a' }],
    });
    const found = await findDocByClientId(ctx, 'someOtherTable', 'other_uuid_1');
    expect(found?.id).toBe('other_uuid_1');
  });

  it('returns null (never throws) when the table does not exist', async () => {
    const ctx = makeCtx({});
    expect(await findDocByClientId(ctx, 'nonexistent_table', 'any_id')).toBeNull();
  });

  it('returns null for an empty table', async () => {
    const ctx = makeCtx({ matters: [] });
    expect(await findDocByClientId(ctx, 'matters', 'matter_uuid_1')).toBeNull();
  });
});
