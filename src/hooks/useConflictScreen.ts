import { useCallback, useRef, useState } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import type { ConflictMatchView } from '../components/modals/ConflictReviewDialog';

/**
 * useConflictScreen — V3 (V-MATTER-6): the pre-creation conflict-of-interest
 * screen shared by MatterForm and SmartMatterModal.
 *
 * Flow:
 *   1. run({ clientName, opposingParties, counsel, clientEmail }) calls the
 *      server screen (normalised matching over clients, contacts and
 *      matters — parties, opposing counsel, adverse parties, clients).
 *   2. No matches → the check is recorded as 'clear' and done() fires —
 *      creation continues as before, zero friction.
 *   3. Matches → `pending` state renders the ConflictReviewDialog; a human
 *      records the reviewed disposition (false positive / confirmed
 *      conflict) and done() fires with proceed=true/false.
 *
 * Nothing is ever auto-declared: the screen only surfaces candidates.
 */
export const useConflictScreen = () => {
    const convex = useConvex();
    const { currentUser, bearerToken } = useAuth();
    const [pending, setPending] = useState<null | {
        matches: ConflictMatchView[];
        clientName?: string;
        opposingParties: string[];
        counsel: string[];
    }>(null);
    const resolveRef = useRef<((result: { proceed: boolean }) => void) | null>(null);
    const recordCheck = useMutation(api.conflictCheck.recordConflictCheck);

    const authArgs = {
        userEmail: currentUser?.email,
        sessionToken: (bearerToken ?? undefined),
    };

    const run = useCallback(async (input: {
        clientName?: string;
        clientEmail?: string;
        opposingParties?: string[];
        counsel?: string[];
        onDone: (result: { proceed: boolean }) => void;
    }) => {
        const opposing = (input.opposingParties || []).map(s => String(s || '').trim()).filter(Boolean);
        const counsel = (input.counsel || []).map(s => String(s || '').trim()).filter(Boolean);
        try {
            const screen: any = await convex.query(api.conflictCheck.screenForConflicts, {
                ...authArgs,
                clientName: input.clientName || '',
                clientEmail: input.clientEmail || '',
                opposingParties: opposing,
                counsel,
            });
            const matches: ConflictMatchView[] = Array.isArray(screen?.matches) ? screen.matches : [];
            if (matches.length === 0) {
                // Nothing to review — record the clear check (fire-and-forget
                // audit row) and let creation proceed.
                recordCheck({
                    ...authArgs,
                    clientName: input.clientName || '',
                    opposingParties: opposing,
                    counsel,
                    matches: [],
                    outcome: 'clear',
                }).catch(() => { /* the audit row must never block creation */ });
                input.onDone({ proceed: true });
                return;
            }
            // Potential matches — a human must review before creation.
            setPending({
                matches,
                clientName: input.clientName,
                opposingParties: opposing,
                counsel,
            });
            resolveRef.current = input.onDone;
        } catch (e: any) {
            // Fail-open with a loud log: the screen is a workflow aid, not a
            // gate that may block matter creation on its own outage.
            console.warn('[useConflictScreen] screen failed (proceeding without):', e?.message);
            input.onDone({ proceed: true });
        }
    }, [convex, authArgs, recordCheck]);

    const resolve = useCallback((decision: { proceed: boolean }) => {
        setPending(null);
        const cb = resolveRef.current;
        resolveRef.current = null;
        if (typeof cb === 'function') cb(decision);
    }, []);

    return { pending, run, resolve };
};
