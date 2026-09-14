/**
 * chatSenderIdentity.test.ts — "Unknown sender" / vanishing moniker contract
 * (2026-09-14).
 *
 * USER CONTEXT: "mid conversation it started saying unknown sender and the
 * moniker disappeared. i need you to figure out why this would happen and
 * prevent it from happening again please."
 *
 * ROOT CAUSES (three stacked, all fixed):
 *   A. Team chat: the server-side sendChatMessage mutation computed
 *      senderName for the notification text but never PERSISTED it on the
 *      row — every message since the cutover rendered as "Unknown sender"
 *      with a 'U' avatar whenever the client resolved names from the row.
 *   B. Portal threads: sendPortalMessage patched participantName with
 *      `?? existing` — an EMPTY STRING overwrites, wiping the stored name
 *      mid-conversation (header flips to "Unknown").
 *   C. Both surfaces had no read-time fallback, so any missing/blank name
 *      rendered blank forever.
 *
 * PINS:
 *   1. sendChatMessage persists authorName at insert time.
 *   2. getChatMessages repairs legacy rows via enrichChatAuthorNames
 *      (users-table lookup by custom id, then Convex _id) — BOTH read
 *      branches, in-memory only (queries can't write).
 *   3. Portal: sendPortalMessage only patches NON-EMPTY participant names.
 *   4. Portal: conversations + message reads heal blank names read-time.
 *   5. The inbox moniker falls back to the last message's authorName so the
 *      avatar/label never blanks while data loads.
 *   6. All three thread surfaces clamp horizontal overflow (the same round's
 *      "conversations scroll left/right" bug — vertical only).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const MYFNS = 'convex/myFunctions.ts';
const PORTALS = 'convex/portals.ts';
const SCHEMA = 'convex/schema.ts';
const MESSAGES = 'src/components/MessagesView.tsx';

describe('chat sender identity (source-scanned contract)', () => {
    const fns = read(MYFNS);

    it('1. sendChatMessage persists authorName on every new row', () => {
        const idx = fns.indexOf('export const sendChatMessage');
        expect(idx).toBeGreaterThan(-1);
        // The mutation is long — locate ITS insert (the first chatMessages
        // insert after the function starts), not an arbitrary 5000-char window.
        const insertAt = fns.indexOf('ctx.db.insert("chatMessages"', idx);
        expect(insertAt).toBeGreaterThan(idx);
        const insert = fns.slice(insertAt, insertAt + 700);
        expect(insert).toContain('authorName: senderName');
        // The schema field exists for it.
        const schema = read(SCHEMA);
        const chatIdx = schema.indexOf('chatMessages: defineTable');
        const chatTable = schema.slice(chatIdx, chatIdx + 1200);
        expect(chatTable).toContain('authorName: nullableString');
    });

    it('2. getChatMessages enriches legacy rows (both read branches, read-only)', () => {
        const idx = fns.indexOf('export const getChatMessages');
        expect(idx).toBeGreaterThan(-1);
        const body = fns.slice(idx, idx + 9000);

        // The resolver exists and is used by BOTH branches.
        expect(body.match(/enrichChatAuthorNames\(ctx, /g)?.length ?? 0).toBe(2);
        const enrichIdx = fns.indexOf('async function enrichChatAuthorNames');
        expect(enrichIdx).toBeGreaterThan(-1);
        const enrich = fns.slice(enrichIdx, enrichIdx + 1600);
        // Lookup order: users-table custom id first, Convex _id fallback.
        expect(enrich).toContain('by_custom_id');
        expect(enrich).toContain('ctx.db.get(key)');
        // Only fills BLANK names — never overwrites a stored name.
        expect(enrich).toContain('!(typeof m.authorName === "string" && m.authorName.trim())');
    });

    it('3. portal sends never blank the participant name (empty-string guard)', () => {
        const portals = read(PORTALS);
        const idx = portals.indexOf('export const sendPortalMessage');
        expect(idx).toBeGreaterThan(-1);
        const body = portals.slice(idx, idx + 5000);
        expect(body).toContain('typeof effectiveParticipantName === "string" && effectiveParticipantName.trim()');
        expect(body).toContain('typeof effectiveParticipantEmail === "string" && effectiveParticipantEmail.trim()');
    });

    it('4. portal reads heal wiped names (conversations + thread messages)', () => {
        const portals = read(PORTALS);
        const convIdx = portals.indexOf('export const getPortalConversationsByFirm');
        expect(convIdx).toBeGreaterThan(-1);
        const convBody = portals.slice(convIdx, convIdx + 4000);
        expect(convBody).toContain('identity-loss repair');
        expect(convBody).toContain('by_custom_id');

        const msgIdx = portals.indexOf('export const getConversationMessages');
        expect(msgIdx).toBeGreaterThan(-1);
        const msgBody = portals.slice(msgIdx, msgIdx + 5000);
        expect(msgBody).toContain('identity-loss repair');
        // Admin senders must NOT inherit the participant's name (that would
        // mislabel staff messages as resident messages).
        expect(msgBody).toContain('"admin"');
    });

    it('5. the inbox moniker falls back to the last message authorName', () => {
        const ui = read(MESSAGES);
        expect(ui).toContain('otherMemberResolvedName');
        const resolveIdx = ui.indexOf('otherMemberResolvedName =');
        const resolve = ui.slice(resolveIdx, resolveIdx + 500);
        expect(resolve).toContain('lastMsg?.authorName');
        // Avatar AND label both consume the resolved name (the moniker).
        expect(ui.match(/tc\.otherMemberResolvedName/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    });

    it('6. all three thread surfaces are vertical-only (overflow-x clamped)', () => {
        const thread = read('src/components/messaging/MessageThread.tsx');
        const threadIdx = thread.indexOf('overflow-y-auto overflow-x-hidden');
        expect(threadIdx).toBeGreaterThan(-1);

        const aloa = read('src/components/aloa/AloaChat.tsx');
        expect(aloa).toContain('overflow-y-auto overflow-x-hidden');

        // P5 split: the tenant chat surface moved from the TenantPortal.tsx
        // monolith into TenantPortal/MessagesTab.tsx.
        const tenant = read('src/components/tenant/TenantPortal/MessagesTab.tsx');
        expect(tenant).toContain('overflow-y-auto overflow-x-hidden');
    });
});
