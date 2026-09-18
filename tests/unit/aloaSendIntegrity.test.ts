/**
 * aloaSendIntegrity.test.ts — Task 63: the ALOA/ARIA "message just
 * disappears and does not send" contracts (2026-09-19).
 *
 * USER CONTEXT: "i am typing in alo and it is not working the message just
 * disappears and does not seind. ... i made some improvements to aloa/aria
 * recently and i wonder if it was then that it broke."
 *
 * ROOT-CAUSE CHAIN (each pin below guards one link):
 *   A. DRAFT WIPE RACE — the draft-restore effect fired on the programmatic
 *      '__new__' → real-conversation-id promotion (the send flow's
 *      createConversationMutation resolving seconds late on slow networks)
 *      and replaced the text the user was ACTIVELY TYPING with the new
 *      key's empty draft. Hitting Send then tripped the `!content.trim()`
 *      guard and silently did nothing. This is the literal "I am typing
 *      and the message disappears".
 *   B. SILENT SAVE FAILURE — saveAloaMessage scanned the firm's
 *      conversations with .take(500) + client-side .find; past 500
 *      conversations every save threw "Conversation not found in your
 *      firm", and the client `void`ed the promise, so messages silently
 *      never persisted and vanished on the next history reload.
 *   C. REMOUNT HISTORY WIPE — the loadMessages effect guarded optimistic
 *      UI with a per-instance ref that resets on every panel remount; a
 *      remount mid-flight refetched history and wiped the optimistic
 *      messages, after which the AI response mapped over a list without
 *      its placeholder and was silently dropped.
 *   D. STUCK QUEUE — Convex mutations ignore AbortSignals, so on
 *      connected-but-dead networks one hung createConversationMutation
 *      blocked the send queue forever.
 *
 * PART 1 pins the draft-transition decision table (pure unit).
 * PART 2 source-scans the fixes into CI so a regression fails the build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldRestoreDraft, draftKeyFor, NEW_CHAT_KEY } from '../../src/components/aloa/draftTransition';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

// ─── PART 1: draft transition decision table ───────────────────────────────

describe('shouldRestoreDraft — the typing-wipe race', () => {
    it('does NOT restore on the programmatic __new__ → real-id promotion', () => {
        // The send flow finishing its conversation creation while the user
        // is already typing the next message. MUST preserve in-progress text.
        expect(shouldRestoreDraft(NEW_CHAT_KEY, 'k57abc123')).toBe(false);
        expect(shouldRestoreDraft(null, 'k57abc123')).toBe(false); // first run / mount shape
    });

    it('restores on user-initiated switches between real conversations', () => {
        expect(shouldRestoreDraft('k57abc123', 'k57def456')).toBe(true);
    });

    it('restores when the user starts a NEW chat from an existing one', () => {
        // real id → __new__: user clicked "New chat" — restore the (empty)
        // new-chat draft, i.e. clear the box.
        expect(shouldRestoreDraft('k57abc123', NEW_CHAT_KEY)).toBe(true);
    });

    it('is a no-op-safe true for the initial null → __new__ shape', () => {
        expect(shouldRestoreDraft(null, NEW_CHAT_KEY)).toBe(true);
        expect(shouldRestoreDraft(NEW_CHAT_KEY, NEW_CHAT_KEY)).toBe(true);
    });
});

describe('draftKeyFor', () => {
    it('maps null/undefined to the new-chat key and passes ids through', () => {
        expect(draftKeyFor(null)).toBe(NEW_CHAT_KEY);
        expect(draftKeyFor(undefined)).toBe(NEW_CHAT_KEY);
        expect(draftKeyFor('k57abc')).toBe('k57abc');
    });
});

// ─── PART 2: source-scan contracts (regression guards) ─────────────────────

describe('AloaChat wiring — Task 63 contracts', () => {
    const aloa = read('src/components/aloa/AloaChat.tsx');

    it('the draft-restore effect consults shouldRestoreDraft (race A)', () => {
        expect(aloa).toContain('shouldRestoreDraft(prevConvKeyRef.current, key)');
        // And no unconditional restore of the old shape remains.
        expect(aloa).not.toMatch(
            /setTextInput\(draftByConversationRef\.current\[activeConversationId \|\| '__new__'\]/
        );
    });

    it('the loadMessages guard covers the global queue, not just the instance ref (race C)', () => {
        expect(aloa).toContain('aiQueueRef.current.isProcessing || aiQueueRef.current.pendingCount > 0');
    });

    it('no fire-and-forget void saveMessageMutation remains (race B client half)', () => {
        expect(aloa).not.toContain('void saveMessageMutation(');
        // Failures are surfaced, debounced.
        expect(aloa).toContain('reportSaveFailure(addToast)');
        expect(aloa).toContain('lastSaveFailureToastAt');
    });

    it('the conversation-creation await is raced against the abort signal (race D)', () => {
        expect(aloa).toContain('await abortRace(createConversationMutation(');
    });
});

describe('Convex backend — Task 63 contracts', () => {
    const fns = read('convex/myFunctions.ts');

    it('saveAloaMessage uses the O(1) document get, not the take(500) scan (race B server half)', () => {
        const save = fns.slice(
            fns.indexOf('export const saveAloaMessage'),
            fns.indexOf('export const deleteAloaConversation')
        );
        expect(save).toContain('ctx.db.get(conversationId as any)');
        expect(save).not.toContain('take(500)');
    });

    it('deleteAloaConversation uses the O(1) document get too', () => {
        const del = fns.slice(fns.indexOf('export const deleteAloaConversation'));
        expect(del).toContain('ctx.db.get(args.conversationId as any)');
        const delBody = del.slice(0, del.indexOf('export const', 10));
        expect(delBody).not.toContain('.take(500).then(');
    });

    it('the by_firm scan pattern is gone from both conversation functions', () => {
        // The exact landmine: an index scan capped at 500 with a client-side
        // find on aloaConversations. (aloaMessages' by_conversation take is a
        // different, per-conversation read — not this bug.)
        expect(fns).not.toMatch(
            /query\("aloaConversations"\)[\s\S]{0,200}?take\(500\)/
        );
    });
});
