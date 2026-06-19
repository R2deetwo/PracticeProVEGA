import React, { useState, useEffect, useRef } from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { useConvex } from 'convex/react';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { AloaIcon, SparklesIcon, ZapIcon } from '../../constants';
import { AloaMessage } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import * as aiService from '../../services/aiService';
import { parseAloaMarkdown } from '../../utils/markdownUtils';
import { analyzeDocument } from '../../agents/AdvancedLegalDocumentIntelligenceAgent';
import { ModalType } from '../../types';
import { loadAloaXLibrary } from '../indexer/AloaXView';
import { getAssistantName, getChatPlaceholder } from '../../utils/assistantIdentity';

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

const ActionCard: React.FC<{
    actionName: string;
    args: any;
    onExecute: () => void;
    executed?: boolean
}> = ({ actionName, args, onExecute }) => {
    let label = "Open Item";
    const normalized = actionName.toLowerCase();
    if (normalized.includes('matter')) label = "Open Matter Form";
    else if (normalized.includes('contact')) label = "Open Contact Form";
    else if (normalized.includes('task')) label = "Open Task Form";
    else if (normalized.includes('drafting')) label = "Open Editor";
    else if (normalized.includes('workflow')) label = "Review Workflow";
    else if (normalized === 'note') label = "Open Note";

    const isCompleted = args?.context?.isCompleted;

    return (
        <div className={`mt-2 p-2 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700 ${isCompleted ? 'opacity-50' : ''}`}>
            <div className="text-[9px] text-primary-600 dark:text-primary-400 mb-1.5 font-bold uppercase tracking-widest flex justify-between items-center">
                <span>Action Available</span>
                {isCompleted && <span className="text-emerald-500 font-black">DONE</span>}
            </div>
            <button
                onClick={onExecute}
                disabled={isCompleted}
                className={`w-full py-1.5 rounded-lg text-[10px] font-bold transition-all ${isCompleted ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'}`}
            >
                {isCompleted ? 'Completed' : label}
            </button>
        </div>
    );
};

