/**
 * R101 — TENANCY WRITE-PATH REPAIR: the regression suite for the
 * `_lastModifiedBy`/`_version` production breakage.
 * ─────────────────────────────────────────────────────────────────────────
 * ROOT CAUSE (found live in production, 2026-11-11): every tenancy-lifecycle
 * and property-relationship write stuffed two audit fields — `_lastModifiedBy`
 * and `_version` — into the documents passed to ctx.db.insert/patch. Convex
 * reserves `_`-prefixed document fields for system fields (_id,
 * _creationTime), so the document writer rejected EVERY such write at
 * runtime ("Fields ... start with '_' which is reserved for system fields",
 * seen at tenancyLifecycle.ts:616 — recordExistingTenancy). Unit tests never
 * caught it because the fixture ctx happily stores underscore keys.
 *
 * This suite closes both gaps:
 *   1. SOURCE GUARD — no convex source file may define a `_lastModifiedBy:`
 *      or `_version:` object key again (write sites and schema definitions
 *      both use that shape). The two legacy dead READS in myFunctions
 *      (`matter._lastModifiedBy === ...`, private-matter creator checks) use
 *      `===`/`!==` and are scheduled for V1-A's getMatterDetails closure.
 *   2. HONEST CTX — a fixture ctx whose insert/patch THROW on any
 *      `_`-prefixed key, exactly like the real Convex document writer. All
 *      repaired handlers are driven through it end-to-end.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve as resolvePath, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    allocateTenant,
    recordExistingTenancy,
    renewTenancy,
    endTenancy,
    transferTenant,
    bulkUpdateProperties,
} from '../../convex/tenancyLifecycle';
import {
    createRelationship,
    updateRelationship,
    endRelationship,
    importTenanciesAsRelationships,
} from '../../convex/propertyRelationships';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsRoot();
function existsRoot(): string {
    const candidate = resolvePath(here, '../..');
    try {
        statSync(resolvePath(candidate, 'convex/tenancyLifecycle.ts'));
        return candidate;
    } catch {
        return process.cwd();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. SOURCE GUARD — the underscore-field class may never come back
// ═══════════════════════════════════════════════════════════════════════════
describe('R101 source guard — no `_`-prefixed document fields in convex sources', () => {
    it('no _lastModifiedBy/_version object keys anywhere under convex/ (writes or schema)', () => {
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir)) {
                if (entry === '_generated' || entry === 'node_modules' || entry === '.git') continue;
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) { walk(full); continue; }
                if (!entry.endsWith('.ts')) continue;
                const lines = readFileSync(full, 'utf-8').split('\n');
                lines.forEach((line, i) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
                    // Object-literal key shape only — schema definitions and
                    // db.insert/patch write payloads. Reads use ===/!==.
                    if (/\b(_lastModifiedBy|_version)\s*:\s/.test(line)) {
                        offenders.push(`${resolvePath(repoRoot, 'convex') && full.replace(repoRoot + '/', '')}:${i + 1}: ${trimmed.slice(0, 100)}`);
                    }
                });
            }
        };
        walk(resolvePath(repoRoot, 'convex'));
        expect(offenders, `underscore-field keys found:\n${offenders.join('\n')}`).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. HONEST CTX — insert/patch enforce Convex's system-field rule
// ═══════════════════════════════════════════════════════════════════════════
type Row = Record<string, any>;

interface Fixtures {
    session?: { token: string; userId: string };
    user?: Row;
    users?: Row[];
    tables?: Record<string, Row[]>;
}

/** Convex's document writer rejects custom `_`-prefixed fields — so do we. */
function assertNoSystemFieldCollision(where: string, value: any) {
    for (const key of Object.keys(value ?? {})) {
        if (key.startsWith('_')) {
            throw new Error(
                `[TEST-HARNESS/CONVEX-RULE] ${where}: field "${key}" starts with '_' which is reserved for system fields`
            );
        }
    }
}

