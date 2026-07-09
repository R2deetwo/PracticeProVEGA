
import React, { useState, useRef, useEffect } from 'react';
import { ResearchMessage, ResearchSource } from '../../types';
import { ResearchIcon, SendIcon, UserCircleIcon } from '../../constants';
import Tooltip from '../Tooltip';
import { parseAloaMarkdown } from '../../utils/markdownUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { sanitize } from '../../utils/sanitization';
import { useProduct } from '../../contexts/ProductContext';

interface ResearchChatProps {
    messages: ResearchMessage[];
    sources: ResearchSource[];
    selectedSourceIds: string[];
    notebookId: string;
    onSendMessage: (notebookId: string, content: string, sourceIds?: string[]) => void;
}

// Safe timestamp formatter — won't crash on invalid dates
function safeFormatTime(timestamp: string | undefined): string {
    try {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
        return '';
    }
}

const ChatBubble: React.FC<{ message: ResearchMessage; sources: ResearchSource[] }> = ({ message, sources }) => {
    const isUser = message.role === 'user';
    const isThinking = (message as any).isThinking === true;
    const [copied, setCopied] = useState(false);

    // Don't parse markdown for thinking messages — just show a spinner
    const contentHtml = isThinking ? '' : parseAloaMarkdown(message.content || '');

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex w-full mb-5 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            <div className={`flex max-w-[85%] md:max-w-[75%] gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 ${isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-blue-600'
                    }`}>
                    {isUser ? <UserCircleIcon className="w-4 h-4" /> : <ResearchIcon className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}>
                    <div className={`
                        px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                        ${isUser
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                        }
                    `}>
                        {isThinking ? (
                            <div className="flex items-center gap-1.5 py-1">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                <span className="text-xs text-slate-400 ml-1">Analyzing sources...</span>
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: sanitize(contentHtml) }} />
                        )}
                    </div>

                    {/* Copy button — AI messages only, appears on hover */}
                    {!isUser && !isThinking && message.content && (
                        <button
                            onClick={handleCopy}
                            className={`mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold transition-all flex items-center gap-1 ${
                                copied
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100'
                            }`}
                            title="Copy response"
                        >
                            {copied ? (
                                <>
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    Copied
                                </>
                            ) : (
                                <>
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                    </svg>
                                    Copy
                                </>
                            )}
                        </button>
                    )}

                    {/* Citations Footer (AI Only) */}
                    {!isUser && !isThinking && message.citations && message.citations.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                            {message.citations.map((citation, index) => {
                                const source = sources.find(s => s.id === citation.sourceId);
                                if (!source) return null;
                                return (
                                    <Tooltip key={index} text={citation.snippet || "Source Reference"}>
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-[10px] text-blue-700 dark:text-blue-300 cursor-help">
                                            <span className="font-bold">[{index + 1}]</span>
                                            <span className="truncate max-w-[100px]">{source.name}</span>
                                        </div>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    )}

                    {/* Timestamp — safe formatted */}
                    <span className="text-[10px] text-slate-400 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {safeFormatTime(message.timestamp)}
                    </span>
                </div>
            </div>
        </div>
    );
};

const STARTER_PROMPTS = [
    'Summarize the key facts of this case',
    'Identify all parties and their roles',
    'What are the main legal issues?',
    'Draft an IRAC analysis for liability',
];

export const ResearchChat: React.FC<ResearchChatProps> = ({
    messages,
    sources,
    selectedSourceIds,
    notebookId,
    onSendMessage
}) => {
    const { addToast } = useUI();
    const { isProperty } = useProduct();
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages.length, notebookId]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(notebookId, input.trim(), selectedSourceIds.length > 0 ? selectedSourceIds : undefined);
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    // Check if the last message is a "thinking" AI message
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const isAiThinking = lastMessage?.role === 'model' && (lastMessage as any).isThinking === true;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900/50 relative overflow-hidden">

            {/* Context pill */}
            <div className="flex-shrink-0 flex justify-center pt-3 pb-1 px-4">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${selectedSourceIds.length > 0
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedSourceIds.length > 0 ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
                    {selectedSourceIds.length > 0
                        ? `${selectedSourceIds.length} source${selectedSourceIds.length === 1 ? '' : 's'} selected`
                        : `All ${sources.length} source${sources.length === 1 ? '' : 's'} in context`
                    }
                </div>
            </div>

            {/* Messages Area */}
            <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar scroll-smooth">
                <div className="max-w-3xl mx-auto w-full">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="p-3.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl mb-4">
                                <ResearchIcon className="w-7 h-7 text-blue-500" />
                            </div>
                            <h3 className="text-base font-bold text-slate-700 dark:text-zinc-300">Argument Lab</h3>
                            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs mt-1.5">
                                Ask anything about your {isProperty ? 'documents' : 'case files'}. The AI will respond with citations from your sources.
                            </p>

                            {sources.length > 0 && (
                                <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-sm mx-auto">
                                    {STARTER_PROMPTS.map(prompt => (
                                        <button
                                            key={prompt}
                                            onClick={() => setInput(prompt)}
                                            className="p-2.5 text-left bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-600 transition-all text-xs font-medium text-slate-600 dark:text-zinc-400 shadow-sm hover:shadow-md"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {sources.length === 0 && (
                                <p className="mt-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg">
                                    Add at least one source to begin asking questions
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="pb-4">
                            {messages.map(msg => (
                                <ChatBubble key={msg.id || Math.random()} message={msg} sources={sources} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 sm:px-6 bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 shrink-0">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-end gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 focus-within:border-blue-400 dark:focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder={isAiThinking ? "AI is analyzing..." : "Ask about your sources... (Enter to send)"}
                            disabled={isAiThinking}
                            className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white p-1.5 placeholder-slate-400 focus:ring-0 min-w-0 resize-none max-h-36 min-h-[36px] custom-scrollbar disabled:opacity-50"
                            style={{ overflowY: input.split('\n').length > 1 ? 'auto' : 'hidden' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isAiThinking}
                            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 shadow-sm"
                        >
                            <SendIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-1.5">Shift+Enter for new line</p>
                </div>
            </div>
        </div>
    );
};
