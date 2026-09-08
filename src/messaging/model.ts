/**
 * ─── Unified Messaging Model (Path B: presentation-layer unification) ───
 *
 * CONTEXT: the app stores "messages" in 8 backend tables with incompatible
 * field shapes (string vs numeric timestamps, 4 different sender
 * representations, 3 different read-status conventions — see
 * docs/MESSAGING_UNIFICATION.md). Until a backend consolidation is
 * explicitly approved, this module is the ONE canonical message shape every
 * thread-rendering surface maps into. No view should sort, compare, or
 * render raw table rows directly anymore.
 *
 * Canonical rules:
 *  - sentAt is ALWAYS an epoch-ms number (converted from string ISO dates
 *    or numeric epochs at the adapter boundary).
 *  - sender is ALWAYS a UnifiedSender (id/name/role/contact, all optional).
 *  - read state is ALWAYS a ReadState union, derived per source convention.
 *  - isMe is ALWAYS resolved at the adapter boundary against the current
 *    user id, so renderers never branch on sender fields again.
 */

// ─── Kinds (the four-way taxonomy) ────────────────────────────────────────
/** The four genuinely-distinct conversation families a user experiences. */
export type ThreadKind =
    | 'team'          // internal staff ↔ staff chat (chatMessages/chatConversations)
    | 'client_tenant' // external humans: clients, tenants, residents (portal_messages, clientMessages)
    | 'ai_assistant'  // ALOA + Research chat (aloaMessages, researchMessages)
    | 'automated';    // WhatsApp inbound, scheduled sends (atrium_inbound_messages, scheduled_messages)

/** Display tag within a client_tenant thread — replaces the old
 *  ConversationType union and its preview-prefix sniffing (T:/R:/A:/🚫). */
export type ClientThreadTag = 'ticket' | 'request' | 'replied' | 'general';

// ─── Canonical shapes ─────────────────────────────────────────────────────
export interface UnifiedSender {
    /** Stable user id when the source table has one (authorId/senderId). */
    id?: string;
    /** Display name (resolved or denormalized from the source row). */
    name?: string;
    /** Source-native role: 'Admin' | 'Tenant' | 'Client' | 'user' | 'model' | 'tool' … */
    role?: string;
    /** External contact channel (email/phone) when there is no user id. */
    contact?: string;
}

export type ReadState = 'unread' | 'read' | 'replied' | 'none';

export type DeliveryStatus =
    | 'pending' | 'sent' | 'delivered' | 'read' | 'failed'   // chatMessages.status
    | 'scheduled' | 'cancelled' | 'sent_failed';              // scheduled_messages.status

export interface UnifiedAttachment {
    /** Convex storage id — URL is `${VITE_CONVEX_URL}/api/storage/${storageId}`. */
    storageId: string;
    /** Original filename for display. */
    name: string;
}

export interface UnifiedMessage {
    /** Stable key (source id or _id). */
    id: string;
    kind: ThreadKind;
    sender: UnifiedSender;
    /** Plain-text content. Rich/AI content can be re-derived from `raw`. */
    content: string;
    /** Canonical epoch-ms — ALWAYS a number, from any source shape. */
    sentAt: number;
    /** Resolved against the current user at the adapter boundary. */
    isMe: boolean;
    read: ReadState;
    deliveryStatus?: DeliveryStatus;
    isDeleted?: boolean;
    isEdited?: boolean;
    editedAt?: string;
    attachments: UnifiedAttachment[];
    /** Subject line (portal_messages only; rendered as a header in threads). */
    subject?: string;
    // client_tenant wiring (portal_messages rows)
    linkedTicketId?: string;
    linkedRequestId?: string;
    /** Sub-thread grouping (replies under a specific ticket message). */
    threadTicketId?: string;
    requestTypeLabel?: string;
    /** Citations payload (ai_assistant: researchMessages). */
    citations?: any[];
    /** The raw source row, for view-specific slots. Never used for sorting. */
    raw: any;
}

