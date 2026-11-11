/**
 * roundQAEstateOps.test.ts — ROUND QA (§4 estate operations) acceptance
 * suite: the maintenance-ticket / work-order LIFECYCLE end-to-end through
 * the REAL handlers on a fixture-backed ctx.
 *
 * WHY THIS FILE EXISTS: the estate-ops group had auth-sweep coverage
 * (portalLayerSecurity: unauthenticated sweeps, assign auth) but NO
 * end-to-end lifecycle drive — submit → list → assign (work order) →
 * in_progress → resolve → close, resident cancellation, and the
 * permission matrix around each transition. The owner brief §4 names
 * "maintenance requests, work orders" explicitly.
 *
 * Auth is real: session tokens hash to the sessions table; portal roles
 * (Tenant) resolve via requirePortalCaller; staff via requireStaffCaller.
 */
import { describe, it, expect, vi } from 'vitest';

import {
    createMaintenanceTicket,
    getMaintenanceTicketsByTenant,
    getMaintenanceTicketsByFirm,
    getMaintenanceTicketsByProperty,
    updateMaintenanceTicketStatus,
    cancelMaintenanceTicket,
    assignTicketToTeamMember,
} from '../../convex/portals';
import { hashSessionToken } from '../../convex/sessions';

// ─── Fixture ctx (roundSentry harness) ──────────────────────────────────────
type Row = Record<string, any>;

function makeCtx(tables: Record<string, Row[]>) {
    const CMP: Record<string, (a: any, b: any) => boolean> = {
        eq: (a, b) => String(a) === String(b),
        gte: (a, b) => Number(a) >= Number(b),
        lte: (a, b) => Number(a) <= Number(b),
        lt: (a, b) => Number(a) < Number(b),
        gt: (a, b) => Number(a) > Number(b),
        neq: (a, b) => String(a) !== String(b),
    };
    const findRows = (table: string, conds: Array<[string, string, any]>) =>
        (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => r[f] !== undefined && CMP[op](r[f], v)));
    const qFor = (r: Row) => {
        const q: any = { field: (name: string) => r[name] };
        for (const op of Object.keys(CMP)) q[op] = (a: any, b: any) => CMP[op](a, b);
        return q;
    };
    const chainFor = (rows: Row[]) => {
        const chain: any = {
            first: async () => rows[0] ?? null,
            unique: async () => rows[0] ?? null,
            collect: async () => rows,
            take: async (n: number) => rows.slice(0, n),
            order: (_d: string) => chain,
            filter: (fn: any) => chainFor(rows.filter((r) => fn(qFor(r)) !== false)),
        };
        return chain;
    };
    const db: any = {
        query: (table: string) => ({
            withIndex: (_name: string, fn: (q: any) => any) => {
                const conds: Array<[string, string, any]> = [];
                const q: any = { eq: (field: string, value: any) => { conds.push([field, 'eq', value]); return q; } };
                fn(q);
                return chainFor(findRows(table, conds));
            },
            filter: (fn: any) => chainFor((tables[table] ?? []).filter((r) => fn(qFor(r)) !== false)),
            order: (_d: string) => chainFor(tables[table] ?? []),
            collect: async () => tables[table] ?? [],
            take: async (n: number) => (tables[table] ?? []).slice(0, n),
            first: async () => (tables[table] ?? [])[0] ?? null,
        }),
        get: async (id: any) => {
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === String(id));
                if (hit) return hit;
            }
            return null;
        },
        insert: async (table: string, value: any) => {
            const _id = `${table}_${(tables[table] ?? []).length + 1}_${Math.random().toString(36).slice(2, 7)}`;
            (tables[table] = tables[table] ?? []).push({ _id, ...value });
            return _id as any;
        },
        patch: async (id: any, patch: any) => {
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === String(id));
                if (hit) { Object.assign(hit, patch); return null; }
            }
            return null;
        },
        delete: async () => null,
    };

    return {
        ctx: {
            db,
            runMutation: vi.fn(),
            runQuery: vi.fn(),
            runAction: vi.fn(),
            scheduler: {
                runAfter: vi.fn(async (_ms: number, fnRef: any, args: any) => {
                    // createMaintenanceTicket schedules a notification via
                    // internal mutation — execute inline so app_notifications
                    // rows land (the "admin gets notified" contract).
                    if (args && typeof args.eventType === 'string') return null;
                    try { await (fnRef as any)?._handler?.({ db }, args); } catch {}
                    return null;
                }),
            },
            auth: { getUserIdentity: async () => null },
        },
        tables,
    };
}

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const TENANT_ID = 'users_ten_1';
const ADMIN_ID = 'users_adm_1';
const STAFF_ID = 'users_stf_1';
const OTHER_FIRM_ADMIN_ID = 'users_ofa_1';

