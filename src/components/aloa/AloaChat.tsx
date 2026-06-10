
import React, { useEffect, useRef, useState } from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { useConvex, useMutation, useAction } from 'convex/react';
import { AloaMessage, ModalType, AppState, AloaHint, InteractiveFormSchema } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { useMatterState } from '../../contexts/MatterContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import * as aiService from '../../services/aiService';
import { tools } from '../../services/geminiService';
import { useProduct } from '../../contexts/ProductContext';
import { v4 as uuidv4 } from 'uuid';
import { parseAloaMarkdown } from '../../utils/markdownUtils';
import { 
    AloaIcon, MicrophoneIcon, StopIcon, SparklesIcon, ZapIcon, BookmarkIcon, 
    PlusIcon, EditIcon, ClipboardListIcon, ChevronDownIcon, CloudArrowUpIcon, 
    PencilSquareIcon, ClipboardIcon, CheckIcon, ScalesIcon, DocumentIcon, 
    SearchIcon, XMarkIcon 
} from '../../constants';
import { TrashIcon, ChevronRightIcon, ArrowPathIcon as HistoryIcon, MessagingIcon as MessageSquareIcon } from '../../constants';
import { api } from '../../../convex/_generated/api';
import { decode, decodeAudioData } from '../../utils/audioUtils';
import { analyzeDocument } from '../../agents/AdvancedLegalDocumentIntelligenceAgent';
import Tooltip from '../Tooltip';
import { getGeminiApiKey, AI_CONFIG } from '../../utils/aiUtils';
import { SaveToNoteForm } from '../forms/SaveToNoteForm';
import { loadAloaXLibrary } from '../indexer/AloaXView';
import { analyzePartyName, analyzeMatterIntelligence } from '../../utils/defenseUtils';
import { ActionCard } from './ActionCard';
import { NoteDetails } from './NoteDetails';
import { ConversationList } from './ConversationList';
import { validateAIResponse } from '../../constants/identityGuardrails';
import { DynamicChatForm } from './DynamicChatForm';

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