export const MiniAloa: React.FC = () => {
    const {
        isPanelOpen,
        togglePanel,
        closePanel,
        isMinimized,
        setIsMinimized,
        messages,
        setMessages,
        aloaState,
        isLoading,
        setIsLoading,
        preferredModel,
        localFiles,
        isFirmSearchEnabled,
        setIsFirmSearchEnabled,
        setActiveView,
        setQuickNoteContent
    } = useAloa();

    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser } = useAuth();
    const { currentHistoryEntry, addToast, openModal } = useUI();
    const { isProperty } = useProduct();
    const convex = useConvex();
    const [textInput, setTextInput] = useState('');
    const [miniStatus, setMiniStatus] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const handleSaveMessage = (content: string) => {
        setQuickNoteContent(content);
        setActiveView('quickNote');
        setIsMinimized(false);
        if (!isPanelOpen) togglePanel();
    };

    const mapToolToModal = (toolName: string, args: any): { modalType: ModalType, mappedArgs: any } | null => {
        const normalizedName = toolName.toLowerCase();
        const rawModalType = args.modalType || '';
        if (normalizedName === 'navigate_to' || normalizedName === 'start_drafting' || normalizedName === 'draft_workflow') return null;
        let targetModal: ModalType | null = null;
        if (normalizedName === 'open_modal') {
            if (rawModalType === 'create_matter' || rawModalType === 'newMatter') targetModal = 'newMatter';
            else if (rawModalType === 'create_contact' || rawModalType === 'newContact') targetModal = 'newContact';
            else if (rawModalType === 'create_property' || rawModalType === 'newProperty') targetModal = 'newProperty';
            else if (rawModalType === 'create_task' || rawModalType === 'newTask') targetModal = 'newTask';
            else targetModal = rawModalType as ModalType;
        } else if (normalizedName === 'create_matter') targetModal = 'newMatter';
        else if (normalizedName === 'create_contact') targetModal = 'newContact';
        else if (normalizedName === 'create_property') targetModal = 'newProperty';
        else if (normalizedName === 'create_task') targetModal = 'newTask';
        if (targetModal) return { modalType: targetModal, mappedArgs: args };
        return null;
    };

    const handleToolExecution = async (toolCalls: any[]): Promise<any[]> => {
        if (!toolCalls || toolCalls.length === 0) return [];
        const outputs: any[] = [];
        const isAdmin = currentUser?.role === 'Admin';
        for (const tool of toolCalls) {
            const { name, args } = tool;
            let feedback = "";
            let actionData: any = null;
            let toolOutput: any = { success: true };
            try {
                if (name === 'query_firm_data') {
                    const query = (args.query || '').toLowerCase();
                    const category = args.category || 'all';
                    const results: any = { tasks: [], notes: [], matters: [], documents: [] };
                    if (category === 'all' || category === 'tasks') results.tasks = (executionState.tasks || []).filter(t => t.title.toLowerCase().includes(query)).slice(0, 3);
                    if (category === 'all' || category === 'notes') results.notes = (documentState.notePages || []).filter(n => n.title.toLowerCase().includes(query)).slice(0, 5);
                    toolOutput = { results };
                } else if (name === 'analyze_document') {
                    const { sourceId, type } = args;
                    feedback = `Analyzing ${type}...`;
                    let analyzable: any = null;
                    if (type === 'document') {
                        const doc = documentState.documents?.find(d => d.id === sourceId);
                        if (doc) analyzable = { title: doc.title, content: doc.content, file: doc.file };
                    } else {
                        const note = documentState.notePages?.find(p => p.id === sourceId);
                        if (note) analyzable = { title: note.title, content: note.content };
                    }
                    if (analyzable) {
                        try {
                            const report = await analyzeDocument(analyzable);
                            toolOutput = { report };
                            feedback = `Analysis complete: ${report.summary}`;
                            actionData = { type: 'analysis', report, label: 'View Analysis' };
                        } catch (err: any) { toolOutput = { error: err.message }; feedback = `Analysis failed.`; }
                    } else { toolOutput = { error: "Not found" }; }
                } else {
                    const mapped = mapToolToModal(name, args);
                    if (mapped) {
                        openModal(mapped.modalType, null, { ...mapped.mappedArgs.context, openedByAloa: true });
                        feedback = `Opening form...`;
                    } else if (name === 'navigate_to') {
                        openModal(args.view, args.selectedId, args.context); // Simplified for mini
                        feedback = `Navigating...`;
                    }
                }
                if (feedback) {
                    const modelMsg: AloaMessage = { id: uuidv4(), role: 'model' as const, content: feedback, toolAction: actionData };
                    setMessages(prev => [...prev, modelMsg]);
                }
                outputs.push({ toolName: name, output: toolOutput });
            } catch (e) { outputs.push({ toolName: name, output: { error: String(e) } }); }
        }
        return outputs;
    };

    const handleSend = async () => {
        if (!textInput.trim() || isLoading) return;

        const content = textInput;
        const newUserMsg: AloaMessage = { id: uuidv4(), role: 'user', content };
        const streamId = uuidv4();

        setMessages(prev => [...prev, newUserMsg, { id: streamId, role: 'model', content: '' }]);
        setTextInput('');
        setIsLoading(true);
        setMiniStatus(isFirmSearchEnabled ? 'Searching…' : 'Thinking…');

        const effectiveModel = preferredModel === 'auto' ? 'flash' : preferredModel;
        const aiContext = {
            appState: { ...coreState, ...matterState, ...executionState, ...financeState, ...documentState } as any,
            currentUser: currentUser!,
            currentHistoryEntry,
            localFiles,
            aloaXLibrary: loadAloaXLibrary(),
            isFirmSearchEnabled,
            searchBrain: undefined as ((query: string) => Promise<string>) | undefined,
            conversationMemoryContext: null as string | null,
            proactiveInsights: null as { category: string; severity: string; title: string; body: string }[] | null,
        };

        try {
            const { brain } = await import('../../services/brainService');
            aiContext.searchBrain = async (query: string) => {
                if (!isFirmSearchEnabled) return '';
                setMiniStatus('Searching…');
                return await brain.search({
                    query,
                    firmId: coreState.firmDetails?.id || '',
                    convexQuery: (name: any, args: any) => convex.query(name, args),
                });
            };

            const wantsToolAction = /\b(create|open|add|new|draft|navigate|show me|find my|schedule|invoice|task|matter|contact)\b/i.test(content);

            if (!wantsToolAction) {
                setMiniStatus('Writing…');
                try {
                    const streamed = await aiService.streamMessage(
                        [...messages, newUserMsg],
                        aiContext,
                        (chunk) => {
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === streamId
                                        ? { ...m, content: `${typeof m.content === 'string' ? m.content : ''}${chunk}` }
                                        : m
                                )
                            );
                        },
                        effectiveModel
                    );
                    if (streamed.text?.trim()) {
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === streamId
                                    ? { id: streamId, role: 'model', content: streamed.text!, modelUsed: streamed.modelUsed }
                                    : m
                            )
                        );
                        return;
                    }
                } catch {
                    setMessages(prev => prev.map(m => (m.id === streamId ? { ...m, content: '' } : m)));
                }
            }

            setMiniStatus('Thinking…');
            const response = await aiService.sendMessage([...messages, newUserMsg], aiContext, effectiveModel);

            let currentResponse = response;
            let iterations = 0;
            while (currentResponse.toolCalls && currentResponse.toolCalls.length > 0 && iterations < 3) {
                iterations++;
                setMiniStatus('Using tools…');
                const toolOutputs = await handleToolExecution(currentResponse.toolCalls);
                const assistantToolCallMsg: AloaMessage = { id: uuidv4(), role: 'model', toolCalls: currentResponse.toolCalls };
                const toolResultsMsgs: AloaMessage[] = toolOutputs.map(o => ({ id: uuidv4(), role: 'tool' as const, toolResult: o }));
                const history = [...messages, newUserMsg, assistantToolCallMsg, ...toolResultsMsgs];
                setMiniStatus('Writing…');
                currentResponse = await aiService.sendMessage(history, aiContext, effectiveModel);
            }

            if (currentResponse.text) {
                setMessages(prev =>
                    prev.map(m =>
                        m.id === streamId
                            ? { id: streamId, role: 'model', content: currentResponse.text!, modelUsed: currentResponse.modelUsed }
                            : m
                    )
                );
            } else {
                setMessages(prev => prev.filter(m => m.id !== streamId));
            }
        } catch (error: any) {
            console.error('MiniAloa Error:', error);
            setMessages(prev => [
                ...prev.filter(m => m.id !== streamId),
                {
                    id: uuidv4(),
                    role: 'model' as const,
                    content: `Error: ${error.message || 'Connection failed'}`,
                    isError: true,
                },
            ]);
        } finally {
            setIsLoading(false);
            setMiniStatus('');
        }
    };

    const handleExpand = () => {
        setIsMinimized(false);
        if (!isPanelOpen) togglePanel();
    };

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const prevPosition = useRef({ x: 0, y: 0 });

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        isDragging.current = true;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        prevPosition.current = { x: clientX, y: clientY };
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging.current) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - prevPosition.current.x;
        const deltaY = clientY - prevPosition.current.y;

        setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        prevPosition.current = { x: clientX, y: clientY };
    };

    const handleDragEnd = () => {
        isDragging.current = false;
    };

    useEffect(() => {
        if (isDragging.current) {
            window.addEventListener('mousemove', handleDragMove as any);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDragMove as any);
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDragMove as any);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragMove as any);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging.current]);

    const { dockedModalType, view } = useUI();
    const isActive = aloaState !== 'idle' || isLoading;

    // HIDE MINI ARIA IF DOCKED MODAL IS OPEN (Side Panel)
    if (dockedModalType) return null;

    // FADE OUT IN CERTAIN VIEWS
    const isHidden = view === 'messaging' || view === 'research';
    if (isHidden) return null;

    return (
        <div
            className="
                fixed bottom-24 right-4 z-[2000] 
                w-[calc(100vw-32px)] md:w-80 h-[420px] max-h-[70dvh] rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]
                bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl 
                border border-white/20 dark:border-zinc-700/50
                flex flex-col overflow-hidden transition-all duration-300
            "
            style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
        >
            {/* Header - Draggable. CRITICAL: The buttons below have their own
                stopPropagation on onMouseDown/onTouchStart so the drag handler
                on this parent div doesn't intercept button taps. Without this,
                tapping the dismiss/expand button starts a drag instead of
                firing the button's onClick — this was the root cause of the
                persistent "close button doesn't work" bug. */}
            <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className="h-10 bg-slate-900/90 dark:bg-zinc-950/90 backdrop-blur-md flex items-center justify-between px-3 cursor-move active:cursor-grabbing select-none"
            >
                <div className="flex items-center gap-2 pointer-events-none">
                    <div className={`
                        w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-500
                        ${isActive ? (isFirmSearchEnabled ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-green-600 shadow-lg shadow-green-600/30') : 'bg-primary-500'}
                        ${isActive ? 'animate-pulse' : ''}
                    `}>
                        <AloaIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
                        {isLoading ? 'Processing' : `${getAssistantName(isProperty)} Mini`}
                    </span>
                </div>

                {/* Button container — stopPropagation on ALL pointer events
                    so the parent drag handler doesn't fire when tapping buttons. */}
                <div
                    className="flex items-center gap-0.5 relative z-10"
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-all active:scale-90 touch-target flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); handleExpand(); }}
                        title="Open Full Assistant"
                        aria-label="Expand to full panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                    </button>
                    <button
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all touch-target flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); closePanel(); }}
                        title="Dismiss"
                        aria-label="Dismiss panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-transparent custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-30 mt-4">
                        <AloaIcon className="w-10 h-10 text-slate-400 dark:text-zinc-600 mb-3" />
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Awaiting Query</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 group/msg`}>
                        <div className={`max-w-[90%] p-3 rounded-xl text-[12px] leading-relaxed shadow-sm relative ${msg.role === 'user'
                            ? 'bg-primary-600 text-white rounded-tr-none'
                            : msg.isError
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 rounded-tl-none border border-red-500/20'
                                : 'bg-white/80 dark:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 rounded-tl-none border border-slate-100 dark:border-zinc-700/50'
                            }`}>
                            <div
                                className="prose prose-xs dark:prose-invert max-w-none break-words"
                                dangerouslySetInnerHTML={{ __html: parseAloaMarkdown(msg.content || '') }}
                            />

                            {msg.toolAction && (
                                <ActionCard
                                    actionName={msg.toolAction.modalType || msg.toolAction.type || 'action'}
                                    args={{ context: msg.toolAction.context }}
                                    onExecute={() => {
                                        if (msg.toolAction.type === 'modal' || msg.toolAction.modalType) {
                                            openModal(msg.toolAction.modalType || (msg.toolAction.type as any), null, { ...msg.toolAction.context, openedByAloa: true });
                                        }
                                    }}
                                />
                            )}

                            {msg.role === 'model' && !msg.isError && (
                                <button
                                    onClick={() => handleSaveMessage(msg.content || '')}
                                    className="absolute -right-2 -bottom-2 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-md text-slate-400 hover:text-emerald-500 shadow-md opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-all active:scale-90 z-20"
                                    title="Save to Notes"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && miniStatus && (
                    <p className="text-[9px] font-medium text-primary-600 dark:text-primary-400 px-1 animate-pulse">{miniStatus}</p>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Overlay — RAG toggle removed per user request.
                The mini version is for quick questions only; firm search
                stays in the full panel. */}
            <div className="p-3 bg-white/50 dark:bg-zinc-950/50 border-t border-slate-200 dark:border-zinc-800">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                            <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-tighter">{preferredModel}</span>
                        </div>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex gap-2 items-end"
                    >
                        <div className="flex-1 flex items-center border transition-all rounded-2xl p-1 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-primary-500/20">
                            <input autoComplete="off" data-lpignore="true" 
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                placeholder={getChatPlaceholder(isProperty)}
                                className="flex-1 bg-transparent border-none text-[12px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 p-2 focus:ring-0"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!textInput.trim() || isLoading}
                                className="p-1.5 rounded-xl disabled:opacity-30 transition-all active:scale-95 bg-primary-600 text-white shadow-lg shadow-primary-500/20"
                            >
                                <SendIcon />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