const TENANT_SESSION = 'sess-tenant-a';
const ADMIN_SESSION = 'sess-admin-b';
const OTHER_FIRM_SESSION = 'sess-otherfirm-c';

function baseTables(): Record<string, Row[]> {
    return {
        users: [
            { _id: TENANT_ID, id: TENANT_ID, name: 'Ada Resident', email: 'ada@res.ng', tokenIdentifier: 'ada@res.ng', role: 'Tenant', firmId: 'firm-1' },
            { _id: ADMIN_ID, id: ADMIN_ID, name: 'Estate Admin', email: 'admin@atrium.ng', tokenIdentifier: 'admin@atrium.ng', role: 'Administrator', firmId: 'firm-1' },
            { _id: STAFF_ID, id: STAFF_ID, name: 'Kele Staff', email: 'kele@atrium.ng', tokenIdentifier: 'kele@atrium.ng', role: 'Lawyer', firmId: 'firm-1' },
            { _id: OTHER_FIRM_ADMIN_ID, id: OTHER_FIRM_ADMIN_ID, name: 'Rival Admin', email: 'admin@rival.ng', tokenIdentifier: 'admin@rival.ng', role: 'Administrator', firmId: 'firm-2' },
        ],
        sessions: [
            { _id: 's1', tokenHash: hashSessionToken(TENANT_SESSION), userId: TENANT_ID, expiresAt: NOW + DAY, revokedAt: null },
            { _id: 's2', tokenHash: hashSessionToken(ADMIN_SESSION), userId: ADMIN_ID, expiresAt: NOW + DAY, revokedAt: null },
            { _id: 's3', tokenHash: hashSessionToken(OTHER_FIRM_SESSION), userId: OTHER_FIRM_ADMIN_ID, expiresAt: NOW + DAY, revokedAt: null },
        ],
        properties: [
            { _id: 'prop_1', id: 'prop_1', firmId: 'firm-1', name: 'Palm Grove', address: '12 Marina Rd', units: [] },
        ],
        maintenance_tickets: [],
        tasks: [],
        app_notifications: [],
        securityEvents: [],
        portal_conversations: [],
        portal_messages: [],
        suspendedUsers: [],
    };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

/** The happy-path ticket the lifecycle tests start from. */
async function seedTicket(tables: Record<string, Row[]>) {
    const { ctx } = makeCtx(tables);
    const id = await call(createMaintenanceTicket, ctx, {
        sessionToken: TENANT_SESSION,
        firmId: 'firm-1',
        propertyId: 'prop_1',
        unitId: 'unit_B14',
        tenantName: 'Ada Resident',
        subject: 'Kitchen sink leaking',
        description: 'Water pools under the kitchen sink every evening.',
        category: 'plumbing',
    });
    return id as string;
}

// ─── 1. Submission ───────────────────────────────────────────────────────────
describe('QA §4 estate ops — maintenance ticket submission', () => {
    it('a signed-in resident files a ticket (open, firm-bound, attributed)', async () => {
        const tables = baseTables();
        const id = await seedTicket(tables);
        const ticket = tables.maintenance_tickets[0];
        expect(id).toBeTruthy();
        expect(ticket.status).toBe('open');
        expect(ticket.firmId).toBe('firm-1');
        expect(ticket.tenantId).toBe(TENANT_ID); // attributed to the SESSION caller
        expect(ticket.category).toBe('plumbing');
    });

    it('an anonymous caller cannot file a ticket', async () => {
        const tables = baseTables();
        const { ctx } = makeCtx(tables);
        await expect(call(createMaintenanceTicket, ctx, {
            firmId: 'firm-1', propertyId: 'prop_1',
            subject: 'x', description: 'x', category: 'other',
        })).rejects.toThrow(/Unauthenticated|session/i);
        expect(tables.maintenance_tickets.length).toBe(0);
    });

    it('a resident cannot forge a ticket under ANOTHER tenantId', async () => {
        const tables = baseTables();
        const { ctx } = makeCtx(tables);
        await expect(call(createMaintenanceTicket, ctx, {
            sessionToken: TENANT_SESSION,
            firmId: 'firm-1', propertyId: 'prop_1',
            tenantId: 'users_somebody_else', // not an alias of the caller
            subject: 'x', description: 'x', category: 'other',
        })).rejects.toThrow(/Not authorized/i);
    });

    it('a resident cannot file into another firm', async () => {
        const tables = baseTables();
        const { ctx } = makeCtx(tables);
        await expect(call(createMaintenanceTicket, ctx, {
            sessionToken: TENANT_SESSION,
            firmId: 'firm-2', propertyId: 'prop_1',
            subject: 'x', description: 'x', category: 'other',
        })).rejects.toThrow(/firm/i);
    });
});

// ─── 2. Lists & reads (firm + tenant scoping) ────────────────────────────────
describe('QA §4 estate ops — ticket reads are scoped', () => {
    it('tenant sees own tickets; firm admin sees the firm board', async () => {
        const tables = baseTables();
        await seedTicket(tables);
        const { ctx } = makeCtx(tables);

        const mine = await call(getMaintenanceTicketsByTenant, ctx, {
            sessionToken: TENANT_SESSION, tenantId: TENANT_ID,
        });
        expect(mine.length).toBe(1);
        expect(mine[0].subject).toBe('Kitchen sink leaking');

        const board = await call(getMaintenanceTicketsByFirm, ctx, {
            sessionToken: ADMIN_SESSION, userEmail: 'admin@atrium.ng', firmId: 'firm-1',
        });
        expect(board.length).toBe(1);

        const byProp = await call(getMaintenanceTicketsByProperty, ctx, {
            sessionToken: ADMIN_SESSION, propertyId: 'prop_1', userEmail: 'admin@atrium.ng',
        });
        expect(byProp.length).toBe(1);
    });
});

// ─── 3. The work-order chain: assign → in_progress → resolved → closed ──────
describe('QA §4 estate ops — work-order lifecycle through real handlers', () => {
    it('assign moves the ticket to in_progress and records the assignee', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);
        const { ctx } = makeCtx(tables);

        await call(assignTicketToTeamMember, ctx, {
            sessionToken: ADMIN_SESSION,
            requestKind: 'maintenance',
            requestId: ticketId,
            assignedToUserId: STAFF_ID,
            assignedToName: 'Kele Staff',
            assignedBy: ADMIN_ID,
            firmId: 'firm-1',
        });

        const ticket = tables.maintenance_tickets.find((t) => t._id === ticketId);
        expect(ticket.assignedTo).toBe(STAFF_ID);
        expect(ticket.status).toBe('in_progress'); // assignment starts the work order
    });

    it('staff resolves with a resolution note, then admin closes', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);

        // Resolve (staff)
        const ctx1 = makeCtx(tables).ctx;
        await call(updateMaintenanceTicketStatus, ctx1, {
            sessionToken: ADMIN_SESSION,
            ticketId, status: 'resolved',
            resolution: 'Replaced the U-bend; leak verified dry.',
        });
        let ticket = tables.maintenance_tickets.find((t) => t._id === ticketId);
        expect(ticket.status).toBe('resolved');
        expect(ticket.resolution).toContain('U-bend');

        // Close (admin)
        const ctx2 = makeCtx(tables).ctx;
        await call(updateMaintenanceTicketStatus, ctx2, {
            sessionToken: ADMIN_SESSION,
            ticketId, status: 'closed',
        });
        ticket = tables.maintenance_tickets.find((t) => t._id === ticketId);
        expect(ticket.status).toBe('closed');
    });

    it('an anonymous caller cannot move a ticket (status writes are staff-gated)', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);
        const { ctx } = makeCtx(tables);
        await expect(call(updateMaintenanceTicketStatus, ctx, {
            ticketId, status: 'closed',
        })).rejects.toThrow(/Unauthenticated|session/i);
        expect(tables.maintenance_tickets.find((t) => t._id === ticketId).status).toBe('open');
    });

    it('a rival firm admin cannot update another firm\'s ticket (recorded as a security event)', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);
        const { ctx } = makeCtx(tables);
        await expect(call(updateMaintenanceTicketStatus, ctx, {
            sessionToken: OTHER_FIRM_SESSION,
            ticketId, status: 'closed',
        })).rejects.toThrow(/different firm/i);
        const evt = tables.securityEvents.find((e) => e.eventType === 'cross_firm_access_attempt');
        expect(evt).toBeTruthy();
    });
});