// ─── Timestamp normalisation ──────────────────────────────────────────────
/**
 * Convert any source timestamp shape to epoch ms.
 * Handles: epoch-ms numbers, ISO/loose date strings, numeric strings,
 * Date objects. Returns 0 when unparseable (sorts oldest, never NaN-crashes).
 */
export function toEpochMs(
    ts: string | number | Date | undefined | null,
): number {
    if (ts === undefined || ts === null) return 0;
    if (ts instanceof Date) {
        const t = ts.getTime();
        return isNaN(t) ? 0 : t;
    }
    if (typeof ts === 'number') {
        return isNaN(ts) ? 0 : ts;
    }
    // string: pure-numeric strings are epoch-ms (check FIRST — Date.parse
    // misinterprets long digit strings as dates); otherwise parse as a date
    if (/^-?\d+$/.test(ts.trim())) {
        const asNum = Number(ts);
        return isNaN(asNum) ? 0 : asNum;
    }
    const asDate = new Date(ts).getTime();
    return isNaN(asDate) ? 0 : asDate;
}

/** Sort ascending (oldest first, newest at bottom — thread order). */
export function sortUnifiedMessages(messages: UnifiedMessage[]): UnifiedMessage[] {
    return [...messages].sort((a, b) => a.sentAt - b.sentAt);
}

// ─── Adapters (one per source table) ──────────────────────────────────────
function keyOf(row: any): string {
    return String(row?._id ?? row?.id ?? Math.random().toString(36).slice(2));
}

function currentUserIdOf(currentUser: { id?: string; _id?: any } | undefined | null): string {
    return String(currentUser?.id ?? currentUser?._id ?? '');
}

/** chatMessages — string timestamps, authorId sender, status delivery enum. */
export function normalizeChatMessage(
    msg: any,
    currentUser?: { id?: string; _id?: any } | null,
): UnifiedMessage {
    const uid = currentUserIdOf(currentUser);
    return {
        id: keyOf(msg),
        kind: 'team',
        sender: { id: msg?.authorId, name: msg?.authorName, role: 'staff' },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.timestamp ?? msg?.createdAt),
        isMe: Boolean(uid) && String(msg?.authorId) === uid,
        read: 'none', // chatMessages has no per-message read tracking
        deliveryStatus: msg?.status as DeliveryStatus | undefined,
        isDeleted: Boolean(msg?.isDeleted),
        isEdited: Boolean(msg?.isEdited),
        editedAt: msg?.editedAt,
        attachments: [],
        raw: msg,
    };
}

/** clientMessages — legacy Vega per-matter stream; boolean isRead. */
export function normalizeClientMessage(
    msg: any,
    currentUser?: { id?: string; _id?: any } | null,
): UnifiedMessage {
    const uid = currentUserIdOf(currentUser);
    return {
        id: keyOf(msg),
        kind: 'client_tenant',
        sender: { id: msg?.authorId, name: msg?.authorName, role: msg?.authorRole ?? (msg?.isFromClient ? 'Client' : 'staff') },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.timestamp ?? msg?.createdAt),
        isMe: Boolean(uid) && String(msg?.authorId) === uid,
        read: msg?.isRead === true ? 'read' : 'unread',
        attachments: [],
        raw: msg,
    };
}

/**
 * portal_messages — numeric createdAt, 4-field sender, dual read fields
 * (status enum + isRead boolean), ticket/request wiring, sub-threading.
 */
