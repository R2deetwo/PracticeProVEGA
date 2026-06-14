
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatConversation, ChatMessage, User, ModalType, View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useMatterState } from '../contexts/MatterContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { PaperClipIcon, SendIcon, TrashIcon, DocumentIcon, ChevronRightIcon, ClockIcon, CheckIcon, DownloadIcon, PlusIcon, BellIcon, SparklesIcon } from '../constants';
import { getUserColor, getInitials, timeAgo } from '../utils/colorUtils';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { parseAloaMarkdown } from '../utils/markdownUtils';
import { useProduct } from '../contexts/ProductContext';
import { ComposeModal, ComposeModalPrefill } from './atrium/ComposeModal';

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
type MessagingTab = 'inbox' | 'team' | 'scheduled';

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

const MSG_TYPE_LABELS: Record<string, string> = {
    custom: 'Custom',
    rent_reminder: 'Rent Reminder',
    late_notice: 'Late Notice',
    payment_receipt: 'Payment Receipt',
    service_charge_alert: 'Service Charge',
    access_restriction: 'Access Restriction',
    penalty_notice: 'Penalty Notice',
    lease_renewal: 'Lease Renewal',
    welcome_note: 'Welcome Note',
    promotion: 'Promotion',
    vendor_update: 'Vendor Update',
    general_announcement: 'Announcement',
    maintenance_update: 'Maintenance',
};

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
            <div ref={scrollContainerRef} onScroll={handleScroll} onClick={handleTaskClick} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar scroll-smooth">
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
                                    <span className="text-xs text-slate-400 dark:text-zinc-600 italic px-4 py-2">Message deleted</span>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 group relative ${showAvatar ? 'mt-3' : ''}`}>
                                {!isMe && showAvatar && (
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 mr-2 mt-1 ${getUserColor(author?.name || 'U')}`}>
                                        {getInitials(author?.name || 'U')}
                                    </div>
                                )}
                                {!isMe && !showAvatar && <div className="w-7 mr-2 flex-shrink-0" />}
                                <div className="flex flex-col max-w-[75%] relative">
                                    {showAvatar && !isMe && (
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-0.5 px-1">{author?.name || 'Unknown'}</span>
                                    )}
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                        isMe
                                            ? 'bg-primary-600 text-white rounded-tr-sm'
                                            : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                                    } ${isFailed ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}>
                                        {msg.content?.startsWith('[FILE:') ? (
                                            <div className="flex items-center gap-2">
                                                <DocumentIcon className="w-4 h-4" />
                                                <span>File attachment</span>
                                            </div>
                                        ) : (
                                            <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                                        )}
                                    </div>
                                    <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-[9px] text-slate-400">{msg.timestamp ? timeAgo(msg.timestamp) : ''}</span>
                                        {isFailed && (
                                            <button onClick={() => onRetry(msg.id)} className="text-[9px] text-red-500 hover:text-red-700 font-bold ml-1">
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

            {/* Input */}
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3">
                <div className="max-w-3xl mx-auto flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                            style={{ minHeight: '44px' }}
                        />
                    </div>
                    <div className="flex gap-1 items-center pb-1 pr-1 flex-shrink-0">
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className={`p-2.5 rounded-xl transition-all shadow-sm text-white transform active:scale-95 ${!newMessage.trim() ? 'bg-slate-300 dark:bg-zinc-700 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}
                        >
                            <SendIcon />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// Unified MessagesView — 3-tab hub: Inbox / Team Chat / Scheduled
// ══════════════════════════════════════════════════════════════════════════
const MessagesView: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { matterState } = useMatterState();
    const { currentUser } = useAuth();
    const { retryMessage, handleMarkNotificationsRead, handleSendMessage, handleEditMessage, handleDeleteMessage, handleDeleteChat } = useDataActions();
    const { openModal, closeModal, navigateTo, currentHistoryEntry, addToast } = useUI();
    const { isProperty, isLegal } = useProduct();

    if (!currentUser) return null;

    const conversations = coreState.chatConversations || [];
    const messages = coreState.chatMessages || [];
    const users = coreState.users || [];
    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const activeConversationId = currentHistoryEntry.context?.activeConversationId;
    const onNavigate = (view: any, id: any, context: any) => navigateTo(view, id, context);

    // ── Tab state — respect initialTab from navigation context (e.g. notification click) ──
    const [activeTab, setActiveTab] = useState<MessagingTab>(() => {
        const hint = currentHistoryEntry.context?.initialTab;
        if (hint === 'inbox') return 'inbox';
        if (hint === 'team') return 'team';
        if (hint === 'scheduled') return 'scheduled';
        return 'inbox';
    });

    // Also switch tabs when navigating from notifications while already on messaging view
    useEffect(() => {
        const hint = currentHistoryEntry.context?.initialTab;
        if (hint === 'inbox' || hint === 'team' || hint === 'scheduled') {
            setActiveTab(hint as MessagingTab);
        }
        // If navigating to inbox with a specific inbound message ID, select it
        if (hint === 'inbox' && currentHistoryEntry.context?.selectedInboxId) {
            setSelectedInboxId(currentHistoryEntry.context.selectedInboxId);
        }
    }, [currentHistoryEntry.context?.initialTab, currentHistoryEntry.context?.selectedInboxId]);

    // ── Team Chat state (existing logic) ──
    const [selectedId, setSelectedId] = useState<string | null>(activeConversationId || null);
    const [searchQuery, setSearchQuery] = useState('');
    const myFeedback = useQuery(api.feedback.getMyFeedbackReplies, { userId: currentUser?.id || '' }) || [];

    // ── Inbox data — Atrium (property) or Vega (legal) ──
    // Atrium: inbound WhatsApp/Email messages from tenants
    const atriumInbound = useQuery(api.sentry.getInboundMessages, firmId ? { firmId } : 'skip') || [];
    // Atrium: portal messages from tenants
    const portalMessages = useQuery(api.portals.getPortalMessagesByFirm, firmId ? { firmId } : 'skip') || [];
    // Vega: client messages on matters
    const clientMessages = matterState?.clientMessages || [];
    // Audit trail for outbound messages
    const automationLogs = useQuery(api.sentry.getAutomationLogs, firmId ? { firmId, limit: 100 } : 'skip') || [];

    // ── Scheduled messages ──
    const scheduledMessages = useQuery(api.portals.getScheduledMessagesByFirm, firmId ? { firmId } : 'skip') || [];
    const cancelScheduled = useMutation(api.portals.cancelScheduledMessage);

    // ── Compose modal for inbox replies ──
    const [showCompose, setShowCompose] = useState(false);
    const [composePrefill, setComposePrefill] = useState<ComposeModalPrefill | undefined>(undefined);
    const logAutomation = useMutation(api.sentry.logAutomation);
    const markInboundRead = useMutation(api.sentry.markMessageAsRead);
    const deleteInboundMessage = useMutation(api.sentry.deleteInboundMessage);

    // ── Inbox: selected thread ──
    const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
    const [inboxReply, setInboxReply] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    // ── Inbox: compute unread counts ──
    const inboundUnreadCount = atriumInbound.filter((m: any) => !m.isRead).length;
    const portalUnreadCount = (portalMessages as any[]).filter((m: any) => m.status === 'unread').length;
    const totalInboxUnread = inboundUnreadCount + portalUnreadCount + clientMessages.filter(m => !m.isRead).length;
    const pendingScheduled = (scheduledMessages as any[]).filter((m: any) => m.status === 'scheduled').length;

    // ── Inbox: find selected message ──
    const selectedInboundMsg = useMemo(() =>
        atriumInbound.find((m: any) => m._id === selectedInboxId),
    [atriumInbound, selectedInboxId]);

    // ── Team Chat: filtered conversations (existing logic) ──
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
                const msgsA = messages.filter((m: any) => m && m.conversationId?.toString() === a.id);
                const msgsB = messages.filter((m: any) => m && m.conversationId?.toString() === b.id);
                const lastMsgA = msgsA.length > 0 ? msgsA[msgsA.length - 1] : null;
                const lastMsgB = msgsB.length > 0 ? msgsB[msgsB.length - 1] : null;
                const timeA = lastMsgA?.timestamp ? new Date(lastMsgA.timestamp).getTime() : 0;
                const timeB = lastMsgB?.timestamp ? new Date(lastMsgB.timestamp).getTime() : 0;
                return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
            });

        const systemUnreadCount = (coreState.notifications || []).filter(n =>
            n && n.userId === currentUser.id &&
            !n.isRead &&
            n.link?.view === 'messaging' &&
            n.link?.context?.systemInbox
        ).length;

        const hasSystemMessages = myFeedback.length > 0;

        if (hasSystemMessages && (!searchQuery || 'system inbox practicepro team'.includes(searchQuery.toLowerCase()))) {
            const systemConv = {
                id: 'system-inbox',
                type: 'system',
                name: 'PracticePro Team',
                memberIds: [currentUser.id],
                _isSystem: true,
                unreadCount: systemUnreadCount,
                lastMsg: myFeedback[0]
            } as any;
            return [systemConv, ...chats];
        }

        return chats;
    }, [conversations, messages, searchQuery, currentUser, users, myFeedback, coreState.notifications]);

    useEffect(() => {
        if (activeConversationId) {
            setSelectedId(activeConversationId);
        }
    }, [activeConversationId]);

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

    // ── Inbox reply handler ──
    const handleInboxReply = async () => {
        if (!inboxReply.trim() || !selectedInboundMsg) return;
        setIsSendingReply(true);
        try {
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
            {/* ── Top Tab Bar ── */}
            <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 sm:px-4 pt-2">
                <div className="flex items-center gap-1">
                    {/* Inbox Tab */}
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'inbox'
                                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                        <span className="hidden sm:inline">Inbox</span>
                        {totalInboxUnread > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                {totalInboxUnread > 9 ? '9+' : totalInboxUnread}
                            </span>
                        )}
                    </button>

                    {/* Team Chat Tab */}
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'team'
                                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="hidden sm:inline">Team Chat</span>
                    </button>

                    {/* Scheduled Tab */}
                    <button
                        onClick={() => setActiveTab('scheduled')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                            activeTab === 'scheduled'
                                ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-500'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                    >
                        <ClockIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Scheduled</span>
                        {pendingScheduled > 0 && (
                            <span className="min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                {pendingScheduled > 9 ? '9+' : pendingScheduled}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 flex overflow-hidden">
                {/* ═══ INBOX TAB ═══ */}
                {activeTab === 'inbox' && (
                    <div className="flex w-full h-full">
                        {/* Inbox Threads List */}
                        <div className={`${selectedInboxId ? 'hidden md:block' : 'block'} w-full md:w-80 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900`}>
                            <div className="flex-shrink-0 py-3 px-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {isProperty ? 'Tenant Messages' : 'Client Messages'}
                                </h3>
                                <button
                                    onClick={() => setShowCompose(true)}
                                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-1 text-xs font-bold"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" /> Compose
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isProperty ? (
                                    /* ── ATRIUM: Tenant inbound + portal messages ── */
                                    atriumInbound.length === 0 && portalMessages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                                <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                            </div>
                                            <p className="text-sm text-slate-400">No tenant messages yet</p>
                                            <p className="text-xs text-slate-300 mt-1">WhatsApp, email, and portal messages from tenants will appear here</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Inbound WhatsApp/Email messages */}
                                            {(atriumInbound as any[]).map((msg: any) => (
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
                                                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                                                            {msg.receivedAt ? new Date(msg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] mb-1">
                                                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${CHANNEL_COLORS[msg.channel] || 'text-slate-500 bg-slate-100'}`}>
                                                            {CHANNEL_LABELS[msg.channel] || msg.channel}
                                                        </span>
                                                        {msg.unitId && <span className="text-slate-400">Unit</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                                                </div>
                                            ))}
                                            {/* Portal messages */}
                                            {(portalMessages as any[]).filter((m: any) => m.status !== 'replied').map((msg: any) => (
                                                <div
                                                    key={msg._id}
                                                    onClick={() => { setSelectedInboxId(msg._id); }}
                                                    className={`p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${selectedInboxId === msg._id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            {msg.status === 'unread' && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                                                            <span className={`text-sm truncate max-w-[160px] ${msg.status === 'unread' ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-zinc-300'}`}>
                                                                {msg.senderName || 'Portal User'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                                                            {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] mb-1">
                                                        <span className="px-1.5 py-0.5 rounded uppercase font-bold text-emerald-500 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30">
                                                            Portal
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content || msg.subject}</p>
                                                </div>
                                            ))}
                                        </>
                                    )
                                ) : (
                                    /* ── VEGA: Client messages grouped by matter ── */
                                    clientMessages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                                <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                            </div>
                                            <p className="text-sm text-slate-400">No client messages yet</p>
                                            <p className="text-xs text-slate-300 mt-1">Messages from your clients on their matters will appear here</p>
                                        </div>
                                    ) : (
                                        clientMessages
                                            .filter((m: any) => !m.isRead)
                                            .map((msg: any) => (
                                                <div
                                                    key={msg.id}
                                                    onClick={() => { navigateTo('matterDetail', msg.matterId, { initialTab: 'messages' }); }}
                                                    className="p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800"
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">Client Message</span>
                                                        <span className="text-[10px] text-slate-400 flex-shrink-0">{msg.timestamp ? timeAgo(msg.timestamp) : ''}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                                                </div>
                                            ))
                                    )
                                )}
                            </div>
                        </div>

                        {/* Inbox Thread Detail */}
                        <div className={`${selectedInboxId ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white dark:bg-zinc-900`}>
                            {selectedInboundMsg ? (
                                <>
                                    {/* Thread Header */}
                                    <div className="flex-shrink-0 h-14 px-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between bg-white dark:bg-zinc-800 z-20">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setSelectedInboxId(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full">
                                                <ChevronRightIcon className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${getUserColor(selectedInboundMsg.senderName || 'U')}`}>
                                                {getInitials(selectedInboundMsg.senderName || 'U')}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{selectedInboundMsg.senderName || selectedInboundMsg.senderContact}</h3>
                                                <div className="flex items-center gap-1.5 text-[10px]">
                                                    <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${CHANNEL_COLORS[selectedInboundMsg.channel]}`}>
                                                        {CHANNEL_LABELS[selectedInboundMsg.channel] || selectedInboundMsg.channel}
                                                    </span>
                                                    <span className="text-slate-400">{selectedInboundMsg.senderContact}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm('Delete this message?')) {
                                                    await deleteInboundMessage({ messageId: selectedInboundMsg._id as any });
                                                    setSelectedInboxId(null);
                                                }
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete message"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Message Content */}
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                                        <div className="max-w-2xl mx-auto">
                                            <div className="flex justify-start mb-4">
                                                <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm max-w-[85%]">
                                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-zinc-700">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedInboundMsg.senderName || 'Sender'}</span>
                                                        <span className="text-[10px] text-slate-400">{selectedInboundMsg.receivedAt ? new Date(selectedInboundMsg.receivedAt).toLocaleString() : ''}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedInboundMsg.content}</p>
                                                    {selectedInboundMsg.mediaUrl && (
                                                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700">
                                                            <img src={selectedInboundMsg.mediaUrl} alt="Attachment" className="w-full h-auto max-h-64 object-cover" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* AI Suggested Reply */}
                                            {selectedInboundMsg.aiAnalysis?.suggestedReply && (
                                                <div className="mx-2 md:mx-8 mb-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-200 dark:border-primary-800 p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary-500">Suggested Reply</span>
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

                                    {/* Reply Input */}
                                    <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3">
                                        <div className="max-w-2xl mx-auto flex items-end gap-2">
                                            <textarea
                                                value={inboxReply}
                                                onChange={(e) => setInboxReply(e.target.value)}
                                                placeholder={`Reply via ${selectedInboundMsg.channel || 'message'}...`}
                                                rows={Math.min(4, inboxReply.split('\n').length || 1)}
                                                className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500/50 resize-none transition-all placeholder:text-slate-400"
                                            />
                                            <button
                                                onClick={handleInboxReply}
                                                disabled={!inboxReply.trim() || isSendingReply}
                                                className="p-3 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-zinc-700 text-white rounded-xl shadow-sm transition-all flex-shrink-0 disabled:cursor-not-allowed"
                                            >
                                                <SendIcon />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600 p-8 text-center">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </div>
                                    <p className="text-base font-medium text-slate-500 dark:text-zinc-400">
                                        {isProperty ? 'Select a tenant message to respond' : 'Select a client message to view'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {isProperty ? 'WhatsApp, email, and portal messages from tenants' : 'Messages from your clients on matters'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Compose Modal */}
                        {showCompose && firmId && (
                            <ComposeModal
                                firmId={firmId}
                                prefill={composePrefill}
                                onClose={() => { setShowCompose(false); setComposePrefill(undefined); }}
                                onToast={(msg) => addToast(msg, { type: msg.includes('Error') || msg.includes('Failed') ? 'error' : 'success' })}
                            />
                        )}
                    </div>
                )}

                {/* ═══ TEAM CHAT TAB ═══ */}
                {activeTab === 'team' && (
                    <div className="flex h-full w-full">
                        <div className={`w-full md:w-80 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
                            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 shadow-sm border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Team Chat</h2>
                                <button onClick={() => openModal('newDirectMessage')} className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-2 text-xs font-bold">
                                    <PlusIcon className="w-4 h-4" /> New
                                </button>
                            </div>
                            <div className="p-3">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="text"
                                        placeholder="Search chats..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1">
                                {filteredConversations.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">No conversations found.</p>}
                                {filteredConversations.map(c => {
                                    let displayName = c.name || 'Chat';
                                    let avatar = null;
                                    const convMessages = messages.filter((m: any) => m && m.conversationId?.toString() === c.id);
                                    const lastMsg = c._isSystem ? c.lastMsg : convMessages.sort((a: any, b: any) => {
                                        const timeA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
                                        const timeB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
                                        return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
                                    }).pop();

                                    const unreadCount = c._isSystem ? c.unreadCount : coreState.notifications.filter((n: any) =>
                                        n.userId === currentUser.id &&
                                        !n.isRead &&
                                        n.link?.view === 'messaging' &&
                                        n.link?.context?.activeConversationId?.toString() === c.id
                                    ).length;
                                    const hasUnread = unreadCount > 0;

                                    if (c._isSystem) {
                                        displayName = c.name;
                                        avatar = (
                                            <div className={`relative w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900`}>
                                                <SparklesIcon className="w-5 h-5" />
                                                {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
                                            </div>
                                        );
                                    } else if (c.type === 'direct') {
                                        const otherId = c.memberIds?.find((id: string) => id !== currentUser.id);
                                        const other = users.find(u => u.id === otherId);
                                        displayName = other ? other.name : 'Unknown';
                                        avatar = (
                                            <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getUserColor(displayName)}`}>
                                                {getInitials(displayName)}
                                                {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
                                            </div>
                                        );
                                    } else {
                                        displayName = `#${c.name}`;
                                        avatar = (
                                            <div className={`relative w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300`}>
                                                <span className="font-bold text-lg">#</span>
                                                {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></span>}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => { setSelectedId(c.id); onNavigate('messaging', null, { activeConversationId: c.id }); }}
                                            className={`flex items-center gap-3 p-3 cursor-pointer rounded-xl transition-all group relative ${selectedId === c.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                                        >
                                            {avatar}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <h4 className={`font-semibold text-sm truncate ${selectedId === c.id ? 'text-primary-700 dark:text-primary-400' : (hasUnread ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-900 dark:text-white')}`}>{displayName}</h4>
                                                    {hasUnread ? (
                                                        <span className="min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm ml-2">
                                                            {unreadCount > 9 ? '9+' : unreadCount}
                                                        </span>
                                                    ) : lastMsg && (
                                                        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{timeAgo(lastMsg.timestamp)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between mt-0.5">
                                                    <p className={`text-xs truncate max-w-[85%] ${hasUnread ? 'font-bold text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-zinc-400'}`}>
                                                        {c._isSystem ? (lastMsg ? lastMsg.adminReply || lastMsg.message : 'System updates') : renderSidebarPreview(lastMsg)}
                                                    </p>
                                                    {!c._isSystem && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openModal('deleteConfirmation', c.id, {
                                                                    title: "Hide Conversation?",
                                                                    message: "This conversation will be hidden from your inbox. It will reappear if you receive a new message in this chat.",
                                                                    onConfirm: async () => {
                                                                        try { await handleDeleteChat(c.id, false, currentUser.id); } finally { closeModal(); }
                                                                    },
                                                                    confirmText: 'Hide for me',
                                                                    confirmButtonClass: 'bg-slate-700 hover:bg-slate-800 text-white font-bold'
                                                                });
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 -mr-1.5 text-slate-400 hover:text-red-500 focus:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all z-10"
                                                            title="Delete Chat"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={`flex-1 flex flex-col bg-white dark:bg-zinc-900 ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
                            {selectedId === 'system-inbox' ? (
                                <div className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-900 relative w-full">
                                    <div className="flex-shrink-0 h-16 px-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between bg-white dark:bg-zinc-800 z-20 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => { setSelectedId(null); onNavigate('messaging', null, { activeConversationId: null }); }} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full">
                                                <ChevronRightIcon className="w-5 h-5 rotate-180" />
                                            </button>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900">
                                                    <SparklesIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">System Inbox</h3>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400">Updates from the PracticePro Team</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar scroll-smooth">
                                        <div className="max-w-3xl mx-auto w-full pb-4">
                                            {myFeedback.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                                    <div className="p-3.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl mb-4">
                                                        <SparklesIcon className="w-7 h-7 text-slate-400" />
                                                    </div>
                                                    <h3 className="text-base font-bold text-slate-700 dark:text-zinc-300">PracticePro Team</h3>
                                                    <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs mt-1.5">Submit feedback, report bugs, or ask for support. When our team replies, the messages will appear here.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {myFeedback.map((item: any) => (
                                                        <div key={item._id} className="space-y-4">
                                                            <div className="flex justify-center my-4">
                                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800/50 px-3 py-1 rounded-full">{new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <div className="flex w-full mb-2 justify-end animate-fade-in-up">
                                                                <div className="flex max-w-[85%] md:max-w-[75%] gap-2.5 flex-row-reverse">
                                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-primary-600 text-white font-bold text-[10px]">{getInitials(item.userName)}</div>
                                                                    <div className="flex flex-col items-end group">
                                                                        {item.title && <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">[{item.type || 'Feedback'}] {item.title}</span>}
                                                                        <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm bg-primary-600 text-white rounded-tr-sm">
                                                                            <span className="whitespace-pre-wrap break-words">{item.message}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {item.adminReply && (
                                                                <div className="flex w-full mb-2 justify-start animate-fade-in-up">
                                                                    <div className="flex max-w-[85%] md:max-w-[75%] gap-2.5 flex-row">
                                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-900 dark:text-white">
                                                                            <SparklesIcon className="w-4 h-4" />
                                                                        </div>
                                                                        <div className="flex flex-col items-start group">
                                                                            <span className="text-[10px] font-bold text-slate-500 mb-1 px-1">PracticePro Team</span>
                                                                            <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200 rounded-tl-sm">
                                                                                <div className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: parseAloaMarkdown(item.adminReply) }} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : activeConversation ? (
                                <ChatWindow
                                    conversation={activeConversation}
                                    messages={activeMessages}
                                    currentUser={currentUser!}
                                    users={users}
                                    onSend={(text) => activeConversation && handleSendMessage(activeConversation.id, text, currentUser!.id)}
                                    onBack={() => { setSelectedId(null); onNavigate('messaging', null, { activeConversationId: null }); }}
                                    onDeleteMessage={handleDeleteMessage}
                                    onDeleteChat={handleDeleteChat}
                                    onRetry={(id) => retryMessage && retryMessage(id, false)}
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600">
                                    <div className="w-24 h-24 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    </div>
                                    <p className="text-lg font-medium text-slate-600 dark:text-zinc-400">Select a conversation to start chatting</p>
                                    <button onClick={() => openModal('newDirectMessage')} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors">
                                        Start New Chat
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ SCHEDULED TAB ═══ */}
                {activeTab === 'scheduled' && (
                    <div className="w-full h-full overflow-y-auto custom-scrollbar">
                        <div className="max-w-3xl mx-auto p-4 sm:p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled Messages</h2>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">Messages queued for future delivery</p>
                                </div>
                                {pendingScheduled > 0 && (
                                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
                                        {pendingScheduled} pending
                                    </span>
                                )}
                            </div>

                            {(scheduledMessages as any[]).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                        <ClockIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                                    </div>
                                    <p className="text-sm text-slate-400">No scheduled messages</p>
                                    <p className="text-xs text-slate-300 mt-1">Messages scheduled for future delivery will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(scheduledMessages as any[]).map((msg: any) => (
                                        <div
                                            key={msg._id}
                                            className={`p-4 rounded-xl border transition-all ${
                                                msg.status === 'scheduled'
                                                    ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
                                                    : msg.status === 'cancelled'
                                                    ? 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 opacity-60'
                                                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 opacity-75'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold ${CHANNEL_COLORS[msg.channel] || 'text-slate-500 bg-slate-100'}`}>
                                                        {CHANNEL_LABELS[msg.channel] || msg.channel}
                                                    </span>
                                                    {msg.messageType && (
                                                        <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                                                            {MSG_TYPE_LABELS[msg.messageType] || msg.messageType}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        msg.status === 'scheduled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                        msg.status === 'cancelled' ? 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400' :
                                                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    }`}>
                                                        {msg.status}
                                                    </span>
                                                    {msg.status === 'scheduled' && (
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm('Cancel this scheduled message?')) {
                                                                    await cancelScheduled({ messageId: msg._id });
                                                                }
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Cancel scheduled message"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">{msg.content}</p>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {msg.scheduledFor ? new Date(msg.scheduledFor).toLocaleString() : 'No date'}
                                                </span>
                                                {msg.tenantIds && msg.tenantIds.length > 0 && (
                                                    <span>{msg.tenantIds.length} recipient{msg.tenantIds.length > 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesView;
