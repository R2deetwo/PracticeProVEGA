/**
 * Chat auto-scroll regression suite — the 2026-09-14 round-2 fixes for the
 * two user reports:
 *   1. "when the user types a message and hits send, it sends but it does
 *      not scroll down to that new message"
 *   2. "when the message is received and the user hits the view link in
 *      the toast notification, it takes us to the conversation but it is
 *      at the top — it should be at the bottom"
 *
 * ROOT CAUSE (found in code, not guessed): the scroll effect keyed on the
 * `sorted` ARRAY IDENTITY. Both thread surfaces recompute messages inline
 * in JSX, so every parent re-render produced a fresh array → the effect
 * re-ran → its cleanup CANCELLED the pending 100ms scroll timeout. The
 * re-render storm after every Convex query update (including the one that
 * delivers your own just-sent message) killed the scroll before it fired.
 *
 * Also pins the isMe dual-id contract: own-message detection must match
 * BOTH the users-table custom `id` AND the Convex `_id` (send call sites
 * pass either), because auto-scroll for own sends depends on isMe.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeChatMessage,
  normalizeClientMessage,
  normalizePortalMessage,
} from '../../src/messaging/model';

const repoRoot = join(__dirname, '..', '..');
const threadSrc = readFileSync(join(repoRoot, 'src', 'components', 'messaging', 'MessageThread.tsx'), 'utf-8');

describe('MessageThread — scroll policy round 2 (source contract)', () => {
  it('keys the new-message effect on the PRIMITIVE last id, not the array identity', () => {
    // The old bug: `}, [sorted, isAtBottom, embedded]);` — fresh array
    // identity every parent re-render cancelled the pending scroll.
    expect(threadSrc).not.toContain('}, [sorted, isAtBottom, embedded]);');
    expect(threadSrc).toContain('}, [lastId, isAtBottom, lastIsMe, embedded]);');
    expect(threadSrc).toContain('const lastId = sorted.length > 0 ? sorted[sorted.length - 1].id : null');
  });

  it('scrolls synchronously in useLayoutEffect — no cancellable setTimeout', () => {
    expect(threadSrc).toContain('useLayoutEffect(() => {');
    // The cancelled-timeout pattern must be gone:
    expect(threadSrc).not.toMatch(/setTimeout\(\(\) => endRef\.current\?\.scrollIntoView/);
  });

  it('own sends and thread opens jump INSTANTLY (no CSS-smooth crawl over long threads)', () => {
    expect(threadSrc).toContain("'instant' as ScrollBehavior");
    // 'auto' defers to the container's scroll-smooth CSS — must not be
    // used for jumps:
    expect(threadSrc).not.toContain("{ behavior: 'auto', block: 'end' }");
  });

  it('thread switch resets the last-seen tracker and jumps to bottom', () => {
    expect(threadSrc).toContain('lastSeenIdRef.current = null;');
    expect(threadSrc).toContain('}, [threadKey]);');
  });

  it('first-sight branch covers async message loads after a deep-link mount', () => {
    // When the toast View deep-link mounts the thread before the query
    // resolves, the thread-switch rAF scrolls an EMPTY list (no-op). The
    // first-sight branch must scroll again when messages actually arrive.
    expect(threadSrc).toContain('const firstSight = lastSeenIdRef.current === null;');
    expect(threadSrc).toMatch(/if \(firstSight \|\| isAtBottom \|\| lastIsMe\)/);
  });
});

describe('isMe — dual-id resolution (own sends must be recognized)', () => {
  const CUSTOM_ID = 'usr-abc-123';
  const CONVEX_ID = 'k57xyz9convexusers123';

  it('normalizeChatMessage: author stored as Convex _id, currentUser has custom id', () => {
    const me = { id: CUSTOM_ID, _id: CONVEX_ID };
    const msg = normalizeChatMessage({ _id: 'm1', authorId: CONVEX_ID, content: 'hi', timestamp: '2026-09-14T10:00:00.000Z' }, me);
    expect(msg.isMe).toBe(true);
  });

  it('normalizeChatMessage: author stored as custom id, currentUser has both', () => {
    const me = { id: CUSTOM_ID, _id: CONVEX_ID };
    const msg = normalizeChatMessage({ _id: 'm2', authorId: CUSTOM_ID, content: 'hi', timestamp: '2026-09-14T10:00:00.000Z' }, me);
    expect(msg.isMe).toBe(true);
  });

  it('normalizeChatMessage: someone else is still someone else', () => {
    const me = { id: CUSTOM_ID, _id: CONVEX_ID };
    const msg = normalizeChatMessage({ _id: 'm3', authorId: 'usr-other-999', content: 'hi', timestamp: '2026-09-14T10:00:00.000Z' }, me);
    expect(msg.isMe).toBe(false);
  });

  it('normalizePortalMessage: admin-side senderId matching either id is isMe', () => {
    const me = { id: CUSTOM_ID, _id: CONVEX_ID };
    for (const senderId of [CUSTOM_ID, CONVEX_ID]) {
      const msg = normalizePortalMessage(
        { _id: 'p1', senderId, senderRole: 'Admin', content: 'reply', createdAt: 1756720800000 },
        me,
      );
      expect(msg.isMe).toBe(true);
    }
    const other = normalizePortalMessage(
      { _id: 'p2', senderId: 'usr-tenant-1', senderRole: 'Tenant', content: 'q', createdAt: 1756720800000 },
      me,
    );
    expect(other.isMe).toBe(false);
  });

  it('normalizeClientMessage: dual-id too', () => {
    const me = { id: CUSTOM_ID, _id: CONVEX_ID };
    expect(normalizeClientMessage({ _id: 'c1', authorId: CONVEX_ID, content: 'x', timestamp: 1756720800000 }, me).isMe).toBe(true);
    expect(normalizeClientMessage({ _id: 'c2', authorId: CUSTOM_ID, content: 'x', timestamp: 1756720800000 }, me).isMe).toBe(true);
    expect(normalizeClientMessage({ _id: 'c3', authorId: 'usr-elsewhere', content: 'x', timestamp: 1756720800000 }, me).isMe).toBe(false);
  });
});
