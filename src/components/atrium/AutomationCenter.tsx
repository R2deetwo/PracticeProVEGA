import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { AutomationLog, AutomationMessageType, AutomationChannel } from '../../types';
import { useTerminology } from '../../contexts/ProductContext';
import { ComposeModal, buildMessage } from './ComposeModal';
import { PenLine, Calendar, AlertTriangle, Receipt, Zap, Lock, Wallet, ClipboardList, Users, Gift, Wrench, Megaphone, FileText } from 'lucide-react';

// ── Icons ─────────────────────────────────────────────────────────────────
const WhatsAppIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const SendIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const ZapIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

// ── Types & Labels ────────────────────────────────────────────────────────
const MSG_TYPE_LABELS: Record<AutomationMessageType, string> = {
  custom: 'Custom Message', rent_reminder: 'Rent Reminder', late_notice: 'Late Notice', payment_receipt: 'Payment Receipt',
  service_charge_alert: 'Service Charge Alert', access_restriction: 'Access Restriction',
  penalty_notice: 'Penalty Notice', lease_renewal: 'Lease Renewal',
  welcome_note: 'Welcome Note', promotion: 'Promotion/Offer', vendor_update: 'New Vendor Alert',
  general_announcement: 'General Announcement', maintenance_update: 'Maintenance Update'
};
const MSG_TYPE_ICONS: Record<string, React.ReactNode> = {
  custom: <PenLine className="w-3.5 h-3.5" />, rent_reminder: <Calendar className="w-3.5 h-3.5" />, late_notice: <AlertTriangle className="w-3.5 h-3.5" />, payment_receipt: <Receipt className="w-3.5 h-3.5" />,
  service_charge_alert: <Zap className="w-3.5 h-3.5" />, access_restriction: <Lock className="w-3.5 h-3.5" />, penalty_notice: <Wallet className="w-3.5 h-3.5" />, lease_renewal: <ClipboardList className="w-3.5 h-3.5" />,
  welcome_note: <Users className="w-3.5 h-3.5" />, promotion: <Gift className="w-3.5 h-3.5" />, vendor_update: <Wrench className="w-3.5 h-3.5" />, general_announcement: <Megaphone className="w-3.5 h-3.5" />, maintenance_update: <Wrench className="w-3.5 h-3.5" />
};
const getMsgTypeLabel = (type: string) => (MSG_TYPE_LABELS as any)[type] || type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const getMsgTypeIcon = (type: string) => (MSG_TYPE_ICONS as any)[type] || <FileText className="w-3.5 h-3.5" />;
const CHANNEL_COLORS: Record<AutomationChannel, string> = {
  whatsapp: 'text-green-400 bg-green-900/30', email: 'text-blue-400 bg-blue-900/30', portal: 'text-emerald-400 bg-emerald-900/30',
};
const STATUS_COLORS = { sent: 'text-emerald-400', failed: 'text-rose-400', simulated: 'text-amber-400' };

