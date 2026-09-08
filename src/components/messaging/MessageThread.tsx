/**
 * MessageThread — the ONE shared thread-rendering surface for every
 * conversation kind (Path B presentation-layer unification).
 *
 * Consumers:
 *  - Team chat                 (MessagesView ChatWindow)      — variant 'team'
 *  - Client & Tenant threads   (MessagesView portal thread)   — variant 'client_tenant'
 *  - AI Assistant chat         (ResearchChat; AloaChat)       — variant 'ai'
 *
 * It owns: scroll container + auto-scroll + jump-to-bottom, day dividers,
 * sender grouping/avatars, alignment, bubble frame styling, the shared
 * attachment grid, deleted placeholders, failed/retry affordances.
 * It does NOT own: message data shapes (bring UnifiedMessage from
 * src/messaging/model.ts), composers (render your own input dock below),
 * or specialized bubble internals (use the render* slots).
 *
 * Slots (per message):
 *  - renderAboveBubble: badge strip above the bubble (ticket badge, PII shield…)
 *  - renderBubbleContent: replaces the plain-text body (AI markdown,
 *    progressive disclosure, streaming cursors…)
 *  - renderBelowBubble: below the bubble (threaded replies, citations,
 *    ticket controls, copy buttons…)
 *
 * MESSAGE ACTIONS (v2, 2026-09-08): pass canDeleteMessage /
 * onDeleteMessage / extraMessageActions to enable a ⋮ menu on every
 * message (touch-visible; hover-revealed on pointer devices) plus a
 * long-press / right-click context menu on the bubble itself. Copy text
 * is built-in. Consumers that render interactive bubbles (the team
 * thread's ChatMessageBubble) keep their own menus — the ⋮ is skipped
 * when renderBubble is provided.
 */
import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { UnifiedMessage } from '../../messaging/model';
import { getUserColor, getInitials, timeAgo } from '../../utils/colorUtils';

export type ThreadVariant = 'team' | 'client_tenant' | 'ai';

/** A custom entry in the per-message actions menu. */
export interface MessageActionItem {
    label: string;
    onSelect: () => void;
    danger?: boolean;
}

export interface MessageThreadProps {
    /** Pre-normalised messages (src/messaging/model.ts). Oldest-first is
     *  recommended; the component sorts defensively anyway. */
    messages: UnifiedMessage[];
    variant: ThreadVariant;
    /** Stable thread identity — scroll resets to bottom when it changes. */
    threadKey?: string;
    /** Replaces the plain-text bubble body (AI markdown etc.). */
    renderBubbleContent?: (msg: UnifiedMessage) => React.ReactNode;
    /** Replaces the WHOLE bubble (e.g. the team thread's interactive
     *  ChatMessageBubble with its edit/delete menu). Day dividers,
     *  grouping, alignment and scroll stay owned by MessageThread. */
    renderBubble?: (msg: UnifiedMessage) => React.ReactNode;
    /** Delete permission check — when provided AND true for a message,
     *  the actions menu shows a Delete entry for it. */
    canDeleteMessage?: (msg: UnifiedMessage) => boolean;
    /** Invoked when the user picks Delete in the actions menu. The
     *  consumer owns confirmation (ConfirmDialog) + the backend call +
     *  toast feedback. */
    onDeleteMessage?: (msg: UnifiedMessage) => void;
    /** Extra per-message menu entries (Reply, Forward, …) appended after
     *  Copy and Delete. */
    extraMessageActions?: (msg: UnifiedMessage) => MessageActionItem[];
    /** Badge strip rendered above the bubble (ticket badges, PII shield). */
    renderAboveBubble?: (msg: UnifiedMessage) => React.ReactNode;
    /** Rendered below the bubble (threaded replies, citations, actions). */
    renderBelowBubble?: (msg: UnifiedMessage) => React.ReactNode;
    /** Replaces the other-side avatar (AI assistant branding). */
    renderAvatar?: (msg: UnifiedMessage) => React.ReactNode;
    /** Retry handler — shows a Retry affordance on failed messages. */
    onRetry?: (id: string) => void;
    /** Custom empty state; defaults to a quiet centered hint. */
    emptyState?: React.ReactNode;
    /** Extra classes for the scroll container (width constraints etc.). */
    className?: string;
    /** Inner content width wrapper — defaults to max-w-3xl. */
    innerClassName?: string;
    /** Bubble frame style override (AloaChat's glassy AI style). */
    bubbleClassName?: (msg: UnifiedMessage) => string;
    /** Hide avatars entirely (compact AI threads). */
    showAvatars?: boolean;
    /** EMBEDDED MODE: don't render the scroll container or any scroll
     *  behavior — the PARENT owns scrolling (AloaChat's scroll-to-top /
     *  jump-to-bottom architecture). MessageThread then owns only the
     *  message rendering: day dividers, alignment, bubble frames, slots. */
    embedded?: boolean;
}

