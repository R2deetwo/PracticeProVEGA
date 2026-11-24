/**
 * strictIdentityCallSites.test.ts — regression guard for the R16 strict
 * identity cutover at the UI layer.
 *
 * ROOT CAUSE THIS FILE PINS (found by the Vega smoke pass, 2026-09-14):
 * TrustAccountTab called getTrustBalance / getTrustTransactions /
 * recordTrustTransaction / deleteTrustTransaction with ONLY { firmId }.
 * The Convex handlers auth-first (requireFirmUser / requireAdmin) → every
 * call threw "Unauthenticated" → useQuery held undefined forever (balance
 * card stuck on "—", ledger never loaded, deposits failed). No crash, no
 * toast — a silent feature death that the Atrium-heavy test suite never
 * saw because nothing Vega-side exercised it.
 *
 * CONTRACT: every guarded Convex call in the critical Vega surfaces MUST
 * pass the bearer sessionToken. Source-scanned (house pattern) so removing
 * any of them fails CI instead of silently breaking the feature.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/trustAccount.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

/** True when the guarded call `fnRef` is invoked with sessionToken within
 *  the same statement. Window is generous (900 chars) because these calls
 *  sit inside deeply-indented JSX — up to ~72 spaces per line — so the
 *  sessionToken arg can start ~700 chars after the opening reference. */
const callPassesSession = (source: string, fnRef: string, window = 900): boolean => {
    let idx = source.indexOf(fnRef);
    let found = false;
    while (idx !== -1) {
        const stmt = source.slice(idx, idx + window);
        if (/sessionToken\s*:/.test(stmt)) found = true;
        idx = source.indexOf(fnRef, idx + 1);
    }
    return found;
};

describe('strict identity: guarded Convex call sites carry sessionToken', () => {
    it('TrustAccountTab — all 4 trust call sites (the smoke-test regression)', () => {
        const src = read('src/components/details/TrustAccountTab.tsx');
        expect(callPassesSession(src, 'api.trustAccount.getTrustBalance')).toBe(true);
        expect(callPassesSession(src, 'api.trustAccount.getTrustTransactions')).toBe(true);
        expect(callPassesSession(src, 'recordTransaction({')).toBe(true);
        expect(callPassesSession(src, 'deleteTransaction({')).toBe(true);
    });

    it('DataProvider — matters CRUD (createItem / updateItem / deleteItem)', () => {
        const src = read('src/components/../contexts/DataProvider.tsx');
        expect(callPassesSession(src, 'createItemMutation({')).toBe(true);
        expect(callPassesSession(src, 'updateItemMutation({')).toBe(true);
        expect(callPassesSession(src, 'deleteItemMutation({')).toBe(true);
    });

    it('AloaChat — saveAloaMessage + createAloaConversation', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(callPassesSession(src, 'saveMessageMutation(')).toBe(true);
        expect(callPassesSession(src, 'createConversationMutation(')).toBe(true);
    });

    it('MessagesView — sendChatMessage (team + client threads)', () => {
        const src = read('src/components/MessagesView.tsx');
        expect(callPassesSession(src, 'sendChatMessageMutation(')).toBe(true);
    });

    // ── MESSAGING AUDIT (2026-11-24) ─────────────────────────────────────
    // The audit found four silent-dead call sites in the Messages hub that
    // the original scan never covered: sendAdminReply (every general
    // conversation reply failed with "Unauthenticated"), generateUploadUrl
    // ×3 (team attachments, voice notes, admin reply attachments), the
    // ticket-record refresh query, and NoticeBoardTab's createNotice.
    // These pins keep the bearers on those exact calls.
    it('MessagesView — sendAdminReply (general conversation replies)', () => {
        const src = read('src/components/MessagesView.tsx');
        // Wider window (1400): the fix note between the call and the bearer
        // pushes sessionToken ~1020 chars past the call site.
        expect(callPassesSession(src, 'sendAdminReply({', 1400)).toBe(true);
    });
    it('MessagesView — every generateUploadUrl call carries the bearer', () => {
        const src = read('src/components/MessagesView.tsx');
        expect(src.split('await generateUploadUrl(').length - 1).toBe(3); // all three sites in one shape
        expect(callPassesSession(src, 'await generateUploadUrl(')).toBe(true);
    });
    it('MessagesView — ticket record refresh query carries the bearer', () => {
        const src = read('src/components/MessagesView.tsx');
        expect(callPassesSession(src, 'convex.query(queryFn,')).toBe(true);
    });
    it('NoticeBoardTab — createNotice carries the bearer (notices actually post)', () => {
        const src = read('src/components/messaging/NoticeBoardTab.tsx');
        expect(callPassesSession(src, 'createNotice({')).toBe(true);
    });
    it('AloaChat — attachment upload URL carries the bearer', () => {
        const src = read('src/components/aloa/AloaChat.tsx');
        expect(callPassesSession(src, 'generateUploadUrl({')).toBe(true);
    });

    // Portal-side messaging attachments: the firm generateUploadUrl
    // (requireFirmUser) rejects Tenant/Client roles outright — the portal
    // surfaces must use the portal-scoped endpoint WITH the bearer.
    it('Portal upload call sites — portal endpoint + bearer everywhere', () => {
        for (const f of [
            'src/components/tenant/TenantPortal/MessagesTab.tsx',
            'src/components/tenant/TenantPortal/PaymentsTab.tsx',
            'src/components/tenant/TenantPortal/MaintenanceTab.tsx',
            'src/components/client/ClientDashboard.tsx',
        ]) {
            const src = read(f);
            expect(src).toContain('api.myFunctions.generatePortalUploadUrl');
            expect(src).not.toContain('api.myFunctions.generateUploadUrl');
            expect(callPassesSession(src, 'generateUploadUrl({')).toBe(true);
        }
    });

    // The messaging audit also removed the dead delete-routing: the
    // thread-header trash must go through handleDeleteThread, which
    // routes conversations → deleteConversationCascade, legacy portal →
    // adminDeletePortalMessage, inbound → deleteInboundMessage.
    it('MessagesView — thread-header delete routes through handleDeleteThread', () => {
        const src = read('src/components/MessagesView.tsx');
        expect(src).toContain('onClick={handleDeleteThread}');
        expect(src).toContain('const deleteConversationCascade');
        // The old inline deleteInboundMessage-on-conversation-ids bug
        // must not return: the only remaining deleteInboundMessage call
        // sites live inside handleDeleteThread itself.
        expect(src.match(/deleteInboundMessage\(\{/g)?.length).toBeLessThanOrEqual(1);
    });

    // The inbox→compose handoff must carry the typed reply text instead
    // of discarding it, and the simulated/offline path must NOT toast
    // "Reply sent." for an undelivered message.
    it('MessagesView — inbox reply handoff carries text + honest toasts', () => {
        const src = read('src/components/MessagesView.tsx');
        expect(src).toContain('message: inboxReply.trim() || undefined');
        expect(src).not.toContain("addToast('Reply sent.', { type: 'success' });\n            } else {\n                // Save to audit log so reply is not lost");
    });
    it('ComposeModal — prefill.message seeds the composer (not discarded)', () => {
        const src = read('src/components/atrium/ComposeModal.tsx');
        expect(src).toContain("prefill?.message ?? ''");
        expect(src).toContain('message?: string;');
    });
});
