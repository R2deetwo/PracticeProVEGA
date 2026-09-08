/**
 * Unified messaging model (Path B) — regression tests for the canonical
 * adapters in src/messaging/model.ts.
 *
 * These lock down exactly the divergences the messaging-unification
 * diagnosis found across the 8 backend tables:
 *
 *   1. Timestamps: chatMessages/clientMessages/researchMessages store
 *      STRINGS; aloaMessages/atrium_inbound/portal/scheduled store NUMBERS.
 *      toEpochMs() + every adapter must yield epoch-ms numbers, sortable
 *      together without per-view conversion hacks.
 *   2. Sender identity: authorId vs senderId+Name+Email+Role vs
 *      senderContact vs AI role — every adapter must yield UnifiedSender
 *      and resolve isMe at the boundary.
 *   3. Read status: boolean isRead vs "unread"/"read"/"replied" enum vs
 *      none — every adapter must yield the ReadState union.
 *   4. deriveClientThreadTag — badges come from STORED FIELDS
 *      (linkedTicketId/linkedRequestId/lastMessageBy), replacing the old
 *      preview-prefix sniffing (T:/R:/A:) that mislabelled rows whenever
 *      the last message changed.
 *   5. Inbox selection: the collapsed taxonomy maps every legacy
 *      selectedInboxType string exactly once (no double mapping, no loss).
 */
import { describe, it, expect } from 'vitest';
import {
  toEpochMs,
  sortUnifiedMessages,
  normalizeChatMessage,
  normalizeClientMessage,
  normalizePortalMessage,
  normalizeAloaMessage,
  normalizeResearchMessage,
  normalizeInboundMessage,
  normalizeScheduledMessage,
  deriveClientThreadTag,
  CLIENT_THREAD_TAG_STYLES,
  mapLegacyInboxType,
} from '../../src/messaging/model';

const ISO_A = '2026-09-01T10:00:00.000Z'; // epoch 1756720800000
const EPOCH_A = new Date(ISO_A).getTime();

describe('toEpochMs — the string-vs-number timestamp divergence', () => {
  it('passes epoch-ms numbers through untouched', () => {
    expect(toEpochMs(1756720800000)).toBe(1756720800000);
  });

  it('parses ISO string timestamps (chatMessages/clientMessages/researchMessages)', () => {
    expect(toEpochMs(ISO_A)).toBe(EPOCH_A);
  });

  it('parses numeric strings (defensive: tables that stringify epochs)', () => {
    expect(toEpochMs(String(EPOCH_A))).toBe(EPOCH_A);
  });

  it('handles Date objects', () => {
    expect(toEpochMs(new Date(ISO_A))).toBe(EPOCH_A);
  });

  it('returns 0 — never NaN — for null/undefined/garbage (sorts oldest, never crashes a sort)', () => {
    expect(toEpochMs(undefined)).toBe(0);
    expect(toEpochMs(null)).toBe(0);
    expect(toEpochMs('not a date')).toBe(0);
    expect(toEpochMs(Number.NaN)).toBe(0);
  });
});

describe('sortUnifiedMessages — mixed-source threads sort together', () => {
  it('orders string-timestamped (chat) and number-timestamped (portal) rows chronologically', () => {
    const chatMsg = normalizeChatMessage({ _id: 'c1', authorId: 'u1', content: 'old', timestamp: ISO_A });
    const portalMsg = normalizePortalMessage({ _id: 'p1', senderRole: 'Tenant', content: 'new', createdAt: EPOCH_A + 1000 });
    const sorted = sortUnifiedMessages([portalMsg, chatMsg]);
    expect(sorted.map(m => m.id)).toEqual(['c1', 'p1']);
  });
});