function makeHonestCtx(fix: Fixtures = {}) {
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
        properties: [],
        property_relationships: [],
        relationship_types: [],
        ...(fix.tables ?? {}),
    };

    const findRows = (table: string, conds: Array<[string, any]>) =>
        (tables[table] ?? []).filter((r) => conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));

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
                const conds: Array<[string, any]> = [];
                const q: any = {
                    eq: (field: string, value: any) => { conds.push([field, value]); return q; },
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
            assertNoSystemFieldCollision(`insert(${table})`, value);
            const _id = `${table}_${tables[table]?.length ?? 0}_${Math.floor(Math.random() * 1e6)}`;
            (tables[table] = tables[table] ?? []).push({ _id, _creationTime: Date.now(), ...value });
            return _id as any;
        },
        patch: async (id: any, value: any) => {
            assertNoSystemFieldCollision(`patch(${String(id)})`, value);
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

// ── Standard callers (the Round E pattern) ──────────────────────────────────
const ADMIN = { _id: 'u-admin-1', email: 'admin@firm1.com', tokenIdentifier: 'admin@firm1.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const ADMIN_SESSION = { token: 'tok-admin-xyz', userId: 'u-admin-1' };
const AUTH = { sessionToken: 'tok-admin-xyz', userEmail: 'admin@firm1.com' };
const YEAR = new Date().getFullYear();

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

/** Every row a handler wrote must itself be free of `_`-prefixed custom fields. */
const badKeys = (row: Row) => Object.keys(row).filter((k) => k.startsWith('_') && k !== '_id' && k !== '_creationTime');

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE REPRODUCTION + THE FIX — tenancy lifecycle writes all succeed
// ═══════════════════════════════════════════════════════════════════════════
describe('R101 — tenancy lifecycle handlers survive an honest (Convex-rule) ctx', () => {
    // The user's exact production case: No. 20 Westsyde Drive, embedded units
    // 1–3 occupied with no ledger rows. Clicking "Record Current Tenancy" on
    // Unit 1 threw the reserved-system-field error and saved nothing.
    const w = makeHonestCtx({ user: ADMIN, session: ADMIN_SESSION });
    w.tables.properties.push({
        _id: 'wds-1', id: 'wds-1-custom', firmId: 'firm-1',
        address: 'No. 20 Westsyde Drive', status: 'Occupied',
        units: [
            {
                id: 'wds-unit-1', unitName: 'Unit 1', status: 'Occupied',
                tenantName: 'Mr. Chigozie Ubah', tenantPhone: '08030000001', tenantEmail: 'chigozie@example.com',
                rentAmount: 1400000, rentFrequency: 'Annually',
                leaseStart: `${YEAR}-01-01`, leaseEnd: `${YEAR}-12-31`,
            },
            { id: 'wds-unit-2', unitName: 'Unit 2', status: 'Vacant' },
        ],
    } as any);
    // A vacant standalone property (the row IS the unit) for allocation.
    w.tables.properties.push({
        _id: 'sul-1', id: 'sul-1-custom', firmId: 'firm-1',
        address: 'No. 6 Sulaiman Adekanbi Street', status: 'Vacant',
        rentalDetails: { unitName: 'Shop 1', rentAmount: 2000000, rentFrequency: 'Annually' },
    } as any);

    it('recordExistingTenancy — the exact production failure — now writes a clean ledger row', async () => {
        const res: any = await call(recordExistingTenancy, w.ctx, {
            ...AUTH, firmId: 'firm-1', unitId: 'wds-unit-1',
        });
        expect(res.alreadyRecorded).toBe(false);
        expect(String(res.tenancyId)).toBeTruthy();
        const row = (w.tables.tenancies as any[]).find((t) => String(t._id) === String(res.tenancyId));
        expect(row.tenantName).toBe('Mr. Chigozie Ubah');
        expect(row.status).toBe('active');
        expect(row.source).toBe('record_existing');
        expect(badKeys(row)).toEqual([]);
        // Idempotent on the second call.
        const again: any = await call(recordExistingTenancy, w.ctx, {
            ...AUTH, firmId: 'firm-1', unitId: 'wds-unit-1',
        });
        expect(again.alreadyRecorded).toBe(true);
    });

    it('allocateTenant — standalone vacant property — clean row + denormalized sync', async () => {
        const res: any = await call(allocateTenant, w.ctx, {
            ...AUTH, firmId: 'firm-1', unitId: 'sul-1',
            tenantName: 'Ngozi Eze', tenantPhone: '+2348012345678',
            leaseStart: `${YEAR}-02-01`, leaseEnd: `${YEAR + 1}-01-31`,
            rentAmount: 2000000, rentFrequency: 'Annually',
        });
        expect(res.replayed).toBe(false);
        const row = (w.tables.tenancies as any[]).find((t) => String(t._id) === String(res.tenancyId));
        expect(row.tenantName).toBe('Ngozi Eze');
        expect(badKeys(row)).toEqual([]);
        const prop = (w.tables.properties as any[]).find((p) => p._id === 'sul-1');
        expect(prop.status).toBe('Occupied');
        expect(prop.rentalDetails.tenantName).toBe('Ngozi Eze');
        expect(badKeys(prop)).toEqual([]);
    });

    it('renewTenancy → transferTenant → endTenancy — the whole chain stays clean', async () => {
        // Renew the Westsyde Unit 1 tenancy.
        const active = (w.tables.tenancies as any[]).find(
            (t) => t.status === 'active' && t.tenantName === 'Mr. Chigozie Ubah');
        const renewed: any = await call(renewTenancy, w.ctx, {
            ...AUTH, firmId: 'firm-1', tenancyId: String(active._id),
            newLeaseStart: `${YEAR + 1}-01-01`, newLeaseEnd: `${YEAR + 1}-12-31`,
            newRentAmount: 1600000, newRentFrequency: 'Annually',
        });
        expect(String(renewed.oldTenancyId)).toBe(String(active._id));
        const activeRow = (w.tables.tenancies as any[]).find(
            (t) => String(t._id) === String(renewed.tenancyId));
        expect(activeRow).toBeTruthy();
        expect(activeRow.status).toBe('active');
        expect(Number(activeRow.rentAmount)).toBe(1600000);
        expect((w.tables.tenancies as any[]).every((t) => badKeys(t).length === 0)).toBe(true);

        // Transfer the renewed resident to the vacant Unit 2.
        const moved: any = await call(transferTenant, w.ctx, {
            ...AUTH, firmId: 'firm-1', tenancyId: String(activeRow._id),
            targetUnitId: 'wds-unit-2', newLeaseStart: `${YEAR + 1}-01-15`,
        });
        expect(String(moved.tenancyId)).toBeTruthy();
        expect((w.tables.tenancies as any[]).every((t) => badKeys(t).length === 0)).toBe(true);
        const unit2 = ((w.tables.properties as any[]).find((p) => p._id === 'wds-1').units as any[]).find((u: any) => u.id === 'wds-unit-2');
        expect(unit2.tenantName).toBe('Mr. Chigozie Ubah');

        // End the transferred tenancy (danger-confirmed action in the UI).
        await call(endTenancy, w.ctx, {
            ...AUTH, firmId: 'firm-1', tenancyId: String(moved.tenancyId),
            endDate: `${YEAR + 1}-06-30`, endReason: 'move_out', markUnitVacant: true,
        });
        const ended = (w.tables.tenancies as any[]).find((t) => String(t._id) === String(moved.tenancyId));
        expect(String(ended.status)).toBe('ended');
        expect((w.tables.tenancies as any[]).every((t) => badKeys(t).length === 0)).toBe(true);
        expect((w.tables.properties as any[]).every((p) => badKeys(p).length === 0)).toBe(true);
    });

    it('bulkUpdateProperties — the whitelisted patch writes no underscore fields', async () => {
        const res: any = await call(bulkUpdateProperties, w.ctx, {
            ...AUTH, firmId: 'firm-1', propertyIds: ['sul-1'], status: 'Maintenance',
        });
        expect(res.updated).toBe(1);
        const prop = (w.tables.properties as any[]).find((p) => p._id === 'sul-1');
        expect(prop.status).toBe('Maintenance');
        expect(badKeys(prop)).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE SAME BUG CLASS IN PROPERTY RELATIONSHIPS — all four writers
// ═══════════════════════════════════════════════════════════════════════════
describe('R101 — property relationship writers survive an honest ctx', () => {
    const w = makeHonestCtx({ user: ADMIN, session: ADMIN_SESSION });
    w.tables.properties.push({
        _id: 'rel-prop-1', id: 'rel-prop-1-custom', firmId: 'firm-1',
        address: '4 Alexander Rd, Ikoyi', status: 'Occupied',
        rentalDetails: { tenantName: 'Bola Land', tenantPhone: '08033334444', rentAmount: 900000, rentFrequency: 'Annually', leaseStart: `${YEAR}-01-01` },
    } as any);

    it('createRelationship — system type "tenancy" — clean row', async () => {
        const id: any = await call(createRelationship, w.ctx, {
            ...AUTH, firmId: 'firm-1', propertyId: 'rel-prop-1',
            typeKey: 'tenancy', grantorName: 'Landlord Ltd', granteeName: 'Bola Land',
            startDate: `${YEAR}-01-01`, considerationAmount: 900000,
        });
        const row = (w.tables.property_relationships as any[]).find((r) => String(r._id) === String(id));
        expect(row).toBeTruthy();
        expect(badKeys(row)).toEqual([]);
    });

    it('updateRelationship + endRelationship — patches stay clean', async () => {
        const row = (w.tables.property_relationships as any[])[0];
        await call(updateRelationship, w.ctx, {
            ...AUTH, firmId: 'firm-1', relationshipId: String(row._id),
            patch: { notes: 'Consent letter filed.' },
        });
        expect(row.notes).toBe('Consent letter filed.');
        expect(badKeys(row)).toEqual([]);
        await call(endRelationship, w.ctx, {
            ...AUTH, firmId: 'firm-1', relationshipId: String(row._id),
            endStatus: 'terminated', endDate: `${YEAR}-12-31`,
        });
        expect(String(row.status)).toBe('terminated');
        expect(badKeys(row)).toEqual([]);
    });

    it('importTenanciesAsRelationships — the import sweep stays clean', async () => {
        const res: any = await call(importTenanciesAsRelationships, w.ctx, {
            ...AUTH, firmId: 'firm-1',
        });
        expect(res.created).toBeGreaterThanOrEqual(1);
        expect((w.tables.property_relationships as any[]).every((r) => badKeys(r).length === 0)).toBe(true);
    });
});
