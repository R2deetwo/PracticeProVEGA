import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { XIcon, SendIcon } from '../../constants';

/**
 * TeamMessageModal — dedicated, simple modal for sending in-app messages
 * to team members. Clear and separate from the ComposeModal (which handles
 * external channels like WhatsApp/Email/Portal).
 *
 * Uses the server-side `sendChatMessage` mutation which atomically creates
 * the chat message AND notifications for the recipient in a single Convex
 * transaction. This is the reliable path — if the message is saved, the
 * notification is guaranteed to be saved too.
 *
 * Note: This is NOT a webhook. Webhooks are for cross-system events
 * (e.g. Paystack → PracticePro). Internal chat notifications are a
 * server-side mutation called directly by the sender's client.
 */
interface TeamMessageModalProps {
    onClose: () => void;
}

const TeamMessageModal: React.FC<TeamMessageModalProps> = ({ onClose }) => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const { addToast } = useUI();
    const [recipientId, setRecipientId] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    // Server-side mutation: atomically creates chat message + notification.
    const sendChatMessage = useMutation(api.myFunctions.sendChatMessage);

    // Get team members (exclude self, clients, tenants, external counsel)
    const teamMembers = (coreState.users || []).filter(
        (u: any) => u.id !== currentUser?.id &&
        u.role !== 'Client' &&
        u.role !== 'Tenant' &&
        u.role !== 'ExternalCounsel' &&
        u.role !== 'Pending'
    );

    const handleSend = async () => {
        if (!recipientId) {
            addToast('Please select a recipient.', { type: 'error' });
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
        try {
            const now = new Date().toISOString();

            // Resolve the recipient user (to get their _id for the conversation membership)
            const recipientUser = (coreState.users || []).find((u: any) => u.id === recipientId);
            const recipientIdForStorage = recipientUser?._id || recipientUser?.id || recipientId;
            const myIdForStorage = currentUser?._id || currentUser?.id || '';

            // Check if a direct conversation already exists between these two users.
            // We check both id and _id formats since different parts of the app use different ones.
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
                // Reuse existing conversation — server will look it up by id.
                conversationId = existingConv.id || existingConv._id;
            } else {
                // Tell the server to create a new conversation inline.
                conversationId = uuidv4();
                createConversationIfMissing = true;
                conversationMembers = [myIdForStorage, recipientIdForStorage];
            }

            // Single server-side call — atomically creates the message + notification(s).
            // If this succeeds, the recipient is GUARANTEED to get a notification.
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

            void now; // (kept for potential future use — e.g. local optimistic timestamp)
            addToast('Message sent!', { type: 'success' });
            onClose();
        } catch (e: any) {
            console.error('[TeamMessageModal] Send failed:', e);
            addToast(e?.message || 'Failed to send message. Please try again.', { type: 'error' });
        } finally {
            setSending(false);
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
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Send a direct message to a team member</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
                        aria-label="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-5 space-y-4">
                    {/* Recipient selector */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">To</label>
                        <select
                            value={recipientId}
                            onChange={e => setRecipientId(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                        >
                            <option value="">Select a team member...</option>
                            {teamMembers.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.role})
                                </option>
                            ))}
                        </select>
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
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !recipientId || !message.trim()}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <SendIcon className="w-4 h-4" />
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeamMessageModal;
