/**
 * roundASecurity.test.ts — ROUND A (Wave S1) security regression tests.
 *
 * Every vulnerability in the Round A register (C1–C8, H15/H17/H18/H19) is
 * pinned here with BOTH directions, per the round's acceptance gates:
 *   • an UNAUTHENTICATED / unauthorized call throws (the endpoint sweep),
 *   • the legitimate authenticated workflow still succeeds.
 *
 * Two testing styles, both established in this suite:
 *   1. BEHAVIORAL — execute the Convex handlers via `_handler(ctx, args)`
 *      with a fixture-backed mock ctx (the pushNotifications.test.ts
 *      pattern: sessions table, users table, captured writes).
 *   2. SOURCE-CONTRACT — assert on module source for httpAction routes
 *      and call-site wiring that cannot be imported directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

// ── Convex functions under test (behavioral) ───────────────────────────────
import { fundWallet, initiateWalletFunding, verifyWalletFunding } from '../../convex/wallets';
import { submitPaymentProof, updatePaymentProofStatus, getTenantLedger, getPaymentProofsByTenant, getActiveNotices, getFirmPortalSettings, getMaintenanceTicketsByFirm, getScheduledMessagesByFirm, getPaymentProofsByFirm, createMaintenanceTicket, cancelMaintenanceTicket, sendPortalMessage, sendAdminReply, markInboundMessagesReadByTenant, markConversationReadByParticipant, ensurePortalAccessToken, updateMaintenanceTicketStatus, getMaintenanceTicketsByTenant, getInboundMessagesByTenant } from '../../convex/portals';
import { sendEmail as sendEmailPublic, sendWhatsApp as sendWhatsAppPublic } from '../../convex/communications';
import { getAmenities, cancelBooking } from '../../convex/estateCommunity';
import { verifyToken, checkInVisitor, getGatekeeperProperties, getGatehouseLogs } from '../../convex/visitorManagement';
import { seedDemo } from '../../convex/seedSentry';
import { hashSessionToken } from '../../convex/sessions';
import {
  stripSignaturePrefix,
  timingSafeEqualStr,
  computeChakraSignature,
  verifyChakraWebhookRequest,
} from '../../convex/sentryWebhook';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ── Fixture-backed mock ctx ────────────────────────────────────────────────
type Row = Record<string, any>;

interface Fixtures {
  session?: { token: string; userId: string };
  user?: Row;                 // the caller's users row (_id must equal session.userId)
  users?: Row[];              // additional user rows
  tables?: Record<string, Row[]>;
}

function makeCtx(fix: Fixtures = {}, overrides: Record<string, any> = {}) {
  const callerUser = fix.user ?? null;
  const sessionRow = fix.session
    ? [{
        tokenHash: hashSessionToken(fix.session.token),
        userId: fix.session.userId,
        userEmail: 'fixture',
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      }]
    : [];
  const tables: Record<string, Row[]> = {
    sessions: sessionRow,
    users: [...(callerUser ? [callerUser] : []), ...(fix.users ?? [])],
    suspendedUsers: [],
    securityEvents: [],
    rateLimits: [],
    ...(fix.tables ?? {}),
  };
  const writes = { patches: [] as any[], inserts: [] as any[], deletes: [] as any[] };
  const runMutationCalls: any[] = [];
  const runActionCalls: any[] = [];

  const findRows = (table: string, conds: Array<[string, any]>) =>
    (tables[table] ?? []).filter((r) => conds.every(([f, v]) => String(r[f]) === String(v)));

  const chainFor = (rows: Row[]) => {
    const chain: any = {
      first: async () => (rows[0] ?? null),
      unique: async () => (rows[0] ?? null),
      collect: async () => rows,
      take: async (n: number) => rows.slice(0, n),
      order: (_dir: string) => chain,
      filter: (_fn: any) => chain, // permissive: predicates evaluated against full set
    };
    return chain;
  };

  const db: any = {
    query: (table: string) => ({
      withIndex: (_name: string, fn: (q: any) => any) => {
        const conds: Array<[string, any]> = [];
        const q: any = {
          eq: (field: string, value: any) => { conds.push([field, value]); return q; },
          lt: (field: string, value: any) => { conds.push([field, value]); return q; },
          lte: (field: string, value: any) => { conds.push([field, value]); return q; },
          gte: (field: string, value: any) => { conds.push([field, value]); return q; },
          gt: (field: string, value: any) => { conds.push([field, value]); return q; },
          neq: (field: string, value: any) => { conds.push([field, value]); return q; },
        };
        fn(q);
        return chainFor(findRows(table, conds));
      },
      withIndexName: undefined,
      filter: (_fn: any) => chainFor(tables[table] ?? []),
      order: (_dir: string) => chainFor(tables[table] ?? []),
      collect: async () => (tables[table] ?? []),
      take: async (n: number) => (tables[table] ?? []).slice(0, n),
      first: async () => (tables[table] ?? [])[0] ?? null,
    }),
    get: async (id: any) => {
      const idStr = String(id);
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === idStr);
        if (hit) return hit;
      }
      return null;
    },
    insert: async (table: string, value: any) => {
      writes.inserts.push({ table, value });
      const _id = `${table}_${writes.inserts.length}`;
      (tables[table] = tables[table] ?? []).push({ _id, ...value });
      return _id as any;
    },
    patch: async (id: any, value: any) => {
      writes.patches.push({ id: String(id), value });
      const idStr = String(id);
      for (const rows of Object.values(tables)) {
        const hit = rows.find((r) => String(r._id) === idStr);
        if (hit) Object.assign(hit, value);
      }
      return null;
    },
    delete: async (id: any) => {
      writes.deletes.push(String(id));
      return null;
    },
  };

  const ctx: any = {
    db,
    runMutation: vi.fn(async (_ref: any, args: any) => {
      runMutationCalls.push({ ref: _ref, args });
      // Shape-based dispatch (FunctionReferences cannot be String()-ed).
      if (args && typeof args.key === 'string' && typeof args.maxRequests === 'number') {
        return true; // internal.securityHelpers.consumeRateLimit → allowed by default
      }
      if (args && 'paystackReference' in (args ?? {})) {
        return (fundWallet as any)._handler(ctx, args); // internal.wallets.fundWallet
      }
      if (args && 'propertyId' in (args ?? {}) && 'tenantId' in (args ?? {}) && !('amount' in (args ?? {}))) {
        // internal.wallets.getOrCreateWallet — minimal get-or-create.
        const existing = (tables.resident_wallets ?? []).find((w) => String(w.tenantId) === String(args.tenantId));
        if (existing) return existing;
        const _id = 'wallet_1';
        tables.resident_wallets = [{ _id, tenantId: args.tenantId, firmId: args.firmId, propertyId: args.propertyId, balance: 0, currency: 'NGN', autoDeductEnabled: false, status: 'active', lowBalanceThreshold: 1000, createdAt: Date.now(), updatedAt: Date.now() }];
        return tables.resident_wallets[0];
      }
      return { success: true };
    }),
    runAction: vi.fn(async (_ref: any, args: any) => {
      runActionCalls.push({ ref: _ref, args });
      return { success: true };
    }),
    runQuery: vi.fn(async () => null),
    scheduler: { runAfter: vi.fn(async () => null) },
    auth: { getUserIdentity: async () => null },
    ...overrides,
  };
  return { ctx, writes, runMutationCalls, runActionCalls, tables };
}

// Standard callers used across the suite.
const TENANT = { _id: 'u-tenant-1', email: 'tenant@example.com', tokenIdentifier: 'tenant@example.com', name: 'Tayo Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-abc', userId: 'u-tenant-1' };
const OTHER_TENANT = { _id: 'u-tenant-2', email: 'other@example.com', tokenIdentifier: 'other@example.com', name: 'Ope Other', role: 'Tenant', firmId: 'firm-1' };
const ADMIN = { _id: 'u-admin-1', email: 'admin@example.com', tokenIdentifier: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const FOUNDER = { _id: 'u-founder-1', email: 'founder@example.com', tokenIdentifier: 'founder@example.com', name: 'Fola Founder', role: 'Founder', firmId: 'firm-1' };
const FOUNDER_SESSION = { token: 'tok-founder-1', userId: 'u-founder-1' };

let ENV_BACKUP: Record<string, string | undefined>;
beforeEach(() => {
  ENV_BACKUP = {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_ENABLED: process.env.PAYSTACK_ENABLED,
    ALLOW_DEMO_SEED: (process.env as any).ALLOW_DEMO_SEED,
    CHAKRA_WEBHOOK_SECRET: process.env.CHAKRA_WEBHOOK_SECRET,
  };
});
afterEach(() => {
  for (const [k, v] of Object.entries(ENV_BACKUP)) {
    if (v === undefined) delete (process.env as any)[k];
    else (process.env as any)[k] = v;
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════════════════════════════════════════
// C1 — Paystack wallet top-up replay
// ═══════════════════════════════════════════════════════════════════════════
describe('C1 — wallet top-up replay + unauthenticated funding', () => {
  it('fundWallet is a no-op when the Paystack reference was already credited (replay)', async () => {
    const { ctx, writes } = makeCtx({
      tables: {
        wallet_transactions: [{
          _id: 'wtx_1', walletId: 'wallet_1', tenantId: 'u-tenant-1', firmId: 'firm-1',
          type: 'credit', amount: 5000, previousBalance: 0, newBalance: 5000,
          reference: 'TXN-1', paystackReference: 'WALLET-REF-1', timestamp: Date.now(),
        }],
      },
    });
    const result: any = await (fundWallet as any)._handler(ctx, {
      tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1',
      amount: 5000, paystackReference: 'WALLET-REF-1',
    });
    // Replay returns success with the ALREADY-RECORDED balance — and writes nothing.
    expect(result.success).toBe(true);
    expect(result.alreadyCredited).toBe(true);
    expect(result.newBalance).toBe(5000);
    expect(writes.patches.length).toBe(0);
    expect(writes.inserts.length).toBe(0);
  });

  it('fundWallet credits exactly once for a fresh reference (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({
      tables: { wallet_transactions: [], resident_wallets: [{ _id: 'wallet_1', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', balance: 1000, currency: 'NGN', lowBalanceThreshold: 1000 }] },
    });
    const result: any = await (fundWallet as any)._handler(ctx, {
      tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1',
      amount: 5000, paystackReference: 'WALLET-REF-NEW',
    });
    expect(result.success).toBe(true);
    expect(result.alreadyCredited).toBeUndefined();
    expect(result.newBalance).toBe(6000);
    expect(writes.patches.some((p: any) => p.value.balance === 6000)).toBe(true);
    expect(writes.inserts.some((i: any) => i.table === 'wallet_transactions' && i.value.paystackReference === 'WALLET-REF-NEW')).toBe(true);
  });

  it('verifyWalletFunding rejects unauthenticated callers', async () => {
    const { ctx } = makeCtx();
    (process.env as any).PAYSTACK_SECRET_KEY = 'sk_test_x';
    await expect(
      (verifyWalletFunding as any)._handler(ctx, { reference: 'R', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1' })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('verifyWalletFunding binds the credit to PAYSTACK METADATA, not caller-supplied ids', async () => {
    (process.env as any).PAYSTACK_SECRET_KEY = 'sk_test_x';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: true,
        data: {
          status: 'success',
          amount: 500000, // kobo → ₦5,000
          metadata: { type: 'wallet_funding', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', amount: 5000 },
        },
      }),
    }) as any));
    const { ctx, runMutationCalls } = makeCtx({ session: TENANT_SESSION, user: TENANT });
    // The attacker-supplied tenantId/firmId point at ANOTHER resident — the
    // server must ignore them and fund the metadata-bound wallet instead.
    const result: any = await (verifyWalletFunding as any)._handler(ctx, {
      reference: 'WALLET-REF-2',
      tenantId: 'u-tenant-2', firmId: 'firm-9', propertyId: 'evil',
      sessionToken: 'tok-tenant-abc',
    });
    expect(result.success).toBe(true);
    const fundCall = runMutationCalls.find((c: any) => 'paystackReference' in c.args && c.args.paystackReference === 'WALLET-REF-2');
    expect(fundCall).toBeTruthy();
    expect(fundCall.args.tenantId).toBe('u-tenant-1'); // metadata-bound, not caller-supplied
    expect(fundCall.args.firmId).toBe('firm-1');
    expect(fundCall.args.amount).toBe(5000);
    expect(fundCall.args.paystackReference).toBe('WALLET-REF-2');
  });

  it('verifyWalletFunding refuses a reference belonging to a DIFFERENT resident', async () => {
    (process.env as any).PAYSTACK_SECRET_KEY = 'sk_test_x';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: true,
        data: {
          status: 'success',
          amount: 500000,
          // metadata says the top-up belongs to u-tenant-2; the caller is u-tenant-1.
          metadata: { type: 'wallet_funding', tenantId: 'u-tenant-2', firmId: 'firm-1', propertyId: 'p1', amount: 5000 },
        },
      }),
    }) as any));
    const { ctx, runMutationCalls } = makeCtx({ session: TENANT_SESSION, user: TENANT });
    const result: any = await (verifyWalletFunding as any)._handler(ctx, {
      reference: 'WALLET-REF-3', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1',
      sessionToken: 'tok-tenant-abc',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/different resident/);
    expect(runMutationCalls.some((c: any) => 'paystackReference' in c.args)).toBe(false);
  });

  it('verifyWalletFunding refuses a non-wallet_funding transaction type', async () => {
    (process.env as any).PAYSTACK_SECRET_KEY = 'sk_test_x';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: true, data: { status: 'success', amount: 500000, metadata: { type: 'something_else', tenantId: 'u-tenant-1' } } }),
    }) as any));
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT });
    const result: any = await (verifyWalletFunding as any)._handler(ctx, { reference: 'R4', tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', sessionToken: 'tok-tenant-abc' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not initiated as a wallet top-up/);
  });

  it('initiateWalletFunding rejects unauthenticated callers', async () => {
    (process.env as any).PAYSTACK_SECRET_KEY = 'sk_test_x';
    (process.env as any).PAYSTACK_ENABLED = 'true';
    (process.env as any).SITE_URL = 'https://app.example';
    const { ctx } = makeCtx();
    await expect(
      (initiateWalletFunding as any)._handler(ctx, { tenantId: 'u-tenant-1', firmId: 'firm-1', propertyId: 'p1', amount: 5000, email: 'tenant@example.com' })
    ).rejects.toThrow(/Unauthenticated/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C2 — unauthenticated tenant-data reads
// ═══════════════════════════════════════════════════════════════════════════
describe('C2 — tenant-data reads require a session', () => {
  const unauthCases: Array<[string, any, any]> = [
    ['getTenantLedger', getTenantLedger, { firmId: 'firm-1', tenantId: 'u-tenant-1', email: 'tenant@example.com' }],
    ['getPaymentProofsByTenant', getPaymentProofsByTenant, { tenantId: 'u-tenant-1' }],
    ['getActiveNotices', getActiveNotices, { firmId: 'firm-1' }],
    ['getFirmPortalSettings', getFirmPortalSettings, { firmId: 'firm-1' }],
    ['getMaintenanceTicketsByFirm (staff read)', getMaintenanceTicketsByFirm, { firmId: 'firm-1' }],
    ['getScheduledMessagesByFirm (staff read)', getScheduledMessagesByFirm, { firmId: 'firm-1' }],
    ['getPaymentProofsByFirm (staff read)', getPaymentProofsByFirm, { firmId: 'firm-1' }],
    ['getMaintenanceTicketsByTenant', getMaintenanceTicketsByTenant, { tenantId: 'u-tenant-1' }],
    ['getInboundMessagesByTenant', getInboundMessagesByTenant, { tenantId: 'u-tenant-1' }],
    ['ensurePortalAccessToken (user-record write)', ensurePortalAccessToken, { email: 'tenant@example.com' }],
    ['updateMaintenanceTicketStatus (C4)', updateMaintenanceTicketStatus, { ticketId: 't1', status: 'in_progress' }],
  ];
  for (const [name, fn, args] of unauthCases) {
    it(`${name}: no session → throws (was a silent read/write before Round A)`, async () => {
      const { ctx } = makeCtx();
      await expect((fn as any)._handler(ctx, { ...args })).rejects.toThrow(/Unauthenticated|verified session/);
    });
  }

  it('getTenantLedger succeeds for the signed-in resident (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { properties: [] } });
    const rows = await (getTenantLedger as any)._handler(ctx, {
      firmId: 'firm-1', tenantId: 'u-tenant-1', email: 'tenant@example.com',
      sessionToken: 'tok-tenant-abc',
    });
    expect(Array.isArray(rows)).toBe(true);
  });

  it('getTenantLedger throws when the session is for a different firm (cross-firm read)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: { ...TENANT, firmId: 'firm-1' }, tables: { properties: [] } });
    await expect(
      (getTenantLedger as any)._handler(ctx, { firmId: 'firm-2', tenantId: 'u-tenant-1', email: 'tenant@example.com', sessionToken: 'tok-tenant-abc' })
    ).rejects.toThrow(/different firm/);
  });

  it('getPaymentProofsByTenant rejects a tenantId belonging to someone else (cross-tenant binding)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { payment_proofs: [] } });
    await expect(
      (getPaymentProofsByTenant as any)._handler(ctx, { tenantId: 'u-tenant-2', sessionToken: 'tok-tenant-abc' })
    ).rejects.toThrow(/only view your own payment proofs/);
  });

  it('getPaymentProofsByFirm accepts a staff session of the same firm (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { payment_proofs: [] } });
    const rows = await (getPaymentProofsByFirm as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(Array.isArray(rows)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C3 — forgeable portal writes / message impersonation
// ═══════════════════════════════════════════════════════════════════════════
describe('C3 — forged tickets, impersonated messages, forged cancels', () => {
  it('createMaintenanceTicket rejects forged submitter identities', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT });
    await expect(
      (createMaintenanceTicket as any)._handler(ctx, {
        firmId: 'firm-1', propertyId: 'p1', tenantId: 'u-tenant-2', tenantName: 'FAKE NAME',
        subject: 'Leak', description: 'd', category: 'plumbing', sessionToken: 'tok-tenant-abc',
      })
    ).rejects.toThrow(/filed by the signed-in resident/);
  });

  it('sendPortalMessage rejects an admin-impersonation attempt by a Tenant session', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT });
    await expect(
      (sendPortalMessage as any)._handler(ctx, {
        firmId: 'firm-1', senderId: 'u-tenant-1', senderRole: 'admin', senderName: 'Property Manager',
        content: 'Your payment is confirmed.', sessionToken: 'tok-tenant-abc',
      })
    ).rejects.toThrow(/Portal users do not have access/);
  });

  it('sendPortalMessage rejects a staff senderId that is not the caller (admin impersonation by staff)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN });
    await expect(
      (sendPortalMessage as any)._handler(ctx, {
        firmId: 'firm-1', senderId: 'u-admin-2', senderRole: 'admin', senderName: 'Other Admin',
        content: 'Your payment is confirmed.', sessionToken: 'tok-admin-xyz',
      })
    ).rejects.toThrow(/sent by the signed-in staff member/);
  });

  it('sendAdminReply binds adminId to the session (mismatch throws)', async () => {
    const { ctx } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: { portal_conversations: [{ _id: 'conv1', firmId: 'firm-1', participantId: 'u-tenant-1', unreadByParticipant: 1 }] },
    });
    await expect(
      (sendAdminReply as any)._handler(ctx, {
        conversationId: 'conv1', firmId: 'firm-1', adminId: 'u-admin-2', content: 'hi',
        sessionToken: 'tok-admin-xyz',
      })
    ).rejects.toThrow(/sent by the signed-in staff member/);
  });

  it('sendAdminReply without a session throws', async () => {
    const { ctx } = makeCtx({
      tables: { portal_conversations: [{ _id: 'conv1', firmId: 'firm-1', participantId: 'u-tenant-1' }] },
    });
    await expect(
      (sendAdminReply as any)._handler(ctx, { conversationId: 'conv1', firmId: 'firm-1', adminId: 'u-admin-1', content: 'hi' })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('cancelMaintenanceTicket rejects a forged cancelledBy', async () => {
    const { ctx } = makeCtx({
      session: TENANT_SESSION, user: TENANT,
      tables: { maintenance_tickets: [{ _id: 't1', firmId: 'firm-1', tenantId: 'u-tenant-2', subject: 'x' }] },
    });
    await expect(
      (cancelMaintenanceTicket as any)._handler(ctx, {
        ticketId: 't1', cancellationNote: 'n', cancelledBy: 'u-tenant-2', sessionToken: 'tok-tenant-abc',
      })
    ).rejects.toThrow(/cancel your own/);
  });

  it('markInboundMessagesReadByTenant rejects another tenant’s id', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { atrium_inbound_messages: [] } });
    await expect(
      (markInboundMessagesReadByTenant as any)._handler(ctx, { tenantId: 'u-tenant-2', sessionToken: 'tok-tenant-abc' })
    ).rejects.toThrow(/mark your own messages/);
  });

  it('markConversationReadByParticipant binds the conversation to the caller (participant check)', async () => {
    const { ctx } = makeCtx({
      session: TENANT_SESSION, user: TENANT,
      tables: { portal_conversations: [{ _id: 'conv1', firmId: 'firm-1', participantId: 'u-tenant-2', unreadByParticipant: 3 }] },
    });
    await expect(
      (markConversationReadByParticipant as any)._handler(ctx, { conversationId: 'conv1', sessionToken: 'tok-tenant-abc' })
    ).rejects.toThrow(/mark your own conversations/);
  });

  it('ensurePortalAccessToken mints only for the CALLER (a foreign email is rebound)', async () => {
    const victim = { _id: 'u-victim-9', email: 'victim@example.com', tokenIdentifier: 'victim@example.com', name: 'Vic', role: 'Tenant', firmId: 'firm-1' };
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, users: [victim] });
    const res: any = await (ensurePortalAccessToken as any)._handler(ctx, {
      email: 'victim@example.com', sessionToken: 'tok-tenant-abc',
    });
    // A token WAS minted — for the CALLER's own row, never the victim's.
    expect(typeof res).toBe('string');
    expect(writes.patches.some((p: any) => p.id === 'u-tenant-1' && p.value.portalAccessToken === res)).toBe(true);
    expect(writes.patches.some((p: any) => p.id === 'u-victim-9')).toBe(false);
    expect(victim.portalAccessToken).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C4 — conditional-auth anti-pattern (staff approval flows)
// ═══════════════════════════════════════════════════════════════════════════
describe('C4 — proof/ticket status updates need unconditional staff auth', () => {
  it('updatePaymentProofStatus without identity throws (was: anonymous sails through)', async () => {
    const { ctx } = makeCtx({ tables: { payment_proofs: [{ _id: 'proof1', firmId: 'firm-1', status: 'pending_review' }] } });
    await expect(
      (updatePaymentProofStatus as any)._handler(ctx, { proofId: 'proof1', status: 'approved' })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('updatePaymentProofStatus with a matching staff session succeeds (the in-app approve flow)', async () => {
    // ROUND B (H1) note: approval now BOOKS the money — the proof fixture
    // carries an amount so the settlement core has a figure to book (an
    // amount-less approval requires confirmedAmount; pinned in
    // roundBMoneyTruth.test.ts).
    const { ctx, writes } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: { payment_proofs: [{ _id: 'proof1', firmId: 'firm-1', status: 'pending_review', tenantId: 'u-tenant-1', amount: 250000, unitId: 'u1' }] },
    });
    await (updatePaymentProofStatus as any)._handler(ctx, {
      proofId: 'proof1', status: 'approved', adminNote: 'ok', sessionToken: 'tok-admin-xyz',
    });
    expect(writes.patches.some((p: any) => p.id === 'proof1' && p.value.status === 'approved')).toBe(true);
  });

  it('updatePaymentProofStatus throws for a staff session of a different firm (cross-firm proof)', async () => {
    const { ctx } = makeCtx({
      session: ADMIN_SESSION, user: { ...ADMIN, firmId: 'firm-2' },
      tables: { payment_proofs: [{ _id: 'proof1', firmId: 'firm-1', status: 'pending_review' }] },
    });
    await expect(
      (updatePaymentProofStatus as any)._handler(ctx, { proofId: 'proof1', status: 'approved', sessionToken: 'tok-admin-xyz' })
    ).rejects.toThrow(/different firm/);
  });

  it('updateMaintenanceTicketStatus with a staff session patches the ticket (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: { maintenance_tickets: [{ _id: 't1', firmId: 'firm-1', status: 'open' }] },
    });
    await (updateMaintenanceTicketStatus as any)._handler(ctx, {
      ticketId: 't1', status: 'in_progress', sessionToken: 'tok-admin-xyz',
    });
    expect(writes.patches.some((p: any) => p.id === 't1' && p.value.status === 'in_progress')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H19 — payment-proof status is server-derived on submit
// ═══════════════════════════════════════════════════════════════════════════
describe('H19 — proof submit status is server-derived', () => {
  it('a tenant cannot submit a proof pre-marked approved', async () => {
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { payment_proofs: [] } });
    const id = await (submitPaymentProof as any)._handler(ctx, {
      firmId: 'firm-1', tenantId: 'u-tenant-1', tenantName: 'Tayo', tenantEmail: 'tenant@example.com',
      storageIds: ['s1'], status: 'approved', paymentMethod: 'bank_transfer',
      sessionToken: 'tok-tenant-abc',
    });
    expect(id).toBeTruthy();
    const inserted = writes.inserts.find((i: any) => i.table === 'payment_proofs');
    expect(inserted.value.status).toBe('pending_review'); // caller-supplied 'approved' IGNORED
  });

  it('paystack-method proofs enter as pending_verification, also server-derived', async () => {
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { payment_proofs: [] } });
    await (submitPaymentProof as any)._handler(ctx, {
      firmId: 'firm-1', tenantId: 'u-tenant-1', storageIds: ['s1'],
      paymentMethod: 'paystack', paystackReference: 'PR-1', status: 'approved',
      sessionToken: 'tok-tenant-abc',
    });
    const inserted = writes.inserts.find((i: any) => i.table === 'payment_proofs');
    expect(inserted.value.status).toBe('pending_verification');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C5 — estate community cross-firm IDOR
// ═══════════════════════════════════════════════════════════════════════════
describe('C5 — estate community firm binding', () => {
  it('getAmenities throws when args.firmId is another firm (cross-firm IDOR)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN });
    await expect(
      (getAmenities as any)._handler(ctx, { firmId: 'firm-2', sessionToken: 'tok-admin-xyz' })
    ).rejects.toThrow(/different firm/);
  });

  it('getAmenities succeeds for the caller’s own firm (legit workflow)', async () => {
    const { ctx } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: {
        firms: [{ id: 'firm-1', subscriptionPlan: 'Pro', name: 'Atrium Mgmt' }],
        estate_amenities: [{ _id: 'a1', firmId: 'firm-1', name: 'Gym', isActive: true }],
      },
    });
    const rows = await (getAmenities as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe('Gym');
  });

  it('cancelBooking: an Admin of firm A can no longer cancel firm B’s booking', async () => {
    const { ctx, writes } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN, // Admin of firm-1
      tables: {
        estate_amenity_bookings: [{ _id: 'bk1', firmId: 'firm-2', residentUserId: 'u-tenant-9', status: 'approved' }],
      },
    });
    await expect(
      (cancelBooking as any)._handler(ctx, { bookingId: 'bk1', sessionToken: 'tok-admin-xyz' })
    ).rejects.toThrow(/different firm/);
    expect(writes.patches.length).toBe(0);
  });

  it('cancelBooking: the resident-side caller can cancel their own booking (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN, // requireFirmUser blocks Tenant roles pre-Round-C
      tables: {
        firms: [{ id: 'firm-1', subscriptionPlan: 'Pro' }],
        estate_amenity_bookings: [{ _id: 'bk1', firmId: 'firm-1', residentUserId: 'u-admin-1', status: 'approved' }],
      },
    });
    await (cancelBooking as any)._handler(ctx, { bookingId: 'bk1', sessionToken: 'tok-admin-xyz' });
    expect(writes.patches.some((p: any) => p.id === 'bk1' && p.value.status === 'cancelled')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C6 — public send primitives (spam relay)
// ═══════════════════════════════════════════════════════════════════════════
describe('C6 — communications senders are gated', () => {
  it('public sendEmail without a session throws (open relay closed)', async () => {
    const { ctx } = makeCtx();
    await expect(
      (sendEmailPublic as any)._handler(ctx, { to: 'victim@example.com', subject: 'S', htmlContent: '<p>x</p>', firmId: 'firm-1' })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('public sendWhatsApp without a session throws', async () => {
    const { ctx } = makeCtx();
    await expect(
      (sendWhatsAppPublic as any)._handler(ctx, { to: '+2348000000000', messageText: 'spam', firmId: 'firm-1' })
    ).rejects.toThrow(/Unauthenticated/);
  });

  it('public sendEmail with a session + matching firm delegates to the internal core (legit workflow)', async () => {
    const { ctx, runActionCalls, runMutationCalls } = makeCtx({ session: ADMIN_SESSION, user: ADMIN });
    const res: any = await (sendEmailPublic as any)._handler(ctx, {
      to: 'resident@example.com', subject: 'Receipt', htmlContent: '<p>r</p>', firmId: 'firm-1',
      sessionToken: 'tok-admin-xyz',
    });
    expect(res.success).toBe(true);
    expect(runMutationCalls.some((c: any) => typeof c.args?.key === 'string' && c.args.key.startsWith('comms-email:'))).toBe(true);
    const delegated = runActionCalls.find((c: any) => 'htmlContent' in (c.args ?? {}));
    expect(delegated).toBeTruthy();
    expect(delegated.args.to).toBe('resident@example.com');
    expect(delegated.args.sessionToken).toBeUndefined(); // stripped before the core
  });

  it('public sendEmail with a session of ANOTHER firm throws (quota cannot be redirected)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: { ...ADMIN, firmId: 'firm-2' } });
    await expect(
      (sendEmailPublic as any)._handler(ctx, { to: 'x@example.com', subject: 'S', htmlContent: 'x', firmId: 'firm-1', sessionToken: 'tok-admin-xyz' })
    ).rejects.toThrow(/different firm/);
  });

  it('a rate-limited caller gets an explicit error and no delegation', async () => {
    const { ctx, runActionCalls } = makeCtx({ session: ADMIN_SESSION, user: ADMIN }, {
      runMutation: vi.fn(async (_ref: any, args: any) => {
        if (typeof (args ?? {}).key === 'string') return false; // over the limit
        return { success: true };
      }),
    });
    const res: any = await (sendEmailPublic as any)._handler(ctx, {
      to: 'x@example.com', subject: 'S', htmlContent: 'x', firmId: 'firm-1', sessionToken: 'tok-admin-xyz',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Rate limit exceeded/);
    expect(runActionCalls.length).toBe(0);
  });

  it('source contract: every trusted backend caller uses the internal cores', () => {
    const comms = read('convex/communications.ts');
    const vm = read('convex/visitorManagement.ts');
    const portals = read('convex/portals.ts');
    const myfns = read('convex/myFunctions.ts');
    const feedback = read('convex/feedback.ts');
    for (const [label, src] of [['visitorManagement', vm], ['portals', portals], ['myFunctions', myfns], ['feedback', feedback], ['communications (retry dispatcher)', comms]] as const) {
      expect(src.includes('api.communications.sendEmail') || src.includes('api.communications.sendWhatsApp')).toBe(false);
    }
    expect(vm.includes('internal.communications.sendWhatsAppCore')).toBe(true);
    expect(feedback.includes('internal.communications.sendEmailCore')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C7 — Chakra webhook HMAC
// ═══════════════════════════════════════════════════════════════════════════
describe('C7 — Chakra webhook signature verification', () => {
  const SECRET = 'whsec_roundA';
  const BODY = JSON.stringify({ event: 'message', payload: { from: '2348012345678', message: { type: 'text', text: 'hi' } } });

  it('computeChakraSignature matches an independent node:crypto HMAC-SHA256', async () => {
    (process.env as any).CHAKRA_WEBHOOK_SECRET = SECRET;
    const expected = createHmac('sha256', SECRET).update(BODY).digest('hex');
    const got = await computeChakraSignature(SECRET, BODY);
    expect(got).toBe(expected);
  });

  it('stripSignaturePrefix accepts sha256= and bare hex forms', () => {
    expect(stripSignaturePrefix('sha256=abc123')).toBe('abc123');
    expect(stripSignaturePrefix('SHA256=ABC')).toBe('ABC');
    expect(stripSignaturePrefix('abc123')).toBe('abc123');
    expect(stripSignaturePrefix('  ')).toBe('');
  });

  it('timingSafeEqualStr rejects mismatches without leaking length', () => {
    expect(timingSafeEqualStr('aabb', 'aabb')).toBe(true);
    expect(timingSafeEqualStr('aabb', 'aacb')).toBe(false);
    expect(timingSafeEqualStr('short', 'much-longer-value')).toBe(false);
  });

  it('verifyChakraWebhookRequest: unset secret → 503 (fail closed, Paystack pattern)', async () => {
    delete (process.env as any).CHAKRA_WEBHOOK_SECRET;
    const req = new Request('https://convex/chakra', { method: 'POST', headers: { 'X-Chakra-Signature-256': 'aa' }, body: BODY });
    const res = await verifyChakraWebhookRequest(req, BODY);
    expect(res).toBeTruthy();
    expect(res!.status).toBe(503);
  });

  it('verifyChakraWebhookRequest: missing header → 400; garbage signature → 401', async () => {
    (process.env as any).CHAKRA_WEBHOOK_SECRET = SECRET;
    const missing = new Request('https://convex/chakra', { method: 'POST', body: BODY });
    expect((await verifyChakraWebhookRequest(missing, BODY))!.status).toBe(400);

    const garbage = new Request('https://convex/chakra', { method: 'POST', headers: { 'X-Chakra-Signature-256': 'deadbeef' }, body: BODY });
    expect((await verifyChakraWebhookRequest(garbage, BODY))!.status).toBe(401);
  });

  it('verifyChakraWebhookRequest: a valid HMAC (with sha256= prefix) passes', async () => {
    (process.env as any).CHAKRA_WEBHOOK_SECRET = SECRET;
    const sig = createHmac('sha256', SECRET).update(BODY).digest('hex');
    const req = new Request('https://convex/chakra', {
      method: 'POST',
      headers: { 'X-Chakra-Signature-256': `sha256=${sig}` },
      body: BODY,
    });
    expect(await verifyChakraWebhookRequest(req, BODY)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C8 — gatehouse: throttle + minimized responses + code-possession check-ins
// ═══════════════════════════════════════════════════════════════════════════
describe('C8 — gatehouse hardening', () => {
  const activeToken = {
    _id: 'vt1', firmId: 'firm-1', propertyId: 'prop1', propertyName: 'Ivy Estate',
    propertyAddress: '12 Hidden Address Rd', unitId: 'u1', unitName: 'B7',
    residentId: 'u-tenant-1', residentName: 'Tayo Tenant', residentPhone: '+2348099999999',
    visitorName: 'Bola Visitor', visitorPhone: '+2348011111111', tokenCode: '123456',
    status: 'active', visitDate: new Date().toISOString().split('T')[0],
    expiresAt: Date.now() + 6 * 3600 * 1000, gracePeriodMinutes: 30, createdAt: Date.now() - 1000,
  };

  function gateCtx(extraTables: Record<string, Row[]> = {}) {
    return makeCtx({
      tables: { visitor_tokens: [activeToken], ...(extraTables ?? {}) },
    });
  }

  it('verifyToken is throttled after 30 attempts per property (brute-force sweep)', async () => {
    const { ctx } = makeCtx({
      tables: {
        visitor_tokens: [activeToken],
        rateLimits: [{ _id: 'rl1', key: 'vms-verify:prop1', count: 30, windowStart: Date.now() }],
      },
    });
    const res: any = await (verifyToken as any)._handler(ctx, { tokenCode: '123456', propertyId: 'prop1' });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('rate_limited');
    expect(res.visitorName).toBeUndefined(); // no PII on throttle
  });

  it('verifyToken success response is minimized (no phone/address/internal ids)', async () => {
    const { ctx } = gateCtx();
    const res: any = await (verifyToken as any)._handler(ctx, { tokenCode: '123456', propertyId: 'prop1' });
    expect(res.valid).toBe(true);
    expect(res.visitorName).toBe('Bola Visitor');
    expect(res.estateName).toBe('Ivy Estate');
    expect((res as any).visitorPhone).toBeUndefined();
    expect((res as any).address).toBeUndefined();
    expect((res as any).tokenId).toBeUndefined();
    expect((res as any).residentPhone).toBeUndefined();
  });

  it('verifyToken failure responses carry no PII', async () => {
    const { ctx } = gateCtx({ visitor_tokens: [{ ...activeToken, status: 'revoked' }] });
    const res: any = await (verifyToken as any)._handler(ctx, { tokenCode: '123456', propertyId: 'prop1' });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('revoked');
    expect(res.visitorName).toBeUndefined();
  });

  it('checkInVisitor requires possession of the 6-digit code (bare token ids rejected)', async () => {
    const { ctx, writes } = gateCtx();
    // Wrong code → no check-in (previously any enumerable tokenId worked).
    await expect(
      (checkInVisitor as any)._handler(ctx, { tokenCode: '999999', propertyId: 'prop1' })
    ).rejects.toThrow(/Code not recognized/);
    expect(writes.patches.length).toBe(0);

    // Right code → checked in (legit workflow).
    await (checkInVisitor as any)._handler(ctx, { tokenCode: '123456', propertyId: 'prop1', gatekeeperName: 'Main Gate' });
    expect(writes.patches.some((p: any) => p.value.status === 'used' && p.value.checkedInBy === 'Main Gate')).toBe(true);
  });

  it('checkInVisitor is also throttled per property', async () => {
    const { ctx } = makeCtx({
      tables: {
        visitor_tokens: [activeToken],
        rateLimits: [{ _id: 'rl2', key: 'vms-checkin:prop1', count: 30, windowStart: Date.now() }],
      },
    });
    await expect(
      (checkInVisitor as any)._handler(ctx, { tokenCode: '123456', propertyId: 'prop1' })
    ).rejects.toThrow(/Too many check-in attempts/);
  });

  it('getGatekeeperProperties no longer returns street addresses', async () => {
    const { ctx } = makeCtx({
      tables: { properties: [{ _id: 'prop1', firmId: 'firm-1', name: 'Ivy Estate', address: '12 Hidden Address Rd' }] },
    });
    const rows = await (getGatekeeperProperties as any)._handler(ctx, { firmId: 'firm-1' });
    expect(rows[0].name).toBe('Ivy Estate');
    expect((rows[0] as any).address).toBeUndefined();
  });

  it('getGatehouseLogs keeps the minimal public board projection', async () => {
    const { ctx } = gateCtx();
    const rows: any = await (getGatehouseLogs as any)._handler(ctx, { propertyId: 'prop1' });
    expect(rows.length).toBe(1);
    expect(rows[0].visitorName).toBe('Bola Visitor');
    expect((rows[0] as any).visitorPhone).toBeUndefined();
    expect((rows[0] as any).residentPhone).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H15 — subscription approval is Founder-only
// ═══════════════════════════════════════════════════════════════════════════
describe('H15 — approveSubscriptionRequest is Founder-only', () => {
  it('an Admin session is rejected (was: Admins approved their own upgrades)', async () => {
    const { approveSubscriptionRequest } = await import('../../convex/myFunctions');
    const { ctx } = makeCtx({
      session: ADMIN_SESSION, user: ADMIN,
      tables: { subscriptionRequests: [{ _id: 'req1', firmId: 'firm-1', status: 'pending_review' }] },
    });
    await expect(
      (approveSubscriptionRequest as any)._handler(ctx, { requestId: 'req1', sessionToken: 'tok-admin-xyz' })
    ).rejects.toThrow(/Only Founders can approve/);
  });

  it('source contract: the role gate accepts Founder only (no Admin fallback)', () => {
    const src = read('convex/myFunctions.ts');
    const fnAt = src.indexOf('export const approveSubscriptionRequest');
    expect(fnAt).toBeGreaterThan(-1);
    const body = src.slice(fnAt, fnAt + 900);
    expect(body).toContain(`user?.role || ""`) ;
    expect(body).toContain(`!== 'Founder'`);
    expect(body.includes(`!== 'Founder' && user?.role !== 'Admin'`)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H17 — seedSentry environment gate + void lifecycle
// ═══════════════════════════════════════════════════════════════════════════
describe('H17 — seedSentry is env-gated and voids financial rows', () => {
  it('refuses to run without ALLOW_DEMO_SEED=true (production default)', async () => {
    delete (process.env as any).ALLOW_DEMO_SEED;
    const { ctx, writes } = makeCtx({ session: FOUNDER_SESSION, user: FOUNDER });
    await expect(
      (seedDemo as any)._handler(ctx, { sessionToken: 'tok-founder-1' })
    ).rejects.toThrow(/seedSentry is disabled/);
    expect(writes.deletes.length).toBe(0);
  });

  it('with the flag set, ledger rows are VOIDED, never hard-deleted', async () => {
    (process.env as any).ALLOW_DEMO_SEED = 'true';
    const { ctx, writes } = makeCtx({
      session: FOUNDER_SESSION, user: FOUNDER,
      tables: {
        ledger_entries: [{ _id: 'led1', firmId: 'atrium-demo-firm-id', amount: 150000, type: 'service_charge' }],
        service_charges: [{ _id: 'sc1', firmId: 'atrium-demo-firm-id', category: 'Diesel' }],
        leads_pipeline: [{ _id: 'lp1', firmId: 'atrium-demo-firm-id', stage: 'Inquiry' }],
      },
    });
    const res = await (seedDemo as any)._handler(ctx, { sessionToken: 'tok-founder-1' });
    expect(res).toMatch(/Seeded/);
    // The pre-existing ledger row was voided, NOT deleted.
    expect(writes.patches.some((p: any) => p.id === 'led1' && p.value.recordStatus === 'voided' && typeof p.value.voidedAt === 'number')).toBe(true);
    expect(writes.deletes).not.toContain('led1');
    expect(writes.deletes).toContain('sc1'); // non-financial demo rows still cleared (dev-only)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H18 — /ai/stream auth + agent-inspect gate (source contract)
// ═══════════════════════════════════════════════════════════════════════════
describe('H18 — HTTP surface', () => {
  it('/ai/stream requires a session bearer (auth + 401 path present)', () => {
    const src = read('convex/http.ts');
    const streamAt = src.indexOf('path: "/ai/stream"');
    expect(streamAt).toBeGreaterThan(-1);
    const body = src.slice(streamAt, streamAt + 1600);
    expect(body).toContain('resolveUserBySessionToken(ctx, bearer)');
    expect(body).toContain('status: 401');
    expect(body).toContain('Authorization');
  });

  it('/api/agent/inspect returns 404 when AGENT_INSPECT_SECRET is unset (inverted gate fixed)', () => {
    const src = read('convex/http.ts');
    const inspectAt = src.indexOf('path: "/api/agent/inspect"');
    expect(inspectAt).toBeGreaterThan(-1);
    const body = src.slice(inspectAt, src.indexOf('path: "/api/observability/drill"'));
    expect(body).toContain('Inspect endpoint not configured');
    expect(body).toContain('status: 404');
  });

  it('the frontend AI proxy fallback sends the session bearer', () => {
    const src = read('src/services/geminiService.ts');
    const at = src.indexOf("'/ai/stream'");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at - 200, at + 700);
    expect(body).toContain("practicepro_session_bearer");
    expect(body).toContain('Authorization');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Frontend wiring — the legit workflows pass the bearer
// ═══════════════════════════════════════════════════════════════════════════
describe('frontend bearer sweep (legit UI passes sessionToken)', () => {
  it('PaymentProofsTab approve flow passes the bearer (the previously-broken in-app path)', () => {
    const tab = read('src/components/atrium/PaymentProofsTab.tsx');
    expect(tab.includes('sessionToken: bearerToken ?? undefined')).toBe(true);
    expect(tab.includes('const { bearerToken } = useAuth();')).toBe(true);
  });

  it('MessagesView staff ticket path passes the bearer', () => {
    const mv = read('src/components/MessagesView.tsx');
    const at = mv.indexOf('await updateTicketStatus({');
    expect(at).toBeGreaterThan(-1);
    const body = mv.slice(at, at + 260);
    expect(body).toContain('sessionToken');
  });

  it('resident portal orchestrator passes the bearer to tenant queries', () => {
    const hooks = read('src/components/tenant/TenantPortal/hooks.ts');
    expect(hooks.includes('sessionToken: bearerToken ?? undefined')).toBe(true);
    const idx = read('src/components/tenant/TenantPortal/index.tsx');
    expect(idx.includes('sessionToken: bearerToken ?? undefined')).toBe(true);
  });

  it('wallet funding UI passes the bearer on initiate + verify', () => {
    const dash = read('src/components/tenant/TenantPortal/DashboardTab.tsx');
    expect(dash.includes('sessionToken: bearerToken ?? undefined')).toBe(true);
    const hooks = read('src/components/tenant/TenantPortal/hooks.ts');
    expect(hooks.includes('sessionToken: opts.sessionToken ?? undefined')).toBe(true);
  });
});
