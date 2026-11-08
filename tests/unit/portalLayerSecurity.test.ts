/**
 * portalLayerSecurity.test.ts — ROUND A2 (portal-layer remediation) security
 * regression tests.
 *
 * Scope: the 44-additional-function review from the Round A report. Every
 * previously-unauthenticated live function in the portal layer is pinned
 * with BOTH directions, per the round's acceptance gates:
 *   • an UNAUTHENTICATED / cross-firm / cross-tenant call throws,
 *   • the legitimate authenticated workflow still succeeds.
 *
 * Also pinned here:
 *   - the intentionally-public token flows (invitation accept / password
 *     setup) KEEP working without a session (regression guard against
 *     over-authentication),
 *   - the 9 deleted dead functions and the internalised getPortalInviteById
 *     are off the public surface,
 *   - the estateCommunity "false positives" (requireAdmin = strict session)
 *     stay strict.
 *
 * Testing styles follow roundASecurity.test.ts: BEHAVIORAL via `_handler`
 * with a fixture-backed mock ctx, and SOURCE-CONTRACT for wiring that
 * cannot be imported.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Convex functions under test (behavioral) ───────────────────────────────
import {
  assignTicketToTeamMember,
  getServiceRequestTypes,
  getAllServiceRequestTypes,
  createServiceRequestType,
  getClientServiceRequestsByClient,
  getMaintenanceTicketsByProperty,
  getPortalInvitesByFirm,
  getPortalInvitesByEmail,
  relinkPortalUserToProperty,
  resolveFirmFromInvite,
  getClientMessages,
  getClientActivity,
  getClientInvoices,
  getClientContactByUserId,
  getClientMattersByUserId,
  getPortalConversationsByFirm,
  getPortalConversationsByParticipant,
  getConversationMessages,
  softDeletePortalMessage,
  adminDeletePortalMessage,
  hardDeleteConversation,
  getPortalMessagesByFirm,
  replyToPortalMessage,
  archiveNotice,
  restoreNotice,
  getAllNotices,
  getNotificationPreferences,
  getPortalUserConsentRecords,
  getClientConsentRecords,
  // intentionally public token flows — imported to prove they still exist
  getInviteByToken,
  acceptPortalInviteByToken,
  verifyInviteToken,
} from '../../convex/portals';
import * as portalsModule from '../../convex/portals';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf8');

// ── Fixture-backed mock ctx (same shape as roundASecurity.test.ts) ─────────
type Row = Record<string, any>;

interface Fixtures {
  session?: { token: string; userId: string };
  user?: Row;
  users?: Row[];
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
    runMutation: vi.fn(async () => ({ success: true })),
    runAction: vi.fn(async () => ({ success: true })),
    runQuery: vi.fn(async () => null),
    scheduler: { runAfter: vi.fn(async () => null) },
    auth: { getUserIdentity: async () => null },
    ...overrides,
  };
  return { ctx, writes, tables };
}

// ── Standard callers ───────────────────────────────────────────────────────
const TENANT = { _id: 'u-tenant-1', email: 'tenant@example.com', tokenIdentifier: 'tenant@example.com', name: 'Tayo Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-abc', userId: 'u-tenant-1' };
const OTHER_TENANT = { _id: 'u-tenant-2', email: 'other@example.com', tokenIdentifier: 'other@example.com', name: 'Ope Other', role: 'Tenant', firmId: 'firm-1' };
const OTHER_TENANT_SESSION = { token: 'tok-tenant-2', userId: 'u-tenant-2' };
const CLIENT = { _id: 'u-client-1', email: 'client@example.com', tokenIdentifier: 'client@example.com', name: 'Chidi Client', role: 'Client', firmId: 'firm-1' };
const CLIENT_SESSION = { token: 'tok-client-1', userId: 'u-client-1' };
const ADMIN = { _id: 'u-admin-1', email: 'admin@example.com', tokenIdentifier: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const ADMIN2 = { _id: 'u-admin-2', email: 'admin2@example.com', tokenIdentifier: 'admin2@example.com', name: 'Bola Admin2', role: 'Admin', firmId: 'firm-2' };
const ADMIN2_SESSION = { token: 'tok-admin2-2', userId: 'u-admin-2' };

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE UNAUTHENTICATED SWEEP — every newly-secured function
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — the unauthenticated sweep (all 29 secured functions)', () => {
  const unauthCases: Array<[string, any, any]> = [
    // staff ticket management
    ['assignTicketToTeamMember', assignTicketToTeamMember, { requestKind: 'maintenance', requestId: 'tick-1', assignedToUserId: 'u-admin-1', assignedBy: 'u-admin-1', firmId: 'firm-1' }],
    ['getAllServiceRequestTypes', getAllServiceRequestTypes, { firmId: 'firm-1', portalType: 'resident' }],
    ['createServiceRequestType', createServiceRequestType, { firmId: 'firm-1', portalType: 'resident', key: 'x', label: 'X' }],
    ['getMaintenanceTicketsByProperty', getMaintenanceTicketsByProperty, { propertyId: 'prop-1' }],
    // invites directory (contains live tokens)
    ['getPortalInvitesByFirm', getPortalInvitesByFirm, { firmId: 'firm-1' }],
    ['getPortalInvitesByEmail', getPortalInvitesByEmail, { email: 'tenant@example.com' }],
    // portal self-service
    ['relinkPortalUserToProperty', relinkPortalUserToProperty, { email: 'tenant@example.com', firmId: 'firm-1' }],
    ['resolveFirmFromInvite', resolveFirmFromInvite, { email: 'tenant@example.com' }],
    // client portal data
    ['getServiceRequestTypes', getServiceRequestTypes, { firmId: 'firm-1', portalType: 'client' }],
    ['getClientServiceRequestsByClient', getClientServiceRequestsByClient, { clientId: 'u-client-1' }],
    ['getClientMessages', getClientMessages, { firmId: 'firm-1', contactId: 'contact-1' }],
    ['getClientActivity', getClientActivity, { firmId: 'firm-1', contactId: 'contact-1' }],
    ['getClientInvoices', getClientInvoices, { firmId: 'firm-1', contactId: 'contact-1' }],
    ['getClientContactByUserId', getClientContactByUserId, { firmId: 'firm-1', userId: 'u-client-1' }],
    ['getClientMattersByUserId', getClientMattersByUserId, { firmId: 'firm-1', userId: 'u-client-1' }],
    // messaging
    ['getPortalConversationsByFirm', getPortalConversationsByFirm, { firmId: 'firm-1' }],
    ['getPortalConversationsByParticipant', getPortalConversationsByParticipant, { participantId: 'u-tenant-1' }],
    ['getConversationMessages', getConversationMessages, { conversationId: 'conv-1' }],
    ['softDeletePortalMessage', softDeletePortalMessage, { messageId: 'msg-1', requesterId: 'u-tenant-1' }],
    ['adminDeletePortalMessage', adminDeletePortalMessage, { messageId: 'msg-1', adminId: 'u-admin-1', firmId: 'firm-1' }],
    ['hardDeleteConversation', hardDeleteConversation, { conversationId: 'conv-1' }],
    ['getPortalMessagesByFirm', getPortalMessagesByFirm, { firmId: 'firm-1' }],
    ['replyToPortalMessage', replyToPortalMessage, { messageId: 'msg-1', replyContent: 'hi' }],
    // notices
    ['archiveNotice', archiveNotice, { noticeId: 'notice-1' }],
    ['restoreNotice', restoreNotice, { noticeId: 'notice-1' }],
    ['getAllNotices', getAllNotices, { firmId: 'firm-1' }],
    // preferences / consent
    ['getNotificationPreferences', getNotificationPreferences, { firmId: 'firm-1' }],
    ['getPortalUserConsentRecords', getPortalUserConsentRecords, { email: 'tenant@example.com' }],
    ['getClientConsentRecords', getClientConsentRecords, { email: 'client@example.com' }],
  ];
  for (const [name, fn, args] of unauthCases) {
    it(`${name}: no session → throws`, async () => {
      const { ctx } = makeCtx();
      await expect((fn as any)._handler(ctx, { ...args })).rejects.toThrow(/Unauthenticated|verified session/);
    });
  }
  it('covers all 29 secured functions', () => {
    expect(unauthCases.length).toBe(29);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Staff ticket management
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — assignTicketToTeamMember', () => {
  const TICKET = { _id: 'tick-1', firmId: 'firm-1', status: 'open', subject: 'Leak', description: 'd', conversationId: null };
  const TEAMMATE = { _id: 'u-staff-9', email: 'staff9@example.com', tokenIdentifier: 'staff9@example.com', role: 'Admin', firmId: 'firm-1' };

  it('staff of the same firm assigns a ticket (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, users: [TEAMMATE], tables: { maintenance_tickets: [TICKET] } });
    const res = await (assignTicketToTeamMember as any)._handler(ctx, {
      requestKind: 'maintenance', requestId: 'tick-1', assignedToUserId: 'u-staff-9',
      assignedToName: 'Teammate', assignedBy: 'u-admin-1', firmId: 'firm-1', sessionToken: 'tok-admin-xyz',
    });
    expect(res.success).toBe(true);
    const ticketPatch = writes.patches.find((p) => p.id === 'tick-1');
    expect(ticketPatch.value.assignedTo).toBe('u-staff-9');
    // a task is auto-created for the teammate with the CALLER as creator
    const task = writes.inserts.find((i) => i.table === 'tasks');
    expect(task.value.creatorId).toBe('u-admin-1');
  });

  it('the assigner is bound to the SESSION caller (impersonation rejected)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, users: [TEAMMATE], tables: { maintenance_tickets: [TICKET] } });
    await (assignTicketToTeamMember as any)._handler(ctx, {
      requestKind: 'maintenance', requestId: 'tick-1', assignedToUserId: 'u-staff-9',
      assignedBy: 'SOMEONE-ELSE', firmId: 'firm-1', sessionToken: 'tok-admin-xyz',
    });
    const task = writes.inserts.find((i) => i.table === 'tasks');
    expect(task.value.creatorId).toBe('u-admin-1'); // not SOMEONE-ELSE
  });

  it('a cross-firm ticket is refused', async () => {
    const ticket2 = { ...TICKET, firmId: 'firm-2' };
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, users: [TEAMMATE], tables: { maintenance_tickets: [ticket2] } });
    await expect((assignTicketToTeamMember as any)._handler(ctx, {
      requestKind: 'maintenance', requestId: 'tick-1', assignedToUserId: 'u-staff-9',
      assignedBy: 'u-admin-1', firmId: 'firm-2', sessionToken: 'tok-admin-xyz',
    })).rejects.toThrow(/different firm/);
  });

  it('a cross-firm assignee is refused', async () => {
    const foreign = { ...TEAMMATE, _id: 'u-staff-x', firmId: 'firm-2' };
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, users: [foreign], tables: { maintenance_tickets: [TICKET] } });
    await expect((assignTicketToTeamMember as any)._handler(ctx, {
      requestKind: 'maintenance', requestId: 'tick-1', assignedToUserId: 'u-staff-x',
      assignedBy: 'u-admin-1', firmId: 'firm-1', sessionToken: 'tok-admin-xyz',
    })).rejects.toThrow(/assignee belongs to a different firm/);
  });
});

describe('ROUND A2 — service request type catalog', () => {
  it('a resident session reads the catalog (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { service_request_types: [] } });
    const rows = await (getServiceRequestTypes as any)._handler(ctx, {
      firmId: 'firm-1', portalType: 'resident', sessionToken: 'tok-tenant-abc',
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].key).toBe('plumbing');
  });

  it('a cross-firm catalog read is refused', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { service_request_types: [] } });
    await expect((getServiceRequestTypes as any)._handler(ctx, {
      firmId: 'firm-2', portalType: 'resident', sessionToken: 'tok-tenant-abc',
    })).rejects.toThrow(/different firm/);
  });

  it('the admin config read requires staff (a resident is rejected)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { service_request_types: [] } });
    await expect((getAllServiceRequestTypes as any)._handler(ctx, {
      firmId: 'firm-1', portalType: 'resident', sessionToken: 'tok-tenant-abc',
    })).rejects.toThrow(/Portal users do not have access/);
  });

  it('staff create a type and it lands in their firm (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { service_request_types: [] } });
    await (createServiceRequestType as any)._handler(ctx, {
      firmId: 'firm-1', portalType: 'resident', key: 'pool', label: 'Pool Cleaning',
      announceToPortal: false, sessionToken: 'tok-admin-xyz',
    });
    const row = writes.inserts.find((i) => i.table === 'service_request_types');
    expect(row.value.firmId).toBe('firm-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Staff property reads
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — getMaintenanceTicketsByProperty', () => {
  const PROPERTY = { _id: 'prop-1', firmId: 'firm-1', name: 'Block A' };
  const TICKETS = [
    { _id: 'tick-1', firmId: 'firm-1', propertyId: 'prop-1', status: 'open', createdAt: 1, updatedAt: 1 },
    { _id: 'tick-2', firmId: 'firm-1', propertyId: 'prop-1', status: 'resolved', createdAt: 2, updatedAt: 2 },
  ];

  it('staff of the property’s firm read its tickets (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { properties: [PROPERTY], maintenance_tickets: TICKETS } });
    const rows = await (getMaintenanceTicketsByProperty as any)._handler(ctx, { propertyId: 'prop-1', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(2);
  });

  it('a cross-firm property’s tickets are refused', async () => {
    const prop2 = { ...PROPERTY, _id: 'prop-2', firmId: 'firm-2' };
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { properties: [prop2], maintenance_tickets: TICKETS } });
    await expect((getMaintenanceTicketsByProperty as any)._handler(ctx, { propertyId: 'prop-2', sessionToken: 'tok-admin-xyz' }))
      .rejects.toThrow(/different firm/);
  });

  it('a resident session is refused (staff-only read)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { properties: [PROPERTY], maintenance_tickets: TICKETS } });
    await expect((getMaintenanceTicketsByProperty as any)._handler(ctx, { propertyId: 'prop-1', sessionToken: 'tok-tenant-abc' }))
      .rejects.toThrow(/Portal users do not have access/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Invite directory + email probe
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — portal invite directory (contains live tokens)', () => {
  const INVITES = [
    { _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'tenant@example.com', token: 'SECRETTOKEN1', status: 'pending', expiresAt: Date.now() + 86400000 },
    { _id: 'inv-2', firmId: 'firm-2', inviteeEmail: 'tenant@example.com', token: 'SECRETTOKEN2', status: 'pending', expiresAt: Date.now() + 86400000 },
  ];

  it('staff of the firm read their invite list (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_invites: INVITES } });
    const rows = await (getPortalInvitesByFirm as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(1);
    expect(rows[0].firmId).toBe('firm-1');
  });

  it('a cross-firm invite list is refused', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_invites: INVITES } });
    await expect((getPortalInvitesByFirm as any)._handler(ctx, { firmId: 'firm-2', sessionToken: 'tok-admin-xyz' }))
      .rejects.toThrow(/different firm/);
  });

  it('the email probe only returns invites of the CALLER’S firm (cross-firm filtered)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_invites: INVITES } });
    const rows = await (getPortalInvitesByEmail as any)._handler(ctx, { email: 'tenant@example.com', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(1);
    expect(rows[0].token).toBe('SECRETTOKEN1'); // firm-2's token never leaves
  });

  it('a resident cannot probe invites', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_invites: INVITES } });
    await expect((getPortalInvitesByEmail as any)._handler(ctx, { email: 'tenant@example.com', sessionToken: 'tok-tenant-abc' }))
      .rejects.toThrow(/Portal users do not have access/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Portal self-service (relink + firm resolution)
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — relinkPortalUserToProperty (rewrites tenancy links)', () => {
  // NOTE: each test builds a FRESH property copy — earlier tests patch the
  // rows in place (ctx.db.patch mutates), and a shared object would couple
  // test order to test outcome.
  const mkProperty = () => ({
    _id: 'prop-1', firmId: 'firm-1', name: 'Block A',
    units: [{ id: 'unit-1', tenantEmail: 'tenant@example.com', currentTenantId: 'stale-legacy-id' }],
  });

  it('the signed-in resident relinks themselves (legit self-heal workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { properties: [mkProperty()] } });
    const res = await (relinkPortalUserToProperty as any)._handler(ctx, {
      email: 'tenant@example.com', firmId: 'firm-1', sessionToken: 'tok-tenant-abc',
    });
    expect(res.linked).toBe(true);
    expect(writes.patches.length).toBe(1);
  });

  it('a foreign email is REBOUND to the session caller (no cross-victim relink)', async () => {
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { properties: [mkProperty()] } });
    const res = await (relinkPortalUserToProperty as any)._handler(ctx, {
      email: 'victim@example.com', firmId: 'firm-1', sessionToken: 'tok-tenant-abc',
    });
    // The relink still targets the CALLER's own email — the victim is untouched.
    expect(res.linked).toBe(true);
    const patch = writes.patches[0];
    expect(JSON.stringify(patch.value)).toContain('tenant@example.com');
    expect(JSON.stringify(patch.value)).not.toContain('victim@example.com');
  });

  it('a cross-firm relink is refused', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { properties: [mkProperty()] } });
    await expect((relinkPortalUserToProperty as any)._handler(ctx, {
      email: 'tenant@example.com', firmId: 'firm-2', sessionToken: 'tok-tenant-abc',
    })).rejects.toThrow(/different firm/);
  });
});

describe('ROUND A2 — resolveFirmFromInvite (account-existence oracle, closed)', () => {
  it('a signed-in user resolves their own firm (legit workflow)', async () => {
    const invites = [{ _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'tenant@example.com', portalType: 'resident', status: 'pending', expiresAt: Date.now() + 86400000 }];
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_invites: invites, properties: [] } });
    const res = await (resolveFirmFromInvite as any)._handler(ctx, { email: 'tenant@example.com', sessionToken: 'tok-tenant-abc' });
    expect(res.firmId).toBe('firm-1');
  });

  it('probing SOMEONE ELSE’S email returns the CALLER’S own resolution (rebound)', async () => {
    const invites = [{ _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'tenant@example.com', portalType: 'resident', status: 'pending', expiresAt: Date.now() + 86400000 }];
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_invites: invites, properties: [] } });
    const res = await (resolveFirmFromInvite as any)._handler(ctx, { email: 'victim@example.com', sessionToken: 'tok-tenant-abc' });
    // The victim's data is never consulted — the caller's own invite resolved.
    expect(res.source).toBe('invite');
    expect(res.firmId).toBe('firm-1');
  });

  it('without a session the oracle is closed', async () => {
    const invites = [{ _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'tenant@example.com', portalType: 'resident', status: 'pending', expiresAt: Date.now() + 86400000 }];
    const { ctx } = makeCtx({ tables: { portal_invites: invites } });
    await expect((resolveFirmFromInvite as any)._handler(ctx, { email: 'tenant@example.com' }))
      .rejects.toThrow(/Unauthenticated/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Client portal data (IDOR class)
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — client portal data reads', () => {
  const CONTACT = { _id: 'contact-1', firmId: 'firm-1', userId: 'u-client-1', email: 'client@example.com', name: 'Chidi Client' };
  const MATTER = { _id: 'matter-1', firmId: 'firm-1', clientId: 'contact-1', title: 'M1' };
  const base = { contacts: [CONTACT], matters: [MATTER], clientMessages: [], firmActivity: [], invoices: [] };

  it('the client reads their own contact record (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { ...base } });
    const contact = await (getClientContactByUserId as any)._handler(ctx, { firmId: 'firm-1', userId: 'u-client-1', sessionToken: 'tok-client-1' });
    expect(contact._id).toBe('contact-1');
  });

  it('a foreign userId is rebound — the caller sees only their own contact', async () => {
    const victimContact = { _id: 'contact-9', firmId: 'firm-1', userId: 'u-victim-9', email: 'victim@example.com', name: 'Victim' };
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { ...base, contacts: [CONTACT, victimContact] } });
    const contact = await (getClientContactByUserId as any)._handler(ctx, { firmId: 'firm-1', userId: 'u-victim-9', sessionToken: 'tok-client-1' });
    expect(contact._id).toBe('contact-1'); // own — never the victim's
  });

  it('the client reads their own matters (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { ...base } });
    const rows = await (getClientMattersByUserId as any)._handler(ctx, { firmId: 'firm-1', userId: 'u-client-1', sessionToken: 'tok-client-1' });
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('M1');
  });

  it('a cross-firm matter read is refused', async () => {
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { ...base } });
    await expect((getClientMattersByUserId as any)._handler(ctx, { firmId: 'firm-2', userId: 'u-client-1', sessionToken: 'tok-client-1' }))
      .rejects.toThrow(/different firm/);
  });

  it('client messages: a foreign contactId returns the CALLER’S data only', async () => {
    const msgs = [
      { _id: 'cm-1', firmId: 'firm-1', matterId: 'matter-1', content: 'own', authorId: 'a', timestamp: '2' },
      { _id: 'cm-2', firmId: 'firm-1', matterId: 'matter-9', content: 'victim', authorId: 'a', timestamp: '1' },
    ];
    const victimMatter = { _id: 'matter-9', firmId: 'firm-1', clientId: 'contact-9', title: 'Victim Matter' };
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { ...base, clientMessages: msgs, matters: [MATTER, victimMatter] } });
    const rows = await (getClientMessages as any)._handler(ctx, { firmId: 'firm-1', contactId: 'contact-9', sessionToken: 'tok-client-1' });
    // contact-9 is foreign → rebound to the caller's own contact → own matters only
    expect(rows.every((r: any) => r.content === 'own')).toBe(true);
  });

  it('client service requests: a foreign clientId is rebound to the caller', async () => {
    const own = { _id: 'csr-1', firmId: 'firm-1', clientId: 'contact-1', subject: 'own-req' };
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { ...base, client_service_requests: [own] } });
    const rows = await (getClientServiceRequestsByClient as any)._handler(ctx, { clientId: 'contact-9', sessionToken: 'tok-client-1' });
    // rebound to contact-1 (the caller's linked contact) — own request returns
    expect(rows.length).toBe(1);
    expect(rows[0].subject).toBe('own-req');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Portal messaging (IDOR + impersonation class)
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — portal conversations and messages', () => {
  const CONV = { _id: 'conv-1', firmId: 'firm-1', participantId: 'u-tenant-1', participantName: 'Tayo', lastMessageAt: 1, unreadByAdmin: 2 };
  const MSGS = [
    { _id: 'msg-1', firmId: 'firm-1', conversationId: 'conv-1', senderId: 'u-tenant-1', senderName: 'Tayo', content: 'hi', createdAt: 1 },
    { _id: 'msg-2', firmId: 'firm-1', conversationId: 'conv-1', senderId: 'admin', senderName: 'Ada', content: 'hello', createdAt: 2 },
  ];

  it('staff of the firm read the conversation list (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_conversations: [CONV] } });
    const rows = await (getPortalConversationsByFirm as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(1);
  });

  it('a resident reads their own conversations (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_conversations: [CONV] } });
    const rows = await (getPortalConversationsByParticipant as any)._handler(ctx, { participantId: 'u-tenant-1', sessionToken: 'tok-tenant-abc' });
    expect(rows.length).toBe(1);
  });

  it('a resident probing another participant’s id gets only their own (rebound)', async () => {
    const victimConv = { ...CONV, _id: 'conv-2', participantId: 'u-tenant-2', participantName: 'Ope' };
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_conversations: [CONV, victimConv] } });
    const rows = await (getPortalConversationsByParticipant as any)._handler(ctx, { participantId: 'u-tenant-2', sessionToken: 'tok-tenant-abc' });
    expect(rows.every((r: any) => r.participantId === 'u-tenant-1')).toBe(true);
  });

  it('the resident reads their own thread (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_conversations: [CONV], portal_messages: MSGS } });
    const rows = await (getConversationMessages as any)._handler(ctx, { conversationId: 'conv-1', sessionToken: 'tok-tenant-abc' });
    expect(rows.length).toBe(2);
  });

  it('ANOTHER resident cannot read the thread (IDOR closed)', async () => {
    const { ctx } = makeCtx({ session: OTHER_TENANT_SESSION, user: OTHER_TENANT, tables: { portal_conversations: [CONV], portal_messages: MSGS } });
    await expect((getConversationMessages as any)._handler(ctx, { conversationId: 'conv-1', sessionToken: 'tok-tenant-2' }))
      .rejects.toThrow(/belongs to another user/);
  });

  it('staff of another firm cannot read the thread (cross-firm closed)', async () => {
    const { ctx } = makeCtx({ session: ADMIN2_SESSION, user: ADMIN2, tables: { portal_conversations: [CONV], portal_messages: MSGS } });
    await expect((getConversationMessages as any)._handler(ctx, { conversationId: 'conv-1', sessionToken: 'tok-admin2-2' }))
      .rejects.toThrow(/different firm/);
  });

  it('staff of the firm read the thread (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_conversations: [CONV], portal_messages: MSGS } });
    const rows = await (getConversationMessages as any)._handler(ctx, { conversationId: 'conv-1', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(2);
  });

  it('the sender deletes their own message (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_messages: [MSGS[0]] } });
    const res = await (softDeletePortalMessage as any)._handler(ctx, { messageId: 'msg-1', requesterId: 'u-tenant-1', sessionToken: 'tok-tenant-abc' });
    expect(res.success).toBe(true);
    const patch = writes.patches.find((p) => p.id === 'msg-1');
    expect(patch.value.isDeleted).toBe(true);
    expect(patch.value.deletedBy).toBe('u-tenant-1');
  });

  it('a forged requesterId cannot delete someone else’s message (impersonation closed)', async () => {
    const victimMsg = { ...MSGS[0], senderId: 'u-tenant-2', senderName: 'Ope' };
    const { ctx, writes } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_messages: [victimMsg] } });
    await expect((softDeletePortalMessage as any)._handler(ctx, { messageId: 'msg-1', requesterId: 'u-tenant-2', sessionToken: 'tok-tenant-abc' }))
      .rejects.toThrow(/only delete your own messages/);
    expect(writes.patches.length).toBe(0);
  });

  it('admin deletes a message in their firm; deletedBy binds to the SESSION (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_messages: [MSGS[1]] } });
    const res = await (adminDeletePortalMessage as any)._handler(ctx, {
      messageId: 'msg-2', adminId: 'FORGED-ID', firmId: 'firm-1', sessionToken: 'tok-admin-xyz',
    });
    expect(res.success).toBe(true);
    const patch = writes.patches.find((p) => p.id === 'msg-2');
    expect(patch.value.deletedBy).toBe('u-admin-1'); // FORGED-ID ignored
  });

  it('a caller-supplied firmId can no longer authorise a cross-firm delete', async () => {
    const foreignMsg = { ...MSGS[1], firmId: 'firm-2' };
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_messages: [foreignMsg] } });
    await expect((adminDeletePortalMessage as any)._handler(ctx, {
      messageId: 'msg-2', adminId: 'u-admin-1', firmId: 'firm-2', sessionToken: 'tok-admin-xyz',
    })).rejects.toThrow(/different firm/);
  });

  it('hardDeleteConversation binds to the conversation’s firm (legit + cross-firm)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_conversations: [CONV] } });
    const res = await (hardDeleteConversation as any)._handler(ctx, { conversationId: 'conv-1', sessionToken: 'tok-admin-xyz' });
    expect(res.success).toBe(true);
    expect(writes.deletes).toContain('conv-1');

    const { ctx: ctx2 } = makeCtx({ session: ADMIN2_SESSION, user: ADMIN2, tables: { portal_conversations: [CONV] } });
    await expect((hardDeleteConversation as any)._handler(ctx2, { conversationId: 'conv-1', sessionToken: 'tok-admin2-2' }))
      .rejects.toThrow(/different firm/);
  });

  it('replyToPortalMessage requires staff of the message’s firm (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_messages: [MSGS[0]] } });
    const res = await (replyToPortalMessage as any)._handler(ctx, { messageId: 'msg-1', replyContent: 'answer', sessionToken: 'tok-admin-xyz' });
    expect(res.success).toBe(true);
    const patch = writes.patches.find((p) => p.id === 'msg-1');
    expect(patch.value.replyContent).toBe('answer');
  });

  it('getPortalMessagesByFirm requires staff of the firm (legit workflow)', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_messages: MSGS } });
    const rows = await (getPortalMessagesByFirm as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(rows.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Notices + preferences + consent
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — notices, notification preferences, consent records', () => {
  const NOTICE = { _id: 'notice-1', firmId: 'firm-1', title: 'T', body: 'B', status: 'active', createdAt: 1 };

  it('staff archive + restore a notice of their firm (legit workflow)', async () => {
    const { ctx, writes } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_notices: [NOTICE] } });
    await (archiveNotice as any)._handler(ctx, { noticeId: 'notice-1', sessionToken: 'tok-admin-xyz' });
    expect(writes.patches.find((p) => p.id === 'notice-1').value.status).toBe('archived');
    await (restoreNotice as any)._handler(ctx, { noticeId: 'notice-1', sessionToken: 'tok-admin-xyz' });
    expect(writes.patches[writes.patches.length - 1].value.status).toBe('active');
  });

  it('a cross-firm notice archive is refused', async () => {
    const foreign = { ...NOTICE, firmId: 'firm-2' };
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_notices: [foreign] } });
    await expect((archiveNotice as any)._handler(ctx, { noticeId: 'notice-1', sessionToken: 'tok-admin-xyz' }))
      .rejects.toThrow(/different firm/);
  });

  it('staff read the admin notice board incl. archived (legit workflow)', async () => {
    const rows = [NOTICE, { ...NOTICE, _id: 'notice-2', status: 'archived' }];
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { portal_notices: rows } });
    const out = await (getAllNotices as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(out.length).toBe(2);
  });

  it('staff read notification preferences (legit workflow); a resident is refused', async () => {
    const { ctx } = makeCtx({ session: ADMIN_SESSION, user: ADMIN, tables: { notification_preferences: [] } });
    const prefs = await (getNotificationPreferences as any)._handler(ctx, { firmId: 'firm-1', sessionToken: 'tok-admin-xyz' });
    expect(prefs.preferences).toBeTruthy();

    const { ctx: ctx2 } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { notification_preferences: [] } });
    await expect((getNotificationPreferences as any)._handler(ctx2, { firmId: 'firm-1', sessionToken: 'tok-tenant-abc' }))
      .rejects.toThrow(/Portal users do not have access/);
  });

  it('the resident reads their own consent records (legit workflow)', async () => {
    const invites = [
      { _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'tenant@example.com', status: 'accepted', termsAcceptedAt: 1, portalType: 'resident' },
      { _id: 'inv-2', firmId: 'firm-1', inviteeEmail: 'victim@example.com', status: 'accepted', termsAcceptedAt: 1, portalType: 'resident' },
    ];
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_invites: invites } });
    const rows = await (getPortalUserConsentRecords as any)._handler(ctx, { email: 'tenant@example.com', sessionToken: 'tok-tenant-abc' });
    expect(rows.length).toBe(1);
  });

  it('probing someone else’s consent records returns the CALLER’S own (rebound)', async () => {
    const invites = [
      { _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'tenant@example.com', status: 'accepted', termsAcceptedAt: 1, portalType: 'resident' },
      { _id: 'inv-2', firmId: 'firm-1', inviteeEmail: 'victim@example.com', status: 'accepted', termsAcceptedAt: 1, portalType: 'resident' },
    ];
    const { ctx } = makeCtx({ session: TENANT_SESSION, user: TENANT, tables: { portal_invites: invites } });
    const rows = await (getPortalUserConsentRecords as any)._handler(ctx, { email: 'victim@example.com', sessionToken: 'tok-tenant-abc' });
    expect(rows.length).toBe(1);
    expect(rows[0].inviteeEmail).toBe('tenant@example.com');
  });

  it('the client reads their own consent records (legit workflow)', async () => {
    const invites = [{ _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'client@example.com', status: 'accepted', portalType: 'client' }];
    const { ctx } = makeCtx({ session: CLIENT_SESSION, user: CLIENT, tables: { portal_invites: invites } });
    const rows = await (getClientConsentRecords as any)._handler(ctx, { email: 'client@example.com', sessionToken: 'tok-client-1' });
    expect(rows.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Deleted surface + internalised helper (source contracts)
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — dead unauthenticated exports removed', () => {
  const dead = [
    'respondToServiceRequest', 'getClientServiceRequestsByFirm', 'getServiceRequestsByFirm',
    'getPortalMessagesBySender', 'getPortalMessageById', 'getNotice', 'resolvePortalUserByToken',
    'getFirmPortalInvites', 'updateNotice',
  ];
  for (const name of dead) {
    it(`${name} is gone from the module exports`, () => {
      expect((portalsModule as any)[name]).toBeUndefined();
    });
    it(`${name} is gone from the module source`, () => {
      const src = read('convex/portals.ts');
      expect(src).not.toMatch(new RegExp(`export const ${name} = (query|mutation|action)`));
    });
  }
  it('getPortalInviteById left the PUBLIC api (now internalQuery, server-only)', () => {
    const src = read('convex/portals.ts');
    expect(src).toMatch(/export const getPortalInviteById = internalQuery/);
    // the only reference is the staff-gated resendPortalInvite action
    expect(src).toContain('internal.portals.getPortalInviteById');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Intentionally-public token flows KEEP working (no over-authentication)
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — token-based invitation flows remain public (by design)', () => {
  const GOOD_TOKEN = 'GoodTok123456';
  // NOTE: fresh copy per test — acceptPortalInviteByToken patches the row in
  // place, and a shared literal would leak 'accepted' into later tests.
  const mkInvite = () => ({
    _id: 'inv-1', firmId: 'firm-1', inviteeEmail: 'newresident@example.com', inviteeName: 'New',
    portalType: 'resident', token: GOOD_TOKEN, status: 'pending',
    expiresAt: Date.now() + 86400000, createdAt: 1,
  });

  it('getInviteByToken resolves a magic link without a session', async () => {
    const { ctx } = makeCtx({ tables: { portal_invites: [mkInvite()] } });
    const inv = await (getInviteByToken as any)._handler(ctx, { token: GOOD_TOKEN });
    expect(inv._id).toBe('inv-1');
  });

  it('acceptPortalInviteByToken accepts a valid pending invite without a session', async () => {
    const { ctx, writes } = makeCtx({ tables: { portal_invites: [mkInvite()] } });
    const inv = await (acceptPortalInviteByToken as any)._handler(ctx, { token: GOOD_TOKEN });
    expect(inv.status).toBe('accepted');
    expect(writes.patches.find((p) => p.id === 'inv-1').value.status).toBe('accepted');
  });

  it('acceptPortalInviteByToken refuses a revoked invite', async () => {
    const revoked = { ...mkInvite(), status: 'revoked' };
    const { ctx } = makeCtx({ tables: { portal_invites: [revoked] } });
    await expect((acceptPortalInviteByToken as any)._handler(ctx, { token: GOOD_TOKEN }))
      .rejects.toThrow(/revoked/);
  });

  it('verifyInviteToken validates a good token and rejects an unknown one', async () => {
    const { ctx } = makeCtx({ tables: { portal_invites: [mkInvite()], users: [] } });
    const ok = await (verifyInviteToken as any)._handler(ctx, { token: GOOD_TOKEN });
    expect(ok.valid).toBe(true);
    const bad = await (verifyInviteToken as any)._handler(ctx, { token: 'NoSuchToken99' });
    expect(bad.valid).toBe(false);
    expect(bad.reason).toBe('not_found');
  });

  it('setupPortalPassword stays exported and token-gated (source contract)', () => {
    const src = read('convex/portals.ts');
    expect(src).toMatch(/export const setupPortalPassword = action/);
    const body = src.split('export const setupPortalPassword = action')[1].split('\nexport const')[0];
    // The invite token itself is the capability — no session required.
    expect(body).toContain('getInviteByToken');
    expect(body).not.toMatch(/requirePortalCaller|requireStaffCaller|resolveCaller/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. estateCommunity + gatehouse: documented false-positives / intentional
// ═══════════════════════════════════════════════════════════════════════════
describe('ROUND A2 — estateCommunity mutations stay strict (false positives)', () => {
  it('every admin-catalog mutation calls requireAdmin (strict session + role + firm)', () => {
    const src = read('convex/estateCommunity.ts');
    for (const name of ['createAmenity', 'updateAmenity', 'deleteAmenity', 'reviewBooking', 'createBulletin', 'updateBulletin', 'archiveBulletin', 'createServiceProvider', 'updateServiceProvider', 'deleteServiceProvider']) {
      const body = src.split(`export const ${name} = mutation`)[1].split('\nexport const')[0];
      expect(body).toContain('requireAdmin(');
    }
  });

  it('requireAdmin/requireFirmUser have no anonymous fallback (source contract)', () => {
    const src = read('convex/authHelpers.ts');
    expect(src).toMatch(/No token presented: reject/);
    expect(src).not.toMatch(/PERMISSIVE|anonymous fallback.*return/);
  });

  it('the gatehouse surface stays intentionally public but throttled (Round A, unchanged)', () => {
    const src = read('convex/visitorManagement.ts');
    for (const name of ['verifyToken', 'checkInVisitor', 'checkOutVisitor', 'getGatehouseLogs', 'getGatekeeperProperties']) {
      expect(src).toContain(`export const ${name}`);
    }
    expect(src).toMatch(/checkRateLimit|consumeRateLimit/);
  });
});