describe('normalizeChatMessage — team threads', () => {
  it('resolves isMe against the current user at the boundary', () => {
    const row = { _id: 'm1', authorId: 'user-9', content: 'hi', timestamp: ISO_A };
    expect(normalizeChatMessage(row, { id: 'user-9' }).isMe).toBe(true);
    expect(normalizeChatMessage(row, { id: 'user-8' }).isMe).toBe(false);
    expect(normalizeChatMessage(row, null).isMe).toBe(false);
  });

  it('carries delivery status and edit/delete state; read stays none (no read tracking in this table)', () => {
    const u = normalizeChatMessage({ _id: 'm2', authorId: 'a', content: 'x', timestamp: ISO_A, status: 'failed', isEdited: true, editedAt: ISO_A, isDeleted: false });
    expect(u.deliveryStatus).toBe('failed');
    expect(u.isEdited).toBe(true);
    expect(u.read).toBe('none');
    expect(u.isDeleted).toBe(false);
  });
});

describe('normalizeClientMessage — legacy per-matter stream', () => {
  it('maps boolean isRead onto the ReadState union', () => {
    expect(normalizeClientMessage({ _id: 'cm1', isRead: true, timestamp: ISO_A }).read).toBe('read');
    expect(normalizeClientMessage({ _id: 'cm2', isRead: false, timestamp: ISO_A }).read).toBe('unread');
  });
});

describe('normalizePortalMessage — the 4-field sender + dual read fields', () => {
  it('flattens senderId/Name/Email/Role into UnifiedSender', () => {
    const u = normalizePortalMessage({ _id: 'pm1', senderId: 's1', senderName: 'Ada', senderEmail: 'ada@x.ng', senderRole: 'Tenant', content: 'leak', createdAt: EPOCH_A });
    expect(u.sender).toMatchObject({ id: 's1', name: 'Ada', contact: 'ada@x.ng', role: 'Tenant' });
  });

  it('read state prefers the replied enum, then isRead/enum-read, else unread', () => {
    expect(normalizePortalMessage({ status: 'replied' }).read).toBe('replied');
    expect(normalizePortalMessage({ status: 'read' }).read).toBe('read');
    expect(normalizePortalMessage({ isRead: true }).read).toBe('read');
    expect(normalizePortalMessage({}).read).toBe('unread');
  });

  it('FIRM perspective (default): admin senders are isMe', () => {
    expect(normalizePortalMessage({ senderRole: 'Admin', createdAt: 1 }).isMe).toBe(true);
    expect(normalizePortalMessage({ senderRole: 'Tenant', createdAt: 1 }).isMe).toBe(false);
  });

  it('PARTICIPANT perspective (portals): the portal user is isMe — identity inverts', () => {
    expect(normalizePortalMessage({ senderRole: 'Tenant', senderId: 'p1' }, { id: 'p1' }, { perspective: 'participant' }).isMe).toBe(true);
    expect(normalizePortalMessage({ senderRole: 'Admin', senderId: 'staff1' }, { id: 'p1' }, { perspective: 'participant' }).isMe).toBe(false);
  });

  it('maps attachments with display names (shared grid contract)', () => {
    const u = normalizePortalMessage({ _id: 'pm2', attachments: ['st1', 'st2'], attachmentNames: ['lease.pdf', 'photo.jpg'], createdAt: 1 });
    expect(u.attachments).toEqual([
      { storageId: 'st1', name: 'lease.pdf' },
      { storageId: 'st2', name: 'photo.jpg' },
    ]);
  });

  it('carries ticket/request wiring and sub-thread grouping', () => {
    const u = normalizePortalMessage({ _id: 'pm3', linkedTicketId: 't9', threadTicketId: 't9', requestTypeLabel: 'Plumbing', createdAt: 1 });
    expect(u.linkedTicketId).toBe('t9');
    expect(u.threadTicketId).toBe('t9');
    expect(u.requestTypeLabel).toBe('Plumbing');
  });
});

describe('normalizeAloaMessage / normalizeResearchMessage — AI threads', () => {
  it('aloa: numeric createdAt → sentAt; role resolves isMe; errors map to failed', () => {
    const user = normalizeAloaMessage({ id: 'a1', role: 'user', createdAt: EPOCH_A });
    const ai = normalizeAloaMessage({ id: 'a2', role: 'model', createdAt: EPOCH_A + 1, isError: true });
    expect(user.isMe).toBe(true);
    expect(user.sentAt).toBe(EPOCH_A);
    expect(ai.isMe).toBe(false);
    expect(ai.deliveryStatus).toBe('failed');
  });

  it('research: string timestamp → sentAt; citations pass through', () => {
    const u = normalizeResearchMessage({ id: 'r1', role: 'model', timestamp: ISO_A, citations: [{ sourceId: 's1' }] });
    expect(u.sentAt).toBe(EPOCH_A);
    expect(u.citations).toEqual([{ sourceId: 's1' }]);
    expect(u.kind).toBe('ai_assistant');
  });
});

