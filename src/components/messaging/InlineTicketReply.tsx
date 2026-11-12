/**
 * InlineTicketReply — the ONE ticket-reply composer (UX-33).
 *
 * Lives directly under a ticket's thread so a guard can reply where they
 * triage, instead of the old split (triage in Financials → Maintenance,
 * replies only in Messages). Used by both hosts:
 *   - MessagesView (under a ticket thread in the unified inbox)
 *   - MaintenanceQueue (inline on each triage row)
 *
 * ROUND A (C3): the reply carries the staff bearer (server-side
 * admin-identity binding on sendAdminReply).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SendIcon } from '../../constants';
import { AutoExpandingChatInput } from '../ui/AutoExpandingChatInput';

export interface InlineTicketReplyProps {
    ticketId: string;
    conversationId: string;
    firmId: string;
    adminId: string;
    adminName: string;
    onSent: () => void;
    onCancel: () => void;
    sendAdminReply: any;
    addToast: (msg: string, opts?: any) => void;
}

export const InlineTicketReply: React.FC<InlineTicketReplyProps> = ({
    ticketId, conversationId, firmId, adminId, adminName, onSent, onCancel, sendAdminReply, addToast,
}) => {
    const { bearerToken } = useAuth();
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus on mount so the admin can type immediately
    useEffect(() => {
        textareaRef.current?.focus();
        // Scroll into view so the composer isn't hidden behind the keyboard on mobile
        setTimeout(() => {
            textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }, []);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            await sendAdminReply({
                conversationId,
                firmId,
                adminId,
                adminName,
                content: text.trim(),
                threadTicketId: ticketId,
                sessionToken: bearerToken ?? undefined,
            });
            addToast('Reply sent to portal user.', { type: 'success' });
            setText('');
            onSent();
        } catch (err: any) {
            addToast(err.message || 'Failed to send reply.', { type: 'error' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-primary-400/50 w-full box-border min-w-0">
            <div className="bg-slate-50 dark:bg-zinc-800/80 rounded-lg border border-slate-200 dark:border-zinc-700 p-2.5 w-full box-border">
                <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="text-2xs font-bold text-slate-500 dark:text-zinc-400">
                        Replying to this ticket thread
                    </span>
                </div>
                <AutoExpandingChatInput
                    value={text}
                    onChange={setText}
                    onSend={handleSend}
                    placeholder="Type your reply to the resident/client..."
                    sendDisabled={!text.trim() || sending}
                    sendIcon={sending ? undefined : <SendIcon />}
                    sendAriaLabel={sending ? 'Sending reply' : 'Send reply'}
                    hint="Shift+Enter to send"
                    containerClassName="w-full"
                    textareaClassName="text-base bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700"
                />
                <div className="flex items-center justify-between mt-2">
                    <span className="text-2xs text-slate-400">
                        Shift+Enter to send
                    </span>
                    <div className="flex gap-1.5">
                        <button
                            onClick={onCancel}
                            disabled={sending}
                            className="px-2.5 py-1 text-2xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InlineTicketReply;
