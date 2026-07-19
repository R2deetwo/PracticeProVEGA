import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { AtriumInboundMessage, AutomationChannel, AuditTrailEntry } from '../../types';
import { ComposeModal, ComposeModalPrefill } from './ComposeModal';
import { CommunicationPrintView } from './CommunicationPrintView';
import { 
    Mail as EnvelopeIcon, 
    MessageSquare as ChatBubbleLeftRightIcon, 
    Send as PaperAirplaneIcon,
    Sparkles as SparklesIcon,
    Trash2 as TrashIcon,
    ChevronLeft as ChevronLeftIcon,
    Plus as PlusIcon,
    Printer as PrinterIcon,
    Clock as ClockIcon,
    Filter as FilterIcon,
    ArrowUpRight as ArrowUpRightIcon,
    ArrowDownLeft as ArrowDownLeftIcon,
    ChevronDown as ChevronDownIcon,
    FileText as FileTextIcon,
} from 'lucide-react';
import { useConfirm } from '../ui/ConfirmDialog';
import { translateError } from '../../utils/errorTranslator';

const CHANNEL_COLORS: Record<AutomationChannel, string> = {
  whatsapp: 'text-green-400 bg-green-900/30', 
  email: 'text-blue-400 bg-blue-900/30', 
  portal: 'text-emerald-400 bg-emerald-900/30',
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  portal: 'Portal',
};

const MSG_TYPE_LABELS: Record<string, string> = {
  custom: 'Custom',
  rent_reminder: 'Rent Reminder',
  late_notice: 'Late Notice',
  payment_receipt: 'Payment Receipt',
  service_charge_alert: 'Service Charge',
  access_restriction: 'Access Restriction',
  penalty_notice: 'Penalty Notice',
  lease_renewal: 'Lease Renewal',
  welcome_note: 'Welcome Note',
  promotion: 'Promotion',
  vendor_update: 'Vendor Update',
  general_announcement: 'Announcement',
  maintenance_update: 'Maintenance',
};

type InboxTab = 'inbox' | 'audit';

