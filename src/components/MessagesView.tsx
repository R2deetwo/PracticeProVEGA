
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatConversation, ChatMessage, User, ModalType, View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useMatterState } from '../contexts/MatterContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { PaperClipIcon, SendIcon, TrashIcon, DocumentIcon, ChevronRightIcon, ClockIcon, CheckIcon, DownloadIcon, PlusIcon, BellIcon, SparklesIcon } from '../constants';
import { getUserColor, getInitials, timeAgo } from '../utils/colorUtils';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { parseAloaMarkdown } from '../utils/markdownUtils';
import { useProduct } from '../contexts/ProductContext';
import { ComposeModal, ComposeModalPrefill } from './atrium/ComposeModal';
import TeamMessageModal from './modals/TeamMessageModal';
import { AtriumInbox } from './atrium/AtriumInbox';
import { NoticeBoardTab, ScheduledTab } from './messaging';
import { ListItemSkeleton } from './toolkit/DataSkeleton';
import { useConfirm } from './ui/ConfirmDialog';
import { AutoExpandingChatInput } from './toolkit/AutoExpandingChatInput';
import { ChatMessageBubble } from './toolkit/ChatMessageBubble';

// --- Icons (If not in constants) ---
const DotsVerticalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
);

const ExclamationIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const PdfIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

// ── Tab type for the unified messaging hub ──────────────────────────────
// 'inbox'         = Conversations (live 2-way portal chat with clients/residents)
// 'team'          = Team Chat (internal firm conversations)
// 'notices'       = Notice Board (property only)
// 'scheduled'     = Scheduled messages (queued for future send)
// 'communications' = WhatsApp & Email (AtriumInbox — external-channel comms:
//                    WhatsApp reminders, email demands, inbound replies, audit trail)
//                    Only shown for property/unified firms.
type MessagingTab = 'inbox' | 'team' | 'notices' | 'scheduled' | 'communications';

// ── Channel label helpers (shared with AtriumInbox) ────────────────────
const CHANNEL_COLORS: Record<string, string> = {
    whatsapp: 'text-green-500 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    email: 'text-blue-500 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    portal: 'text-emerald-500 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
    sms: 'text-purple-500 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
};

const CHANNEL_LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    sms: 'SMS',
    portal: 'Portal',
};

// ── Conversation type detection ───────────────────────────────────────────
// Inspects a conversation's lastMessagePreview (or any message preview) to
// determine what KIND of conversation this is. Used for color-coded badges
// in the inbox list so practitioners can scan and prioritise at a glance.
//
// The prefix emojis are set by the backend when a ticket/request is created:
//   🔧 = maintenance ticket (Atrium resident portal)
//   📋 = service request (Vega client portal)
//   ✅ = admin resolution/update reply
// Falls back to "portal" (regular 2-way chat) for everything else.
// 'team' = internal direct message between team members (not a portal convo)
type ConversationType = 'maintenance' | 'service_request' | 'portal' | 'admin_reply' | 'team';

const CONVERSATION_TYPE_STYLES: Record<ConversationType, { badge: string; dot: string; label: string }> = {
    maintenance: {
        // Amber — matches the maintenance ticket theme used in the portal
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: 'Ticket',
    },
    service_request: {
        // Red — high-priority signal that a client needs something
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
        dot: 'bg-rose-500',
        label: 'Request',
    },
    admin_reply: {
        // Blue — admin's outgoing reply
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        dot: 'bg-blue-500',
        label: 'Replied',
    },
    portal: {
        // Emerald — default portal message
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'Portal',
    },
    team: {
        // Indigo — internal team direct message
        badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        dot: 'bg-indigo-500',
        label: 'Team',
    },
};

function detectConversationType(conv: any): ConversationType {
    const preview: string = conv?.lastMessagePreview || '';
    // A conversation's type is determined by its ORIGIN, not just the
    // latest message. If the conversation EVER had a ticket or request
    // (detected by the preview prefix at any point), it stays that type
    // even after the admin replies. The admin reply prefix (✅) indicates
    // the latest message is from admin, but the conversation's nature
    // doesn't change.
    //
    // Priority: ticket/request origin > admin reply > plain portal
    if (preview.startsWith('🔧')) return 'maintenance';
    if (preview.startsWith('📋')) return 'service_request';
    // ✅ prefix means admin replied — but we need to check if this
    // conversation ORIGINATED as a ticket/request. We can't know that
    // from just the preview, so we treat ✅ as 'admin_reply' ONLY if
    // it's not a known ticket/request conversation. In practice, the
    // admin reply message includes the ticket type in its content, so
    // we also check for ticket/request keywords in the preview.
    if (preview.startsWith('✅')) {
        // Check if the reply mentions a ticket/request context
        const lowerPreview = preview.toLowerCase();
        if (lowerPreview.includes('maintenance') || lowerPreview.includes('ticket')) return 'maintenance';
        if (lowerPreview.includes('service request') || lowerPreview.includes('request')) return 'service_request';
        return 'admin_reply';
    }
    // 🚫 prefix = cancelled ticket
    if (preview.startsWith('🚫')) {
        const lowerPreview = preview.toLowerCase();
        if (lowerPreview.includes('ticket')) return 'maintenance';
        return 'service_request';
    }
    return 'portal';
}

// Determine the role label to show next to a conversation — helps the
// practitioner tell at a glance whether they're talking to a resident or
// a client. Particularly important for unified (Komplete) firms that
// serve both audiences from one inbox.
function getRoleLabel(conv: any): string {
    const role: string = conv?.participantRole || '';
    if (role === 'Client') return 'Client';
    if (role === 'Tenant') return 'Resident';
    return 'Portal User';
}

// ══════════════════════════════════════════════════════════════════════════
// ChatWindow — Internal team chat conversation view (unchanged core logic)
// ══════════════════════════════════════════════════════════════════════════
const ChatWindow: React.FC<{
    conversation: ChatConversation;
    messages: ChatMessage[];
    currentUser: User;
    users: User[];
    onSend: (text: string) => void;
    onBack: () => void;
    onDeleteMessage: (id: string, forEveryone: boolean, userId: string) => void | Promise<void>;
    onDeleteChat: (id: string, forEveryone: boolean, userId: string) => void | Promise<void>;
    onRetry: (id: string) => void;
}> = ({ conversation, messages, currentUser, users, onSend, onBack, onDeleteMessage, onDeleteChat, onRetry }) => {
    const [newMessage, setNewMessage] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const teamMessagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { addToast, openModal, closeModal } = useUI();
    const { matterState } = useMatterState();
    const { coreState, isDataLoaded } = useCoreState();
    const [isAtBottom, setIsAtBottom] = useState(true);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(isBottom);
        }
    };

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        const isMyMessage = lastMessage?.authorId === currentUser.id;
        if (isAtBottom || isMyMessage) {
            const timer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            return () => clearTimeout(timer);
        }
    }, [messages, currentUser.id, isAtBottom]);

    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
            return () => clearTimeout(timer);
        }
    }, [conversation.id]);

    const handleTaskClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const taskEl = target.closest('.aloa-interactive-task');
        if (taskEl) {
            const taskTitle = taskEl.getAttribute('data-task-title');
            if (taskTitle) openModal('newTask', undefined, { defaultTitle: taskTitle });
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSend = () => {
        if (!newMessage.trim()) return;
        onSend(newMessage.trim());
        setNewMessage('');
        if (inputRef.current) inputRef.current.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const otherMember = conversation.type === 'direct'
        ? users.find(u => u.id === conversation.memberIds?.find(id => id !== currentUser.id))
        : null;

    const displayName = conversation.type === 'channel'
        ? `#${conversation.name}`
        : otherMember?.name || 'Unknown';

    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className="flex-shrink-0 h-16 px-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between bg-white dark:bg-zinc-800 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full">
                        <ChevronRightIcon className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="flex items-center gap-3">
                        {conversation.type === 'channel' ? (
                            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300">
                                <span className="font-bold text-lg">#</span>
                            </div>
                        ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getUserColor(displayName)}`}>
                                {getInitials(displayName)}
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">{displayName}</h3>
                            {conversation.type === 'channel' && (
                                <p className="text-xs text-slate-500 dark:text-zinc-400">{conversation.memberIds?.length || 0} members</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg">
                        <DotsVerticalIcon />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1">
                            <button onClick={() => { onDeleteChat(conversation.id, false, currentUser.id); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                                Delete Conversation
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollContainerRef} onScroll={handleScroll} onClick={handleTaskClick} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar scroll-smooth bg-slate-50 dark:bg-zinc-900">
                <div className="max-w-3xl mx-auto w-full pb-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <p className="text-sm text-slate-400 dark:text-zinc-500">No messages yet. Start the conversation!</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => {
                        const isMe = msg.authorId === currentUser.id;
                        const author = users.find(u => u.id === msg.authorId);
                        const showAvatar = idx === 0 || messages[idx - 1]?.authorId !== msg.authorId;
                        const isFailed = (msg as any).status === 'failed';

                        if (msg.isDeleted) {
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} my-1`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                                        isMe
                                            ? 'bg-primary-600/20 text-primary-300/60 dark:text-primary-400/40 rounded-tr-none italic'
                                            : 'bg-white dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 border border-slate-200/50 dark:border-zinc-700/50 rounded-tl-none italic'
                                    }`}>
                                        <p className="text-xs">This message was deleted</p>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                                {!isMe && showAvatar && (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mr-2.5 mt-0.5 ${getUserColor(author?.name || 'U')}`}>
                                        {getInitials(author?.name || 'U')}
                                    </div>
                                )}
                                {!isMe && !showAvatar && <div className="w-8 mr-2.5 flex-shrink-0" />}
                                <div className="flex flex-col max-w-[85%] relative">
                                    {/* Sender label + timestamp — shown for both sides */}
                                    <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500">
                                            {isMe ? 'You' : (author?.name || 'Unknown')}
                                        </span>
                                        <span className="text-2xs text-slate-300 dark:text-zinc-600">
                                            {msg.timestamp ? timeAgo(msg.timestamp) : ''}
                                        </span>
                                    </div>
                                    {/* Bubble */}
                                    <div className={`group relative rounded-2xl px-4 py-2.5 shadow-sm ${
                                        isMe
                                            ? 'bg-primary-600 text-white rounded-tr-none'
                                            : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-tl-none'
                                    } ${isFailed ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}>
                                        {msg.content?.startsWith('[FILE:') ? (
                                            <div className="flex items-center gap-2">
                                                <DocumentIcon className="w-4 h-4" />
                                                <span>File attachment</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</span>
                                        )}
                                        {isFailed && (
                                            <button onClick={() => onRetry(msg.id)} className="text-2xs text-red-400 hover:text-red-300 font-bold ml-2">
                                                Retry
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input — uses .chat-input-dock for correct bottom-nav spacing */}
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 chat-input-dock">
                <div className="max-w-3xl mx-auto">
                    <AutoExpandingChatInput
                        value={newMessage}
                        onChange={setNewMessage}
                        onSend={handleSend}
                        placeholder="Type a message..."
                        sendDisabled={!newMessage.trim()}
                        sendIcon={<SendIcon />}
                        sendAriaLabel="Send message"
                    />
                </div>
            </div>
        </div>
    );
};

// ─── MessageContent — progressive disclosure for long message text ──────
// Truncates after 4 lines / 280 chars, shows "See More" to expand inline.
// Uses line-clamp-4 (CSS) + overflow hidden to prevent layout jump.
// The expand/collapse is purely visual — no scroll position reset.
const MessageContent: React.FC<{ content: string; isAdmin: boolean }> = ({ content, isAdmin }) => {
    const [expanded, setExpanded] = React.useState(false);
    const isLong = content.length > 280 || content.split('\n').length > 4;
    return (
        <>
            <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${isAdmin ? '' : 'text-slate-700 dark:text-slate-300'} ${isLong && !expanded ? 'line-clamp-4' : ''}`}
            >
                {content}
            </p>
            {isLong && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`text-2xs font-bold mt-0.5 transition-colors ${isAdmin ? 'text-primary-200 hover:text-primary-100' : 'text-primary-600 hover:text-primary-500'}`}
                >
                    {expanded ? '▲ Show less' : '▼ See more'}
                </button>
            )}
        </>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// InlineTicketReply — appears directly under a ticket's thread when the
