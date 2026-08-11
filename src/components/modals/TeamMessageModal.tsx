import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { XIcon, SendIcon } from '../../constants';
import { getInitials, getUserColor } from '../../utils/colorUtils';

/**
 * TeamMessageModal — multi-recipient team messaging with Select All.
 *
 * Supports:
 *   - Multi-select recipient list with checkboxes + avatars
 *   - "Select All" / "Deselect All" toggle
 *   - Sends to each recipient individually (creates/reuses direct conversations)
 *   - Progress feedback during multi-send
 */
interface TeamMessageModalProps {
    onClose: () => void;
}

const TeamMessageModal: React.FC<TeamMessageModalProps> = ({ onClose }) => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const { addToast } = useUI();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const sendChatMessage = useMutation(api.myFunctions.sendChatMessage);

    const teamMembers = (coreState.users || []).filter(
        (u: any) => u.id !== currentUser?.id &&
        u.role !== 'Client' &&
        u.role !== 'Tenant' &&
        u.role !== 'ExternalCounsel' &&
        u.role !== 'Pending'
    );

    const allSelected = teamMembers.length > 0 && teamMembers.every((u: any) => selectedIds.includes(u.id));

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(teamMembers.map((u: any) => u.id));
        }
    };

    const toggleRecipient = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const handleSend = async () => {
        if (selectedIds.length === 0) {
            addToast('Please select at least one recipient.', { type: 'error' });
            return;
        }
        if (!message.trim()) {
            addToast('Please enter a message.', { type: 'error' });
            return;
        }
        if (!currentUser?.firmId) {
            addToast('No firm associated with your account.', { type: 'error' });
            return;
        }

        setSending(true);
        const myIdForStorage = currentUser?._id || currentUser?.id || '';
        let successCount = 0;
        let failCount = 0;

        for (const recipientId of selectedIds) {
            try {
                const recipientUser = (coreState.users || []).find((u: any) => u.id === recipientId);
                const recipientIdForStorage = recipientUser?._id || recipientUser?.id || recipientId;

                const existingConv = (coreState.chatConversations || []).find((c: any) =>
                    c.type === 'direct' &&
                    c.memberIds &&
                    (c.memberIds.includes(myIdForStorage) || c.memberIds.includes(currentUser?._id || '')) &&
                    (c.memberIds.includes(recipientIdForStorage) || c.memberIds.includes(recipientUser?._id || ''))
                );

                let conversationId: string;
                let createConversationIfMissing = false;
                let conversationMembers: string[] | undefined;

                if (existingConv) {
                    conversationId = existingConv.id || existingConv._id;
                } else {
                    conversationId = uuidv4();
                    createConversationIfMissing = true;
                    conversationMembers = [myIdForStorage, recipientIdForStorage];
                }

                await sendChatMessage({
                    conversationId,
                    content: message.trim(),
                    authorId: myIdForStorage || undefined,
                    authorName: currentUser?.name || undefined,
                    userEmail: currentUser?.email,
                    createConversationIfMissing,
                    conversationMembers,
                    conversationName: 'Direct Message',
                });
                successCount++;
            } catch (e) {
                console.error('[TeamMessageModal] Send to', recipientId, 'failed:', e);
                failCount++;
            }
        }

        setSending(false);
        if (successCount > 0 && failCount === 0) {
            addToast(`Message sent to ${successCount} recipient${successCount === 1 ? '' : 's'}!`, { type: 'success' });
            onClose();
        } else if (successCount > 0 && failCount > 0) {
            addToast(`Sent to ${successCount}, but ${failCount} failed. Check console for details.`, { type: 'info' });
            onClose();
        } else {
            addToast('Failed to send message. Please try again.', { type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col border border-slate-200 dark:border-zinc-700">
                {/* Accent bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-primary-600 to-primary-600 rounded-t-2xl sm:rounded-t-2xl" />

                {/* Header */}
                <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Team Message</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {selectedIds.length > 0 ? `${selectedIds.length} recipient${selectedIds.length === 1 ? '' : 's'} selected` : 'Select recipients to message'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                        aria-label="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-5 space-y-4">
                    {/* Recipient selector — multi-select with Select All */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300">Recipients</label>
                            {teamMembers.length > 1 && (
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                        </div>
                        <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 divide-y divide-slate-100 dark:divide-zinc-700/50">
                            {teamMembers.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">No team members available</p>
                            ) : teamMembers.map((u: any) => {
                                const isSelected = selectedIds.includes(u.id);
                                return (
                                    <label
                                        key={u.id}
                                        className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-zinc-700/30 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleRecipient(u.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-xs ${getUserColor(u.name)}`}>
                                            {getInitials(u.name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{u.name}</p>
                                            <p className="text-2xs text-slate-400">{u.role}</p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message input */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Message</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            placeholder="Type your message..."
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || selectedIds.length === 0 || !message.trim()}
                        className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <SendIcon className="w-4 h-4" />
                        {sending ? `Sending (${selectedIds.length})...` : `Send to ${selectedIds.length || ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamMessageModal;