export const AtriumInbox: React.FC = () => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const { addToast } = useUI();
    const { confirm, ConfirmDialog } = useConfirm();
    const firmId = coreState.firmDetails?.id || currentUser?.firmId;

    // Use query for inbound messages
    const messages = useQuery(api.sentry.getInboundMessages, firmId ? { firmId } : 'skip') || [];
    const deleteMessage = useMutation(api.sentry.deleteInboundMessage);
    const markAsRead = useMutation(api.sentry.markMessageAsRead);
    const logAutomation = useMutation(api.sentry.logAutomation);

    // Audit trail state
    const [activeTab, setActiveTab] = useState<InboxTab>('inbox');
    const [auditFilters, setAuditFilters] = useState({
        channel: '' as string,
        messageType: '' as string,
        startDate: '' as string,
        endDate: '' as string,
    });
    const [showFilters, setShowFilters] = useState(false);
    const [showPrintView, setShowPrintView] = useState(false);
    const [printTenant, setPrintTenant] = useState<{ unitId?: string; tenantContact?: string; tenantName?: string; unitLabel?: string }>({});

    // Audit trail query with filters
    const auditQueryArgs = useMemo(() => {
        if (!firmId) return 'skip';
        const args: any = { firmId };
        if (auditFilters.channel) args.channel = auditFilters.channel;
        if (auditFilters.messageType) args.messageType = auditFilters.messageType;
        if (auditFilters.startDate) args.startDate = new Date(auditFilters.startDate).getTime();
        if (auditFilters.endDate) args.endDate = new Date(auditFilters.endDate + 'T23:59:59').getTime();
        return args;
    }, [firmId, auditFilters]);

    const auditTrail = useQuery(api.sentry.getAuditTrail, auditQueryArgs) || [];

    // Automation logs for quick counts
    const automationLogs = useQuery(api.sentry.getAutomationLogs, firmId ? { firmId, limit: 100 } : 'skip') || [];
    
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
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const ok = await confirm({
            title: 'Delete this message?',
            message: 'This message will be permanently removed from the inbox.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true,
        });
        if (!ok) return;
        await deleteMessage({ messageId: id as any });
        if (selectedThreadId === id) setSelectedThreadId(null);
        addToast("Message deleted", { type: "info" });
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedMessage) return;
        setIsSending(true);
        try {
            if (integrationStatus === 'connected') {
                const channel = selectedMessage.channel as AutomationChannel;
                setComposePrefill({
                    tenantName: selectedMessage.senderName,
                    tenantEmail: channel === 'email' ? selectedMessage.senderContact : undefined,
                    tenantPhone: channel === 'whatsapp' ? selectedMessage.senderContact : undefined,
                    channel,
                });
                setShowCompose(true);
                setReplyText("");
                setIsSending(false);
            } else {
                // Save reply to automation_logs so it's not lost
                try {
                    await logAutomation({
                        firmId: firmId!,
                        unitId: selectedMessage.unitId || undefined,
                        tenantId: selectedMessage.tenantId || undefined,
                        messageType: 'custom' as any,
                        channel: (selectedMessage.channel as AutomationChannel) || 'whatsapp',
                        recipient: selectedMessage.senderContact || selectedMessage.senderName || '',
                        messageContent: replyText.trim(),
                        messagePreview: replyText.trim().substring(0, 80),
                        direction: 'outbound',
                        senderName: currentUser?.name || 'Admin',
                        status: 'simulated',
                        triggeredBy: 'manual_reply_offline',
                    });
                    addToast("Reply saved to audit trail. Connect a messaging channel (Email/WhatsApp) to deliver replies automatically.", { type: "info" });
                } catch (logErr) {
                    console.warn('[AtriumInbox] Could not save reply to audit log:', logErr);
                    addToast("Reply saved. Connect a messaging channel (Email/WhatsApp) to deliver replies automatically.", { type: "info" });
                }
                setReplyText("");
                setIsSending(false);
            }
        } catch (e: any) {
            addToast(translateError(e, "send reply"), { type: "error" });
            setIsSending(false);
        }
    };

    const handlePrintForTenant = (tenantContact?: string, tenantName?: string, unitId?: string) => {
        setPrintTenant({
            unitId,
            tenantContact,
            tenantName,
        });
        setShowPrintView(true);
    };

    const handlePrintAll = () => {
        setPrintTenant({});
        setShowPrintView(true);
    };

    const integrationStatus = coreState.firmDetails?.automationSettings?.chakra?.isActive ? 'connected' : 'simulated';

    // Unique channels and message types for filter dropdowns
    const availableChannels = useMemo(() => {
        const channels = new Set<string>();
        auditTrail.forEach((e: AuditTrailEntry) => channels.add(e.channel));
        return Array.from(channels).sort();
    }, [auditTrail]);

    const availableMessageTypes = useMemo(() => {
        const types = new Set<string>();
        auditTrail.forEach((e: AuditTrailEntry) => { if (e.messageType) types.add(e.messageType); });
        return Array.from(types).sort();
    }, [auditTrail]);

    const formatMessageType = (type: string) => {
        return MSG_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white sm:overflow-hidden">
            {/* Header — restyled to match PracticePro's minimalist aesthetic.
                Was: dark bg-slate-950 + emerald neon accents (broke product continuity).
                Now: clean white/zinc card with primary green accents, consistent
                with the rest of the app's design language. */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">
                        <ChatBubbleLeftRightIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">WhatsApp & Email</h2>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-medium">Residents' Messages & Reminders</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Print Button */}
                    <button
                        onClick={handlePrintAll}
                        className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-600 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors"
                        title="Print all communications"
                    >
                        <PrinterIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print</span>
                    </button>
                    <button
                        onClick={() => setShowCompose(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                    >
                        <PlusIcon className="w-4 h-4" /> Compose
                    </button>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {messages.filter(m => !m.isRead).length} Unread
                        </span>
                    </div>
                </div>
            </div>

            {/* Sub-tabs: Inbox / Audit Trail — restyled to match app tab style */}
            <div className="flex-shrink-0 flex items-center gap-0 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 sm:px-6">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
                        activeTab === 'inbox'
                            ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600'
                    }`}
                >
                    <EnvelopeIcon className="w-3.5 h-3.5" />
                    Inbox
                    {messages.filter(m => !m.isRead).length > 0 && (
                        <span className="text-3xs font-black px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">
                            {messages.filter(m => !m.isRead).length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
                        activeTab === 'audit'
                            ? 'border-emerald-500 text-white'
                            : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600'
                    }`}
                >
                    <ClockIcon className="w-3.5 h-3.5" />
                    Audit Trail
                    {automationLogs.length > 0 && (
                        <span className="text-3xs font-black px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                            {automationLogs.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'inbox' ? (
                /* ─── INBOX VIEW ────────────────────────────────────────────────── */
                <div className="flex flex-1 sm:overflow-hidden">
                    {/* Threads List - Hidden on mobile if thread selected */}
                    <div className={`${selectedThreadId ? 'hidden md:block' : 'block'} w-full md:w-1/3 border-r border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 sm:overflow-y-auto custom-scrollbar pb-24 md:pb-0`}>
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
                                    className={`group p-4 border-b border-slate-100 dark:border-zinc-700 cursor-pointer transition-all relative ${selectedThreadId === msg._id ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-r-primary-500' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            {!msg.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>}
                                            <h4 className={`text-sm truncate max-w-[140px] ${!msg.isRead ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-600 dark:text-zinc-400'}`}>
                                                {msg.senderName || msg.senderContact}
                                            </h4>
                                        </div>
                                        <span className="text-2xs text-slate-500 font-medium">
                                            {msg.receivedAt ? new Date(msg.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-2xs mb-2 font-bold tracking-tight">
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
                                            <span className="text-3xs font-black tracking-widest uppercase text-emerald-400/80">
                                                {msg.aiAnalysis?.intent?.replace(/_/g, ' ') || 'ANALYZED'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Thread Detail */}
                    <div className={`${selectedThreadId ? 'flex' : 'hidden md:flex'} flex-1 bg-white dark:bg-zinc-900 flex flex-col relative`}>
                        {selectedMessage ? (
                            <>
                                {/* Thread Header - Mobile only */}
                                <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                                    <button onClick={() => setSelectedThreadId(null)} className="p-1 text-slate-400">
                                        <ChevronLeftIcon className="w-6 h-6" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedMessage.senderName || selectedMessage.senderContact}</h3>
                                        <p className="text-2xs text-slate-500">{selectedMessage.senderContact}</p>
                                    </div>
                                    <button
                                        onClick={() => handlePrintForTenant(
                                            selectedMessage.senderContact,
                                            selectedMessage.senderName || undefined,
                                            selectedMessage.unitId || undefined
                                        )}
                                        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                        title="Print communications with this tenant"
                                    >
                                        <PrinterIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex-1 sm:overflow-y-auto p-6 pb-44 md:pb-6 space-y-8 custom-scrollbar">
                                    <div className="flex flex-col">
                                        <div className="flex justify-start mb-6">
                                            <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm max-w-[85%] relative group">
                                                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-zinc-700">
                                                    <span className="text-2xs font-black text-slate-500 uppercase tracking-widest">
                                                        {selectedMessage.senderName || 'Tenant'}
                                                    </span>
                                                    <span className="text-2xs text-slate-600">
                                                        {selectedMessage.receivedAt ? new Date(selectedMessage.receivedAt).toLocaleString() : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
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
                                                    <h4 className="text-2xs font-black uppercase tracking-widest text-emerald-400">ARIA Suggested Reply</h4>
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
                                                    <button className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-600 dark:text-zinc-400 text-xs font-bold rounded-xl transition-colors">
                                                        Ignore
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Reply Input Area */}
                                <div className="p-5 bg-white dark:bg-zinc-800 backdrop-blur-md border-t border-slate-200 dark:border-zinc-700 shadow-lg">
                                    <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                        <div className="flex-1 relative">
                                            <textarea 
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Type a manual reply..." 
                                                rows={Math.min(5, replyText.split('\n').length || 1)}
                                                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white text-sm rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                                            />
                                            {replyText && (
                                                <button 
                                                    onClick={() => setReplyText("")}
                                                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <button 
                                            onClick={handleSendReply}
                                            disabled={!replyText.trim() || isSending}
                                            className="p-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 dark:disabled:bg-zinc-700 disabled:text-slate-400 dark:disabled:text-zinc-600 text-white rounded-2xl shadow-lg transition-all flex-shrink-0 hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            <PaperAirplaneIcon className={`w-5 h-5 ${isSending ? 'animate-pulse' : ''}`} />
                                        </button>
                                    </div>
                                    <p className="text-3xs text-center text-slate-600 mt-3 uppercase tracking-widest font-black">
                                        {integrationStatus === 'connected' 
                                            ? `Sending via ${selectedMessage.channel} · ${selectedMessage.senderContact}`
                                            : `Reply via ${selectedMessage.channel} · Offline — replies saved locally`
                                        }
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 p-8 text-center">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-6 border border-slate-200 dark:border-zinc-700">
                                    <ChatBubbleLeftRightIcon className="w-10 h-10 opacity-20" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-400 mb-2">No Thread Selected</h3>
                                <p className="text-sm max-w-xs text-slate-600 leading-relaxed">
                                    Select a conversation from the sidebar to view messages and respond to residents.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ─── AUDIT TRAIL VIEW ──────────────────────────────────────────── */
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Filter Bar */}
                    <div className="sticky top-0 z-10 bg-white dark:bg-zinc-800 backdrop-blur-sm border-b border-slate-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                        showFilters || auditFilters.channel || auditFilters.messageType || auditFilters.startDate || auditFilters.endDate
                                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50'
                                            : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                                    }`}
                                >
                                    <FilterIcon className="w-3.5 h-3.5" />
                                    Filters
                                    {(auditFilters.channel || auditFilters.messageType || auditFilters.startDate || auditFilters.endDate) && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    )}
                                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                </button>
                                <span className="text-2xs text-slate-500 font-medium">
                                    {auditTrail.length} {auditTrail.length === 1 ? 'entry' : 'entries'}
                                </span>
                            </div>
                            <button
                                onClick={handlePrintAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
                            >
                                <PrinterIcon className="w-3.5 h-3.5" /> Print Report
                            </button>
                        </div>

                        {/* Expandable filter panel */}
                        {showFilters && (
                            <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <label className="text-3xs text-slate-500 uppercase tracking-widest font-bold mb-1 block">Channel</label>
                                    <select
                                        value={auditFilters.channel}
                                        onChange={e => setAuditFilters(f => ({ ...f, channel: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    >
                                        <option value="">All Channels</option>
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="email">Email</option>
                                        <option value="sms">SMS</option>
                                        <option value="portal">Portal</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-3xs text-slate-500 uppercase tracking-widest font-bold mb-1 block">Message Type</label>
                                    <select
                                        value={auditFilters.messageType}
                                        onChange={e => setAuditFilters(f => ({ ...f, messageType: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    >
                                        <option value="">All Types</option>
                                        <option value="custom">Custom</option>
                                        <option value="rent_reminder">Rent Reminder</option>
                                        <option value="late_notice">Late Notice</option>
                                        <option value="payment_receipt">Payment Receipt</option>
                                        <option value="service_charge_alert">Service Charge</option>
                                        <option value="penalty_notice">Penalty Notice</option>
                                        <option value="lease_renewal">Lease Renewal</option>
                                        <option value="access_restriction">Access Restriction</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-3xs text-slate-500 uppercase tracking-widest font-bold mb-1 block">From Date</label>
                                    <input
                                        type="date"
                                        value={auditFilters.startDate}
                                        onChange={e => setAuditFilters(f => ({ ...f, startDate: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="text-3xs text-slate-500 uppercase tracking-widest font-bold mb-1 block">To Date</label>
                                    <input
                                        type="date"
                                        value={auditFilters.endDate}
                                        onChange={e => setAuditFilters(f => ({ ...f, endDate: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [color-scheme:dark]"
                                    />
                                </div>
                                {(auditFilters.channel || auditFilters.messageType || auditFilters.startDate || auditFilters.endDate) && (
                                    <div className="col-span-2 sm:col-span-4 flex justify-end">
                                        <button
                                            onClick={() => setAuditFilters({ channel: '', messageType: '', startDate: '', endDate: '' })}
                                            className="text-2xs text-slate-400 hover:text-white font-bold uppercase tracking-wider transition-colors"
                                        >
                                            Clear Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Audit Trail Timeline */}
                    <div className="px-4 sm:px-6 py-4 max-h-[calc(100dvh-14rem)] overflow-y-auto custom-scrollbar">
                        {auditTrail.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-slate-800">
                                    <FileTextIcon className="w-8 h-8 opacity-20" />
                                </div>
                                <p className="text-sm font-medium text-slate-400">No audit trail entries</p>
                                <p className="text-xs text-slate-600 mt-1">Communications will appear here as they are sent and received</p>
                            </div>
                        ) : (
                            <div className="space-y-0">
                                {auditTrail.map((entry: AuditTrailEntry, idx: number) => {
                                    const isOutbound = entry.direction === 'outbound';
                                    const dateStr = new Date(entry.timestamp).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
                                    const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const prevEntry = idx > 0 ? auditTrail[idx - 1] : null;
                                    const prevDate = prevEntry ? new Date(prevEntry.timestamp).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                                    const showDateHeader = dateStr !== prevDate;

                                    return (
                                        <React.Fragment key={entry._id}>
                                            {/* Date separator */}
                                            {showDateHeader && (
                                                <div className="flex items-center gap-3 py-3">
                                                    <div className="h-px flex-1 bg-slate-800" />
                                                    <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest">{dateStr}</span>
                                                    <div className="h-px flex-1 bg-slate-800" />
                                                </div>
                                            )}

                                            {/* Timeline entry */}
                                            <div className="group relative flex gap-3 pb-4">
                                                {/* Direction indicator */}
                                                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                                        isOutbound 
                                                            ? 'bg-emerald-900/40 text-emerald-400' 
                                                            : 'bg-blue-900/40 text-blue-400'
                                                    }`}>
                                                        {isOutbound 
                                                            ? <ArrowUpRightIcon className="w-3.5 h-3.5" />
                                                            : <ArrowDownLeftIcon className="w-3.5 h-3.5" />
                                                        }
                                                    </div>
                                                    {idx < auditTrail.length - 1 && (
                                                        <div className="w-px flex-1 bg-slate-800 mt-1" />
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0 bg-slate-900/50 rounded-xl border border-slate-800/50 p-3 group-hover:border-slate-700 transition-colors">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                        <span className={`text-3xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                            isOutbound
                                                                ? 'bg-emerald-900/40 text-emerald-400'
                                                                : 'bg-blue-900/40 text-blue-400'
                                                        }`}>
                                                            {isOutbound ? 'Sent' : 'Received'}
                                                        </span>
                                                        <span className={`text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                            CHANNEL_COLORS[entry.channel as AutomationChannel] || 'text-slate-400 bg-slate-800'
                                                        }`}>
                                                            {CHANNEL_LABELS[entry.channel] || entry.channel}
                                                        </span>
                                                        {entry.messageType && entry.messageType !== 'custom' && (
                                                            <span className="text-3xs text-slate-500 font-medium">
                                                                {formatMessageType(entry.messageType)}
                                                            </span>
                                                        )}
                                                        {entry.status && isOutbound && (
                                                            <span className={`text-3xs font-bold ${
                                                                entry.status === 'sent' ? 'text-emerald-500' :
                                                                entry.status === 'failed' ? 'text-rose-500' :
                                                                'text-amber-500'
                                                            }`}>
                                                                [{entry.status}]
                                                            </span>
                                                        )}
                                                        <span className="text-2xs text-slate-600 ml-auto">{timeStr}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap line-clamp-3">
                                                        {entry.content}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-2 text-2xs text-slate-500">
                                                        {isOutbound && entry.recipient && (
                                                            <span>To: {entry.recipient}</span>
                                                        )}
                                                        {!isOutbound && entry.senderName && (
                                                            <span>From: {entry.senderName}</span>
                                                        )}
                                                        {!isOutbound && entry.senderContact && (
                                                            <span>{entry.senderContact}</span>
                                                        )}
                                                        {isOutbound && entry.senderName && (
                                                            <span>Sent by: {entry.senderName}</span>
                                                        )}
                                                    </div>
                                                    {/* Print button per entry */}
                                                    <button
                                                        onClick={() => handlePrintForTenant(
                                                            isOutbound ? entry.recipient : entry.senderContact,
                                                            entry.senderName || undefined,
                                                            entry.unitId || undefined
                                                        )}
                                                        className="opacity-0 group-hover:opacity-100 mt-2 text-2xs text-slate-500 hover:text-emerald-400 font-bold flex items-center gap-1 transition-all"
                                                    >
                                                        <PrinterIcon className="w-3 h-3" /> Print this conversation
                                                    </button>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showCompose && firmId && <ComposeModal firmId={firmId} prefill={composePrefill} onClose={() => { setShowCompose(false); setComposePrefill(undefined); }} onToast={(msg) => addToast(msg, { type: msg.includes('Error') || msg.includes('Failed') ? 'error' : 'success' })} />}
            
            {showPrintView && firmId && (
                <CommunicationPrintView
                    firmId={firmId}
                    unitId={printTenant.unitId}
                    tenantContact={printTenant.tenantContact}
                    tenantName={printTenant.tenantName}
                    unitLabel={printTenant.unitLabel}
                    onClose={() => setShowPrintView(false)}
                />
            )}
            {ConfirmDialog}
        </div>
    );
};
