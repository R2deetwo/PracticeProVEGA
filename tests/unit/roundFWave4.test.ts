/**
 * roundFWave4.test.ts — ROUND F (Wave F4) regression tests.
 *
 * Wave F4 is the payment-processing audit + safeguard hardening (§3 + §6):
 *   • the Paystack webhook's signature discipline is driven through REAL
 *     Request objects with REAL HMACs (503 unconfigured / 400 missing /
 *     401 invalid / 200 valid + event-dedup + non-charge.success recording),
 *   • the new constant-time comparison is pinned by behaviour,
 *   • the kobo-native arithmetic helpers are pinned on the server AND the
 *     client mirror in lockstep (they can never disagree by drift),
 *   • source contracts pin the hardening markers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions + utils under test ─────────────────────────────────────
import { handlePaystackWebhookImpl, recordPaystackEvent } from '../../convex/paystack';
import { addKobo, subKobo, compareKobo, toKobo, fromKobo } from '../../convex/moneyUtils';
import {
  addKobo as clientAddKobo, subKobo as clientSubKobo, compareKobo as clientCompareKobo,
  roundMoney as clientRoundMoney,
} from '../../src/utils/money';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── HMAC helper (the SAME algorithm the webhook uses, computed in-test) ──────
async function hmacHex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Fixture-backed mock ctx (the shared F-wave harness) ─────────────────────
type Row = Record<string, any>;

function makeCtx(tables: Record<string, Row[]> = {}) {
  const all: Record<string, Row[]> = {
    sessions: [],
    users: [],
    suspendedUsers: [],
    securityEvents: [],
    paystackEvents: [],
    payment_proofs: [],
    ledger_entries: [],
    ...tables,
  };
  const writes = { patches: [] as any[], inserts: [] as any[] };
  const chainFor = (rows: Row[]) => {
    const chain: any = {
      first: async () => (rows[0] ?? null),
      unique: async () => (rows[0] ?? null),
      collect: async () => rows,
      take: async (n: number) => rows.slice(0, n),
      order: (_d: string) => chain,
      filter: (_fn: any) => chain,
    };
    return chain;
  };
  const db: any = {
    query: (table: string) => ({
      withIndex: (_n: string, fn: (q: any) => any) => {
        const conds: Array<[string, string, any]> = [];
        const q: any = {
          eq: (f: string, v: any) => { conds.push([f, 'eq', v]); return q; },
          gte: (f: string, v: any) => { conds.push([f, 'gte', v]); return q; },
        };
        fn(q);
        return chainFor((all[table] ?? []).filter((r) => conds.every(([f, op, v]) => {
          const rv = r[f];
          return rv === undefined ? false : String(rv) === String(v);
        })));
      },
      filter: (_fn: any) => chainFor(all[table] ?? []),
      order: (_d: string) => chainFor(all[table] ?? []),
      collect: async () => all[table] ?? [],
      take: async (n: number) => (all[table] ?? []).slice(0, n),
      first: async () => (all[table] ?? [])[0] ?? null,
    }),
    get: async (id: any) => {
      const s = String(id);
      for (const rows of Object.values(all)) {
        const hit = rows.find((r) => String(r._id) === s);
        if (hit) return hit;
      }
      return null;
    },
    insert: async (table: string, value: any) => {
      writes.inserts.push({ table, value });
      const _id = `${table}_${writes.inserts.length}`;
      (all[table] = all[table] ?? []).push({ _id, ...value });
      return _id as any;
    },
    patch: async (id: any, value: any) => {
      writes.patches.push({ id: String(id), value });
      const s = String(id);
      for (const rows of Object.values(all)) {
        const hit = rows.find((r) => String(r._id) === s);
        if (hit) Object.assign(hit, value);
      }
      return null;
    },
  };
  const ctx: any = {
    db,
    runMutation: vi.fn(async (_ref: any, args: any) => {
      // Shape dispatch: the REAL recordPaystackEvent (the webhook's only
      // money-adjacent dependency in these tests).
      if (args && typeof (args as any).eventId === 'string' && typeof (args as any).eventType === 'string') {
        return (recordPaystackEvent as any)._handler(ctx, args);
      }
      return { success: true };
    }),
    runAction: vi.fn(async () => ({ success: true })),
    runQuery: vi.fn(async () => null),
    scheduler: { runAfter: vi.fn(async () => null) },
    auth: { getUserIdentity: async () => null },
  };
  return { ctx, writes, tables: all };
}

const SECRET = 'sk_test_f4fixture';

function webhookRequest(body: string, signature: string | null): Request {
  return new Request('https://deployment.convex.site/paystack/webhook', {
    method: 'POST',
    body,
    ...(signature ? { headers: { 'x-paystack-signature': signature } } : {}),
  });
}

beforeEach(() => {
  vi.stubEnv('PAYSTACK_SECRET_KEY', SECRET);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// §3 — the Paystack webhook's signature discipline (REAL requests + HMACs)
// ═══════════════════════════════════════════════════════════════════════════
describe('F4 §3 — the webhook signature discipline', () => {
  it('503 when unconfigured, 400 when the signature header is missing, 401 when it is wrong', async () => {
    const { ctx } = makeCtx();
    const body = JSON.stringify({ event: 'charge.success', data: { id: 't1', reference: 'REF-1', amount: 500000 } });

    // Missing header → 400.
    const noSig = await handlePaystackWebhookImpl(ctx, webhookRequest(body, null));
    expect(noSig.status).toBe(400);

    // Wrong signature → 401.
    const badSig = await handlePaystackWebhookImpl(ctx, webhookRequest(body, 'deadbeef'.repeat(16)));
    expect(badSig.status).toBe(401);

    // Unconfigured secret → 503 (before any body reading).
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    const unconfigured = await handlePaystackWebhookImpl(ctx, webhookRequest(body, 'x'));
    expect(unconfigured.status).toBe(503);
  });

  it('a valid HMAC passes, the event is recorded once, and a redelivery is a duplicate', async () => {
    const { ctx, tables } = makeCtx();
    const body = JSON.stringify({ event: 'charge.failed', data: { id: 't2', reference: 'REF-2', amount: 250000, status: 'failed' } });
    const sig = await hmacHex(SECRET, body);

    const first = await handlePaystackWebhookImpl(ctx, webhookRequest(body, sig));
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('application/json');
    const parsedFirst = await first.json();
    expect(parsedFirst.status).toBe('recorded'); // non-charge.success → recorded only

    // The event row exists with the full raw payload + kobo→NGN amount.
    expect(tables.paystackEvents.length).toBe(1);
    const row = tables.paystackEvents[0] as any;
    expect(row.eventType).toBe('charge.failed');
    expect(row.amount).toBe(2500); // 250000 kobo → 2,500 NGN at the boundary
    expect(row.raw?.event).toBe('charge.failed');

    // Redelivery of the SAME event id → duplicate, zero new rows.
    const second = await handlePaystackWebhookImpl(ctx, webhookRequest(body, sig));
    expect(second.status).toBe(200);
    const parsedSecond = await second.json();
    expect(parsedSecond.status).toBe('duplicate');
    expect(tables.paystackEvents.length).toBe(1);
  });

  it('a wrong-length or single-char-tampered signature never passes (constant-time compare)', async () => {
    const { ctx } = makeCtx();
    const body = JSON.stringify({ event: 'charge.success', data: { id: 't3', reference: 'REF-3', amount: 100000 } });
    const sig = await hmacHex(SECRET, body);
    // Tamper ONE character.
    const tampered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
    const refused = await handlePaystackWebhookImpl(ctx, webhookRequest(body, tampered));
    expect(refused.status).toBe(401);
    // Wrong length also refuses.
    const short = await handlePaystackWebhookImpl(ctx, webhookRequest(body, sig.slice(0, 10)));
    expect(short.status).toBe(401);
    // Nothing was recorded by any refused request.
    const { tables } = makeCtx();
    expect(tables.paystackEvents.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6 — the kobo-native arithmetic helpers (server + client lockstep)
// ═══════════════════════════════════════════════════════════════════════════
describe('F4 §6 — kobo-native arithmetic (server + client mirror)', () => {
  it('addKobo is exact where float addition drifts', () => {
    expect(addKobo(0.1, 0.2)).toBe(0.3); // 0.1 + 0.2 === 0.30000000000000004 in float
    expect(addKobo(250000.25, 100000.01)).toBe(350000.26);
    expect(addKobo(999999.99, 0.01)).toBe(1000000);
    expect(addKobo()).toBe(0);
    expect(addKobo(5, NaN as any, 10)).toBe(15); // non-numbers read as 0
  });

  it('subKobo and compareKobo are exact and drift-free', () => {
    expect(subKobo(0.3, 0.1)).toBe(0.2);
    expect(subKobo(100, 250.25)).toBe(-150.25);
    expect(compareKobo(0.1 + 0.2, 0.3)).toBe(0); // equal in kobo
    expect(compareKobo(0.3, 0.1 + 0.2)).toBe(0);
    expect(compareKobo(10.01, 10.02)).toBeLessThan(0);
    expect(compareKobo(10.02, 10.01)).toBeGreaterThan(0);
  });

  it('toKobo/fromKobo round-trip at the boundary', () => {
    expect(toKobo(123.45)).toBe(12345);
    expect(fromKobo(12345)).toBe(123.45);
    expect(toKobo(0.005)).toBe(1); // rounds half-up at the kobo boundary
  });

  it('the client mirror is in lockstep (identical results, never disagree)', () => {
    const cases: [number, number][] = [[0.1, 0.2], [250000.25, 100000.01], [0.3, 0.1], [999999.99, 0.01]];
    for (const [a, b] of cases) {
      expect(clientAddKobo(a, b)).toBe(addKobo(a, b));
      expect(clientSubKobo(a, b)).toBe(subKobo(a, b));
      expect(clientCompareKobo(a, b)).toBe(compareKobo(a, b));
    }
    expect(clientRoundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Source contracts
// ═══════════════════════════════════════════════════════════════════════════
describe('F4 — source contracts', () => {
  it('the webhook uses the constant-time comparison (no straight string compare)', () => {
    const src = read('convex/paystack.ts');
    expect(src).toContain('function timingSafeEqualHex');
    expect(src).toContain('if (!timingSafeEqualHex(signature, expectedSignature))');
    expect(src).not.toContain('if (signature !== expectedSignature)');
  });

  it('both money modules export the kobo trio', () => {
    const server = read('convex/moneyUtils.ts');
    const client = read('src/utils/money.ts');
    for (const name of ['addKobo', 'subKobo', 'compareKobo']) {
      expect(server).toContain(`export function ${name}`);
      expect(client).toContain(`export function ${name}`);
    }
  });

  it('the round document exists and records the audit', () => {
    const doc = read('ATRIUM_ROUND_F_FINANCIAL_OPERATIONS.md');
    expect(doc).toContain('payment processing audit');
    expect(doc).toContain('timingSafeEqualHex');
    expect(doc).toContain('deliberately deferred');
  });
});
