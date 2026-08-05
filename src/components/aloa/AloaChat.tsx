
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAloa } from '../../contexts/AloaProvider';
import { useConvex, useMutation, useAction, useQuery } from 'convex/react';
import { AloaMessage, ModalType, AppState, AloaHint, InteractiveFormSchema } from '../../types';
import { AutoExpandingChatInput } from '../toolkit/AutoExpandingChatInput';
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
import { handleCleanCopy } from '../../utils/copyUtils';
import { formatNairaInText } from '../../utils/formatting';
import { isFormalDocument, extractDocumentTitle, aloaContentToDraftHtml } from '../../utils/formalDocumentDetector';
import { CitationRegistry } from '../../utils/citationRegistry';
import { parseAIResponseForCitations } from '../../utils/citationParser';
import { draftSessionKey, loadDraftSession, saveDraftSession } from '../../utils/draftSession';
import { setPendingDraft } from '../../utils/draftContentStore';
import { openDraftInTab, isDraftTabOpen } from '../../utils/draftTabs';
import { saveAloaSession } from '../../utils/aloaSession';
import { buildJurisdictionalReasoning } from '../../utils/jurisdictionConfig';
import { JurisdictionCard } from './JurisdictionCard';
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
        className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-tighter transition-all border shadow-sm flex items-center gap-1 ${
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
    // Use currentUser.firmId (reliably populated from the user document)
    // instead of coreState.firmDetails.id (which is undefined for real
    // admin/staff users because the firms table has _id, not id).
    const firmId = currentUser?.firmId || coreState?.firmDetails?.id;
    const userId = currentUser?.id;

    // Fetch cross-session conversation memory for context injection
    const conversationMemory = useQuery(
        api.conversationMemory.getInjectionContext,
        firmId && userId ? { firmId, userId } : 'skip'
    );

    // Fetch un-dismissed proactive insights (deadlines, anomalies, briefings)
    // Only fetch if the user hasn't disabled AI suggestions in settings
    const showAiSuggestions = (currentUser as any).showAiSuggestions !== false;
    const proactiveInsights = useQuery(
        api.proactive.getInsights,
        showAiSuggestions && firmId ? { firmId, dismissed: false, limit: 10 } : 'skip'
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
    const chatScrollRef = useRef<HTMLElement>(null);
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // ─── Reasoning Timer ─────────────────────────────────────────────────
    // Shows how long the current AI request has been running. Reset to 0
    // when a new request starts, cleared when the response completes.
    const [reasoningTime, setReasoningTime] = useState(0);

    // ─── Insight Detail Panel ───────────────────────────────────────────
    // When the user clicks a proactive insight badge, this opens a detail
    // panel showing each insight with actionable buttons (Go to Matter, etc.)
    const [showInsightPanel, setShowInsightPanel] = useState<'critical' | 'warning' | null>(null);

    // ─── Insight Dismiss ────────────────────────────────────────────────
    // Allows the user to dismiss individual insights or snooze them.
    const dismissInsightMutation = useMutation(api.proactive.dismissInsight);
    const handleDismissInsight = async (insightId: string) => {
        try {
            await dismissInsightMutation({ insightId: insightId as any });
            addToast('Insight dismissed.', { type: 'info' });
        } catch (e) {
            console.warn('[Dismiss Insight] failed:', e);
        }
    };

    // ─── Web Fetch Results (for UI display) ──────────────────────────────
    // When ALOA fetches web content (either from URLs in the user's message
    // or from auto-searching in research mode), the results are stored here
    // and displayed in collapsible panels (like Claude's search results).
    //
    // The `content` field stores the full fetched text (up to 8000 chars)
    // so it can be pushed to the Research Studio as a source. It's populated
    // after the deep-fetch step completes.
    const [webFetchResults, setWebFetchResults] = useState<Array<{
        url: string;
        title: string;
        success: boolean;
        snippet: string;
        content?: string;  // full fetched text (for "Push to Research")
    }> | null>(null);
    // Collapsed state for the web results panel — user can click the chevron
    // to collapse/expand. NOT dismissable (the X is gone). Results persist
    // so the user can still "Push to Research" after the response completes.
    const [webResultsCollapsed, setWebResultsCollapsed] = useState(false);

    // Refs for callbacks
    const liveSessionRef = useRef<any>(null);
    const audioOutputContextRef = useRef<AudioContext | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const isGeneratingRef = useRef<boolean>(false);
    const aiQueueRef = useRef(getGlobalAIQueue());

    // ─── Chat Input Ref ─────────────────────────────────────────────────
    // Used to auto-focus the input after Stop/response completion
    const chatInputRef = useRef<HTMLTextAreaElement>(null);

    // ─── Stop Request (Kill Switch) ─────────────────────────────────────
    // When the user clicks "Stop", we abort the current AI request via
    // the queue's AbortController, clean up the loading state, and
    // return ALOA to an idle, responsive state.
    const handleStopRequest = useCallback(() => {
        aiQueueRef.current.cancelAll();
        setIsLoading(false);
        setAloaStatus('');
        setReasoningTime(0);
        isGeneratingRef.current = false;
        // Remove any empty model message (the streaming placeholder)
        setMessages(prev => prev.filter(m => m.content || m.attachments || m.toolAction || m.isError));
        addToast('Request cancelled.', { type: 'info' });
        // Auto-focus back to the chat input so the user can continue
        setTimeout(() => chatInputRef.current?.focus(), 100);
    }, [addToast]);

    // ─── Citation Registry (per-conversation) ────────────────────────────
    // Populated when ALOA responds in research mode with [1], [2] markers
    // and a "## Sources" block. When the user sends the content to DraftPro,
    // the citations travel with it so they appear in the draft.
    const citationRegistryRef = useRef<CitationRegistry>(new CitationRegistry());

    const [pendingQueueCount, setPendingQueueCount] = useState(0);

    const openModalRef = useRef(openModal);
    const navigateToRef = useRef(navigateTo);
    const openEditorRef = useRef(openEditor);

    // ─── Pre-opened DraftPro tab (popup-safe pattern) ──────────────────
    // Browsers block window.open() if it's not called within a user-gesture
    // call stack. By the time the AI responds with a `start_drafting` tool
    // call (after multiple awaits + a multi-second LLM round-trip), the
    // user gesture is long gone and the popup is blocked.
    //
    // FIX: In handleSend, BEFORE any await, we synchronously open a blank
    // tab if the user's message looks like a draft request. We hold the
    // Window proxy in this ref. When the AI later decides to draft, we
    // navigate the held tab to the editor URL instead of calling
    // window.open() (which would be blocked).
    //
    // If the AI doesn't end up drafting, we close the armed tab after a
    // timeout so the user isn't left with a stray blank tab.
    const armedDraftTabRef = useRef<Window | null>(null);
    const armedDraftTabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track whether the armed tab has been navigated to a real URL.
    // Previously we checked location.href.includes('blank') which was
    // fragile — if the user's message contained the word "blank" (e.g.
    // "draft a blank lease"), the URL-encoded query string would match
    // and the timer would erroneously close an active editor tab.
    const armedDraftTabNavigatedRef = useRef(false);

    /**
     * Detect whether a user message looks like a draft request.
     * If so, we pre-open a blank tab synchronously (in the user gesture)
     * so window.open() isn't blocked later by the popup blocker.
     */
    const maybeArmDraftTab = (message: string) => {
        if (typeof window === 'undefined') return;
        // Only on desktop — mobile doesn't use tabs
        if (window.innerWidth < 768) return;
        // Skip if running in Capacitor native
        if ((window as any).Capacitor?.isNativePlatform?.()) return;

        const draftKeywords = /\b(draft|generate|write me|create.*(?:agreement|contract|motion|letter|notice|pleading|affidavit|deed|lease|tenancy|will|petition|summons|brief|memo|memorandum))\b/i;
        if (!draftKeywords.test(message)) return;

        // Close any previously armed tab that wasn't used
        if (armedDraftTabRef.current && !armedDraftTabRef.current.closed) {
            // Don't close if it has actual content (user navigated it)
            try {
                if (armedDraftTabRef.current.location.href === 'about:blank' || armedDraftTabRef.current.location.href === '') {
                    armedDraftTabRef.current.close();
                }
            } catch {
                // cross-origin — can't read location, leave it
            }
        }
        // Clear any previous auto-close timer
        if (armedDraftTabTimerRef.current) {
            clearTimeout(armedDraftTabTimerRef.current);
        }

        // Open a blank tab WITHIN the user gesture — this is the critical
        // call that must happen synchronously (no await before it).
        // Use a real same-origin URL instead of 'about:blank' because
        // some browsers block about:blank popups even in user gestures.
        const tabName = `draftpro-armed-${Date.now()}`;
        const win = window.open('about:blank', tabName);
        if (win) {
            armedDraftTabRef.current = win;
            // Show a loading message so the user knows something is happening
            try {
                win.document.write(`
                    <html><head><title>Opening DraftPro…</title>
                    <style>
                        body { margin:0; display:flex; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:#f8fafc; font-family:Inter,system-ui,sans-serif; }
                        .spinner { width:32px; height:32px; border:3px solid rgba(255,255,255,0.1); border-top-color:#10b981; border-radius:50%; animation:spin 1s linear infinite; margin-right:12px; }
                        @keyframes spin { to { transform:rotate(360deg) } }
                    </style></head>
                    <body><div class="spinner"></div><div>Preparing DraftPro…</div></body></html>
                `);
            } catch {
                // ignore — some browsers block document.write on cross-origin tabs
            }

            // Auto-close the armed tab if the AI doesn't draft within 90s.
            // Was 30s — too short for reasoning/thinking models that take
            // 30-60s to respond. Now matches the DraftPro safety timeout.
            armedDraftTabTimerRef.current = setTimeout(() => {
                // Only close if the tab hasn't been navigated to a real URL yet
                if (!armedDraftTabNavigatedRef.current && armedDraftTabRef.current && !armedDraftTabRef.current.closed) {
                    try {
                        if (armedDraftTabRef.current.location.href === 'about:blank' ||
                            armedDraftTabRef.current.location.href === '') {
                            armedDraftTabRef.current.close();
                        }
                    } catch {
                        // cross-origin — can't verify, leave it
                    }
                }
                armedDraftTabRef.current = null;
                armedDraftTabTimerRef.current = null;
            }, 90000);
        }
    };

    /**
     * Navigate the armed draft tab to the editor URL. Called from the
     * `start_drafting` tool handler when the AI decides to draft.
     * Returns true if the tab was successfully navigated, false otherwise.
     */
    const navigateArmedDraftTab = (url: string): boolean => {
        if (armedDraftTabRef.current && !armedDraftTabRef.current.closed) {
            try {
                armedDraftTabRef.current.location.href = url;
                armedDraftTabRef.current.focus();
                // Mark as navigated so the auto-close timer won't close it
                armedDraftTabNavigatedRef.current = true;
                // Clear the auto-close timer — the tab is now in use
                if (armedDraftTabTimerRef.current) {
                    clearTimeout(armedDraftTabTimerRef.current);
                    armedDraftTabTimerRef.current = null;
                }
                armedDraftTabRef.current = null;
                return true;
            } catch {
                // cross-origin error — can't navigate, fall through
                armedDraftTabRef.current = null;
            }
        }
        return false;
    };

    useEffect(() => {
        openModalRef.current = openModal;
        navigateToRef.current = navigateTo;
        openEditorRef.current = openEditor;
    }, [openModal, navigateTo, openEditor]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // ─── Scroll-to-top and scroll-to-bottom ──────────────────────────────
    // Track scroll position to show/hide the floating buttons. When the
    // user is at the top, show "scroll to bottom". When at the bottom,
    // show "scroll to top". When in the middle, show both.
    const handleChatScroll = () => {
        const el = chatScrollRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceFromTop = scrollTop;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        setIsAtBottom(distanceFromBottom < 50);
        setShowScrollButtons(distanceFromTop > 200 || distanceFromBottom > 200);
    };

    const scrollToTop = () => {
        chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load messages for active conversation
    useEffect(() => {
        if (!activeConversationId) {
            // No active conversation — clear messages so the empty state shows
            setMessages([]);
            return;
        }
        // Don't reload if we're actively generating (optimistic UI)
        if (isGeneratingRef.current && messages.length > 0) return;

        let cancelled = false;

        const loadMessages = async () => {
            if (cancelled) return;
            setIsLoading(true);
            try {
                const history = await convex.query(api.myFunctions.getAloaMessages, { conversationId: activeConversationId });
                if (cancelled) return;
                if (history && history.length > 0) {
                    setMessages(history.map((m: any) => ({
                        ...m,
                        id: m.id || m._id
                    })));
                } else {
                    setMessages([]);
                }
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load conversation history:", err);
                addToast('Could not load conversation history.', { type: 'error' });
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadMessages();

        return () => { cancelled = true; };
    }, [activeConversationId, convex, setMessages, setIsLoading, addToast]);

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
                        // Return FULL matter details including ID so the AI
                        // can navigate to the matter detail page.
                        // Previously only returned { title, status, ref } —
                        // missing the ID, so the AI said "I cannot display
                        // the details" because it had no ID to navigate with.
                        results.matters = (matterState.matters || []).filter(m =>
                            m.title.toLowerCase().includes(query) || m.referenceNumber.toLowerCase().includes(query)
                        ).slice(0, 5).map(m => ({
                            id: m.id,
                            title: m.title,
                            status: m.status,
                            ref: m.referenceNumber,
                            matterType: (m as any).matterType || '',
                            court: (m as any).court || '',
                            suitNumber: (m as any).suitNumber || '',
                            clientId: (m as any).clientId || '',
                            stage: (m as any).stage || '',
                            assignedUsers: (m as any).assignedUsers || [],
                            createdAt: (m as any).createdAt,
                            updatedAt: (m as any).updatedAt,
                            description: (m as any).description || '',
                        }));
                    }

                    if (category === 'all' || category === 'documents') {
                        results.documents = (documentState.documents || []).filter(d =>
                            d.title.toLowerCase().includes(query)
                        ).slice(0, 5).map(d => ({ id: d.id, title: d.title, status: d.litigationStatus }));
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
                        // ─── Normalize view names ────────────────────────
                        // The AI sometimes passes snake_case (matter_details) or
                        // variations (matter-details, MatterDetail) instead of
                        // the camelCase the app expects (matterDetail).
                        // Normalize all variations to the correct view name.
                        const viewAliases: Record<string, string> = {
                            'matter_details': 'matterDetail',
                            'matter-details': 'matterDetail',
                            'matterdetail': 'matterDetail',
                            'contact_details': 'contactDetail',
                            'contact-details': 'contactDetail',
                            'document_details': 'documentDetail',
                            'document-details': 'documentDetail',
                            'property_details': 'propertyDetail',
                            'property-details': 'propertyDetail',
                        };
                        const normalizedView = viewAliases[(args.view || '').toLowerCase()] || args.view;

                        // ─── Validate the selectedId ─────────────────────
                        // The AI sometimes passes the matter TITLE as the
                        // selectedId instead of the actual ID. This causes
                        // the URL to become /matters/Matter%20Title which
                        // results in a 404. If the selectedId looks like a
                        // title (contains spaces or is very long), try to
                        // find the actual matter by title.
                        let selectedId = args.selectedId;
                        if (selectedId && (selectedId.includes(' ') || selectedId.length > 50)) {
                            // Looks like a title, not an ID — try to find the matter
                            const matter = matterState.matters.find(m =>
                                m.title.toLowerCase() === selectedId.toLowerCase()
                            );
                            if (matter) {
                                selectedId = matter.id;
                            } else {
                                // Can't find the matter — show a toast instead of navigating to a 404
                                addToast(`Could not find "${selectedId}". Try searching for it in the Matters list.`, { type: 'info' });
                                isTerminal = true;
                                continue;
                            }
                        }

                        feedbackMessage = `Navigating to ${normalizedView}...`;
                        navigateToRef.current(normalizedView, selectedId, args.context);
                        isTerminal = true;

                    } else if (name === 'start_drafting') {
                        const draftConfig: any = {
                            openedByAloa: true,
                            draftTitle: args.title || 'New Draft',
                            draftPrompt: args.prompt,
                        };

                        // ─── Attach citations (research mode) ────────────────
                        // If the AI passed a citations array in the tool call,
                        // add them to the registry and attach to the draft.
                        // Also include any citations from earlier in the
                        // conversation (the registry accumulates across
                        // messages within the same conversation).
                        if (args.citations && Array.isArray(args.citations) && args.citations.length > 0) {
                            for (const cite of args.citations) {
                                citationRegistryRef.current.add({
                                    type: cite.type || 'other',
                                    text: cite.text || '',
                                    rawText: cite.text || '',
                                    url: cite.url,
                                    jurisdiction: cite.jurisdiction,
                                });
                            }
                        }
                        // Always attach the current registry state to the draft
                        const citationsPayload = citationRegistryRef.current.toJSON();
                        if (citationsPayload.citations.length > 0) {
                            draftConfig.citations = citationsPayload;
                        }

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
                        //
                        // ─── NEW BEHAVIOUR (no more armed-tab pre-open) ───────
                        // We NO LONGER pre-open a blank "Preparing DraftPro…"
                        // tab at send time. That pattern showed a spinner tab
                        // the instant the user pressed Enter, even though the
                        // AI hadn't started reasoning yet — which felt broken
                        // and premature.
                        //
                        // Now we wait until the AI actually calls
                        // `start_drafting` (meaning it has reasoned about the
                        // request and is ready to produce the draft). At this
                        // point we try window.open() directly. Two outcomes:
                        //
                        // 1. SUCCESS: The browser allows the popup (either the
                        //    user has granted popup permission, or the browser
                        //    still considers this close enough to the user
                        //    gesture). The draft tab opens immediately.
                        //
                        // 2. BLOCKED: The popup blocker intervenes (returns
                        //    null). We do NOT silently fall back to in-place
                        //    navigation — that would replace the chat with the
                        //    editor, losing the conversation context. Instead,
                        //    we set `pendingDraftOpen: true` on the action
                        //    data, which causes a prominent "Open DraftPro"
                        //    button to appear under the AI's response. The
                        //    user clicks it (which IS a user gesture) and the
                        //    tab opens reliably via executeStoredAction.
                        try {
                            const fid = currentUser?.firmId || coreState?.firmDetails?.id || '';
                            const draftKey = draftSessionKey({
                                matterId: undefined,
                                title: draftConfig.draftTitle,
                            });

                            // ─── DRAFTPRO-NEW-TAB — SINGLE SOURCE OF TRUTH ──
                            // All DraftPro navigation MUST go through openDraftProNewTab.
                            // This function NEVER falls back to same-tab navigation on desktop
                            // (that was the root cause of the prior regressions).
                            // On mobile it returns 'in-place' and the caller opens in-place.

                            // Save the draft session to localStorage BEFORE opening the tab
                            try {
                                const { saveDraftSession } = await import('../../utils/draftSession');
                                saveDraftSession(fid, draftKey, {
                                    title: draftConfig.draftTitle,
                                    content: '', // empty — editor will auto-draft
                                    draftPrompt: draftConfig.draftPrompt || draftConfig.draftTitle,
                                    matterId: draftConfig.matterId || undefined, // FIX 5a: persist matterId
                                    citations: draftConfig.citations || undefined, // FIX 5b: persist citations
                                    updatedAt: new Date().toISOString(),
                                    savedAt: Date.now(),
                                });
                            } catch (e) {
                                console.warn('[start_drafting] saveDraftSession failed:', e);
                            }

                            // Open DraftPro via the single source of truth
                            const { openDraftProNewTab } = await import('../../utils/tabNavigation');
                            const result = openDraftProNewTab(
                                draftKey,
                                draftConfig.draftTitle,
                                draftConfig.draftPrompt || '',
                                // FIX 5b: pass citations + matterId via hash context
                                {
                                    citations: draftConfig.citations,
                                    matterId: draftConfig.matterId,
                                }
                            );

                            if (result === 'new-tab' || result === 'existing-tab') {
                                feedbackMessage = `Opened "${draftConfig.draftTitle}" in a new tab. You can continue chatting here.`;
                            } else if (result === 'in-place') {
                                // Mobile only — no tabs on mobile, in-place is correct
                                feedbackMessage = `Drafting **${draftConfig.draftTitle}** — ${jurisdictionAnalysis.court}`;
                                openEditorRef.current(null, draftConfig);
                            } else {
                                // 'blocked' — desktop popup blocked. DO NOT navigate in-place.
                                feedbackMessage = `I prepared **${draftConfig.draftTitle}** but your browser blocked the pop-up. Please allow pop-ups for this site and ask me to draft again — your chat will stay intact here.`;
                            }
                        } catch (e) {
                            console.warn('[start_drafting] tab open failed', e);
                            // DRAFTPRO-NEW-TAB — last-resort fallback
                            // DRAFTPRO-NEW-TAB — mobile/popup-blocked fallback (allowed)
                            openEditorRef.current(null, draftConfig);
                        }
                        // Build the action data. The label is always "Resume Drafting"
                        // now — we no longer show a pending-open button. If the popup
                        // was blocked, we opened the draft in-place immediately.
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
                            
                            if (liveSessionRef.current?.searchBrain) {
                                try {
                                    const brainResult = await liveSessionRef.current.searchBrain(query);
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
                    } else if (name === 'search_web') {
                        // ── LIVE WEB SEARCH ──────────────────────────────────
                        // The AI actively searches the web for current information.
                        // This is DIFFERENT from the reactive URL-fetching above
                        // (which only triggers when the user pastes a URL).
                        // search_web lets the AI decide on its own that it needs
                        // fresh info, then formulate a search query.
                        const { query } = args;
                        feedbackMessage = `Searching the web for "${query}"…`;
                        try {
                            // Use client-side web search (no Convex needed).
                            // The Convex backend was never deployed, so
                            // api.webFetch.searchWeb is undefined at runtime.
                            // This client-side version uses CORS proxies.
                            let webResults: any[] = [];
                            try {
                                const { searchWebClient } = await import('../../utils/webFetchClient');
                                const searchRes = await searchWebClient(query);
                                if (searchRes.success && searchRes.results) {
                                    webResults = searchRes.results;
                                }
                            } catch (searchErr) {
                                console.warn('[search_web] client search failed:', searchErr);
                            }

                            toolOutput = {
                                results: webResults,
                                note: webResults.length === 0
                                    ? 'Web search returned no results. The user may need to provide more specific keywords.'
                                    : undefined,
                            };

                            actionData = {
                                type: 'web_search',
                                query,
                                results: webResults,
                                label: webResults.length > 0 ? 'View Web Results' : undefined,
                            };

                            feedbackMessage = webResults.length > 0
                                ? `I found ${webResults.length} web result(s) for "${query}". Reading the most relevant ones now…`
                                : `I couldn't find web results for "${query}". Could you refine the search or share a specific URL?`;
                        } catch (err: any) {
                            toolOutput = { error: err.message };
                            feedbackMessage = `Web search encountered an issue: ${err.message}. I'll answer from my training data instead.`;
                        }
                    } else if (name === 'fetch_web_page') {
                        // ── FETCH + READ A SPECIFIC WEB PAGE ─────────────────
                        // Used after search_web to read a result in depth, OR
                        // when the user provides a URL and wants ALOA to
                        // actually READ the page (not just show a preview).
                        const { url } = args;
                        feedbackMessage = `Reading ${url}…`;
                        try {
                            // Use client-side fetch (no Convex needed)
                            const { fetchUrlContentClient } = await import('../../utils/webFetchClient');
                            const result = await fetchUrlContentClient(url);
                            if (result.success && result.content) {
                                toolOutput = {
                                    success: true,
                                    url: result.url,
                                    title: result.title,
                                    description: result.description,
                                    content: result.content,
                                    contentType: result.contentType,
                                };
                                feedbackMessage = `I've read "${result.title}". Analyzing the content now…`;
                            } else {
                                toolOutput = {
                                    success: false,
                                    error: result.error || 'FETCH_FAILED',
                                    message: result.message || 'Could not fetch the page.',
                                };
                                feedbackMessage = `I couldn't read that page: ${result.message || 'unknown error'}. You can paste the text directly if you have it.`;
                            }
                        } catch (err: any) {
                            toolOutput = { error: err.message };
                            feedbackMessage = `Failed to fetch the page: ${err.message}. Please try again or paste the text directly.`;
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
                                firmId: currentUser?.firmId || coreState.firmDetails?.id || '',
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

        // ─── DRAFT TAB OPENING ───────────────────────────────────────────
        // NOTE: We NO LONGER pre-open a blank "Preparing DraftPro…" tab
        // at send time. That pattern showed a spinner tab the instant the
        // user pressed Enter, even though the AI hadn't started reasoning
        // yet — which felt broken and premature.
        //
        // Instead, we wait until the AI actually calls `start_drafting`
        // (meaning it has reasoned about the request and is ready to
        // produce the draft). At that point we try window.open(). If the
        // popup blocker intervenes (because we're outside the user's
        // click gesture after multiple awaits), we surface a prominent
        // "Open DraftPro" button in the chat — the user clicks it (which
        // IS a user gesture) and the tab opens reliably.
        //
        // The armed-tab refs below are kept for backward compatibility
        // with handleDraftInDraftPro (which still uses the held-tab
        // pattern for the "send chat content to DraftPro" flow), but
        // maybeArmDraftTab is no longer called from handleSend.

        // Clear previous web fetch results when starting a new message
        setWebFetchResults(null);
        setWebResultsCollapsed(false);  // reset collapsed state for new results

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
        // ─── Dynamic status with real-time tracking + timer ─────────────
        // Instead of cycling through generic messages ("Researching…",
        // "Cross-referencing…"), we track what ALOA is ACTUALLY doing
        // and show a live timer so the user knows how long it's been.
        const startTime = Date.now();
        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            // Update the timer display (appended to the current status)
            setReasoningTime(elapsed);
        };
        const timerInterval = setInterval(updateTimer, 1000);

        const baseStatus = pendingAttachments.length > 0
            ? `Reading ${pendingAttachments.length} document${pendingAttachments.length > 1 ? 's' : ''}…`
            : preferredModel === 'research'
                ? 'Analyzing your query…'
                : 'Thinking…';
        setAloaStatus(baseStatus);

        // In research mode, show dynamic reasoning states that reflect
        // what's actually happening — NOT generic cycling phrases.
        // The status updates are triggered by real events (web fetch,
        // tool call, etc.) rather than a timer.
        let reasoningTimer: ReturnType<typeof setTimeout> | null = null;
        if (preferredModel === 'research' && pendingAttachments.length === 0) {
            // Only cycle if no specific action is happening
            const reasoningSteps = [
                'Analyzing your query…',
                'Identifying relevant legal principles…',
                'Formulating response…',
            ];
            let stepIdx = 0;
            reasoningTimer = setInterval(() => {
                // Only advance if we're still in the "thinking" phase
                // (not actively fetching web content or using tools)
                stepIdx = (stepIdx + 1) % reasoningSteps.length;
                setAloaStatus(prev => {
                    // Don't override specific statuses (web fetch, tool use)
                    if (prev.includes('Reading') || prev.includes('Searching') || prev.includes('Using tools')) {
                        return prev;
                    }
                    return reasoningSteps[stepIdx];
                });
            }, 5000); // Slower cycle — 5s instead of 4s
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
                                firmId: currentUser?.firmId || coreState.firmDetails?.id || '',
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
                            firmId: currentUser?.firmId || coreState.firmDetails?.id || '',
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
                            firmId: currentUser?.firmId || coreState.firmDetails?.id || '',
                            scope: isProperty ? 'property' : 'legal',
                            convexQuery: (name: any, args: any) => convex.query(name, args)
                        });
                    };
                    capturedAiContext.isFirmSearchEnabled = true;

                    // Determine the effective model (needed for auto web search below)
                    const effectiveModel = preferredModel === 'auto' ? 'flash' : preferredModel;

                    // ── LIVE WEB QUERYING (CLIENT-SIDE — no Convex needed) ──
                    // Detect URLs in the user's message and fetch their content
                    // using client-side CORS proxies. The fetched content is
                    // injected into the AI context so the model can "read" the
                    // web page.
                    //
                    // PREVIOUSLY this used `convex.action(api.webFetch.fetchUrlContent)`
                    // but that was UNDEFINED at runtime because the Convex backend
                    // was never deployed. Every web fetch silently failed in a
                    // try/catch, so ALOA never actually read any websites.
                    //
                    // NOW we use `fetchUrlContentClient` from webFetchClient.ts
                    // which works entirely client-side via CORS proxies.
                    const urls = content.match(URL_REGEX);
                    let webContent = '';
                    if (urls && urls.length > 0) {
                        setAloaStatus(`Reading ${urls.length} website${urls.length > 1 ? 's' : ''}…`);
                        try {
                            const { fetchUrlContentClient } = await import('../../utils/webFetchClient');
                            const fetchResults = await Promise.all(
                                urls.slice(0, 3).map(async (url) => {
                                    try {
                                        const result = await fetchUrlContentClient(url);
                                        if (result.success && result.content) {
                                            return {
                                                url,
                                                title: result.title || url,
                                                content: result.content,
                                                success: true,
                                            };
                                        }
                                        return { url, success: false, message: result.message };
                                    } catch {
                                        return { url, success: false, message: 'Fetch failed' };
                                    }
                                })
                            );

                            // Build the web content string for the AI
                            const successfulFetches = fetchResults.filter(r => r.success);
                            if (successfulFetches.length > 0) {
                                webContent = successfulFetches.map(r =>
                                    `\n--- WEB CONTENT FROM ${r.url} ---\nTitle: ${r.title}\n${r.content}\n--- END WEB CONTENT ---\n`
                                ).join('\n');
                            }

                            // Show web fetch results in the UI (like Claude's search panels)
                            // Store the full content (up to 8000 chars) for "Push to Research"
                            setWebFetchResults(fetchResults.map(r => ({
                                url: r.url,
                                title: r.title || r.url,
                                success: r.success,
                                snippet: r.success ? (r.content || '').substring(0, 200) + '...' : (r.message || 'Failed to fetch'),
                                content: r.success ? (r.content || '').substring(0, 8000) : undefined,
                            })));

                            if (webContent) {
                                // Inject the web content into the last user message
                                // so the AI sees it as part of the conversation
                                const lastMsg = capturedMessages[capturedMessages.length - 1];
                                if (lastMsg && lastMsg.role === 'user') {
                                    lastMsg.content = `${typeof lastMsg.content === 'string' ? lastMsg.content : ''}\n\n[The following web content was fetched for you to analyze. Use this information to provide an accurate, informed response:]\n${webContent}`;
                                }
                            }
                        } catch {
                            // If web fetching fails entirely, continue without it
                        }
                    }

                    // ── PARALLEL WEB SEARCH IN RESEARCH MODE (like Claude) ──
                    // In research mode, if the user's message doesn't contain a URL
                    // but asks a legal question, automatically search the web for
                    // relevant information using MULTIPLE PARALLEL QUERIES.
                    //
                    // Instead of one search, we generate 2-3 different search
                    // queries from the user's message and run them ALL IN PARALLEL.
                    // This matches how Claude does it (the screenshot showed
                    // multiple search panels appearing at once).
                    if (effectiveModel === 'research' && (!urls || urls.length === 0)) {
                        const legalKeywords = /\b(law|legal|statute|regulation|compliance|contract|agreement|liability|jurisdiction|court|rights|obligations|duty|tort|negligence|breach|damages|injunction|liability|hipaa|gdpr|ccpa|privacy|employment|independent contractor|misclassification|AB5|professional|ethics|fee|referral|witness|expert|advisory|advise|counsel)\b/i;
                        if (legalKeywords.test(content)) {
                            setAloaStatus('Searching the web (parallel queries)…');
                            try {
                                const { searchWebClient, fetchUrlContentClient } = await import('../../utils/webFetchClient');

                                // ─── Generate multiple search queries ────────
                                // Extract key topics from the user's message
                                // and generate 2-3 different search angles.
                                const searchQueries: string[] = [];

                                // Query 1: The full question (truncated)
                                searchQueries.push(content.substring(0, 150).replace(/\n/g, ' ').trim());

                                // Query 2: Extract legal terms + jurisdiction
                                const jurisdictionMatch = content.match(/\b(nigeria|california|san francisco|united states|US|UK|new york|texas|florida|ghana|kenya|south africa|india|canada|australia)\b/i);
                                const legalTermMatch = content.match(/\b(expert witness|independent contractor|tenancy|lease|employment|hipaa|ccpa|gdpr|privacy|contract|agreement|liability|negligence|breach|damages|injunction|compliance|statute|regulation)\b/i);
                                if (legalTermMatch && jurisdictionMatch) {
                                    searchQueries.push(`${legalTermMatch[0]} ${jurisdictionMatch[0]} legal requirements`);
                                } else if (legalTermMatch) {
                                    searchQueries.push(`${legalTermMatch[0]} legal requirements law`);
                                }

                                // Query 3: Specific statutes/rules if mentioned
                                const statuteMatch = content.match(/\b(AB5|Section \d+|Civil Code|Labor Code|Constitution|Rules of (Professional Conduct|Civil Procedure))\b/i);
                                if (statuteMatch) {
                                    searchQueries.push(`${statuteMatch[0]} legal requirements`);
                                }

                                // Limit to 3 queries max
                                const queriesToRun = searchQueries.slice(0, 3);

                                // ─── Run all searches IN PARALLEL ───────────
                                setAloaStatus(`Running ${queriesToRun.length} web searches in parallel…`);
                                const searchResults = await Promise.all(
                                    queriesToRun.map(async (query) => {
                                        try {
                                            const result = await searchWebClient(query);
                                            return { query, result, success: result.success };
                                        } catch {
                                            return { query, result: { success: false, results: [], query }, success: false };
                                        }
                                    })
                                );

                                // Collect all unique results
                                const allResults: Array<{ url: string; title: string; snippet: string; query: string }> = [];
                                const seenUrls = new Set<string>();
                                for (const sr of searchResults) {
                                    if (sr.success && sr.result.results) {
                                        for (const r of sr.result.results) {
                                            if (!seenUrls.has(r.url)) {
                                                seenUrls.add(r.url);
                                                allResults.push({ ...r, query: sr.query });
                                            }
                                        }
                                    }
                                }

                                if (allResults.length > 0) {
                                    // Show ALL search results in the UI (like Claude's panels)
                                    setWebFetchResults(allResults.map(r => ({
                                        url: r.url,
                                        title: r.title,
                                        success: true,
                                        snippet: r.snippet,
                                    })));

                                    // Fetch the top 4 results IN PARALLEL for deeper content
                                    setAloaStatus(`Reading ${Math.min(4, allResults.length)} web pages in parallel…`);
                                    const topResults = allResults.slice(0, 4);
                                    const deepFetches = await Promise.all(
                                        topResults.map(async (r) => {
                                            try {
                                                const fetchResult = await fetchUrlContentClient(r.url);
                                                if (fetchResult.success && fetchResult.content) {
                                                    return {
                                                        url: r.url,
                                                        title: fetchResult.title || r.title,
                                                        content: fetchResult.content.substring(0, 8000),
                                                        success: true,
                                                    };
                                                }
                                                return { url: r.url, title: r.title, content: r.snippet, success: true };
                                            } catch {
                                                return { url: r.url, title: r.title, content: r.snippet, success: true };
                                            }
                                        })
                                    );

                                    // ─── Update webFetchResults with the full content ──
                                    // Merge the deep-fetched content into the existing
                                    // webFetchResults state so the "Push to Research"
                                    // button can send the actual page text (not just
                                    // the snippet) to the Research Studio.
                                    setWebFetchResults(prev => {
                                        if (!prev) return prev;
                                        const contentMap = new Map(deepFetches.map(r => [r.url, r.content]));
                                        return prev.map(r => ({
                                            ...r,
                                            content: contentMap.get(r.url) || r.content || r.snippet,
                                        }));
                                    });

                                    const deepContent = deepFetches
                                        .filter(r => r.success && r.content)
                                        .map(r => `\n--- WEB CONTENT FROM ${r.url} ---\nTitle: ${r.title}\n${r.content}\n--- END WEB CONTENT ---\n`)
                                        .join('\n');

                                    if (deepContent) {
                                        const lastMsg = capturedMessages[capturedMessages.length - 1];
                                        if (lastMsg && lastMsg.role === 'user') {
                                            lastMsg.content = `${typeof lastMsg.content === 'string' ? lastMsg.content : ''}\n\n[The following web content was found via ${queriesToRun.length} parallel web searches and fetched for your analysis. Use this to provide accurate, cited information:]\n${deepContent}`;
                                        }
                                    }
                                }
                            } catch {
                                // search failed — continue without it
                            }
                        }
                    }

                    if (wantsDataSearch) {
                        setAloaStatus('Searching records…');
                    }

                    const wantsToolAction = /\b(create|open|add|new|draft|navigate|show me|find my|schedule|invoice|task|matter|contact)\b/i.test(content);

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
                                        firmId: currentUser?.firmId || coreState.firmDetails?.id || '',
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

                        // ─── Show which tools are being called ──────────────
                        // Make tool use evident — list the tool names in the
                        // status so the user can see exactly what ALOA is doing.
                        const toolNames = currentResponse.toolCalls.map((tc: any) => {
                            // Convert tool name to a human-readable label
                            const name = tc.name || '';
                            if (name === 'search_web') return 'web search';
                            if (name === 'fetch_web_page') return 'reading page';
                            if (name === 'search_legal_repo') return 'legal repo';
                            if (name === 'query_firm_data') return 'firm data';
                            if (name === 'analyze_document') return 'analyzing doc';
                            if (name === 'start_drafting') return 'drafting';
                            if (name === 'create_matter') return 'new matter';
                            if (name === 'create_contact') return 'new contact';
                            if (name === 'create_task') return 'new task';
                            if (name === 'create_event') return 'new event';
                            if (name === 'create_property') return 'new property';
                            if (name === 'navigate_to') return 'navigating';
                            if (name === 'execute_quick_action') return 'executing';
                            if (name === 'update_open_form') return 'filling form';
                            return name.replace(/_/g, ' ');
                        });

                        if (toolNames.length === 1) {
                            setAloaStatus(`Using tool: ${toolNames[0]}…`);
                        } else if (toolNames.length > 1) {
                            // Multiple tools called in parallel
                            setAloaStatus(`Running ${toolNames.length} tools in parallel: ${toolNames.join(' · ')}…`);
                        } else {
                            setAloaStatus('Using tools…');
                        }

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
                            toolCalls: currentResponse.toolCalls,
                            // Preserve thought_signature so the next API call
                            // doesn't throw "Function call is missing a thought_signature"
                            ...(currentResponse as any).thoughtSignature ? {
                                thoughtSignature: (currentResponse as any).thoughtSignature
                            } : {},
                        } as any;

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

                        // ─── Parse citations (research mode) ─────────────────
                        // If in research mode, parse the AI response for [1], [2]
                        // markers and a "## Sources" block. Populate the
                        // citation registry so citations travel with the
                        // content when sent to DraftPro.
                        let displayText = validatedText;
                        let messageCitations: any = undefined;
                        if (effectiveModel === 'research') {
                            const parsed = parseAIResponseForCitations(validatedText, citationRegistryRef.current);
                            if (parsed.hasSources) {
                                displayText = parsed.displayText;
                                messageCitations = citationRegistryRef.current.toJSON();
                            }
                        }

                        const parsedForm = tryParseInteractiveForm(displayText);
                        const modelMsg: AloaMessage = {
                            id: streamMsgId,
                            role: 'model',
                            content: parsedForm ? '' : displayText,
                            interactiveForm: parsedForm ?? undefined,
                            modelUsed: currentResponse.modelUsed,
                            // Attach citations to the message so they can be
                            // rendered in the chat and passed to DraftPro
                            ...(messageCitations ? { citations: messageCitations } : {}),
                        } as any;
                        setMessages(prev => prev.map(m => m.id === streamMsgId ? modelMsg : m));

                        // ─── Armed draft tab cleanup ─────────────────────────
                        // Previously we pre-opened a blank "Preparing DraftPro…"
                        // tab at send time and updated/closed it here based on
                        // whether the AI response was a formal document. That
                        // pattern was removed because the premature spinner
                        // tab felt broken. armedDraftTabRef is now always null
                        // at this point (we never arm a tab from handleSend),
                        // so this block is a no-op — kept as a defensive guard
                        // in case handleDraftInDraftPro left a stray tab.
                        if (armedDraftTabRef.current && !armedDraftTabRef.current.closed) {
                            // If the AI responded with a formal document, the
                            // user can click "Draft in DraftPro" — we leave
                            // the tab alone (handleDraftInDraftPro will use it).
                            // Otherwise close any stray armed tab.
                            if (!isFormalDocument(validatedText)) {
                                if (!armedDraftTabNavigatedRef.current) {
                                    try {
                                        if (armedDraftTabRef.current.location.href === 'about:blank' ||
                                            armedDraftTabRef.current.location.href === '') {
                                            armedDraftTabRef.current.close();
                                        }
                                    } catch {
                                        // cross-origin — can't verify, leave it
                                    }
                                }
                                armedDraftTabRef.current = null;
                                if (armedDraftTabTimerRef.current) {
                                    clearTimeout(armedDraftTabTimerRef.current);
                                    armedDraftTabTimerRef.current = null;
                                }
                            }
                        }

                        if (!isDemo && currentConvId) {
                            void saveMessageMutation({
                                conversationId: currentConvId,
                                firmId: currentUser?.firmId || coreState.firmDetails?.id || '',
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
                    clearInterval(timerInterval);
                    setReasoningTime(0);
                    setIsLoading(false);
                    setAloaStatus('');
                    isGeneratingRef.current = false;
                    // Auto-focus back to the chat input after response completes
                    setTimeout(() => chatInputRef.current?.focus(), 100);
                }
            },
            onSuccess: () => {
                setPendingQueueCount(prev => Math.max(0, prev - 1));
            },
            onError: (error: Error) => {
                if (reasoningTimer) clearInterval(reasoningTimer);
                clearInterval(timerInterval);
                setReasoningTime(0);
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

    // ─── Draft in DraftPro ────────────────────────────────────────────────
    // When ALOA generates a formal document/letter in the chat (instead of
    // calling start_drafting), the user can click "Draft in DraftPro" to
    // send that content to DraftPro for proper editing. This converts the
    // ALOA markdown to HTML and opens the editor with the content pre-loaded
    // and auto-draft DISABLED (so the user keeps the exact content).
    const handleDraftInDraftPro = (content: string, msgCitations?: any) => {
        try {
            const title = extractDocumentTitle(content);
            const html = aloaContentToDraftHtml(content);

            // Build the draft config — pass the content as draftContent so
            // DraftPro loads it directly. disableAutoDraft=true so it doesn't
            // re-generate (the AI already wrote the content).
            const draftConfig: any = {
                openedByAloa: true,
                draftTitle: title,
                draftContent: html,
                disableAutoDraft: true,
                draftPrompt: undefined,
            };

            // Attach citations if available (from the message or the registry)
            const citationsToAttach = msgCitations || citationRegistryRef.current.toJSON();
            if (citationsToAttach && citationsToAttach.citations && citationsToAttach.citations.length > 0) {
                draftConfig.citations = citationsToAttach;
            }

            // Save to localStorage first so the draft persists (best-effort)
            const fid = currentUser?.firmId || coreState?.firmDetails?.id || '';
            if (fid) {
                const key = draftSessionKey({
                    matterId: undefined,
                    title: title,
                });
                try {
                    saveDraftSession(fid, key, {
                        title,
                        content: html,
                        draftPrompt: undefined,
                        matterId: undefined,
                        updatedAt: new Date().toISOString(),
                        savedAt: Date.now(),
                    });
                } catch (e) {
                    console.warn('[handleDraftInDraftPro] localStorage save failed:', e);
                }

                // On desktop, try to open in a new tab
                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                    try {
                        const url = `/editor?draftKey=${encodeURIComponent(key)}&title=${encodeURIComponent(title)}`;
                        const armed = navigateArmedDraftTab(url);
                        if (armed) {
                            openDraftInTab({ key, url, title });
                            addToast(`Opened "${title}" in DraftPro (new tab).`, { type: 'success' });
                            return;
                        }
                        const result = openDraftInTab({ key, url, title });
                        if (result !== 'in-place') {
                            addToast(`Opened "${title}" in DraftPro (new tab).`, { type: 'success' });
                            return;
                        }
                    } catch (e) {
                        console.warn('[handleDraftInDraftPro] new tab failed, falling back to in-place:', e);
                    }
                }
            }

            // Mobile or popup blocked — open in-place
            // This is the reliable path: just navigate to the editor with the content.
            // Save to module-level store FIRST so WordProcessor can read it even if
            // React Router's location.state doesn't persist (common in Capacitor).
            setPendingDraft(draftConfig);
            openEditorRef.current(null, draftConfig);
            addToast(`Opened "${title}" in DraftPro.`, { type: 'success' });
        } catch (e: any) {
            console.error('[handleDraftInDraftPro] Failed:', e);
            addToast(`Failed to open DraftPro: ${e?.message || 'Unknown error'}`, { type: 'error' });
        }
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
                firmId: currentUser?.firmId || coreState?.firmDetails?.id || '',
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

            // 3. Open the Research Studio in a NEW browser tab with the
            //    new notebook pre-selected. This preserves the ALOA chat
            //    session — the user can keep chatting while Research runs
            //    in the parallel tab. Falls back to in-place nav on mobile
            //    or when pop-ups are blocked.
            addToast(`Sent ${msg.attachments!.length} document(s) to Research Studio.`, { type: 'success' });
            const ctx = { selectedNotebookId: notebook.id };
            try {
                const { openInNewTab, buildRouteUrlWithHashContext } = await import('../../utils/tabNavigation');
                const url = buildRouteUrlWithHashContext('research', ctx);
                const opened = openInNewTab(url);
                if (!opened) {
                    // Fall back to in-app navigation
                    navigateTo('research', null, ctx);
                }
            } catch {
                navigateTo('research', null, ctx);
            }
        } catch (e: any) {
            console.error('[Send to Research] Failed:', e);
            addToast('Could not send to Research Studio: ' + (e.message || 'Unknown error'), { type: 'error' });
        }
    };

    // ─── Push Web Results to Research Studio ───────────────────────────
    // Takes the web fetch results (from URL extraction or parallel search)
    // and pushes them as sources into a NEW research notebook. Opens the
    // Research Studio in a new tab so the user can do deeper analysis.
    //
    // This is triggered from the "Push to Research" button on the web
    // results panel — a user gesture, so window.open works.
    const handlePushWebResultsToResearch = async () => {
        if (!webFetchResults || webFetchResults.length === 0) return;
        const successfulResults = webFetchResults.filter(r => r.success);
        if (successfulResults.length === 0) {
            addToast('No successful web results to push.', { type: 'info' });
            return;
        }

        try {
            const notebookName = `Web Research — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

            // 1. Create a new research notebook
            const notebook = handleAddResearchNotebook({
                name: notebookName,
                firmId: currentUser?.firmId || coreState?.firmDetails?.id || '',
                userId: currentUser?.id || '',
            });

            if (!notebook?.id) {
                addToast('Could not create research notebook.', { type: 'error' });
                return;
            }

            // 2. Add each web result as a source
            for (const r of successfulResults) {
                handleAddResearchSource(notebook.id, {
                    name: r.title || r.url,
                    type: 'text',
                    content: r.content || r.snippet || `Source: ${r.title}\nURL: ${r.url}`,
                });
            }

            // 3. Open Research in a new tab with the notebook pre-selected
            addToast(`Pushed ${successfulResults.length} web source${successfulResults.length > 1 ? 's' : ''} to Research Studio.`, { type: 'success' });
            const ctx = { selectedNotebookId: notebook.id };
            try {
                const { openInNewTab, buildRouteUrlWithHashContext } = await import('../../utils/tabNavigation');
                const url = buildRouteUrlWithHashContext('research', ctx);
                const opened = openInNewTab(url);
                if (!opened) {
                    navigateTo('research', null, ctx);
                }
            } catch {
                navigateTo('research', null, ctx);
            }
        } catch (e: any) {
            console.error('[Push Web Results to Research] failed:', e);
            addToast('Could not push to Research Studio: ' + (e.message || 'Unknown error'), { type: 'error' });
        }
    };

    const executeStoredAction = (action: any) => {
        if (action.type === 'modal') {
            onClose(); // Close ALOA panel first so the modal isn't blurred behind it
            openModalRef.current(action.modalType, null, action.context);
        } else if (action.type === 'navigate') {
            onClose(); // Close ALOA panel first so the target page is visible and not blurred
            navigateToRef.current(action.target, null, action.context);
        } else if (action.type === 'draft') {
            // ─── Open existing draft in a NEW TAB ────────────────────────
            //
            // KEY PRINCIPLES:
            // 1. "Open Item" ALWAYS opens in a NEW TAB on desktop
            // 2. If a draft already exists (stored in localStorage), open THAT —
            //    NEVER create a new draft
            // 3. If no draft exists, re-draft using the original prompt
            //
            // This is called from a button click — which IS a user gesture —
            // so window.open() should work. If the popup blocker catches it,
            // we tell the user to allow popups (we do NOT silently open in-place).
            //
            // PENDING-OPEN CASE: If the draft was created by `start_drafting`
            // but the popup was blocked at that time, the config has
            // `__pendingDraftOpen: true` and `__draftUrl` set. We use the
            // stored URL to open the tab directly — no need to rebuild it.
            const cfg = action.config || {};

            // ─── Pending-open shortcut ──────────────────────────────────
            // The draft session was already saved to localStorage by
            // start_drafting. We just need to open the tab with the
            // stored URL. This is a user gesture, so window.open works.
            if (cfg.__pendingDraftOpen && cfg.__draftUrl) {
                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                    let opened = false;
                    try {
                        const win = window.open(cfg.__draftUrl, '_blank');
                        if (win && !win.closed) {
                            win.focus();
                            opened = true;
                        }
                    } catch {
                        // window.open threw
                    }
                    if (opened) {
                        // Register in tab registry
                        try {
                            const draftKey = cfg.__draftKey;
                            if (draftKey) {
                                const tabName = `draftpro-${draftKey.replace(/[^a-z0-9]/gi, '-')}`;
                                const regKey = 'practicepro:draft-tabs:registry';
                                const raw = localStorage.getItem(regKey);
                                const reg = raw ? JSON.parse(raw) : {};
                                reg[draftKey] = {
                                    key: draftKey,
                                    tabName,
                                    url: cfg.__draftUrl,
                                    title: cfg.draftTitle,
                                    lastHeartbeat: Date.now(),
                                };
                                localStorage.setItem(regKey, JSON.stringify(reg));
                            }
                        } catch { /* ignore */ }
                        addToast(`Opened "${cfg.draftTitle}" in a new tab.`, { type: 'success' });
                        return;
                    }
                    // Popup still blocked even from a user gesture — tell user
                    addToast(`Pop-up blocked! Please allow pop-ups for this site. Click the pop-up icon in your address bar → Allow.`, { type: 'error' });
                    return;
                }
            }
            try {
                const fid = currentUser?.firmId || coreState?.firmDetails?.id || '';
                if (fid && cfg.draftTitle) {
                    const key = draftSessionKey({
                        matterId: cfg.matterId,
                        title: cfg.draftTitle,
                        documentId: cfg.documentId,
                    });
                    const editorUrl = `/editor?draftKey=${encodeURIComponent(key)}&title=${encodeURIComponent(cfg.draftTitle)}`;

                    // ─── Check if we have stored content ────────────────
                    const stored = loadDraftSession(fid, key);
                    const hasStoredContent = stored?.content && stored.content.trim().length > 0;

                    // ─── On desktop, ALWAYS open in a new tab ───────────
                    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                        // Save the draft content to localStorage FIRST so the
                        // new tab can load it. If we have stored content,
                        // make sure it's saved. If not, we'll re-draft.
                        if (!hasStoredContent) {
                            // No stored content — save the prompt so the new
                            // tab auto-drafts with the original prompt
                            import('../../utils/draftSession').then(({ saveDraftSession }) => {
                                saveDraftSession(fid, key, {
                                    title: cfg.draftTitle,
                                    content: '', // empty — will auto-draft
                                    draftPrompt: cfg.draftPrompt || cfg.draftTitle,
                                    matterId: cfg.matterId,
                                    updatedAt: new Date().toISOString(),
                                    savedAt: Date.now(),
                                });
                            });
                        }

                        // Try to open in a new tab.
                        // This is a user gesture (button click), so window.open
                        // should work. If it returns null, the popup was blocked.
                        let openedNewTab = false;

                        // Strategy 1: openDraftInTab (handles dedup + registry)
                        const result = openDraftInTab({
                            key,
                            url: editorUrl,
                            title: cfg.draftTitle,
                        });
                        if (result === 'new-tab' || result === 'existing-tab') {
                            openedNewTab = true;
                        }

                        // Strategy 2: Direct window.open (if Strategy 1 fell back to in-place)
                        if (!openedNewTab) {
                            try {
                                const win = window.open(editorUrl, '_blank');
                                if (win && !win.closed) {
                                    win.focus();
                                    openedNewTab = true;
                                }
                            } catch {
                                // continue to fallback
                            }
                        }

                        if (openedNewTab) {
                            // Success — draft opened in a new tab
                            if (hasStoredContent) {
                                addToast(`Opened "${cfg.draftTitle}" in a new tab.`, { type: 'success' });
                            } else {
                                addToast(`Drafting "${cfg.draftTitle}" in a new tab…`, { type: 'info' });
                            }
                            return;
                        }

                        // Popup was blocked — tell the user, do NOT silently open in-place
                        addToast(`Pop-up blocked! Please allow pop-ups for this site to open drafts in a new tab. (Click the pop-up icon in your address bar → Allow)`, { type: 'error' });
                        return;
                    }

                    // ─── Mobile: open in-place ──────────────────────────
                    if (hasStoredContent) {
                        // DRAFTPRO-NEW-TAB — mobile fallback (allowed)
                        openEditorRef.current(null, {
                            ...cfg,
                            draftContent: stored.content,
                            disableAutoDraft: true,
                            draftPrompt: undefined,
                        });
                    } else {
                        // No stored content → re-draft directly
                        addToast(`Re-opening "${cfg.draftTitle}" in DraftPro…`, { type: 'info' });
                        // DRAFTPRO-NEW-TAB — mobile fallback (allowed)
                        openEditorRef.current(null, {
                            ...cfg,
                            draftPrompt: cfg.draftPrompt || cfg.draftTitle,
                            disableAutoDraft: false,
                        });
                    }
                    return;
                }
            } catch (e) {
                console.warn('[executeStoredAction] draft lookup failed', e);
            }
            // DRAFTPRO-NEW-TAB — last-resort fallback (allowed)
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
                        {activeView === 'chat' && getAssistantFullName(isProperty) && (
                            <p className="text-2xs text-slate-400 dark:text-zinc-500 font-medium leading-none mt-0.5 truncate">
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
                     {/* History sidebar — kept MOUNTED (hidden via CSS) so the
                         reactive useQuery subscription in ConversationList
                         stays alive even when the sidebar is closed. This
                         ensures the conversation list is always up-to-date
                         when the user reopens the sidebar. Previously this
                         was conditionally rendered ({showHistory && ...}),
                         which unmounted ConversationList and lost the
                         subscription — causing the user to see a stale/empty
                         list and think their previous conversations were lost. */}
                     <aside className={`absolute inset-0 z-20 border-r border-slate-200 dark:border-zinc-800 flex-col bg-white dark:bg-zinc-900 animate-in slide-in-from-left duration-300 shadow-2xl ${showHistory ? 'flex' : 'hidden'}`}>
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
                                <h3 className="text-2xs font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Recent Searches</h3>
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
                                <h3 className="text-2xs font-black uppercase tracking-widest text-slate-400 mb-3 px-2">Archived Notes</h3>
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
                                                <div className="text-2xs text-slate-400 mt-0.5 line-clamp-1 opacity-60">{note.content}</div>
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
                                        <div className="text-2xs text-slate-400 italic px-2">No notes yet...</div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </aside>

                <main
                    ref={chatScrollRef as any}
                    onScroll={handleChatScroll}
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
                                // ─── Fix: Only open DraftPro for actual drafting tasks ──
                                // "Create a new task" should open the task modal, NOT DraftPro.
                                // Only "Draft" and "Prepare" are drafting actions.
                                // "Create" is too broad — it matches "Create a new task",
                                // "Create a contact", "Create a matter" etc.
                                const isDraftingAction = taskTitle.match(/^(Draft|Prepare)\b/i);
                                const isTaskCreation = taskTitle.match(/^Create.{0,5}(a )?(new )?task\b/i);
                                const isMatterCreation = taskTitle.match(/^Create.{0,5}(a )?(new )?matter\b/i);
                                const isContactCreation = taskTitle.match(/^Create.{0,5}(a )?(new )?contact\b/i);
                                const isEventCreation = taskTitle.match(/^Create.{0,5}(a )?(new )?(event|meeting|hearing)\b/i);

                                if (isDraftingAction) {
                                    // Draft/Prepare → open DraftPro
                                    // DRAFTPRO-NEW-TAB — mobile fallback (allowed)
                                    openEditorRef.current(null, {
                                        draftTitle: taskTitle,
                                        isCourtProcess: true,
                                        openedByAloa: true
                                    });
                                } else if (isTaskCreation) {
                                    // Create task → open task modal
                                    openModalRef.current('newTask', null, { openedByAloa: true });
                                } else if (isMatterCreation) {
                                    // Create matter → open matter modal
                                    openModalRef.current('newMatter', null, { openedByAloa: true });
                                } else if (isContactCreation) {
                                    // Create contact → open contact modal
                                    openModalRef.current('newContact', null, { openedByAloa: true });
                                } else if (isEventCreation) {
                                    // Create event → open event modal
                                    openModalRef.current('newEvent', null, { openedByAloa: true });
                                } else {
                                    // Everything else → ask ALOA
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
                            {getAssistantFullName(isProperty) && (
                                <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                                    {getAssistantFullName(isProperty)}
                                </p>
                            )}
                            <p className="text-sm text-slate-500 dark:text-zinc-500 max-w-[260px] leading-relaxed">
                                {isAtrium
                                    ? 'I can help manage your property portfolio, track revenue, handle tenant communications, and monitor defaulters.'
                                    : 'I can help draft legal documents, manage cases, research Nigerian law, and streamline your practice operations.'}
                            </p>

                            {/* ─── Proactive Insight Badges ──────────────────
                                These show system-generated alerts (deadline reminders,
                                anomaly detections, morning briefings).

                                When clicked, they open an INSIGHT DETAIL PANEL
                                (not just injecting text into the chat). The panel
                                shows each insight with:
                                - Title and description
                                - How many days stale/overdue (for matters/tasks)
                                - "Go to Matter" / "Go to Task" action button
                                - "Dismiss" button to clear the insight */}
                            {proactiveInsights && proactiveInsights.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-[300px]">
                                    {proactiveInsights.filter(i => i.severity === 'critical').length > 0 && (
                                        <button
                                            onClick={() => setShowInsightPanel('critical')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800/50 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            {proactiveInsights.filter(i => i.severity === 'critical').length} Urgent — View
                                        </button>
                                    )}
                                    {proactiveInsights.filter(i => i.severity === 'warning').length > 0 && (
                                        <button
                                            onClick={() => setShowInsightPanel('warning')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            {proactiveInsights.filter(i => i.severity === 'warning').length} Attention{proactiveInsights.filter(i => i.severity === 'warning').length !== 1 ? '' : ''} — View
                                        </button>
                                    )}
                                    {proactiveInsights.filter(i => i.category === 'briefing').length > 0 && (
                                        <button
                                            onClick={() => setTextInput("Show me today's morning briefing")}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/50 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                        >
                                            ☀️ Briefing Ready
                                        </button>
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
                                        className="px-3 py-1.5 text-2xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors border border-slate-200 dark:border-zinc-700"
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
                                        <div
                                            className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mb-2"
                                            dangerouslySetInnerHTML={{ __html: parseAloaMarkdown(formatNairaInText(msg.content)) }}
                                            onCopy={handleCleanCopy}
                                        />
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

                                    {/* ─── Jurisdictional Analysis (for draft actions) ───
                                        Now uses the concise JurisdictionCard with 3-pillar layout:
                                        Applicable Law, Competent Forum, Filing/Practice Key.
                                        Replaces the old verbose JurisdictionReasoning component. */}
                                    {msg.toolAction?.jurisdictionAnalysis && (
                                        <JurisdictionCard
                                            governingLaw={msg.toolAction.jurisdictionAnalysis.governingLaw || 'Verify applicable statutes with counsel.'}
                                            forum={msg.toolAction.jurisdictionAnalysis.forum || msg.toolAction.jurisdictionAnalysis.court}
                                            filingKey={msg.toolAction.jurisdictionAnalysis.filingKey || 'Consult procedural rules for filing requirements.'}
                                            court={msg.toolAction.jurisdictionAnalysis.court}
                                            jurisdiction={msg.toolAction.jurisdictionAnalysis.jurisdiction}
                                            reasoning={msg.toolAction.jurisdictionAnalysis.reasoning}
                                            warning={msg.toolAction.jurisdictionAnalysis.warning}
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
                                                customLabel={msg.toolAction.label}
                                            />
                                        </div>
                                    )}

                                    {/* Action buttons row — hover-only on desktop, tap-to-reveal on touch.
                                        Copy AND Save are hidden for messages that have a toolAction
                                        (the output is a structured document opened in DraftPro or a
                                        modal — not copyable/saveable text). Edit remains for user messages.
                                        "Draft in DraftPro" appears when the AI's response contains a
                                        formal document/letter — letting the user send it to DraftPro
                                        for proper editing with formatting preserved. */}
                                    <div className={`flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {!msg.toolAction && (
                                            <button
                                                onClick={() => handleCopyMessage(msg.id, msg.content || '')}
                                                className={`${copiedMessageId === msg.id ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-primary-600'} rounded-md px-1.5 py-0.5 text-3xs font-bold transition-all flex items-center gap-0.5`}
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

                                        {/* ─── Draft in DraftPro ──────────────────────────
                                            Shows when:
                                            1. The message is from the AI (role === 'model')
                                            2. The message has NO toolAction (not already a draft)
                                            3. The message is NOT an error
                                            4. The message has content (any non-empty content)

                                            Previously this was gated by isFormalDocument() which
                                            hid the button for most responses. Now it shows for
                                            ALL AI responses so the user can always send content
                                            to DraftPro for editing. */}
                                        {msg.role === 'model' && !msg.isError && !msg.toolAction && msg.content && msg.content.trim().length > 20 && (
                                            <button
                                                onClick={() => handleDraftInDraftPro(msg.content || '', (msg as any).citations)}
                                                className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/60 rounded-md px-2 py-0.5 text-3xs font-bold transition-all flex items-center gap-0.5 border border-primary-300 dark:border-primary-700"
                                                title="Send this document to DraftPro for proper editing"
                                            >
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Draft in DraftPro
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
                                                className="bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-md px-1.5 py-0.5 text-3xs font-bold transition-all flex items-center gap-0.5"
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
                                                className="bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md px-1.5 py-0.5 text-3xs font-bold transition-all flex items-center gap-0.5"
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
                                                className="bg-slate-100 dark:bg-zinc-700 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md px-1.5 py-0.5 text-3xs font-bold transition-all flex items-center gap-0.5"
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

                    {/* ─── Web Fetch Results Panel (like Claude's search panels) ──
                        Shows the URLs ALOA has fetched and read, with titles
                        and snippets. Collapsible via the chevron toggle —
                        NOT dismissable (results persist so the user can
                        still "Push to Research" after the response completes). */}
                    {webFetchResults && webFetchResults.length > 0 && (
                        <div className="mx-auto max-w-md mb-4">
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                                    <button
                                        onClick={() => setWebResultsCollapsed(!webResultsCollapsed)}
                                        className="flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors"
                                        title={webResultsCollapsed ? 'Expand web results' : 'Collapse web results'}
                                    >
                                        {/* Chevron icon — rotates up/down */}
                                        <svg className={`w-3 h-3 text-slate-500 transition-transform ${webResultsCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                        </svg>
                                        <span className="text-2xs font-bold text-slate-700 dark:text-zinc-200">
                                            {webFetchResults.length} web result{webFetchResults.length > 1 ? 's' : ''} {isLoading && '· reading…'}
                                        </span>
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        {/* ─── Push to Research button ──────────────────
                                            Always available (even when collapsed) so the
                                            user can push sources without expanding. */}
                                        {!isLoading && webFetchResults.some(r => r.success) && (
                                            <button
                                                onClick={handlePushWebResultsToResearch}
                                                className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-md text-3xs font-bold transition-colors border border-indigo-200 dark:border-indigo-800/50"
                                                title="Push these web sources to a new Research notebook"
                                            >
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                                </svg>
                                                Push to Research
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* Results list — hidden when collapsed */}
                                {!webResultsCollapsed && (
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    {webFetchResults.map((r, i) => (
                                        <a
                                            key={i}
                                            href={r.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-700/50 last:border-0"
                                        >
                                            <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center mt-0.5 ${r.success ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                                                {r.success ? (
                                                    <svg className="w-2.5 h-2.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-2.5 h-2.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-2xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{r.title}</p>
                                                <p className="text-3xs text-slate-500 dark:text-zinc-500 truncate">{r.url}</p>
                                                {r.snippet && (
                                                    <p className="text-2xs text-slate-500 dark:text-zinc-400 line-clamp-2 mt-0.5">{r.snippet}</p>
                                                )}
                                            </div>
                                        </a>
                                    ))}
                                </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isLoading && aloaStatus && (
                        <div className="flex items-center gap-2.5 px-3 py-2 mx-2 rounded-xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/20">
                            <div className="flex gap-1 flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <p className="text-2xs font-medium text-primary-700 dark:text-primary-300 flex-1">{aloaStatus}</p>
                            {reasoningTime > 0 && (
                                <span className="text-2xs font-mono text-primary-500 dark:text-primary-400 tabular-nums flex-shrink-0">
                                    {reasoningTime < 60 ? `${reasoningTime}s` : `${Math.floor(reasoningTime / 60)}m ${reasoningTime % 60}s`}
                                </span>
                            )}
                            {/* ─── Stop Request (Kill Switch) ───────────────
                                Visible whenever ALOA is loading. Clicking
                                aborts the current request instantly. */}
                            <button
                                onClick={handleStopRequest}
                                className="flex items-center gap-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-2xs font-bold transition-colors flex-shrink-0"
                                title="Cancel request"
                            >
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                                Stop
                            </button>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>

                {/* ─── Insight Detail Panel ────────────────────────────────
                    When the user clicks a proactive insight badge, this panel
                    slides in from the right showing each insight with:
                    - Title and body description
                    - Entity type (Matter, Task, Event)
                    - "Go to Matter/Task" action button that navigates directly
                    - "Dismiss" button to clear the insight
                    - "Ask ALOA" button to get AI help with the insight */}
                {showInsightPanel && proactiveInsights && (
                    <div className="absolute inset-0 z-[60] bg-black/20" onClick={() => setShowInsightPanel(null)}>
                        <div
                            className="absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {showInsightPanel === 'critical' ? (
                                        <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Urgent Alerts</>
                                    ) : (
                                        <><span className="w-2 h-2 rounded-full bg-amber-500" /> ALOA's Attention</>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowInsightPanel(null)}
                                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Insight cards */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {proactiveInsights
                                    .filter(i => i.severity === showInsightPanel)
                                    .map((insight: any) => {
                                        // Extract days from the body text (e.g., "14 days" or "3 hour(s)")
                                        const daysMatch = insight.body?.match(/(\d+)\s+day/);
                                        const hoursMatch = insight.body?.match(/(\d+)\s+hour/);
                                        const timeText = daysMatch ? `${daysMatch[1]} days stale` : hoursMatch ? `${hoursMatch[1]} hours left` : '';

                                        // Determine the navigation target
                                        const navTarget = insight.entityType === 'matter' ? 'matterDetail'
                                            : insight.entityType === 'task' ? 'tasks'
                                            : insight.entityType === 'event' ? 'calendar'
                                            : insight.entityType === 'service_charge' ? 'atriumEngine'
                                            : insight.entityType === 'firm' ? 'dashboard'
                                            : null;

                                        return (
                                            <div key={insight._id || insight.id} className={`p-3 rounded-xl border ${showInsightPanel === 'critical' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'}`}>
                                                <div className="flex items-start gap-2">
                                                    <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${showInsightPanel === 'critical' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                                                        <svg className={`w-4 h-4 ${showInsightPanel === 'critical' ? 'text-red-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d={insight.entityType === 'matter' ? "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" : insight.entityType === 'task' ? "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"} />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-slate-900 dark:text-white">{insight.title}</p>
                                                        <p className="text-2xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{insight.body}</p>
                                                        {timeText && (
                                                            <span className={`inline-block mt-1.5 text-3xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${showInsightPanel === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                                                                {timeText}
                                                            </span>
                                                        )}
                                                        {/* Action buttons */}
                                                        <div className="flex gap-1.5 mt-2.5 flex-wrap">
                                                            {navTarget && insight.entityId && (
                                                                <button
                                                                    onClick={() => {
                                                                        navigateTo(navTarget, insight.entityId);
                                                                        setShowInsightPanel(null);
                                                                    }}
                                                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-900 dark:bg-zinc-700 text-white rounded-md text-2xs font-bold hover:bg-slate-800 dark:hover:bg-zinc-600 transition-colors"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                                                    </svg>
                                                                    Go to {insight.entityType}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setTextInput(`Help me with this: ${insight.title} — ${insight.body}`);
                                                                    setShowInsightPanel(null);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-primary-600 text-white rounded-md text-2xs font-bold hover:bg-primary-700 transition-colors"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                                                </svg>
                                                                Ask ALOA
                                                            </button>
                                                            {/* Dismiss button — clears this insight permanently */}
                                                            <button
                                                                onClick={() => {
                                                                    handleDismissInsight(insight._id || insight.id);
                                                                }}
                                                                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-md text-2xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                                                title="Dismiss this insight"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                                Dismiss
                                                            </button>
                                                            {/* Remind me later — snoozes by dismissing + toast */}
                                                            <button
                                                                onClick={() => {
                                                                    handleDismissInsight(insight._id || insight.id);
                                                                    addToast('Got it — I\'ll remind you about this later.', { type: 'info' });
                                                                }}
                                                                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-md text-2xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors border border-amber-200 dark:border-amber-800/50"
                                                                title="Snooze this insight"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Remind me later
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Footer */}
                            <div className="p-3 border-t border-slate-200 dark:border-zinc-800 flex gap-2">
                                <button
                                    onClick={() => {
                                        setTextInput(`Show me all ${showInsightPanel === 'critical' ? 'urgent alerts' : 'items needing attention'} and help me prioritize what to do first`);
                                        setShowInsightPanel(null);
                                    }}
                                    className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors"
                                >
                                    Ask ALOA to prioritize
                                </button>
                                <button
                                    onClick={() => setShowInsightPanel(null)}
                                    className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Floating Scroll Buttons ───────────────────────────
                    Like Z.ai — a "scroll to top" button when the user has
                    scrolled down, and a "scroll to bottom" button when
                    they've scrolled up. Both show when in the middle. */}
                {showScrollButtons && (
                    <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-30">
                        {/* Scroll to top */}
                        <button
                            onClick={scrollToTop}
                            className="w-9 h-9 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-full shadow-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center group"
                            title="Scroll to top"
                            aria-label="Scroll to top"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                            </svg>
                        </button>
                        {/* Scroll to bottom — only show when not at bottom */}
                        {!isAtBottom && (
                            <button
                                onClick={scrollToBottom}
                                className="w-9 h-9 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all flex items-center justify-center"
                                title="Scroll to bottom"
                                aria-label="Scroll to bottom"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <footer className="flex-shrink-0 p-4 sm:p-6 chat-input-dock bg-white dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-900">
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
                        <AutoExpandingChatInput
                            value={textInput}
                            onChange={setTextInput}
                            onSend={handleSend}
                            placeholder={isAtrium ? `Ask ${getAssistantName(isProperty)} about your properties…` : `Ask ${getAssistantName(isProperty)} about your practice…`}
                            sendDisabled={!textInput.trim() && pendingAttachments.length === 0}
                            sendIcon={<SendIcon />}
                            sendAriaLabel="Send to ALOA"
                            containerClassName="flex-1"
                            textareaClassName="bg-transparent border-none text-base p-3 focus:ring-0"
                        />
                    </div>
                </form>
            </footer>
                </>
            )}
            {ConfirmDialog}
        </div>
    );
};