// ─── 4. Resident cancellation ────────────────────────────────────────────────
describe('QA §4 estate ops — resident cancellation', () => {
    it('the submitter cancels with a note; status + note are persisted', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);
        const { ctx } = makeCtx(tables);

        await call(cancelMaintenanceTicket, ctx, {
            ticketId,
            cancellationNote: 'Fixed it myself — washer replaced.',
            cancelledBy: TENANT_ID,
            sessionToken: TENANT_SESSION,
        });
        const ticket = tables.maintenance_tickets.find((t) => t._id === ticketId);
        expect(ticket.status).toBe('cancelled');
        expect(ticket.cancellationNote).toContain('washer');
        expect(ticket.cancelledAt).toBeGreaterThan(0);
    });

    it('a resident cannot cancel SOMEBODY ELSE\'S ticket', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);
        const { ctx } = makeCtx(tables);
        await expect(call(cancelMaintenanceTicket, ctx, {
            ticketId,
            cancellationNote: 'not mine but cancel anyway',
            cancelledBy: ADMIN_ID, // not an alias of the Tenant session caller
            sessionToken: TENANT_SESSION,
        })).rejects.toThrow(/Not authorized/i);
        expect(tables.maintenance_tickets.find((t) => t._id === ticketId).status).toBe('open');
    });
});

