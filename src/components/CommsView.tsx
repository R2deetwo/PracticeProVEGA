
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChatConversation, ChatMessage, User, ModalType, View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useMatterState } from '../contexts/MatterContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { PaperClipIcon, SendIcon, TrashIcon, DocumentIcon, ChevronRightIcon, ClockIcon, CheckIcon, DownloadIcon, PlusIcon, BellIcon, SparklesIcon } from '../constants';
import { getUserColor, getInitials, timeAgo } from '../utils/colorUtils';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { parseAloaMarkdown } from '../utils/markdownUtils';

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
    // Scroll handling: Detect if user is near bottom
    const [isAtBottom, setIsAtBottom] = useState(true);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            // Consider "at bottom" if within 100px of bottom
            const isBottom = scrollHeight - scrollTop - clientHeight < 100;
            setIsAtBottom(isBottom);
        }
    };

    // Auto-scroll on new message ONLY if user was already at bottom or it's their own message
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        const isMyMessage = lastMessage?.authorId === currentUser.id;

        if (isAtBottom || isMyMessage) {
            // Use scrollIntoView with a small delay to ensure DOM is ready
            const timer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            return () => clearTimeout(timer);
        }
    }, [messages, currentUser.id, isAtBottom]);

    // Initial scroll to bottom and when switching conversations
    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            // Second pass after a short delay for layout stability
            const timer = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [conversation.id]); 

    const handleTaskClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const taskEl = target.closest('.aloa-interactive-task');
        if (taskEl) {
            const taskTitle = taskEl.getAttribute('data-task-title');
            if (taskTitle) {
                openModal('newTask', undefined, { defaultTitle: taskTitle });
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSend = () => {
        if (newMessage.trim()) {
            // Optimistic update handled in DataContext, but we force UI reset here
            onSend(newMessage.trim());
            setNewMessage('');
            if (inputRef.current) inputRef.current.focus();
            // Force scroll to bottom on send
            setIsAtBottom(true);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleDeleteChatAction = (everyone: boolean) => {
        openModal('deleteConfirmation', conversation.id, {
            title: everyone ? "Delete for Everyone?" : "Remove from View?",
            message: everyone
                ? "Are you sure you want to delete this chat for EVERYONE? This cannot be undone."
                : "Are you sure you want to remove this conversation from your view?",
            onConfirm: async () => {
                try {
                    await onDeleteChat(conversation.id, everyone, currentUser.id);
                } finally {
                    closeModal();
                    onBack();
                }
            },
            confirmText: everyone ? 'Delete for Everyone' : 'Remove from View',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                addToast("File is too large for chat. Please use the Documents module for files > 5MB.", { type: 'info' });
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                const fileMsg = `[FILE: ${file.name}](${base64})`;
                onSend(fileMsg);
                setIsAtBottom(true);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            };
            reader.readAsDataURL(file);
        }
    };

    // Helper to determine file icon based on name/type
    const getFileIcon = (fileName: string) => {
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.pdf')) return <PdfIcon className="w-6 h-6 text-red-500" />;
        if (lower.endsWith('.doc') || lower.endsWith('.docx')) return <DocumentIcon className="w-6 h-6 text-blue-500" />;
        return <DocumentIcon className="w-6 h-6 text-slate-500" />;
    };

    // Render message content with rich previews
    const renderContent = (content: string, isMe: boolean) => {
        if (!content) return null;

        if (content.startsWith('[FILE:')) {
            const match = content.match(/\[FILE: (.*?)\]\((.*)\)/);
            if (match) {
                const [_, fileName, dataUrl] = match;
                const lowerName = fileName.toLowerCase();
                const isImage = lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.gif');
                const isPdf = lowerName.endsWith('.pdf');

                if (isImage) {
                    return (
                        <div className="flex flex-col gap-2">
                            <img
                                src={dataUrl}
                                alt={fileName}
                                className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => {
                                    const win = window.open();
                                    win?.document.write(`<img src="${dataUrl}" style="width:100%"/>`);
                                }}
                            />
                            <div className="flex justify-between items-center px-1">
                                <span className={`text-xs opacity-70 truncate max-w-[150px] ${isMe ? 'text-white' : 'text-slate-600'}`}>{fileName}</span>
                                <a href={dataUrl} download={fileName} className={`p-1 rounded-full ${isMe ? 'hover:bg-white/20 text-white' : 'hover:bg-slate-200 text-slate-500'}`} title="Download">
                                    <DownloadIcon className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    );
                }

                if (isPdf) {
                    return (
                        <div className="flex flex-col w-64 h-64 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative">
                            {/* Attempt to show PDF preview using iframe. Note: Data URLs for PDF work in modern browsers. */}
                            <iframe src={`${dataUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full pointer-events-none opacity-50" title="PDF Preview"></iframe>
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 hover:bg-transparent transition-colors">
                                <PdfIcon className="w-12 h-12 text-red-500 drop-shadow-md mb-2" />
                                <span className="bg-black/50 text-white text-2xs px-2 py-0.5 rounded truncate max-w-[90%]">{fileName}</span>
                                <a
                                    href={dataUrl}
                                    download={fileName}
                                    className="mt-2 px-3 py-1 bg-white text-slate-800 text-xs font-bold rounded shadow hover:bg-slate-50 flex items-center gap-1 cursor-pointer pointer-events-auto"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <DownloadIcon className="w-3 h-3" /> Download
                                </a>
                            </div>
                        </div>
                    );
                }

                // Default Rich Card for other files (Word, Excel, etc)
                return (
                    <div className={`
                        flex flex-col p-4 w-64 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700
                        ${isMe ? 'bg-white/10 border-white/20' : ''}
                    `}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-slate-100 dark:border-zinc-700">
                                {getFileIcon(fileName)}
                            </div>
                            <div className="min-w-0">
                                <p className={`font-bold text-sm truncate ${isMe ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{fileName}</p>
                                <p className={`text-2xs uppercase font-bold ${isMe ? 'text-primary-200' : 'text-slate-400'}`}>Document</p>
                            </div>
                        </div>
                        <a
                            href={dataUrl}
                            download={fileName}
                            className={`
                                w-full py-2 text-xs font-bold text-center rounded transition-colors flex items-center justify-center gap-2
                                ${isMe
                                    ? 'bg-white text-primary-600 hover:bg-slate-100'
                                    : 'bg-primary-600 text-white hover:bg-primary-700'}
                            `}
                        >
                            <DownloadIcon className="w-3.5 h-3.5" /> Download File
                        </a>
                    </div>
                );
            }
        }
        return <span className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: parseAloaMarkdown(content) }} />;
    };

    const MessageStatusIcon = ({ status }: { status?: string }) => {
        if (status === 'pending') return <ClockIcon className="w-3 h-3 text-slate-400" />;
        if (status === 'failed') return <ExclamationIcon className="w-3 h-3 text-red-500 cursor-pointer" />;
        if (status === 'read') return <div className="flex -space-x-1 text-blue-300"><CheckIcon className="w-3 h-3" /><CheckIcon className="w-3 h-3" /></div>;
        if (status === 'delivered') return <div className="flex -space-x-1 text-slate-300"><CheckIcon className="w-3 h-3" /><CheckIcon className="w-3 h-3" /></div>;
        return <CheckIcon className="w-3 h-3 text-slate-300" />; // Sent
    };

    // Group messages by date with proper sorting
    const groupedMessages = useMemo(() => {
        const groups: { [date: string]: ChatMessage[] } = {};
        
        // Ensure messages are sorted by timestamp (oldest first)
        const sortedMessages = [...messages].filter(Boolean).sort((a: any, b: any) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
        });
        
        sortedMessages.forEach(msg => {
            if (msg.deletedForUserIds && msg.deletedForUserIds.includes(currentUser.id)) return;
            const date = new Date(msg.timestamp).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(msg);
        });
        
        // Return sorted keys
        const sortedDateKeys = Object.keys(groups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        const sortedGroups: { [date: string]: ChatMessage[] } = {};
        sortedDateKeys.forEach(key => {
            sortedGroups[key] = groups[key];
        });
        
        return sortedGroups;
    }, [messages, currentUser.id]);

    let chatTitle = conversation.name || 'Chat';
    let recipient: User | undefined;
    let matterContext = '';

    if (conversation.type === 'direct') {
        const otherId = conversation.memberIds?.find(id => id !== currentUser.id);
        recipient = users.find(u => u.id === otherId);
        chatTitle = recipient ? recipient.name : 'Unknown User';

        if (conversation.matterId && matterState?.matters) {
            const matter = matterState.matters.find(m => m.id === conversation.matterId);
            if (matter) matterContext = matter.title;
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-900 md:bg-transparent relative w-full">
            {/* Header */}
            <div className="flex-shrink-0 h-16 px-4 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between bg-white dark:bg-zinc-800 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full">
                        <ChevronRightIcon className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="flex items-center gap-3">
                        {conversation.type === 'direct' ? (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getUserColor(chatTitle)}`}>
                                {getInitials(chatTitle)}
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300">
                                <span className="font-bold text-lg">#</span>
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">{chatTitle}</h3>
                            {conversation.type === 'direct' && recipient && (
                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                    {recipient.role || 'User'} {matterContext ? `• ${matterContext}` : ''}
                                </p>
                            )}
                            {conversation.type === 'channel' && (
                                <p className="text-xs text-slate-500 dark:text-zinc-400">{conversation.memberIds?.length || 0} members</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative" ref={menuRef}>
                    <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500">
                        <DotsVerticalIcon />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 py-1 z-50 animate-fade-in-up">
                            <button onClick={() => { setShowMenu(false); handleDeleteChatAction(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-300 font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors">
                                Hide Chat
                            </button>
                            <button onClick={() => { setShowMenu(false); handleDeleteChatAction(true); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                Delete for Everyone
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 dark:bg-zinc-900" onClick={handleTaskClick}
            >
                {Object.keys(groupedMessages).map(dateStr => (
                    <div key={dateStr}>
                        <div className="flex justify-center mb-4 sticky top-0 z-10">
                            <span className="bg-slate-200/80 dark:bg-zinc-700/80 backdrop-blur-sm text-slate-600 dark:text-slate-300 text-2xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                {new Date(dateStr).toDateString() === new Date().toDateString() ? 'Today' : dateStr}
                            </span>
                        </div>

                        {groupedMessages[dateStr].map((msg, index) => {
                            const isMe = msg.authorId === currentUser.id;
                            const author = users.find(u => u.id === msg.authorId);
                            const prevMsg = index > 0 ? groupedMessages[dateStr][index - 1] : null;
                            const isSequence = prevMsg && prevMsg.authorId === msg.authorId;

                            const avatarColor = getUserColor(author?.name || msg.authorId);

                            if (msg.isDeleted) {
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                                        <div className={`px-3 py-1.5 rounded-lg text-xs italic border border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 flex items-center gap-2`}>
                                            <TrashIcon className="w-3 h-3" />
                                            Message deleted
                                        </div>
                                    </div>
                                );
                            }

                            const isFile = msg.content?.startsWith('[FILE:');

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1 ${isSequence ? 'mt-1' : 'mt-4'}`}>
                                    {!isMe && !isSequence && (
                                        <div className="w-8 flex-shrink-0 mr-2 flex flex-col justify-end">
                                            <div
                                                title={author?.name}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-2xs shadow-sm ${avatarColor}`}
                                            >
                                                {getInitials(author?.name)}
                                            </div>
                                        </div>
                                    )}
                                    {!isMe && isSequence && <div className="w-10" />}

                                    <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        {!isMe && !isSequence && <span className="text-2xs font-bold text-slate-500 ml-1 mb-1">{author?.name}</span>}
                                        <div
                                            className={`relative text-sm shadow-sm transition-all duration-200 px-4 py-2.5 ${isMe
                                                ? 'bg-primary-600 text-white rounded-2xl rounded-tr-none shadow-primary-500/10'
                                                : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 rounded-2xl rounded-tl-none'
                                                } ${msg.status === 'failed' ? 'opacity-80 border-red-300' : ''} ${isFile ? 'p-1' : ''}`}
                                        >
                                            {renderContent(msg.content, isMe)}
                                        </div>

                                        <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-3xs text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {isMe && (
                                                <>
                                                    <div title={msg.status} onClick={() => msg.status === 'failed' && onRetry(msg.id)}>
                                                        <MessageStatusIcon status={msg.status} />
                                                    </div>
                                                    {msg.status === 'failed' && <span onClick={() => onRetry(msg.id)} className="text-3xs text-red-500 font-bold cursor-pointer hover:underline">Retry</span>}

                                                    <button
                                                        onClick={() => {
                                                            openModal('deleteConfirmation', msg.id, {
                                                                title: "Delete Message?",
                                                                message: "Are you sure you want to delete this message?",
                                                                onConfirm: () => {
                                                                    onDeleteMessage(msg.id, false, currentUser.id);
                                                                    closeModal();
                                                                },
                                                                confirmText: 'Delete',
                                                                confirmButtonClass: 'bg-red-600 hover:bg-red-700'
                                                            });
                                                        }}
                                                        className="text-3xs text-red-400 hover:text-red-600 cursor-pointer hover:underline"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {/* 
                CRITICAL FIX for Mobile Visibility:
                1. Removed z-30 (which might clip) and used fixed/absolute combination for better layering.
                2. Changed bottom-0 to bottom-16 on mobile (md:bottom-0) to clear the BottomNav (approx 64px height).
                3. Added border-t to create visual separation.
            */}
            {/* Input Area: Changed from absolute to flex-shrink-0 for layout stability */}
            <div className="flex-shrink-0 p-4 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 z-50">
                <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-100 dark:bg-zinc-800 p-2 rounded-2xl border border-transparent focus-within:border-primary-300 dark:focus-within:border-primary-700 focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:ring-4 focus-within:ring-primary-100 dark:focus-within:ring-primary-900/20 transition-all shadow-sm">

                    {/* Left Actions */}
                    <div className="flex gap-1 pb-1 pl-1 flex-shrink-0">
                        <input autoComplete="off" data-lpignore="true"  type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 transition-colors" title="Attach File">
                            <PaperClipIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Main Input */}
                    <textarea
                        ref={inputRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-grow bg-transparent border-none focus:ring-0 text-sm max-h-32 resize-none text-slate-800 dark:text-white placeholder-slate-400 ml-1 py-3 custom-scrollbar"
                        rows={1}
                        style={{ minHeight: '44px' }}
                    />

                    {/* Right Actions: Send */}
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

// ... (Rest of CommsView remains similar, just imports updated ChatWindow)
const CommsView: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { matterState } = useMatterState();
    const { currentUser } = useAuth();
    const { retryMessage, handleMarkNotificationsRead, handleSendMessage, handleEditMessage, handleDeleteMessage, handleDeleteChat } = useDataActions();
    const { openModal, closeModal, navigateTo, currentHistoryEntry } = useUI();

    if (!currentUser) return null;

    const conversations = coreState.chatConversations || [];
    const messages = coreState.chatMessages || [];
    const users = coreState.users || [];
    const activeConversationId = currentHistoryEntry.context?.activeConversationId;
    const onNavigate = (view: any, id: any, context: any) => navigateTo(view, id, context);

    
    // Core state
    const [selectedId, setSelectedId] = useState<string | null>(activeConversationId || null);
    const [searchQuery, setSearchQuery] = useState('');

    // System Inbox: fetch user's own feedback threads
    const myFeedback = useQuery(api.feedback.getMyFeedbackReplies, { userId: currentUser?.id || '' }) || [];

    // ... (rest of logic for sidebar list filtering etc)
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
            
        // Inject System Inbox into the list if there are feedback replies
        const systemUnreadCount = (coreState.notifications || []).filter(n =>
            n && n.userId === currentUser.id &&
            !n.isRead &&
            n.link?.view === 'messaging' &&
            n.link?.context?.systemInbox
        ).length;

        const hasSystemMessages = myFeedback.length > 0;
        
        // Include system inbox if it has messages, or matches search, or is currently selected
        if (hasSystemMessages && (!searchQuery || 'system inbox practicepro team'.includes(searchQuery.toLowerCase()))) {
            // We'll return it as a special conversation object
            const systemConv = {
                id: 'system-inbox',
                type: 'system',
                name: 'PracticePro Team',
                memberIds: [currentUser.id],
                _isSystem: true,
                unreadCount: systemUnreadCount,
                lastMsg: myFeedback[0] // Most recent feedback
            } as any;
            
            return [systemConv, ...chats];
        }
        
        return chats;
    }, [conversations, messages, searchQuery, currentUser, users, myFeedback, coreState.notifications]);

    useEffect(() => {
        if (activeConversationId) {
            setSelectedId(activeConversationId);
        } else if (!selectedId && filteredConversations.length > 0) {
            // Auto-select latest conversation if none selected and not on mobile
            // We use a small delay to avoid layout shifts
            const timer = setTimeout(() => {
                if (window.innerWidth >= 768) {
                    const firstConv = filteredConversations[0];
                    if (firstConv && !firstConv._isSystem) {
                        setSelectedId(firstConv.id);
                    }
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeConversationId, filteredConversations.length]);

    const activeConversation = conversations?.filter(Boolean).find((c: any) => c && c.id === selectedId);
    const activeMessages = Array.isArray(messages) ? messages.filter((m: any) => m && m.conversationId?.toString() === selectedId) : [];

    // Clear notifications for the active conversation when it changes
    useEffect(() => {
        // Defensive check: Ensure selectedId is a specific ID and not a general view name
        // Most IDs in this app are either Convex IDs (formatted) or UUIDs (long)
        const isSpecificId = selectedId && selectedId.length > 10;

        if (isSpecificId) {
            const conversationNotificationIds = (coreState.notifications || [])
                .filter(n => {
                    if (!n || !n.link) return false;
                    const matchesView = n.link.view === 'messaging';
                    const matchesContext = n.link?.context?.activeConversationId?.toString() === selectedId;
                    const matchesLinkId = n.link?.id?.toString() === selectedId;
                    const matchesSystemInbox = selectedId === 'system-inbox' && n.link.context?.systemInbox;

                    return !n.isRead &&
                        n.userId === currentUser.id &&
                        matchesView &&
                        (matchesContext || matchesLinkId || matchesSystemInbox);
                })
                .map(n => n.id);

            if (conversationNotificationIds.length > 0) {
                handleMarkNotificationsRead(conversationNotificationIds);
            }
        }
    }, [selectedId, coreState.notifications, handleMarkNotificationsRead, currentUser.id]);

    const renderSidebarPreview = (msg: ChatMessage | undefined) => {
        if (!msg) return 'No messages yet';
        if (msg.content?.startsWith('[FILE:')) {
            return (
                <span className="flex items-center text-slate-600 dark:text-zinc-400">
                    {msg.authorId === currentUser.id ? 'You: ' : ''}
                    <DocumentIcon className="w-3 h-3 inline mr-1 text-slate-400" /> File
                </span>
            );
        }
        return <span className={msg.status === 'failed' ? 'text-red-500 italic' : ''}>{msg.authorId === currentUser.id ? 'You: ' : ''}{msg.content}</span>;
    }

    return (
        <div className="flex h-full w-full bg-white dark:bg-zinc-900 border-x border-slate-200 dark:border-zinc-800">
            <div className={`w-full md:w-80 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
                {/* Sidebar Header */}
                <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 shadow-sm border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Messages</h2>
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

                {/* Conversations List */}

                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1">
                    {filteredConversations.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">No conversations found.</p>}
                    {filteredConversations.map(c => {
                        let displayName = c.name || 'Chat';
                        let avatar = null;
                        const convMessages = messages.filter((m: any) => m && m.conversationId?.toString() === c.id);
                        const lastMsg = c._isSystem 
                            ? c.lastMsg 
                            : convMessages.sort((a: any, b: any) => {
                                const timeA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
                                const timeB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
                                return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
                            }).pop();

                        // Calculate unread count for this specific conversation
                        const unreadCount = c._isSystem ? c.unreadCount : coreState.notifications.filter((n: any) =>
                            n.userId === currentUser.id &&
                            !n.isRead &&
                            n.link?.view === 'messaging' &&
                            n.link?.context?.activeConversationId?.toString() === c.id
                        ).length;

                        // Specific Badge: Use both notifications AND unread flags if possible
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
                                        {/* Badge Logic */}                                        {hasUnread ? (
                                            <span className="min-w-[18px] h-[18px] bg-red-600 text-white text-2xs font-bold rounded-full flex items-center justify-center shadow-sm ml-2">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        ) : lastMsg && (
                                            <span className="text-2xs text-slate-400 flex-shrink-0 ml-2">{c._isSystem ? timeAgo(lastMsg.timestamp) : timeAgo(lastMsg.timestamp)}</span>
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
                                                            try {
                                                                await handleDeleteChat(c.id, false, currentUser.id);
                                                            } finally {
                                                                closeModal();
                                                            }
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
                        {/* Header */}
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
                        {/* System Inbox Tab Content (Chat Mode) */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar scroll-smooth">
                            <div className="max-w-3xl mx-auto w-full pb-4">
                                {myFeedback.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="p-3.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl mb-4">
                                            <SparklesIcon className="w-7 h-7 text-slate-400" />
                                        </div>
                                        <h3 className="text-base font-bold text-slate-700 dark:text-zinc-300">PracticePro Team</h3>
                                        <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs mt-1.5">
                                            Submit feedback, report bugs, or ask for support. When our team replies, the messages will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {myFeedback.map((item: any) => (
                                            <div key={item._id} className="space-y-4">
                                                {/* Timestamp header per item for chat linearity */}
                                                <div className="flex justify-center my-4">
                                                    <span className="text-2xs font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800/50 px-3 py-1 rounded-full">{new Date(item.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>

                                                {/* User's Message Bubble (Right Side) */}
                                                <div className="flex w-full mb-2 justify-end animate-fade-in-up">
                                                    <div className="flex max-w-[85%] md:max-w-[75%] gap-2.5 flex-row-reverse">
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-primary-600 text-white font-bold text-2xs">
                                                            {getInitials(item.userName)}
                                                        </div>
                                                        <div className="flex flex-col items-end group">
                                                            {item.title && <span className="text-2xs font-bold text-slate-400 mb-1 px-1">[{item.type || 'Feedback'}] {item.title}</span>}
                                                            <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm bg-primary-600 text-white rounded-tr-sm">
                                                                <span className="whitespace-pre-wrap break-words">{item.message}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Admin's Reply Bubble (Left Side) */}
                                                {item.adminReply && (
                                                    <div className="flex w-full mb-2 justify-start animate-fade-in-up">
                                                        <div className="flex max-w-[85%] md:max-w-[75%] gap-2.5 flex-row">
                                                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-slate-900 dark:text-white">
                                                                <SparklesIcon className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex flex-col items-start group">
                                                                <span className="text-2xs font-bold text-slate-500 mb-1 px-1">PracticePro Team</span>
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
    );
};

export default CommsView;