function formatTs(ts: number) {
  return new Date(ts).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Main Component ────────────────────────────────────────────────────────
const AutomationCenter: React.FC = () => {
  const terminology = useTerminology();
  const { currentUser, bearerToken } = useAuth();
  const { coreState } = useCoreState();
  const convex = useConvex();
  const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

  // FIX: previously read `coreState.automationLogs` — a key getFirmData never
  // returns — so the message-log feed and all 3 KPIs (Total Sent / via
  // WhatsApp / Today) were permanently empty, even seconds after a successful
  // bulk send. Switched to the real live query (sentry.getAutomationLogs).
  const liveLogs = useQuery(
    api.sentry.getAutomationLogs,
    firmId ? { firmId, limit: 100, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
  );
  const logs = (liveLogs ?? (coreState as any).automationLogs ?? []) as any[];
  const logAuto = useMutation(api.sentry.logAutomation);
  const { addToast } = useUI();

  const [showCompose, setShowCompose] = useState(false);
  const [filter, setFilter] = useState<AutomationMessageType | 'all'>('all');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Record<string, string>>(coreState.firmDetails?.automationSettings?.automationTemplates || {});
  const [newTemplateKey, setNewTemplateKey] = useState('');
  
  const updateFirmDetails = useMutation(api.myFunctions.updateFirmSettings);

  const handleAddCustomTemplate = () => {
    if (!newTemplateKey.trim()) return;
    const key = newTemplateKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (templates[key]) {
        addToast('A template with this name already exists', { type: 'error' });
        return;
    }
    setTemplates(prev => ({ ...prev, [key]: '' }));
    setNewTemplateKey('');
    addToast(`Added "${newTemplateKey}" to templates. Scroll down to edit.`, { type: 'success' });
  };

  const handleSaveTemplates = async () => {
    try {
      await updateFirmDetails({
        firmId,
        settings: {
          automationSettings: {
            ...coreState.firmDetails?.automationSettings,
            automationTemplates: templates
          }
        }
      });
      addToast('Templates saved successfully', { type: 'success' });
      setShowTemplates(false);
    } catch (e: any) {
      addToast(`Failed to save templates: ${e.message}`, { type: 'error' });
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(l => l.messageType === filter);
  }, [logs, filter]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      total: logs.length,
      whatsapp: logs.filter(l => l.channel === 'whatsapp').length,
      today: logs.filter(l => l.sentAt >= today.getTime()).length,
    };
  }, [logs]);

  const handleBulkRentReminder = async () => {
    const props = (coreState.properties || []).filter(p => p.rentalDetails?.tenantPhone);
    if (props.length === 0) { addToast(`No occupied ${terminology.matter.toLowerCase() === 'property' ? 'properties' : terminology.matter.toLowerCase() + 's'} with phone numbers found`, { type: 'error' }); return; }
    addToast(`Sending ${Math.min(props.length, 20)} reminder(s)…`, { type: 'info' });
    let sent = 0, failed = 0;
    for (const p of props.slice(0, 20)) {
      const phone = p.rentalDetails!.tenantPhone!;
      const tenantName = p.rentalDetails?.tenantName || 'Resident';
      const rentAmount = (p.rentalDetails?.rentAmount || 0).toLocaleString('en-NG');
      const address = p.address;
      const plainMsg = buildMessage('rent_reminder', address, tenantName, p.rentalDetails?.rentAmount, undefined, coreState.firmDetails?.automationSettings?.automationTemplates);
      try {
        const result = await convex.action(api.communications.sendWhatsApp, {
          to: phone,
          messageText: plainMsg,
          templateName: 'atrium_rent_reminder',
          templateVars: [tenantName, rentAmount, address],
          firmId,
        });
        const status = result.success ? 'sent' : 'failed';
        if (result.success) sent++; else failed++;
        await logAuto({ firmId, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined), unitId: p.id, messageType: 'rent_reminder', channel: 'whatsapp', recipient: phone, messagePreview: plainMsg, status, triggeredBy: currentUser?.id });
      } catch (e: any) {
        failed++;
        console.error(`[BulkReminder] Failed for ${phone}:`, e.message);
      }
    }
    if (sent > 0) addToast(`${sent} WhatsApp reminder(s) delivered`, { type: 'success' });
    if (failed > 0) addToast(`${failed} failed — check phone numbers are in international format`, { type: 'error' });
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white sm:overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Automated Messages</h2>
          <p className="text-xs text-slate-500 mt-0.5">WhatsApp · Email · Portal reminders, sent automatically</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap">
          <button onClick={() => setShowTemplates(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">
            <PenLine className="w-3.5 h-3.5" /> Templates
          </button>
          <button onClick={handleBulkRentReminder} className="flex items-center gap-2 px-3 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 text-xs font-bold rounded-lg border border-green-800 transition-colors whitespace-nowrap">
            <WhatsAppIcon /> Bulk
          </button>
          <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap">
            <SendIcon /> Compose
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-3 px-6 py-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-black text-white">{stats.total}</p>
          <p className="text-2xs text-slate-500 uppercase tracking-wider mt-1">Total Sent</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-black text-green-400">{stats.whatsapp}</p>
          <p className="text-2xs text-slate-500 uppercase tracking-wider mt-1">via WhatsApp</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
          <p className="text-2xl font-black text-sky-400">{stats.today}</p>
          <p className="text-2xs text-slate-500 uppercase tracking-wider mt-1">Today</p>
        </div>
      </div>

      {/* Automation Rules Accordion & Late Fee Callout */}
      <div className="flex-shrink-0 px-6 pb-3 space-y-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <button 
            onClick={() => setShowHowItWorks(!showHowItWorks)} 
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
          >
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <ZapIcon className="w-4 h-4 text-emerald-400" />
                How Automations Work
              </p>
              <p className="text-2xs text-slate-500 mt-0.5">Click to {showHowItWorks ? 'collapse' : 'expand'} the active automation rules</p>
            </div>
            <span className="text-slate-500 text-lg">{showHowItWorks ? '−' : '+'}</span>
          </button>
          
          {showHowItWorks && (
            <div className="px-4 pb-4 border-t border-slate-800 pt-3 animate-fade-in">
              <table className="w-full text-2xs text-left">
                <thead className="text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="pb-2 font-semibold">Rule</th>
                    <th className="pb-2 font-semibold">Trigger</th>
                    <th className="pb-2 font-semibold">Message Sent</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 flex items-center gap-1"><span className="text-emerald-500"></span> T-7 Rent Reminder</td>
                    <td className="py-2">7 days before lease end</td>
                    <td className="py-2">Rent reminder template</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 flex items-center gap-1"><span className="text-rose-500"></span> T+1 Late Notice</td>
                    <td className="py-2">1 day after due date</td>
                    <td className="py-2">Late notice + penalty warning</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2 flex items-center gap-1"><span className="text-sky-500"></span> On Payment: Receipt</td>
                    <td className="py-2">Ledger entry "cleared"</td>
                    <td className="py-2">Payment receipt template</td>
                  </tr>
                  <tr>
                    <td className="py-2 flex items-center gap-1"><span className="text-amber-500"></span> Defaulter Alert</td>
                    <td className="py-2">Ledger entry "defaulted"</td>
                    <td className="py-2">Internal manager alert</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-amber-900/10 border border-amber-900/30 rounded-lg p-3 flex items-start gap-3">
          <div className="p-1.5 bg-amber-500/20 text-amber-500 rounded-lg"></div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-400">Late Penalty Fee</h4>
            <p className="text-2xs text-slate-400 mt-0.5 mb-2 leading-relaxed">
              When a resident defaults on payment, a late notice is automatically sent. You can choose to apply an automatic penalty fee to their ledger balance.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xs text-slate-500">Current Rate:</span>
              <span className="text-2xs font-bold text-white px-2 py-0.5 bg-slate-800 rounded">{coreState.firmDetails?.automationSettings?.latePenaltyRate || 0}% / month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Header */}
      <div className="flex-shrink-0 px-6 pb-2 pt-2 border-t border-slate-800 mt-2 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Message Logs</h3>
        <select 
          value={filter} 
          onChange={e => setFilter(e.target.value as AutomationMessageType | 'all')}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1 outline-none focus:border-emerald-500"
        >
          <option value="all">All Messages</option>
          {Object.entries(MSG_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Log Feed */}
      <div className="flex-1 sm:overflow-y-auto px-4 sm:px-6 pb-44 sm:pb-6 space-y-1.5">
        {!logs ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-14 bg-slate-900 rounded-lg animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <SendIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">No messages sent yet</p>
          </div>
        ) : (
          filtered.map((log: any) => (
            <div key={log._id} className="flex items-start gap-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-4 py-3 transition-colors">
              <span className="text-lg flex-shrink-0 mt-0.5">{(MSG_TYPE_ICONS as any)[log.messageType]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white">{(MSG_TYPE_LABELS as any)[log.messageType]}</span>
                  <span className={`text-3xs font-bold uppercase px-1.5 py-0.5 rounded-full ${(CHANNEL_COLORS as any)[log.channel]}`}>{log.channel}</span>
                  <span className={`text-3xs font-bold uppercase ${(STATUS_COLORS as any)[log.status]}`}>{log.status}</span>
                </div>
                <p className="text-2xs text-slate-500 truncate">{log.messagePreview}</p>
                <p className="text-2xs text-slate-700 mt-0.5">To: {log.recipient}</p>
              </div>
              <div className="flex items-center gap-1 text-2xs text-slate-600 flex-shrink-0">
                <ClockIcon className="w-3 h-3" />
                {formatTs(log.sentAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {showCompose && <ComposeModal firmId={firmId} onClose={() => setShowCompose(false)} onToast={(msg) => addToast(msg, { type: msg.includes('Error') || msg.includes('Failed') ? 'error' : 'success' })} />}
      
      {showTemplates && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in-right">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">Message Templates</h3>
              <p className="text-xs text-slate-500">Customise automated messages</p>
            </div>
            <button onClick={() => setShowTemplates(false)} className="text-slate-500 hover:text-white text-xl">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 mb-6 space-y-2">
              <strong className="text-slate-300 text-sm block mb-1">Available Variables:</strong>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <code className="text-emerald-400 text-2xs">{"{{TENANT_NAME}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{PROPERTY_ADDRESS}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{AMOUNT}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{SERVICE_CHARGE}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{CAUTION_DEPOSIT}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{LEGAL_FEE}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{AGENCY_FEE}}"}</code>
                <code className="text-emerald-400 text-2xs">{"{{DUE_DATE}}"}</code>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-2xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">Revenue Pipeline</h4>
              {Object.entries(MSG_TYPE_LABELS).filter(([k]) => ['rent_reminder', 'late_notice', 'payment_receipt', 'penalty_notice', 'service_charge_alert'].includes(k)).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    {MSG_TYPE_ICONS[k as AutomationMessageType]} {label}
                  </label>
                  <textarea 
                    value={templates[k] !== undefined ? templates[k] : buildMessage(k as AutomationMessageType, '{{PROPERTY_ADDRESS}}', '{{TENANT_NAME}}', 0)} 
                    onChange={e => setTemplates(prev => ({ ...prev, [k]: e.target.value }))}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}

              <h4 className="text-2xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1 pt-4">CRM & Announcements</h4>
              {Object.entries(MSG_TYPE_LABELS).filter(([k]) => ['welcome_note', 'promotion', 'vendor_update', 'general_announcement', 'maintenance_update'].includes(k)).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    {getMsgTypeIcon(k)} {label}
                  </label>
                  <textarea 
                    value={templates[k] !== undefined ? templates[k] : buildMessage(k as AutomationMessageType, '{{PROPERTY_ADDRESS}}', '{{TENANT_NAME}}', 0)} 
                    onChange={e => setTemplates(prev => ({ ...prev, [k]: e.target.value }))}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}

              {/* Custom Templates */}
              {Object.keys(templates).filter(k => !MSG_TYPE_LABELS[k as AutomationMessageType]).length > 0 && (
                <>
                  <h4 className="text-2xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1 pt-4">Custom Templates</h4>
                  {Object.keys(templates).filter(k => !MSG_TYPE_LABELS[k as AutomationMessageType]).map(k => (
                    <div key={k} className="group relative">
                      <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">{getMsgTypeLabel(k)}</span>
                        <button 
                          onClick={() => {
                            const next = { ...templates };
                            delete next[k];
                            setTemplates(next);
                          }}
                          className="text-slate-600 hover:text-rose-500 text-2xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        >
                          Delete
                        </button>
                      </label>
                      <textarea 
                        value={templates[k]} 
                        onChange={e => setTemplates(prev => ({ ...prev, [k]: e.target.value }))}
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                        placeholder="Type message content here..."
                      />
                    </div>
                  ))}
                </>
              )}

              {/* Add New Template Input */}
              <div className="pt-4 border-t border-slate-800">
                <label className="block text-2xs font-black text-slate-500 uppercase tracking-widest mb-2">Create New Template</label>
                <div className="flex gap-2">
                  <input 
                    value={newTemplateKey}
                    onChange={e => setNewTemplateKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomTemplate()}
                    placeholder="e.g. Easter Greeting"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <button 
                    onClick={handleAddCustomTemplate}
                    className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-slate-800 flex gap-3">
            <button onClick={() => setShowTemplates(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
            <button onClick={handleSaveTemplates} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 transition-colors">Save Templates</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationCenter;
