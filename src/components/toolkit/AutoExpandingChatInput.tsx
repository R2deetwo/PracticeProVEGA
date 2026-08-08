/**
 * AutoExpandingChatInput — a reusable chat input with attachment + voice support.
 *
 * FEATURES:
 * - Auto-expands line-by-line as the user types
 * - Max 3 lines of visible text, then vertical scroll
 * - Attachment button (paperclip) in a styled container matching the Send button
 * - Voice note recording via MediaRecorder API
 * - Pending attachment previews (filename + remove X)
 * - Active recording state with timer + cancel/stop controls
 * - Send button or Shift+Enter sends
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';

export interface PendingAttachment {
    storageId: string;
    name: string;
    size?: number;
    type?: string;
}

export interface AutoExpandingChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    placeholder?: string;
    disabled?: boolean;
    sendDisabled?: boolean;
    sendLabel?: string;
    sendIcon?: React.ReactNode;
    textareaClassName?: string;
    sendButtonClassName?: string;
    containerClassName?: string;
    sendAriaLabel?: string;
    autoFocus?: boolean;
    hint?: string;
    maxLines?: number;
    sendOnEnter?: boolean;
    /** Pending file attachments to display as chips */
    attachments?: PendingAttachment[];
    /** Remove an attachment by index */
    onRemoveAttachment?: (index: number) => void;
    /** Click handler for the paperclip/attach button */
    onAttachClick?: () => void;
    /** Whether to show the voice note mic button */
    showVoiceButton?: boolean;
    /** Callback when a voice note is recorded (receives the audio blob) */
    onVoiceRecorded?: (blob: Blob, duration: number) => void;
}

const LINE_HEIGHT_REM = 1.25;
const TEXTAREA_PY_REM = 0.5;

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
    attachments = [],
    onRemoveAttachment,
    onAttachClick,
    showVoiceButton = false,
    onVoiceRecorded,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordTime, setRecordTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordStartRef = useRef<number>(0);

    const maxHeightRem = LINE_HEIGHT_REM * maxLines + TEXTAREA_PY_REM * 2;

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const maxHeightPx = maxHeightRem * 16;
        el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
    }, [maxHeightRem]);

    useEffect(() => { autoResize(); }, [value, autoResize]);

    useEffect(() => {
        if (autoFocus && textareaRef.current) textareaRef.current.focus();
    }, [autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (sendOnEnter) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!disabled && !sendDisabled) onSend();
            }
        } else {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                if (!disabled && !sendDisabled) onSend();
            }
        }
    };

    const handleSendClick = () => {
        if (!disabled && !sendDisabled) onSend();
    };

    // ─── Voice Recording ──────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const duration = Math.floor((Date.now() - recordStartRef.current) / 1000);
                if (onVoiceRecorded && blob.size > 0) {
                    onVoiceRecorded(blob, duration);
                }
                stream.getTracks().forEach(t => t.stop());
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            recordStartRef.current = Date.now();
            setIsRecording(true);
            setRecordTime(0);

            recordTimerRef.current = setInterval(() => {
                setRecordTime(Math.floor((Date.now() - recordStartRef.current) / 1000));
            }, 1000);
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    };

    const stopRecording = (send: boolean) => {
        if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            if (!send) {
                // Cancel — stop without calling onstop handler
                mediaRecorderRef.current.onstop = null;
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setRecordTime(0);
    };

    useEffect(() => {
        return () => {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, []);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    // ─── Recording State UI ───────────────────────────────────────────
    if (isRecording) {
        return (
            <div className={`flex items-center gap-2 ${containerClassName}`}>
                {/* Recording indicator */}
                <div className="flex-1 flex items-center gap-3 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                        {formatTime(recordTime)}
                    </span>
                    {/* Waveform bars */}
                    <div className="flex items-center gap-0.5 flex-1">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-red-400 rounded-full"
                                style={{
                                    height: `${Math.random() * 16 + 4}px`,
                                    animation: `pulse 0.8s ease-in-out ${i * 0.05}s infinite alternate`,
                                }}
                            />
                        ))}
                    </div>
                </div>
                {/* Cancel */}
                <button
                    onClick={() => stopRecording(false)}
                    className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center"
                    aria-label="Cancel recording"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
                {/* Stop & Send */}
                <button
                    onClick={() => stopRecording(true)}
                    className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center"
                    aria-label="Stop and send voice note"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                </button>
            </div>
        );
    }

    // ─── Normal Input State ───────────────────────────────────────────
    return (
        <div className={containerClassName}>
            {/* Pending attachment chips */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs max-w-full min-w-0">
                            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300 min-w-0">{att.name}</span>
                            {att.size && <span className="text-2xs text-slate-400 flex-shrink-0">{formatFileSize(att.size)}</span>}
                            {onRemoveAttachment && (
                                <button onClick={() => onRemoveAttachment(i)} className="text-slate-400 hover:text-red-500 ml-0.5 flex-shrink-0">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-end gap-2">
                {/* Attachment button — styled to match Send button */}
                {onAttachClick && (
                    <button
                        onClick={onAttachClick}
                        disabled={disabled}
                        className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-50"
                        title="Attach file"
                        aria-label="Attach file"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.55 18.327a1.5 1.5 0 01-2.122-2.122l10.94-10.94" />
                        </svg>
                    </button>
                )}
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
                {/* Voice note button */}
                {showVoiceButton && !value.trim() && (
                    <button
                        onClick={startRecording}
                        disabled={disabled}
                        className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center disabled:opacity-50"
                        title="Record voice note"
                        aria-label="Record voice note"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                    </button>
                )}
                <button
                    onClick={handleSendClick}
                    disabled={disabled || sendDisabled}
                    aria-label={sendAriaLabel}
                    className={`flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${sendButtonClassName}`}
                >
                    {sendIcon || (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    )}
                    {sendLabel}
                </button>
            </div>
            {hint && (
                <div className="absolute -bottom-5 left-3 text-2xs text-slate-400 pointer-events-none">
                    {hint}
                </div>
            )}
        </div>
    );
};

export default AutoExpandingChatInput;
