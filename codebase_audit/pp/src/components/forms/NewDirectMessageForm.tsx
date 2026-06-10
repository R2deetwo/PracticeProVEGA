
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { UserCircleIcon, ChatAltIcon, PlusIcon, ShieldCheckIcon } from '../../constants';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { useCoreState } from '../../contexts/CoreContext';

interface NewDirectMessageFormProps {
    users: User[];
    onClose: () => void;
    initialContext?: { recipientId?: string };
}

type ChatMode = 'direct' | 'group';

const NewDirectMessageForm: React.FC<NewDirectMessageFormProps> = ({ users, onClose, initialContext }) => {
    const { currentUser } = useAuth();
    const { matterState } = useMatterState();
    const { coreState } = useCoreState();
    const { handleCreateDirectMessage, handleCreateChannel, handleSendMessage } = useDataActions();
    const { navigateTo, addToast } = useUI();

    const [mode, setMode] = useState<ChatMode>('direct');

    // Direct Message State
    const [recipientId, setRecipientId] = useState<string>('');
    const [existingChatId, setExistingChatId] = useState<string | null>(null);

    // Group Chat State
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [linkedMatterId, setLinkedMatterId] = useState<string>('');

    const [message, setMessage] = useState('');

    // Filter available users (excluding self and external/clients)
    const availableUsers = useMemo(() =>
        users.filter(u => u.id !== currentUser?.id && u.role !== 'Client' && u.role !== 'External Counsel'),
        [users, currentUser]);

    // Initialize defaults
    useEffect(() => {
        if (initialContext?.recipientId) {
            setRecipientId(initialContext.recipientId);
        } else if (availableUsers.length > 0 && !recipientId) {
            setRecipientId(availableUsers[0].id);
        }
    }, [initialContext, availableUsers, recipientId]);

    // Check for existing DM
    useEffect(() => {
        if (mode === 'direct' && recipientId && currentUser) {
            const existing = coreState.chatConversations.find((c: any) =>
                c.type === 'direct' &&
                c.memberIds.length === 2 &&
                c.memberIds.includes(recipientId) &&
                c.memberIds.includes(currentUser.id) &&
                !c.matterId // Pure DMs usually don't have matter IDs, unless specifically linked
            );
            setExistingChatId(existing ? existing.id : null);
        } else {
            setExistingChatId(null);
        }
    }, [recipientId, mode, currentUser, coreState.chatConversations]);

    const handleToggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) newSet.delete(userId);
            else newSet.add(userId);
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentUser) return;

        let targetConversationId: string;
        let membersToNotify: string[] = [];

        if (mode === 'direct') {
            if (!recipientId) {
                addToast('Please select a colleague.', { type: 'info' });
                return;
            }
            membersToNotify = [currentUser.id, recipientId];
            // 1. Create Conversation or Get Existing ID
            targetConversationId = await handleCreateDirectMessage(recipientId, undefined, currentUser.id, undefined, false);
        } else {
            // Group Chat
            if (selectedUsers.size === 0) {
                addToast('Please select at least one member.', { type: 'info' });
                return;
            }
            if (!groupName.trim()) {
                addToast('Please provide a group name.', { type: 'info' });
                return;
            }

            const members = Array.from(selectedUsers);
            if (!members.includes(currentUser.id)) members.push(currentUser.id);
            membersToNotify = members;

            // 1. Create Channel
            targetConversationId = await handleCreateChannel(
                groupName.trim(),
                members,
                currentUser.id,
                linkedMatterId || undefined
            );
        }

        // 2. If there is a message, send it immediately to that ID
        if (message.trim()) {
            handleSendMessage(targetConversationId, message.trim(), currentUser.id, membersToNotify);
        }

        // 3. Navigate
        onClose();
        setTimeout(() => {
            navigateTo('messaging', null, { activeConversationId: targetConversationId });
        }, 50);
    };

    const handleOpenExisting = () => {
        if (existingChatId) {
            navigateTo('messaging', null, { activeConversationId: existingChatId });
            onClose();
        }
    };

    const commonInputClass = "text-gray-900 dark:text-gray-300 w-full bg-gray-50 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm p-2 focus:ring-primary-500 focus:border-primary-500";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">

            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                <button
                    type="button"
                    onClick={() => setMode('direct')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'direct'
                        ? 'bg-white dark:bg-zinc-700 shadow text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                        }`}
                >
                    <UserCircleIcon className="w-4 h-4" />
                    Direct Message
                </button>
                <button
                    type="button"
                    onClick={() => setMode('group')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'group'
                        ? 'bg-white dark:bg-zinc-700 shadow text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                        }`}
                >
                    <ChatAltIcon className="w-4 h-4" />
                    Group / Channel
                </button>
            </div>

            {mode === 'direct' && (
                <div className="space-y-3 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To:</label>
                        <select
                            value={recipientId}
                            onChange={e => setRecipientId(e.target.value)}
                            className={commonInputClass}
                            required
                        >
                            {availableUsers.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>

                    {existingChatId && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                            <span className="text-sm text-blue-800 dark:text-blue-200">You already have a chat with this person.</span>
                            <button
                                type="button"
                                onClick={handleOpenExisting}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors"
                            >
                                Open Chat
                            </button>
                        </div>
                    )}

                    {!existingChatId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                            <textarea
                                rows={3}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className={commonInputClass}
                                placeholder="Type your message..."
                                autoFocus
                            ></textarea>
                        </div>
                    )}
                </div>
            )}

            {mode === 'group' && (
                <div className="space-y-3 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">#</span>
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                className={`${commonInputClass} pl-7`}
                                placeholder="case-discussion"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Members</label>
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded-md p-2 space-y-1 custom-scrollbar">
                            {availableUsers.map(user => (
                                <label key={user.id} className="flex items-center space-x-3 cursor-pointer p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700/50">
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="checkbox"
                                        checked={selectedUsers.has(user.id)}
                                        onChange={() => handleToggleUser(user.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <div className={`h-6 w-6 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] ${getUserColor(user.id)}`}>
                                        {getInitials(user.name)}
                                    </div>
                                    <span className="text-sm text-slate-700 dark:text-slate-200">{user.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Link to Matter (Optional)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <ShieldCheckIcon className="w-4 h-4 text-gray-400" />
                            </div>
                            <select
                                value={linkedMatterId}
                                onChange={e => setLinkedMatterId(e.target.value)}
                                className={`${commonInputClass} pl-8`}
                            >
                                <option value="">-- No Linked Matter --</option>
                                {matterState.matters.filter(m => m.status === 'Active').map(m => (
                                    <option key={m.id} value={m.id}>{m.title}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Linking a matter helps organize conversations.</p>
                    </div>
                </div>
            )}

            <div className="pt-4 flex justify-end items-center space-x-2 border-t border-slate-100 dark:border-zinc-800">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors">Cancel</button>
                {(mode === 'group' || !existingChatId) && (
                    <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2">
                        {mode === 'direct' ? 'Start Chat' : 'Create Group'}
                    </button>
                )}
            </div>
        </form>
    );
};

export default NewDirectMessageForm;
