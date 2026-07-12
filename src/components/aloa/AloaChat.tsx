
import React, { useEffect, useRef, useState } from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { useConvex, useMutation, useAction, useQuery } from 'convex/react';
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
import { draftSessionKey, loadDraftSession } from '../../utils/draftSession';
import { openDraftInTab, isDraftTabOpen } from '../../utils/draftTabs';
import { saveAloaSession } from '../../utils/aloaSession';
import { buildJurisdictionalReasoning } from '../../utils/jurisdictionConfig';
import JurisdictionReasoning from './JurisdictionReasoning';
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

// URL detection regex — matches http(s):// URLs in user messages
const URL_REGEX = /https?:\/\/[^\s<>"']{4,}/gi;
import { getGlobalAIQueue, validateAPIKey } from '../../utils/aiRequestQueue';
import PIIShieldBadge from './PIIShieldBadge';
import Tooltip from '../Tooltip';
import { getGeminiApiKey, AI_CONFIG } from '../../utils/aiUtils';
import { SaveToNoteForm } from '../forms/SaveToNoteForm';
import { loadAloaXLibrary } from '../indexer/AloaXView';
import { analyzePartyName, analyzeMatterIntelligence } from '../../utils/defenseUtils';
import { getAssistantName, getAssistantFullName, getChatPlaceholder } from '../../utils/assistantIdentity';
import { ActionCard } from './ActionCard';
import { NoteDetails } from './NoteDetails';
import { ConversationList } from './ConversationList';
import { validateAIResponse } from '../../constants/identityGuardrails';
import { DynamicChatForm } from './DynamicChatForm';
import { useConfirm } from '../ui/ConfirmDialog';

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

const ModelBadge: React.FC<{ model: string; onClick: () => void }> = ({ model, onClick }) => (
    <button
        onClick={onClick}
        title={
            model === 'auto' ? 'Auto — AI chooses the best mode for each query' :
            model === 'flash' ? 'Flash — fast responses for quick questions' :
            model === 'pro' ? 'Pro — deeper analysis with the most capable model' :
            model === 'research' ? 'Research — multi-step reasoning, citations, and jurisdiction detection' :
            'Select AI mode'
        }
        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all border shadow-sm flex items-center gap-1 ${
            model === 'pro'
                ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800'
                : model === 'flash'
                ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
                : model === 'research'
                ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800'
        }`}
    >
        <SparklesIcon className="w-2.5 h-2.5" />
        {model}
    </button>
);

export const AloaChat: React.FC<{ onClose: () => void; onDraftStream?: (chunk: string) => void; isMobile?: boolean }> = ({ onClose, onDraftStream, isMobile }) => {
    // ─── Bulletproof close handler ──────────────────────────────────
    // Uses onPointerDown (NOT onClick) because pointerdown is the
    // VERY FIRST event in the browser's pointer event chain. It fires
    // before mousedown, touchstart, click, and any drag-start handlers.
    // This means NO parent element's drag/touch handler can intercept
    // or suppress the close action. The panel WILL close.
    const handleClose = React.useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
    }, [onClose]);
    const {
        messages, setMessages, isLoading, setIsLoading, resetChat, aloaState, setAloaState,
        preferredModel, setPreferredModel, localFiles, isFirmSearchEnabled,
        activeConversationId, setActiveConversationId, activeView, setActiveView,
        activeNoteId, setActiveNoteId, quickNoteContent, setQuickNoteContent,
        injectedContext, setInjectedContext
    } = useAloa();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { financeState } = useFinanceState();
    const { coreState, isDataLoaded } = useCoreState();
    const { deleteItem, handleAddResearchNotebook, handleAddResearchSource } = useDataActions();
    const { currentUser } = useAuth();
    const { navigateTo, openModal, openEditor, currentHistoryEntry, isOnline, addToast } = useUI();
    const { isProperty, isAtrium } = useProduct();
    const convex = useConvex();
    const { confirm, ConfirmDialog } = useConfirm();

    // Convex Hooks
    const saveMessageMutation = useMutation(api.myFunctions.saveAloaMessage);
    const createConversationMutation = useMutation(api.myFunctions.createAloaConversation);
    const deleteConversationMutation = useMutation(api.myFunctions.deleteAloaConversation);
    const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);
    const getFileUrl = useQuery as any;

    // ─── Phase 2: Proactive Intelligence & Conversation Memory ──────────
    const firmId = coreState?.firmDetails?.id;
    const userId = currentUser?.id;

    // Fetch cross-session conversation memory for context injection
    const conversationMemory = useQuery(
        api.conversationMemory.getInjectionContext,
        firmId && userId ? { firmId, userId } : 'skip'
    );

    // Fetch un-dismissed proactive insights (deadlines, anomalies, briefings)
    const proactiveInsights = useQuery(
        api.proactive.getInsights,
        firmId ? { firmId, dismissed: false, limit: 10 } : 'skip'
    );

    const [textInput, setTextInput] = useState('');
    const [pendingAttachments, setPendingAttachments] = useState<{ storageId: string; name: string; type: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
    const aiQueueRef = useRef(getGlobalAIQueue());
    const [pendingQueueCount, setPendingQueueCount] = useState(0);

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
        if (!activeConversationId) {
            // No active conversation — clear messages so the empty state shows
            setMessages([]);
            return;
        }
        // Don't reload if we're actively generating (optimistic UI)
        if (isGeneratingRef.current && messages.length > 0) return;

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

    const handleToolExecution = async (toolCalls: any[], conversationContext?: string): Promise<{ outputs: any[]; isTerminal: boolean }> => {
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
                            console.warn('[ARIA Intelligence] Skipping insights due to error:', intelligenceError);
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

                        // ─── Jurisdictional Reasoning ─────────────────────────────
                        // Compute the jurisdictional analysis before drafting so we can
                        // show the user WHY a particular court was selected.
                        //
                        // IMPORTANT: We combine the AI's extracted prompt WITH the
                        // user's original conversation message. The AI sometimes
                        // extracts only "Draft a tenancy agreement" as the prompt,
                        // stripping the jurisdiction context (e.g. "for a property
                        // in San Francisco"). By checking the full conversation
                        // text, we correctly detect foreign jurisdictions instead
                        // of erroneously defaulting to the firm's home state.
                        const draftPromptText = args.prompt || draftConfig.draftTitle || '';
                        const jurisdictionAnalysis = buildJurisdictionalReasoning(
                            `${draftPromptText} ${conversationContext || ''}`,
                            coreState?.firmDetails?.defaultStateOfPractice
                        );

                        // On desktop, open the draft in a new browser tab so the
                        // user can keep the ALOA chat open alongside the editor.
                        // The AI response handler is async, so window.open() may be
                        // blocked by the browser's popup blocker. We use window.open()
                        // with the FULL URL (not blank) which has a higher success rate.
                        try {
                            const fid = coreState?.firmDetails?.id || '';
                            const draftKey = draftSessionKey({
                                matterId: undefined,
                                title: draftConfig.draftTitle,
                            });
                            if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                                const url = `/editor?draftKey=${encodeURIComponent(draftKey)}&title=${encodeURIComponent(draftConfig.draftTitle)}&prompt=${encodeURIComponent(draftConfig.draftPrompt || '')}`;
                                const tabName = `draftpro-${draftKey.replace(/[^a-z0-9]/gi, '-')}`;
                                // Try opening with the full URL directly — this has a
                                // higher chance of succeeding than openDraftInTab which
                                // uses window.open('', name) for dedup.
                                const win = window.open(url, tabName);
                                if (win && !win.closed) {
                                    win.focus();
                                    // Register in the tab registry for future dedup
                                    openDraftInTab({
                                        key: draftKey,
                                        url,
                                        title: draftConfig.draftTitle,
                                    });
                                    feedbackMessage = `Opened "${draftConfig.draftTitle}" in a new tab. You can continue chatting here.`;
                                } else {
                                    // Popup blocked — navigate in-place
                                    openEditorRef.current(null, draftConfig);
                                    feedbackMessage = `Opened "${draftConfig.draftTitle}" in the editor. (Allow pop-ups to open drafts in a new tab.)`;
                                }
                            } else {
                                openEditorRef.current(null, draftConfig);
                            }
                        } catch (e) {
                            console.warn('[start_drafting] tab open failed', e);
                            openEditorRef.current(null, draftConfig);
                        }
                        actionData = {
                            type: 'draft',
                            config: draftConfig,
                            label: 'Resume Drafting',
                            jurisdictionAnalysis,  // attach for the UI
                        };
                        if (!feedbackMessage) feedbackMessage = `Drafting in **${jurisdictionAnalysis.jurisdiction}** — ${jurisdictionAnalysis.court}`;
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
                                // Include PII stripping info in the feedback message
                                const piiNote = report.piiTotalStripped && report.piiTotalStripped > 0
                                    ? ` 🛡️ ${report.piiTotalStripped} PII item(s) were detected and stripped before AI analysis.`
                                    : '';
                                feedbackMessage = `Deep analysis complete. ${report.summary}${piiNote}`;
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
                        feedbackMessage = `Searching for "${query}" in ${jurisdiction || 'all'} jurisdiction...`;
                        
                        try {
                            // Use the firm's brain (indexed documents) for research
                            // If brain search is available, query it; otherwise provide a helpful fallback
                            let repoResults: any[] = [];
                            
                            if (context?.searchBrain) {
                                try {
                                    const brainResult = await context.searchBrain(query);
                                    if (brainResult) {
                                        repoResults = [{ title: 'Firm Document Match', snippet: brainResult.substring(0, 300), source: 'firm_knowledge_base' }];
                                    }
                                } catch (brainErr) {
                                    // Brain search failed, continue with empty results
                                }
                            }
                            
                            toolOutput = { results: repoResults, note: repoResults.length === 0 ? 'No indexed documents matched. Results are from your firm\'s uploaded documents only — not a national case law database.' : undefined };
                            
                            actionData = {
                                type: 'legal_search',
                                query,
                                results: repoResults,
                                label: repoResults.length > 0 ? 'View Search Results' : undefined
                            };
                            
                            feedbackMessage = repoResults.length > 0 
                                ? `I found ${repoResults.length} relevant document(s) in your ${isProperty ? 'portfolio' : "firm's"} knowledge base.`
                                : isProperty
                                    ? "I didn't find matching documents in your indexed files. I can still provide general property guidance based on Nigerian tenancy law principles."
                                    : "I didn't find matching documents in your firm's indexed files. I can still provide general legal guidance based on Nigerian law principles.";
                        } catch (err: any) {
                            toolOutput = { error: err.message };
                            feedbackMessage = isProperty
                                    ? `Search encountered an issue. I can still help with general property guidance.`
                                    : `Legal search encountered an issue. I can still help with general legal guidance.`;
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
                content: `**Demo Limit Reached.** Start your account to unlock unlimited ${getAssistantName(isProperty)} voice interactions.`,
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
            setMessages(prev => [...prev, { id: uuidv4(), role: 'model', content: "**API Key Required**\n\nTo use AI features, you need a Google Gemini API key. Here's how to get one:\n\n1. **Get your free key** at [Google AI Studio](https://aistudio.google.com/app/apikey)\n2. **Paste it** in **Settings → Agents → API Key Configuration**\n\n> 💡 The key is stored locally on your device and never sent to our servers.", actions: [{ type: 'navigate', target: '/settings?tab=agents', label: 'Go to API Settings' }] }]);
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

    // ─── File Upload Handler ────────────────────────────────────────────
    // Uploads files to Convex storage and attaches them to the next message.
    const handleFileUpload = async (files: FileList) => {
        setIsUploading(true);
        try {
            for (const file of Array.from(files)) {
                if (file.size > 20 * 1024 * 1024) {
                    addToast(`${file.name} is too large (max 20MB).`, { type: 'error' });
                    continue;
                }
                const postUrl = await generateUploadUrl();
                const res = await fetch(postUrl, { method: 'POST', body: file });
                if (res.ok) {
                    const { storageId } = await res.json();
                    if (storageId) {
                        setPendingAttachments(prev => [...prev, {
                            storageId,
                            name: file.name,
                            type: file.type || 'application/octet-stream',
                        }]);
                    }
                }
            }
        } catch (err: any) {
            addToast('Upload failed: ' + (err.message || 'Unknown error'), { type: 'error' });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSend = async (overrideContent?: string) => {
        const content = overrideContent ?? textInput;
        if (!content.trim() && pendingAttachments.length === 0) return;

        // ─── API KEY PRE-FLIGHT VALIDATION ──────────────────────────────
        // Check that a valid Gemini API key exists BEFORE we do any work.
        // If missing, show a graceful error card instead of letting the
        // request fail with an unhandled exception mid-stream.
        const isDemo = currentUser?.email === 'demo@practicepro.ng';
        if (!isDemo) {
            const firmKey = coreState.firmDetails?.aiSettings?.firmGeminiApiKey;
            const keyCheck = validateAPIKey(firmKey);
            if (!keyCheck.valid) {
                setMessages(prev => [...prev, {
                    id: uuidv4(),
                    role: 'user',
                    content: content,
                }, {
                    id: uuidv4(),
                    role: 'model',
                    content: `**API Key Required**\n\nTo use AI features, you need a Google Gemini API key. It's free and takes 30 seconds:\n\n**1. Get your free key** → [Google AI Studio](https://aistudio.google.com/app/apikey)\n\n**2. Paste it** in **Settings → AI Settings → API Key Configuration**\n\n> 💡 The key is stored locally on your device and never sent to our servers.\n\nClick the button below to go straight to your AI Settings →`,
                    isError: true,
                    toolAction: {
                        type: 'navigate',
                        target: 'settings',
                        context: { settingsTargetId: 'api-config', activeTab: 'agents' },
                        label: 'Go to AI Settings →',
                    },
                }]);
                if (!overrideContent) setTextInput('');
                return;
            }
        }

        // ─── PII Scan — check the user's message for PII before sending ──
        const { stripPIIWithReport } = await import('../../utils/aiUtils');
        const piiResult = stripPIIWithReport(content);

        const userMessagesCount = messages.filter(m => m.role === 'user').length;
        if (isDemo && userMessagesCount >= 5) {
            setMessages(prev => [...prev, {
                id: uuidv4(),
                role: 'model',
                content: `**Demo Limit Reached.** You've used all 5 demo messages. To continue exploring ${getAssistantName(isProperty)}'s capabilities and ${isProperty ? 'automate your property operations' : 'automate your legal practice'}, please create your account.`,
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

        const newUserMsg: AloaMessage = {
            id: uuidv4(),
            role: 'user',
            content: content.trim() || '(attachment)',
            attachments: pendingAttachments.length > 0 ? pendingAttachments.map(a => a.storageId) : undefined,
            attachmentNames: pendingAttachments.length > 0 ? pendingAttachments.map(a => a.name) : undefined,
        };

        // ─── OPTIMISTIC UI ──────────────────────────────────────────────
        // Paired UUIDs: the user message and the (empty) model response
        // card are created together. The input tray clears instantly for
        // responsive feedback. The actual AI call is enqueued below.
        const streamMsgId = uuidv4();
        // Store PII result on the user message so PIIShieldBadge can render
        (newUserMsg as any).piiResult = piiResult.totalStripped > 0 ? piiResult : undefined;
        setMessages(prev => [...prev, newUserMsg, { id: streamMsgId, role: 'model', content: '' }]);
        if (!overrideContent) setTextInput('');
        // Clear attachments after sending
        const sentAttachments = [...pendingAttachments];
        setPendingAttachments([]);

        // Show status immediately so the user sees activity even if
        // the request is queued behind a previous one.
        // In research mode, show a more descriptive status to set
        // expectations for the longer processing time.
        const baseStatus = pendingAttachments.length > 0
            ? `Reading ${pendingAttachments.length} document${pendingAttachments.length > 1 ? 's' : ''}…`
            : preferredModel === 'research'
                ? 'Researching… analyzing your query in depth'
                : 'Thinking…';
        setAloaStatus(baseStatus);

        // In research mode, cycle through dynamic reasoning states
        // to show the AI's micro-steps (replaces static "Thinking…")
        let reasoningTimer: ReturnType<typeof setTimeout> | null = null;
        if (preferredModel === 'research' && pendingAttachments.length === 0) {
            const reasoningSteps = [
                'Researching… analyzing your query in depth',
                'Cross-referencing legal frameworks…',
                'Evaluating jurisdictional implications…',
                'Synthesizing analysis…',
            ];
            let stepIdx = 0;
            reasoningTimer = setInterval(() => {
                stepIdx = (stepIdx + 1) % reasoningSteps.length;
                setAloaStatus(reasoningSteps[stepIdx]);
            }, 4000);
        }

        // ─── DETERMINISTIC REQUEST QUEUE ────────────────────────────────
        // The AI execution is enqueued in a global sequential queue.
        // Task N+1 cannot fire until Task N resolves or catches. This
        // eliminates race conditions where responses print out of order.
        // While queued, we show a pending indicator to the user.
        setPendingQueueCount(prev => prev + 1);

        // Capture context values at enqueue time so they don't drift
        // if the user sends another message while this is queued.
        const capturedMessages = [...messages, newUserMsg];
        const capturedActiveConvId = activeConversationId;
        const capturedAiContext = {
            appState: { ...coreState, ...matterState, ...executionState, ...financeState, ...documentState } as any,
            currentUser: currentUser!,
            currentHistoryEntry,
            localFiles,
            aloaXLibrary: loadAloaXLibrary(),
            isFirmSearchEnabled,
            searchBrain: undefined as ((query: string) => Promise<string>) | undefined,
            injectedContext,
            conversationMemoryContext: conversationMemory ?? null,
            proactiveInsights: proactiveInsights?.map(i => ({
                category: i.category,
                severity: i.severity,
                title: i.title,
                body: i.body,
            })) ?? null,
        };

        // The execute function runs inside the queue — it receives an
        // AbortSignal for timeout cancellation. All references inside
        // use the captured context (capturedMessages, capturedAiContext,
        // capturedActiveConvId) so queued tasks don't drift.
        // Use .catch() to prevent unhandled promise rejection on Safari/iOS
        // which causes "Application Error" and a full app reset.
        // The onError handler already deals with errors — the .catch()
        // just silently swallows the promise rejection.
        aiQueueRef.current.enqueue({
            id: streamMsgId,
            execute: async (signal: AbortSignal) => {
                let currentConvId = capturedActiveConvId;
                isGeneratingRef.current = true; // Prevent history-load from overwriting optimistic UI
                setIsLoading(true); // Show loading state immediately for ALL message types
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
                            // Persist the new conversation ID immediately so
                            // it survives page reloads (the AloaProvider's
                            // session persistence uses this).
                            try {
                                saveAloaSession('global', {
                                    conversationId: currentConvId,
                                    lastMessageAt: Date.now(),
                                });
                            } catch { /* ignore */ }
                        }
                        void saveMessageMutation({
                            conversationId: currentConvId!,
                            firmId: coreState.firmDetails?.id || '',
                            userId: currentUser?.id,
                            message: newUserMsg
                        });
                    }

                    const { brain } = await import('../../services/brainService');

                    const wantsDataSearch = /\b(find|show|list|how many|what are|who are|which|all my|my current|pending|outstanding|overdue|recent|last|today|summary|status|balance|total|count|details|information|record|document|contract|lease|tenant|landlord|property|matter|invoice|payment|rent|charge|fee|agreement|compliance|report)\b/i.test(content);

                    capturedAiContext.searchBrain = async (query: string) => {
                        if (!wantsDataSearch) return "";
                        setAloaStatus('Searching records…');
                        return await brain.search({
                            query,
                            firmId: coreState.firmDetails?.id || '',
                            scope: isProperty ? 'property' : 'legal',
                            convexQuery: (name: any, args: any) => convex.query(name, args)
                        });
                    };
                    capturedAiContext.isFirmSearchEnabled = true;

                    // ── LIVE WEB QUERYING ──────────────────────────────
                    // Detect URLs in the user's message and fetch their content
                    // before sending to the AI. The fetched content is injected
                    // into the AI context so the model can "read" the web page.
                    const urls = content.match(URL_REGEX);
                    let webContent = '';
                    if (urls && urls.length > 0) {
                        setAloaStatus('Fetching web content…');
                        try {
                            const fetchResults = await Promise.all(
                                urls.slice(0, 3).map(async (url) => {
                                    try {
                                        const result = await convex.action(api.webFetch.fetchUrlContent, { url });
                                        if (result.success && result.content) {
                                            return `\n--- WEB CONTENT FROM ${url} ---\nTitle: ${result.title}\n${result.content}\n--- END WEB CONTENT ---\n`;
                                        } else {
                                            return `\n[Could not fetch ${url}: ${result.message}]\n`;
                                        }
                                    } catch {
                                        return `\n[Could not fetch ${url}]\n`;
                                    }
                                })
                            );
                            webContent = fetchResults.join('\n');
                            if (webContent) {
                                // Inject the web content into the last user message
                                // so the AI sees it as part of the conversation
                                const lastMsg = capturedMessages[capturedMessages.length - 1];
                                if (lastMsg && lastMsg.role === 'user') {
                                    lastMsg.content = `${typeof lastMsg.content === 'string' ? lastMsg.content : ''}\n\n[The following web content was fetched for you to analyze:]\n${webContent}`;
                                }
                            }
                        } catch {
                            // If web fetching fails entirely, continue without it
                        }
                    }

                    if (wantsDataSearch) {
                        setAloaStatus('Searching records…');
                    }

                    const wantsToolAction = /\b(create|open|add|new|draft|navigate|show me|find my|schedule|invoice|task|matter|contact)\b/i.test(content);
                    const effectiveModel = preferredModel === 'auto' ? 'flash' : preferredModel;

                    if (!wantsToolAction) {
                        setAloaStatus('Writing…');
                        try {
                            const streamed = await aiService.streamMessage(
                                capturedMessages,
                                capturedAiContext,
                                (chunk) => {
                                    setMessages(prev => prev.map(m =>
                                        m.id === streamMsgId ? { ...m, content: `${typeof m.content === 'string' ? m.content : ''}${chunk}` } : m
                                    ));
                                },
                                effectiveModel,
                                signal // ── AbortSignal passed for timeout cancellation
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
                                return modelMsg;
                            }
                        } catch (streamErr: any) {
                            if (signal.aborted) throw streamErr; // timeout — propagate
                            console.warn('[ARIA] Stream path failed, using tool-capable request:', streamErr);
                        }
                    }

                    setAloaStatus(pendingAttachments.length > 0 ? `Reading ${pendingAttachments.length} document${pendingAttachments.length > 1 ? 's' : ''}…` : 'Thinking…');
                    setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: '' } : m));

                    const response = await aiService.sendMessage(
                        capturedMessages,
                        capturedAiContext,
                        effectiveModel,
                        signal
                    );

                    let currentResponse = response;
                    let iterationCount = 0;
                    const maxIterations = 3;
                    let turnHistory = [...capturedMessages];

                    while (currentResponse.toolCalls && currentResponse.toolCalls.length > 0 && iterationCount < maxIterations) {
                        iterationCount++;
                        setAloaStatus('Using tools…');
                        // Build a conversation context string from recent user
                        // messages so tool handlers (especially start_drafting)
                        // can detect jurisdiction from the user's ORIGINAL
                        // message, not just the AI's extracted args.
                        const conversationContext = capturedMessages
                            .filter(m => m.role === 'user')
                            .slice(-3) // last 3 user messages for context
                            .map(m => typeof m.content === 'string' ? m.content : '')
                            .join(' \n ');
                        const { outputs: toolOutputs, isTerminal } = await handleToolExecution(currentResponse.toolCalls, conversationContext);

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
                            capturedAiContext,
                            effectiveModel,
                            signal
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
                        return modelMsg;
                    } else {
                        setMessages(prev => prev.filter(m => m.id !== streamMsgId));
                        return null;
                    }
                } finally {
                    if (reasoningTimer) clearInterval(reasoningTimer);
                    setIsLoading(false);
                    setAloaStatus('');
                    isGeneratingRef.current = false;
                }
            },
            onSuccess: () => {
                setPendingQueueCount(prev => Math.max(0, prev - 1));
            },
            onError: (error: Error) => {
                if (reasoningTimer) clearInterval(reasoningTimer);
                setPendingQueueCount(prev => Math.max(0, prev - 1));
                setIsLoading(false);
                setAloaStatus('');

                let errorMessage = "I encountered an issue processing your request.";
                let isAuthError = false;
                let helpText = "Please try again later.";

                if (error.message) {
                    if (error.name === 'AbortError' || error.message.includes('timed out')) {
                        errorMessage = "Request Timed Out";
                        helpText = "The AI took too long to respond. This is common on slow mobile connections. Please try again.";
                    }
                    else if (error.message.includes('API key') || error.message.includes('403')) {
                        errorMessage = "Authentication Error: API Key is invalid or missing.";
                        isAuthError = true;
                        helpText = "Please check your AI Settings and verify your API key.\n\n**Need a key?** Get one free at [Google AI Studio](https://aistudio.google.com/app/apikey)\n\n**Where to paste it?** Settings → AI Settings → API Key Configuration";
                    }
                    else if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
                        errorMessage = "Quota Exceeded: Your AI usage limit has been reached.";
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
            },
        }).catch(() => {
            // Silently swallow promise rejection — onError handler already
            // deals with the error. This prevents Safari/iOS from showing
            // "Application Error" due to unhandled promise rejection.
        });
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
        const order: typeof preferredModel[] = ['auto', 'flash', 'pro', 'research'];
        const nextIndex = (order.indexOf(preferredModel) + 1) % order.length;
        setPreferredModel(order[nextIndex]);
    };

    const handleCopyMessage = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    // ─── Send to Research Studio ──────────────────────────────────────────
    // Takes an uploaded document from the ALOA chat and sends it to the
    // Research Studio as a new source in a new (or existing) notebook.
    // The user can then do deeper analysis in the Research Studio with
    // the AI-powered research chat.
    const handleSendToResearch = async (msg: AloaMessage) => {
        if (!msg.attachments || msg.attachments.length === 0) return;
        const attachmentNames = msg.attachmentNames || msg.attachments.map(() => 'Uploaded Document');
        const notebookName = `ALOA Research — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

        try {
            // 1. Create a new research notebook
            const notebook = handleAddResearchNotebook({
                name: notebookName,
                firmId: coreState?.firmDetails?.id || '',
                userId: currentUser?.id || '',
            });

            if (!notebook?.id) {
                addToast('Could not create research notebook.', { type: 'error' });
                return;
            }

            // 2. Add each attachment as a source in the notebook
            for (let i = 0; i < msg.attachments!.length; i++) {
                const storageId = msg.attachments![i];
                const name = attachmentNames[i] || `Document ${i + 1}`;

                // Fetch the file content from Convex storage and extract text
                // using the attachmentProcessor (handles PDF, DOCX, TXT, images)
                try {
                    const { processAttachment } = await import('../../utils/attachmentProcessor');
                    const processed = await processAttachment(storageId, name, import.meta.env.VITE_CONVEX_URL || 'https://gregarious-malamute-537.convex.cloud');

                    if (processed.extractedText) {
                        // Text was successfully extracted from the document
                        handleAddResearchSource(notebook.id, {
                            name,
                            type: 'text',
                            content: processed.extractedText,
                            file: {
                                name,
                                type: processed.mimeType,
                                size: 0,
                                filePath: '',
                                storageId,
                            },
                        });
                    } else if (processed.inlineData) {
                        // Image or scanned PDF — store as file reference
                        handleAddResearchSource(notebook.id, {
                            name,
                            type: 'text',
                            content: `[Image/Scanned document: ${name}. The AI can see this image when you ask about it.]`,
                            file: {
                                name,
                                type: processed.mimeType,
                                size: 0,
                                filePath: '',
                                storageId,
                            },
                        });
                    } else {
                        // Extraction failed — store as reference with error info
                        handleAddResearchSource(notebook.id, {
                            name,
                            type: 'text',
                            content: `Document uploaded from ALOA chat: ${name}. Note: ${processed.error || 'Text extraction failed — the AI may not be able to read this file.'}`,
                            file: {
                                name,
                                type: processed.mimeType,
                                size: 0,
                                filePath: '',
                                storageId,
                            },
                        });
                    }
                } catch (e) {
                    console.warn('[Send to Research] Failed to fetch/extract attachment:', e);
                    handleAddResearchSource(notebook.id, {
                        name,
                        type: 'text',
                        content: `Document uploaded from ALOA chat. File: ${name}. Text extraction failed — please upload a PDF or TXT version for analysis.`,
                        file: {
                            name,
                            type: 'unknown',
                            size: 0,
                            filePath: '',
                            storageId,
                        },
                    });
                }
            }

            // 3. Navigate to the Research Studio with the new notebook selected
            addToast(`Sent ${msg.attachments!.length} document(s) to Research Studio.`, { type: 'success' });
            navigateTo('research', null, { selectedNotebookId: notebook.id });
        } catch (e: any) {
            console.error('[Send to Research] Failed:', e);
            addToast('Could not send to Research Studio: ' + (e.message || 'Unknown error'), { type: 'error' });
        }
    };

    const executeStoredAction = (action: any) => {
        if (action.type === 'modal') {
            openModalRef.current(action.modalType, null, action.context);
        } else if (action.type === 'navigate') {
            navigateToRef.current(action.target, null, action.context);
        } else if (action.type === 'draft') {
            // Defensive persistence check: if a draft was already generated
            // and saved to localStorage for this config, open the editor with
            // the saved content and auto-draft DISABLED. This prevents the
            // "click Open item in chat → re-drafts from scratch" bug.
            //
            // KEY PRINCIPLE: "Open Item" should ALWAYS open the existing draft,
            // NEVER generate a fresh one. If no draft exists (tab closed, no
            // stored content), we tell the user instead of silently regenerating.
            const cfg = action.config || {};
            try {
                const fid = coreState?.firmDetails?.id || '';
                if (fid && cfg.draftTitle) {
                    const key = draftSessionKey({
                        matterId: cfg.matterId,
                        title: cfg.draftTitle,
                        documentId: cfg.documentId,
                    });

                    // ─── Tab-driven desktop workflow ───────────────────────
                    // On desktop, if a tab is already open for this draft,
                    // focus it instead of navigating in-place. This preserves
                    // the user's workspace across multiple drafts.
                    if (isDraftTabOpen(key)) {
                        openDraftInTab({
                            key,
                            url: `/editor?draftKey=${encodeURIComponent(key)}&title=${encodeURIComponent(cfg.draftTitle)}`,
                            title: cfg.draftTitle,
                        });
                        return;
                    }

                    const stored = loadDraftSession(fid, key);
                    if (stored?.content && stored.content.trim().length > 0) {
                        // On desktop, open in a new tab so the user can keep
                        // the chat open alongside the draft.
                        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                            const result = openDraftInTab({
                                key,
                                url: `/editor?draftKey=${encodeURIComponent(key)}&title=${encodeURIComponent(cfg.draftTitle)}`,
                                title: cfg.draftTitle,
                            });
                            if (result !== 'in-place') return;
                        }
                        openEditorRef.current(null, {
                            ...cfg,
                            draftContent: stored.content,
                            disableAutoDraft: true,
                            draftPrompt: undefined, // do NOT re-trigger drafting
                        });
                        return;
                    }

                    // ─── No draft exists ──────────────────────────────────
                    // The draft was never generated, or the tab was closed
                    // before the draft could be saved. Instead of silently
                    // regenerating (which surprises the user), tell them what
                    // happened and let them decide whether to draft again.
                    addToast(`This draft is no longer available (the editor tab may have been closed before the draft finished). Ask me to draft it again if you'd like.`, { type: 'info' });
                    return;
                }
            } catch (e) {
                console.warn('[executeStoredAction] draft lookup failed', e);
            }
            // Fallback: open the editor with the original config.
            // This path is only reached if firmId or draftTitle is missing.
            openEditorRef.current(null, action.config);
        } else if (action.type === 'note' && action.noteId) {
            setActiveNoteId(action.noteId);
            setActiveView('form');
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden shadow-2xl relative">
            <header className="flex-shrink-0 px-3 sm:px-4 py-3 sm:py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-900/50 relative z-10">
                {/* Left: icon + title */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {(activeView === 'quickNote' || activeView === 'form' || activeView === 'details') && (
                        <button
                            onClick={() => { setActiveView('chat'); setActiveNoteId(null); }}
                            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700"
                        >
                            <ChevronRightIcon className="w-5 h-5 rotate-180" />
                        </button>
                    )}
                    <button
                        onClick={() => { setActiveView('chat'); setActiveNoteId(null); }}
                        className={`flex-shrink-0 p-2 sm:p-2.5 rounded-2xl shadow-lg transition-all duration-500 hover:scale-105 active:scale-95 ${activeView === 'chat' ? 'bg-green-600 shadow-green-600/20' : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'}`}
                    >
                        <AloaIcon className={`w-6 h-6 sm:w-7 sm:h-7 ${activeView === 'chat' ? 'text-white' : ''} ${aloaState === 'speaking' ? 'animate-pulse' : ''}`} />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-none truncate">
                                {activeView === 'form' ? 'Edit Note' : activeView === 'details' ? 'Note Details' : activeView === 'quickNote' ? 'New Note' : getAssistantName(isProperty)}
                            </h2>
                            {activeView === 'chat' && <ModelBadge model={preferredModel} onClick={cycleModel} />}
                        </div>
                        {activeView === 'chat' && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium leading-none mt-0.5 truncate">
                                {getAssistantFullName(isProperty)}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: action buttons — ALL wrapped in a container with
                    stopPropagation so the parent panel's onClick doesn't
                    interfere. Each button also has its own stopPropagation. */}
                <div
                    className="flex items-center gap-0.5 sm:gap-1 ml-1 sm:ml-2 flex-shrink-0 relative z-20"
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setActiveView(activeView === 'quickNote' ? 'chat' : 'quickNote'); }}
                        className={`touch-target p-2 rounded-xl transition-all ${activeView === 'quickNote' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        title="Quick Note mode"
                    >
                        <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
                        className={`touch-target p-2 rounded-xl transition-all ${showHistory ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        title="Conversation History"
                    >
                        <HistoryIcon className="w-5 h-5" />
                    </button>
                    <button
                        onPointerDown={handleClose}
                        className="touch-target p-2.5 text-slate-500 hover:text-red-600 transition-all bg-slate-100 dark:bg-zinc-800 rounded-xl active:bg-slate-200 dark:active:bg-zinc-700 flex items-center gap-1.5 border border-slate-200 dark:border-zinc-700 flex-shrink-0 relative z-30"
                        title="Close"
                        aria-label="Close panel"
                    >
                        <XMarkIcon className="w-5 h-5" />
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
                    <div className="flex-1 flex overflow-hidden relative">
                     {showHistory && (
                        <aside className="absolute inset-0 z-20 border-r border-slate-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 animate-in slide-in-from-left duration-300 shadow-2xl">
                        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">History</h3>
                                <button
                                    onClick={() => setShowHistory(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    // "New Search" — clears the current conversation
                                    // and starts fresh. The previous conversation
                                    // is NOT deleted — it remains in the History list
                                    // and can be reopened at any time.
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
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const ok = await confirm({
                                                        title: 'Delete note?',
                                                        message: 'This note will be permanently removed.',
                                                        confirmLabel: 'Delete',
                                                        cancelLabel: 'Cancel',
                                                        danger: true,
                                                        context: note.title,
                                                    });
                                                    if (!ok) return;
                                                    deleteItem('notePages', note.id, note.title);
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
                    className={`flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white dark:bg-zinc-950 transition-all min-w-0`}
                >
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className={`w-20 h-20 rounded-[40px] flex items-center justify-center mb-5 shadow-lg ${isAtrium ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-green-600 shadow-green-600/20'}`}>
                                <AloaIcon className="w-10 h-10 text-white" />
                            </div>
                            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-1">
                                {getAssistantName(isProperty)}
                            </h3>
                            <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                                {getAssistantFullName(isProperty)}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-zinc-500 max-w-[260px] leading-relaxed">
                                {isAtrium
                                    ? 'I can help manage your property portfolio, track revenue, handle tenant communications, and monitor defaulters.'
                                    : 'I can help draft legal documents, manage cases, research Nigerian law, and streamline your practice operations.'}
                            </p>

                            {/* ─── Proactive Insight Badges ────────────────── */}
                            {proactiveInsights && proactiveInsights.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-[300px]">
                                    {proactiveInsights.filter(i => i.severity === 'critical').length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800/50">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            {proactiveInsights.filter(i => i.severity === 'critical').length} Urgent
                                        </span>
                                    )}
                                    {proactiveInsights.filter(i => i.severity === 'warning').length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800/50">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            {proactiveInsights.filter(i => i.severity === 'warning').length} Warning{proactiveInsights.filter(i => i.severity === 'warning').length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {proactiveInsights.filter(i => i.category === 'briefing').length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                            onClick={() => setTextInput("Show me today's morning briefing")}
                                        >
                                            ☀️ Briefing Ready
                                        </span>
                                    )}
                                </div>
                            )}

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
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in zoom-in-95 duration-300`}>
                            {/* PII Shield Badge — shows above user messages when PII was stripped */}
                            {msg.role === 'user' && (msg as any).piiResult && (
                                <PIIShieldBadge result={(msg as any).piiResult} />
                            )}
                            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
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
                                    {/* Attachment thumbnails/files */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {msg.attachments.map((storageId: string, idx: number) => {
                                                const fileName = msg.attachmentNames?.[idx] || `File ${idx + 1}`;
                                                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                                                const convexFileUrl = `${import.meta.env.VITE_CONVEX_URL || ''}/api/storage/${storageId}`;
                                                if (isImage) {
                                                    return (
                                                        <a key={storageId + idx} href={convexFileUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                                                            <img src={convexFileUrl} alt={fileName} className="w-full h-24 object-cover" />
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <a key={storageId + idx} href={convexFileUrl} target="_blank" rel="noopener noreferrer" className={`rounded-lg flex items-center gap-2 px-2.5 py-2 ${msg.role === 'user' ? 'bg-primary-500/30' : 'bg-slate-100 dark:bg-zinc-700'} hover:opacity-80 transition-opacity`}>
                                                        <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                        </svg>
                                                        <span className="text-xs truncate flex-1 text-slate-600 dark:text-zinc-300">{fileName}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Streaming cursor — shows blinking cursor when AI is actively writing this message */}
                                    {isLoading && msg.role === 'model' && idx === messages.length - 1 && !msg.content && (
                                        <div className="flex items-center gap-1 py-1">
                                            <span className="w-2 h-4 bg-primary-500 animate-pulse rounded-sm" />
                                        </div>
                                    )}
                                    {isLoading && msg.role === 'model' && idx === messages.length - 1 && msg.content && (
                                        <span className="inline-block w-1.5 h-4 bg-primary-500 animate-pulse rounded-sm align-text-bottom ml-0.5" />
                                    )}
                                    {msg.interactiveForm && (
                                        <DynamicChatForm
                                            schema={msg.interactiveForm}
                                            onSubmit={(values) => handleFormSubmit(msg.interactiveForm!.formId, values)}
                                        />
                                    )}

                                    {/* ─── Jurisdictional Reasoning (for draft actions) ─── */}
                                    {msg.toolAction?.jurisdictionAnalysis && (
                                        <JurisdictionReasoning
                                            court={msg.toolAction.jurisdictionAnalysis.court}
                                            jurisdiction={msg.toolAction.jurisdictionAnalysis.jurisdiction}
                                            reasoning={msg.toolAction.jurisdictionAnalysis.reasoning}
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

                                    {/* Action buttons row — hover-only on desktop, tap-to-reveal on touch.
                                        Copy AND Save are hidden for messages that have a toolAction
                                        (the output is a structured document opened in DraftPro or a
                                        modal — not copyable/saveable text). Edit remains for user messages. */}
                                    <div className={`flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {!msg.toolAction && (
                                            <button
                                                onClick={() => handleCopyMessage(msg.id, msg.content || '')}
                                                className={`${copiedMessageId === msg.id ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-primary-600'} rounded-md px-1.5 py-0.5 text-[9px] font-bold transition-all flex items-center gap-0.5`}
                                                title="Copy text"
                                            >
                                                {copiedMessageId === msg.id ? (
                                                    <>
                                                        <CheckIcon className="w-2.5 h-2.5" />
                                                        Copied
                                                </>
                                            ) : (
                                                <>
                                                    <ClipboardIcon className="w-2.5 h-2.5" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                        )}

                                        {msg.role === 'user' && (
                                            <button
                                                onClick={() => {
                                                    setTextInput(msg.content || '');
                                                    const msgIdx = messages.findIndex(m => m.id === msg.id);
                                                    if (msgIdx >= 0) {
                                                        setMessages(prev => prev.slice(0, msgIdx));
                                                    }
                                                    setTimeout(() => {
                                                        const input = document.querySelector('input[data-lpignore="true"]') as HTMLInputElement;
                                                        input?.focus();
                                                    }, 100);
                                                }}
                                                className="bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-md px-1.5 py-0.5 text-[9px] font-bold transition-all flex items-center gap-0.5"
                                                title="Edit & resend"
                                            >
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                                </svg>
                                                Edit
                                            </button>
                                        )}

                                        {/* Save to Notes — hidden for toolAction messages (drafts/modals) */}
                                        {msg.role === 'model' && !msg.isError && !msg.toolAction && (
                                            <button
                                                onClick={() => handleSaveMessage(msg.content || '')}
                                                className="bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md px-1.5 py-0.5 text-[9px] font-bold transition-all flex items-center gap-0.5"
                                                title="Save to Notes"
                                            >
                                                <BookmarkIcon className="w-2.5 h-2.5" />
                                                Save
                                            </button>
                                        )}

                                        {/* Send to Research — shown for user messages with attachments */}
                                        {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                                            <button
                                                onClick={() => handleSendToResearch(msg)}
                                                className="bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md px-1.5 py-0.5 text-[9px] font-bold transition-all flex items-center gap-0.5"
                                                title="Send to Research Studio for deeper analysis"
                                            >
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                                </svg>
                                                Research
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && aloaStatus && (
                        <div className="flex items-center gap-2 px-2 py-1">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <p className="text-[10px] font-medium text-primary-600 dark:text-primary-400">{aloaStatus}</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>
            </div>

            <footer className="flex-shrink-0 p-4 sm:p-6 pb-safe bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-900">
                {/* Pending attachment chips */}
                {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 px-1">
                        {pendingAttachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs border border-slate-200 dark:border-zinc-700">
                                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                <span className="max-w-[140px] truncate text-slate-700 dark:text-zinc-300">{att.name}</span>
                                <button
                                    onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))}
                                    className="text-slate-400 hover:text-red-500 ml-0.5 flex-shrink-0"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="flex gap-1.5 items-end"
                >
                    {messages.length > 0 && (
                        <button onClick={resetChat} type="button" className="p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-red-500 transition-all flex-shrink-0" title="Clear chat">
                            <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        multiple
                        className="hidden"
                    />
                    {/* Attach button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex-shrink-0 disabled:opacity-50"
                        title="Attach files"
                    >
                        {isUploading ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.693 7.693" />
                            </svg>
                        )}
                    </button>
                    <div className={`flex-1 rounded-2xl flex items-end border shadow-inner transition-all p-1 bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 focus-within:bg-white dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-primary-500/20`}>
                        <textarea
                            autoComplete="off"
                            data-lpignore="true"
                            value={textInput}
                            onChange={e => {
                                setTextInput(e.target.value);
                                // Auto-resize: reset height then set to scrollHeight
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            onKeyDown={(e) => {
                                // Enter = newline (default textarea behavior)
                                // Ctrl+Enter OR Cmd+Enter = send
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            rows={1}
                            placeholder={
                                isAtrium ? `Ask ${getAssistantName(isProperty)} about your properties…` : `Ask ${getAssistantName(isProperty)} about your practice…`
                            }
                            className="flex-1 bg-transparent border-none text-base text-slate-900 dark:text-white p-3 placeholder-slate-400 focus:ring-0 min-w-0 resize-none overflow-hidden"
                            style={{ maxHeight: '120px' }}
                        />
                        <button
                            type="submit"
                            disabled={!textInput.trim() && pendingAttachments.length === 0}
                            className={`p-2 rounded-xl disabled:opacity-30 transition-all active:scale-95 shadow-md bg-primary-600 text-white flex-shrink-0 mb-1`}
                        >
                            <SendIcon />
                        </button>
                    </div>
                </form>
            </footer>
                </>
            )}
            {ConfirmDialog}
        </div>
    );
};