// ─── Day divider ──────────────────────────────────────────────────────────
const isSameDay = (a: number, b: number) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear()
        && da.getMonth() === db.getMonth()
        && da.getDate() === db.getDate();
};

const formatDay = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    if (isSameDay(ts, today.getTime())) return 'Today';
    if (isSameDay(ts, yesterday.getTime())) return 'Yesterday';
    return d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' });
};

const DayDivider: React.FC<{ ts: number }> = ({ ts }) => (
    <div className="flex items-center gap-3 my-4 px-1">
        <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
            {formatDay(ts)}
        </span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
    </div>
);

// ─── Shared attachment grid (was triplicated across 3 views) ──────────────
const AttachmentGrid: React.FC<{ msg: UnifiedMessage; isMe: boolean }> = ({ msg, isMe }) => {
    if (!msg.attachments || msg.attachments.length === 0) return null;
    const convexBase = (import.meta as any).env?.VITE_CONVEX_URL || '';
    return (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
            {msg.attachments.map((att, idx) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(att.name);
                const url = `${convexBase}/api/storage/${att.storageId}`;
                if (isImage) {
                    return (
                        <a key={att.storageId + idx} href={url} target="_blank" rel="noopener noreferrer"
                            className="block rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                            <img src={url} alt={att.name} className="w-full h-24 object-cover" />
                        </a>
                    );
                }
                return (
                    <a key={att.storageId + idx} href={url} target="_blank" rel="noopener noreferrer"
                        className={`rounded-lg flex items-center gap-2 px-2.5 py-1.5 ${isMe ? 'bg-primary-500/30' : 'bg-slate-100 dark:bg-zinc-700'} hover:opacity-80 transition-opacity`}>
                        <svg className={`w-4 h-4 flex-shrink-0 ${isMe ? 'text-primary-200' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className={`text-xs truncate flex-1 ${isMe ? 'text-primary-100' : 'text-slate-600 dark:text-zinc-300'}`}>{att.name}</span>
                    </a>
                );
            })}
        </div>
    );
};

// ─── Bubble frame ─────────────────────────────────────────────────────────
const defaultBubbleClassName = (msg: UnifiedMessage, variant: ThreadVariant): string => {
    if (variant === 'ai') {
        if (msg.sender.role === 'user') {
            return 'bg-primary-600 text-white rounded-2xl rounded-tr-sm shadow-sm';
        }
        if (msg.deliveryStatus === 'failed') {
            return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 rounded-2xl rounded-tl-sm';
        }
        return 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-2xl rounded-tl-sm shadow-sm';
    }
    // team + client_tenant share the same bubble language
    return msg.isMe
        ? 'bg-primary-600 text-white rounded-2xl rounded-br-md shadow-sm'
        : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-2xl rounded-bl-md shadow-sm';
};

// ─── Message actions (v2) ─────────────────────────────────────────────────
// Clipboard with WebView fallback — the Android APK's WebView doesn't
// always expose the async clipboard API for writeText.
const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* fall through to the legacy path */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch {
        return false;
    }
};

// Compact icon set for the menu (inline so this file stays dependency-free)
const CopyIcon = () => (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);
const CheckIcon = () => (
    <svg className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);
const TrashIcon = () => (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);
const DotIcon = () => (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
);
const DotsIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
    </svg>
);

interface MessageActionsMenuProps {
    top: number;
    left: number;
    onClose: () => void;
    /** Message text to copy. When undefined, no Copy entry is shown. */
    copyText?: string;
    items: MessageActionItem[];
}

/** Floating actions menu — rendered via React Portal to document.body so it
 *  escapes every overflow/stacking context (same pattern the team thread's
 *  ChatMessageBubble menu uses). Fixed position, viewport-clamped.
 *  Exported so bespoke thread renderers (TenantPortal, ClientDashboard)
 *  can reuse the exact same menu UX without adopting MessageThread. */
export const MessageActionsMenu: React.FC<MessageActionsMenuProps> = ({ top, left, onClose, copyText, items }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const [pos, setPos] = useState({ top, left });

    // Clamp into the viewport once the real size is measurable.
    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        let t = top;
        let l = left;
        if (t + height > window.innerHeight - 8) t = Math.max(8, window.innerHeight - height - 8);
        if (l + width > window.innerWidth - 8) l = Math.max(8, window.innerWidth - width - 8);
        setPos({ top: t, left: l });
    }, [top, left]);

    // Esc closes; outside mousedown closes (delayed a tick so the opening
    // interaction doesn't immediately close it).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        const onMouse = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('keydown', onKey);
        const timer = setTimeout(() => document.addEventListener('mousedown', onMouse), 0);
        return () => {
            document.removeEventListener('keydown', onKey);
            clearTimeout(timer);
            document.removeEventListener('mousedown', onMouse);
        };
    }, [onClose]);

    const handleCopy = async () => {
        if (!copyText) return;
        const ok = await copyToClipboard(copyText);
        if (ok) {
            setCopied(true);
            setTimeout(() => { setCopied(false); onClose(); }, 900);
        } else {
            onClose();
        }
    };

    const itemCls = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left transition-colors';
    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label="Message actions"
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-700 py-1 min-w-[160px] animate-in fade-in-0 zoom-in-95 duration-100"
        >
            {copyText !== undefined && (
                <button role="menuitem" onClick={handleCopy} className={`${itemCls} text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700`}>
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    <span>{copied ? 'Copied!' : 'Copy text'}</span>
                </button>
            )}
            {items.map((item) => (
                <button
                    key={item.label}
                    role="menuitem"
                    onClick={() => { onClose(); item.onSelect(); }}
                    className={`${itemCls} ${item.danger
                        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700'}`}
                >
                    {item.danger ? <TrashIcon /> : <DotIcon />}
                    <span>{item.label}</span>
                </button>
            ))}
        </div>,
        document.body
    );
};

// ─── MessageThread ────────────────────────────────────────────────────────
export const MessageThread: React.FC<MessageThreadProps> = ({
    messages,
    variant,
    threadKey = 'default',
    renderBubbleContent,
    renderBubble,
    canDeleteMessage,
    onDeleteMessage,
    extraMessageActions,
    renderAboveBubble,
    renderBelowBubble,
    renderAvatar,
    onRetry,
    emptyState,
    className = '',
    innerClassName = 'max-w-3xl mx-auto w-full',
    bubbleClassName,
    showAvatars = true,
    embedded = false,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // ── Message actions (v2) ──
    // Opt-in: only when a consumer passes action props AND doesn't render
    // its own interactive bubble (the team thread's ChatMessageBubble has
    // its own menu). AI threads keep their bespoke action rows.
    const actionsEnabled = !renderBubble
        && variant !== 'ai'
        && !!(canDeleteMessage || onDeleteMessage || extraMessageActions);
    const [menu, setMenu] = useState<{ msgId: string; top: number; left: number } | null>(null);
    const closeMenu = useCallback(() => setMenu(null), []);

    // Thread switch dismisses any open menu.
    useEffect(() => { setMenu(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [threadKey]);

    // Open from the ⋮ trigger — anchored below the button, aligned to the
    // bubble's side so it visually belongs to the message.
    const openMenuFromTrigger = useCallback((rect: DOMRect, msg: UnifiedMessage) => {
        const menuWidth = 170;
        let left = msg.isMe ? rect.right - menuWidth : rect.left;
        if (left < 8) left = 8;
        setMenu({ msgId: msg.id, top: rect.bottom + 4, left });
    }, []);

    // Open from a contextmenu event (Android long-press / desktop
    // right-click) — anchored at the pointer itself.
    const openMenuAtPoint = useCallback((x: number, y: number, msg: UnifiedMessage) => {
        setMenu({ msgId: msg.id, top: y + 6, left: x });
    }, []);

    const sorted = React.useMemo(
        () => [...messages].sort((a, b) => a.sentAt - b.sentAt),
        [messages],
    );

    // Items for the currently-open menu (Copy is handled inside the menu
    // component itself; these are the consumer-provided entries).
    const activeMenuMsg = menu ? sorted.find(m => m.id === menu.msgId) : undefined;
    const activeMenuItems: MessageActionItem[] = activeMenuMsg
        ? [
            ...(extraMessageActions?.(activeMenuMsg) || []),
            ...(canDeleteMessage?.(activeMenuMsg) && onDeleteMessage
                ? [{ label: 'Delete message', danger: true as const, onSelect: () => onDeleteMessage(activeMenuMsg) }]
                : []),
        ]
        : [];

    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setIsAtBottom(scrollHeight - scrollTop - clientHeight < 100);
    }, []);

    // Auto-scroll: stick to bottom on new messages when already at bottom
    // or when the newest message is the user's own (matches prior ChatWindow
    // behaviour across all threads). Skipped in embedded mode — the parent
    // owns scrolling there.
    useEffect(() => {
        if (embedded) return;
        const last = sorted[sorted.length - 1];
        if (isAtBottom || last?.isMe) {
            const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            return () => clearTimeout(t);
        }
    }, [sorted, isAtBottom, embedded]);

    // Thread switch: jump straight to bottom without smooth scroll.
    useEffect(() => {
        if (embedded || sorted.length === 0) {
            endRef.current?.scrollIntoView({ behavior: 'auto' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadKey]);

    const showAvatarsForMsg = (msg: UnifiedMessage, idx: number) => {
        if (!showAvatars || msg.isMe) return false;
        if (variant === 'ai') return true; // AI keeps its branded avatar on every turn
        const prev = sorted[idx - 1];
        return !prev || prev.sender.id !== msg.sender.id || prev.sender.name !== msg.sender.name;
    };

    const body = (
        <>
            <div className={`${innerClassName} ${embedded ? '' : 'pb-4'}`}>
                {sorted.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        {emptyState !== undefined ? emptyState : (
                            <>
                                <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-slate-400 dark:text-zinc-500">No messages yet. Start the conversation!</p>
                            </>
                        )}
                    </div>
                )}

                {sorted.map((msg, idx) => {
                    const prev = sorted[idx - 1];
                    const showDivider = !prev || !isSameDay(prev.sentAt, msg.sentAt);
                    const showAvatar = showAvatarsForMsg(msg, idx);
                    const failed = msg.deliveryStatus === 'failed' || msg.deliveryStatus === 'sent_failed';
                    const senderLabel = msg.isMe
                        ? 'You'
                        : (msg.sender.name || (msg.sender.contact || 'Unknown'));

                    if (msg.isDeleted) {
                        return (
                            <React.Fragment key={msg.id}>
                                {showDivider && <DayDivider ts={msg.sentAt} />}
                                <div className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} my-1`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                                        msg.isMe
                                            ? 'bg-primary-600/20 text-primary-300/60 dark:text-primary-400/40 rounded-tr-none italic'
                                            : 'bg-white dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 border border-slate-200/50 dark:border-zinc-700/50 rounded-tl-none italic'
                                    }`}>
                                        <p className="text-xs">This message was deleted</p>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment key={msg.id}>
                            {showDivider && <DayDivider ts={msg.sentAt} />}
                            <div className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} group ${showAvatar || variant === 'ai' ? 'mt-4' : 'mt-1'}`}>
                                {/* Avatar column */}
                                {showAvatar && !msg.isMe && (
                                    renderAvatar
                                        ? <div className="mr-2.5 mt-0.5 flex-shrink-0">{renderAvatar(msg)}</div>
                                        : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 mr-2.5 mt-0.5 ${getUserColor(msg.sender.name || 'U')}`}>
                                            {getInitials(msg.sender.name || 'U')}
                                        </div>
                                )}

                                <div
                                    className={`flex flex-col min-w-0 ${msg.isMe ? 'items-end' : 'items-start'} ${variant === 'ai' ? (msg.isMe ? 'max-w-[88%]' : 'w-full max-w-[88%]') : 'max-w-[85%]'}`}
                                    onContextMenu={actionsEnabled ? (e) => {
                                        // Android long-press + desktop right-click both land
                                        // here; our menu replaces the native one.
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openMenuAtPoint(e.clientX, e.clientY, msg);
                                    } : undefined}
                                >
                                    {/* Sender label + relative time — human threads only */}
                                    {variant !== 'ai' && (
                                        <div className={`flex items-center gap-1.5 mb-1 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                                            <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500">{senderLabel}</span>
                                            <span className="text-2xs text-slate-300 dark:text-zinc-600">
                                                {msg.sentAt ? timeAgo(new Date(msg.sentAt).toISOString()) : ''}
                                            </span>
                                            {actionsEnabled && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openMenuFromTrigger(e.currentTarget.getBoundingClientRect(), msg);
                                                    }}
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-700/70 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-400 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                                                    aria-label="Message actions"
                                                    title="Message actions (or long-press the message)"
                                                >
                                                    <DotsIcon />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Badge strip above the bubble (ticket badge, PII shield…) */}
                                    {renderAboveBubble?.(msg)}

                                    {/* Bubble — fully replaceable for interactive bubbles
                                        (team ChatMessageBubble with edit/delete menu). */}
                                    {renderBubble ? renderBubble(msg) : (
                                        <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm min-w-0 box-border ${
                                            bubbleClassName ? bubbleClassName(msg) : defaultBubbleClassName(msg, variant)
                                        } ${failed ? 'border border-red-300 dark:border-red-700' : ''}`}>
                                            {msg.subject && (
                                                <p className={`text-xs font-bold mb-1 ${msg.isMe ? 'text-primary-100' : 'text-slate-500 dark:text-zinc-400'}`}>
                                                    {msg.subject}
                                                </p>
                                            )}
                                            {renderBubbleContent
                                                ? renderBubbleContent(msg)
                                                : <span className="text-sm leading-relaxed whitespace-pre-wrap break-words break-all">{msg.content}</span>
                                            }
                                            <AttachmentGrid msg={msg} isMe={msg.isMe} />
                                            {failed && onRetry && (
                                                <button onClick={() => onRetry(msg.id)}
                                                    className="text-2xs text-red-400 hover:text-red-300 font-bold ml-2">
                                                    Retry
                                                </button>
                                            )}
                                            {msg.isEdited && (
                                                <span className={`block text-2xs mt-0.5 text-right italic ${msg.isMe ? 'text-primary-200' : 'text-slate-400'}`}>edited</span>
                                            )}
                                        </div>
                                    )}

                                    {renderBelowBubble?.(msg)}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={endRef} />
            </div>
            {menu && activeMenuMsg && (
                <MessageActionsMenu
                    top={menu.top}
                    left={menu.left}
                    onClose={closeMenu}
                    copyText={activeMenuMsg.content}
                    items={activeMenuItems}
                />
            )}
        </>
    );

    if (embedded) {
        return <div className={className}>{body}</div>;
    }

    return (
        <div className={`relative flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar scroll-smooth ${className}`}
            ref={scrollRef} onScroll={handleScroll}>
            {body}

            {/* Jump to bottom — appears whenever the user scrolls up */}
            {isAtBottom || sorted.length === 0 ? null : (
                <button
                    onClick={() => endRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="sticky bottom-4 ml-auto mr-2 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 shadow-lg text-slate-500 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors"
                    aria-label="Scroll to latest message"
                    title="Jump to latest"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7M14 6l-2-2-2 2" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default MessageThread;
