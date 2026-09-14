/**
 * Message push wiring + messaging-UX regression guards (2026-09-14 round).
 *
 * PART 1 — PUSH WIRING (the "no push when I send a message to a user on the
 * APK" fix). Root cause: every message-send path created in-app notification
 * rows and stopped there. No server code dispatched FCM for messages, and
 * notifyFirmAdmins's comment claimed "the frontend polls for new
 * notifications and triggers a local notification" — no such polling ever
 * existed. These tests pin the wiring so it can't be silently removed:
 *   - pushNotifications.dispatchPushToUsers collects ACTIVE tokens and
 *     schedules the FCM v1 action
 *   - sendChatMessage pushes to every recipient
 *   - notifyFirmAdmins pushes to the firm's admins
 *   - sendAdminReply pushes to the portal participant
 *   - the client tap handler broadcasts pp:navigate; App.tsx routes it
 *
 * PART 2 — UI regression guards for this round's reported defects:
 *   - "WELL?" wrapping mid-word ("WE"/"LL?") → break-all must stay dead
 *   - team accordion showing the FIRST message → pickLatestMessage
 *   - "opening a conversation doesn't scroll to the bottom" → the
 *     thread-switch effect must ALWAYS jump (the old version only jumped
 *     when the thread was empty — exactly backwards)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickLatestMessage } from '../../src/messaging/model';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();

const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

/** Extract a function body by anchor (from `anchor` to the closing `});` at column 0). */
function fnBlock(src: string, anchor: string): string {
    const start = src.indexOf(anchor);
    expect(start, `anchor not found: ${anchor}`).toBeGreaterThan(-1);
    const end = src.indexOf('\n});', start);
    return src.slice(start, end);
}

/** Strip /* … *​/ and // comments (strings preserved) so prose mentioning a
 * class name can't satisfy/violate a CSS-class contract. */
