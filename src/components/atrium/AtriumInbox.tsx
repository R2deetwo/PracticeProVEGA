import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { AtriumInboundMessage, AutomationChannel } from '../../types';
import { ComposeModal, ComposeModalPrefill } from './ComposeModal';
import { 
    Mail as EnvelopeIcon, 
    MessageSquare as ChatBubbleLeftRightIcon, 
    Send as PaperAirplaneIcon,
    Sparkles as SparklesIcon,
    Trash2 as TrashIcon,
    ChevronLeft as ChevronLeftIcon,
    Plus as PlusIcon
} from 'lucide-react';

const CHANNEL_COLORS: Record<AutomationChannel, string> = {
  whatsapp: 'text-green-400 bg-green-900/30', 
  email: 'text-blue-400 bg-blue-900/30', 
  sms: 'text-purple-400 bg-purple-900/30',
};

export const AtriumInbox: React.FC = () => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const { addToast } = useUI();
    const firmId = coreState.firmDetails?.id || currentUser?.firmId;

    // Use query for inbound messages
    const messages = useQuery(api.sentry.getInboundMessages, firmId ? { firmId } : 'skip') || [];
    const deleteMessage = useMutation(api.sentry.deleteInboundMessage);
    const markAsRead = useMutation(api.sentry.markMessageAsRead);

    
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [composePrefill, setComposePrefill] = useState<ComposeModalPrefill | undefined>(undefined);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('atrium_compose_prefill');
            if (raw) {
                const prefill: ComposeModalPrefill = JSON.parse(raw);
                sessionStorage.removeItem('atrium_compose_prefill');
                setComposePrefill(prefill);
                setShowCompose(true);
            }
        } catch (e) {}
    }, []);

    const selectedMessage = useMemo(() => 
        messages.find(m => m._id === selectedThreadId), 
    [messages, selectedThreadId]);

    const handleSelectThread = (id: string) => {
        setSelectedThreadId(id);
        markAsRead({ messageId: id as any });
    };

    const handleUseReply = (suggested: string) => {
        setReplyText(suggested);
        // Scroll to input would be nice but not strictly required
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Delete this message?")) {
            await deleteMessage({ messageId: id as any });
            if (selectedThreadId === id) setSelectedThreadId(null);
            addToast("Message deleted", { type: "info" });
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedMessage) return;
        setIsSending(true);
        try {
            // Simulated send for now
            setTimeout(() => {
                addToast("Reply sent successfully", { type: "success" });
                setReplyText("");
                setIsSending(false);
            }, 1000);
        } catch (e: any) {
            addToast(`Error: ${e.message}`, { type: "error" });
            setIsSending(false);
        }
    };

    const integrationStatus = coreState.firmDetails?.automationSettings?.chakra?.isActive ? 'connected' : 'simulated';

    return (
        <div className="min-h-full flex flex-col bg-slate-950 text-white sm:overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-900/40 text-emerald-400 rounded-xl">
                        <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight">Unified Inbox</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Tenant Communication Hub</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowCompose(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" /> Compose
                    </button>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full text-xs font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {messages.filter(m => !m.isRead).length} Unread
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 sm:overflow-hidden">
                {/* Threads List - Hidden on mobile if thread selected */}
                <div className={`${selectedThreadId ? 'hidden md:block' : 'block'} w-full md:w-1/3 border-r border-slate-800 bg-slate-900/20 sm:overflow-y-auto custom-scrollbar pb-24 md:pb-0`}>
                    {messages.length === 0 ? (
                        <div className="p-12 text-center text-slate-600 flex flex-col items-center justify-center h-64">
                            <EnvelopeIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-medium">No messages found</p>
                            <p className="text-xs opacity-50 mt-1">Tenant replies will appear here</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div 
                                key={msg._id}
                                onClick={() => handleSelectThread(msg._id)}
                                className={`group p-4 border-b border-slate-800/50 cursor-pointer transition-all relative ${selectedThreadId === msg._id ? 'bg-emerald-950/30 border-r-2 border-r-emerald-500' : 'hover:bg-slate-900/50'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        {!msg.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>}
                                        <h4 className={`text-sm truncate max-w-[140px] ${!msg.isRead ? 'font-black text-white' : 'font-semibold text-slate-400'}`}>
                                            {msg.senderName || msg.senderContact}
                                        </h4>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        {msg.receivedAt ? new Date(msg.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] mb-2 font-bold tracking-tight">
                                    <span className={`px-1.5 py-0.5 rounded uppercase ${CHANNEL_COLORS[msg.channel as AutomationChannel]}`}>
                                        {msg.channel}
                                    </span>
                                    <span className="text-slate-600 truncate">{msg.senderContact}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                    {msg.content}
                                </p>
                                
                                <button 
                                    onClick={(e) => handleDelete(e, msg._id)}
                                    className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-rose-500 transition-all hover:bg-rose-500/10 rounded-lg"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>

                                {msg.aiAnalysis && (
                                    <div className="mt-2 flex items-center gap-1">
                                        <SparklesIcon className="w-3 h-3 text-emerald-400" />
                                        <span className="text-[9px] font-black tracking-widest uppercase text-emerald-400/80">
                                            {msg.aiAnalysis?.intent?.replace(/_/g, ' ') || 'ANALYZED'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Thread Detail */}
                <div className={`${selectedThreadId ? 'flex' : 'hidden md:flex'} flex-1 bg-slate-950 flex flex-col relative`}>
                    {selectedMessage ? (
                        <>
                            {/* Thread Header - Mobile only */}
                            <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                                <button onClick={() => setSelectedThreadId(null)} className="p-1 text-slate-400">
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <div>
                                    <h3 className="text-sm font-bold text-white">{selectedMessage.senderName || selectedMessage.senderContact}</h3>
                                    <p className="text-[10px] text-slate-500">{selectedMessage.senderContact}</p>
                                </div>
                            </div>

                            <div className="flex-1 sm:overflow-y-auto p-6 pb-44 md:pb-6 space-y-8 custom-scrollbar">
                                <div className="flex flex-col">
                                    <div className="flex justify-start mb-6">
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-xl max-w-[85%] relative group">
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/50">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    {selectedMessage.senderName || 'Tenant'}
                                                </span>
                                                <span className="text-[10px] text-slate-600">
                                                    {selectedMessage.receivedAt ? new Date(selectedMessage.receivedAt).toLocaleString() : ''}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                {selectedMessage.content}
                                            </p>
                                            <button 
                                                onClick={(e) => handleDelete(e, selectedMessage._id)}
                                                className="absolute -right-10 top-0 opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-rose-500 transition-all"
                                                title="Delete message"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                            {selectedMessage.mediaUrl && (
                                                <div className="mt-4 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                                                    <img 
                                                        src={selectedMessage.mediaUrl} 
                                                        alt="Tenant Attachment" 
                                                        className="w-full h-auto max-h-64 object-cover cursor-zoom-in hover:scale-[1.02] transition-transform duration-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* AI Suggested Reply - Refined Design */}
                                    {selectedMessage.aiAnalysis?.suggestedReply && (
                                        <div className="mx-4 md:mx-12 mb-8 bg-emerald-950/20 rounded-2xl border border-emerald-500/20 p-5 shadow-lg shadow-emerald-950/20 animate-fade-in">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                                                    <SparklesIcon className="w-3.5 h-3.5" />
                                                </div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">ARIA Suggested Reply</h4>
                                            </div>
                                            <p className="text-sm text-slate-300 mb-4 italic leading-relaxed">
                                                "{selectedMessage.aiAnalysis.suggestedReply}"
                                            </p>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleUseReply(selectedMessage.aiAnalysis!.suggestedReply!)}
                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-2"
                                                >
                                                    <PaperAirplaneIcon className="w-3.5 h-3.5" /> Use Reply
                                                </button>
                                                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold rounded-xl transition-colors">
                                                    Ignore
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reply Input Area */}
                            <div className="p-5 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 shadow-2xl">
                                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                    <div className="flex-1 relative">
                                        <textarea 
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Type a manual reply..." 
                                            rows={Math.min(5, replyText.split('\n').length || 1)}
                                            className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-all placeholder:text-slate-700"
                                        />
                                        {replyText && (
                                            <button 
                                                onClick={() => setReplyText("")}
                                                className="absolute right-4 top-4 text-slate-600 hover:text-white"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                    <button 
                                        onClick={handleSendReply}
                                        disabled={!replyText.trim() || isSending}
                                        className="p-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl shadow-xl transition-all flex-shrink-0 hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        <PaperAirplaneIcon className={`w-5 h-5 ${isSending ? 'animate-pulse' : ''}`} />
                                    </button>
                                </div>
                                <p className="text-[9px] text-center text-slate-600 mt-3 uppercase tracking-widest font-black">
                                    Sending via {selectedMessage.channel} · {selectedMessage.senderContact}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 p-8 text-center">
                            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800">
                                <ChatBubbleLeftRightIcon className="w-10 h-10 opacity-20" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-400 mb-2">No Thread Selected</h3>
                            <p className="text-sm max-w-xs text-slate-600 leading-relaxed">
                                Select a conversation from the sidebar to view messages and respond to tenants.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {showCompose && firmId && <ComposeModal firmId={firmId} prefill={composePrefill} onClose={() => { setShowCompose(false); setComposePrefill(undefined); }} onToast={(msg) => addToast(msg, { type: msg.includes('Error') || msg.includes('Failed') ? 'error' : 'success' })} />}
        </div>
    );
};

