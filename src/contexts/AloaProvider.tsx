
import * as React from 'react';
import { AloaMessage, AriaChatContext } from '../types';
import { useLocalFileSystem, LocalFile } from '../hooks/useLocalFileSystem';
import { useDataState } from './DataContext';
import { FileText, Building2 } from 'lucide-react';

export type UrgencyStatus = 'none' | 'important' | 'urgent';
export type AloaState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';
export type AloaModel = 'auto' | 'flash' | 'pro';
export type AloaView = 'chat' | 'quickNote' | 'details' | 'form';

interface AloaContextType {
    // Standardized naming for visibility
    isPanelOpen: boolean;
    togglePanel: () => void;
    closePanel: () => void;
    openPanel: () => void;

    messages: AloaMessage[];
    setMessages: React.Dispatch<React.SetStateAction<AloaMessage[]>>;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    resetChat: () => void;

    urgencyStatus: UrgencyStatus;
    setUrgencyStatus: React.Dispatch<React.SetStateAction<UrgencyStatus>>;
    isUrgencyAcknowledged: boolean;
    acknowledgeUrgency: () => void;

    hasBeenBriefedToday: boolean;
    markAsBriefedToday: () => void;

    aloaState: AloaState;
    setAloaState: React.Dispatch<React.SetStateAction<AloaState>>;
    isMuted: boolean;
    toggleIsMuted: () => void;

    preferredModel: AloaModel;
    setPreferredModel: React.Dispatch<React.SetStateAction<AloaModel>>;

    localFiles: LocalFile[];
    setLocalFiles: React.Dispatch<React.SetStateAction<LocalFile[]>>;

    isFirmSearchEnabled: boolean;
    setIsFirmSearchEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    activeConversationId: string | null;
    setActiveConversationId: (id: string | null) => void;
    deleteConversation: (id: string) => Promise<void>;

    wordProcessorState: any;
    setWordProcessorState: any;
    closeWordProcessor: () => void;

    activeView: AloaView;
    setActiveView: (view: AloaView) => void;
    activeNoteId: string | null;
    setActiveNoteId: (id: string | null) => void;
    quickNoteContent: string;
    setQuickNoteContent: (content: string) => void;

    liveInsights: any[];
    setLiveInsights: React.Dispatch<React.SetStateAction<any[]>>;
    setActionResult: (result: { id: string; title: string; type: string }) => void;

    /** The active deep-context entity injected when opening chat from a resource screen. */
    injectedContext: AriaChatContext | null;
    setInjectedContext: (ctx: AriaChatContext | null) => void;
    /** Opens the chat panel and pre-loads context from a specific entity (property, matter, etc.) */
    openWithContext: (ctx: AriaChatContext) => void;
}

export const AloaContext = React.createContext<AloaContextType | undefined>(undefined);