export function normalizePortalMessage(
    msg: any,
    currentUser?: { id?: string; _id?: any } | null,
    /**
     * opts.perspective — whose side of the conversation the renderer sits on.
     *  - 'firm' (default): staff app; isMe = firm-side senders (Admin).
     *  - 'participant': PORTAL side; isMe = the portal user (Tenant/Client).
     *    The portals invert identity — the firm's replies are "them".
     */
    opts?: { firmIsSender?: (m: any) => boolean; perspective?: 'firm' | 'participant' },
): UnifiedMessage {
    const uid = currentUserIdOf(currentUser);
    const senderIsAdmin = opts?.firmIsSender
        ? opts.firmIsSender(msg)
        : String(msg?.senderRole).toLowerCase() === 'admin';
    const participantIsSender = opts?.perspective === 'participant'
        ? !senderIsAdmin
        : senderIsAdmin;
    const read: ReadState = (() => {
        if (msg?.status === 'replied') return 'replied';
        if (msg?.isRead === true || msg?.status === 'read') return 'read';
        return 'unread';
    })();
    return {
        id: keyOf(msg),
        kind: 'client_tenant',
        sender: {
            id: msg?.senderId,
            name: msg?.senderName,
            role: msg?.senderRole,
            contact: msg?.senderEmail,
        },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.createdAt ?? msg?.timestamp),
        isMe: (opts?.perspective === 'participant'
            ? participantIsSender || (Boolean(uid) && String(msg?.senderId) === uid)
            : senderIsAdmin || (Boolean(uid) && String(msg?.senderId) === uid)),
        read,
        isDeleted: Boolean(msg?.isDeleted),
        subject: msg?.subject ?? undefined,
        attachments: (msg?.attachments ?? []).map((sid: string, i: number) => ({
            storageId: String(sid),
            name: msg?.attachmentNames?.[i] ?? `File ${i + 1}`,
        })),
        linkedTicketId: msg?.linkedTicketId ? String(msg?.linkedTicketId) : undefined,
        linkedRequestId: msg?.linkedRequestId ? String(msg?.linkedRequestId) : undefined,
        threadTicketId: msg?.threadTicketId ? String(msg?.threadTicketId) : undefined,
        requestTypeLabel: msg?.requestTypeLabel ?? undefined,
        raw: msg,
    };
}

/** aloaMessages — numeric createdAt, AI role enum. */
export function normalizeAloaMessage(msg: any): UnifiedMessage {
    const role = String(msg?.role ?? 'model');
    return {
        id: keyOf(msg),
        kind: 'ai_assistant',
        sender: { role, name: role === 'user' ? 'You' : 'ALOA' },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.createdAt ?? msg?.timestamp),
        isMe: role === 'user',
        read: 'none',
        deliveryStatus: msg?.isError ? 'failed' : undefined,
        attachments: (msg?.attachments ?? []).map((sid: string, i: number) => ({
            storageId: String(sid),
            name: msg?.attachmentNames?.[i] ?? `File ${i + 1}`,
        })),
        raw: msg,
    };
}

/** researchMessages — string timestamps, AI role enum, citations. */
export function normalizeResearchMessage(msg: any): UnifiedMessage {
    const role = String(msg?.role ?? 'model');
    return {
        id: keyOf(msg),
        kind: 'ai_assistant',
        sender: { role, name: role === 'user' ? 'You' : 'Research' },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.timestamp ?? msg?.createdAt),
        isMe: role === 'user',
        read: 'none',
        citations: msg?.citations,
        attachments: [],
        raw: msg,
    };
}

/** atrium_inbound_messages — numeric receivedAt, contact-only sender. */
export function normalizeInboundMessage(msg: any): UnifiedMessage {
    return {
        id: keyOf(msg),
        kind: 'client_tenant',
        sender: { name: msg?.senderName, contact: msg?.senderContact, role: 'external' },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.receivedAt ?? msg?.createdAt),
        isMe: false, // inbound by definition
        read: msg?.isRead ? 'read' : 'unread',
        attachments: msg?.mediaUrl ? [{ storageId: String(msg.mediaUrl), name: 'Attachment' }] : [],
        raw: msg,
    };
}