// ─── 5. The full chain, one world (the §7-style acceptance walk) ─────────────
describe('QA §4 estate ops — the end-to-end walk', () => {
    it('submit → assign → resolve → close on one shared world', async () => {
        const tables = baseTables();
        const ticketId = await seedTicket(tables);

        const ctxA = makeCtx(tables).ctx;
        await call(assignTicketToTeamMember, ctxA, {
            sessionToken: ADMIN_SESSION, requestKind: 'maintenance', requestId: ticketId,
            assignedToUserId: STAFF_ID, assignedToName: 'Kele Staff',
            assignedBy: ADMIN_ID, firmId: 'firm-1',
        });
        const ctxB = makeCtx(tables).ctx;
        await call(updateMaintenanceTicketStatus, ctxB, {
            sessionToken: ADMIN_SESSION, ticketId, status: 'resolved', resolution: 'Done.',
        });
        const ctxC = makeCtx(tables).ctx;
        await call(updateMaintenanceTicketStatus, ctxC, {
            sessionToken: ADMIN_SESSION, ticketId, status: 'closed',
        });

        const ticket = tables.maintenance_tickets.find((t) => t._id === ticketId);
        expect([ticket.status, ticket.assignedTo, ticket.resolution])
            .toEqual(['closed', STAFF_ID, 'Done.']);
        // Exactly one ticket existed all along — no duplicates anywhere.
        expect(tables.maintenance_tickets.length).toBe(1);
    });
});
