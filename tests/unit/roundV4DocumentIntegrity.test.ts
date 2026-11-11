/**
 * roundV4DocumentIntegrity.test.ts — V4: DOCUMENT ENGINEERING, part 1
 * (server-side: the documents-table file/versions/signature fences on the
 * generic CRUD paths, plus the legacy-file backfill's decode+list logic).
 *
 * Real-handler tests against the fixture-backed ctx (the V1/V2/V3 harness)
 * — no mocks of the code under test.
 * ─────────────────────────────────────────────────────────────────────────
 * Findings under test (V0 audit → V4 brief):
 *   V-DOC-5  uploads stored megabytes of base64 INSIDE document records
 *            with no server-side size/type validation → the create/update
 *            fences: storage-backed or marker shape only, dataUrl stripped,
 *            size/type bounded, legacy rows protected until the backfill.
 *   V-DOC-13 versions written by nothing → bounded, shape-checked versions
 *            ride the row; signature attribution (V-DOC-3) persists through
 *            the same generic path.
 */
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createItem, updateItem } from '../../convex/myFunctions';
import { hashSessionToken } from '../../convex/sessions';
import {
    sanitizeDocumentFileForCreate,
    mergeDocumentFileForUpdate,
    sanitizeDocumentVersions,
} from '../../convex/documentsIntegrity';
import { decodeDataUrl } from '../../convex/backfillDocumentFilesInternal';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');
void read;

// ── Fixture-backed ctx (the established harness) ────────────────────────────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        contacts: [],
        firms: [],
        matters: [],
        documents: [],
        invoices: [],
        tasks: [],
        events: [],
        properties: [],
        chatConversations: [],
        chatMessages: [],
        researchNotebooks: [],
        researchSources: [],
        workflows: [],
        automation_rules: [],
        ...(fix.tables ?? {}),
    };

    const findRows = (table: string, conds: Array<[string, any]>) =>
        (tables[table] ?? []).filter((r: any) => conds.every(([f, v]) => r[f] !== undefined && String(r[f]) === String(v)));

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
                const q: any = { eq: (field: string, value: any) => { conds.push([field, value]); return q; } };
                fn(q);
                return chainFor(findRows(table, conds));
            },
            filter: (fn: (q: any) => any) => {
                const conds: Array<[string, any]> = [];
                const q: any = { field: (f: any) => f, eq: (f: any, v: any) => { conds.push([String(f), v]); return q; } };
                try { fn(q); } catch { /* no conditions */ }
                const rows = (tables[table] ?? []).filter((r: any) =>
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
                const hit = rows.find((r: any) => String(r._id) === idStr);
                if (hit) return hit;
            }
            return null;
        },
        insert: async (table: string, value: any) => {
            for (const key of Object.keys(value ?? {})) {
                if (key.startsWith('_')) throw new Error(`[CONVEX-RULE] ${table}: "${key}" is reserved for system fields`);
            }
            const _id = `${table}_${tables[table]?.length ?? 0}_${Math.floor(Math.random() * 1e6)}`;
            (tables[table] = tables[table] ?? []).push({ _id, _creationTime: Date.now(), ...value });
            return _id as any;
        },
        patch: async (id: any, value: any) => {
            for (const key of Object.keys(value ?? {})) {
                if (key.startsWith('_')) throw new Error(`[CONVEX-RULE] patch: "${key}" is reserved for system fields`);
            }
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const hit = rows.find((r: any) => String(r._id) === idStr);
                if (hit) Object.assign(hit, value);
            }
            return null;
        },
        delete: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const idx = rows.findIndex((r: any) => String(r._id) === idStr);
                if (idx >= 0) rows.splice(idx, 1);
            }
            return null;
        },
    };

    const ctx: any = {
        db,
        runMutation: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        runAction: vi.fn(async () => ({ success: true })),
        runQuery: vi.fn(async (fn: any, args: any) => (fn as any)._handler(ctx, args)),
        scheduler: { runAfter: vi.fn(async () => null) },
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables };
}

