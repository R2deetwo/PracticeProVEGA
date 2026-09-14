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
});
