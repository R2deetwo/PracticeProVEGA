/**
 * roundV1BSecurity.test.ts — V1-B: ADMINISTRATION AND PUBLIC MUTATION
 * SECURITY. Real-handler security tests for every changed endpoint.
 * ─────────────────────────────────────────────────────────────────────────
 * Endpoints under test:
 *   SEC-9   feedback suite: submitFeedback (attribution), getFeedbackList,
 *           getMyFeedbackReplies, adminReplyToFeedback (incl. the Brevo
 *           dispatch), updateFeedbackStatus
 *   SEC-11  regenerateInviteCode
 *   SEC-12  getOrgPayoutDetails
 *   SEC-13  public migration/backfill mutations (now internal)
 *   SEC-16  debug_env.checkEnv (removed from the public API; founder-only
 *           getEnvStatus wrapper)
 *
 * Matrix per the round brief: anonymous / revoked-session / wrong-firm /
 * wrong-role / authorised staff / founder — plus the six explicit
 * verifications (Brevo, invite rotation, cross-user feedback, bank info,
 * public backfills, legitimate happy paths).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    submitFeedback,
    getFeedbackList,
    getMyFeedbackReplies,
    deleteFeedbackThread,
    adminReplyToFeedback,
    updateFeedbackStatus,
    userReplyToFeedback,
} from '../../convex/feedback';
import { regenerateInviteCode, getOrgPayoutDetails } from '../../convex/myFunctions';
import { getEnvStatus } from '../../convex/debug_env';
import { hashSessionToken } from '../../convex/sessions';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolvePath(here, '../..');
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── Fixture-backed ctx (the V1-A harness: sessions + Convex rules) ──────────
type Row = Record<string, any>;

function makeCtx(fix: { tables?: Record<string, Row[]> } = {}) {
    const tables: Record<string, Row[]> = {
        sessions: [],
        users: [],
        firms: [],
        user_feedback: [],
        notifications: [],
        organization_payout_details: [],
        securityEvents: [],
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
                const hit = rows.find((r) => String(r._id) === idStr);
                if (hit) Object.assign(hit, value);
            }
            return null;
        },
        delete: async (id: any) => {
            const idStr = String(id);
            for (const rows of Object.values(tables)) {
                const idx = rows.findIndex((r) => String(r._id) === idStr);
                if (idx >= 0) rows.splice(idx, 1);
            }
            return null;
        },
    };

    const runMutation = vi.fn(async () => ({ success: true }));
    const runQuery = vi.fn(async () => null);
    const scheduler = { runAfter: vi.fn(async (_delay: number, _fn: any, _args: any) => null) };

    const ctx: any = {
        db,
        runMutation,
        runAction: vi.fn(async () => ({ success: true })),
        runQuery,
        scheduler,
        auth: { getUserIdentity: async () => null },
    };
    return { ctx, tables, runMutation, scheduler };
}

function registerUser(w: { tables: Record<string, Row[]> }, user: Row, token: string) {
    w.tables.users.push(user);
    w.tables.sessions.push({
        tokenHash: hashSessionToken(token),
        userId: user._id,
        userEmail: user.email,
        createdAt: Date.now(),
        lastSeenAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
    return { sessionToken: token, userEmail: user.email };
}

const call = (fn: any, ctx: any, args: any) => (fn as any)._handler(ctx, args);

function makeWorld() {
    const w = makeCtx();
    w.tables.firms.push(
        { _id: 'firm-1', name: 'Ade & Partners', inviteCode: 'INV-AAA111' },
        { _id: 'firm-2', name: 'Beta Chambers', inviteCode: 'INV-BBB222' },
    );
    const ADMIN = { _id: 'u-admin', id: 'u-admin', email: 'admin@firm1.com', tokenIdentifier: 'admin@firm1.com', name: 'Ada Admin', role: 'Admin', firmId: 'firm-1' };
    const LAWYER = { _id: 'u-lawyer', id: 'u-lawyer', email: 'lawyer@firm1.com', tokenIdentifier: 'lawyer@firm1.com', name: 'Lola Lawyer', role: 'Lawyer', firmId: 'firm-1' };
    const PORTAL = { _id: 'u-portal', id: 'u-portal', email: 'client@firm1.com', tokenIdentifier: 'client@firm1.com', name: 'Clive Client', role: 'Client', firmId: 'firm-1' };
    const F2_ADMIN = { _id: 'u-f2admin', id: 'u-f2admin', email: 'admin@firm2.com', tokenIdentifier: 'admin@firm2.com', name: 'Bisi Firm2', role: 'Admin', firmId: 'firm-2' };
    const FOUNDER = { _id: 'u-founder', id: 'u-founder', email: 'founder@practicepro.ng', tokenIdentifier: 'founder@practicepro.ng', name: 'Frank Founder', role: 'Founder', firmId: 'firm-3' };

    const ADMIN_AUTH = registerUser(w, ADMIN, 'tok-admin');
    const LAWYER_AUTH = registerUser(w, LAWYER, 'tok-lawyer');
    const PORTAL_AUTH = registerUser(w, PORTAL, 'tok-portal');
    const F2_AUTH = registerUser(w, F2_ADMIN, 'tok-f2admin');
    const FOUNDER_AUTH = registerUser(w, FOUNDER, 'tok-founder');
    // A REVOKED session for the founder.
    w.tables.sessions.push({
        tokenHash: hashSessionToken('tok-founder-revoked'),
        userId: 'u-founder', userEmail: 'founder@practicepro.ng',
        createdAt: Date.now() - 3600e3, lastSeenAt: Date.now() - 3600e3,
        expiresAt: Date.now() + 24 * 3600e3,
        revokedAt: Date.now() - 60e3,
    });

    // Seed feedback threads.
    w.tables.user_feedback.push(
        { _id: 'fb-1', firmId: 'firm-1', userId: 'u-admin', userName: 'Ada Admin', userEmail: 'admin@firm1.com', type: 'Bug Report', title: 'Crash on save', message: 'It crashes.', status: 'New', source: 'feedback', timestamp: 1, replies: [] },
        { _id: 'fb-2', firmId: 'firm-1', userId: 'u-lawyer', userName: 'Lola Lawyer', userEmail: 'lawyer@firm1.com', type: 'Feature Request', title: 'Dark mode', message: 'Please add.', status: 'Replied', source: 'feedback', timestamp: 2, replies: [] },
        { _id: 'fb-f2', firmId: 'firm-2', userId: 'u-f2admin', userName: 'Bisi Firm2', userEmail: 'admin@firm2.com', type: 'General', title: 'F2 thread', message: 'Hello.', status: 'New', source: 'feedback', timestamp: 3, replies: [] },
    );

    w.tables.organization_payout_details.push({
        _id: 'payout-1', corporateName: 'PracticePro Systems Limited',
        bankName: 'Guaranty Trust Bank', accountNumber: '0123456789',
        accountName: 'PracticePro Systems Limited', isActive: true,
    });

    return { w, ADMIN, LAWYER, PORTAL, F2_ADMIN, FOUNDER, ADMIN_AUTH, LAWYER_AUTH, PORTAL_AUTH, F2_AUTH, FOUNDER_AUTH };
}

const world = makeWorld();

// ═══════════════════════════════════════════════════════════════════════════
// SEC-9 — the feedback suite
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-B SEC-9 — submitFeedback attribution is session-derived', () => {
    it('anonymous → rejected (no spoofable public submissions)', async () => {
        await expect(call(submitFeedback, world.w.ctx, {
            firmId: 'firm-1', userId: 'u-admin', userName: 'Fake Ada', userEmail: 'admin@firm1.com',
            type: 'Bug Report', message: 'spoof attempt',
        })).rejects.toThrow(/Unauthenticated/i);
    });

    it('authenticated submission with SPOOFED identity args stores the SESSION caller instead', async () => {
        // The firm-1 ADMIN submits while claiming to be the lawyer.
        const id: any = await call(submitFeedback, world.w.ctx, {
            ...world.ADMIN_AUTH,
            firmId: 'firm-1',
            userId: 'u-lawyer', userName: 'Lola Lawyer', userEmail: 'lawyer@firm1.com',
            type: 'Bug Report', title: 'Spoofed', message: 'I am pretending to be Lola.',
        });
        const row = world.w.tables.user_feedback.find((f) => String(f._id) === String(id))!;
        expect(row.userId).toBe('u-admin');            // the SESSION caller
        expect(row.userName).toBe('Ada Admin');
        expect(row.userEmail).toBe('admin@firm1.com');
        expect(row.firmId).toBe('firm-1');
    });

    it('portal users may submit support tickets (any authenticated role)', async () => {
        const id: any = await call(submitFeedback, world.w.ctx, {
            ...world.PORTAL_AUTH,
            firmId: 'firm-1', userId: 'u-portal', userName: 'Clive Client', userEmail: 'client@firm1.com',
            type: 'Support', message: 'Portal user needs help.',
        });
        const row = world.w.tables.user_feedback.find((f) => String(f._id) === String(id))!;
        expect(row.userId).toBe('u-portal');
        expect(row.source).toBe('feedback');
        // Auto-reply + notification rows exist (legitimate submission works).
        expect(world.w.tables.notifications.length).toBeGreaterThan(0);
    });
});

describe('V1-B SEC-9 — getFeedbackList (founder inbox)', () => {
    it('anonymous / revoked-session / non-founder staff → rejected', async () => {
        await expect(call(getFeedbackList, world.w.ctx, {})).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFeedbackList, world.w.ctx, { sessionToken: 'tok-founder-revoked' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getFeedbackList, world.w.ctx, { ...world.ADMIN_AUTH })).rejects.toThrow(/Founder/i);
    });

    it('founder → the inbox works (Brevo-inbox functionality preserved)', async () => {
        const rows = await call(getFeedbackList, world.w.ctx, { ...world.FOUNDER_AUTH });
        expect(rows.length).toBeGreaterThanOrEqual(3);
        expect(rows.some((r: any) => r.title === 'Crash on save')).toBe(true);
    });
});

describe('V1-B SEC-9 — getMyFeedbackReplies (cross-user reads blocked)', () => {
    it('anonymous → rejected; own id → rows; another user\'s id → empty', async () => {
        await expect(call(getMyFeedbackReplies, world.w.ctx, { userId: 'u-admin' })).rejects.toThrow(/Unauthenticated/i);
        const own = await call(getMyFeedbackReplies, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-admin' });
        expect(own.some((r: any) => r._id === 'fb-1')).toBe(true);
        const foreign = await call(getMyFeedbackReplies, world.w.ctx, { ...world.ADMIN_AUTH, userId: 'u-lawyer' });
        expect(foreign).toEqual([]);
    });
});

describe('V1-B SEC-9 — adminReplyToFeedback (Brevo + push gated behind Founder)', () => {
    it('unauthorised replies CANNOT trigger the Brevo email dispatch', async () => {
        // Anonymous
        await expect(call(adminReplyToFeedback, world.w.ctx, {
            feedbackId: 'fb-1', adminId: 'x', message: 'hi', sendEmail: true,
        })).rejects.toThrow(/Unauthenticated/i);
        expect(world.w.scheduler.runAfter).not.toHaveBeenCalled();
        // Authenticated but NOT a founder
        await expect(call(adminReplyToFeedback, world.w.ctx, {
            ...world.ADMIN_AUTH, feedbackId: 'fb-1', adminId: 'x', message: 'hi', sendEmail: true,
        })).rejects.toThrow(/Founder/i);
        expect(world.w.scheduler.runAfter).not.toHaveBeenCalled();
        // Founder with a REVOKED session
        await expect(call(adminReplyToFeedback, world.w.ctx, {
            sessionToken: 'tok-founder-revoked', feedbackId: 'fb-1', adminId: 'x', message: 'hi', sendEmail: true,
        })).rejects.toThrow(/Unauthenticated/i);
        expect(world.w.scheduler.runAfter).not.toHaveBeenCalled();
        // And nothing was written to the thread by any of them.
        const row = world.w.tables.user_feedback.find((f) => f._id === 'fb-1')!;
        expect(row.replies).toEqual([]);
        expect(String(row.status)).toBe('New');
    });

    it('legitimate founder reply works, is attributed to the session caller, and Brevo fires ONLY when sendEmail is true', async () => {
        const res: any = await call(adminReplyToFeedback, world.w.ctx, {
            ...world.FOUNDER_AUTH, feedbackId: 'fb-1', adminId: 'spoofed-author@example.com',
            message: 'We fixed it.', channelType: 'SUPPORT', sendEmail: true,
        });
        expect(res.success).toBe(true);
        const row = world.w.tables.user_feedback.find((f) => f._id === 'fb-1')!;
        expect(row.replies).toHaveLength(1);
        // The reply author is the SESSION caller, not the caller-supplied adminId.
        expect(row.replies[0].adminId).toBe('founder@practicepro.ng');
        expect(String(row.status)).toBe('Replied');
        // Brevo scheduled exactly once, for the thread owner. (The function
        // reference is a Symbol-keyed object — assert on it structurally.)
        expect(world.w.scheduler.runAfter).toHaveBeenCalledTimes(1);
        const scheduledFn: any = world.w.scheduler.runAfter.mock.calls[0][1];
        expect(scheduledFn).toBeTruthy();
        expect((world.w.scheduler.runAfter.mock.calls[0][2] as any).userEmail).toBe('admin@firm1.com');
        expect((world.w.scheduler.runAfter.mock.calls[0][2] as any).replyMessage).toBe('We fixed it.');

        // In-app only (sendEmail omitted) — no Brevo, but the reply lands.
        world.w.scheduler.runAfter.mockClear();
        await call(adminReplyToFeedback, world.w.ctx, {
            ...world.FOUNDER_AUTH, feedbackId: 'fb-1', message: 'Follow-up.',
        });
        expect(world.w.scheduler.runAfter).not.toHaveBeenCalled();
        const row2 = world.w.tables.user_feedback.find((f) => f._id === 'fb-1')!;
        expect(row2.replies).toHaveLength(2);
    });
});

describe('V1-B SEC-9 — updateFeedbackStatus + cross-user thread mutations', () => {
    it('updateFeedbackStatus: anonymous/non-founder → rejected; founder → succeeds', async () => {
        await expect(call(updateFeedbackStatus, world.w.ctx, { feedbackId: 'fb-1', status: 'Resolved' })).rejects.toThrow(/Unauthenticated/i);
        await expect(call(updateFeedbackStatus, world.w.ctx, { ...world.ADMIN_AUTH, feedbackId: 'fb-1', status: 'Resolved' })).rejects.toThrow(/Founder/i);
        expect(String((world.w.tables.user_feedback.find((f) => f._id === 'fb-1') as any).status)).toBe('Replied');
        const res: any = await call(updateFeedbackStatus, world.w.ctx, { ...world.FOUNDER_AUTH, feedbackId: 'fb-1', status: 'Resolved' });
        expect(res.success).toBe(true);
        expect(String((world.w.tables.user_feedback.find((f) => f._id === 'fb-1') as any).status)).toBe('Resolved');
    });

    it('deleteFeedbackThread: a user cannot delete ANOTHER user\'s thread', async () => {
        await expect(call(deleteFeedbackThread, world.w.ctx, {
            ...world.ADMIN_AUTH, feedbackId: 'fb-2', deletedBy: 'admin@firm1.com',
        })).rejects.toThrow(/Not authorized/i);
        expect((world.w.tables.user_feedback.find((f) => f._id === 'fb-2') as any).deletedAt).toBeUndefined();
        // Own thread works.
        const res: any = await call(deleteFeedbackThread, world.w.ctx, {
            ...world.ADMIN_AUTH, feedbackId: 'fb-1', deletedBy: 'admin@firm1.com',
        });
        expect(res.success).toBe(true);
    });

    it('userReplyToFeedback: a user cannot reply to ANOTHER user\'s thread', async () => {
        await expect(call(userReplyToFeedback, world.w.ctx, {
            ...world.ADMIN_AUTH, feedbackId: 'fb-2', message: 'wrong thread',
        })).rejects.toThrow(/Not authorized/i);
        const res: any = await call(userReplyToFeedback, world.w.ctx, {
            ...world.LAWYER_AUTH, feedbackId: 'fb-2', message: 'my own follow-up',
        });
        expect(res.success).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-11 — regenerateInviteCode
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-B SEC-11 — regenerateInviteCode', () => {
    it('unauthorised callers cannot rotate invite codes — the target code is untouched', async () => {
        // Anonymous
        await expect(call(regenerateInviteCode, world.w.ctx, { firmId: 'firm-2' })).rejects.toThrow(/Unauthenticated/i);
        // Authenticated staff of a DIFFERENT firm (the cross-firm rotation attack)
        await expect(call(regenerateInviteCode, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-2' })).rejects.toThrow(/Not authorized/i);
        // Portal role
        await expect(call(regenerateInviteCode, world.w.ctx, { ...world.PORTAL_AUTH, firmId: 'firm-1' })).rejects.toThrow(/Portal/i);
        // Firm-2's own admin tries the BY-NAME lookup that used to exist
        await expect(call(regenerateInviteCode, world.w.ctx, { ...world.F2_AUTH, firmId: 'Ade & Partners' })).rejects.toThrow();
        // No code changed.
        expect((world.w.tables.firms.find((f) => f._id === 'firm-2') as any).inviteCode).toBe('INV-BBB222');
        expect((world.w.tables.firms.find((f) => f._id === 'firm-1') as any).inviteCode).toBe('INV-AAA111');
    });

    it('the owning firm\'s admin rotates their own code successfully', async () => {
        const newCode: any = await call(regenerateInviteCode, world.w.ctx, { ...world.ADMIN_AUTH, firmId: 'firm-1' });
        expect(String(newCode)).toMatch(/^INV-[A-Z2-9]{6}$/);
        expect((world.w.tables.firms.find((f) => f._id === 'firm-1') as any).inviteCode).toBe(newCode);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-12 — getOrgPayoutDetails
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-B SEC-12 — corporate bank details', () => {
    it('anonymous and invalid-session callers are rejected — banking details stay private', async () => {
        await expect(call(getOrgPayoutDetails, world.w.ctx, {})).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getOrgPayoutDetails, world.w.ctx, { sessionToken: 'never-issued' })).rejects.toThrow(/Unauthenticated/i);
    });

    it('authenticated checkout audiences (staff AND portal) still get the transfer instructions', async () => {
        const staff: any = await call(getOrgPayoutDetails, world.w.ctx, { ...world.ADMIN_AUTH });
        expect(staff?.accountNumber).toBe('0123456789');
        expect(staff?.bankName).toBe('Guaranty Trust Bank');
        const portal: any = await call(getOrgPayoutDetails, world.w.ctx, { ...world.PORTAL_AUTH });
        expect(portal?.accountNumber).toBe('0123456789');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-13 — public migration/backfill mutations are gone from the public API
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-B SEC-13 — backfills are internal-only', () => {
    it('both backfill mutations are internalMutation (not public mutation)', () => {
        const src = read('convex/migrations.ts');
        expect(src).toContain('export const backfillServiceChargeTenants = internalMutation({');
        expect(src).toContain('export const backfillNotificationTimestamps = internalMutation({');
        expect(src).not.toMatch(/export const \w+ = mutation\(/);
    });

    it('the operational CLI path is preserved unchanged (deploy-key authenticated)', () => {
        const wf = read('.github/workflows/convex-backfill.yml');
        expect(wf).toContain('npx convex run migrations:backfillNotificationTimestamps');
        // Idempotency markers survive (the handlers were never restructured).
        const src = read('convex/migrations.ts');
        expect(src).toContain('safe to re-run');
        expect(src).toContain('idempotent');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEC-16 — debug_env.checkEnv
// ═══════════════════════════════════════════════════════════════════════════
describe('V1-B SEC-16 — production env diagnostics', () => {
    it('the public checkEnv query is REMOVED (not merely hidden in the frontend)', () => {
        const src = read('convex/debug_env.ts');
        expect(src).not.toContain('export const checkEnv');
        expect(src).toContain('export const getEnvStatus = query({');
        expect(src).toContain('requireFounderCaller');
    });

    it('getEnvStatus: anonymous / non-founder → rejected; founder → diagnostics', async () => {
        await expect(call(getEnvStatus, world.w.ctx, {})).rejects.toThrow(/Unauthenticated/i);
        await expect(call(getEnvStatus, world.w.ctx, { ...world.ADMIN_AUTH })).rejects.toThrow(/Founder/i);
        const env: any = await call(getEnvStatus, world.w.ctx, { ...world.FOUNDER_AUTH });
        expect(env).toHaveProperty('hasBrevoApiKey');
        expect(env).toHaveProperty('hasFcmServiceAccount');
    });

    it('the production-deploy workflow probes the public ping, not the env diagnostics', () => {
        const wf = read('.github/workflows/production-deploy.yml');
        // The PROBE COMMAND must not target the env diagnostics (the comment
        // block documenting the change may mention the old name).
        expect(wf).not.toContain('"path":"debug_env:checkEnv"');
        expect(wf).toContain('"path":"myFunctions:ping"');
    });
});
