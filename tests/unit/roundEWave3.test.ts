/**
 * roundEWave3.test.ts — ROUND E (Wave E3) regression tests: the per-property
 * financial summary read, the intelligent PropertyForm validation/duplicate
 * detection brain, and the property-documents revival wiring.
 *
 * PINNED INVARIANTS:
 *
 * E3(a) AUTH + FIRM SCOPE (getPropertyFinancialSummary): requireStaffCaller
 *   + assertSameFirm — no session → throw; dead token → throw; portal roles
 *   → throw; a firm-1 staff passing firm-2 → throw; firm-2's own staff see
 *   ONLY firm-2 rows (a firm-2 property at the SAME ADDRESS as a firm-1
 *   property never leaks into firm-1's group).
 *
 * E3(b) THE SUMMARY IS LEDGER TRUTH, SHAPE-PROOF: the property group = every
 *   firm row sharing the anchor's NORMALIZED address (sibling rows = units)
 *   plus embedded units; charges and ledger rows match through the E1
 *   resolver — a charge stored under the CUSTOM unit id matches a row stored
 *   under the Convex _id, and a composite `${customId}_${unitName}` id
 *   matches the embedded unit. Voided/test ledger records are excluded and
 *   COUNTED. Receipts follow the unit-first attribution rule (embedded-unit
 *   history before property-level; property-level only when exactly one
 *   embedded unit OR exactly one tenanted). Occupancy comes from the E1
 *   tenancy ledger. Service-charge outstanding is credit-netted (Round B).
 *
 * E3(c) INTELLIGENT FORMS (pure functions, src/utils/propertyFormValidation):
 *   rent required on EVERY rent-collecting unit (the old guard checked Unit
 *   1 only); lease windows cannot invert; email/phone optional but valid;
 *   money non-negative; duplicate detection = same normalized address + same
 *   normalized unit name OUTSIDE the edit session (in-session siblings are
 *   the legitimate multi-unit model), with a separate other-owner signal.
 *
 * E3(d) SOURCE CONTRACTS: 11 staff-authed publics in tenancyLifecycle
 *   (8 E1 + 2 E2 + 1 E3); the panel is ui-primitives-only and wired into
 *   PropertyDetailView's financials tab; PropertyForm wires validation +
 *   duplicate scan + resident live-match + confirm-before-unit-removal and
 *   the harmonized Monthly default; DocumentsTab stamps propertyId via
 *   uploadContext and downloads storage-id files; the property documents
 *   section matches propertyId (+ the legacy prop_ matterId bridge), never
 *   the old title-address heuristic.
 *
 * Testing style: the Round A/B/D/E1/E2 behavioural harness (fixture-backed
 * mock ctx executing the real Convex handlers via `_handler(ctx, args)`)
 * plus pure-function tests and source-contract tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Code under test ─────────────────────────────────────────────────────────
import { getPropertyFinancialSummary } from '../../convex/tenancyLifecycle';
import { hashSessionToken } from '../../convex/sessions';
import {
    validatePropertyForm,
    scanForDuplicateUnits,
    isValidEmail,
    isValidPhone,
} from '../../src/utils/propertyFormValidation';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/tenancyLifecycle.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed mock ctx (the Round A/B/D/E1/E2 harness) ────────────────
type Row = Record<string, any>;

interface Fixtures {
    session?: { token: string; userId: string };
    user?: Row;
    users?: Row[];
    tables?: Record<string, Row[]>;
}

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
        properties: [],
        service_charges: [],
        ledger_entries: [],
        maintenance_tickets: [],
        tenancies: [],
        ...(fix.tables ?? {}),
    };

    const findRows = (table: string, conds: Array<[string, string, any]>) =>
        (tables[table] ?? []).filter((r) => conds.every(([f, op, v]) => {
            const rv = r[f];
            if (rv === undefined) return false;
            if (op === 'eq') return String(rv) === String(v);
            return true;
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
            const _id = `${table}_${tables[table]?.length ?? 0}`;
            (tables[table] = tables[table] ?? []).push({ _id, ...value });
            return _id as any;
        },
        patch: async () => null,
        delete: async () => null,
    };

    return { ctx: { db, auth: { getUserIdentity: async () => null } }, tables };
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

// ── Property fixtures ───────────────────────────────────────────────────────
// Building A: the SIBLING-ROW model — two unit rows at the same address.
const A_U1 = {
    _id: 'conv-a1', id: 'cust-a1', firmId: 'firm-1',
    address: '10 Adeola Odeku St, Victoria Island, Lagos',
    status: 'Occupied',
    rentalDetails: {
        unitName: 'Unit 1', rentAmount: 2000000, rentFrequency: 'Annually',
        leaseStart: `${YEAR}-01-01`, leaseEnd: `${YEAR}-12-31`, tenantName: 'Ada Alpha',
    },
    rentPaymentHistory: [
        { paidDate: `${YEAR}-01-05`, amount: 2000000, status: 'paid' },
        { paidDate: `${YEAR - 1}-01-05`, amount: 1800000, status: 'paid' },
        { dueDate: `${YEAR}-02-05`, amount: 70000, status: 'pending' }, // not a receipt
    ],
};
const A_U2 = {
    _id: 'conv-a2', id: 'cust-a2', firmId: 'firm-1',
    address: '10 adeola odeku st, victoria island, lagos', // case-drifted — same group
    status: 'Vacant',
    rentalDetails: { unitName: 'Unit 2', rentAmount: 1500000 },
    rentPaymentHistory: [],
};
// Property B: the EMBEDDED-UNITS model (legacy).
const B_EMBEDDED = {
    _id: 'conv-b1', id: 'cust-b1', firmId: 'firm-1',
    address: '22 Bourdillon Rd, Ikoyi, Lagos',
    status: 'Occupied',
    rentPaymentHistory: [{ paidDate: `${YEAR}-03-01`, amount: 100000, status: 'paid' }],
    units: [
        {
            id: 'emb-1', unitName: 'Flat A', status: 'Occupied', tenantName: 'Bola Beta',
            rentAmount: 5000000,
            rentPaymentHistory: [{ paidDate: `${YEAR}-02-01`, amount: 5000000, status: 'paid' }],
        },
        { id: 'emb-2', unitName: 'Flat B', status: 'Vacant' },
    ],
};
// A firm-2 property at the SAME address as Building A — must never join
// firm-1's group (and vice versa).
const F2_SAME_ADDRESS = {
    _id: 'conv-f2', id: 'cust-f2', firmId: 'firm-2',
    address: '10 Adeola Odeku St, Victoria Island, Lagos',
    status: 'Occupied', rentalDetails: { unitName: 'Unit 1', rentAmount: 9999999 },
};

// ── Service charges (three id shapes; one unresolvable) ─────────────────────
const CH_A1_CUSTOM = {
    _id: 'ch-a1', firmId: 'firm-1', unitId: 'cust-a1', // custom id shape
    category: 'Diesel', amount: 50000, serviceChargeStatus: 'UNPAID', creditCarriedForward: 5000,
};
const CH_A2_CONVEX = {
    _id: 'ch-a2', firmId: 'firm-1', unitId: 'conv-a2', // Convex _id shape
    category: 'Security', amount: 20000, serviceChargeStatus: 'PARTIALLY_PAID', outstandingBalance: 8000, amountPaidThisCycle: 12000,
};
const CH_B_COMPOSITE = {
    _id: 'ch-b1', firmId: 'firm-1', unitId: 'cust-b1_Flat A', // composite shape (custom-id prefix)
    category: 'Cleaning', amount: 30000, serviceChargeStatus: 'UNPAID',
};
const CH_UNRESOLVABLE = {
    _id: 'ch-zz', firmId: 'firm-1', unitId: 'unit-that-never-existed',
    category: 'Water', amount: 999999, serviceChargeStatus: 'UNPAID',
};

// ── Ledger entries (propertyId-keyed, custom/convex, composite, voided/test) ─
const ts = (month: number) => new Date(`${YEAR}-${String(month).padStart(2, '0')}-10`).getTime();
const LED_RENT_A1 = {
    _id: 'led-1', firmId: 'firm-1', propertyId: 'conv-a1', unitId: 'cust-a1',
    amount: 2000000, type: 'rent', status: 'cleared', timestamp: ts(1),
};
const LED_PENDING_A1 = {
    _id: 'led-2', firmId: 'firm-1', propertyId: 'cust-a1', // the CUSTOM id spelling
    amount: 500000, type: 'rent', status: 'pending', timestamp: ts(2),
};
const LED_DEFAULT_B = {
    _id: 'led-3', firmId: 'firm-1', unitId: 'conv-b1_emb-1', // composite (convex prefix)
    amount: 300000, type: 'service_charge', status: 'defaulted', timestamp: ts(3),
};
const LED_VOIDED = {
    _id: 'led-4', firmId: 'firm-1', propertyId: 'conv-a1',
    amount: 999999, type: 'rent', status: 'cleared', recordStatus: 'voided', timestamp: ts(4),
};
const LED_TEST = {
    _id: 'led-5', firmId: 'firm-1', propertyId: 'conv-a1',
    amount: 888888, type: 'rent', status: 'cleared', recordStatus: 'test', timestamp: ts(5),
};
const LED_OTHER_ADDRESS = {
    _id: 'led-6', firmId: 'firm-1', propertyId: 'conv-elsewhere',
    amount: 777777, type: 'rent', status: 'cleared', timestamp: ts(6),
};

// ── Maintenance / tenancies ─────────────────────────────────────────────────
const MT_OPEN = { _id: 'mt-1', firmId: 'firm-1', propertyId: 'conv-a1', status: 'open' };
const MT_RESOLVED = { _id: 'mt-2', firmId: 'firm-1', propertyId: 'cust-a2', status: 'resolved' };
const MT_ELSEWHERE = { _id: 'mt-3', firmId: 'firm-1', propertyId: 'conv-elsewhere', status: 'open' };
const TEN_ACTIVE_A1 = { _id: 'ten-1', firmId: 'firm-1', unitKey: 'conv-a1', status: 'active' };
const TEN_ENDED_B = { _id: 'ten-2', firmId: 'firm-1', unitKey: 'conv-b1_emb-1', status: 'ended' };

const baseTables = (): Record<string, Row[]> => ({
    properties: [A_U1, A_U2, B_EMBEDDED, F2_SAME_ADDRESS],
    service_charges: [CH_A1_CUSTOM, CH_A2_CONVEX, CH_B_COMPOSITE, CH_UNRESOLVABLE],
    ledger_entries: [LED_RENT_A1, LED_PENDING_A1, LED_DEFAULT_B, LED_VOIDED, LED_TEST, LED_OTHER_ADDRESS],
    maintenance_tickets: [MT_OPEN, MT_RESOLVED, MT_ELSEWHERE],
    tenancies: [TEN_ACTIVE_A1, TEN_ENDED_B],
});

const summaryCtx = () => makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: baseTables() });

// ═══════════════════════════════════════════════════════════════════════════
describe('E3(a) — getPropertyFinancialSummary: auth + firm scope', () => {
    it('rejects anonymous, dead-token, portal and cross-firm callers', async () => {
        const noSession = makeCtx({ user: ADMIN, tables: baseTables() });
        await expect(call(getPropertyFinancialSummary, noSession.ctx, { firmId: 'firm-1', propertyId: 'conv-a1', userEmail: 'admin@firm1.com' }))
            .rejects.toThrow(/Unauthenticated/i);

        const deadToken = makeCtx({ user: ADMIN, tables: baseTables() }); // no session row
        await expect(call(getPropertyFinancialSummary, deadToken.ctx, { firmId: 'firm-1', propertyId: 'conv-a1', sessionToken: 'tok-dead', userEmail: 'admin@firm1.com' }))
            .rejects.toThrow(/invalid|Unauthenticated/i);

        const portal = makeCtx({ user: TENANT, session: TENANT_SESSION, tables: baseTables() });
        await expect(call(getPropertyFinancialSummary, portal.ctx, { firmId: 'firm-1', propertyId: 'conv-a1', sessionToken: 'tok-tenant-1', userEmail: 'resident@firm1.com' }))
            .rejects.toThrow(/Portal users/i);

        const crossFirm = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: baseTables() });
        await expect(call(getPropertyFinancialSummary, crossFirm.ctx, { firmId: 'firm-2', propertyId: 'conv-f2', sessionToken: 'tok-admin-xyz', userEmail: 'admin@firm1.com' }))
            .rejects.toThrow(/different firm|Not authorized/i);
    });

    it('throws a clear error for an unknown property id', async () => {
        const { ctx } = summaryCtx();
        await expect(call(getPropertyFinancialSummary, ctx, { ...AUTH, firmId: 'firm-1', propertyId: 'no-such-property' }))
            .rejects.toThrow(/Property not found/i);
    });

    it('firm-2 staff see ONLY firm-2 rows — the same-address firm-1 building never joins their group', async () => {
        const { ctx } = makeCtx({ user: FIRM2_ADMIN, session: FIRM2_ADMIN_SESSION, tables: baseTables() });
        const out = await call(getPropertyFinancialSummary, ctx, {
            sessionToken: 'tok-f2-admin', userEmail: 'admin@firm2.com',
            firmId: 'firm-2', propertyId: 'conv-f2',
        });
        expect(out.counts.units).toBe(1); // their own row only
        expect(out.units[0].key).toBe('conv-f2');
        expect(out.ledger.cleared).toBe(0); // firm-1 money never leaks
        expect(out.serviceCharges.count).toBe(0);
        expect(out.receipts.totalPaid).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('E3(b) — the summary is ledger truth, shape-proof', () => {
    it('rolls up the sibling-row building (anchor by Convex id): charges matched across id shapes, voided/test excluded', async () => {
        const { ctx } = summaryCtx();
        const out = await call(getPropertyFinancialSummary, ctx, { ...AUTH, firmId: 'firm-1', propertyId: 'conv-a1' });

        // The group: A_U1 + A_U2 (case-drifted address) — NOT B_EMBEDDED (different address), NOT F2 (other firm).
        expect(out.counts.units).toBe(2);
        expect(out.units.map((u: any) => u.key).sort()).toEqual(['conv-a1', 'conv-a2']);

        // Ledger: cleared 2,000,000 + pending 500,000; the custom-id propertyId row matched; voided + test excluded and counted.
        expect(out.ledger.cleared).toBe(2000000);
        expect(out.ledger.pending).toBe(500000);
        expect(out.ledger.defaulted).toBe(0); // LED_DEFAULT_B is Building B's
        expect(out.ledger.voidedExcluded).toBe(1);
        expect(out.ledger.testExcluded).toBe(1);
        expect(out.ledger.byType.rent.cleared).toBe(2000000);
        expect(out.ledger.byType.rent.pending).toBe(500000);

        // Rent YTD: only the current-year cleared rent entry.
        expect(out.rentCollected.ytdLedger).toBe(2000000);

        // Service charges: the custom-id charge matched A_U1, the Convex-id charge matched A_U2.
        expect(out.serviceCharges.count).toBe(2);
        expect(out.serviceCharges.unpaid).toBe(1);
        expect(out.serviceCharges.partial).toBe(1);
        // UNPAID 50,000 − 5,000 credit + PARTIAL outstanding 8,000 = 53,000 (credit-netted).
        expect(out.serviceCharges.outstanding).toBe(53000);
        expect(out.serviceCharges.creditCarriedForward).toBe(5000);

        // Per-unit outstanding carried to the unit rows.
        const u1 = out.units.find((u: any) => u.key === 'conv-a1');
        const u2 = out.units.find((u: any) => u.key === 'conv-a2');
        expect(u1.chargesOutstanding).toBe(45000);
        expect(u2.chargesOutstanding).toBe(8000);

        // Receipts: unit-first — A_U1's own history (2 paid receipts; the pending row is NOT a receipt).
        expect(out.receipts.count).toBe(2);
        expect(out.receipts.totalPaid).toBe(3800000);
        expect(out.receipts.ytdPaid).toBe(2000000);
        expect(u1.receiptsPaid).toBe(3800000);
        expect(u2.receiptsPaid).toBe(0);

        // Maintenance: both id spellings matched, one open.
        expect(out.maintenance.total).toBe(2);
        expect(out.maintenance.open).toBe(1);

        // Occupancy: the E1 ledger says one active tenancy (on conv-a1).
        expect(out.counts.activeTenancies).toBe(1);
        expect(out.counts.totalTenancies).toBe(1);
        expect(u1.activeTenancy).toBe(true);
        expect(u2.activeTenancy).toBe(false);
        expect(out.counts.statusOccupied).toBe(1);
        expect(out.counts.statusVacant).toBe(1);

        // The unresolvable charge and the other-address ledger row never matched.
        expect(out.serviceCharges.count).toBe(2); // not 3
        expect(out.ledger.cleared).toBe(2000000); // not 2,777,777
    });

    it('rolls up the embedded-units building (anchor by CUSTOM id): composite charges + property-level receipt fallback', async () => {
        const { ctx } = summaryCtx();
        const out = await call(getPropertyFinancialSummary, ctx, { ...AUTH, firmId: 'firm-1', propertyId: 'cust-b1' });

        // Two embedded units, keys under the parent Convex id.
        expect(out.counts.units).toBe(2);
        expect(out.units.map((u: any) => u.key).sort()).toEqual(['conv-b1_emb-1', 'conv-b1_emb-2']);

        // The composite charge (custom-id prefix spelling) matched Flat A through the resolver.
        expect(out.serviceCharges.count).toBe(1);
        expect(out.serviceCharges.outstanding).toBe(30000);
        const flatA = out.units.find((u: any) => u.key === 'conv-b1_emb-1');
        expect(flatA.chargesOutstanding).toBe(30000);

        // The composite ledger row (convex prefix spelling) matched — defaulted.
        expect(out.ledger.defaulted).toBe(300000);
        expect(out.ledger.byType.service_charge.defaulted).toBe(300000);

        // Receipts: Flat A's OWN unit history (5,000,000) + Flat B via the
        // single-tenanted property-level fallback (100,000).
        expect(flatA.receiptsPaid).toBe(5000000);
        const flatB = out.units.find((u: any) => u.key === 'conv-b1_emb-2');
        expect(flatB.receiptsPaid).toBe(100000);
        expect(out.receipts.totalPaid).toBe(5100000);

        // Occupancy: one ended tenancy on Flat A (recorded history, none active).
        expect(out.counts.totalTenancies).toBe(1);
        expect(out.counts.activeTenancies).toBe(0);
        expect(flatA.activeTenancy).toBe(false);
    });

    it('returns zeros (not nulls) for a property with nothing recorded', async () => {
        const empty: Record<string, Row[]> = {
            properties: [{ _id: 'conv-empty', id: 'cust-empty', firmId: 'firm-1', address: '1 Empty St', rentalDetails: {} }],
            service_charges: [CH_A1_CUSTOM], // belongs to another property
            ledger_entries: [LED_RENT_A1],
            maintenance_tickets: [MT_OPEN],
            tenancies: [TEN_ACTIVE_A1],
        };
        const { ctx } = makeCtx({ user: ADMIN, session: ADMIN_SESSION, tables: empty });
        const out = await call(getPropertyFinancialSummary, ctx, { ...AUTH, firmId: 'firm-1', propertyId: 'conv-empty' });
        expect(out.counts.units).toBe(1);
        expect(out.ledger.cleared).toBe(0);
        expect(out.serviceCharges.count).toBe(0);
        expect(out.serviceCharges.outstanding).toBe(0);
        expect(out.receipts.totalPaid).toBe(0);
        expect(out.maintenance.total).toBe(0);
        expect(out.counts.activeTenancies).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('E3(c) — intelligent forms: pure validation + duplicate detection', () => {
    const goodUnit = (over: Record<string, any> = {}) => ({
        unitName: 'Unit 1', rentAmount: 1000000, leaseStart: '2026-01-01', leaseEnd: '2026-12-31',
        tenantEmail: '', tenantPhone: '', serviceChargeAmount: 0, serviceChargeMonthsInAdvance: 0,
        legalFee: 0, agencyFee: 0, cautionDeposit: 0, ...over,
    });

    it('passes a clean form with empty errors', () => {
        const out = validatePropertyForm({
            address: '10 Adeola Odeku St', units: [goodUnit()], rentCollecting: true,
            isTenanted: true, managementFee: 10, minimumVendAmount: 0,
        });
        expect(out.errors).toEqual({});
        expect(out.unitErrors).toEqual({});
    });

    it('requires the address', () => {
        const out = validatePropertyForm({ address: '   ', units: [goodUnit()], rentCollecting: true, isTenanted: true });
        expect(out.errors.address).toMatch(/address/i);
    });

    it('requires rent on EVERY rent-collecting unit — the Unit-2 gap the old guard missed', () => {
        const out = validatePropertyForm({
            address: '10 Adeola', units: [goodUnit(), goodUnit({ unitName: 'Unit 2', rentAmount: 0 })],
            rentCollecting: true, isTenanted: true,
        });
        expect(out.unitErrors[0]).toBeUndefined();
        expect(out.unitErrors[1].rentAmount).toMatch(/Unit 2/);
    });

    it('does not require rent for Management Only or non-tenanted properties', () => {
        const mgmt = validatePropertyForm({ address: 'x', units: [goodUnit({ rentAmount: 0 })], rentCollecting: false, isTenanted: true });
        expect(mgmt.unitErrors[0]?.rentAmount).toBeUndefined();
        const sale = validatePropertyForm({ address: 'x', units: [goodUnit({ rentAmount: 0 })], rentCollecting: true, isTenanted: false });
        expect(sale.unitErrors[0]?.rentAmount).toBeUndefined();
    });

    it('rejects inverted lease windows, invalid emails and short phones', () => {
        const out = validatePropertyForm({
            address: 'x',
            units: [goodUnit({ leaseStart: '2026-12-31', leaseEnd: '2026-01-01', tenantEmail: 'not-an-email', tenantPhone: '0803' })],
            rentCollecting: false, isTenanted: true,
        });
        expect(out.unitErrors[0].leaseEnd).toMatch(/before/i);
        expect(out.unitErrors[0].tenantEmail).toMatch(/valid email/i);
        expect(out.unitErrors[0].tenantPhone).toMatch(/7 digits/i);
    });

    it('accepts valid optional contact details and enforces money bounds', () => {
        expect(isValidEmail('resident@example.com')).toBe(true);
        expect(isValidPhone('+234 803 000 0001')).toBe(true);
        const out = validatePropertyForm({
            address: 'x',
            units: [goodUnit({ cautionDeposit: -5000, serviceChargeMonthsInAdvance: 30 })],
            rentCollecting: false, isTenanted: true, managementFee: 150, minimumVendAmount: -5,
        });
        expect(out.unitErrors[0].cautionDeposit).toMatch(/negative/i);
        expect(out.unitErrors[0].serviceChargeMonthsInAdvance).toMatch(/0 and 24/i);
        expect(out.errors.managementFee).toMatch(/0 and 100/i);
        expect(out.errors.minimumVendAmount).toMatch(/negative/i);
    });

    it('duplicate detection: same address + same unit name outside the session is a hit; in-session siblings never are', () => {
        const properties = [
            { id: 'p1', _id: 'c1', address: '10 Adeola Odeku St', contactId: 'owner-1', rentalDetails: { unitName: 'Unit 1' } },
            { id: 'p2', _id: 'c2', address: '10 adeola odeku st', contactId: 'owner-1', rentalDetails: { unitName: 'Unit 2' } },
        ];
        // Creating "Unit 1" fresh → duplicate hit on p1.
        const create = scanForDuplicateUnits({
            properties, address: '10 ADEOLA ODEKU ST', units: [{ unitName: 'Unit 1' }], ownerContactId: 'owner-1',
        });
        expect(create.duplicateUnits).toHaveLength(1);
        expect(create.duplicateUnits[0].formUnitIndex).toBe(0);
        expect(create.duplicateUnits[0].existingId).toBe('p1');
        expect(create.otherOwnerRows).toBe(0);

        // Editing the session that already owns both rows → never a hit.
        const edit = scanForDuplicateUnits({
            properties, address: '10 Adeola Odeku St',
            units: [{ unitName: 'Unit 1', id: 'p1' }, { unitName: 'Unit 2', id: 'p2' }],
            editingIds: ['p1', 'c1'], ownerContactId: 'owner-1',
        });
        expect(edit.duplicateUnits).toHaveLength(0);

        // Same address, DIFFERENT unit name → no duplicate.
        const other = scanForDuplicateUnits({
            properties, address: '10 Adeola Odeku St', units: [{ unitName: 'Unit 3' }], ownerContactId: 'owner-1',
        });
        expect(other.duplicateUnits).toHaveLength(0);
    });

    it('duplicate detection: other-owner rows, Deleted rows and different addresses', () => {
        const properties = [
            { id: 'p9', _id: 'c9', address: '10 Adeola Odeku St', contactId: 'owner-OTHER', rentalDetails: { unitName: 'Unit 7' } },
            { id: 'p10', _id: 'c10', address: '10 Adeola Odeku St', status: 'Deleted', contactId: 'owner-1', rentalDetails: { unitName: 'Unit 1' } },
            { id: 'p11', _id: 'c11', address: '99 Somewhere Else', contactId: 'owner-1', rentalDetails: { unitName: 'Unit 1' } },
        ];
        const out = scanForDuplicateUnits({
            properties, address: '10 Adeola Odeku St', units: [{ unitName: 'Unit 1' }], ownerContactId: 'owner-1',
        });
        // p9 (other owner, Unit 7 — name doesn't collide) is an owner-clash row, not a duplicate.
        expect(out.duplicateUnits).toHaveLength(0);
        expect(out.otherOwnerRows).toBe(1);
        // The Deleted Unit 1 at the same address never counts.
        // p11 at a different address never counts.
    });

    it('duplicate detection: an unnamed existing row matches on the address first segment', () => {
        const properties = [
            { id: 'p12', _id: 'c12', address: '10 Adeola Odeku St, Lagos', contactId: 'owner-1', rentalDetails: {} },
        ];
        const out = scanForDuplicateUnits({
            properties, address: '10 Adeola Odeku St, Lagos',
            units: [{ unitName: '10 Adeola Odeku St' }], ownerContactId: 'owner-1',
        });
        expect(out.duplicateUnits).toHaveLength(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('E3(d) — source contracts', () => {
    it('the lifecycle module: 11 staff-authed publics (8 E1 + 2 E2 + 1 E3) — pinned by E3; E4 raised it to 12 (see roundEWave4)', () => {
        const mod = read('convex/tenancyLifecycle.ts');
        expect((mod.match(/requireStaffCaller\(/g) || []).length).toBeGreaterThanOrEqual(11);
        expect(mod).toContain('getPropertyFinancialSummary');
        expect(mod).toContain('Property not found.');
    });

    it('the financial summary panel is ui-primitives-only and wired into the property detail financials tab', () => {
        const panel = read('src/components/details/PropertyFinancialSummaryPanel.tsx');
        expect(panel).toContain('api.tenancyLifecycle.getPropertyFinancialSummary');
        expect(panel).toContain("from '../ui/Card'");
        expect(panel).toContain("from '../ui/Badge'");
        // No raw form elements — the ADR-0004 rule for new components.
        expect(/<[a-z]*input[\s>]/i.test(panel)).toBe(false);
        expect(/<[a-z]*textarea[\s>]/i.test(panel)).toBe(false);
        const detail = read('src/components/details/PropertyDetailView.tsx');
        expect(detail).toContain('PropertyFinancialSummaryPanel propertyId={property.id}');
    });

    it('PropertyForm wires the intelligent-forms contract: validation, duplicate scan, resident match, confirm-before-removal, Monthly default', () => {
        const form = read('src/components/forms/PropertyForm.tsx');
        expect(form).toContain('validatePropertyForm');
        expect(form).toContain('scanForDuplicateUnits');
        expect(form).toContain('duplicateScan.duplicateUnits.length > 0');
        expect(form).toContain('residentMatch');
        expect(form).toContain("clearUnitError(activeUnitIndex, 'rentAmount')");
        expect(form).toContain("error={errors.address}");
        expect(form).toContain("error={unitErrors[activeUnitIndex]?.tenantEmail}");
        // Confirm before deleting unit rows (the old code deleted silently).
        expect(form).toContain("'Remove Units'");
        expect(form).toContain("'Keep Units'");
        // The harmonized auto-add default (the seed path was Monthly; auto-add was Annually).
        expect(form.match(/rentFrequency: 'Annually'/g) ?? []).toHaveLength(0);
        // The ui/ primitives migration for the validated fields.
        expect(form).toContain('<Textarea');
    });

    it('DocumentsTab: uploadContext stamps propertyId on uploads and the download path handles storage-id files', () => {
        const tab = read('src/components/details/DocumentsTab.tsx');
        expect(tab).toContain('uploadContext?: Record<string, any>');
        expect(tab).toContain('{ matterId, ...uploadContext, droppedFile: file }');
        expect(tab).toContain('getFileUrl');
        expect(tab).toContain('f?.storageId');
    });

    it('the property documents section matches propertyId + the legacy prop_ bridge — never the title heuristic', () => {
        const detail = read('src/components/details/PropertyDetailView.tsx');
        expect(detail).toContain('groupIds.has(String(d.propertyId))');
        expect(detail).toContain('legacyMatterIds.has(String(d.matterId))');
        expect(detail).toContain("uploadContext={{ propertyId: property.id }}");
        // The old over-matching heuristic is gone.
        expect(detail).not.toContain("d.title?.toLowerCase().includes(addressPart)");
    });

    it('the validation brain is a pure module imported by the form', () => {
        const util = read('src/utils/propertyFormValidation.ts');
        expect(util).toContain('export function validatePropertyForm');
        expect(util).toContain('export function scanForDuplicateUnits');
        expect(util).toContain('never a hit');
        const form = read('src/components/forms/PropertyForm.tsx');
        expect(form).toContain("from '../../utils/propertyFormValidation'");
    });
});