describe('normalizeInboundMessage / normalizeScheduledMessage — automated channels', () => {
  it('inbound: receivedAt number; contact-only sender; never isMe', () => {
    const u = normalizeInboundMessage({ _id: 'i1', senderName: 'Tunde', senderContact: '+2348012345678', receivedAt: EPOCH_A, isRead: false });
    expect(u.sentAt).toBe(EPOCH_A);
    expect(u.isMe).toBe(false);
    expect(u.sender.contact).toBe('+2348012345678');
    expect(u.read).toBe('unread');
    expect(u.kind).toBe('client_tenant');
  });

  it('scheduled: status enum maps to delivery statuses; automation sender role', () => {
    expect(normalizeScheduledMessage({ _id: 's1', status: 'sent', scheduledFor: EPOCH_A }).deliveryStatus).toBe('sent');
    expect(normalizeScheduledMessage({ status: 'failed' }).deliveryStatus).toBe('sent_failed');
    expect(normalizeScheduledMessage({ status: 'cancelled' }).deliveryStatus).toBe('cancelled');
    expect(normalizeScheduledMessage({ status: 'scheduled' }).deliveryStatus).toBe('scheduled');
    expect(normalizeScheduledMessage({ isAutomation: true }).sender.role).toBe('automation');
    expect(normalizeScheduledMessage({}).kind).toBe('automated');
  });
});

describe('deriveClientThreadTag — data-derived badges (replaces prefix sniffing)', () => {
  it('ticket origin wins from STORED FIELDS, regardless of last-message preview', () => {
    // The old detectConversationType would call this 'admin_reply' (A: prefix)
    // — the tag now comes from the message set's linkedTicketId.
    const conv = { lastMessagePreview: 'A: we fixed it', lastMessageBy: 'admin' };
    const msgs = [{ linkedTicketId: 't1' }];
    expect(deriveClientThreadTag(conv, msgs)).toBe('ticket');
  });

  it('request origin detected from linkedRequestId', () => {
    expect(deriveClientThreadTag({ lastMessagePreview: 'hello' }, [{ linkedRequestId: 'rq1' }])).toBe('request');
  });

  it('no ticket/request: admin last message → replied, else general', () => {
    expect(deriveClientThreadTag({ lastMessageBy: 'admin' }, [])).toBe('replied');
    expect(deriveClientThreadTag({ lastMessageBy: 'participant' }, [])).toBe('general');
    expect(deriveClientThreadTag({}, [])).toBe('general');
  });

  it('every tag has a visual identity (badge classes + label)', () => {
    for (const tag of ['ticket', 'request', 'replied', 'general'] as const) {
      expect(CLIENT_THREAD_TAG_STYLES[tag].badge).toMatch(/bg-/);
      expect(CLIENT_THREAD_TAG_STYLES[tag].label.length).toBeGreaterThan(0);
    }
  });
});

describe('mapLegacyInboxType — collapsed selection taxonomy', () => {
  it('maps every legacy selectedInboxType string exactly once', () => {
    expect(mapLegacyInboxType('team')).toBe('team');
    expect(mapLegacyInboxType('conversation')).toBe('client_tenant');
    expect(mapLegacyInboxType('inbound')).toBe('flat');
    expect(mapLegacyInboxType('portal')).toBe('flat');
    expect(mapLegacyInboxType('system')).toBe('system');
  });

  it('null/unknown → null (no selection)', () => {
    expect(mapLegacyInboxType(null)).toBeNull();
    expect(mapLegacyInboxType(undefined)).toBeNull();
    expect(mapLegacyInboxType('anything-else')).toBeNull();
  });
});