export const AloaProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState } = useDataState();
    // Renamed from isAloaVisible to isPanelOpen to match component expectations
    const [isPanelOpen, setIsPanelOpen] = React.useState(false);
    const [messages, setMessages] = React.useState<AloaMessage[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [urgencyStatus, setUrgencyStatus] = React.useState<UrgencyStatus>('none');
    const [isUrgencyAcknowledged, setIsUrgencyAcknowledged] = React.useState(false);
    const [hasBeenBriefedToday, setHasBeenBriefedToday] = React.useState(false);

    const [aloaState, setAloaState] = React.useState<AloaState>('idle');
    const [isMuted, setIsMuted] = React.useState(false);
    const [preferredModel, setPreferredModel] = React.useState<AloaModel>('auto');
    const [localFiles, setLocalFiles] = React.useState<LocalFile[]>([]);
    const [isFirmSearchEnabled, setIsFirmSearchEnabled] = React.useState(false);
    const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
    const [activeView, setActiveView] = React.useState<AloaView>('chat');
    const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null);
    const [quickNoteContent, setQuickNoteContent] = React.useState('');
    const [liveInsights, setLiveInsights] = React.useState<any[]>([]);
    const [injectedContext, setInjectedContext] = React.useState<AriaChatContext | null>(null);

    const [wordProcessorState, setWordProcessorState] = React.useState({
        isOpen: false, title: '', content: '', disclaimer: '', status: 'thinking'
    });

    React.useEffect(() => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const lastBriefingDate = localStorage.getItem('practicepro_last_briefing_date');
            if (lastBriefingDate === todayStr) {
                setHasBeenBriefedToday(true);
            }
        } catch (error) {
            console.error("Could not access localStorage for briefing status:", error);
        }
    }, []);

    const markAsBriefedToday = React.useCallback(() => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            localStorage.setItem('practicepro_last_briefing_date', todayStr);
            setHasBeenBriefedToday(true);
        } catch (error) {
            console.error("Could not save briefing status to localStorage:", error);
        }
    }, []);

    const togglePanel = () => {
        setIsPanelOpen(prev => {
            if (prev) {
                window.speechSynthesis.cancel();
                setAloaState('idle');
            }
            return !prev;
        });
    };

    const closePanel = React.useCallback(() => {
        // Wrap speechSynthesis in try-catch — some Android WebViews throw
        // if speechSynthesis is unavailable, which would silently prevent
        // setIsPanelOpen(false) from executing. This was a hidden cause of
        // the "close button doesn't work" bug.
        try { window.speechSynthesis?.cancel?.(); } catch {}
        setAloaState('idle');
        setIsPanelOpen(false);
    }, []);

    const openPanel = React.useCallback(() => {
        setIsPanelOpen(true);
    }, []);

    const toggleIsMuted = () => {
        setIsMuted(prev => {
            if (!prev === true) {
                window.speechSynthesis.cancel();
                setAloaState('idle');
            }
            return !prev;
        });
    };

    const acknowledgeUrgency = React.useCallback(() => {
        setIsUrgencyAcknowledged(true);
    }, []);

    const resetChat = React.useCallback(() => {
        setMessages([]);
        setActiveConversationId(null);
        setUrgencyStatus('none');
        setIsUrgencyAcknowledged(false);
        setInjectedContext(null);
    }, []);

    const closeWordProcessor = React.useCallback(() => {
        setWordProcessorState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const setActionResult = React.useCallback((result: { id: string; title: string; type: string }) => {
        setMessages(prev => {
            const lastWithTool = [...prev].reverse().find(m => m.toolAction);
            let updated = prev;
            if (lastWithTool) {
                updated = prev.map(m => m.id === lastWithTool.id ? { ...m, completedResult: result } : m);
            }
            
            // AUTO-FOLLOW UP FOR MATTERS
            if (result.type === 'matter') {
                const firmProduct = appState?.firmDetails?.product;
                const isPropertyFirm = firmProduct === 'property' || firmProduct === 'atrium';

                const followUp: AloaMessage = {
                    id: Math.random().toString(36).substr(2, 9),
                    role: 'model',
                    content: isPropertyFirm
                        ? `Success! **${result.title}** has been initialized in your workspace. <br/><br/> Shall we begin drafting the **tenancy agreement** or any other required property documents?`
                        : `Success! **${result.title}** has been initialized in your workspace. <br/><br/> Shall we begin drafting the **originating process** (Writ of Summons) or any other required documents?`,
                    toolAction: {
                        type: 'drafting',
                        modalType: 'newDraft',
                        context: { 
                            matterId: result.id, 
                            title: result.title,
                            suggestedDocs: isPropertyFirm
                                ? ['Tenancy Agreement', 'Notice to Quit', 'Service Charge Notice']
                                : ['Writ of Summons', 'Statement of Claim', 'List of Witnesses']
                        },
                        insights: isPropertyFirm
                            ? [{ id: 'h1', icon: <Building2 className="w-4 h-4" />, text: 'Ensure all tenancy agreements comply with the relevant State Tenancy Law and the Land Use Act.', type: 'info' }]
                            : [{ id: 'h1', icon: <FileText className="w-4 h-4" />, text: 'Originating process must be filed within 7 days of suit initialization as per Lagos High Court rules.', type: 'info' }]
                    }
                };
                return [...updated, followUp];
            }
            return updated;
        });
        // Clear live insights on success
        setLiveInsights([]);
    }, [appState]);

    const deleteConversation = React.useCallback(async (id: string) => {
        // This will be handled by the component using the mutation
        if (activeConversationId === id) {
            setActiveConversationId(null);
            setMessages([]);
        }
    }, [activeConversationId]);

    /** Opens the chat panel and eagerly hydrates context from a specific entity. */
    const openWithContext = React.useCallback((ctx: AriaChatContext) => {
        setInjectedContext(ctx);
        setIsPanelOpen(true);
        setMessages([]);               // Fresh conversation for this entity
        setActiveConversationId(null);
    }, []);

    const value = {
        isPanelOpen,
        togglePanel,
        closePanel,
        openPanel,
        messages,
        setMessages,
        isLoading,
        setIsLoading,
        resetChat,
        urgencyStatus,
        setUrgencyStatus,
        isUrgencyAcknowledged,
        acknowledgeUrgency,
        hasBeenBriefedToday,
        markAsBriefedToday,
        aloaState,
        setAloaState,
        isMuted,
        toggleIsMuted,
        preferredModel,
        setPreferredModel,
        localFiles,
        setLocalFiles,
        isFirmSearchEnabled,
        setIsFirmSearchEnabled,
        activeConversationId,
        setActiveConversationId,
        deleteConversation,
        wordProcessorState,
        setWordProcessorState,
        closeWordProcessor,
        activeView,
        setActiveView,
        activeNoteId,
        setActiveNoteId,
        quickNoteContent,
        setQuickNoteContent,
        liveInsights,
        setLiveInsights,
        setActionResult,
        injectedContext,
        setInjectedContext,
        openWithContext
    };

    return (
        <AloaContext.Provider value={value}>
            {children}
        </AloaContext.Provider>
    );
};

export const useAloa = () => {
    const context = React.useContext(AloaContext);
    if (!context) {
        throw new Error('useAloa must be used within an AloaProvider');
    }
    return context;
};
