/**
 * roundEWave4.test.ts — ROUND E (Wave E4): list controls, authorised bulk
 * operations, template document generation, and the full 8-workflow
 * acceptance chain (owner brief §7).
 *
 * PINNED INVARIANTS:
 *
 * E4(a) THE ACCEPTANCE CHAIN (§7) — the eight workflows driven END-TO-END
 *   through the REAL handlers, one shared fixture world, each step asserting
 *   the state the next step depends on:
 *     ① create property  (myFunctions.createItem — the real save path)
 *     ② create unit      (myFunctions.addUnitToProperty — embedded unit)
 *     ③ register resident ④ allocate unit ⑤ record lease details
 *                        (tenancyLifecycle.allocateTenant — one guided flow)
 *     ⑥ renew lease      (renewTenancy — ended('renewed') + new active row)
 *     ⑦ terminate lease  (endTenancy — unit vacated, FINANCIAL HISTORY
 *                         SURVIVES: rentPaymentHistory byte-identical)
 *     ⑧ retrieve complete resident history (getResidentHistory +
 *                         getResidentProfile — every tenancy, every payment)
 *
 * E4(b) AUTHORISED BULK OPERATIONS (§4+§6): bulkUpdateProperties — staff
 *   session required (no session / dead token / portal / cross-firm all
 *   throw), enum-validated (fake statuses rejected — the OLD modal wrote
 *   'Available'/'Leased', values no surface recognises), ledger-guarded
 *   (a unit with an ACTIVE tenancy can never be bulk-marked
 *   Vacant/Listed/Sold — after ⑦ the same call succeeds), id-deduped,
 *   and the patch is whitelisted to status/category + audit fields ONLY.
 *
 * E4(c) LIST CONTROLS (§5): applyListControls — stable sort with nulls
 *   LAST in both directions, numeric-vs-string awareness, multi-field
 *   case-insensitive search, clamped pagination, pageSize 0 = show all.
 *
 * E4(d) TEMPLATE GENERATION (§4): buildTenancyTemplateContext +
 *   fillTemplate — ledger facts become tokens, money formatted exactly
 *   once, missing values stay VISIBLE [FILL: …] markers and are listed in
 *   unfilledKeys (never invented), every built-in template fills cleanly
 *   from a complete ledger row.
 *
 * E4(e) SOURCE CONTRACTS: 12 staff-authed publics in tenancyLifecycle
 *   (8 E1 + 2 E2 + 1 E3 + 1 E4); the bulk hook calls the mutation (no more
 *   client fan-out); both consoles wire applyListControls + Pagination;
 *   BulkEditPropertyModal offers only real enum values; the lifecycle
 *   panel mounts the document generator on active AND history rows with
 *   propertyId from PropertyDetailView.
 *
 * Testing style: the Round A/B/D/E1/E2/E3 behavioural harness
 * (fixture-backed mock ctx executing the real Convex handlers via
 * `_handler(ctx, args)`) plus pure-function and source-contract tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Code under test ─────────────────────────────────────────────────────────
import {
    allocateTenant,
    renewTenancy,
    endTenancy,
    getResidentHistory,
    getResidentProfile,
    bulkUpdateProperties,
} from '../../convex/tenancyLifecycle';
import { createItem, addUnitToProperty } from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';
import { applyListControls, sortRows } from '../../src/utils/listControls';
import {
    buildTenancyTemplateContext,
    fillTemplate,
    templateTokens,
    BUILT_IN_PROPERTY_TEMPLATES,
} from '../../src/utils/tenancyDocumentGeneration';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/tenancyLifecycle.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (the Round A/B/D/E harness) ─────────────────────
type Row = Record<string, any>;

interface Fixtures {
    session?: { token: string; userId: string };
    user?: Row;
    users?: Row[];
    tables?: Record<string, Row[]>;
}

const CMP: Record<string, (a: any, b: any) => boolean> = {
    eq: (a, b) => String(a) === String(b),
    neq: (a, b) => String(a) !== String(b),
    lt: (a, b) => (typeof a === 'number' && typeof b === 'number' ? a < b : String(a) < String(b)),
    lte: (a, b) => (typeof a === 'number' && typeof b === 'number' ? a <= b : String(a) <= String(b)),
    gt: (a, b) => (typeof a === 'number' && typeof b === 'number' ? a > b : String(a) > String(b)),
    gte: (a, b) => (typeof a === 'number' && typeof b === 'number' ? a >= b : String(a) >= String(b)),
};

function makeCtx(fix: Fixtures = {}) {
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
        tenancies: [],
        maintenance_tickets: [],
        properties: [],
        documents: [],
        service_charges: [],
        ledger_entries: [],
        ...(fix.tables ?? {}),
    };

    const findRows = (table: string, conds: Array<[string, string, any]>) =>
        (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => {
            const rv = r[f];
            if (rv === undefined) return false;
            return CMP[op](rv, v);
        }));

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
            withIndex: (_name: string, fn: (q: any) => any) => {
                const conds: Array<[string, string, any]> = [];
                const q: any = {
                    eq: (field: string, value: any) => { conds.push([field, 'eq', value]); return q; },
                    lt: (f: string, v: any) => { conds.push([f, 'lt', v]); return q; },
                    lte: (f: string, v: any) => { conds.push([f, 'lte', v]); return q; },
                    gte: (f: string, v: any) => { conds.push([f, 'gte', v]); return q; },
                    gt: (f: string, v: any) => { conds.push([f, 'gt', v]); return q; },
                    neq: (f: string, v: any) => { conds.push([f, 'neq', v]); return q; },
                };
                fn(q);
                return chainFor(findRows(table, conds));
            },
            filter: (fn: (q: any) => any) => {
                const conds: Array<[string, any]> = [];
                const q: any = { field: (f: string) => f, eq: (f: any, v: any) => { conds.push([String(f), v]); return q; } };
                try { fn(q); } catch { /* no conditions */ }
                const rows = (tables[table] ?? []).filter((r) =>
                    conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));
                return chainFor(rows);
            },
            order: (_d: string) => chainFor(tables[table] ?? []),
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
            const _id = `${table}_${tables[table]?.length ?? 0}_${Math.floor(Math.random() * 1e6)}`;
            (tables[table] = tables[table] ?? []).push({ _id, ...value });
            return _id as any;
        },
        patch: async (id: any, value: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r) => String(r._id) === idStr);
                if (hit) Object.assign(hit, value);
            }
            return null;
        },
        delete: async () => null,
    };

    const ctx: any = {
        db,
        runMutation: vi.fn(async () => ({ success: true })),
        runAction: vi.fn(async () => ({ success: true })),
        runQuery: vi.fn(async () => null),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables };
}