// admin clicks "Reply to this ticket". Has its own textarea + send button
// so the admin can respond immediately without scrolling to the bottom.
// ══════════════════════════════════════════════════════════════════════════
const InlineTicketReply: React.FC<{
    ticketId: string;
    conversationId: string;
    firmId: string;
    adminId: string;
    adminName: string;
    onSent: () => void;
    onCancel: () => void;
    sendAdminReply: any;
    addToast: (msg: string, opts?: any) => void;
}> = ({ ticketId, conversationId, firmId, adminId, adminName, onSent, onCancel, sendAdminReply, addToast }) => {
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
            <div className="bg-slate-50 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700 p-2.5 w-full box-border">
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
                    sendLabel={sending ? 'Sending...' : 'Send Reply'}
                    sendAriaLabel="Send reply"
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

// ══════════════════════════════════════════════════════════════════════════
// Unified MessagesView — Conversations / Notices / Scheduled
// ══════════════════════════════════════════════════════════════════════════
const MessagesView: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { matterState } = useMatterState();
    const { currentUser } = useAuth();
    const { retryMessage, handleMarkNotificationsRead, handleSendMessage, handleEditMessage, handleDeleteMessage, handleDeleteChat, addItem: actionsAddItem } = useDataActions();
    const { openModal, closeModal, navigateTo, currentHistoryEntry, addToast, activePeers } = useUI();
    const { isProperty, isLegal, isUnified, hasPropertyFeatures } = useProduct();

    // Helper: check if a peer is online from the rich activePeers data.
    // activePeers is now an array of { userId, updatedAt, isOnline } objects.
    // Falls back to string comparison for backward compat.
    const isPeerOnline = (userId: string): boolean => {
        if (!activePeers || !userId) return false;
        const uid = String(userId);
        return activePeers.some((p: any) => {
            if (typeof p === 'string') return p === uid;
            return String(p.userId) === uid && p.isOnline;
        });
    };

    // Helper: get last-seen timestamp for a peer
    const getPeerLastSeen = (userId: string): number => {
        if (!activePeers || !userId) return 0;
        const uid = String(userId);
        for (const p of activePeers as any[]) {
            if (typeof p === 'string') { if (p === uid) return Date.now(); }
            else if (String(p.userId) === uid) return p.updatedAt || 0;
        }
        return 0;
    };
    const { confirm, ConfirmDialog } = useConfirm();

    if (!currentUser) return null;

    const conversations = coreState.chatConversations || [];
    const users = coreState.users || [];
    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

    // Load chat messages from Convex (getFirmData returns chatMessages: [])
    // This is the REAL data source — without this, messages disappear on refresh
    const chatMessagesResult = useQuery(api.myFunctions.getChatMessages,
        firmId ? { firmId } : 'skip'
    );
    const messages = chatMessagesResult || [];
    const activeConversationId = currentHistoryEntry.context?.activeConversationId;
    const onNavigate = (view: any, id: any, context: any) => navigateTo(view, id, context);

    // ── Tab state — respect initialTab from navigation context (e.g. notification click) ──
    const [activeTab, setActiveTab] = useState<MessagingTab>(() => {
        const hint = currentHistoryEntry.context?.initialTab;
        if (hint === 'inbox') return 'inbox';
        if (hint === 'team') return 'team';
        if (hint === 'notices') return 'notices';
        if (hint === 'scheduled') return 'scheduled';
        if (hint === 'communications') return 'communications';
        return 'inbox';
    });

    // Also switch tabs when navigating from notifications while already on messaging view
    useEffect(() => {
        const hint = currentHistoryEntry.context?.initialTab;
        if (hint === 'inbox' || hint === 'team' || hint === 'notices' || hint === 'scheduled' || hint === 'communications') {
            setActiveTab(hint as MessagingTab);
        }
        // If navigating to inbox with a specific inbound message ID, select it
        if (hint === 'inbox' && currentHistoryEntry.context?.selectedInboxId) {
            setSelectedInboxId(currentHistoryEntry.context.selectedInboxId);
            // Also set the inbox type if provided (e.g. 'team' for team chat notifications)
            const inboxType = currentHistoryEntry.context?.selectedInboxType;
            if (inboxType === 'team' || inboxType === 'conversation' || inboxType === 'inbound' || inboxType === 'portal') {
                setSelectedInboxType(inboxType);
            }
        }
        // ─── Contact-initiated messaging ────────────────────────────────
        // When navigated from ContactDetailView's "Message" button, show a
        // toast indicating the preferred channel and recipient. The user
        // can then use the compose box to send a message.
        const contactName = currentHistoryEntry.context?.contactName;
        const composeChannel = currentHistoryEntry.context?.composeChannel;
        const composeRecipient = currentHistoryEntry.context?.composeRecipient;
        if (contactName && composeChannel) {
            addToast(
                `Compose a message to ${contactName} via ${composeChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} (${composeRecipient || 'no address'}). Use the compose box below.`,
                { type: 'info' }
            );
        }
    }, [currentHistoryEntry.context?.initialTab, currentHistoryEntry.context?.selectedInboxId, currentHistoryEntry.context?.selectedInboxType, currentHistoryEntry.context?.contactName]);

    // ── Team Chat state (existing logic) ──
    const teamChatEndRef = useRef<HTMLDivElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(activeConversationId || null);
    const [searchQuery, setSearchQuery] = useState('');
    const myFeedback = useQuery(api.feedback.getMyFeedbackReplies, { userId: currentUser?.id || '' }) || [];

    // ── Inbox data — Atrium (property) or Vega (legal) ──
    // Atrium: inbound WhatsApp/Email messages from residents
    const atriumInboundResult = useQuery(api.sentry.getInboundMessages, firmId ? { firmId } : 'skip');
    const atriumInbound = atriumInboundResult || [];
    // Atrium: portal conversations (conversation-based, replaces flat portal messages)
    const portalConversationsResult = useQuery(api.portals.getPortalConversationsByFirm, firmId ? { firmId } : 'skip');
    const portalConversations = portalConversationsResult || [];
    // Legacy: still fetch portal messages for backward compat
    const portalMessagesResult = useQuery(api.portals.getPortalMessagesByFirm, firmId ? { firmId } : 'skip');
    const portalMessages = portalMessagesResult || [];
    // Vega: client messages on matters
    const clientMessages = matterState?.clientMessages || [];
    // Audit trail for outbound messages
    const automationLogs = useQuery(api.sentry.getAutomationLogs, firmId ? { firmId, limit: 100 } : 'skip') || [];

    // ── Loading state detection ──
    const isInboxLoading = atriumInboundResult === undefined || portalConversationsResult === undefined || portalMessagesResult === undefined;

    // ── Scheduled messages — state managed by ScheduledTab component ──

    // ── Compose modal for inbox replies ──
    const [showCompose, setShowCompose] = useState(false);
    const [showTeamMessage, setShowTeamMessage] = useState(false);
    const [teamReplyText, setTeamReplyText] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [teamAttachments, setTeamAttachments] = useState<{ storageId: string; name: string }[]>([]);
    const teamFileInputRef = useRef<HTMLInputElement>(null);
    const [composePrefill, setComposePrefill] = useState<ComposeModalPrefill | undefined>(undefined);
    const logAutomation = useMutation(api.sentry.logAutomation);
    const markInboundRead = useMutation(api.sentry.markMessageAsRead);
    const deleteInboundMessage = useMutation(api.sentry.deleteInboundMessage);
    // Admin-side delete for portal conversation messages. Allows admin to
    // delete ANY message in a conversation (their own or the portal user's).
    // Uses the new adminDeletePortalMessage mutation which has a cross-firm guard.
    const adminDeletePortalMsg = useMutation(api.portals.adminDeletePortalMessage);
    // TASK 15: Hard-delete an entire conversation record (used by bulk delete).
    // We soft-delete the messages first (adminDeletePortalMessage) for compliance,
    // then hard-delete the conversation record itself so it disappears from the list.
    const hardDeleteConv = useMutation(api.portals.hardDeleteConversation);
    // TASK 15: useConvex for ad-hoc queries during bulk delete (fetch messages per conversation)
    const convex = useConvex();

    // ── Inbox: selected conversation ──
    // Initial state respects navigation context so that clicking a notification
    // opens the specific conversation directly — not just the messaging page.
    const [selectedInboxId, setSelectedInboxId] = useState<string | null>(() => {
        const ctx = currentHistoryEntry.context;
        if (ctx?.initialTab === 'inbox' && ctx?.selectedInboxId) return ctx.selectedInboxId;
        return null;
    });
    const [selectedInboxType, setSelectedInboxType] = useState<'inbound' | 'portal' | 'conversation' | 'team' | null>(() => {
        const ctx = currentHistoryEntry.context;
        if (ctx?.initialTab === 'inbox' && ctx?.selectedInboxId) {
            return (ctx?.selectedInboxType as 'team' | 'conversation' | 'inbound' | 'portal') || null;
        }
        return null;
    });
    const [inboxReply, setInboxReply] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    // ── TASK 15: Multi-select for bulk conversation deletion ──
    // Tracks which conversation IDs the user has checked. When non-empty,
    // a "Delete selected" button appears in the inbox header.
    // Uses the existing `confirm`/`ConfirmDialog` from useConfirm() at line 310.
    const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // ── Conversation type filters ─────────────────────────────────────────
    const [typeFilters, setTypeFilters] = useState<{
        request: boolean;
        ticket: boolean;
        replied: boolean;
        portal: boolean;
        team: boolean;
    }>({ request: true, ticket: true, replied: true, portal: true, team: true });

    // Role filter: All / Client / Resident.
    // Product-aware: Vega only shows All+Clients, Atrium only shows All+Residents,
    // Komplete shows all three. The role type stays a union for compatibility.
    const [roleFilter, setRoleFilter] = useState<'all' | 'Client' | 'Tenant'>('all');

    // Search query for filtering by name/subject
    const [conversationSearch, setConversationSearch] = useState('');

    const filteredPortalConversations = useMemo(() => {
        return (portalConversations as any[]).filter((conv: any) => {
            // Type filter
            const convType = detectConversationType(conv);
            if (convType === 'service_request' && !typeFilters.request) return false;
            if (convType === 'maintenance' && !typeFilters.ticket) return false;
            if (convType === 'admin_reply' && !typeFilters.replied) return false;
            if (convType === 'portal' && !typeFilters.portal) return false;
            // Role filter
            if (roleFilter !== 'all' && conv.participantRole !== roleFilter) return false;
            // Search filter
            if (conversationSearch.trim()) {
                const q = conversationSearch.toLowerCase();
                const name = (conv.participantName || '').toLowerCase();
                const preview = (conv.lastMessagePreview || '').toLowerCase();
                if (!name.includes(q) && !preview.includes(q)) return false;
            }
            return true;
        });
    }, [portalConversations, typeFilters, roleFilter, conversationSearch]);

    // ── Team conversations for the unified inbox ──────────────────────────
    // Builds a sorted list of the current user's team direct-message
    // conversations, each enriched with: the other member's user object,
    // their online status (from activePeers), and the last message preview.
    // These render inline in the Conversations list alongside portal convos,
    // with an indigo "Team" badge so users can tell them apart at a glance.
    const teamConversationsForInbox = useMemo(() => {
        const myId = currentUser?.id || currentUser?._id || '';
        return (conversations as any[])
            .filter((c: any) => c && c.type === 'direct' &&
                (c.memberIds?.includes(myId) || c.memberIds?.includes(currentUser?._id || '')) &&
                !c.hiddenForUserIds?.includes(myId))
            .map((c: any) => {
                const otherMemberId = (c.memberIds || []).find((id: string) => id !== myId && id !== currentUser?._id);
                const otherMember = (users as any[]).find((u: any) => u.id === otherMemberId || u._id === otherMemberId);
                const convMessages = (messages as any[]).filter((m: any) =>
                    (m.conversationId === c.id || m.conversationId === c._id) && !m.isDeleted
                );
                // messages array comes from getChatMessages in DESC order (newest first).
                // So convMessages[0] is the NEWEST message, not the last element.
                const lastMsg = convMessages[0];
                const unreadCount = (coreState.notifications || []).filter((n: any) =>
                    !n.isRead &&
                    n.userId === myId &&
                    n.link?.view === 'messaging' &&
                    (n.link?.id === c.id || n.link?.id === c._id ||
                     n.link?.context?.activeConversationId === c.id ||
                     n.link?.context?.activeConversationId === c._id)
                ).length;
                return {
                    _id: c._id,
                    id: c.id,
                    otherMember,
                    otherMemberId,
                    isOnline: isPeerOnline(otherMemberId),
                    lastMsg,
                    lastMessageAt: lastMsg?.timestamp || lastMsg?.createdAt || c.createdAt,
                    lastMessagePreview: lastMsg?.content || '',
                    unreadCount,
                    conversationId: c.id || c._id,
                };
            })
            .sort((a: any, b: any) => {
                const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                return tb - ta;
            });
    }, [conversations, messages, users, currentUser, activePeers, coreState.notifications]);

    // ── Portal conversation messages (when a conversation is selected) ──
    const conversationMessages = useQuery(
        api.portals.getConversationMessages,
        (selectedInboxType === 'conversation' && selectedInboxId) ? { conversationId: selectedInboxId } : 'skip'
    );

    // ── Admin file upload for replies ──
    const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);
    const [adminAttachments, setAdminAttachments] = useState<{ storageId: string; name: string }[]>([]);
    const adminFileInputRef = useRef<HTMLInputElement>(null);

    // ── Notice Board — count for tab badge (content rendered by NoticeBoardTab) ──
    const allNotices = useQuery(api.portals.getAllNotices, firmId ? { firmId } : 'skip') || [];
    const activeNoticesCount = useMemo(() => (allNotices as any[]).filter((n: any) => n.status === 'active').length, [allNotices]);

    // ── Scheduled — count for tab badge (content rendered by ScheduledTab) ──
    const scheduledMessagesCount = useQuery(api.portals.getScheduledMessagesByFirm, firmId ? { firmId } : 'skip') || [];
    const pendingScheduled = useMemo(() => (scheduledMessagesCount as any[]).filter((m: any) => m.status === 'scheduled').length, [scheduledMessagesCount]);

    // ── Inbox: compute unread counts ──
    const inboundUnreadCount = atriumInbound.filter((m: any) => !m.isRead).length;
    const portalUnreadCount = (portalConversations as any[]).reduce((sum: number, c: any) => sum + (c.unreadByAdmin || 0), 0);
    // Team unread = sum of unreadCount across all team conversations in the unified inbox
    const teamUnreadCount = teamConversationsForInbox.reduce((sum: number, tc: any) => sum + (tc.unreadCount || 0), 0);
    const totalInboxUnread = inboundUnreadCount + portalUnreadCount + clientMessages.filter(m => !m.isRead).length + teamUnreadCount;

    // ── Inbox: find selected conversation/message ──
    const selectedInboundMsg = useMemo(() => {
        // Conversation-based portal message
        if (selectedInboxType === 'conversation') {
            const conv = (portalConversations as any[]).find((c: any) => String(c._id) === selectedInboxId);
            if (conv) return {
                _id: conv._id,
                _inboxType: 'conversation' as const,
                senderName: conv.participantName || 'Portal User',
                senderContact: conv.participantEmail || conv.participantId,
                channel: 'portal',
                content: conv.lastMessagePreview || '',
                receivedAt: conv.lastMessageAt,
                isRead: (conv.unreadByAdmin || 0) === 0,
                status: (conv.unreadByAdmin || 0) > 0 ? 'unread' : 'read',
                conversationId: String(conv._id),
                participantRole: conv.participantRole,
                propertyId: conv.propertyId,
                unitId: conv.unitId,
                matterId: conv.matterId,
            };
        }
        // Legacy inbound (WhatsApp/Email)
        if (selectedInboxType === 'inbound') {
            const inbound = atriumInbound.find((m: any) => m._id === selectedInboxId);
            if (inbound) return { ...inbound, _inboxType: 'inbound' as const };
        }
        // Legacy portal message (backward compat)
        if (selectedInboxType === 'portal') {
            const portal = (portalMessages as any[]).find((m: any) => m._id === selectedInboxId);
            if (portal) return {
                ...portal,
                _inboxType: 'portal' as const,
                senderName: portal.senderName || 'Portal User',
                senderContact: portal.senderEmail || portal.senderId,
                channel: 'portal',
                content: portal.content || portal.subject,
                receivedAt: portal.createdAt,
                isRead: portal.status === 'read' || portal.status === 'replied',
            };
        }
        return undefined;
    }, [atriumInbound, portalConversations, portalMessages, selectedInboxId, selectedInboxType]);

    // ── Inbox: portal message reply mutations ──
    const replyToPortal = useMutation(api.portals.replyToPortalMessage);
    const sendAdminReply = useMutation(api.portals.sendAdminReply);
    const markPortalRead = useMutation(api.portals.markPortalMessageRead);
    const markConvReadByAdmin = useMutation(api.portals.markConversationReadByAdmin);

    // ── Team Chat: server-side message + notification mutation ──
    // This atomically creates the chat message AND notifications for all
    // other conversation members. Replaces the old client-side dual-call
    // pattern (addItem('chatMessages') + addItem('notifications')) which
    // silently dropped notifications if the second call failed or was
    // missing entirely (the root cause of the "notifications stopped
    // working" bug).
    const sendChatMessageMutation = useMutation(api.myFunctions.sendChatMessage);

    // ── Ticketing: status update mutations ──
    const updateTicketStatus = useMutation(api.portals.updateMaintenanceTicketStatus);
    const updateRequestStatus = useMutation(api.portals.updateClientServiceRequestStatus);
    const assignTicketMutation = useMutation(api.portals.assignTicketToTeamMember);

    // Find ALL linked tickets/requests in the currently-selected conversation.
    // Each message with linkedTicketId or linkedRequestId represents a separate
    // ticket/request. We collect them all so we can show a status bar for EACH
    // one individually — the user explicitly asked for per-ticket control.
    const linkedTickets = useMemo(() => {
        if (selectedInboxType !== 'conversation' || !selectedInboxId) return [];
        const msgs = (conversationMessages as any[]) || [];
        const seen = new Set<string>();
        const tickets: { kind: 'maintenance' | 'client_service'; id: string; requestTypeLabel?: string; requestTypeKey?: string }[] = [];
        for (const m of msgs) {
            const ticketId = m.linkedTicketId || m.linkedRequestId;
            if (ticketId && !seen.has(String(ticketId))) {
                seen.add(String(ticketId));
                tickets.push({
                    kind: m.linkedTicketId ? 'maintenance' : 'client_service',
                    id: String(ticketId),
                    requestTypeLabel: m.requestTypeLabel,
                    requestTypeKey: m.requestTypeKey,
                });
            }
        }
        return tickets;
    }, [selectedInboxType, selectedInboxId, conversationMessages]);

    // Fetch ALL linked tickets/requests to get their current statuses.
    // We fetch each one individually via the convex client and store them
    // in a map keyed by ticket ID.
    const [linkedTicketRecords, setLinkedTicketRecords] = useState<Record<string, any>>({});
    useEffect(() => {
        if (linkedTickets.length === 0) { setLinkedTicketRecords({}); return; }
        let cancelled = false;
        const fetchAll = async () => {
            const records: Record<string, any> = {};
            for (const t of linkedTickets) {
                try {
                    const queryFn = t.kind === 'maintenance'
                        ? api.portals.getTicketById
                        : api.portals.getServiceRequestById;
                    const argKey = t.kind === 'maintenance' ? 'ticketId' : 'requestId';
                    const rec = await convex.query(queryFn, { [argKey]: t.id } as any);
                    records[t.id] = rec;
                } catch {
                    records[t.id] = null;
                }
            }
            if (!cancelled) setLinkedTicketRecords(records);
        };
        fetchAll();
        return () => { cancelled = true; };
    }, [linkedTickets, convex]);

    const refreshTicketRecord = async (ticketInfo: { kind: string; id: string }) => {
        const queryFn = ticketInfo.kind === 'maintenance'
            ? api.portals.getTicketById
            : api.portals.getServiceRequestById;
        const argKey = ticketInfo.kind === 'maintenance' ? 'ticketId' : 'requestId';
        try {
            const rec = await convex.query(queryFn, { [argKey]: ticketInfo.id } as any);
            setLinkedTicketRecords(prev => ({ ...prev, [ticketInfo.id]: rec }));
        } catch {}
    };

    const handleAdvanceTicket = async (ticketInfo: { kind: 'maintenance' | 'client_service'; id: string }, newStatus: 'open' | 'in_progress' | 'resolved' | 'closed') => {
        try {
            const resolution = (newStatus === 'resolved' || newStatus === 'closed')
                ? `Status updated to ${newStatus === 'resolved' ? 'Addressed' : 'Closed'}.`
                : undefined;
            if (ticketInfo.kind === 'maintenance') {
                await updateTicketStatus({
                    ticketId: ticketInfo.id as any,
                    status: newStatus,
                    resolution,
                });
            } else {
                await updateRequestStatus({
                    requestId: ticketInfo.id as any,
                    status: newStatus,
                    resolution,
                });
            }
            addToast(`Status updated to "${newStatus.replace('_', ' ')}".`, { type: 'success' });
            await refreshTicketRecord(ticketInfo);
            // Trigger visual highlight on the message card that owns this ticket
            const cardEl = document.querySelector(`[data-ticket-id="${ticketInfo.id}"]`);
            if (cardEl) {
                cardEl.classList.remove('state-changed');
                void cardEl.offsetWidth; // force reflow to restart animation
                cardEl.classList.add('state-changed');
                setTimeout(() => cardEl.classList.remove('state-changed'), 1000);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to update status.', { type: 'error' });
        }
    };

    // ── Delegate ticket to a team member ───────────────────────────────
    const handleAssignTicket = async (ticketInfo: { kind: 'maintenance' | 'client_service'; id: string }, userId: string, userName: string) => {
        if (!firmId || !currentUser?.id) return;
        try {
            await assignTicketMutation({
                requestKind: ticketInfo.kind,
                requestId: ticketInfo.id,
                assignedToUserId: userId,
                assignedToName: userName,
                assignedBy: currentUser.id,
                firmId,
            });
            addToast(`Ticket assigned to ${userName}. Portal user has been notified.`, { type: 'success' });
            await refreshTicketRecord(ticketInfo);
        } catch (err: any) {
            addToast(err.message || 'Failed to assign ticket.', { type: 'error' });
        }
    };

    // ── Team Chat: filtered conversations (existing logic) ──
    //
    // `lastMessageTimeByConv` pre-computes, for each conversationId, the
    // timestamp of its most recent message. This is a single O(n) pass over
    // `messages` and replaces the previous O(n²) sort comparator that called
    // `messages.filter(...)` once per conversation per comparison — which
    // was the dominant cost when the message list grew past a few hundred
    // entries (the comparator ran ~n·log(n) times, each filtering the full
    // messages array twice).
    const lastMessageTimeByConv = useMemo(() => {
        const map = new Map<string, number>();
        if (!Array.isArray(messages)) return map;
        for (const m of messages) {
            if (!m || !m.conversationId) continue;
            const convId = m.conversationId.toString();
            const t = m.timestamp ? new Date(m.timestamp).getTime() : 0;
            const prev = map.get(convId);
            // Track the maximum timestamp seen per conversation so the Map
            // holds the true "last activity" time regardless of array order.
            if (prev === undefined || (t > prev && !isNaN(t))) {
                map.set(convId, isNaN(t) ? 0 : t);
            }
        }
        return map;
    }, [messages]);

    const filteredConversations = useMemo(() => {
        const chats = conversations
            .filter((c: any) => {
                if (!c) return false;
                if (c.hiddenForUserIds?.includes(currentUser.id)) return false;
                if (!c.memberIds?.includes(currentUser.id)) return false;
                if (!searchQuery) return true;
                const lowerQuery = searchQuery.toLowerCase();
                if (c.type === 'channel') return c.name?.toLowerCase().includes(lowerQuery);
                const otherMemberId = c.memberIds?.find((id: string) => id !== currentUser.id);
                const otherMember = users.find(u => u.id === otherMemberId);
                return otherMember?.name?.toLowerCase().includes(lowerQuery) ?? false;
            })
            .sort((a: any, b: any) => {
                // O(1) Map lookups instead of two full `messages.filter(...)`
                // calls per comparison. Conversations with no messages sort
                // to the bottom (time 0).
                const timeA = lastMessageTimeByConv.get(a.id?.toString()) ?? 0;
                const timeB = lastMessageTimeByConv.get(b.id?.toString()) ?? 0;
                return timeB - timeA;
            });

        const systemUnreadCount = (coreState.notifications || []).filter(n =>
            n && n.userId === currentUser.id &&
            !n.isRead &&
            n.link?.view === 'messaging' &&
            n.link?.context?.systemInbox
        ).length;

        const hasSystemMessages = myFeedback.length > 0;

        if (hasSystemMessages && (!searchQuery || 'system inbox aria practicepro team'.includes(searchQuery.toLowerCase()))) {
            const systemConv = {
                id: 'system-inbox',
                type: 'system',
                name: 'ARIA Assistant',
                memberIds: [currentUser.id],
                _isSystem: true,
                unreadCount: systemUnreadCount,
                lastMsg: myFeedback[0]
            } as any;
            return [systemConv, ...chats];
        }

        return chats;
    }, [conversations, lastMessageTimeByConv, searchQuery, currentUser, users, myFeedback, coreState.notifications]);

    useEffect(() => {
        if (activeConversationId) {
            setSelectedId(activeConversationId);
        }
    }, [activeConversationId]);

    // Auto-scroll team chat to bottom when messages change or conversation selected
    useEffect(() => {
        const activeTeamConvId = (activeTab === 'team' ? selectedId : null) ||
                                  (selectedInboxType === 'team' ? selectedInboxId : null);
        if (activeTeamConvId) {
            const timer = setTimeout(() => {
                teamChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeTab, selectedId, selectedInboxType, selectedInboxId, messages]);

    const activeConversation = conversations?.filter(Boolean).find((c: any) => c && c.id === selectedId);
    const activeMessages = Array.isArray(messages) ? messages.filter((m: any) => m && m.conversationId?.toString() === selectedId) : [];

    // Clear team chat notifications for active conversation
    useEffect(() => {
        const isSpecificId = selectedId && selectedId.length > 10;
        if (isSpecificId) {
            const conversationNotificationIds = (coreState.notifications || [])
                .filter(n => {
                    if (!n || !n.link) return false;
                    const matchesView = n.link.view === 'messaging';
                    const matchesContext = n.link?.context?.activeConversationId?.toString() === selectedId;
                    const matchesLinkId = n.link?.id?.toString() === selectedId;
                    const matchesSystemInbox = selectedId === 'system-inbox' && n.link.context?.systemInbox;
                    return !n.isRead && n.userId === currentUser.id && matchesView && (matchesContext || matchesLinkId || matchesSystemInbox);
                })
                .map(n => n.id);
            if (conversationNotificationIds.length > 0) handleMarkNotificationsRead(conversationNotificationIds);
        }
    }, [selectedId, coreState.notifications, handleMarkNotificationsRead, currentUser.id]);

    const renderSidebarPreview = (msg: ChatMessage | undefined) => {
        if (!msg) return 'No messages yet';
        if (msg.content?.startsWith('[FILE:')) {
            return <span className="flex items-center text-slate-600 dark:text-zinc-400">{msg.authorId === currentUser.id ? 'You: ' : ''}<DocumentIcon className="w-3 h-3 inline mr-1 text-slate-400" /> File</span>;
        }
        return <span className={(msg as any).status === 'failed' ? 'text-red-500 italic' : ''}>{msg.authorId === currentUser.id ? 'You: ' : ''}{msg.content}</span>;
    }

    // ── TASK 15: Bulk conversation deletion + Mark all as read ──

    // Toggle a conversation's selection checkbox
    const toggleConvSelection = (convId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Don't trigger the conversation open onClick
        setSelectedConvIds(prev => {
            const next = new Set(prev);
            if (next.has(convId)) next.delete(convId);
            else next.add(convId);
            return next;
        });
    };

    // Select all conversations
    const selectAllConversations = () => {
        const allConvIds = new Set<string>(
            (portalConversations as any[])
                .filter((c: any) => c.participantRole !== 'Client')
                .map((c: any) => String(c._id))
        );
        setSelectedConvIds(allConvIds);
    };

    // Clear selection
    const clearSelection = () => setSelectedConvIds(new Set());

    // Bulk delete selected conversations + their messages
    const handleBulkDeleteConversations = async () => {
        if (selectedConvIds.size === 0 || isBulkDeleting) return;
        const ok = await confirm({
            title: `Delete ${selectedConvIds.size} conversation${selectedConvIds.size > 1 ? 's' : ''}?`,
            message: 'All messages in these conversations will be permanently removed. This action cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true,
        });
        if (!ok) return;
        setIsBulkDeleting(true);
        try {
            // Delete each conversation's messages, then the conversation itself.
            // We use adminDeletePortalMessage for each message (cross-firm guarded).
            for (const convId of selectedConvIds) {
                try {
                    // Fetch messages for this conversation and delete them
                    const msgs: any = await convex.query(api.portals.getConversationMessages, { conversationId: convId });
                    if (Array.isArray(msgs)) {
                        for (const msg of msgs) {
                            try {
                                await adminDeletePortalMsg({
                                    messageId: String(msg._id),
                                    adminId: currentUser.id,
                                    firmId: currentUser.firmId || '',
                                });
                            } catch { /* message may already be deleted */ }
                        }
                    }
                    // Delete the conversation record itself
                    try {
                        await hardDeleteConv({ conversationId: convId });
                    } catch { /* may not exist */ }
                } catch (e) {
                    console.warn('[MessagesView] Bulk delete failed for conversation:', convId, e);
                }
            }
            addToast(`Deleted ${selectedConvIds.size} conversation${selectedConvIds.size > 1 ? 's' : ''}.`, { type: 'success' });
            setSelectedConvIds(new Set());
            setSelectedInboxId(null);
            setSelectedInboxType(null);
        } catch (err: any) {
            addToast(err.message || 'Failed to delete conversations.', { type: 'error' });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Mark ALL inbound messages as read (clears the sidebar badge)
    const handleMarkAllInboundRead = async () => {
        const unreadInbound = (atriumInbound as any[]).filter((m: any) => !m.isRead);
        if (unreadInbound.length === 0) {
            addToast('No unread inbound messages.', { type: 'info', duration: 2000 });
            return;
        }
        for (const msg of unreadInbound) {
            markInboundRead({ messageId: msg._id }).catch(() => {});
        }
        addToast(`Marked ${unreadInbound.length} message${unreadInbound.length > 1 ? 's' : ''} as read.`, { type: 'success', duration: 2000 });
    };

    // TASK 15+19: Auto-mark ALL unread messages as read when the MessagesView
    // is first opened. This clears the sidebar badge intuitively — the admin
    // is "viewing" the messages, so they should be marked as read.
    //
    // The sidebar badge counts THREE things:
    //   1. chatNotificationCount (from coreState.notifications)
    //   2. inboundUnread (atrium_inbound_messages where !isRead)
    //   3. portalUnread (portal_messages where status === 'unread')
    //
    // Previously we only marked #2 as read. The badge stayed at 1 because
    // #3 (portal_messages) was never marked as read. Now we mark BOTH #2
    // and #3 as read when the MessagesView mounts.
    const hasAutoMarkedRead = useRef(false);
    useEffect(() => {
        if (hasAutoMarkedRead.current) return;
        // Wait until both queries have loaded
        if (!atriumInbound && !portalMessages) return;
        hasAutoMarkedRead.current = true;

        // Mark all unread atrium_inbound_messages as read
        const unreadInbound = (atriumInbound as any[] || []).filter((m: any) => !m.isRead);
        for (const msg of unreadInbound) {
            markInboundRead({ messageId: msg._id }).catch(() => {});
        }

        // TASK 19: Also mark all unread portal_messages as read.
        // The sidebar badge counts portal_messages where status === 'unread'.
        // Use the existing markPortalMessageRead mutation for each one.
        const unreadPortal = (portalMessages as any[] || []).filter((m: any) => m.status === 'unread' || !m.isRead);
        for (const msg of unreadPortal) {
            markPortalRead({ messageId: msg._id }).catch(() => {});
        }

        // Also mark all conversations as read (unreadByAdmin → 0)
        const unreadConversations = (portalConversations as any[] || []).filter((c: any) => (c.unreadByAdmin || 0) > 0);
        for (const conv of unreadConversations) {
            markConvReadByAdmin({ conversationId: String(conv._id) }).catch(() => {});
        }
    }, [atriumInbound, portalMessages, portalConversations]);

    // ── Sub-thread state ──
    // When the admin taps "Reply" on a specific ticket's inline controls,
    // we set activeThreadTicketId so the reply is grouped under that ticket.
    // null = general conversation reply (no sub-thread).
    const [activeThreadTicketId, setActiveThreadTicketId] = useState<string | null>(null);

    // ── Inbox reply handler ──
    const handleInboxReply = async () => {
        if ((!inboxReply.trim() && adminAttachments.length === 0) || !selectedInboundMsg) return;
        setIsSendingReply(true);
        try {
            // Conversation-based portal messages: use sendAdminReply
            if (selectedInboundMsg._inboxType === 'conversation') {
                await sendAdminReply({
                    conversationId: selectedInboxId!,
                    firmId,
                    adminId: currentUser?.id || '',
                    adminName: currentUser?.name || 'Admin',
                    content: inboxReply.trim(),
                    attachments: adminAttachments.length > 0 ? adminAttachments.map(a => a.storageId) : undefined,
                    attachmentNames: adminAttachments.length > 0 ? adminAttachments.map(a => a.name) : undefined,
                    threadTicketId: activeThreadTicketId || undefined,
                });
                addToast('Reply sent.', { type: 'success' });
                setInboxReply('');
                setAdminAttachments([]);
                return;
            }

            // Legacy portal messages: use the old reply mutation
            if (selectedInboundMsg._inboxType === 'portal') {
                await replyToPortal({
                    messageId: selectedInboxId as any,
                    replyContent: inboxReply.trim(),
                    replierName: currentUser?.name || 'Admin',
                });
                addToast('Reply sent to portal user.', { type: 'success' });
                setInboxReply('');
                return;
            }

            // Inbound messages (WhatsApp/Email)
            const integrationStatus = coreState.firmDetails?.automationSettings?.chakra?.isActive ? 'connected' : 'simulated';
            if (integrationStatus === 'connected') {
                const channel = selectedInboundMsg.channel as any;
                setComposePrefill({
                    tenantName: selectedInboundMsg.senderName,
                    tenantEmail: channel === 'email' ? selectedInboundMsg.senderContact : undefined,
                    tenantPhone: channel === 'whatsapp' ? selectedInboundMsg.senderContact : undefined,
                    channel,
                });
                setShowCompose(true);
            } else {
                // Save to audit log so reply is not lost
                try {
                    await logAutomation({
                        firmId,
                        unitId: selectedInboundMsg.unitId || undefined,
                        tenantId: selectedInboundMsg.tenantId || undefined,
                        messageType: 'custom' as any,
                        channel: selectedInboundMsg.channel || 'whatsapp',
                        recipient: selectedInboundMsg.senderContact || selectedInboundMsg.senderName || '',
                        messageContent: inboxReply.trim(),
                        messagePreview: inboxReply.trim().substring(0, 80),
                        direction: 'outbound',
                        senderName: currentUser?.name || 'Admin',
                        status: 'simulated',
                        triggeredBy: 'manual_reply_offline',
                    });
                } catch (e) { console.warn('[Inbox] Could not save reply to audit log:', e); }
            }
            addToast('Reply sent.', { type: 'success' });
            setInboxReply('');
        } catch (e: any) {
            addToast(e.message || 'Failed to send reply.', { type: 'error' });
        } finally {
            setIsSendingReply(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════════════
    // RENDER: Unified Messaging Hub
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-900 border-x border-slate-200 dark:border-zinc-800">
            {/* ── Page Header (matches Documents/Contacts pattern) ── */}
            <div className="flex-shrink-0 sticky top-0 z-30 glass py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Messages</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => activeTab === 'team' ? setShowTeamMessage(true) : setShowCompose(true)}
                            className="p-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-2 text-xs font-bold min-h-[40px]"
                        >
                            <PlusIcon className="w-4 h-4" /> {activeTab === 'team' ? 'New Message' : 'Compose'}
                        </button>
                    </div>
                </div>
            </div>
            {/* ── Top Tab Bar ── */}
            <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 sm:px-4 pt-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                    {/* Conversations Tab (was "Inbox") — live 2-way chat threads
                        with clients/residents via the portal. Renamed to avoid
                        conceptual overlap with "WhatsApp & Email" (which handles
                        external-channel communications). */}
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'inbox'
                                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                        <span className="hidden sm:inline">Conversations</span>
                        {totalInboxUnread > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-red-600 text-white text-2xs font-bold rounded-full flex items-center justify-center shadow-sm">
                                {totalInboxUnread > 9 ? '9+' : totalInboxUnread}
                            </span>
                        )}
                    </button>

                    {/* Team Chat tab — restored for in-app team messaging.
                        Uses chatConversations/chatMessages tables. */}
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'team'
                                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span className="hidden sm:inline">Team</span>
                    </button>

                    {/* Notice Board Tab — available for ALL firms (both Vega
                        and Atrium). Admins can post internal notices for
                        their team, and property managers can post resident-
                        facing notices. The NoticeBoardTab handles both. */}
                    {(
                    <button
                        onClick={() => setActiveTab('notices')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'notices'
                                ? 'border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <BellIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Notices</span>
                        {activeNoticesCount > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-amber-500 text-white text-2xs font-bold rounded-full flex items-center justify-center shadow-sm">
                                {activeNoticesCount > 9 ? '9+' : activeNoticesCount}
                            </span>
                        )}
                    </button>
                    )}

                    {/* Scheduled Tab */}
                    <button
                        onClick={() => setActiveTab('scheduled')}
                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'scheduled'
                                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <ClockIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Scheduled</span>
                        {pendingScheduled > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-amber-500 text-white text-2xs font-bold rounded-full flex items-center justify-center shadow-sm">
                                {pendingScheduled > 9 ? '9+' : pendingScheduled}
                            </span>
                        )}
                    </button>

                    {/* WhatsApp & Email tab REMOVED — its content (AtriumInbox)
                        has been merged into the Conversations tab. The inbound
                        WhatsApp/Email messages now appear inline in the All
                        Conversations list alongside portal messages. No more
                        separate tab needed. */}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
                {/* ═══ INBOX TAB ═══ */}
                {activeTab === 'inbox' && (
                    <div className="flex w-full h-full">
                        {/* Inbox Threads List */}
                        <div className={`${selectedInboxId ? 'hidden md:block' : 'block'} w-full md:w-80 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900`}>
                            {/* ── Merged header: title + type filters in one row ──
                                Saves vertical space by combining the "All Conversations" title
                                bar with the type filter checkboxes into a single compact row.
                                The mark-all-read button was removed per user request — users
                                can mark individual messages as read by opening them. */}
                            <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-1.5">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {isUnified ? 'All Conversations' : 'Conversations'}
                                    </h3>
                                </div>
                                {/* Type filter checkboxes — horizontal scroll on mobile, no wrapping */}
                                {((portalConversations as any[]).length > 0 || teamConversationsForInbox.length > 0) && selectedConvIds.size === 0 && (
                                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap -mx-1 px-1">
                                        {([
                                            { key: 'team'    as const, label: 'Team',     style: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',       dot: 'bg-indigo-400' },
                                            { key: 'request' as const, label: 'Requests',  style: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',           dot: 'bg-rose-400' },
                                            { key: 'ticket'  as const, label: 'Tickets',   style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       dot: 'bg-amber-400' },
                                            { key: 'replied' as const, label: 'Replied',   style: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         dot: 'bg-blue-400' },
                                            { key: 'portal'  as const, label: 'Portal',    style: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-400' },
                                        ]).map(f => (
                                            <label
                                                key={f.key}
                                                className="inline-flex items-center gap-1 cursor-pointer select-none flex-shrink-0"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={typeFilters[f.key]}
                                                    onChange={(e) => setTypeFilters(prev => ({ ...prev, [f.key]: e.target.checked }))}
                                                    className="sr-only"
                                                />
                                                <span className={`w-3 h-3 rounded border-2 flex items-center justify-center transition-colors ${
                                                    typeFilters[f.key]
                                                        ? `${f.dot} border-transparent`
                                                        : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900'
                                                }`}>
                                                    {typeFilters[f.key] && (
                                                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </span>
                                                <span className={`text-2xs font-bold px-1 py-0.5 rounded ${typeFilters[f.key] ? f.style : 'text-slate-400 dark:text-zinc-500 line-through'}`}>
                                                    {f.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Bulk action bar — shown when conversations are selected */}
                            {selectedConvIds.size > 0 && (
                                <div className="flex-shrink-0 py-2 px-4 border-b border-slate-200 dark:border-zinc-800 bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                        {selectedConvIds.size} selected
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={clearSelection}
                                            className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleBulkDeleteConversations}
                                            disabled={isBulkDeleting}
                                            className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {isBulkDeleting ? (
                                                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <TrashIcon className="w-3 h-3" />
                                            )}
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* ── Role filter + search bar ───────────────────────────
                                Additional filters for narrowing conversations by
                                participant role (Client/Resident) and free-text search. */}
                            {(portalConversations as any[]).length > 0 && selectedConvIds.size === 0 && (
                                <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
                                    {/* Role filter pills — product-aware:
                                        Pure legal (Vega): hide Residents pill.
                                        Pure property (Atrium): hide Clients pill.
                                        Komplete: show all three. */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {([
                                            { role: 'all' as const, label: 'All', show: true },
                                            { role: 'Client' as const, label: 'Clients', show: isLegal },
                                            { role: 'Tenant' as const, label: 'Residents', show: hasPropertyFeatures },
                                        ]).filter(r => r.show).map(r => (
                                            <button
                                                key={r.role}
                                                onClick={() => setRoleFilter(r.role)}
                                                className={`px-2 py-0.5 rounded-full text-2xs font-bold transition-colors ${
                                                    roleFilter === r.role
                                                        ? 'bg-primary-600 text-white'
                                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                                }`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Search input */}
                                    <input
                                        type="text"
                                        value={conversationSearch}
                                        onChange={e => setConversationSearch(e.target.value)}
                                        placeholder="Search conversations..."
                                        className="flex-1 min-w-0 px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 focus:ring-1 focus:ring-primary-500/30 focus:border-primary-400"
                                    />
                                    {conversationSearch && (
                                        <button
                                            onClick={() => setConversationSearch('')}
                                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 flex-shrink-0"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            )}
<div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isInboxLoading ? (
                                    <div className="p-3">
                                        <ListItemSkeleton count={6} />
                                    </div>
                                ) : (() => {
                                    // ─── UNIFIED INBOX LIST ────────────────────────────────────
                                    // Previously this branch was split into two halves:
                                    //   isProperty  → show residents' inbound + resident conversations
                                    //   !isProperty → show client conversations only
                                    // That broke for Komplete (unified) firms where BOTH isProperty
                                    // AND isLegal are true — client conversations were filtered out
                                    // because the property branch excluded participantRole === 'Client'.
                                    //
                                    // Now we always show ALL portal conversations regardless of role.
                                    // WhatsApp/Email inbound messages are shown only when the firm
                                    // has property management (they come from the Atrium inbox).
                                    // Internal client messages (legacy matter-scoped messages) are
                                    // shown only when the firm has legal practice.
                                    //
                                    // Each conversation gets a color-coded badge based on its type:
                                    //   🔧 → amber "Ticket" (maintenance)
                                    //   📋 → red   "Request" (client service request)
                                    //   ✅ → blue  "Replied" (admin's last reply)
                                    //   (default) → emerald "Portal"

                                    const hasAnyMessages =
                                        atriumInbound.length > 0 ||
                                        (portalConversations as any[]).length > 0 ||
                                        clientMessages.length > 0 ||
                                        teamConversationsForInbox.length > 0;

                                    // If filters have hidden everything but messages DO exist,
                                    // show a "no matches" state instead of the generic empty state.
                                    const hasFilteredMessages =
                                        atriumInbound.length > 0 ||
                                        filteredPortalConversations.length > 0 ||
                                        clientMessages.length > 0 ||
                                        teamConversationsForInbox.length > 0;

                                    if (!hasAnyMessages) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                                <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                </div>
                                                <p className="text-sm text-slate-400">No messages yet</p>
                                            </div>
                                        );
                                    }

                                    if (!hasFilteredMessages) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                                <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                                                    <svg className="w-6 h-6 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                                    </svg>
                                                </div>
                                                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">No conversations match your filters</p>
                                                <button
                                                    onClick={() => setTypeFilters({ request: true, ticket: true, replied: true, portal: true, team: true })}
                                                    className="mt-3 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                >
                                                    Show all
                                                </button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {/* ── Inbound WhatsApp/Email messages (Atrium/Komplete only) ── */}
                                            {hasPropertyFeatures && (atriumInbound as any[]).map((msg: any) => (
                                                <div
                                                    key={msg._id}
                                                    onClick={() => { setSelectedInboxId(msg._id); markInboundRead({ messageId: msg._id }); }}
                                                    className={`p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${selectedInboxId === msg._id ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            {!msg.isRead && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                                                            <span className={`text-sm truncate max-w-[160px] ${!msg.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-zinc-300'}`}>
                                                                {msg.senderName || msg.senderContact}
                                                            </span>
                                                        </div>
                                                        <span className="text-2xs text-slate-400 flex-shrink-0">
                                                            {msg.receivedAt ? new Date(msg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-2xs mb-1">
                                                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${CHANNEL_COLORS[msg.channel] || 'text-slate-500 bg-slate-100'}`}>
                                                            {CHANNEL_LABELS[msg.channel] || msg.channel}
                                                        </span>
                                                        {msg.unitId && <span className="text-slate-400">Unit</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                                                </div>
                                            ))}

                                            {/* ── Team direct messages (internal) ──────────────────────────
                                                Shown inline in the unified Conversations list with an indigo
                                                "Team" badge. Clicking opens the team chat thread in the right
                                                panel (same as the Team tab does). Online status is shown via
                                                a green dot on the avatar — the presence "moniker".
                                                Respects the 'team' type filter checkbox. */}
                                            {typeFilters.team && teamConversationsForInbox.map((tc: any) => {
                                                const convId = String(tc.conversationId);
                                                const isThisSelected = selectedInboxId === convId && selectedInboxType === 'team';
                                                const typeStyle = CONVERSATION_TYPE_STYLES.team;
                                                const activeTint = 'bg-indigo-50 dark:bg-indigo-900/20 border-l-indigo-500';
                                                return (
                                                    <div
                                                        key={convId}
                                                        onClick={() => {
                                                            setSelectedInboxId(convId);
                                                            setSelectedInboxType('team');
                                                            // Clear unread notifications for this conversation
                                                            const notifIds = (coreState.notifications || [])
                                                                .filter((n: any) => !n.isRead && n.userId === (currentUser?.id || currentUser?._id) &&
                                                                    n.link?.view === 'messaging' &&
                                                                    (n.link?.id === convId || n.link?.context?.activeConversationId === convId))
                                                                .map((n: any) => n.id);
                                                            if (notifIds.length > 0) handleMarkNotificationsRead(notifIds);
                                                        }}
                                                        className={`group relative p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${isThisSelected ? `border-l-2 ${activeTint}` : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {/* Avatar with online status dot (the "moniker") */}
                                                                <div className="relative flex-shrink-0">
                                                                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                                                                        {tc.otherMember?.name?.charAt(0)?.toUpperCase() || '?'}
                                                                    </div>
                                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${tc.isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-zinc-600'}`}></span>
                                                                </div>
                                                                <span className={`text-sm truncate max-w-[100px] ${tc.unreadCount > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-zinc-300'}`}>
                                                                    {tc.otherMember?.name || 'Team member'}
                                                                </span>
                                                                {/* Team badge on same line as name — slimmer profile */}
                                                                <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-2xs ${typeStyle.badge} flex-shrink-0`}>
                                                                    {typeStyle.label}
                                                                </span>
                                                                {tc.unreadCount > 1 && (
                                                                    <span className={`px-1.5 py-0.5 rounded-full text-white font-bold text-2xs ${typeStyle.dot} flex-shrink-0`}>
                                                                        {tc.unreadCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Timestamp — padded right so the hover delete button doesn't overlap it */}
                                                            <span className="text-2xs text-slate-400 flex-shrink-0 mr-7 leading-5">
                                                                {tc.lastMessageAt ? new Date(tc.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>
                                                        {/* Message preview — left-aligned with the text content (avatar width + gap) */}
                                                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 pl-9">
                                                            {tc.lastMessagePreview || 'No messages yet'}
                                                        </p>
                                                        {/* Delete conversation button — positioned at right edge, doesn't overlap timestamp (timestamp has mr-7) */}
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const ok = await confirm({
                                                                    title: 'Delete this conversation?',
                                                                    message: `Your conversation with ${tc.otherMember?.name || 'this team member'} will be permanently removed. All messages in it will be deleted.`,
                                                                    confirmLabel: 'Delete',
                                                                    cancelLabel: 'Cancel',
                                                                    danger: true,
                                                                });
                                                                if (!ok) return;
                                                                try {
                                                                    const convMessages = (messages as any[]).filter((m: any) =>
                                                                        (m.conversationId === tc.conversationId || m.conversationId === tc._id) && !m.isDeleted
                                                                    );
                                                                    const messageIds = convMessages.map((m: any) => m.id || m._id);
                                                                    await Promise.all(messageIds.map((mid: string) =>
                                                                        Promise.resolve(handleDeleteMessage(mid, true, currentUser?.id || currentUser?._id || '')).catch(() => {})
                                                                    ));
                                                                    await handleDeleteChat(tc.conversationId, true, currentUser?.id || currentUser?._id || '');
                                                                    if (selectedInboxId === convId) { setSelectedInboxId(null); setSelectedInboxType(null); }
                                                                    addToast('Conversation deleted.', { type: 'success', duration: 2500 });
                                                                } catch (err: any) {
                                                                    addToast(err?.message || 'Failed to delete conversation.', { type: 'error' });
                                                                }
                                                            }}
                                                            className="absolute top-1/2 right-1.5 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Delete conversation"
                                                            aria-label="Delete conversation"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}

                                            {/* ── ALL portal conversations (clients AND residents) ──
                                                Filtered by the type checkboxes in the inbox header. */}
                                            {filteredPortalConversations.map((conv: any) => {
                                                const convId = String(conv._id);
                                                const isSelected = selectedConvIds.has(convId);
                                                const convType = detectConversationType(conv);
                                                const typeStyle = CONVERSATION_TYPE_STYLES[convType];
                                                const roleLabel = getRoleLabel(conv);
                                                const isThisSelected = selectedInboxId === convId && selectedInboxType === 'conversation';
                                                // Active-row tint + left accent bar follow the conversation type
                                                const activeTint = convType === 'service_request'
                                                    ? 'bg-rose-50 dark:bg-rose-900/20 border-l-rose-500'
                                                    : convType === 'maintenance'
                                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-l-amber-500'
                                                    : convType === 'admin_reply'
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500'
                                                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-l-emerald-500';
                                                return (
                                                    <div
                                                        key={conv._id}
                                                        onClick={() => {
                                                            setSelectedInboxId(convId);
                                                            setSelectedInboxType('conversation');
                                                            if ((conv.unreadByAdmin || 0) > 0) markConvReadByAdmin({ conversationId: convId });
                                                        }}
                                                        className={`p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${isThisSelected ? `border-l-2 ${activeTint}` : ''} ${isSelected ? 'bg-rose-50 dark:bg-rose-900/10' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {/* Multi-select checkbox (only relevant in bulk-delete mode) */}
                                                                <button
                                                                    onClick={(e) => toggleConvSelection(convId, e)}
                                                                    className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                                                        isSelected
                                                                            ? 'bg-rose-600 border-rose-600'
                                                                            : 'border-slate-300 dark:border-zinc-600 hover:border-rose-500'
                                                                    }`}
                                                                    title={isSelected ? 'Deselect' : 'Select for bulk delete'}
                                                                >
                                                                    {isSelected && (
                                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                                {/* Unread dot — color matches the conversation type */}
                                                                {(conv.unreadByAdmin || 0) > 0
                                                                    ? <span className={`w-2 h-2 rounded-full ${typeStyle.dot} flex-shrink-0`} />
                                                                    : (conv.lastMessageBy === 'admin' && <CheckIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />)}
                                                                <span className={`text-sm truncate max-w-[140px] ${(conv.unreadByAdmin || 0) > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-zinc-300'}`}>
                                                                    {conv.participantName || 'Portal User'}
                                                                </span>
                                                            </div>
                                                            <span className="text-2xs text-slate-400 flex-shrink-0">
                                                                {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-2xs mb-1 flex-wrap">
                                                            {/* Primary type badge — color-coded by conversation kind */}
                                                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${typeStyle.badge}`}>
                                                                {typeStyle.label}
                                                            </span>
                                                            {/* Role chip — only show for unified firms where the
                                                                inbox mixes clients and residents. */}
                                                            {isUnified && (
                                                                <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${
                                                                    roleLabel === 'Client'
                                                                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                                                                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                                                                }`}>
                                                                    {roleLabel}
                                                                </span>
                                                            )}
                                                            {(conv.unreadByAdmin || 0) > 1 && (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-white font-bold ${typeStyle.dot}`}>
                                                                    {conv.unreadByAdmin}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{conv.lastMessagePreview}</p>
                                                    </div>
                                                );
                                            })}

                                            {/* ── Internal client messages (legacy matter-scoped messages, Vega only) ── */}
                                            {!isProperty && clientMessages
                                                .filter((m: any) => !m.isRead)
                                                .map((msg: any) => (
                                                    <div
                                                        key={msg.id}
                                                        onClick={() => { navigateTo('matterDetail', msg.matterId, { initialTab: 'messages' }); }}
                                                        className="p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">Client Message</span>
                                                            <span className="text-2xs text-slate-400 flex-shrink-0">{msg.timestamp ? timeAgo(msg.timestamp) : ''}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                                                    </div>
                                                ))}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Inbox Thread Detail — bounded to viewport, no spillover */}
                        <div className={`${selectedInboxId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0 overflow-hidden bg-slate-50 dark:bg-zinc-950`}>
                            {/* ── TEAM CHAT THREAD (rendered when a team conversation is selected from the unified inbox) ── */}
                            {selectedInboxType === 'team' && selectedInboxId && (() => {
                                const tc = teamConversationsForInbox.find((t: any) => String(t.conversationId) === String(selectedInboxId));
                                if (!tc) {
                                    // Check if team conversations are still loading.
                                    // coreState.chatConversations is hydrated in Phase B
                                    // (getFirmData). If it's empty AND we have a selected
                                    // conversation ID (e.g., from a notification deep-link),
                                    // show a loading spinner instead of the misleading
                                    // "Select a conversation" placeholder.
                                    const teamConvsLoading = !(coreState.chatConversations && coreState.chatConversations.length > 0) && !isDataLoaded;
                                    return (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 p-8 text-center">
                                            {teamConvsLoading ? (
                                                <>
                                                    <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                                                    <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Loading conversation…</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-slate-400">Conversation not found</p>
                                                    <p className="text-xs text-slate-400 mt-1">It may have been deleted</p>
                                                </>
                                            )}
                                        </div>
                                    );
                                }
                                const convMessages = (messages as any[]).filter(
                                    (m: any) => (m.conversationId === selectedInboxId || m.conversationId === tc._id) && !m.isDeleted
                                ).sort((a: any, b: any) => {
                                    const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
                                    const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
                                    return aTime - bTime; // ascending = oldest first, newest at bottom
                                });
                                return (
                                    <>
                                        {/* Team chat header — with online status + clear-all */}
                                        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900">
                                            <button onClick={() => { setSelectedInboxId(null); setSelectedInboxType(null); }} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full flex-shrink-0">
                                                <ChevronRightIcon className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className="flex-shrink-0">
                                                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                                                    {tc.otherMember?.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{tc.otherMember?.name || 'Unknown'}</p>
                                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                                    {tc.isOnline ? (
                                                        <><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span> Active now</>
                                                    ) : tc.otherMemberId ? (
                                                        <>{(() => {
                                                            const lastSeen = getPeerLastSeen(tc.otherMemberId);
                                                            if (lastSeen > 0) {
                                                                const diff = Date.now() - lastSeen;
                                                                const mins = Math.floor(diff / 60000);
                                                                if (mins < 1) return 'Last seen just now';
                                                                if (mins < 60) return `Last seen ${mins}m ago`;
                                                                const hours = Math.floor(mins / 60);
                                                                if (hours < 24) return `Last seen ${hours}h ago`;
                                                                return `Last seen ${new Date(lastSeen).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`;
                                                            }
                                                            return tc.otherMember?.role || '';
                                                        })()}</>
                                                    ) : (
                                                        <>{tc.otherMember?.role || ''}</>
                                                    )}
                                                </p>
                                            </div>
                                            {convMessages.length > 0 && (
                                                <button
                                                    onClick={async () => {
                                                        const ok = await confirm({
                                                            title: 'Clear all messages?',
                                                            message: `All ${convMessages.length} message(s) in this conversation will be permanently deleted. The conversation itself will remain.`,
                                                            confirmLabel: 'Clear all',
                                                            cancelLabel: 'Cancel',
                                                            danger: true,
                                                        });
                                                        if (!ok) return;
                                                        try {
                                                            const messageIds = convMessages.map((m: any) => m.id || m._id);
                                                            await Promise.all(messageIds.map((mid: string) =>
                                                                Promise.resolve(handleDeleteMessage(mid, true, currentUser?.id || currentUser?._id || '')).catch(() => {})
                                                            ));
                                                            addToast('All messages cleared.', { type: 'success', duration: 2500 });
                                                        } catch (err: any) {
                                                            addToast(err?.message || 'Failed to clear messages.', { type: 'error' });
                                                        }
                                                    }}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex-shrink-0"
                                                    title="Clear all messages in this conversation"
                                                    aria-label="Clear all messages"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Clear all</span>
                                                </button>
                                            )}
                                        </div>
                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                            {convMessages.length === 0 ? (
                                                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No messages yet. Start the conversation below.</div>
                                            ) : convMessages.map((msg: any) => {
                                                const isMe = msg.authorId === currentUser?.id || msg.authorId === currentUser?._id;
                                                const msgId = msg.id || msg._id;
                                                return (
                                                    <ChatMessageBubble
                                                        key={msgId}
                                                        content={msg.content}
                                                        timestamp={msg.timestamp || msg.createdAt}
                                                        isMe={isMe}
                                                        isEditing={editingMessageId === msgId}
                                                        onCancelEdit={() => setEditingMessageId(null)}
                                                        onStartEdit={() => setEditingMessageId(msgId)}
                                                        onEdit={async (newContent) => {
                                                            try {
                                                                await handleEditMessage(msgId, newContent);
                                                                setEditingMessageId(null);
                                                                addToast('Message updated.', { type: 'success', duration: 2500 });
                                                            } catch (err: any) {
                                                                addToast(err?.message || 'Failed to edit message.', { type: 'error' });
                                                            }
                                                        }}
                                                        onDelete={async () => {
                                                            const ok = await confirm({
                                                                title: 'Delete this message?',
                                                                message: 'This message will be permanently removed from the conversation.',
                                                                confirmLabel: 'Delete',
                                                                cancelLabel: 'Cancel',
                                                                danger: true,
                                                            });
                                                            if (!ok) return;
                                                            try {
                                                                await handleDeleteMessage(msgId, true, currentUser?.id || currentUser?._id || '');
                                                                addToast('Message deleted.', { type: 'success', duration: 2500 });
                                                            } catch (err: any) {
                                                                addToast(err?.message || 'Failed to delete message.', { type: 'error' });
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                            <div ref={teamChatEndRef} />
                                        </div>
                                        {/* Reply input — uses .chat-input-dock for correct bottom-nav spacing */}
                                        <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 chat-input-dock">
                                            {/* Hidden file input for attachments */}
                                            <input
                                                type="file"
                                                ref={teamFileInputRef}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    try {
                                                        const postUrl = await generateUploadUrl();
                                                        const res = await fetch(postUrl, { method: 'POST', body: file });
                                                        if (res.ok) {
                                                            const { storageId } = await res.json();
                                                            if (storageId) setTeamAttachments(prev => [...prev, { storageId, name: file.name }]);
                                                        }
                                                    } catch {}
                                                    if (teamFileInputRef.current) teamFileInputRef.current.value = '';
                                                }}
                                                multiple
                                                className="hidden"
                                            />
                                            {/* Pending attachment chips */}
                                            {teamAttachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {teamAttachments.map((att, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs max-w-full min-w-0">
                                                            <DocumentIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                            <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300 min-w-0">{att.name}</span>
                                                            <button onClick={() => setTeamAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-0.5 flex-shrink-0">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-end gap-2">
                                                <button
                                                    onClick={() => teamFileInputRef.current?.click()}
                                                    className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                                    title="Attach file"
                                                    aria-label="Attach file"
                                                >
                                                    <PaperClipIcon className="w-5 h-5" />
                                                </button>
                                                <AutoExpandingChatInput
                                                    value={teamReplyText}
                                                    onChange={setTeamReplyText}
                                                    onSend={async () => {
                                                        if (!teamReplyText.trim() && teamAttachments.length === 0) return;
                                                        const text = teamReplyText.trim();
                                                        const attachments = [...teamAttachments];
                                                        setTeamReplyText('');
                                                        setTeamAttachments([]);
                                                        try {
                                                            await sendChatMessageMutation({
                                                                conversationId: selectedInboxId,
                                                                content: text || '(file attachment)',
                                                                authorId: currentUser?._id || currentUser?.id || undefined,
                                                                authorName: currentUser?.name || undefined,
                                                                userEmail: currentUser?.email,
                                                            });
                                                            // Note: file attachments are uploaded to Convex storage but
                                                            // not yet linked to the message via the mutation. The
                                                            // sendChatMessage mutation would need to accept attachments
                                                            // as a parameter. For now, the file is stored and the
                                                            // storageId is available in teamAttachments — a future
                                                            // enhancement can pass these to the mutation.
                                                            void attachments;
                                                        } catch (err) { console.error('[Team chat] Reply failed:', err); }
                                                    }}
                                                    placeholder="Type a message..."
                                                    sendDisabled={!teamReplyText.trim() && teamAttachments.length === 0}
                                                    sendLabel="Send"
                                                    sendAriaLabel="Send team message"
                                                    containerClassName="flex-1"
                                                />
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            {/* ── PORTAL / INBOUND THREAD (original inbox detail) ── */}
                            {selectedInboxType !== 'team' && selectedInboundMsg ? (
                                <>
                                    {/* Thread Header — adaptive flex, no hardcoded heights */}
                                    <div className="flex-shrink-0 min-h-[3.5rem] py-2 px-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-2 bg-white dark:bg-zinc-800 z-20">
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <button onClick={() => setSelectedInboxId(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full flex-shrink-0">
                                                <ChevronRightIcon className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${getUserColor(selectedInboundMsg.senderName || 'U')}`}>
                                                {getInitials(selectedInboundMsg.senderName || 'U')}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{selectedInboundMsg.senderName || selectedInboundMsg.senderContact}</h3>
                                                <div className="flex items-center gap-1.5 text-2xs flex-wrap mt-0.5">
                                                    <span className={`px-1.5 py-0.5 rounded uppercase font-bold flex-shrink-0 ${CHANNEL_COLORS[selectedInboundMsg.channel]}`}>
                                                        {CHANNEL_LABELS[selectedInboundMsg.channel] || selectedInboundMsg.channel}
                                                    </span>
                                                    {selectedInboxType === 'conversation' && (() => {
                                                        const conv = (portalConversations as any[]).find((c: any) => String(c._id) === selectedInboxId);
                                                        if (!conv) return null;
                                                        const convType = detectConversationType(conv);
                                                        const typeStyle = CONVERSATION_TYPE_STYLES[convType];
                                                        return (
                                                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold flex-shrink-0 ${typeStyle.badge}`}>
                                                                {typeStyle.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className="text-slate-400 truncate min-w-0">{selectedInboundMsg.senderContact}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {selectedInboundMsg._inboxType === 'portal' && selectedInboundMsg.status === 'replied' && (
                                                <span className="hidden sm:flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-2xs font-bold rounded-lg">
                                                    <CheckIcon className="w-3 h-3" /> Replied
                                                </span>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    const ok = await confirm({
                                                        title: 'Delete this message?',
                                                        message: 'This message will be permanently removed from the inbox.',
                                                        confirmLabel: 'Delete',
                                                        cancelLabel: 'Cancel',
                                                        danger: true,
                                                    });
                                                    if (!ok) return;
                                                    if (selectedInboundMsg._inboxType === 'portal') {
                                                        await deleteInboundMessage({ messageId: selectedInboundMsg._id as any }).catch(() => {});
                                                    } else {
                                                        await deleteInboundMessage({ messageId: selectedInboundMsg._id as any });
                                                    }
                                                    setSelectedInboxId(null);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                                                title="Delete message"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message Content — Conversation View
                                        flex: 1 1 0% + min-h-0 forces Safari to bound
                                        the scroll container to viewport height. */}
                                    <div className="ticket-body-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                                        <div className="max-w-2xl mx-auto w-full box-border">
                                            {/* Conversation-based thread view */}
                                            {selectedInboundMsg._inboxType === 'conversation' ? (
                                                conversationMessages && conversationMessages.length > 0 ? (
                                                    // BUG FIX (Task 12): Filter out isDeleted messages — the
                                                    // adminDeletePortalMessage mutation marks them as isDeleted:true
                                                    // but getConversationMessages still returns them. Without
                                                    // this filter, deleted messages would stay visible forever.
                                                    conversationMessages.filter((msg: any) => !msg.isDeleted).map((msg: any) => {
                                                        const isAdmin = msg.senderRole === 'Admin';
                                                        // Find the linked ticket record for this message (if any)
                                                        const msgTicketId = msg.linkedTicketId || msg.linkedRequestId;
                                                        const msgTicketInfo = msgTicketId ? linkedTickets.find(t => t.id === String(msgTicketId)) : null;
                                                        const msgTicketRecord = msgTicketId ? linkedTicketRecords[String(msgTicketId)] : null;
                                                        const isReplyingToThis = msgTicketId && activeThreadTicketId === String(msgTicketId);
                                                        return (
                                                            <div key={msg._id} className={`group flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-3 w-full`}>
                                                                <div
                                                                    data-ticket-id={msgTicketId ? String(msgTicketId) : undefined}
                                                                    className={`relative max-w-[85%] sm:max-w-[70%] transition-all rounded-2xl px-3.5 py-2.5 min-w-0 box-border ${isAdmin
                                                                    ? 'bg-primary-600 text-white rounded-tr-sm shadow-sm'
                                                                    : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-tl-sm shadow-sm'
                                                                }`}>
                                                                    {/* Ticket badge — only show if this message originated a ticket */}
                                                                    {(msg.linkedTicketId || msg.linkedRequestId) && (
                                                                        <div className="mb-1.5">
                                                                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-2xs font-bold ${msg.linkedTicketId ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                                                                {msg.linkedTicketId ? '🔧' : '📋'} {msg.requestTypeLabel || (msg.linkedTicketId ? 'Ticket' : 'Request')}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* Message content */}
                                                                    <MessageContent content={msg.content || ''} isAdmin={isAdmin} />

                                                                    {/* Attachments */}
                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                                            {msg.attachments.map((storageId: string, idx: number) => {
                                                                                const fileName = msg.attachmentNames?.[idx] || `File ${idx + 1}`;
                                                                                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                                                                                const convexFileUrl = `${import.meta.env.VITE_CONVEX_URL || ''}/api/storage/${storageId}`;
                                                                                if (isImage) {
                                                                                    return (
                                                                                        <a key={storageId + idx} href={convexFileUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                                                                                            <img src={convexFileUrl} alt={fileName} className="w-full h-24 object-cover" />
                                                                                        </a>
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <a key={storageId + idx} href={convexFileUrl} target="_blank" rel="noopener noreferrer" className={`rounded-lg flex items-center gap-2 px-2.5 py-1.5 ${isAdmin ? 'bg-primary-500/30' : 'bg-slate-100 dark:bg-zinc-700'} hover:opacity-80 transition-opacity`}>
                                                                                        <DocumentIcon className={`w-4 h-4 flex-shrink-0 ${isAdmin ? 'text-primary-200' : 'text-slate-500'}`} />
                                                                                        <span className={`text-xs truncate flex-1 ${isAdmin ? 'text-primary-100' : 'text-slate-600 dark:text-zinc-300'}`}>{fileName}</span>
                                                                                    </a>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}

                                                                    {/* Ticket controls — simplified to a single dropdown + assign */}
                                                                    {msgTicketInfo && msgTicketRecord && (
                                                                        <div className={`mt-2.5 pt-2 border-t ${isAdmin ? 'border-primary-500/40' : 'border-slate-200 dark:border-zinc-700'}`}>
                                                                            {msgTicketRecord.status !== 'cancelled' ? (
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    {/* Status dropdown — one clean control instead of 4 pills */}
                                                                                    <select
                                                                                        value={msgTicketRecord.status}
                                                                                        onChange={(e) => handleAdvanceTicket(msgTicketInfo, e.target.value as any)}
                                                                                        className={`text-2xs font-bold px-2 py-1 rounded-lg border cursor-pointer ${isAdmin ? 'bg-primary-500/30 text-primary-100 border-primary-400' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-600'} focus:ring-1 focus:ring-primary-500/30`}
                                                                                    >
                                                                                        <option value="open">🟡 Received</option>
                                                                                        <option value="in_progress">🔵 In Progress</option>
                                                                                        <option value="resolved">🟢 Addressed</option>
                                                                                        <option value="closed">⚪ Closed</option>
                                                                                    </select>
                                                                                    {/* Assign dropdown */}
                                                                                    <select
                                                                                        value={msgTicketRecord.assignedTo || ''}
                                                                                        onChange={(e) => {
                                                                                            const user = coreState.users?.find((u: any) => u.id === e.target.value);
                                                                                            if (user) handleAssignTicket(msgTicketInfo, user.id, user.name || 'Team Member');
                                                                                        }}
                                                                                        className={`text-2xs font-bold px-2 py-1 rounded-lg border cursor-pointer ${isAdmin ? 'bg-primary-500/30 text-primary-100 border-primary-400' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-600'} focus:ring-1 focus:ring-primary-500/30`}
                                                                                    >
                                                                                        <option value="">{msgTicketRecord.assignedTo ? '↻ Reassign' : '👤 Assign…'}</option>
                                                                                        {coreState.users
                                                                                            ?.filter((u: any) => ['Admin', 'Lawyer', 'Paralegal', 'ExternalCounsel'].includes(u.role))
                                                                                            .map((u: any) => (
                                                                                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                                                                            ))
                                                                                        }
                                                                                    </select>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                                                                    ✕ Cancelled
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Threaded replies — cleaner, more readable */}
                                                                    {msgTicketId && conversationMessages && (() => {
                                                                        const threadReplies = (conversationMessages as any[]).filter(
                                                                            (m: any) => !m.isDeleted && m.threadTicketId === String(msgTicketId) && String(m._id) !== String(msg._id)
                                                                        );
                                                                        if (threadReplies.length === 0) return null;
                                                                        return (
                                                                            <div className={`mt-2 ml-1 pl-2.5 border-l-2 ${isAdmin ? 'border-primary-300/50' : 'border-slate-300 dark:border-zinc-600'} space-y-1`}>
                                                                                {threadReplies.map((reply: any) => {
                                                                                    const replyIsAdmin = reply.senderRole === 'Admin';
                                                                                    return (
                                                                                        <div key={String(reply._id)} className={`text-2xs leading-relaxed ${replyIsAdmin ? 'text-primary-100' : 'text-slate-600 dark:text-zinc-400'}`}>
                                                                                            <span className="font-bold">{replyIsAdmin ? 'You' : (reply.senderName || 'User')}:</span> {reply.content?.substring(0, 280)}
                                                                                            {reply.content && reply.content.length > 280 && '...'}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* INLINE REPLY COMPOSER — appears when "Reply to this ticket" is clicked */}
                                                                    {isReplyingToThis && msgTicketRecord && msgTicketRecord.status !== 'cancelled' && selectedInboxId && (
                                                                        <InlineTicketReply
                                                                            ticketId={String(msgTicketId)}
                                                                            conversationId={selectedInboxId}
                                                                            firmId={firmId}
                                                                            adminId={currentUser?.id || ''}
                                                                            adminName={currentUser?.name || 'Admin'}
                                                                            sendAdminReply={sendAdminReply}
                                                                            addToast={addToast}
                                                                            onSent={() => {}}
                                                                            onCancel={() => setActiveThreadTicketId(null)}
                                                                        />
                                                                    )}

                                                                    {/* Reply button + timestamp — bottom row */}
                                                                    <div className="flex items-center justify-between gap-2 mt-1.5">
                                                                        {msgTicketInfo && msgTicketRecord && msgTicketRecord.status !== 'cancelled' ? (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const ticketId = String(msgTicketId);
                                                                                    setActiveThreadTicketId(prev => prev === ticketId ? null : ticketId);
                                                                                }}
                                                                                className={`text-2xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                                                                                    isReplyingToThis
                                                                                        ? 'bg-emerald-500 text-white'
                                                                                        : isAdmin
                                                                                        ? 'bg-primary-500/30 text-primary-100 hover:bg-primary-500/50'
                                                                                        : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-600'
                                                                                }`}
                                                                            >
                                                                                {isReplyingToThis ? '✕ Cancel' : '↩ Reply'}
                                                                            </button>
                                                                        ) : <span />}
                                                                        <span className={`text-3xs flex-shrink-0 ${isAdmin ? 'text-primary-200' : 'text-slate-400'}`}>
                                                                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                                            {isAdmin && (msg.isRead ? ' · ✓✓' : ' · ✓')}
                                                                        </span>
                                                                    </div>

                                                                    {/* Delete button — hover only */}
                                                                    <button
                                                                        onClick={async () => {
                                                                            const ok = await confirm({
                                                                                title: 'Delete this message?',
                                                                                message: 'The message will be removed from this conversation. A record will be retained for compliance.',
                                                                                confirmLabel: 'Delete',
                                                                                cancelLabel: 'Cancel',
                                                                                danger: true,
                                                                            });
                                                                            if (!ok) return;
                                                                            try {
                                                                                await adminDeletePortalMsg({
                                                                                    messageId: String(msg._id),
                                                                                    adminId: currentUser.id,
                                                                                    firmId: currentUser.firmId || '',
                                                                                });
                                                                                addToast('Message deleted.', { type: 'success', duration: 2500 });
                                                                            } catch (err: any) {
                                                                                addToast(err.message || 'Failed to delete message.', { type: 'error' });
                                                                            }
                                                                        }}
                                                                        className={`absolute -top-1.5 ${isAdmin ? '-left-1.5' : '-right-1.5'} w-5 h-5 bg-slate-200 dark:bg-zinc-700 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-500 hover:text-rose-500 rounded-full flex items-center justify-center transition-all shadow-sm opacity-0 group-hover:opacity-100`}
                                                                        title="Delete message"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                                        <p className="text-sm text-slate-400">No messages in this conversation yet.</p>
                                                    </div>
                                                )
                                            ) : (
                                                <>
                                                    {/* Legacy single-message view (inbound WhatsApp/Email or legacy portal message) */}
                                                    <div className="flex justify-start mb-4">
                                                        <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm max-w-[85%]">
                                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-zinc-700">
                                                                <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest">{selectedInboundMsg.senderName || 'Sender'}</span>
                                                                <span className="text-2xs text-slate-400">{selectedInboundMsg.receivedAt ? new Date(selectedInboundMsg.receivedAt).toLocaleString() : ''}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedInboundMsg.content}</p>
                                                            {selectedInboundMsg.mediaUrl && (
                                                                <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700">
                                                                    <img src={selectedInboundMsg.mediaUrl} alt="Attachment" className="w-full h-auto max-h-64 object-cover" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Admin reply bubble (for legacy portal messages that have been replied to) */}
                                                    {selectedInboundMsg._inboxType === 'portal' && selectedInboundMsg.replyContent && (
                                                        <div className="flex justify-end mb-4">
                                                            <div className="bg-primary-600 text-white rounded-2xl rounded-tr-none px-5 py-4 shadow-sm max-w-[85%]">
                                                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-primary-500">
                                                                    <span className="text-2xs font-bold text-primary-200 uppercase tracking-widest">You</span>
                                                                    <span className="text-2xs text-primary-200">{selectedInboundMsg.repliedAt ? new Date(selectedInboundMsg.repliedAt).toLocaleString() : ''}</span>
                                                                </div>
                                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedInboundMsg.replyContent}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* AI Suggested Reply (only for inbound messages with AI analysis) */}
                                            {selectedInboundMsg._inboxType === 'inbound' && selectedInboundMsg.aiAnalysis?.suggestedReply && (
                                                <div className="mx-2 md:mx-8 mb-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-200 dark:border-primary-800 p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                                                        <span className="text-2xs font-bold uppercase tracking-widest text-primary-500">Suggested Reply</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 italic">"{selectedInboundMsg.aiAnalysis.suggestedReply}"</p>
                                                    <button
                                                        onClick={() => setInboxReply(selectedInboundMsg.aiAnalysis!.suggestedReply!)}
                                                        className="px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded-xl transition-colors"
                                                    >
                                                        Use Reply
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* The separate "Ticket Status Bars" section has been REMOVED.
                                        Ticket controls (status pills + assign dropdown) are now
                                        embedded INLINE within each message bubble that originated
                                        a ticket/request. This eliminates the split-view redundancy
                                        and makes the conversation a unified timeline. */}

                                    {/* Reply Input — sticky bottom action tray, card-based
                                        Uses .chat-input-dock for correct bottom-nav spacing. */}
                                    <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 chat-input-dock">
                                        <div className="max-w-2xl mx-auto w-full box-border">
                                            {/* Pending file attachments for admin reply */}
                                            {adminAttachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {adminAttachments.map((att, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs max-w-full min-w-0">
                                                            <DocumentIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                            <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300 min-w-0">{att.name}</span>
                                                            <button onClick={() => setAdminAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-0.5 flex-shrink-0">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-end gap-2 w-full box-border">
                                                {selectedInboundMsg._inboxType === 'conversation' && (
                                                    <>
                                                        {/* Thread reply banner — shows when the admin has activated
                                                            a ticket thread reply via the inline composer above.
                                                            The bottom composer is for GENERAL conversation replies,
                                                            not ticket-specific replies. This banner makes it clear. */}
                                                        {activeThreadTicketId && (
                                                            <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-lg w-full box-border">
                                                                <span className="text-2xs font-bold text-emerald-700 dark:text-emerald-400 min-w-0 truncate">
                                                                    ↩ Replying to ticket thread — use the inline composer above
                                                                </span>
                                                                <button
                                                                    onClick={() => setActiveThreadTicketId(null)}
                                                                    className="text-2xs font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 flex-shrink-0"
                                                                >
                                                                    ✕ Clear
                                                                </button>
                                                            </div>
                                                        )}
                                                        <input
                                                            type="file"
                                                            ref={adminFileInputRef}
                                                            onChange={async (e) => {
                                                                const files = Array.from(e.target.files || []);
                                                                for (const file of files) {
                                                                    if (file.size > 10 * 1024 * 1024) continue;
                                                                    try {
                                                                        const postUrl = await generateUploadUrl();
                                                                        const res = await fetch(postUrl, { method: 'POST', body: file });
                                                                        if (res.ok) {
                                                                            const { storageId } = await res.json();
                                                                            if (storageId) setAdminAttachments(prev => [...prev, { storageId, name: file.name }]);
                                                                        }
                                                                    } catch {}
                                                                }
                                                                if (adminFileInputRef.current) adminFileInputRef.current.value = '';
                                                            }}
                                                            multiple
                                                            className="hidden"
                                                        />
                                                        <button
                                                            onClick={() => adminFileInputRef.current?.click()}
                                                            className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors flex-shrink-0"
                                                            title="Attach file"
                                                        >
                                                            <PaperClipIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                                <AutoExpandingChatInput
                                                    value={inboxReply}
                                                    onChange={setInboxReply}
                                                    onSend={handleInboxReply}
                                                    placeholder={selectedInboundMsg._inboxType === 'conversation'
                                                        ? (activeThreadTicketId ? 'General conversation reply... (ticket reply is above)' : 'Reply in conversation...')
                                                        : selectedInboundMsg._inboxType === 'portal'
                                                        ? 'Reply to portal user...'
                                                        : `Reply via ${selectedInboundMsg.channel || 'message'}...`}
                                                    sendDisabled={(!inboxReply.trim() && adminAttachments.length === 0) || isSendingReply}
                                                    sendIcon={<SendIcon />}
                                                    sendAriaLabel="Send reply"
                                                    containerClassName="flex-1 min-w-0"
                                                    textareaClassName="text-base px-4 py-3"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : selectedInboxType !== 'team' && !selectedInboundMsg && !selectedInboxId ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 p-8 text-center">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </div>
                                    <p className="text-base font-medium text-slate-500 dark:text-zinc-400">
                                        {isUnified ? 'Select a conversation to respond' : 'Select a conversation to view'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {isProperty ? 'WhatsApp, email, and portal messages from residents' : 'Messages from your clients on matters'}
                                    </p>
                                </div>
                            ) : selectedInboxType !== 'team' && !selectedInboundMsg && selectedInboxId ? (
                                /* ─── LOADING STATE ──────────────────────────────────────
                                   When a conversation is selected (selectedInboxId is set)
                                   but the message data hasn't arrived yet (selectedInboundMsg
                                   is still undefined because portalConversations / atriumInbound
                                   / portalMessages queries are in flight), show a loading
                                   spinner instead of a blank pane.

                                   Previously this fell through to `null` (blank screen), and the
                                   user had to leave and come back to see the conversation. Now
                                   we show a spinner that automatically disappears once the data
                                   arrives and selectedInboundMsg resolves. */
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 p-8 text-center">
                                    <div className="w-10 h-10 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin mb-4"></div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                                        Loading conversation…
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Fetching messages from the server
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        {/* Compose Modal (for inbox/portal messages) — rendered outside tab blocks */}
                    </div>
                )}

                {/* ═══ TEAM TAB ═══ — split-view layout matching Conversations */}
                {activeTab === 'team' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left sidebar: team conversations list (~33%) */}
                        <div className="w-full md:w-2/5 lg:w-1/3 border-r border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Team Messages</h3>
                                <button
                                    onClick={() => setShowTeamMessage(true)}
                                    className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-bold"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {(coreState.chatConversations || []).filter((c: any) =>
                                    c.type === 'direct' &&
                                    c.memberIds?.includes(currentUser?.id || '')
                                ).length === 0 &&
                                (coreState.chatConversations || []).filter((c: any) =>
                                    c.type === 'direct' &&
                                    c.memberIds?.includes(currentUser?._id || '')
                                ).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                                        <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center mb-4">
                                            <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        </div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No team messages yet</h3>
                                        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">Send a direct message to a team member.</p>
                                        <button
                                            onClick={() => setShowTeamMessage(true)}
                                            className="px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors"
                                        >
                                            New Message
                                        </button>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                                        {(coreState.chatConversations || [])
                                            .filter((c: any) =>
                                                c.type === 'direct' &&
                                                (c.memberIds?.includes(currentUser?.id || '') ||
                                                 c.memberIds?.includes(currentUser?._id || ''))
                                            )
                                            .map((conv: any) => {
                                                const otherMemberId = (conv.memberIds || []).find((id: string) => id !== currentUser?.id && id !== currentUser?._id);
                                                const otherMember = (coreState.users || []).find((u: any) => u.id === otherMemberId || u._id === otherMemberId);
                                                const otherIsOnline = isPeerOnline(otherMemberId);
                                                const convMessages = messages.filter(
                                                    (m: any) => (m.conversationId === conv.id || m.conversationId === conv._id) && !m.isDeleted
                                                );
                                                // messages array is DESC (newest first), so [0] is the latest
                                                const lastMsg = convMessages[0];

                                                return (
                                                    <div
                                                        key={conv.id}
                                                        onClick={() => setSelectedId(conv.id)}
                                                        className={`group relative w-full flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors text-left cursor-pointer ${selectedId === conv.id ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}
                                                    >
                                                        <div className="relative flex-shrink-0">
                                                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold text-sm">
                                                                {otherMember?.name?.charAt(0)?.toUpperCase() || '?'}
                                                            </div>
                                                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${otherIsOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-zinc-600'}`}></span>
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-7">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                                    {otherMember?.name || 'Unknown'}
                                                                </p>
                                                                {lastMsg && (
                                                                    <span className="text-2xs text-slate-400 flex-shrink-0 leading-5">
                                                                        {new Date(lastMsg.timestamp || lastMsg.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                                                                {lastMsg?.content || 'No messages yet'}
                                                            </p>
                                                        </div>
                                                        {/* Delete conversation button — appears on hover (desktop) or always (touch).
                                                            Positioned at the absolute right edge. The timestamp has mr-7 so it
                                                            doesn't overlap this button. */}
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const ok = await confirm({
                                                                    title: 'Delete this conversation?',
                                                                    message: `Your conversation with ${otherMember?.name || 'this team member'} will be permanently removed. All messages in it will be deleted.`,
                                                                    confirmLabel: 'Delete',
                                                                    cancelLabel: 'Cancel',
                                                                    danger: true,
                                                                });
                                                                if (!ok) return;
                                                                try {
                                                                    // Delete all messages in the conversation first
                                                                    const messageIds = convMessages.map((m: any) => m.id || m._id);
                                                                    await Promise.all(messageIds.map((mid: string) =>
                                                                        Promise.resolve(handleDeleteMessage(mid, true, currentUser?.id || currentUser?._id || '')).catch(() => {})
                                                                    ));
                                                                    // Then delete the conversation itself
                                                                    await handleDeleteChat(conv.id || conv._id, true, currentUser?.id || currentUser?._id || '');
                                                                    if (selectedId === conv.id || selectedId === conv._id) setSelectedId(null);
                                                                    addToast('Conversation deleted.', { type: 'success', duration: 2500 });
                                                                } catch (err: any) {
                                                                    addToast(err?.message || 'Failed to delete conversation.', { type: 'error' });
                                                                }
                                                            }}
                                                            className="absolute top-1/2 right-2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Delete conversation"
                                                            aria-label="Delete conversation"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right panel: active chat thread (~67%) */}
                        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
                            {selectedId && (() => {
                                const conv = (coreState.chatConversations || []).find((c: any) => c.id === selectedId || c._id === selectedId);
                                if (!conv) return (
                                    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                                        Select a conversation
                                    </div>
                                );
                                const otherMemberId = (conv.memberIds || []).find((id: string) => id !== currentUser?.id && id !== currentUser?._id);
                                const otherMember = (coreState.users || []).find((u: any) => u.id === otherMemberId || u._id === otherMemberId);
                                const otherIsOnline = activePeers?.includes(otherMemberId);
                                const convMessages = messages.filter(
                                    (m: any) => (m.conversationId === selectedId || m.conversationId === conv._id) && !m.isDeleted
                                ).sort((a: any, b: any) => {
                                    const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
                                    const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
                                    return aTime - bTime; // ascending = oldest first, newest at bottom
                                });

                                const sendTeamReply = async () => {
                                    if (!teamReplyText.trim()) return;
                                    const text = teamReplyText.trim();
                                    setTeamReplyText('');
                                    try {
                                        // Server-side mutation: atomically creates the
                                        // chat message AND notifications for all other
                                        // conversation members. Replaces the old client-side
                                        // addItem('chatMessages') call that forgot to create
                                        // notifications — fixing the "notifications stopped
                                        // working" bug where recipients never got a bell badge.
                                        await sendChatMessageMutation({
                                            conversationId: selectedId,
                                            content: text,
                                            authorId: currentUser?._id || currentUser?.id || undefined,
                                            authorName: currentUser?.name || undefined,
                                            userEmail: currentUser?.email,
                                        });
                                    } catch (err) { console.error('[Team chat] Reply failed:', err); }
                                };

                                return (
                                    <>
                                        {/* Chat header */}
                                        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold text-sm">
                                                    {otherMember?.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{otherMember?.name || 'Unknown'}</p>
                                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                                    {otherIsOnline ? (
                                                        <><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span> Active now</>
                                                    ) : (
                                                        <>{otherMember?.role || ''}</>
                                                    )}
                                                </p>
                                            </div>
                                            {/* Clear conversation button — bulk-deletes all messages in this conversation */}
                                            {convMessages.length > 0 && (
                                                <button
                                                    onClick={async () => {
                                                        const ok = await confirm({
                                                            title: 'Clear all messages?',
                                                            message: `All ${convMessages.length} message(s) in this conversation will be permanently deleted. The conversation itself will remain.`,
                                                            confirmLabel: 'Clear all',
                                                            cancelLabel: 'Cancel',
                                                            danger: true,
                                                        });
                                                        if (!ok) return;
                                                        try {
                                                            const messageIds = convMessages.map((m: any) => m.id || m._id);
                                                            await Promise.all(messageIds.map((mid: string) =>
                                                                Promise.resolve(handleDeleteMessage(mid, true, currentUser?.id || currentUser?._id || '')).catch(() => {})
                                                            ));
                                                            addToast('All messages cleared.', { type: 'success', duration: 2500 });
                                                        } catch (err: any) {
                                                            addToast(err?.message || 'Failed to clear messages.', { type: 'error' });
                                                        }
                                                    }}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-2xs font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex-shrink-0"
                                                    title="Clear all messages in this conversation"
                                                    aria-label="Clear all messages"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Clear all</span>
                                                </button>
                                            )}
                                        </div>
                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                            {convMessages.length === 0 ? (
                                                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No messages yet. Start the conversation below.</div>
                                            ) : convMessages.map((msg: any) => {
                                                const isMe = msg.authorId === currentUser?.id || msg.authorId === currentUser?._id;
                                                const msgId = msg.id || msg._id;
                                                return (
                                                    <ChatMessageBubble
                                                        key={msgId}
                                                        content={msg.content}
                                                        timestamp={msg.timestamp || msg.createdAt}
                                                        isMe={isMe}
                                                        isEditing={editingMessageId === msgId}
                                                        onCancelEdit={() => setEditingMessageId(null)}
                                                        onStartEdit={() => setEditingMessageId(msgId)}
                                                        onEdit={async (newContent) => {
                                                            try {
                                                                await handleEditMessage(msgId, newContent);
                                                                setEditingMessageId(null);
                                                                addToast('Message updated.', { type: 'success', duration: 2500 });
                                                            } catch (err: any) {
                                                                addToast(err?.message || 'Failed to edit message.', { type: 'error' });
                                                            }
                                                        }}
                                                        onDelete={async () => {
                                                            const ok = await confirm({
                                                                title: 'Delete this message?',
                                                                message: 'This message will be permanently removed from the conversation.',
                                                                confirmLabel: 'Delete',
                                                                cancelLabel: 'Cancel',
                                                                danger: true,
                                                            });
                                                            if (!ok) return;
                                                            try {
                                                                await handleDeleteMessage(msgId, true, currentUser?.id || currentUser?._id || '');
                                                                addToast('Message deleted.', { type: 'success', duration: 2500 });
                                                            } catch (err: any) {
                                                                addToast(err?.message || 'Failed to delete message.', { type: 'error' });
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                            <div ref={teamChatEndRef} />
                                        </div>
                                        {/* Reply input — uses .chat-input-dock for correct bottom-nav spacing */}
                                        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 chat-input-dock">
                                            <input
                                                type="file"
                                                ref={teamFileInputRef}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    try {
                                                        const postUrl = await generateUploadUrl();
                                                        const res = await fetch(postUrl, { method: 'POST', body: file });
                                                        if (res.ok) {
                                                            const { storageId } = await res.json();
                                                            if (storageId) setTeamAttachments(prev => [...prev, { storageId, name: file.name }]);
                                                        }
                                                    } catch {}
                                                    if (teamFileInputRef.current) teamFileInputRef.current.value = '';
                                                }}
                                                multiple
                                                className="hidden"
                                            />
                                            {teamAttachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {teamAttachments.map((att, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs max-w-full min-w-0">
                                                            <DocumentIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                            <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300 min-w-0">{att.name}</span>
                                                            <button onClick={() => setTeamAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-0.5 flex-shrink-0">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex items-end gap-2">
                                                <button
                                                    onClick={() => teamFileInputRef.current?.click()}
                                                    className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                                    title="Attach file"
                                                    aria-label="Attach file"
                                                >
                                                    <PaperClipIcon className="w-5 h-5" />
                                                </button>
                                                <AutoExpandingChatInput
                                                    value={teamReplyText}
                                                    onChange={setTeamReplyText}
                                                    onSend={sendTeamReply}
                                                    placeholder="Type a message..."
                                                    sendDisabled={!teamReplyText.trim() && teamAttachments.length === 0}
                                                    sendLabel="Send"
                                                    sendAriaLabel="Send team message"
                                                    containerClassName="flex-1"
                                                />
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            {!selectedId && (
                                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                                    Select a conversation to view messages
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ NOTICE BOARD TAB ═══ — available for ALL firms */}
                {activeTab === 'notices' && (
                    <NoticeBoardTab firmId={firmId} allNotices={allNotices} />
                )}

                {/* ═══ SCHEDULED TAB ═══ */}
                {activeTab === 'scheduled' && (
                    <ScheduledTab firmId={firmId} />
                )}

                {/* ═══ COMMUNICATIONS TAB ═══ */}
                {/* WhatsApp & Email tab content removed — merged into
                    All Conversations. The AtriumInbox (audit trail, scheduled
                    messages, etc.) is still accessible via the Scheduled tab
                    and the Conversations inbox now shows inbound WhatsApp/Email
                    messages inline. */}
            </div>

            {/* Modals — rendered OUTSIDE tab blocks so they work on any tab */}
            {showCompose && firmId && (
                <ComposeModal
                    firmId={firmId}
                    prefill={composePrefill}
                    onClose={() => { setShowCompose(false); setComposePrefill(undefined); }}
                    onToast={(msg) => addToast(msg, { type: msg.includes('Error') || msg.includes('Failed') ? 'error' : 'success' })}
                />
            )}
            {showTeamMessage && (
                <TeamMessageModal onClose={() => setShowTeamMessage(false)} />
            )}

            {ConfirmDialog}
        </div>
    );
};

export default MessagesView;
