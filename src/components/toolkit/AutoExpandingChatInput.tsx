/**
 * AutoExpandingChatInput — a reusable chat input that mimics Gemini Mobile's
 * dynamic text area behavior.
 *
 * FEATURES:
 * - Auto-expands line-by-line as the user types (no horizontal scrolling)
 * - Max 3 lines of visible text, then vertical scroll inside the input
 * - resize: none (users can't drag-resize)
 * - Enter = newline (triggers expansion), Send button or Shift+Enter sends
 * - Smoothly contracts back down when deleting text
 * - minHeight = 1 line, maxHeight = 3 lines + padding
 *
 * USAGE:
 * <AutoExpandingChatInput
 *   value={text}
 *   onChange={setText}
 *   onSend={handleSend}
 *   placeholder="Type a message..."
 *   sendButtonClassName="bg-primary-600..."
 *   disabled={false}
 * />
 *
 * LAYOUT:
 * The outer container uses flexbox: textarea fills available width, send
 * button is flex-shrink-0. The parent should apply .chat-input-dock for
 * correct bottom-nav spacing on mobile.
 */
import React, { useRef, useEffect, useCallback } from 'react';

export interface AutoExpandingChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    placeholder?: string;
    /** Whether the input is disabled (e.g. while sending) */
    disabled?: boolean;
    /** Whether sending is disabled (e.g. empty message) */
    sendDisabled?: boolean;
    /** Optional send button label (defaults to icon only) */
    sendLabel?: string;
    /** Optional send button icon element */
    sendIcon?: React.ReactNode;
    /** Extra classes for the textarea */
    textareaClassName?: string;
    /** Extra classes for the send button */
    sendButtonClassName?: string;
    /** Extra classes for the container */
    containerClassName?: string;
    /** aria-label for the send button */
    sendAriaLabel?: string;
    /** Whether to autofocus on mount */
    autoFocus?: boolean;
    /** Whether to show a subtle hint below the input (e.g. "Shift+Enter to send") */
    hint?: string;
    /** Optional max lines before scrolling (default 3) */
    maxLines?: number;
    /** Send key behavior: 'shift-enter' (default, Enter=newline) or 'enter' (Enter=send, Shift+Enter=newline) */
    sendOnEnter?: boolean;
}

// Standard line-height for text-sm (0.875rem / 14px) is ~1.25rem (20px).
// We use this to compute the max-height: lineHeight * maxLines + padding.
const LINE_HEIGHT_REM = 1.25;
const TEXTAREA_PY_REM = 0.5; // py-2 = 0.5rem top + 0.5rem bottom = 1rem total

export const AutoExpandingChatInput: React.FC<AutoExpandingChatInputProps> = ({
    value,
    onChange,
    onSend,
    placeholder = 'Type a message...',
    disabled = false,
    sendDisabled = false,
    sendLabel,
    sendIcon,
    textareaClassName = '',
    sendButtonClassName = '',
    containerClassName = '',
    sendAriaLabel = 'Send message',
    autoFocus = false,
    hint,
    maxLines = 3,
    sendOnEnter = false,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Compute max-height from line-height * maxLines + vertical padding
    const maxHeightRem = LINE_HEIGHT_REM * maxLines + TEXTAREA_PY_REM * 2;

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        // Reset height to auto so scrollHeight reflects the actual content height
        el.style.height = 'auto';
        // Set to scrollHeight, capped at maxHeight
        const maxHeightPx = maxHeightRem * 16; // 1rem = 16px
        el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
    }, [maxHeightRem]);

    // Auto-resize on value change
    useEffect(() => {
        autoResize();
    }, [value, autoResize]);

    // Autofocus on mount
    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (sendOnEnter) {
            // Enter = send, Shift+Enter = newline
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!disabled && !sendDisabled) {
                    onSend();
                }
            }
        } else {
            // Shift+Enter = send, Enter = newline (default textarea behavior)
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                if (!disabled && !sendDisabled) {
                    onSend();
                }
            }
        }
    };

    const handleSendClick = () => {
        if (!disabled && !sendDisabled) {
            onSend();
        }
    };

    return (
        <div className={`flex items-end gap-2 ${containerClassName}`}>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                aria-label={placeholder}
                className={`flex-1 min-w-0 px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm rounded-xl border-0 focus:ring-2 focus:ring-primary-500 outline-none resize-none overflow-y-auto leading-relaxed ${textareaClassName}`}
                style={{
                    minHeight: `${(LINE_HEIGHT_REM + TEXTAREA_PY_REM * 2) * 16}px`,
                    maxHeight: `${maxHeightRem * 16}px`,
                }}
            />
            <button
                onClick={handleSendClick}
                disabled={disabled || sendDisabled}
                aria-label={sendAriaLabel}
                className={`flex-shrink-0 px-3 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${sendButtonClassName}`}
            >
                {sendIcon || (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                )}
                {sendLabel}
            </button>
            {hint && (
                <div className="absolute -bottom-5 left-3 text-2xs text-slate-400 pointer-events-none">
                    {hint}
                </div>
            )}
        </div>
    );
};

export default AutoExpandingChatInput;