/** scheduled_messages — not a conversation; activity-log rows. */
export function normalizeScheduledMessage(msg: any): UnifiedMessage {
    const status = String(msg?.status ?? 'scheduled');
    return {
        id: keyOf(msg),
        kind: 'automated',
        sender: {
            name: msg?.recipientName ?? 'Recipient',
            contact: msg?.recipientPhone ?? msg?.recipientEmail,
            role: msg?.isAutomation ? 'automation' : 'staff',
        },
        content: msg?.content ?? '',
        sentAt: toEpochMs(msg?.scheduledFor ?? msg?.sentAt ?? msg?.createdAt),
        isMe: false,
        read: 'none',
        attachments: [],
        deliveryStatus: status === 'sent' ? 'sent'
            : status === 'failed' ? 'sent_failed'
                : status === 'cancelled' ? 'cancelled'
                    : 'scheduled',
        raw: msg,
    };
}

// ─── Conversation tag derivation (replaces prefix sniffing) ───────────────
/**
 * Derives a client_tenant conversation's display tag from STORED DATA —
 * the conversation's message set (linkedTicketId / linkedRequestId /
 * threadTicketId fields) — instead of sniffing `T:`/`R:`/`A:`/`🚫` prefixes
 * out of lastMessagePreview, which changes whenever the last message
 * changes and was the source of mislabelled inbox rows.
 *
 * @param conv        portal_conversations row (may be undefined)
 * @param convMsgs    that conversation's portal_messages rows (any order)
 */
export function deriveClientThreadTag(
    conv: any,
    convMsgs: any[] = [],
): ClientThreadTag {
    // Origin wins: if ANY message in the thread originated a ticket/request,
    // the conversation stays tagged that way forever (matches the previous
    // "origin, not latest message" intent — but from real fields).
    for (const m of convMsgs) {
        if (m?.linkedTicketId) return 'ticket';
        if (m?.linkedRequestId) return 'request';
    }
    // Fallbacks in priority order: explicit fields on the conversation row,
    // then last-message sender.
    const lastBy = conv?.lastMessageBy;
    if (lastBy === 'admin') return 'replied';
    return 'general';
}

/** Visual identity for a tag — ONE place, shared by inbox list + thread header. */
export const CLIENT_THREAD_TAG_STYLES: Record<ClientThreadTag, { badge: string; dot: string; label: string }> = {
    ticket: {
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: 'Ticket',
    },
    request: {
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        dot: 'bg-rose-500',
        label: 'Request',
    },
    replied: {
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        dot: 'bg-blue-500',
        label: 'Replied',
    },
    general: {
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'Portal',
    },
};

// ─── Inbox selection model (collapses the two old unions) ─────────────────
/**
 * ONE selection union for the Messages inbox. Replaces:
 *  - selectedInboxType: 'inbound' | 'portal' | 'conversation' | 'team' | 'system' | null
 *  - ConversationType:  'maintenance' | 'service_request' | 'portal' | 'admin_reply' | 'team'
 *
 * Mapping from the old unions:
 *  - 'team'            → { section: 'team' }
 *  - 'conversation'    → { section: 'client_tenant' }   (portal_conversations rows)
 *  - 'inbound' | 'portal' → { section: 'flat' }          (legacy flat rows, same detail UI)
 *  - 'system'          → { section: 'system' }           (PracticePro founder-reply inbox)
 * ConversationType badges are now CLIENT_THREAD_TAG_STYLES derived via
 * deriveClientThreadTag() — a display tag, not a selection mode.
 */
export type InboxSelection =
    | { section: 'team'; id: string }
    | { section: 'client_tenant'; id: string }
    | { section: 'flat'; id: string }
    | { section: 'system'; id: string };

/** The selectable inbox sections (from the collapsed unions). */
export type InboxSection = InboxSelection['section'];

/** Map a legacy selectedInboxType string (history-entry context, old
 *  deep links) onto the new section taxonomy. Returns null for
 *  unrecognized values. */
export function mapLegacyInboxType(legacy: string | null | undefined): InboxSection | null {
    switch (legacy) {
        case 'team': return 'team';
        case 'conversation': return 'client_tenant';
        case 'inbound':
        case 'portal': return 'flat';
        case 'system': return 'system';
        default: return null;
    }
}
