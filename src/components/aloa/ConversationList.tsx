/**
 * ConversationList — shows the user's ALOA conversation history.
 *
 * CRITICAL FIX: Previously used imperative `convex.query()` + `setInterval(5000)`
 * (polling). This meant:
 *   1. New conversations didn't appear in the list until up to 5s after creation
 *   2. When the sidebar unmounted (user clicked "New Search"), polling stopped
 *      entirely — so reopening the sidebar showed a stale/empty list
 *   3. The user concluded previous conversations were "lost" even though they
 *      were safely stored in Convex
 *
 * Now uses Convex's reactive `useQuery` hook, which subscribes to the
 * `aloaConversations` table. The instant a conversation is created or
 * updated, Convex pushes the new list to the client — no polling, no
 * remount delay, no silent staleness.
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { api } from '../../../convex/_generated/api';
import { MessagingIcon as MessageSquareIcon, TrashIcon } from '../../constants';

interface ConversationListProps {
    activeId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({ activeId, onSelect, onDelete }) => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();

    // Reactive query — automatically re-runs whenever the underlying
    // `aloaConversations` table changes in Convex. No polling needed.
    // Pass 'skip' when we don't have the required args yet so the hook
    // doesn't fire with empty strings.
    const conversations = useQuery(
        api.myFunctions.getAloaConversations,
        currentUser?.id && coreState.firmDetails?.id
            ? { userId: currentUser.id, firmId: coreState.firmDetails.id }
            : 'skip'
    );

    // Loading state — only show briefly on first load
    if (conversations === undefined) {
        return <div className="p-4 text-center text-xs text-slate-400 italic">Loading history…</div>;
    }

    if (conversations.length === 0) {
        return <div className="p-4 text-center text-xs text-slate-400 italic">No history yet</div>;
    }

    return (
        <>
            {conversations.map(conv => (
                <div
                    key={conv._id}
                    className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeId === conv._id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}
                    onClick={() => onSelect(conv._id)}
                >
                    <MessageSquareIcon className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{conv.title}</div>
                        <div className="text-[10px] opacity-50">{new Date(conv.updatedAt).toLocaleDateString('en-GB')}</div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(conv._id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </>
    );
};
