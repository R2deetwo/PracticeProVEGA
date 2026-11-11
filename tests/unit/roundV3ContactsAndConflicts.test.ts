/**
 * roundV3ContactsAndConflicts.test.ts — V3: VEGA MATTER LIFECYCLE INTEGRITY
 * (part 2: contact dedup/merge, portal identity, conflict-of-interest
 * screening — acceptance criteria 8, 9, 12).
 * Real-handler tests against the fixture-backed ctx (the V1/V2 harness).
 * ─────────────────────────────────────────────────────────────────────────
 * Findings under test (V0 audit → V3 brief):
 *   V-MATTER-5/16  no dedup on automated contact creation; merges that
 *                  destroyed portal identity, orphaned secondary relations
 *                  and kept no audit; exact-string phone matching →
 *                  email-first dedup, the identity-preserving atomic merge,
 *                  digits-normalised phones, safe invite resolution.
 *   V-MATTER-6     no conflict-of-interest screening anywhere → the MVP
 *                  screen + recorded outcomes + human review (never an
 *                  auto-declaration from fuzzy matching).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createItem } from '../../convex/myFunctions';
import {
    ensureContactForClientInvite,
    linkPortalUserToContact,
    getClientMattersByUserId,
} from '../../convex/portals';
import { processInboundMessage } from '../../convex/sentry';
import {
    mergeContacts,
    checkContactDuplicate,
} from '../../convex/contactIntegrity';
import {
    screenForConflicts,
    recordConflictCheck,
    reviewConflictCheck,
    normalizeNameForConflict,
    stripLegalSuffixes,
    nameMatchStrength,
} from '../../convex/conflictCheck';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed ctx (the established harness) ────────────────────────────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        contacts: [],
        matters: [],
        documents: [],
        invoices: [],
        tasks: [],
        events: [],
        notePages: [],
        timeEntries: [],
        expenses: [],
        properties: [],
        tenancies: [],
        property_relationships: [],
        trust_transactions: [],
        clientMessages: [],
        firmActivity: [],
        matterStageHistory: [],
        archive: [],
        conflict_checks: [],
        atrium_inbound_messages: [],
        automation_rules: [],
        financial_counters: [],
        financial_audit_log: [],
        securityEvents: [],
        rateLimits: [],
        suspendedUsers: [],
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
                const q: any = {
                    eq: (field: string, value: any) => { conds.push([field, value]); return q; },
                };
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

const ADMIN: Row = { _id: 'u-admin', id: 'u-admin', email: 'admin@example.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
const LAWYER: Row = { _id: 'u-lawyer', id: 'u-lawyer', email: 'lawyer@example.com', name: 'Bola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
const CLIENT_USER: Row = { _id: 'u-client-1', id: 'u-client-1', email: 'chidi@example.com', tokenIdentifier: 'chidi@example.com', name: 'Chidi Client', role: 'Client', firmId: 'firm-1' };

function makeWorld(overrides: Record<string, Row[]> = {}) {
    const tables: Record<string, Row[]> = {
        users: [ADMIN, LAWYER, CLIENT_USER],
        sessions: [
            sessionRow('tok-admin', 'u-admin'),
            sessionRow('tok-lawyer', 'u-lawyer'),
            sessionRow('tok-client', 'u-client-1'),
        ],
        contacts: [],
        matters: [],
        ...overrides,
    };
    const cloned = Object.fromEntries(
        Object.entries(tables).map(([k, rows]) => [k, (rows as Row[]).map((r: any) => structuredClone(r))])
    );
    return makeCtx({ tables: cloned }) as { ctx: any; tables: any };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

// ═══════════════════════════════════════════════════════════════════════════
// 8. CONTACT DEDUPLICATION (acceptance #8, V-MATTER-5)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — email-first contact deduplication (V-MATTER-5/16)', () => {
    it('a second contact with an EXISTING email is refused — case-insensitively — with the existing name', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [{ _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Chidi Client', email: 'chidi@example.com' }],
        });
        (ctx as any).__tables = tables;
        await expect(call(createItem, ctx, {
            table: 'contacts',
            data: { id: 'cust-c-2', name: 'Chidi Okafor', email: 'CHIDI@example.com ' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/already exists: "Chidi Client"/);
        expect(tables.contacts).toHaveLength(1);
    });

    it('empty emails never dedup (the enterprise wizard shape) and phones NEVER block — warnings only', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Chidi Client', email: '', phone: '+234 803 000 0001' },
            ],
        });
        // Empty email + different name → allowed (wizard-created contacts).
        await call(createItem, ctx, {
            table: 'contacts',
            data: { id: 'cust-c-2', name: 'Tunde Witness', email: '' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        // SAME phone, different person → allowed: numbers are shared in this
        // market; a phone match is a UI warning, never a server refusal.
        await call(createItem, ctx, {
            table: 'contacts',
            data: { id: 'cust-c-3', name: 'Ada Sharephone', email: 'ada@other.com', phone: '08030000001' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(tables.contacts).toHaveLength(3);
    });

    it('identical display names alone are NOT duplicates — nothing auto-merges on a name (V-MATTER-5)', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [{ _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Tunde Johnson', email: 't1@mail.com' }],
        });
        // Same name, no email → a separate human being as far as the server
        // is concerned. Merging is a manual, evidence-reviewed action.
        await call(createItem, ctx, {
            table: 'contacts',
            data: { id: 'cust-c-2', name: 'Tunde Johnson' },
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(tables.contacts).toHaveLength(2);
        const mergeSrc = read('convex/contactIntegrity.ts');
        expect(mergeSrc).not.toMatch(/autoMerge|automatically merge/i);
    });

    it('checkContactDuplicate surfaces email/phone/name evidence for the human (never a verdict)', async () => {
        const { ctx } = makeWorld({
            contacts: [
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Chidi Client', email: 'chidi@example.com', phone: '+234 803 111 2222' },
                { _id: 'c-2', id: 'cust-c-2', firmId: 'firm-1', name: 'Kunle Adebayo', phone: '08031112222' },
            ],
        });
        const result = await call(checkContactDuplicate, ctx, {
            email: 'chidi@example.com', phone: '+234 803 111 2222', name: 'Kunle Adebayo',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(result.emailMatch.name).toBe('Chidi Client');
        // Phone digits-normalised across formats (+234 803… matches 0803…).
        expect(result.phoneMatches.map((p: any) => p.name).sort()).toEqual(['Chidi Client', 'Kunle Adebayo']);
        expect(result.nameMatches.map((n: any) => n.name)).toEqual(['Kunle Adebayo']);
    });

    it('inbound WhatsApp now resolves format-variant phone numbers (V-MATTER-5)', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [
                // Stored in local format; the provider delivers E.164 digits.
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Resident Tunde', phone: '08031112222' },
            ],
        });
        (ctx as any).__tables = tables;
        await call(processInboundMessage, ctx, {
            senderContact: '2348031112222', senderName: 'Tunde', content: 'Rent question', channel: 'whatsapp',
        });
        const stored = tables.atrium_inbound_messages[0];
        expect(stored.firmId).toBe('firm-1');   // resolved, not "unknown"
        expect(String(stored.tenantId)).toBe('c-1');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8b. THE ATOMIC, IDENTITY-PRESERVING MERGE (V-MATTER-5/16)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — mergeContacts: one transaction, everything preserved (V-MATTER-5)', () => {
    function mergeWorld() {
        return makeWorld({
            contacts: [
                { _id: 'c-src', id: 'cust-c-src', firmId: 'firm-1', name: 'Chidi Old', email: 'old@mail.com', notes: 'Prefers WhatsApp.', matterIds: ['cust-m-1'] },
                { _id: 'c-tgt', id: 'cust-c-tgt', firmId: 'firm-1', name: 'Chidi New', phone: '08031112222' },
            ],
            matters: [
                { _id: 'm-1', id: 'cust-m-1', firmId: 'firm-1', title: 'Primary link', status: 'Active', stage: 'Intake', clientId: 'cust-c-src' },
                { _id: 'm-2', id: 'cust-m-2', firmId: 'firm-1', title: 'Secondary links', status: 'Active', stage: 'Intake', associatedContactIds: ['cust-c-src', 'c-other'], parties: [{ id: 'p1', name: 'Chidi Old', contactId: 'cust-c-src', role: 'Claimant' }] },
            ],
            properties: [{ _id: 'prop-1', firmId: 'firm-1', address: '12 Marina', contactId: 'c-src' }],
            tenancies: [{ _id: 'ten-1', firmId: 'firm-1', tenantContactId: 'cust-c-src' }],
            property_relationships: [{ _id: 'rel-1', firmId: 'firm-1', grantorContactId: 'c-src', granteeContactId: 'someone-else' }],
        });
    }

    it('re-points EVERY relationship: client, secondary contacts, parties, property, tenancy, relationship grants', async () => {
        const { ctx, tables } = mergeWorld();
        (ctx as any).__tables = tables;
        const result = await call(mergeContacts, ctx, {
            sourceContactId: 'cust-c-src', targetContactId: 'cust-c-tgt',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        expect(result).toMatchObject({ success: true, matters: 1, secondaryContacts: 1, parties: 1, properties: 1, tenancies: 1, propertyRelationships: 1 });
        expect(tables.matters.find((m: any) => m.id === 'cust-m-1').clientId).toBe('cust-c-tgt');
        expect(tables.matters.find((m: any) => m.id === 'cust-m-2').associatedContactIds).toEqual(['cust-c-tgt', 'c-other']);
        expect(tables.matters.find((m: any) => m.id === 'cust-m-2').parties[0].contactId).toBe('cust-c-tgt');
        expect(tables.properties[0].contactId).toBe('cust-c-tgt');
        expect(tables.tenancies[0].tenantContactId).toBe('cust-c-tgt');
        expect(tables.property_relationships[0].grantorContactId).toBe('cust-c-tgt');
    });

    it('survivor inherits missing fields + attributed notes; the source becomes an auditable tombstone, never a hard delete', async () => {
        const { ctx, tables } = mergeWorld();
        (ctx as any).__tables = tables;
        await call(mergeContacts, ctx, {
            sourceContactId: 'cust-c-src', targetContactId: 'cust-c-tgt',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        const target = tables.contacts.find((c: any) => c._id === 'c-tgt');
        expect(target.email).toBe('old@mail.com');        // inherited (target had none)
        expect(target.phone).toBe('08031112222');          // kept its own
        expect(target.notes).toMatch(/Prefers WhatsApp\./);
        expect(target.notes).toMatch(/Merged from Chidi Old on/);
        expect(target.matterIds).toEqual(expect.arrayContaining(['cust-m-1', 'cust-m-2']));
        const source = tables.contacts.find((c: any) => c._id === 'c-src');
        expect(source).toBeTruthy();                        // NOT hard-deleted
        expect(source.isArchived).toBe(true);
        expect(source.mergedIntoId).toBe('cust-c-tgt');
        expect(source.mergedAt).toBeTruthy();
        // The audit trail.
        const audit = tables.firmActivity.find((a: any) => a.action === 'Merged contacts');
        expect(audit.metadata.sourceName).toBe('Chidi Old');
        expect(audit.metadata.targetName).toBe('Chidi New');
    });

    it('refuses when BOTH contacts carry different portal accounts (no silent identity collapse)', async () => {
        const { ctx } = makeWorld({
            contacts: [
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'A', userId: 'u-client-1' },
                { _id: 'c-2', id: 'cust-c-2', firmId: 'firm-1', name: 'B', userId: 'u-client-2' },
            ],
        });
        await expect(call(mergeContacts, ctx, {
            sourceContactId: 'cust-c-1', targetContactId: 'cust-c-2',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/Both contacts have linked portal accounts/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. PORTAL IDENTITY PRESERVATION (acceptance #9, V-MATTER-16)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — portal identity survives merges and safe invitations (V-MATTER-16)', () => {
    it('the source portal link TRANSFERS to the survivor — the client keeps their portal', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [
                { _id: 'c-src', id: 'cust-c-src', firmId: 'firm-1', name: 'Chidi Old', email: 'chidi@example.com', userId: 'u-client-1' },
                { _id: 'c-tgt', id: 'cust-c-tgt', firmId: 'firm-1', name: 'Chidi New' },
            ],
            matters: [
                { _id: 'm-1', id: 'cust-m-1', firmId: 'firm-1', title: 'Their matter', status: 'Active', stage: 'Intake', clientId: 'cust-c-src' },
            ],
        });
        (ctx as any).__tables = tables;
        await call(mergeContacts, ctx, {
            sourceContactId: 'cust-c-src', targetContactId: 'cust-c-tgt',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        // The portal user's link now points at the SURVIVOR…
        expect(tables.contacts.find((c: any) => c._id === 'c-tgt').userId).toBe('u-client-1');
        // …and the portal still resolves their matters (the real portal read).
        const matters = await call(getClientMattersByUserId, ctx, {
            firmId: 'firm-1', userId: 'u-client-1', sessionToken: 'tok-client',
        });
        expect(matters.map((m: any) => m.title)).toEqual(['Their matter']);
    });

    it('invitations resolve by EMAIL ONLY when an email is present — a name collision can no longer steal or duplicate a contact', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [
                // Same display name, DIFFERENT person, no email overlap.
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Tunde Johnson', email: 'tunde.johnson@oldfirm.com' },
            ],
        });
        (ctx as any).__tables = tables;
        const result = await call(ensureContactForClientInvite, ctx, {
            firmId: 'firm-1',
            inviteeEmail: 'tunde84@gmail.com',
            inviteeName: 'Tunde Johnson', // a DIFFERENT Tunde Johnson
        });
        // The old name fallback would have linked the invite to the wrong
        // man; email-first resolution creates the genuinely-new contact.
        expect(result.matchMethod).toBe('created');
        expect(tables.contacts).toHaveLength(2);
        const wrongMan = tables.contacts.find((c: any) => c._id === 'c-1');
        expect(wrongMan.userId).toBeFalsy();
    });

    it('an invitation with a MATCHING email links the existing contact — no duplicate minted', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [{ _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Chidi Client', email: 'chidi@example.com' }],
        });
        (ctx as any).__tables = tables;
        const result = await call(ensureContactForClientInvite, ctx, {
            firmId: 'firm-1', inviteeEmail: 'CHIDI@example.com',
            inviteeName: 'Chidi Client (Esq.)', // display drift must not matter
            matterId: 'cust-m-1',
        });
        expect(result.matchMethod).toBe('email');
        expect(result.created).toBe(false);
        expect(tables.contacts).toHaveLength(1); // NO duplicate
    });

    it('email-less invitations fall back phone-first, then to a UNIQUE name match — ambiguity never guesses', async () => {
        const { ctx } = makeWorld({
            contacts: [
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Kunle', phone: '08031112222' },
                { _id: 'c-2', id: 'cust-c-2', firmId: 'firm-1', name: 'Wale A' },
                { _id: 'c-3', id: 'cust-c-3', firmId: 'firm-1', name: 'Wale B' },
            ],
        });
        // Phone digits-normalised match wins.
        const byPhone = await call(ensureContactForClientInvite, ctx, {
            firmId: 'firm-1', inviteeName: 'Someone', inviteePhone: '+234 803 111 2222',
        });
        expect(byPhone.matchMethod).toBe('phone');
        // Unique name match is allowed.
        const byName = await call(ensureContactForClientInvite, ctx, {
            firmId: 'firm-1', inviteeName: 'Kunle',
        });
        expect(byName.matchMethod).toBe('name');
        // AMBIGUOUS name (two Wale contacts) → a fresh contact, never a guess.
        const ambiguous = await call(ensureContactForClientInvite, ctx, {
            firmId: 'firm-1', inviteeName: 'Wale',
        });
        expect(ambiguous.matchMethod).toBe('created');
    });

    it('linkPortalUserToContact: email match links; ambiguous names refuse rather than guess', async () => {
        const { ctx, tables } = makeWorld({
            contacts: [
                { _id: 'c-1', id: 'cust-c-1', firmId: 'firm-1', name: 'Chidi Client', email: 'chidi@example.com' },
                { _id: 'c-2', id: 'cust-c-2', firmId: 'firm-1', name: 'Wale A' },
                { _id: 'c-3', id: 'cust-c-3', firmId: 'firm-1', name: 'Wale B' },
            ],
        });
        (ctx as any).__tables = tables;
        const linked = await call(linkPortalUserToContact, ctx, {
            firmId: 'firm-1', userId: 'u-client-1', email: 'chidi@example.com',
        });
        expect(linked.linked).toBe(true);
        expect(tables.contacts.find((c: any) => c._id === 'c-1').userId).toBe('u-client-1');
        // Two contacts share the name "Wale" — no email given → refuse.
        const ambiguous = await call(linkPortalUserToContact, ctx, {
            firmId: 'firm-1', userId: 'u-client-1', name: 'Wale',
        });
        expect(ambiguous.linked).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. CONFLICT-OF-INTEREST SCREENING (acceptance #12, V-MATTER-6)
// ═══════════════════════════════════════════════════════════════════════════
describe('V3 — conflict screening: normalised matching, human review, no auto-declaration (V-MATTER-6)', () => {
    it('name normalisation: punctuation, case, whitespace and legal suffixes', () => {
        expect(normalizeNameForConflict('  ACME   Ltd. ')).toBe('acme ltd');
        expect(normalizeNameForConflict('Okafor & Sons (Nig.)')).toBe('okafor sons nig');
        expect(stripLegalSuffixes('Acme Limited')).toBe('acme');
        expect(stripLegalSuffixes('Okafor & Sons Ltd.')).toBe('okafor sons');
        expect(nameMatchStrength('Acme Ltd', 'ACME LIMITED')?.strength).toBe('strong');
        expect(nameMatchStrength('Chidi Okafor', 'chidi okafor')?.strength).toBe('strong');
        // Bounded containment → 'possible', for review only.
        const partial = nameMatchStrength('Zenith Bank Plc', 'zenith bank plc lagrange branch');
        expect(partial?.strength).toBe('possible');
        // No match.
        expect(nameMatchStrength('Chidi Okafor', 'Completely Different')).toBeNull();
    });

    function conflictWorld() {
        return makeWorld({
            contacts: [
                { _id: 'c-acme', id: 'cust-c-acme', firmId: 'firm-1', name: 'Acme Ltd', email: 'info@acme.ng', category: 'Client' },
                { _id: 'c-chidi', id: 'cust-c-chidi', firmId: 'firm-1', name: 'Chidi Okafor', email: 'chidi@example.com', category: 'Client' },
            ],
            matters: [
                {
                    _id: 'm-1', id: 'cust-m-1', firmId: 'firm-1', title: 'Zenith Recovery', status: 'Active', stage: 'Intake',
                    clientId: 'cust-c-chidi',
                    parties: [{ id: 'p1', name: 'Zenith Bank Plc', role: 'Defendant' }],
                    opposingCounsel: 'Kunle & Co LLP',
                    specialtyData: { realEstate: { adverseParty: 'Adverse Properties Ltd' } },
                },
            ],
        });
    }

    it('the screen surfaces client/contact matches AND matter-context matches (the classic conflict)', async () => {
        const { ctx } = conflictWorld();
        const result = await call(screenForConflicts, ctx, {
            clientName: 'New Client Ltd',
            opposingParties: ['Acme Limited', 'Zenith Bank Plc'],
            counsel: ['Kunle & Co'],
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        // 'Acme Limited' matches the existing CLIENT contact 'Acme Ltd'
        // (suffix-normalised, strong) — a new opposing party who is already
        // our client is the textbook conflict.
        const acme = result.matches.find((m: any) => m.name === 'Acme Ltd');
        expect(acme).toMatchObject({ kind: 'contact', strength: 'strong', matchType: 'opposing party' });
        // 'Zenith Bank Plc' matches the party on the existing matter.
        const zenith = result.matches.find((m: any) => m.matchedValue === 'Zenith Bank Plc');
        expect(zenith).toMatchObject({ kind: 'matter', strength: 'strong' });
        expect(zenith.detail).toMatch(/Defendant on matter "Zenith Recovery"/);
        // Counsel match.
        const counsel = result.matches.find((m: any) => m.matchType === 'counsel');
        expect(counsel?.detail).toMatch(/opposing counsel on matter/);
        // Strong matches sort first.
        expect(result.matches[0].strength).toBe('strong');
    });

    it('the new CLIENT name is compared against matter parties and adverse parties', async () => {
        const { ctx } = conflictWorld();
        const result = await call(screenForConflicts, ctx, {
            clientName: 'Adverse Properties Ltd',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        const hit = result.matches.find((m: any) => m.matchType === 'client name');
        expect(hit.kind).toBe('matter');
        expect(hit.detail).toMatch(/adverse party on matter/);
    });

    it('email equality is the strongest signal; a clean screen returns an empty list', async () => {
        const { ctx } = conflictWorld();
        const emailHit = await call(screenForConflicts, ctx, {
            clientEmail: 'chidi@example.com',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(emailHit.matches[0]).toMatchObject({ strength: 'strong', matchType: 'email' });

        const clean = await call(screenForConflicts, ctx, {
            clientName: 'Brand New Human', opposingParties: ['Unknown Entity'], counsel: [],
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(clean.matches).toEqual([]);
    });

    it('the screen NEVER returns a verdict — outcomes are recorded by humans (V-MATTER-6)', async () => {
        const { ctx } = conflictWorld();
        const result = await call(screenForConflicts, ctx, {
            clientName: 'Acme Holdings',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        // No outcome/conflict field on the screen result — it is a list of
        // candidates for review, not a declaration.
        expect(Object.keys(result).sort()).toEqual(['matches', 'screenedNames']);
        // The server source has no auto-outcome logic.
        const src = read('convex/conflictCheck.ts');
        expect(src).not.toMatch(/outcome.*=.*['"]confirmed-conflict['"]/);
    });

    it('recordConflictCheck writes the audit row; invalid outcomes are refused', async () => {
        const { ctx, tables } = conflictWorld();
        (ctx as any).__tables = tables;
        const recorded = await call(recordConflictCheck, ctx, {
            clientName: 'Acme Holdings',
            opposingParties: ['Acme Limited'], counsel: [],
            matches: [{ kind: 'contact', id: 'cust-c-acme', name: 'Acme Ltd', strength: 'strong' }],
            outcome: 'reviewed-false-positive',
            note: 'Different company — different RC number, verified at CAC.',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        expect(recorded.success).toBe(true);
        const row = tables.conflict_checks[0];
        expect(row.outcome).toBe('reviewed-false-positive');
        expect(row.checkedByName).toBe('Bola Lawyer');
        expect(row.matchCount).toBe(1);

        await expect(call(recordConflictCheck, ctx, {
            outcome: 'declared-by-robot',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        })).rejects.toThrow(/Invalid conflict-check outcome/);
    });

    it('reviewConflictCheck REQUIRES a note — no reason means no audit trail', async () => {
        const { ctx, tables } = conflictWorld();
        (ctx as any).__tables = tables;
        const created = await call(recordConflictCheck, ctx, {
            clientName: 'Acme Holdings', outcome: 'clear',
            userEmail: 'lawyer@example.com', sessionToken: 'tok-lawyer',
        });
        await expect(call(reviewConflictCheck, ctx, {
            checkId: created.checkId, outcome: 'reviewed-false-positive', note: '   ',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        })).rejects.toThrow(/review note is required/);
        const reviewed = await call(reviewConflictCheck, ctx, {
            checkId: created.checkId, outcome: 'confirmed-conflict',
            note: 'Same directors as the existing client — genuine conflict, declined the brief.',
            userEmail: 'admin@example.com', sessionToken: 'tok-admin',
        });
        expect(reviewed.success).toBe(true);
        const row = tables.conflict_checks[0];
        expect(row.outcome).toBe('confirmed-conflict');
        expect(row.reviewedByName).toBe('Ada Admin');
        expect(row.reviewedAt).toBeTruthy();
    });

    it('source contracts: both matter-creation forms screen BEFORE creating; the review dialog demands a note', () => {
        const matterForm = read('src/components/forms/MatterForm.tsx');
        expect(matterForm).toContain('conflictScreen.run(');
        // The screen gates the create call (screen before onAddMatter).
        const screenPos = matterForm.indexOf('conflictScreen.run(');
        const createPos = matterForm.indexOf('await onAddMatter(matterData');
        expect(screenPos).toBeGreaterThan(-1);
        expect(screenPos).toBeLessThan(createPos);
        expect(matterForm).toContain('ConflictReviewDialog');

        const smart = read('src/components/forms/SmartMatterModal.tsx');
        expect(smart).toContain('conflictScreen.run(');
        expect(smart).toContain('ConflictReviewDialog');

        const dialog = read('src/components/modals/ConflictReviewDialog.tsx');
        expect(dialog).toContain('disabled={!note.trim()');
        expect(dialog).toContain('not</strong> a legal determination');
    });
});
