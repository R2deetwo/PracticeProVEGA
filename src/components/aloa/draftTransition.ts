/**
 * draftTransition.ts — Task 63: the "text vanishes while typing" race.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * USER REPORT: "i am typing in aloa and the message just disappears and
 * does not send."
 *
 * ROOT CAUSE: the draft-restore effect in AloaChat fires whenever
 * activeConversationId changes. When the FIRST message of a new chat is
 * sent, the queue task calls createConversationMutation and LATER calls
 * setActiveConversationId(newId) — on slow networks that can take seconds.
 * If the user starts typing their SECOND message in that window, the
 * '__new__' → real-id transition fired the restore effect, which replaced
 * the in-progress text with the new key's (empty) draft. The text they
 * were typing literally vanished from the input; hitting Send then hit
 * the `!content.trim()` guard and silently did nothing — "does not send".
 *
 * The fix: a '__new__' → real-id promotion is ALWAYS programmatic (it's
 * the send flow finishing its conversation creation — no user gesture is
 * involved). The in-progress typing belongs to the new conversation and
 * must be PRESERVED (the autosave effect migrates it to the new key on
 * the same render cycle). All other transitions (user switching between
 * conversations, starting a new chat) still restore the stored draft.
 */

export const NEW_CHAT_KEY = '__new__';

/** Build the draft-map key for a conversation id (null = new chat). */
export const draftKeyFor = (conversationId: string | null | undefined): string =>
    conversationId || NEW_CHAT_KEY;

/**
 * Should the draft-restore effect run for this transition?
 *
 * - '__new__' → real id: NO. Programmatic promotion after the first send.
 *   The text currently being typed belongs to the promoted conversation;
 *   restoring here is what wiped the user's in-progress message.
 * - Anything else (real → real, real → '__new__', initial null → null):
 *   YES — a user-initiated conversation switch. Restore the stored draft.
 */
export const shouldRestoreDraft = (
    prevKey: string | null | undefined,
    nextKey: string
): boolean => {
    const prev = prevKey || NEW_CHAT_KEY;
    if (prev === NEW_CHAT_KEY && nextKey !== NEW_CHAT_KEY) {
        // Programmatic promotion — preserve in-progress typing.
        return false;
    }
    return true;
};
