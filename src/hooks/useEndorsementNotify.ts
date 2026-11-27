/**
 * ROUND 23 — endorsement notifications (owner spec §4: "whenever a new
 * endorsement is created or an existing endorsement is edited on a matter,
 * send an in-app notification / message (and push notification where enabled)
 * to users attached to that matter").
 *
 * Fire-and-forget and best-effort BY DESIGN: the endorsement itself is saved
 * through the caller's own write path (updateItem/createItem surfaces any
 * real failure there); this only tells the matter's attached users. A failure
 * here is swallowed silently — never a toast, never a blocked or alarming
 * save (demo mode rejects all writes by design, and a notification failure
 * must never read as a failed endorsement).
 */
import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

export type EndorsementNotifyAction = 'created' | 'edited';

export interface EndorsementNotifyArgs {
    matterId: string;
    noteId?: string;
    action: EndorsementNotifyAction;
    /** The endorsement BODY (never the jacket boilerplate), for the preview. */
    snippet?: string;
}

export function useEndorsementNotify() {
    const { currentUser, bearerToken } = useAuth();
    const notifyMutation = useMutation(api.myFunctions.notifyMatterEndorsement);

    return useCallback(
        (args: EndorsementNotifyArgs) => {
            if (!args.matterId) return;
            void notifyMutation({
                sessionToken: bearerToken ?? undefined,
                matterId: args.matterId,
                noteId: args.noteId,
                action: args.action,
                actorName: currentUser?.name || 'A colleague',
                snippet: args.snippet,
            }).catch(() => {
                /* best-effort by design — see the header */
            });
        },
        [notifyMutation, bearerToken, currentUser?.name],
    );
}
