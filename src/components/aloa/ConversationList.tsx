
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useConvex } from 'convex/react';
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
    const convex = useConvex();
    const [conversations, setConversations] = useState<any[]>([]);

    useEffect(() => {
        if (!currentUser?.id || !coreState.firmDetails?.id) return;

        const load = async () => {
            try {
                const list = await convex.query(api.myFunctions.getAloaConversations, {
                    userId: currentUser.id,
                    firmId: coreState.firmDetails.id
                });
                setConversations(list);
            } catch (e) {
                console.error("Failed to load ARIA conversations:", e);
            }
        };
        load();

        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [currentUser?.id, coreState.firmDetails?.id, convex]);

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