function stripComments(src: string): string {
    let out = '';
    let i = 0;
    let inString: string | null = null;
    while (i < src.length) {
        const ch = src[i];
        if (inString) {
            if (ch === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
            if (ch === inString) inString = null;
            out += ch; i += 1; continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inString = ch; out += ch; i += 1; continue; }
        if (ch === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
            i += 2;
            out += ' ';
            continue;
        }
        out += ch; i += 1;
    }
    return out;
}

describe('pickLatestMessage — the accordion "first message instead of last" cure', () => {
    it('returns the LAST element when the array is oldest-first (getChatMessages firmId order — the actual bug)', () => {
        const rows = [
            { id: 'm1', content: 'hello', timestamp: '2026-09-13T10:00:00.000Z' },
            { id: 'm2', content: 'how are you', timestamp: '2026-09-13T11:00:00.000Z' },
            { id: 'm3', content: 'WELL?', timestamp: '2026-09-13T12:00:00.000Z' },
        ];
        expect(pickLatestMessage(rows)?.id).toBe('m3');
    });

    it('returns the FIRST element when the array is newest-first (per-conversation query order)', () => {
        const rows = [
            { id: 'm3', content: 'WELL?', timestamp: '2026-09-13T12:00:00.000Z' },
            { id: 'm2', content: 'how are you', timestamp: '2026-09-13T11:00:00.000Z' },
            { id: 'm1', content: 'hello', timestamp: '2026-09-13T10:00:00.000Z' },
        ];
        expect(pickLatestMessage(rows)?.id).toBe('m3');
    });

    it('prefers timestamp over createdAt and mixes epoch-ms with ISO strings', () => {
        const rows = [
            { id: 'a', createdAt: 1789320000000 },
            { id: 'b', timestamp: '2026-09-14T09:00:00.000Z' }, // later than a's createdAt
            { id: 'c', timestamp: 1789310000000 },              // earlier than b
        ];
        expect(pickLatestMessage(rows)?.id).toBe('b');
    });

    it('skips deleted rows and returns undefined when everything is deleted or empty', () => {
        expect(pickLatestMessage([{ id: 'x', isDeleted: true, timestamp: 5 }])).toBeUndefined();
        expect(pickLatestMessage([])).toBeUndefined();
        expect(pickLatestMessage(undefined)).toBeUndefined();
        expect(pickLatestMessage(null)).toBeUndefined();
    });

    it('falls back to createdAt when timestamp is absent', () => {
        const rows = [
            { id: 'old', createdAt: '2026-09-01T00:00:00.000Z' },
            { id: 'new', createdAt: '2026-09-13T00:00:00.000Z' },
        ];
        expect(pickLatestMessage(rows)?.id).toBe('new');
    });
});

describe('push wiring — server side (source contract)', () => {
    it('pushNotifications.ts defines dispatchPushToUsers: active tokens + scheduled FCM action', () => {
        const src = read('convex/pushNotifications.ts');
        const block = fnBlock(src, 'export const dispatchPushToUsers = internalMutation');
        expect(block).toContain('by_user_active');
        expect(block).toContain('isActive');
        expect(block).toContain('internal.pushNotificationsNode.sendFcmPush');
        expect(block).toContain('runAfter');
        // Fire-and-forget: no token, no crash — a lookup failure is warned, not thrown.
        expect(block).toContain('console.warn');
    });

    it('sendChatMessage dispatches a real FCM push to every recipient', () => {
        const block = fnBlock(read('convex/myFunctions.ts'), 'export const sendChatMessage = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toContain('userIds: recipientIds');
        // A push failure must never fail the message send.
        expect(block).toMatch(/Push dispatch failed/);
    });

    it('notifyFirmAdmins dispatches a real FCM push to the firm admins (all portal inbound)', () => {
        const src = read('convex/portals.ts');
        const start = src.indexOf('async function notifyFirmAdmins(');
        expect(start).toBeGreaterThan(-1);
        // Slice generously: to the next top-level doc comment after the helper.
        const end = src.indexOf('\n/**', start + 10);
        const body = src.slice(start, end > 0 ? end : start + 6000);
        expect(body).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(body).toContain('admins.map');
        // The false "the app itself notices new notifications" assumption must
        // be gone from real code (comments are stripped — explanatory prose
        // quoting the old bug is fine).
        expect(stripComments(body)).not.toContain('the frontend polls for new notifications');
        expect(stripComments(body)).not.toContain('The frontend will detect the new in-app notification');
    });

    it('sendAdminReply dispatches a real FCM push to the portal participant', () => {
        const block = fnBlock(read('convex/portals.ts'), 'export const sendAdminReply = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toContain('participantId');
    });

    // ─── Round 2 (2026-09-14): the "slow support message" root causes ────
    // The founder↔user support thread (user_feedback) never dispatched FCM
    // in EITHER direction — replies only surfaced when the recipient next
    // opened the app. These guard the new dispatches.

    it('userReplyToFeedback dispatches a real FCM push to founders (user → founder)', () => {
        const block = fnBlock(read('convex/feedback.ts'), 'export const userReplyToFeedback = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toContain('founders.map');
        // One tray row per thread + categorized channel.
        expect(block).toContain('tag: `feedback:');
        expect(block).toContain('practicepro-messages');
        // A push failure must never fail the reply.
        expect(block).toMatch(/Push dispatch failed/);
    });

    it('adminReplyToFeedback dispatches a real FCM push to the thread owner (founder → user)', () => {
        const block = fnBlock(read('convex/feedback.ts'), 'export const adminReplyToFeedback = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toContain('feedback.userId');
        expect(block).toContain('tag: `feedback:');
        expect(block).toMatch(/Push dispatch failed/);
    });

    it('submitFeedback notifies founders of new threads/issues with a categorized push', () => {
        const block = fnBlock(read('convex/feedback.ts'), 'export const submitFeedback = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toMatch(/Founder notification failed/);
        // Issue-like reports land on the tasks channel, everything else on messages.
        expect(block).toContain('practicepro-tasks');
        expect(block).toContain('practicepro-messages');
    });

    it('verifyCode pushes new registrations to founders (the "closer eye on signups" requirement)', () => {
        const block = fnBlock(read('convex/myFunctions.ts'), 'export const verifyCode = mutation');
        expect(block).toContain('notifyFounders');
        expect(block).toContain('new_signup');
    });

    it('createFirm pushes new organizations to founders', () => {
        const block = fnBlock(read('convex/myFunctions.ts'), 'export const createFirm = mutation');
        expect(block).toContain('notifyFounders');
        expect(block).toContain('new_org');
    });

    it('notifyFounders routes through dispatchPushToUsers with string userIds', () => {
        const src = read('convex/founderNotifications.ts');
        expect(src).toContain('String(founder._id)');
        expect(src).toContain('internal.pushNotifications.dispatchPushToUsers');
        // The bespoke token query (which skipped categorization/pruning) must be gone.
        expect(stripComments(src)).not.toContain('user_push_tokens');
    });

    it('updateMaintenanceTicketStatus pushes status changes to the resident', () => {
        const block = fnBlock(read('convex/portals.ts'), 'export const updateMaintenanceTicketStatus = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toMatch(/Push to resident failed/);
        expect(block).toContain('practicepro-tasks');
    });

    it('updateClientServiceRequestStatus pushes status changes to the client', () => {
        const block = fnBlock(read('convex/portals.ts'), 'export const updateClientServiceRequestStatus = mutation');
        expect(block).toContain('internal.pushNotifications.dispatchPushToUsers');
        expect(block).toMatch(/Push to client failed/);
    });
});

describe('push wiring — client side (source contract)', () => {
    it('usePushNotifications broadcasts pp:navigate for messaging pushes on tap', () => {
        const src = read('src/hooks/usePushNotifications.ts');
        expect(src).toContain('pushNotificationActionPerformed');
        expect(src).toContain("pp:navigate");
        expect(src).toContain('chat_message');
        expect(src).toContain('portal_reply');
    });

    it('App.tsx listens for pp:navigate and routes to the messaging view', () => {
        const src = read('src/components/App.tsx');
        expect(src).toContain("addEventListener('pp:navigate'");
        expect(src).toContain("navigateTo('messaging'");
    });
});

describe('messaging-UX regression guards (source contract)', () => {
    it('no message-content element uses break-all (the "WELL?" → "WE"/"LL?" mid-word wrap)', () => {
        // Comments legitimately MENTION break-all when explaining why it was
        // removed — only a real className usage violates this contract.
        expect(stripComments(read('src/components/toolkit/ChatMessageBubble.tsx'))).not.toMatch(
            /break-all/
        );
        expect(stripComments(read('src/components/messaging/MessageThread.tsx'))).not.toMatch(
            /break-all/
        );
    });

    it('MessagesView computes the accordion preview with pickLatestMessage (order-independent)', () => {
        const src = read('src/components/MessagesView.tsx');
        expect(src).toContain('pickLatestMessage(convMessages)');
        // The stale pattern that caused "first message instead of last":
        expect(src).not.toMatch(/lastMsg = convMessages\[0\]/);
    });

    it('MessageThread jumps to the bottom on EVERY thread switch (the old empty-only condition is gone)', () => {
        const src = read('src/components/messaging/MessageThread.tsx');
        // The thread-switch effect must reset the tracker, mark at-bottom, and jump unconditionally.
        const threadKeyEffect = src.slice(
            src.indexOf('[threadKey]'),
            src.lastIndexOf('[threadKey]')
        );
        expect(threadKeyEffect).toContain('setIsAtBottom(true)');
        expect(threadKeyEffect).not.toContain('sorted.length === 0');
        // The new-message effect must still exist (scroll on new message when at bottom).
        expect(src).toContain('isNewMessage');
    });
});
