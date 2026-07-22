import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { XIcon, SendIcon } from '../../constants';

/**
 * TeamMessageModal — dedicated, simple modal for sending in-app messages
 * to team members. Clear and separate from the ComposeModal (which handles
 * external channels like WhatsApp/Email/Portal).
 *
 * Creates a chatConversations direct message + chatMessages entry.
 * Sends a notification to the recipient.
 */
interface TeamMessageModalProps {
    onClose: () => void;
}

const TeamMessageModal: React.FC<TeamMessageModalProps> = ({ onClose }) => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const actions = useDataActions();
    const { addToast } = useUI();
    const [recipientId, setRecipientId] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

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
            const cid = uuidv4();
            const now = new Date().toISOString();

            // Create the conversation
            await actions.addItem('chatConversations', {
                id: cid,
                type: 'direct',
                memberIds: [currentUser?.id || '', recipientId],
                name: 'Direct Message',
                matterId: null,
                createdAt: now,
                hiddenForUserIds: [],
                firmId: currentUser.firmId,
            }, 'Conversation');

            // Save the message
            await actions.addItem('chatMessages', {
                conversationId: cid,
                content: message.trim(),
                authorId: currentUser?.id || '',
                timestamp: now,
                firmId: currentUser.firmId,
                isDeleted: false,
                status: 'sent',
            }, 'Chat Message');

            // Send notification to recipient
            await actions.addItem('notifications', {
                userId: recipientId,
                title: 'New Message',
                message: `${currentUser?.name || 'A colleague'} sent you a message.`,
                type: 'message',
                isRead: false,
                createdAt: now,
                link: { view: 'messaging', id: cid, context: { activeConversationId: cid } },
                firmId: currentUser.firmId,
            }, 'Notification');

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
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Accent bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-2xl sm:rounded-t-2xl" />

                {/* Header */}
                <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">New Team Message</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Send a direct message to a team member</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        aria-label="Close"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-6 py-5 space-y-4">
                    {/* Recipient selector */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">To</label>
                        <select
                            value={recipientId}
                            onChange={e => setRecipientId(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg shadow-sm p-3 text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all"
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
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            placeholder="Type your message..."
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg shadow-sm p-3 text-slate-900 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !recipientId || !message.trim()}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