function sessionRow(token: string, userId: string) {
    return {
        tokenHash: hashSessionToken(token),
        userId,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
}

// ── World ────────────────────────────────────────────────────────────────────
const ADMIN: Row = { _id: 'u-admin', id: 'u-admin', email: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const LAWYER: Row = { _id: 'u-lawyer', id: 'u-lawyer', email: 'lawyer@example.com', name: 'Bola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const FIRM: Row = { _id: 'firm-1', id: 'firm-1', name: 'Avery & Jarvis', subscriptionPlan: 'Growth', product: 'legal' };
const MATTER: Row = { _id: 'm-convex-1', id: 'cust-m-1', firmId: 'firm-1', title: 'Contract Review', type: 'Corporate', status: 'Active', stage: 'Intake', assignedUsers: [], clientId: 'contact-1' };

// A pre-V4 legacy document: inline base64 dataUrl, no storageId.
const LEGACY_DOC: Row = {
    _id: 'd-legacy-1', id: 'cust-d-1', firmId: 'firm-1', title: 'Old Upload.pdf', categoryId: 'cat_court',
    file: {
        name: 'Old Upload.pdf', type: 'application/pdf', size: 5 * 1024 * 1024,
        filePath: 'uploads/old.pdf',
        dataUrl: 'data:application/pdf;base64,JVBERi0xLj',
    },
};

function makeWorld(overrides: Record<string, Row[]> = {}) {
    const tables: Record<string, Row[]> = {
        users: [ADMIN, LAWYER],
        firms: [FIRM],
        sessions: [sessionRow('tok-admin', 'u-admin'), sessionRow('tok-lawyer', 'u-lawyer')],
        contacts: [{ _id: 'contact-1', id: 'cust-contact-1', firmId: 'firm-1', name: 'Chidi Client', email: 'client@example.com' }],
        matters: [structuredClone(MATTER)],
        documents: [structuredClone(LEGACY_DOC)],
        ...overrides,
    };
    const cloned = Object.fromEntries(
        Object.entries(tables).map(([k, rows]) => [k, (rows as Row[]).map((r: any) => structuredClone(r))])
    );
    return makeCtx({ tables: cloned }) as { ctx: any; tables: any };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);
const asLawyer = { userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer' };

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE FILE FENCE — pure function behaviour (V-DOC-5)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — sanitizeDocumentFileForCreate (V-DOC-5)', () => {
    it('keeps a validated storage-backed file and strips any inline dataUrl', () => {
        const out = sanitizeDocumentFileForCreate({
            name: 'writ.pdf', type: 'application/pdf', size: 1024,
            filePath: 'x/y', storageId: 'kh52_abc',
            dataUrl: 'data:application/pdf;base64,JVBERi0',
        } as any);
        expect(out.file).toEqual({ name: 'writ.pdf', type: 'application/pdf', size: 1024, filePath: 'x/y', storageId: 'kh52_abc' });
        expect((out.file as any).dataUrl).toBeUndefined();
        expect(out.strippedDataUrl).toBe(true);
    });

    it('reduces a no-storageId file to an index marker (no bytes)', () => {
        const out = sanitizeDocumentFileForCreate({
            name: 'Receipt_1.pdf', type: 'application/pdf', size: 0, dataUrl: '',
        } as any);
        expect(out.file).toEqual({ name: 'Receipt_1.pdf', type: 'application/pdf', size: 0 });
        expect((out.file as any).dataUrl).toBeUndefined();
        expect((out.file as any).storageId).toBeUndefined();
    });

    it('absent file is legal (content-only documents)', () => {
        expect(sanitizeDocumentFileForCreate(undefined).file).toBeUndefined();
    });

    it('legacy bare storage-id strings survive bounded', () => {
        expect(sanitizeDocumentFileForCreate('kh52_zzz').file).toBe('kh52_zzz');
        expect(sanitizeDocumentFileForCreate('   ').file).toBeUndefined();
    });

    it('rejects oversize files server-side', () => {
        expect(() => sanitizeDocumentFileForCreate({
            name: 'huge.pdf', type: 'application/pdf', size: 11 * 1024 * 1024, storageId: 'kh52_big',
        } as any)).toThrow(/10MB limit/);
    });

    it('rejects disallowed extensions server-side', () => {
        expect(() => sanitizeDocumentFileForCreate({
            name: 'payload.exe', type: 'application/octet-stream', size: 100, storageId: 'kh52_exe',
        } as any)).toThrow(/not allowed/);
    });
});

describe('V4 — mergeDocumentFileForUpdate (V-DOC-5)', () => {
    const storedLegacy = { name: 'Old Upload.pdf', type: 'application/pdf', size: 5, filePath: 'x', dataUrl: 'data:application/pdf;base64,JVBERi0' };

    it('a legacy round-trip (dataUrl, no storageId) keeps the STORED file untouched', () => {
        const merge = mergeDocumentFileForUpdate({ ...storedLegacy }, storedLegacy);
        expect(merge.mode).toBe('keep-stored');
    });

    it('a fresh upload (storageId) takes the validated path', () => {
        const merge = mergeDocumentFileForUpdate({ name: 'new.pdf', type: 'application/pdf', size: 10, storageId: 'kh52_new' }, storedLegacy);
        expect(merge.mode).toBe('validated');
        expect((merge.file as any).storageId).toBe('kh52_new');
        expect((merge.file as any).dataUrl).toBeUndefined();
    });

    it('absent file in the patch leaves the row alone', () => {
        expect(mergeDocumentFileForUpdate(undefined, storedLegacy).mode).toBe('absent');
    });
});

describe('V4 — sanitizeDocumentVersions (V-DOC-13)', () => {
    it('bounds the list at 20 and shape-checks entries', () => {
        const many = Array.from({ length: 30 }, (_, i) => ({
            id: `v${i}`, title: `T${i}`, content: `<p>${i}</p>`,
            uploadedBy: 'u-admin', uploadedAt: new Date(2026, 1, 1 + i).toISOString(),
            changesSummary: `c${i}`, file: undefined,
        }));
        const out = sanitizeDocumentVersions(many);
        expect(out).toHaveLength(20);
        expect(out[0].id).toBe('v0');
        expect(out.every((v: any) => typeof v.uploadedBy === 'string')).toBe(true);
    });

    it('junk entries are dropped, never propagated', () => {
        const out = sanitizeDocumentVersions([null, 'nope', { id: 'ok1', uploadedBy: 'u', uploadedAt: '2026-01-01T00:00:00Z' }]);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('ok1');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE FENCES ON THE REAL GENERIC PATHS (createItem / updateItem)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — documents through the REAL createItem (V-DOC-5)', () => {
    it('a storage-backed upload persists {storageId} with NO dataUrl in the row', async () => {
        const { ctx, tables } = makeWorld();
        const id = await call(createItem, ctx, {
            table: 'documents',
            data: {
                id: 'doc-new-1', title: 'Writ of Summons', categoryId: 'cat_court',
                source: 'upload', matterId: 'cust-m-1',
                file: { name: 'writ.pdf', type: 'application/pdf', size: 2048, storageId: 'kh52_writ', dataUrl: 'data:application/pdf;base64,AAA' },
                versions: [{ id: 'vX', uploadedBy: 'u-lawyer', uploadedAt: '2026-01-01T00:00:00Z', title: 'Old', content: '<p>x</p>' }],
            },
            ...asLawyer,
        });
        const row = tables.documents.find((d: any) => d.id === 'doc-new-1');
        expect(row).toBeTruthy();
        expect(row.file.storageId).toBe('kh52_writ');
        expect(row.file.dataUrl).toBeUndefined();
        expect(row.versions).toHaveLength(1);
        expect(row.versions[0].title).toBe('Old');
        void id;
    });

    it('a marker-only file (no storageId, empty dataUrl) persists without faking bytes', async () => {
        const { ctx, tables } = makeWorld();
        await call(createItem, ctx, {
            table: 'documents',
            data: {
                id: 'doc-receipt-1', title: 'Rent Receipt', categoryId: 'receipts', source: 'generated',
                file: { name: 'Receipt_9.pdf', type: 'application/pdf', size: 0, dataUrl: '' },
            },
            ...asLawyer,
        });
        const row = tables.documents.find((d: any) => d.id === 'doc-receipt-1');
        expect(row.file).toEqual({ name: 'Receipt_9.pdf', type: 'application/pdf', size: 0 });
        expect(row.file.dataUrl).toBeUndefined();
    });

    it('an oversize upload is REJECTED (never persisted)', async () => {
        const { ctx, tables } = makeWorld();
        await expect(call(createItem, ctx, {
            table: 'documents',
            data: {
                id: 'doc-huge-1', title: 'Huge', categoryId: 'cat_court', source: 'upload',
                file: { name: 'huge.pdf', type: 'application/pdf', size: 11 * 1024 * 1024, storageId: 'kh52_huge' },
            },
            ...asLawyer,
        })).rejects.toThrow(/10MB limit/);
        expect(tables.documents.find((d: any) => d.id === 'doc-huge-1')).toBeUndefined();
    });

    it('the V3 matter FK fence still applies to documents (new fence coexists)', async () => {
        const { ctx } = makeWorld();
        await expect(call(createItem, ctx, {
            table: 'documents',
            data: {
                id: 'doc-badmatter', title: 'Bad Link', categoryId: 'cat_court', source: 'upload',
                matterId: 'no-such-matter-anywhere',
                file: { name: 'x.pdf', type: 'application/pdf', size: 10, storageId: 'kh52_x' },
            },
            ...asLawyer,
        })).rejects.toThrow(/no matter with id/);
    });
});

describe('V4 — documents through the REAL updateItem (V-DOC-5/13, signature persistence)', () => {
    it('a legacy round-trip metadata edit preserves the stored inline bytes (backfill owns the migration)', async () => {
        const { ctx, tables } = makeWorld();
        const before = structuredClone(tables.documents[0].file);
        await call(updateItem, ctx, {
            table: 'documents',
            id: 'd-legacy-1',
            data: {
                title: 'Old Upload.pdf (re-captioned)',
                file: { ...before }, // the form re-sends the whole doc, dataUrl included
            },
            ...asLawyer,
        });
        const row = tables.documents[0];
        expect(row.title).toBe('Old Upload.pdf (re-captioned)');
        expect(row.file).toEqual(before); // untouched — not stripped, not replaced
    });

    it('a fresh upload through an edit replaces the file with the validated storage shape', async () => {
        const { ctx, tables } = makeWorld();
        await call(updateItem, ctx, {
            table: 'documents',
            id: 'd-legacy-1',
            data: {
                file: { name: 'replacement.pdf', type: 'application/pdf', size: 77, storageId: 'kh52_repl' },
                versions: [{ id: 'v1', uploadedBy: 'u-lawyer', uploadedAt: '2026-02-02T00:00:00Z', title: 'Prior', content: '<p>old</p>', changesSummary: 'Changed content' }],
            },
            ...asLawyer,
        });
        const row = tables.documents[0];
        expect(row.file.storageId).toBe('kh52_repl');
        expect(row.file.dataUrl).toBeUndefined();
        expect(row.versions).toHaveLength(1);
        expect(row.versions[0].changesSummary).toBe('Changed content');
    });

    it('signature attribution + timestamp persist through the same generic path (V-DOC-3)', async () => {
        const { ctx, tables } = makeWorld();
        const signedAt = new Date('2026-03-03T10:00:00Z').toISOString();
        await call(updateItem, ctx, {
            table: 'documents',
            id: 'd-legacy-1',
            data: { signatureData: 'kh52_sig', signedAt, signerId: 'u-lawyer' },
            ...asLawyer,
        });
        const row = tables.documents[0];
        expect(row.signatureData).toBe('kh52_sig');
        expect(row.signedAt).toBe(signedAt);
        expect(row.signerId).toBe('u-lawyer');
        // The signature write must not have disturbed the legacy file.
        expect(row.file.dataUrl).toBe('data:application/pdf;base64,JVBERi0xLj');
    });

    it('RLS still rejects a cross-firm document edit', async () => {
        const stranger: Row[] = [{ _id: 'u-stranger', id: 'u-stranger', email: 'stranger@example.com', name: 'S', role: 'Lawyer', firmId: 'firm-2' }];
        const { ctx: ctx2, tables: tables2 } = makeWorld({
            users: [ADMIN, LAWYER, ...stranger],
            firms: [FIRM, { _id: 'firm-2', id: 'firm-2', name: 'Other', subscriptionPlan: 'Growth', product: 'legal' }],
        });
        // create a session for the stranger
        tables2.sessions.push(sessionRow('tok-stranger', 'u-stranger'));
        await expect(call(updateItem, ctx2, {
            table: 'documents',
            id: 'd-legacy-1',
            data: { title: 'Hostile takeover' },
            userEmail: 'stranger@example.com',
            sessionToken: 'tok-stranger',
        })).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE LEGACY BACKFILL — decode + listing logic (V-DOC-5)
// ═══════════════════════════════════════════════════════════════════════════
describe('V4 — decodeDataUrl (the backfill decoder)', () => {
    it('decodes base64 data URLs with their mime', () => {
        const out = decodeDataUrl('data:application/pdf;base64,SGVsbG8=');
        expect(out).not.toBeNull();
        expect(out!.mime).toBe('application/pdf');
        expect(out!.bytes).toEqual(new TextEncoder().encode('Hello'));
    });

    it('rejects junk without guessing', () => {
        expect(decodeDataUrl('not-a-data-url')).toBeNull();
        expect(decodeDataUrl('data:text/plain;base64,!!!corrupt!!!')).toBeNull();
        expect(decodeDataUrl('')).toBeNull();
    });
});