// ── Standard callers ────────────────────────────────────────────────────────
const ADMIN = { _id: 'u-admin-1', email: 'admin@firm1.com', tokenIdentifier: 'admin@firm1.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const FIRM2_ADMIN = { _id: 'u-f2-admin', email: 'admin@firm2.com', tokenIdentifier: 'admin@firm2.com', name: 'Bisi Firm2', role: 'Admin', firmId: 'firm-2' };
const FIRM2_ADMIN_SESSION = { token: 'tok-f2-admin', userId: 'u-f2-admin' };
const TENANT = { _id: 'u-tenant-1', email: 'resident@firm1.com', tokenIdentifier: 'resident@firm1.com', name: 'Tunde Tenant', role: 'Tenant', firmId: 'firm-1' };
const TENANT_SESSION = { token: 'tok-tenant-1', userId: 'u-tenant-1' };

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);
const AUTH = { sessionToken: 'tok-admin-xyz', userEmail: 'admin@firm1.com' };
const YEAR = new Date().getFullYear();

// ═══════════════════════════════════════════════════════════════════════════
// E4(a) — THE 8-WORKFLOW ACCEPTANCE CHAIN (owner brief §7)
// ═══════════════════════════════════════════════════════════════════════════
describe('E4(a) — the 8-workflow acceptance chain (§7), real handlers end-to-end', () => {
    // One shared fixture world — each workflow consumes the previous one's state.
    const world = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [FIRM2_ADMIN, TENANT] });
    let propertyId = '';
    let property2Id = '';
    let tenancy1Id = '';
    let renewedTenancyId = '';

    it('① create property — the real createItem save path, firm-scoped by session', async () => {
        const res = await call(createItem, world.ctx, {
            table: 'properties',
            userEmail: ADMIN.email,
            sessionToken: ADMIN_SESSION.token,
            data: {
                id: 'accept-prop-1',
                firmId: 'firm-1',
                address: '5 Adeola Odeku St, Victoria Island, Lagos',
                status: 'Vacant',
                category: 'Tenanted Property',
                value: 85000000,
                rentalDetails: { unitName: 'Block A', rentAmount: 5000000, rentFrequency: 'Annually' },
                rentPaymentHistory: [],
            },
        });
        expect(res?.id ?? res?._id ?? res).toBeTruthy();
        const rows = world.tables.properties as any[];
        const created = rows.find((r) => r.address === '5 Adeola Odeku St, Victoria Island, Lagos');
        expect(created).toBeTruthy();
        expect(created.firmId).toBe('firm-1');
        expect(String(created.status)).toBe('Vacant');
        propertyId = String(created._id);
    });

    it('② create unit — the real addUnitToProperty path (staff-authed, embedded unit)', async () => {
        await call(addUnitToProperty, world.ctx, {
            propertyId,
            firmId: 'firm-1',
            userEmail: ADMIN.email,
            sessionToken: ADMIN_SESSION.token,
            unitData: { id: 'unit-b1', unitName: 'Unit B1', status: 'Vacant' },
        });
        let parent = (world.tables.properties as any[]).find((p) => String(p._id) === propertyId);
        expect(parent.units).toHaveLength(1);
        expect(parent.units[0].unitName).toBe('Unit B1');
        expect(Number(parent.numberOfUnits)).toBe(1);

        // A second standalone property row = the sibling-unit model the
        // PropertyForm multi-unit path saves.
        await call(createItem, world.ctx, {
            table: 'properties',
            userEmail: ADMIN.email,
            sessionToken: ADMIN_SESSION.token,
            data: {
                id: 'accept-prop-2',
                firmId: 'firm-1',
                address: '5 Adeola Odeku St, Victoria Island, Lagos',
                status: 'Vacant',
                category: 'Tenanted Property',
                rentalDetails: { unitName: 'Unit A', rentAmount: 3000000, rentFrequency: 'Annually' },
                rentPaymentHistory: [],
            },
        });
        property2Id = String((world.tables.properties as any[]).find((p) => p.id === 'accept-prop-2')._id);
        expect(property2Id).toBeTruthy();
    });

    it('③④⑤ register resident + allocate unit + record lease details — one guided allocateTenant flow', async () => {
        const res = await call(allocateTenant, world.ctx, {
            ...AUTH,
            firmId: 'firm-1',
            unitId: propertyId, // the standalone/parent row itself
            tenantName: 'Chidi Okafor',
            tenantPhone: '+2348012345678',
            tenantEmail: 'chidi.okafor@example.com',
            leaseStart: `${YEAR}-01-01`,
            leaseEnd: `${YEAR}-12-31`,
            rentAmount: 5000000,
            rentFrequency: 'Annually',
            cautionDeposit: 500000,
            agencyFee: 250000,
            emergencyContactName: 'Ngozi Okafor',
            emergencyContactPhone: '+2348098765432',
            emergencyContactRelationship: 'Sister',
        });
        tenancy1Id = res.tenancyId;
        expect(tenancy1Id).toBeTruthy();
        expect(res.replayed).toBe(false);

        // The ledger row carries the full lease record (workflow ⑤).
        const row = (world.tables.tenancies as any[]).find((t) => String(t._id) === tenancy1Id);
        expect(row.tenantName).toBe('Chidi Okafor');
        expect(row.rentAmount).toBe(5000000);
        expect(row.paymentFrequency).toBe('Annually');
        expect(row.startDate).toBe(`${YEAR}-01-01`);
        expect(row.endDate).toBe(`${YEAR}-12-31`);
        expect(row.cautionDeposit).toBe(500000);
        expect(row.emergencyContactName).toBe('Ngozi Okafor');
        expect(row.status).toBe('active');
        expect(row.unitKey).toBe(propertyId);

        // The denormalized unit sync keeps every existing surface working.
        const parent = (world.tables.properties as any[]).find((p) => String(p._id) === propertyId);
        expect(parent.rentalDetails.tenantName).toBe('Chidi Okafor');
        expect(parent.status).toBe('Occupied');

        // Rent receipts land on the property and will be attributed to the
        // resident's windows (the payments the chain must preserve through ⑦).
        parent.rentPaymentHistory = [
            { paidDate: `${YEAR}-01-05`, amount: 5000000, status: 'paid' },
            { paidDate: `${YEAR}-02-05`, amount: 200000, status: 'paid' },
        ];
    });

    it('⑥ renew lease — ended("renewed") + a new active row with the new terms', async () => {
        const res = await call(renewTenancy, world.ctx, {
            ...AUTH,
            firmId: 'firm-1',
            tenancyId: tenancy1Id,
            newLeaseStart: `${YEAR + 1}-01-01`,
            newLeaseEnd: `${YEAR + 1}-12-31`,
            newRentAmount: 5500000,
            newRentFrequency: 'Annually',
        });
        renewedTenancyId = res.tenancyId;
        expect(renewedTenancyId).toBeTruthy();
        expect(renewedTenancyId).not.toBe(tenancy1Id);

        const old = (world.tables.tenancies as any[]).find((t) => String(t._id) === tenancy1Id);
        const next = (world.tables.tenancies as any[]).find((t) => String(t._id) === renewedTenancyId);
        expect(String(old.status)).toBe('ended');
        expect(String(old.endReason)).toBe('renewed');
        expect(String(old.renewedToTenancyId)).toBe(String(next._id));
        expect(String(next.previousTenancyId)).toBe(String(old._id));
        expect(next.rentAmount).toBe(5500000);
        expect(next.status).toBe('active');
    });

    it('⑦ terminate lease — unit vacated, FINANCIAL HISTORY PRESERVED VERBATIM', async () => {
        const historyBefore = JSON.stringify(
            (world.tables.properties as any[]).find((p) => String(p._id) === propertyId).rentPaymentHistory
        );

        await call(endTenancy, world.ctx, {
            ...AUTH,
            firmId: 'firm-1',
            tenancyId: renewedTenancyId,
            endReason: 'move_out',
            endDate: `${YEAR + 1}-06-30`,
        });

        const parent = (world.tables.properties as any[]).find((p) => String(p._id) === propertyId);
        // The unit's identity fields vacate…
        expect(parent.rentalDetails.tenantName ?? '').toBe('');
        expect(String(parent.status)).toBe('Vacant');
        // …but the money records are byte-identical (§6: a move-out never
        // deletes historical financial information).
        expect(JSON.stringify(parent.rentPaymentHistory)).toBe(historyBefore);

        const ended = (world.tables.tenancies as any[]).find((t) => String(t._id) === renewedTenancyId);
        expect(String(ended.status)).toBe('ended');
        expect(String(ended.endReason)).toBe('move_out');
        // The FIRST tenancy (pre-renewal) is untouched history.
        const first = (world.tables.tenancies as any[]).find((t) => String(t._id) === tenancy1Id);
        expect(String(first.status)).toBe('ended');
        expect(String(first.endReason)).toBe('renewed');
    });

    it('⑧ retrieve complete resident history — every tenancy, every payment, both reads', async () => {
        const history = await call(getResidentHistory, world.ctx, {
            ...AUTH,
            firmId: 'firm-1',
            tenantName: 'Chidi Okafor',
        });
        expect(history.tenancies).toHaveLength(2);
        // Active-first: the renewal (ended move_out) and the original
        // (ended renewed) both present, newest first.
        const ids = history.tenancies.map((t: any) => String(t._id));
        expect(ids).toContain(tenancy1Id);
        expect(ids).toContain(renewedTenancyId);
        // Payments attributed inside their lease windows.
        const paidTotal = history.tenancies.reduce((s: number, t: any) => s + Number(t.totalPaid || 0), 0);
        expect(paidTotal).toBe(5200000);

        const profile = await call(getResidentProfile, world.ctx, {
            ...AUTH,
            firmId: 'firm-1',
            tenantName: 'Chidi Okafor',
        });
        expect(profile.resident.name).toBe('Chidi Okafor');
        expect(profile.resident.emergencyContact?.name).toBe('Ngozi Okafor');
        expect(profile.tenancies).toHaveLength(2);
    });

    it('bulk status now succeeds on the vacated unit (the ⑦ → bulk handoff)', async () => {
        const res = await call(bulkUpdateProperties, world.ctx, {
            ...AUTH,
            firmId: 'firm-1',
            propertyIds: [propertyId],
            status: 'Listed',
        });
        expect(res.updated).toBe(1);
        expect(res.conflicts).toBe(0);
        const parent = (world.tables.properties as any[]).find((p) => String(p._id) === propertyId);
        expect(String(parent.status)).toBe('Listed');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// E4(b) — authorised bulk operations (§4 + §6)
// ═══════════════════════════════════════════════════════════════════════════
describe('E4(b) — bulkUpdateProperties: authorisation, validation, ledger guard', () => {
    const mkWorld = () => {
        const w = makeCtx({ user: ADMIN, session: ADMIN_SESSION, users: [FIRM2_ADMIN, TENANT] });
        w.tables.properties.push(
            {
                _id: 'bp-1', id: 'bp-1-custom', firmId: 'firm-1', address: '9 Bourdillon Rd, Ikoyi',
                status: 'Occupied', category: 'Tenanted Property',
            },
            {
                _id: 'bp-2', id: 'bp-2-custom', firmId: 'firm-1', address: '11 Kingsway Rd, Ikoyi',
                status: 'Vacant', category: 'Tenanted Property',
            },
            { _id: 'bp-f2', id: 'bp-f2-custom', firmId: 'firm-2', address: '2 Osborne Rd', status: 'Vacant' },
        );
        return w;
    };

    it('auth quartet: no session, dead token, portal role, cross-firm — all throw', async () => {
        const w = mkWorld();
        await expect(call(bulkUpdateProperties, w.ctx, {
            firmId: 'firm-1', propertyIds: ['bp-1'], status: 'Vacant',
        })).rejects.toThrow();
        await expect(call(bulkUpdateProperties, w.ctx, {
            sessionToken: 'never-issued', userEmail: ADMIN.email, firmId: 'firm-1',
            propertyIds: ['bp-1'], status: 'Vacant',
        })).rejects.toThrow();
        const portal = makeCtx({ user: TENANT, session: TENANT_SESSION });
        await expect(call(bulkUpdateProperties, portal.ctx, {
            sessionToken: TENANT_SESSION.token, userEmail: TENANT.email, firmId: 'firm-1',
            propertyIds: ['bp-1'], status: 'Vacant',
        })).rejects.toThrow(/Portal/i);
        const f2 = makeCtx({ user: FIRM2_ADMIN, session: FIRM2_ADMIN_SESSION });
        await expect(call(bulkUpdateProperties, f2.ctx, {
            sessionToken: FIRM2_ADMIN_SESSION.token, userEmail: FIRM2_ADMIN.email, firmId: 'firm-1',
            propertyIds: ['bp-1'], status: 'Vacant',
        })).rejects.toThrow();
    });

    it('enum validation: the stale modal values (Available/Leased/Under Renovation/Residential) are rejected', async () => {
        const w = mkWorld();
        for (const bad of ['Available', 'Leased', 'Under Renovation', 'For Sale']) {
            await expect(call(bulkUpdateProperties, w.ctx, {
                ...AUTH, firmId: 'firm-1', propertyIds: ['bp-2'], status: bad,
            })).rejects.toThrow(/Status must be one of/i);
        }
        await expect(call(bulkUpdateProperties, w.ctx, {
            ...AUTH, firmId: 'firm-1', propertyIds: ['bp-2'], category: 'Residential',
        })).rejects.toThrow(/Category must be one of/i);
    });

    it('happy path: status + category patched, ids deduped (any id shape), unknown + cross-firm skipped', async () => {
        const w = mkWorld();
        const res = await call(bulkUpdateProperties, w.ctx, {
            ...AUTH, firmId: 'firm-1',
            propertyIds: ['bp-1', 'bp-1', 'bp-2', 'bp-1-custom', 'never-existed', 'bp-f2'],
            status: 'Maintenance',
            category: 'Disputed Property',
        });
        // bp-1 twice + bp-1 by its CUSTOM id = ONE row (row-level dedup);
        // bp-2; unknown skipped; the firm-2 row skipped (never patched from
        // a firm-1 call).
        expect(res.updated).toBe(2);
        expect(res.skipped).toBe(2);
        expect(res.conflicts).toBe(0);
        const p1 = w.tables.properties.find((p) => p._id === 'bp-1')!;
        const p2 = w.tables.properties.find((p) => p._id === 'bp-2')!;
        const f2 = w.tables.properties.find((p) => p._id === 'bp-f2')!;
        expect(p1.status).toBe('Maintenance');
        expect(p1.category).toBe('Disputed Property');
        expect(p2.status).toBe('Maintenance');
        expect(f2.status).toBe('Vacant'); // untouched
    });

    it('ledger guard: an ACTIVE tenancy blocks vacant-class statuses but not others', async () => {
        const w = mkWorld();
        w.tables.tenancies.push({
            firmId: 'firm-1', propertyId: 'bp-2', unitKey: 'bp-2', unitId: 'bp-2',
            tenantName: 'Sitting Resident', status: 'active',
            startDate: `${YEAR}-01-01`, endDate: `${YEAR}-12-31`,
        });

        // Vacant-class attempts are REFUSED for this row.
        for (const status of ['Vacant', 'Listed', 'Sold']) {
            const res = await call(bulkUpdateProperties, w.ctx, {
                ...AUTH, firmId: 'firm-1', propertyIds: ['bp-2', 'bp-1'], status,
            });
            expect(res.updated).toBe(1); // only bp-1
            expect(res.conflicts).toBe(1);
            expect(res.conflictLabels.join(' ')).toContain('11 Kingsway Rd');
            expect(w.tables.properties.find((p) => p._id === 'bp-2')!.status).toBe('Vacant'); // unchanged
        }

        // Non-vacant statuses still apply (maintenance while resident lives there).
        const res2 = await call(bulkUpdateProperties, w.ctx, {
            ...AUTH, firmId: 'firm-1', propertyIds: ['bp-2'], status: 'Maintenance',
        });
        expect(res2.updated).toBe(1);
        expect(res2.conflicts).toBe(0);
        expect(w.tables.properties.find((p) => p._id === 'bp-2')!.status).toBe('Maintenance');
    });

    it('embedded-unit guard: an active tenancy on an embedded unit blocks the PARENT row', async () => {
        const w = makeCtx({ user: ADMIN, session: ADMIN_SESSION });
        w.tables.properties.push({
            _id: 'eb-1', id: 'eb-1-custom', firmId: 'firm-1', address: '3 Alexander Ave, Ikoyi',
            status: 'Occupied', units: [{ id: 'flat-a', unitName: 'Flat A', status: 'Occupied' }],
        });
        w.tables.tenancies.push({
            firmId: 'firm-1', propertyId: 'eb-1', unitKey: 'eb-1_flat-a', unitId: 'eb-1_flat-a',
            tenantName: 'Embedded Resident', status: 'active',
            startDate: `${YEAR}-01-01`, endDate: `${YEAR}-12-31`,
        });
        const res = await call(bulkUpdateProperties, w.ctx, {
            ...AUTH, firmId: 'firm-1', propertyIds: ['eb-1'], status: 'Vacant',
        });
        expect(res.updated).toBe(0);
        expect(res.conflicts).toBe(1);
        expect(w.tables.properties.find((p) => p._id === 'eb-1')!.status).toBe('Occupied');
    });

    it('the patch is whitelisted: only status/category + audit fields ever change', async () => {
        const w = mkWorld();
        const before = { ...w.tables.properties.find((p) => p._id === 'bp-2')! };
        await call(bulkUpdateProperties, w.ctx, {
            ...AUTH, firmId: 'firm-1', propertyIds: ['bp-2'], status: 'Occupied',
        });
        const after = w.tables.properties.find((p) => p._id === 'bp-2')!;
        expect(after.status).toBe('Occupied');
        expect(after.address).toBe(before.address);
        expect(after.firmId).toBe(before.firmId);
        expect(after.rentPaymentHistory).toBe(before.rentPaymentHistory); // same reference — never touched
        expect(after.category).toBe(before.category);
        expect(Number(after._version)).toBeGreaterThan(Number(before._version ?? 0));
    });

    it('guards: empty selection and empty payload throw (selection checked first)', async () => {
        const w = mkWorld();
        await expect(call(bulkUpdateProperties, w.ctx, { ...AUTH, firmId: 'firm-1', propertyIds: [] }))
            .rejects.toThrow(/at least one/i);
        await expect(call(bulkUpdateProperties, w.ctx, { ...AUTH, firmId: 'firm-1', propertyIds: ['bp-1'] }))
            .rejects.toThrow(/Nothing to update/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// E4(c) — list controls (§5): the pure search/sort/pagination brain
// ═══════════════════════════════════════════════════════════════════════════
describe('E4(c) — applyListControls: sort, search, paginate', () => {
    type RowT = { name: string; balance: number | null; leaseEnd: string | null };
    const rows: RowT[] = [
        { name: 'Bola Adebayo', balance: 45000, leaseEnd: `${YEAR}-06-30` },
        { name: 'ada ezeh', balance: null, leaseEnd: null },
        { name: 'Chidi Okafor', balance: 0, leaseEnd: `${YEAR + 1}-01-31` },
        { name: 'Ada Ezeh', balance: 9000000, leaseEnd: `${YEAR}-03-01` },
    ];

    it('stable sort: equal keys keep input order; strings compare case-insensitively', () => {
        const sorted = sortRows(rows, (r) => r.name, 'asc');
        // 'ada ezeh' and 'Ada Ezeh' tie case-insensitively — input order kept.
        expect(sorted.map((r) => r.name)).toEqual(['ada ezeh', 'Ada Ezeh', 'Bola Adebayo', 'Chidi Okafor']);
    });

    it('nulls LAST in both directions (a missing lease end is "unknown", not "earliest")', () => {
        const asc = sortRows(rows, (r) => r.leaseEnd, 'asc');
        expect(asc.map((r) => r.leaseEnd)).toEqual([`${YEAR}-03-01`, `${YEAR}-06-30`, `${YEAR + 1}-01-31`, null]);
        const desc = sortRows(rows, (r) => r.leaseEnd, 'desc');
        expect(desc[desc.length - 1].leaseEnd).toBeNull();
        expect(desc[0].leaseEnd).toBe(`${YEAR + 1}-01-31`);
    });

    it('numeric sort is numeric (₦90,000 AFTER ₦45,000, not by string)', () => {
        const desc = sortRows(rows, (r) => r.balance, 'desc');
        expect(desc.map((r) => r.balance)).toEqual([9000000, 45000, 0, null]);
    });

    it('search across multiple fields, case-insensitive; empty query matches all', () => {
        const fields = (r: RowT) => [r.name, String(r.leaseEnd ?? '')];
        expect(applyListControls(rows, { search: 'ADA', searchFields: fields }).total).toBe(2);
        expect(applyListControls(rows, { search: String(YEAR - 1), searchFields: fields }).total).toBe(0);
        expect(applyListControls(rows, { search: '   ', searchFields: fields }).total).toBe(4);
    });

    it('pagination: slices, clamps out-of-range pages, and reports from/to', () => {
        const many = Array.from({ length: 55 }, (_, i) => ({ name: `Resident ${i + 1}`, balance: i, leaseEnd: null }));
        const p1 = applyListControls(many, { pageSize: 25, page: 1 });
        expect(p1).toMatchObject({ total: 55, pageCount: 3, page: 1, from: 1, to: 25 });
        expect(p1.pageRows).toHaveLength(25);
        const p3 = applyListControls(many, { pageSize: 25, page: 3 });
        expect(p3).toMatchObject({ page: 3, from: 51, to: 55 });
        expect(p3.pageRows).toHaveLength(5);
        const clamped = applyListControls(many, { pageSize: 25, page: 99 });
        expect(clamped.page).toBe(3); // clamped to the last real page
        expect(clamped.pageRows).toHaveLength(5);
    });

    it('pageSize 0 = show all on one page; empty roster reports zero pages', () => {
        const all = applyListControls(rows, { pageSize: 0 });
        expect(all.pageRows).toHaveLength(4);
        expect(all.pageCount).toBe(1);
        const none = applyListControls([], { pageSize: 25, page: 1 });
        expect(none.pageCount).toBe(0);
        expect(none.from).toBe(0);
        expect(none.pageRows).toHaveLength(0);
    });

    it('composition: filter → search → sort → paginate in one call', () => {
        const result = applyListControls(rows, {
            filter: (r) => r.balance !== null,
            search: 'a',
            searchFields: (r) => [r.name],
            sortKey: (r) => r.balance,
            sortDir: 'desc',
            pageSize: 2,
            page: 1,
        });
        // filter drops 'ada ezeh'; search 'a' keeps all three named with 'a';
        // balance desc → 9,000,000 first; page 1 of 2.
        expect(result.total).toBe(3);
        expect(result.pageCount).toBe(2);
        expect(result.pageRows[0].name).toBe('Ada Ezeh');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// E4(d) — template document generation (§4)
// ═══════════════════════════════════════════════════════════════════════════
describe('E4(d) — tenancyDocumentGeneration: context, fill, built-ins', () => {
    const fullInput = {
        tenantName: 'Chidi Okafor',
        tenantPhone: '+2348012345678',
        tenantEmail: 'chidi.okafor@example.com',
        unitLabel: 'Unit A · 5 Adeola Odeku St',
        propertyAddress: '5 Adeola Odeku St, Victoria Island, Lagos',
        leaseStart: `${YEAR}-01-01`,
        leaseEnd: `${YEAR}-12-31`,
        rentAmount: 5000000,
        rentFrequency: 'Annually',
        cautionDeposit: 500000,
        emergencyContactName: 'Ngozi Okafor',
        emergencyContactPhone: '+2348098765432',
        emergencyContactRelationship: 'Sister',
        outstandingBalance: 75000,
        firmName: 'Ikoyi Property Managers Ltd',
    };

    it('buildTenancyTemplateContext: money formatted once, dates humanised, optionals absent when unknown', () => {
        const ctx = buildTenancyTemplateContext(fullInput);
        expect(ctx.tenantName).toBe('Chidi Okafor');
        expect(ctx.rentAmount).toBe('NGN 5,000,000.00');
        expect(ctx.cautionDeposit).toBe('NGN 500,000.00');
        expect(ctx.outstandingBalance).toBe('NGN 75,000.00');
        expect(ctx.leaseEnd).toMatch(/^\d{1,2} December \d{4}$/);
        expect(ctx.today).toBeTruthy();

        const sparse = buildTenancyTemplateContext({
            tenantName: 'Only A Name',
            unitLabel: 'Unit B',
            propertyAddress: 'Somewhere',
            firmName: 'Firm',
        });
        expect(sparse.rentAmount).toBeUndefined();
        expect(sparse.tenantPhone).toBeUndefined();
    });

    it('fillTemplate: substitutes every spelling of a token; missing values become visible markers and are listed', () => {
        const filled = fillTemplate(
            'Dear {{tenantName}} / {{ TENANTNAME }}, rent {{rentAmount}} due. Guarantor: {{guarantorName}}.',
            buildTenancyTemplateContext(fullInput)
        );
        expect(filled.content).toContain('Dear Chidi Okafor / Chidi Okafor, rent NGN 5,000,000.00 due.');
        expect(filled.content).toContain('[FILL: guarantorName]');
        expect(filled.unfilledKeys).toEqual(['guarantorName']);
    });

    it('every built-in template fills from a complete ledger row with ZERO unfilled tokens', () => {
        expect(BUILT_IN_PROPERTY_TEMPLATES.length).toBeGreaterThanOrEqual(6);
        for (const tpl of BUILT_IN_PROPERTY_TEMPLATES) {
            const filled = fillTemplate(tpl.content, buildTenancyTemplateContext(fullInput));
            expect(filled.unfilledKeys).toEqual([]);
            expect(filled.content).not.toContain('[FILL:');
            expect(filled.content).toContain('Chidi Okafor');
        }
    });

    it('a sparse ledger row still generates — missing facts stay VISIBLE, never invented', () => {
        const agreement = BUILT_IN_PROPERTY_TEMPLATES.find((t) => t.id === 'builtin-tenancy-agreement')!;
        const filled = fillTemplate(
            agreement.content,
            buildTenancyTemplateContext({
                tenantName: 'New Resident',
                unitLabel: 'Unit Z',
                propertyAddress: '1 New Place',
                firmName: 'Firm',
            })
        );
        expect(filled.unfilledKeys).toContain('rentAmount');
        expect(filled.unfilledKeys).toContain('leaseStart');
        expect(filled.content).toContain('[FILL: rentAmount]');
        expect(filled.content).toContain('New Resident');
        expect(filled.content).toContain('1 New Place');
    });

    it('templateTokens lists the distinct declared tokens', () => {
        expect(templateTokens('{{a}} and {{ a }} plus {{b}}')).toEqual(['a', 'b']);
        expect(templateTokens('no tokens here')).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// E4(e) — source contracts
// ═══════════════════════════════════════════════════════════════════════════
describe('E4(e) — source contracts', () => {
    it('the lifecycle module: 12 staff-authed publics (8 E1 + 2 E2 + 1 E3 + 1 E4)', () => {
        const mod = read('convex/tenancyLifecycle.ts');
        expect((mod.match(/requireStaffCaller\(/g) || []).length).toBe(13); // + the Round F Wave F1 resident bill
        expect(mod).toContain('export const bulkUpdateProperties');
        // The ledger guard and the whitelist are structural, not incidental.
        expect(mod).toContain('VACANT_CLASS_STATUSES');
        expect(mod).toContain('Bulk updates are capped at 500 properties per call.');
    });

    it('useProperties calls the ONE staff-authed bulk mutation (no client fan-out)', () => {
        const hook = read('src/hooks/useProperties.ts');
        expect(hook).toContain('api.tenancyLifecycle.bulkUpdateProperties');
        expect(hook).not.toContain("ids.map(id => actions.updateItem");
    });

    it('both consoles wire applyListControls + the shared Pagination primitive', () => {
        const props = read('src/components/PropertyManagerView.tsx');
        expect(props).toContain('applyListControls');
        expect(props).toContain('<Pagination');
        expect(props).toContain('sortRows(');
        const residents = read('src/components/atrium/ResidentDirectory.tsx');
        expect(residents).toContain('applyListControls');
        expect(residents).toContain('<Pagination');
        const uiIndex = read('src/components/ui/index.ts');
        expect(uiIndex).toContain("export { Pagination } from './Pagination'");
    });

    it('the Pagination primitive is ui-primitives-only (ADR-0004)', () => {
        const p = read('src/components/ui/Pagination.tsx');
        expect(p).toContain("from './Button'");
        expect(p).toContain("from './Select'");
        // Case-SENSITIVE: raw elements are lowercase; the primitives are
        // capitalized, so <Button>/<Select must NOT match.
        expect(/<(button|input|select|textarea)[\s>]/.test(p)).toBe(false);
    });

    it('BulkEditPropertyModal offers ONLY real enum values (the stale options are gone)', () => {
        const modal = read('src/components/modals/BulkEditPropertyModal.tsx');
        expect(modal).not.toContain('"Available"');
        expect(modal).not.toContain('"Leased"');
        expect(modal).not.toContain('"Under Renovation"');
        expect(modal).not.toContain('"Residential"');
        expect(modal).toContain('"Occupied"');
        expect(modal).toContain('"Tenanted Property"');
    });

    it('the lifecycle panel mounts the document generator on ACTIVE and HISTORY rows', () => {
        const panel = read('src/components/details/TenancyLifecyclePanel.tsx');
        expect(panel).toContain('TenancyDocumentGenerator');
        expect(panel).toContain("open?.kind === 'document'");
        expect(panel).toContain('docRowId === rowId');
        expect(panel).toContain('propertyId={propertyId || unit.id}');
        const detail = read('src/components/details/PropertyDetailView.tsx');
        expect((detail.match(/propertyId=\{property\.id\}/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it('the generator previews + hands the filled draft to the REAL document pipeline with propertyId', () => {
        const gen = read('src/components/details/TenancyDocumentGenerator.tsx');
        expect(gen).toContain("openModal('newDocument'");
        expect(gen).toContain('draftTitle');
        expect(gen).toContain('draftContent');
        expect(gen).toContain('propertyId: props.propertyId');
        expect(gen).toContain('unfilledKeys');
        expect(gen).toContain('BUILT_IN_PROPERTY_TEMPLATES');
    });
});
