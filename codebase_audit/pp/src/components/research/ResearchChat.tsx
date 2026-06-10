
import React, { useState, useRef, useEffect } from 'react';
import { ResearchMessage, ResearchSource } from '../../types';
import { ResearchIcon, SendIcon, UserCircleIcon } from '../../constants';
import Tooltip from '../Tooltip';
import { parseAloaMarkdown } from '../../utils/markdownUtils';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { sanitize } from '../../utils/sanitization';

interface ResearchChatProps {
    messages: ResearchMessage[];
    sources: ResearchSource[];
    selectedSourceIds: string[];
    notebookId: string;
    onSendMessage: (notebookId: string, content: string, sourceIds?: string[]) => void;
}

const ChatBubble: React.FC<{ message: ResearchMessage; sources: ResearchSource[] }> = ({ message, sources }) => {
    const isUser = message.role === 'user';
    const contentHtml = parseAloaMarkdown(message.content);

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
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: sanitize(contentHtml) }} />
                    </div>

                    {/* Citations Footer (AI Only) */}
                    {!isUser && message.citations && message.citations.length > 0 && (
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

                    {/* Timestamp */}
                    <span className="text-[10px] text-slate-400 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {format(new Date(message.timestamp), 'h:mm a')}
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
                                Ask anything about your case files. The AI will respond with citations from your sources.
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
                                <ChatBubble key={msg.id} message={msg} sources={sources} />
                            ))}
                            {/* Typing indicator */}
                            {messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                                <div className="flex w-full mb-5 justify-start animate-fade-in-up">
                                    <div className="flex max-w-[85%] gap-2.5 flex-row">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-blue-600">
                                            <ResearchIcon className="w-4 h-4" />
                                        </div>
                                        <div className="px-4 py-3 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-tl-sm shadow-sm flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
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
                            placeholder="Ask about your sources... (Enter to send)"
                            className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white p-1.5 placeholder-slate-400 focus:ring-0 min-w-0 resize-none max-h-36 min-h-[36px] custom-scrollbar"
                            style={{ overflowY: input.split('\n').length > 1 ? 'auto' : 'hidden' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
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