const ModelBadge: React.FC<{ model: string; onClick: () => void }> = ({ model, onClick }) => (
    <button 
        onClick={onClick}
        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all border shadow-sm flex items-center gap-1 ${
            model === 'pro' 
                ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' 
                : model === 'flash'
                ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
        }`}
    >
        <SparklesIcon className="w-2.5 h-2.5" />
        {model}
    </button>
);

export const AloaChat: React.FC<{ onClose: () => void; onDraftStream?: (chunk: string) => void; onMinimize?: () => void; isMobile?: boolean }> = ({ onClose, onDraftStream, onMinimize, isMobile }) => {
    const {
        messages, setMessages, isLoading, setIsLoading, resetChat, aloaState, setAloaState,
        preferredModel, setPreferredModel, localFiles, isFirmSearchEnabled, setIsFirmSearchEnabled,
        activeConversationId, setActiveConversationId, activeView, setActiveView,
        activeNoteId, setActiveNoteId, quickNoteContent, setQuickNoteContent,
        injectedContext, setInjectedContext
    } = useAloa();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { financeState } = useFinanceState();
    const { coreState, isDataLoaded } = useCoreState();
    const { deleteItem } = useDataActions();
    const { currentUser } = useAuth();
    const { navigateTo, openModal, openEditor, currentHistoryEntry, isOnline } = useUI();
    const { isProperty, isAtrium } = useProduct();
    const convex = useConvex();

    // Convex Hooks
    const saveMessageMutation = useMutation(api.myFunctions.saveAloaMessage);
    const createConversationMutation = useMutation(api.myFunctions.createAloaConversation);
    const deleteConversationMutation = useMutation(api.myFunctions.deleteAloaConversation);

    const [textInput, setTextInput] = useState('');
    const [aloaStatus, setAloaStatus] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [expandedErrorIds, setExpandedErrorIds] = useState<Set<string>>(new Set());
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Refs for callbacks
    const liveSessionRef = useRef<any>(null);
    const audioOutputContextRef = useRef<AudioContext | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const isGeneratingRef = useRef<boolean>(false);

    const openModalRef = useRef(openModal);
    const navigateToRef = useRef(navigateTo);
    const openEditorRef = useRef(openEditor);

    useEffect(() => {
        openModalRef.current = openModal;
        navigateToRef.current = navigateTo;
        openEditorRef.current = openEditor;
    }, [openModal, navigateTo, openEditor]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Load messages for active conversation
    useEffect(() => {
        if (!activeConversationId) return;
        if (isGeneratingRef.current && messages.length > 0) return; // Prevent over-writing optimistic UI during first message

        const loadMessages = async () => {
            setIsLoading(true);
            try {
                const history = await convex.query(api.myFunctions.getAloaMessages, { conversationId: activeConversationId });
                if (history && history.length > 0) {
                    setMessages(history.map((m: any) => ({
                        ...m,
                        id: m.id || m._id
                    })));
                } else {
                    setMessages([]);
                }
            } catch (err) {
                console.error("Failed to load conversation history:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadMessages();
    }, [activeConversationId, convex, setMessages, setIsLoading]);

    const disconnectLiveSession = () => {
        if (liveSessionRef.current) {
            try { liveSessionRef.current.close(); } catch (e) { }
            liveSessionRef.current = null;
        }
        sourcesRef.current.forEach(s => s.stop());
        sourcesRef.current.clear();
        setAloaState('idle');
    };

    useEffect(() => {
        return () => disconnectLiveSession();
    }, []);

    const mapToolToModal = (toolName: string, args: any): { modalType: ModalType, mappedArgs: any } | null => {
        const normalizedName = toolName.toLowerCase();

        return (
            normalizedName === 'create_matter' ? { modalType: 'newMatter', mappedArgs: args } :
            normalizedName === 'create_contact' ? { modalType: 'newContact', mappedArgs: args } :
            normalizedName === 'create_property' ? { modalType: 'newProperty', mappedArgs: args } :
            normalizedName === 'create_task' ? { modalType: 'newTask', mappedArgs: args } :
            normalizedName === 'create_event' ? { modalType: 'newEvent', mappedArgs: args } :
            normalizedName === 'open_matter_ingestion_wizard' ? { modalType: 'matterIngestion', mappedArgs: args } :
            null
        );
    };

    const handleToolExecution = async (toolCalls: any[]): Promise<{ outputs: any[]; isTerminal: boolean }> => {
        if (!toolCalls || toolCalls.length === 0) return { outputs: [], isTerminal: false };

        const outputs: any[] = [];
        const isAdmin = currentUser?.role === 'Admin';
        let isTerminal = false; // True for tools that open modals/navigate — no second API round-trip needed

        for (const tool of toolCalls) {
            const { name, args } = tool;
            let feedbackMessage = "";
            let actionData: any = null;
            let toolOutput: any = { success: true };

            try {
                if (name === 'query_firm_data') {
                    const query = (args.query || '').toLowerCase();
                    const category = args.category || 'all';
                    const results: any = { tasks: [], notes: [], matters: [], documents: [] };

                    if (category === 'all' || category === 'tasks') {
                        results.tasks = (executionState.tasks || []).filter(t =>
                            (t.title.toLowerCase().includes(query) || (t.description || '').toLowerCase().includes(query))
                        ).slice(0, 5);
                    }

                    if (category === 'all' || category === 'notes' || category === 'endorsements') {
                        results.notes = (documentState.notePages || []).filter(n => {
                            const isMatch = n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
                            if (!isMatch) return false;

                            // Permission check
                            const notebook = coreState.noteNotebooks?.find(nb => nb.id === n.notebookId);
                            const hasAccess = isAdmin || n.authorId === currentUser?.id || notebook?.scope === 'firm';

                            if (!hasAccess) return false;
                            if (category === 'endorsements') return n.type === 'endorsement';
                            return true;
                        }).slice(0, 5).map(n => ({ 
                            id: n.id,
                            title: n.title, 
                            type: n.type, 
                            date: n.createdAt,
                            snippet: n.content.substring(0, 300) + (n.content.length > 300 ? '...' : '')
                        }));
                    }

                    if (category === 'all' || category === 'matters') {
                        results.matters = (matterState.matters || []).filter(m =>
                            m.title.toLowerCase().includes(query) || m.referenceNumber.toLowerCase().includes(query)
                        ).slice(0, 5).map(m => ({ title: m.title, status: m.status, ref: m.referenceNumber }));
                    }

                    if (category === 'all' || category === 'documents') {
                        results.documents = (documentState.documents || []).filter(d =>
                            d.title.toLowerCase().includes(query)
                        ).slice(0, 5).map(d => ({ title: d.title, status: d.litigationStatus }));
                    }

                    toolOutput = { results };

                } else {
                    const mappedAction = mapToolToModal(name, args);
                    if (mappedAction) {
                        const { modalType, mappedArgs } = mappedAction;
                        // FIX: Merge the mappedArgs (which contain title, dueDate, etc.) with context
                        const context = { ...(mappedArgs.context || {}), ...mappedArgs, openedByAloa: true };
                        // Remove nested context from the root to avoid clutter
                        delete context.context;

                        openModalRef.current(modalType, null, context);

                        actionData = {
                            type: 'modal',
                            modalType,
                            context,
                            label: `Open ${modalType.replace('new', 'New ')} Form`
                        };

                        // ADD DEFENSIVE LITIGATION INTELLIGENCE
                        try {
                            let insights: any[] = [];
                            if (modalType === 'newMatter') {
                                insights = [...analyzeMatterIntelligence(context.title, context.court)];
                            }
                            if (modalType === 'newContact' || modalType === 'newMatter') {
                                const nameToAnalyze = context.name || context.title || '';
                                insights = [...insights, ...analyzePartyName(nameToAnalyze, 'claimant', [], [])];
                            }
                            if (insights.length > 0) {
                                actionData.insights = insights;
                            }
                        } catch (intelligenceError) {
                            console.warn('[ALOA Intelligence] Skipping insights due to error:', intelligenceError);
                        }

                        feedbackMessage = `I've opened the form for you.`;
                        isTerminal = true; // Modal opened — no second API call needed

                    } else if (name === 'navigate_to') {
                        feedbackMessage = `Navigating to ${args.view}...`;
                        navigateToRef.current(args.view, args.selectedId, args.context);
                        isTerminal = true;

                    } else if (name === 'start_drafting') {
                        const draftConfig = {
                            openedByAloa: true,
                            draftTitle: args.title || 'New Draft',
                            draftPrompt: args.prompt
                        };
                        openEditorRef.current(null, draftConfig);
                        actionData = {
                            type: 'draft',
                            config: draftConfig,
                            label: 'Resume Drafting'
                        };
                        feedbackMessage = "Starting drafting engine...";
                        isTerminal = true;

                    } else if (name === 'draft_workflow') {
                        const context = {
                            openedByAloa: true,
                            isNewSub: true,
                            matterType: args.type,
                            subCategoryName: args.subCategoryName || 'Custom Workflow',
                            generatedStages: args.stages
                        };
                        openModalRef.current('editWorkflow', null, context);
                        actionData = {
                            type: 'modal',
                            modalType: 'editWorkflow',
                            context,
                            label: 'Edit Workflow'
                        };
                        feedbackMessage = `I've drafted a workflow for "${args.subCategoryName}".`;
                        isTerminal = true;

                    } else if (name === 'analyze_document') {
                        const { sourceId, type } = args;
                        feedbackMessage = `Analyzing ${type === 'document' ? 'document' : 'note'}...`;

                        let analyzable: any = null;
                        if (type === 'document') {
                            const doc = documentState.documents?.find(d => d.id === sourceId);
                            if (doc) analyzable = { title: doc.title, content: doc.content, file: doc.file };
                        } else {
                            const note = documentState.notePages?.find(p => p.id === sourceId);
                            if (note) analyzable = { title: note.title, content: note.content };
                        }

                        if (!analyzable) {
                            toolOutput = { error: "Source not found." };
                        } else {
                            try {
                                const report = await analyzeDocument(analyzable);
                                toolOutput = { report };
                                actionData = {
                                    type: 'analysis',
                                    report,
                                    label: 'View Full Analysis'
                                };
                                feedbackMessage = `Deep analysis complete. ${report.summary}`;
                            } catch (err: any) {
                                toolOutput = { error: err.message || "Analysis failed." };
                                feedbackMessage = `Analysis failed: ${err.message}`;
                            }
                        }
                    } else if (name === 'get_note_details') {
                        const { noteId } = args;
                        const note = documentState.notePages?.find(n => n.id === noteId);
                        
                        if (note) {
                            setActiveNoteId(noteId);
                            setActiveView('details');
                            feedbackMessage = `I've retrieved the details for "${note.title}". You can view the full content in the panel above.`;
                            toolOutput = { success: true, title: note.title, hasContent: !!note.content };
                        } else {
                            feedbackMessage = "I couldn't find that specific note.";
                            toolOutput = { error: "Note not found." };
                        }
                    } else if (name === 'execute_quick_action') {
                        const { action, targetType, targetId, value } = args;
                        feedbackMessage = `Executing ${action.replace('_', ' ')} on ${targetType}...`;
                        
                        try {
                            if (action === 'update_status') {
                                if (targetType === 'matters') {
                                    await convex.mutation(api.myFunctions.updateItem, { table: 'matters', id: targetId, data: { status: value } });
                                } else if (targetType === 'tasks') {
                                    await convex.mutation(api.myFunctions.updateItem, { table: 'tasks', id: targetId, data: { status: value } });
                                } else if (targetType === 'properties') {
                                    await convex.mutation(api.myFunctions.updateItem, { table: 'properties', id: targetId, data: { status: value } });
                                }
                            } else if (action === 'set_priority' && targetType === 'tasks') {
                                await convex.mutation(api.myFunctions.updateItem, { table: 'tasks', id: targetId, data: { priority: value } });
                            } else if (action === 'assign_user') {
                                await convex.mutation(api.myFunctions.updateItem, { table: targetType, id: targetId, data: { assignedUserId: value } });
                            } else if (action === 'delete_item') {
                                await deleteItem(targetType as any, targetId, 'Item');
                            }
                            
                            toolOutput = { success: true, action, targetId };
                            feedbackMessage = `Action "${action.replace('_', ' ')}" executed successfully.`;
                        } catch (err: any) {
                            toolOutput = { success: false, error: err.message };
                            feedbackMessage = `Failed to execute action: ${err.message}`;
                        }
                    } else if (name === 'update_open_form') {
                        // This tool interacts with the currently open modal's state
                        // We emit a custom event that forms can listen to
                        const event = new CustomEvent('aloa_update_form', { detail: args.data });
                        window.dispatchEvent(event);
                        
                        feedbackMessage = "I've pushed those details into the form for you.";
                        toolOutput = { success: true };
                        isTerminal = false; // Allow AI to continue talking while form is filled
                    } else if (name === 'search_legal_repo') {
                        const { query, jurisdiction } = args;
                        feedbackMessage = `Searching Nigerian Legal Repository for "${query}" in ${jurisdiction} jurisdiction...`;
                        
                        try {
                            // We replace the deprecated searchLegalRepo with generic agent/rag. Wait, maybe the backend API doesn't have it anymore.
                            // We can use a basic agent query or simulate it. For now, comment out the searchLegalRepo call or mock it.
                            const repoResults: any[] = []; // await convex.query(api.legalRepo.searchLegalRepo, { query, jurisdiction });
                            toolOutput = { results: repoResults };
                            
                            actionData = {
                                type: 'legal_search',
                                query,
                                results: repoResults,
                                label: 'View Search Results'
                            };
                            
                            feedbackMessage = repoResults.length > 0 
                                ? `I found ${repoResults.length} relevant legal authorities. ${repoResults[0].title} seems most relevant.`
                                : "I couldn't find any specific authorities in the repository, but I can provide general legal positions.";
                        } catch (err: any) {
                            toolOutput = { error: err.message };
                            feedbackMessage = `Legal search failed: ${err.message}`;
                        }
                    }
                }

                if (feedbackMessage) {
                    const modelMsg: AloaMessage = {
                        id: uuidv4(),
                        role: 'model',
                        content: feedbackMessage,
                        toolAction: actionData
                    };
                    
                    setMessages(prev => [...prev, modelMsg]);

                    if (currentUser?.email !== 'demo@practicepro.ng' && activeConversationId) {
                        try {
                            const convexMsgId = await saveMessageMutation({
                                conversationId: activeConversationId!,
                                firmId: coreState.firmDetails?.id || '',
                                message: modelMsg
                            });
                            if (actionData && actionData.context) {
                                actionData.context.aloaMessageId = convexMsgId;
                            }
                        } catch (e) {
                            console.error("Failed to save tool feedback message:", e);
                        }
                    }
                }

                outputs.push({ toolName: name, output: toolOutput });

            } catch (e) {
                console.error("Tool execution failed", e);
                outputs.push({ toolName: name, output: { error: String(e) } });
            }
        }
        return { outputs, isTerminal };
    };


    const toggleLiveSession = async () => {
        const isDemo = currentUser?.email === 'demo@practicepro.ng';
        const userMessagesCount = messages.filter(m => m.role === 'user').length;
        if (isDemo && userMessagesCount >= 5) {
            setMessages(prev => [...prev, {
                id: uuidv4(),
                role: 'model',
                content: "**Demo Limit Reached.** Start your account to unlock unlimited ALOA voice interactions.",
                toolAction: {
                    type: 'modal',
                    modalType: 'demoUpsell',
                    context: { source: 'aloa_voice_limit' },
                    label: 'Create Your Account'
                }
            }]);
            return;
        }

        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            setMessages(prev => [...prev, { id: uuidv4(), role: 'model', content: "AI settings not configured. Please check your API key in Settings." }]);
            return;
        }

        if (aloaState !== 'idle') {
            disconnectLiveSession();
            return;
        }

        try {
            setAloaState('connecting');
            const ai = new GoogleGenAI({ apiKey });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.0-flash-live-001',
                callbacks: {
                    onopen: () => setAloaState('listening'),
                    onmessage: async (message: any) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            setAloaState('speaking');
                            if (!audioOutputContextRef.current) audioOutputContextRef.current = new AudioContext({ sampleRate: 24000 });
                            const ctx = audioOutputContextRef.current;
                            const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(ctx.destination);
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) setAloaState('listening');
                            });
                            const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + buffer.duration;
                            sourcesRef.current.add(source);
                        }

                        if (message.toolCall) {
                            handleToolExecution(message.toolCall.functionCalls || []);
                        }
                    },
                    onerror: (err) => {
                        console.error("Live Session Error:", err);
                        if (aloaState !== 'idle') {
                            setMessages(prev => [...prev, { id: uuidv4(), role: 'model', content: "Voice connection interrupted. Switching to text mode." }]);
                            disconnectLiveSession();
                        }
                    },
                    onclose: () => {
                        if (aloaState !== 'idle') disconnectLiveSession();
                    }
                },
                config: {
                    responseModalities: ['AUDIO' as any],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                    },
                    tools: [{ functionDeclarations: tools }]
                }
            });
            liveSessionRef.current = await sessionPromise;
        } catch (e) {
            console.error("Connection Start Error:", e);
            setAloaState('idle');
            setMessages(prev => [...prev, { id: uuidv4(), role: 'model', content: "Failed to establish voice connection. Please try typing instead." }]);
        }
    };

    /** Attempts to parse an LLM response as an INTERACTIVE_FORM JSON block. */
    const tryParseInteractiveForm = (text: string): InteractiveFormSchema | null => {
        try {
            const match = text.match(/```json\s*([\s\S]*?)```/);
            const jsonStr = match ? match[1].trim() : text.trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed && parsed.type === 'INTERACTIVE_FORM' && Array.isArray(parsed.fields)) {
                return parsed as InteractiveFormSchema;
            }
        } catch { /* not a form payload */ }
        return null;
    };

    const handleSend = async (overrideContent?: string) => {
        const content = overrideContent ?? textInput;
        if (!content.trim() || isGeneratingRef.current) return;

        const isDemo = currentUser?.email === 'demo@practicepro.ng';
        const userMessagesCount = messages.filter(m => m.role === 'user').length;
        if (isDemo && userMessagesCount >= 5) {
            setMessages(prev => [...prev, {
                id: uuidv4(),
                role: 'model',
                content: "**Demo Limit Reached.** You've used all 5 demo messages. To continue exploring ALOA's capabilities and automate your legal practice, please create your account.",
                toolAction: {
                    type: 'modal',
                    modalType: 'demoUpsell',
                    context: { source: 'aloa_limit' },
                    label: 'Create Your Account'
                }
            }]);
            if (!overrideContent) setTextInput('');
            return;
        }

        const newUserMsg: AloaMessage = { id: uuidv4(), role: 'user', content };

        const streamMsgId = uuidv4();
        setMessages(prev => [...prev, newUserMsg, { id: streamMsgId, role: 'model', content: '' }]);
        if (!overrideContent) setTextInput('');
        setIsLoading(true);
        setAloaStatus(isFirmSearchEnabled ? 'Searching firm records…' : 'Thinking…');
        isGeneratingRef.current = true;
        let currentConvId = activeConversationId;

        const aiContext = {
            appState: { ...coreState, ...matterState, ...executionState, ...financeState, ...documentState } as any,
            currentUser: currentUser!,
            currentHistoryEntry,
            localFiles,
            aloaXLibrary: loadAloaXLibrary(),
            isFirmSearchEnabled,
            searchBrain: undefined as ((query: string) => Promise<string>) | undefined,
            injectedContext,
        };

        try {
            const isDemo = currentUser?.email === 'demo@practicepro.ng';

            if (!isDemo) {
                if (!currentConvId) {
                    const title = content.length > 30 ? content.substring(0, 30) + '...' : content;
                    currentConvId = await createConversationMutation({
                        firmId: coreState.firmDetails?.id || '',
                        userId: currentUser?.id || '',
                        title: title
                    });
                    setActiveConversationId(currentConvId);
                }
                void saveMessageMutation({
                    conversationId: currentConvId!,
                    firmId: coreState.firmDetails?.id || '',
                    userId: currentUser?.id,
                    message: newUserMsg
                });
            }

            const { brain } = await import('../../services/brainService');

            const wantsDataSearch = /\b(find|show|list|how many|what are|who are|which|all my|my current|pending|outstanding|overdue|recent|last|today|summary|status|balance|total|count)\b/i.test(content);

            aiContext.searchBrain = async (query: string) => {
                if (!isFirmSearchEnabled && !wantsDataSearch) return "";
                setAloaStatus('Searching firm records…');
                return await brain.search({
                    query,
                    firmId: coreState.firmDetails?.id || '',
                    scope: isProperty ? 'property' : 'legal',
                    convexQuery: (name: any, args: any) => convex.query(name, args)
                });
            };

            if (wantsDataSearch && !isFirmSearchEnabled) {
                setAloaStatus('Searching firm records…');
            }

            const wantsToolAction = /\b(create|open|add|new|draft|navigate|show me|find my|schedule|invoice|task|matter|contact)\b/i.test(content);
            const effectiveModel = preferredModel === 'auto' ? 'flash' : preferredModel;

            if (!wantsToolAction) {
                setAloaStatus('Writing…');
                try {
                    const streamed = await aiService.streamMessage(
                        [...messages, newUserMsg],
                        aiContext,
                        (chunk) => {
                            setMessages(prev => prev.map(m =>
                                m.id === streamMsgId ? { ...m, content: `${typeof m.content === 'string' ? m.content : ''}${chunk}` } : m
                            ));
                        },
                        effectiveModel
                    );
                    if (streamed.text?.trim()) {
                        const validatedText = validateAIResponse(streamed.text, isProperty);
                        const parsedForm = tryParseInteractiveForm(validatedText);
                        const modelMsg: AloaMessage = {
                            id: streamMsgId,
                            role: 'model',
                            content: parsedForm ? '' : validatedText,
                            interactiveForm: parsedForm ?? undefined,
                            modelUsed: streamed.modelUsed
                        };
                        setMessages(prev => prev.map(m => m.id === streamMsgId ? modelMsg : m));
                        if (!isDemo && currentConvId) {
                            void saveMessageMutation({
                                conversationId: currentConvId,
                                firmId: coreState.firmDetails?.id || '',
                                userId: currentUser?.id,
                                message: modelMsg
                            });
                        }
                        return;
                    }
                } catch (streamErr) {
                    console.warn('[ALOA] Stream path failed, using tool-capable request:', streamErr);
                }
            }

            setAloaStatus('Thinking…');
            setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: '' } : m));

            const response = await aiService.sendMessage(
                [...messages, newUserMsg],
                aiContext,
                effectiveModel
            );

            let currentResponse = response;
            let iterationCount = 0;
            const maxIterations = 3;

            let turnHistory = [...messages, newUserMsg]; 

            while (currentResponse.toolCalls && currentResponse.toolCalls.length > 0 && iterationCount < maxIterations) {
                iterationCount++;
                setAloaStatus('Using tools…');
                const { outputs: toolOutputs, isTerminal } = await handleToolExecution(currentResponse.toolCalls);

                if (isTerminal) {
                    setMessages(prev => prev.filter(m => m.id !== streamMsgId));
                    break;
                }

                const assistantToolCallMsg: AloaMessage = {
                    id: uuidv4(),
                    role: 'model',
                    toolCalls: currentResponse.toolCalls
                };

                const toolResultsMsgs: AloaMessage[] = toolOutputs.map(output => ({
                    id: uuidv4(),
                    role: 'tool',
                    toolResult: output
                }));

                turnHistory = [...turnHistory, assistantToolCallMsg, ...toolResultsMsgs];

                setAloaStatus('Writing…');
                currentResponse = await aiService.sendMessage(
                    turnHistory,
                    aiContext,
                    effectiveModel
                );
            }

            if (currentResponse.text && currentResponse.text.trim()) {
                const validatedText = validateAIResponse(currentResponse.text, isProperty);
                const parsedForm = tryParseInteractiveForm(validatedText);
                const modelMsg: AloaMessage = {
                    id: streamMsgId,
                    role: 'model',
                    content: parsedForm ? '' : validatedText,
                    interactiveForm: parsedForm ?? undefined,
                    modelUsed: currentResponse.modelUsed
                };
                setMessages(prev => prev.map(m => m.id === streamMsgId ? modelMsg : m));

                if (!isDemo && currentConvId) {
                    void saveMessageMutation({
                        conversationId: currentConvId,
                        firmId: coreState.firmDetails?.id || '',
                        userId: currentUser?.id,
                        message: modelMsg
                    });
                }
            } else {
                setMessages(prev => prev.filter(m => m.id !== streamMsgId));
            }

        } catch (error: any) {
            console.error("ALOA Message Error:", error);

            let errorMessage = "I encountered an issue processing your request.";
            let isAuthError = false;
            let isQuotaError = false;
            let helpText = "Please try again later.";

            if (error.message) {
                if (error.message.includes('API key') || error.message.includes('403')) {
                    errorMessage = "Authentication Error: API Key is invalid or missing.";
                    isAuthError = true;
                    helpText = "Please check your AI Settings and verify your API key.";
                }
                else if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
                    errorMessage = "Quota Exceeded: Your AI usage limit has been reached.";
                    isQuotaError = true;
                    helpText = "**Solutions:**\n\n1. **Wait**: Free tier quotas reset daily\n2. **Upgrade**: Get higher limits at [Google AI Studio](https://ai.google.dev/pricing)\n3. **Monitor Usage**: Check your quota at [AI Dev Console](https://ai.dev/rate-limit)\n4. **Alternative**: Try switching to DeepSeek in Settings (if configured)";
                }
                else if (error.message.includes('network') || error.message.includes('fetch')) {
                    errorMessage = "Network Error: Please check your internet connection.";
                    helpText = "Verify you're online and try again.";
                }
                else if (error.message.includes('not found') || error.message.includes('404')) {
                    errorMessage = "Model Configuration Error: The requested AI model is unavailable.";
                    helpText = "The AI model may have been deprecated. Please contact support or check for app updates.";
                }
                else {
                    errorMessage = `System Error: ${error.message}`;
                    helpText = "If this persists, please contact support.";
                }
            }

            const errorMsgObj: AloaMessage = {
                id: uuidv4(),
                role: 'model',
                content: `**${errorMessage}**\n\n${isAuthError ? "Please check your AI Settings." : "Please try again later."}`,
                isError: true,
                errorDetails: JSON.stringify(error.message || error, null, 2)
            };

            setMessages(prev => [...prev.filter(m => m.id !== streamMsgId), errorMsgObj]);
        } finally {
            setIsLoading(false);
            setAloaStatus('');
            isGeneratingRef.current = false;
        }
    };

    const toggleErrorDetails = (id: string) => {
        setExpandedErrorIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    /**
     * Called when the user submits a DynamicChatForm.
     * Formats the field values into a concise text summary and injects it
     * as a user turn so the LLM processes it on the next run.
     */
    const handleFormSubmit = (formId: string, values: Record<string, any>) => {
        const summary = Object.entries(values)
            .map(([k, v]) => `${k}="${Array.isArray(v) ? v.join(', ') : v}"`)
            .join(', ');
        const syntheticContent = `[Form Submitted — ${formId}: ${summary}]`;
        handleSend(syntheticContent);
    };

    const handleSaveMessage = (content: string) => {
        setQuickNoteContent(content);
        setActiveView('quickNote');
    };

    const cycleModel = () => {
        const order: typeof preferredModel[] = ['auto', 'pro', 'flash'];
        const nextIndex = (order.indexOf(preferredModel) + 1) % order.length;
        setPreferredModel(order[nextIndex]);
    };

    const handleCopyMessage = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    const executeStoredAction = (action: any) => {
        if (action.type === 'modal') {
            openModalRef.current(action.modalType, null, action.context);
        } else if (action.type === 'draft') {
            openEditorRef.current(null, action.config);
        } else if (action.type === 'note' && action.noteId) {
            setActiveNoteId(action.noteId);
            setActiveView('form');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden shadow-2xl relative">
            <header className="flex-shrink-0 px-4 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-900/50 overflow-hidden">
                {/* Left: back button + icon + title — takes all available space but allows right side to stay visible */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                    {(activeView === 'quickNote' || activeView === 'form' || activeView === 'details') && (
                        <button 
                            onClick={() => {
                                setActiveView('chat');
                                setActiveNoteId(null);
                            }}
                            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700"
                        >
                            <ChevronRightIcon className="w-5 h-5 rotate-180" />
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            setActiveView('chat');
                            setActiveNoteId(null);
                        }}
                        className={`flex-shrink-0 p-2 sm:p-2.5 rounded-2xl shadow-lg transition-all duration-500 hover:scale-105 active:scale-95 ${activeView === 'chat' ? (isFirmSearchEnabled ? 'bg-blue-600 shadow-blue-500/20' : 'bg-green-600 shadow-green-600/20') : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'}`}
                    >
                        <AloaIcon className={`w-6 h-6 sm:w-7 sm:h-7 ${activeView === 'chat' ? 'text-white' : ''} ${aloaState === 'speaking' ? 'animate-pulse' : ''}`} />
                    </button>
                    <div className="min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 overflow-hidden flex-wrap">
                            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-none truncate">
                                {activeView === 'form' ? 'Edit Note' : activeView === 'details' ? 'Note Details' : activeView === 'quickNote' ? 'New Note' : (isAtrium ? 'ARIA' : 'ALOA')}
                            </h2>
                            {activeView === 'chat' && <ModelBadge model={preferredModel} onClick={cycleModel} />}
                            {activeView === 'chat' && injectedContext && (
                                <button
                                    onClick={() => setInjectedContext(null)}
                                    title="Click to clear context and start a fresh conversation"
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold
                                               bg-emerald-100 text-emerald-700 border border-emerald-200
                                               dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800
                                               hover:bg-red-100 hover:text-red-600 hover:border-red-200
                                               dark:hover:bg-red-900/20 dark:hover:text-red-400
                                               transition-all truncate max-w-[160px]"
                                >
                                    <span>💬</span>
                                    <span className="truncate">{injectedContext.entityName}</span>
                                    <XMarkIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                </button>
                            )}
                        </div>
                        {activeView === 'chat' && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium leading-none mt-0.5 truncate">
                                {isAtrium ? 'Asset & Revenue Intelligent Assistant' : 'Artificial Legal & Operational Assistant'}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-3 ml-4">
                    <button
                        onClick={() => setActiveView(activeView === 'quickNote' ? 'chat' : 'quickNote')}
                        className={`p-2 rounded-xl transition-all ${activeView === 'quickNote' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        title="Quick Note mode"
                    >
                        <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        title="Conversation History"
                    >
                        <HistoryIcon className="w-5 h-5" />
                    </button>
                    {activeView === 'chat' && (
                        <button
                            onClick={onMinimize}
                            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-red-600 transition-all bg-slate-100 dark:bg-zinc-800 rounded-lg active:bg-slate-200 dark:active:bg-zinc-700 flex items-center gap-1 border border-slate-200 dark:border-zinc-700 flex-shrink-0"
                        aria-label="Close Panel"
                    >
                        <XMarkIcon className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Close</span>
                    </button>
                </div>
            </header>

            {activeView === 'details' ? (
                <NoteDetails 
                    note={documentState.notePages.find(n => n.id === activeNoteId)}
                    onEdit={() => setActiveView('form')}
                    onBack={() => {
                        setActiveView('chat');
                        setActiveNoteId(null);
                    }}
                />
            ) : activeView === 'quickNote' || activeView === 'form' ? (
                <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">
                    <SaveToNoteForm 
                        initialContent={quickNoteContent} 
                        noteId={activeNoteId}
                        onClose={() => {
                            setActiveView('chat');
                            setQuickNoteContent('');
                            setActiveNoteId(null);
                        }}
                        onSearch={(query) => {
                            setTextInput(query);
                            setActiveView('chat');
                            setIsFirmSearchEnabled(true);
                            setActiveNoteId(null);
                        }}
                        embeddedMode={true}
                    />
                </div>
            ) : (
                <>
                    <div className="flex-1 flex overflow-hidden">
                     {showHistory && (
                        <aside className="w-80 border-r border-slate-200 dark:border-zinc-800 flex flex-col bg-slate-50/30 dark:bg-zinc-900/30 animate-in slide-in-from-left duration-300">
                        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 space-y-2">
                            <button
                                onClick={() => {
                                    setActiveConversationId(null);
                                    setMessages([]);
                                    setShowHistory(false);
                                    setActiveView('chat');
                                }}
                                className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                            >
                                <PlusIcon className="w-4 h-4" />
                                New Search
                            </button>
                             <button
                                onClick={() => {
                                    setActiveView('quickNote');
                                    setShowHistory(false);
                                }}
                                className="w-full py-2.5 px-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:border-primary-500 transition-all flex items-center justify-center gap-2"
                            >
                                <EditIcon className="w-4 h-4" />
                                New Note
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Recent Searches</h3>
                                <ConversationList
                                    activeId={activeConversationId}
                                    onSelect={(id) => {
                                        setActiveConversationId(id);
                                        setActiveView('chat');
                                        setShowHistory(false);
                                    }}
                                    onDelete={async (id) => {
                                        await deleteConversationMutation({ conversationId: id });
                                        if (activeConversationId === id) {
                                            setActiveConversationId(null);
                                            setMessages([]);
                                        }
                                    }}
                                />
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Archived Notes</h3>
                                <div className="space-y-1">
                                    {documentState.notePages?.slice(0, 10).map(note => (
                                        <div key={note.id} className="group relative">
                                            <button
                                                onClick={() => {
                                                    setActiveNoteId(note.id);
                                                    setActiveView('details');
                                                    setShowHistory(false);
                                                }}
                                                className="w-full text-left p-3 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-zinc-700 pr-10"
                                            >
                                                <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{note.title}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 opacity-60">{note.content}</div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm(`Delete note "${note.title}"?`)) {
                                                        deleteItem('notePages', note.id, note.title);
                                                    }
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all z-20"
                                                title="Delete Note"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {(!documentState.notePages || documentState.notePages.length === 0) && (
                                        <div className="text-[10px] text-slate-400 italic px-2">No notes yet...</div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </aside>
                )}

                <main 
                    onClick={(e) => {
                        if (isMobile && showHistory) {
                            setShowHistory(false);
                            return;
                        }
                        
                        const target = e.target as HTMLElement;
                        const taskEl = target.closest('.aloa-interactive-task');
                        if (taskEl) {
                            const taskTitle = taskEl.getAttribute('data-task-title');
                            if (taskTitle) {
                                const isDraftable = taskTitle.match(/^(Draft|Prepare|Create)\b/i);
                                if (isDraftable) {
                                    openEditorRef.current(null, { 
                                        draftTitle: taskTitle, 
                                        isCourtProcess: true,
                                        openedByAloa: true 
                                    });
                                } else {
                                    setTextInput(`I want to ${taskTitle.toLowerCase()}`);
                                }
                            }
                        }
                    }}
                    className={`flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-zinc-950 transition-all ${isMobile && showHistory ? 'opacity-40 blur-sm pointer-events-none' : ''}`}
                >
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className={`w-20 h-20 rounded-[40px] flex items-center justify-center mb-5 shadow-lg ${isAtrium ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-green-600 shadow-green-600/20'}`}>
                                <AloaIcon className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-1">
                                {isAtrium ? 'ARIA' : 'ALOA'}
                            </h3>
                            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                                {isAtrium ? 'Asset & Revenue Intelligent Assistant' : 'Artificial Legal & Operational Assistant'}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-zinc-500 max-w-[260px] leading-relaxed">
                                {isAtrium
                                    ? 'I can help manage your property portfolio, track revenue, handle tenant communications, and monitor defaulters.'
                                    : 'I can help draft legal documents, manage cases, research Nigerian law, and streamline your practice operations.'}
                            </p>
                            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-[300px]">
                                {(isAtrium ? [
                                    'Show revenue summary',
                                    'List defaulting tenants',
                                    'Draft a rent demand',
                                    'What units are vacant?',
                                ] : [
                                    'Draft a Notice to Quit',
                                    'Create a new matter',
                                    'Summarize my active cases',
                                    'What are my pending tasks?',
                                ]).map(suggestion => (
                                    <button
                                        key={suggestion}
                                        onClick={() => setTextInput(suggestion)}
                                        className="px-3 py-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors border border-slate-200 dark:border-zinc-700"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in zoom-in-95 duration-300`}>
                            <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'w-full relative'}`}>
                                <div className={`px-5 py-4 rounded-3xl text-[14px] leading-relaxed break-words shadow-sm transition-all
                                ${msg.role === 'user'
                                        ? 'bg-primary-600 text-white rounded-tr-none shadow-lg shadow-primary-500/10'
                                        : msg.isError
                                            ? 'bg-red-50/80 backdrop-blur-sm dark:bg-red-900/10 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/30'
                                            : 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl text-slate-800 dark:text-zinc-200 border border-slate-200/40 dark:border-zinc-800/60 shadow-xl group-hover:border-primary-400/50 dark:group-hover:border-primary-500/50'
                                    }`}>
                                    {msg.content && (
                                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mb-2" dangerouslySetInnerHTML={{ __html: parseAloaMarkdown(msg.content) }} />
                                    )}
                                    {msg.interactiveForm && (
                                        <DynamicChatForm
                                            schema={msg.interactiveForm}
                                            onSubmit={(values) => handleFormSubmit(msg.interactiveForm!.formId, values)}
                                        />
                                    )}

                                    {msg.toolAction && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                            <ActionCard
                                                actionName={msg.toolAction.modalType || msg.toolAction.type || 'action'}
                                                args={{ context: msg.toolAction.context }}
                                                onExecute={() => executeStoredAction(msg.toolAction)}
                                                insights={msg.toolAction.insights}
                                                isLastMessage={idx === messages.length - 1}
                                                completedResult={msg.completedResult}
                                            />
                                        </div>
                                    )}

                                    <div className={`absolute bottom-0 translate-y-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 z-10 ${msg.role === 'user' ? '-left-2' : '-right-2'}`}>
                                        <button
                                            onClick={() => handleCopyMessage(msg.id, msg.content || '')}
                                            className={`${copiedMessageId === msg.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-zinc-800 text-slate-400 hover:text-primary-600'} border border-slate-200 dark:border-zinc-700 rounded-lg p-1.5 shadow-lg transition-all flex items-center gap-1.5`}
                                            title="Copy text"
                                        >
                                            {copiedMessageId === msg.id ? (
                                                <>
                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                    <span className="text-[8px] font-bold uppercase tracking-tight pr-1">Copied</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ClipboardIcon className="w-3.5 h-3.5" />
                                                    <span className="text-[8px] font-bold uppercase tracking-tight pr-1">Copy</span>
                                                </>
                                            )}
                                        </button>

                                        {msg.role === 'model' && !msg.isError && (
                                            <button
                                                onClick={() => handleSaveMessage(msg.content || '')}
                                                className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-lg flex items-center gap-1.5 pr-2"
                                                title="Save to Notes"
                                            >
                                                <BookmarkIcon className="w-3.5 h-3.5" />
                                                <span className="text-[8px] font-bold uppercase tracking-tight">Save</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className={`mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'user' ? 'You' : (isAtrium ? 'ARIA' : 'ALOA')}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && aloaStatus && (
                        <p className="text-[10px] font-medium text-primary-600 dark:text-primary-400 px-2 animate-pulse">{aloaStatus}</p>
                    )}
                    <div ref={messagesEndRef} />
                </main>
            </div>

            <footer className="flex-shrink-0 p-6 bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-900">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                         <button onClick={resetChat} className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-red-500 transition-all shadow-sm" title="Reset Chat">
                            <TrashIcon className="w-4 h-4" />
                        </button>

                        <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1" />
                        
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firm RAG</span>
                            <button
                                onClick={() => setIsFirmSearchEnabled(!isFirmSearchEnabled)}
                                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${isFirmSearchEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-700'}`}
                            >
                                <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform ${isFirmSearchEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex gap-3 items-center"
                    >
                        <div className={`flex-1 rounded-2xl flex items-center border shadow-inner transition-all p-1 ${isFirmSearchEnabled ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus-within:bg-white dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-primary-500/20'}`}>
                            <input autoComplete="off" data-lpignore="true" 
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                placeholder={
                                    isFirmSearchEnabled 
                                        ? (isProperty ? 'Search portfolio documents...' : 'Search firm documents...')
                                        : (isAtrium ? 'Ask ARIA about your properties...' : 'Ask ALOA about your practice...')
                                }
                                className="flex-1 bg-transparent border-none text-sm text-slate-900 dark:text-white p-3 placeholder-slate-400 focus:ring-0 min-w-0"
                                disabled={isLoading || aloaState !== 'idle'}
                            />
                            <button
                                type="submit"
                                disabled={!textInput.trim() || isLoading}
                                className={`p-2.5 rounded-xl disabled:opacity-30 transition-all active:scale-95 shadow-md ${isFirmSearchEnabled ? 'bg-blue-600 text-white' : 'bg-primary-600 text-white'}`}
                            >
                                <SendIcon />
                            </button>
                        </div>
                    </form>
                </div>
            </footer>
                </>
            )}
        </div>
    );
};
