/**
 * ChatMessageBubble — a reusable chat message bubble with hover actions.
 *
 * Features:
 * - Copy: available on ALL messages (own and others)
 * - Edit: available ONLY on own messages (isMe === true)
 * - Delete: available ONLY on own messages (isMe === true)
 * - Right-aligned for own messages, left-aligned for others
 * - Timestamp right-aligned inside the bubble
 * - Context menu uses position:fixed to escape overflow-y-auto containers
 * - Three-dots button is always visible on touch, hover-only on desktop
 * - break-all for long strings without spaces (prevents layout overflow)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface ChatMessageBubbleProps {
    content: string;
    timestamp: string | number | Date;
    isMe: boolean;
    authorName?: string;
    onDelete?: () => void;
    onEdit?: (newContent: string) => void;
    /** Called when the user clicks "Edit" in the menu — parent should set isEditing=true */
    onStartEdit?: () => void;
    /** Whether the message is currently in edit mode (parent controls) */
    isEditing?: boolean;
    /** Called when the user cancels editing */
    onCancelEdit?: () => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
    content,
    timestamp,
    isMe,
    authorName,
    onDelete,
    onEdit,
    onStartEdit,
    isEditing = false,
    onCancelEdit,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [editText, setEditText] = useState(content);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click (NOT on scroll — scroll closing is too
    // aggressive and closes the menu immediately because the chat container
    // fires scroll events when new messages arrive or the input resizes)
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
        };
    }, [showMenu]);

    // Reset edit text when entering edit mode
    useEffect(() => {
        if (isEditing) setEditText(content);
    }, [isEditing, content]);

    // Compute menu position relative to viewport — uses position:fixed
    const openMenu = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuWidth = 140;
        const menuHeight = 130;
        let top = rect.bottom + 4;
        let left = isMe ? rect.right - menuWidth : rect.left;

        if (top + menuHeight > window.innerHeight) {
            top = rect.top - menuHeight - 4;
        }
        if (top < 8) top = rect.bottom + 4;
        if (left < 8) left = 8;
        if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;

        setMenuPos({ top, left });
        setShowMenu(true);
    }, [isMe]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            setShowMenu(false);
        });
    };

    const handleEditClick = () => {
        setShowMenu(false);
        onStartEdit?.();
    };

    const handleSaveEdit = () => {
        if (editText.trim() && editText.trim() !== content) {
            onEdit?.(editText.trim());
        } else {
            onCancelEdit?.();
        }
    };

    const timeStr = new Date(timestamp).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });

    return (
        <div className={`group relative flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[80%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {isEditing ? (
                    <div className="px-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-primary-400 shadow-sm w-full">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            rows={Math.min(4, editText.split('\n').length)}
                            className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveEdit();
                                } else if (e.key === 'Escape') {
                                    onCancelEdit?.();
                                }
                            }}
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                                onClick={onCancelEdit}
                                className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 px-3 py-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1 rounded-md"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-primary-600 text-white rounded-br-md' : 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white rounded-bl-md'}`}>
                        <p className="leading-relaxed whitespace-pre-wrap break-words break-all">{content}</p>
                        <span className={`block text-2xs mt-1.5 text-right ${isMe ? 'text-primary-200' : 'text-slate-400'}`}>
                            {timeStr}
                        </span>
                    </div>
                )}

                {!isEditing && (
                    <button
                        ref={triggerRef}
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (showMenu) setShowMenu(false);
                            else openMenu();
                        }}
                        className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all ${isMe ? 'self-end' : 'self-start'} opacity-60 hover:opacity-100`}
                        aria-label="Message actions"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                )}
            </div>

            {showMenu && menuPos && (
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                    className="py-1 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-slate-200 dark:border-zinc-700 min-w-[130px]"
                >
                    <button
                        onClick={handleCopy}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                    </button>
                    {isMe && onStartEdit && (
                        <button
                            onClick={handleEditClick}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                        </button>
                    )}
                    {isMe && onDelete && (
                        <button
                            onClick={() => { setShowMenu(false); onDelete(); }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatMessageBubble;
