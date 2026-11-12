import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';
import { useProduct } from '../contexts/ProductContext';

/**
 * useMessagesBadge — the ONE Messages badge selector (UX-43).
 *
 * Before this hook the desktop Sidebar and the mobile BottomNav computed
 * the badge independently and diverged: the Sidebar counted chat
 * notifications + unread inbound resident messages + unread admin-side
 * portal conversation messages (three live Convex-backed sources), while
 * BottomNav counted only coreState.notifications. The two badges could
 * never be reconciled — clearing one surface left the other lit.
 *
 * Both surfaces now render this selector, so the badge is the same number
 * everywhere and drops live as threads are opened (R27 messages read
 * model: markConversationReadByAdmin / inbound isRead flags).
 *
 * Demo sessions (DEV demo mode) have no verified bearer — the server-authed
 * inbox and portal queries would throw Unauthenticated, so they are skipped
 * (badge = chat notifications only).
 */
export function useMessagesBadge(): number {
    const { currentUser, bearerToken } = useAuth();
    const { coreState } = useCoreState();
    const { hasPropertyFeatures } = useProduct();

    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const queryable = Boolean(firmId) && !isDemo;

    // Unread inbound resident messages (property-capable firms).
    const inboundMessages = useQuery(
        api.sentry.getInboundMessages,
        queryable ? { firmId, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
    ) || [];
    const inboundUnread = (inboundMessages as any[]).filter((m: any) => !m.isRead).length;

    // R27: the badge must count what the admin can actually OPEN —
    // conversation threads with unread admin-side messages (unreadByAdmin),
    // not legacy flat rows that never render as list rows. Conversations
    // drop one thread at a time as each is opened.
    const portalConvs = useQuery(
        api.portals.getPortalConversationsByFirm,
        queryable ? { firmId, sessionToken: bearerToken ?? undefined } : 'skip'
    ) || [];
    const portalUnread = (portalConvs as any[]).reduce((sum: number, c: any) => sum + (c.unreadByAdmin || 0), 0);

    const chatNotificationCount = (coreState.notifications || []).filter(
        n => n.userId === currentUser?.id && !n.isRead && n.link?.view === 'messaging'
    ).length;

    // hasPropertyFeatures (not isProperty) so Komplete/unified firms also
    // see unread resident/portal messages — same rule the Sidebar applied.
    return chatNotificationCount + (hasPropertyFeatures ? inboundUnread + portalUnread : 0);
}
