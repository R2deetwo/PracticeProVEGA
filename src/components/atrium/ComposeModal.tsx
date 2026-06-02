import React, { useState, useMemo } from 'react';
import { useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { AutomationMessageType, AutomationChannel } from '../../types';
import { PenLine, Calendar, AlertTriangle, Receipt, Zap, Lock, Wallet, ClipboardList, Users, Gift, Wrench, Megaphone, FileText } from 'lucide-react';

// ── Icons ─────────────────────────────────────────────────────────────────
const SendIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
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
  whatsapp: 'text-green-400 bg-green-900/30', email: 'text-blue-400 bg-blue-900/30', sms: 'text-purple-400 bg-purple-900/30',
};

// ── Helpers ──────────────────────────────────────────────────────────────
const formatNumberWithCommas = (val: string | number) => {
    if (!val) return '';
    const num = parseFloat(val.toString().replace(/,/g, ''));
    if (isNaN(num)) return val.toString();
    return num.toLocaleString('en-US');
};
const parseFormattedNumber = (val: string) => val.replace(/,/g, '').replace(/[^\d.-]/g, '');

export function buildMessage(
  type: AutomationMessageType, 
  unitLabel: string, 
  tenantName?: string, 
  amount?: number, 
  customText?: string, 
  customTemplates?: Record<string, string>,
  extraData?: {
    serviceCharge?: number;
    legalFee?: number;
    agencyFee?: number;
    cautionDeposit?: number;
    dueDate?: string;
    firmName?: string;
  }
): string {
  if (customText) return customText;

  const name = tenantName || 'Tenant';
  const addr = unitLabel;
  const baseRent = amount || 0;
  
  const sc = extraData?.serviceCharge || 0;
  const lf = extraData?.legalFee || 0;
  const af = extraData?.agencyFee || 0;
  const cd = extraData?.cautionDeposit || 0;
  const totalPayable = baseRent + sc + lf + af + cd;
  
  const amtStr = `₦${baseRent.toLocaleString('en-NG')}`;
  const totalStr = `₦${totalPayable.toLocaleString('en-NG')}`;

  let message = customTemplates?.[type];
  
  if (!message) {
    switch (type) {
      case 'rent_reminder': 
        message = `OFFICIAL DEMAND NOTICE\n\nDear {{TENANT_NAME}},\n\nThis is a formal reminder that your payment for {{PROPERTY_ADDRESS}} is due on or before {{DUE_DATE}}.\n\nFinancial Breakdown:\n- Rent: {{AMOUNT}}\n{{SERVICE_CHARGE_LINE}}{{CAUTION_DEPOSIT_LINE}}{{FEES_LINE}}\nTotal Payable: {{TOTAL_PAYABLE}}\n\nPlease ensure payment is made promptly. Thank you.\n\n— {{FIRM_NAME}}`; 
        break;
      case 'late_notice': 
        message = `URGENT: OVERDUE PAYMENT\n\nDear {{TENANT_NAME}},\n\nYour payment of {{TOTAL_PAYABLE}} for {{PROPERTY_ADDRESS}} is now OVERDUE.\n\nPlease make payment immediately to avoid late penalties or access restrictions. Contact management at {{FIRM_NAME}} to confirm your payment.\n\n— {{FIRM_NAME}}`; 
        break;
      case 'payment_receipt': 
        message = `PAYMENT RECEIPT\n\nDear {{TENANT_NAME}},\n\nWe confirm receipt of {{TOTAL_PAYABLE}} for your unit at {{PROPERTY_ADDRESS}}.\n\nThank you for your prompt payment.\n\n— {{FIRM_NAME}}`; 
        break;
      case 'service_charge_alert': 
        message = `SERVICE CHARGE ALERT\n\nDear {{TENANT_NAME}},\n\nYour service charge of ₦${sc.toLocaleString('en-NG')} for {{PROPERTY_ADDRESS}} is outstanding. Please settle this at your earliest convenience to avoid access restrictions.\n\nTotal Payable: {{TOTAL_PAYABLE}}`; 
        break;
      case 'access_restriction': 
        message = `NOTICE OF ACCESS RESTRICTION\n\nAccess to {{PROPERTY_ADDRESS}} has been restricted due to non-payment of outstanding charges totaling {{TOTAL_PAYABLE}}. Please contact {{FIRM_NAME}} immediately to resolve.`; 
        break;
      case 'penalty_notice': 
        message = `PENALTY NOTICE\n\nDear {{TENANT_NAME}},\n\nA late payment penalty has been applied to your account for {{PROPERTY_ADDRESS}}.\n\nRevised Total Payable: {{TOTAL_PAYABLE}}\n\nPlease settle the outstanding balance urgently. — {{FIRM_NAME}}`; 
        break;
      case 'lease_renewal': 
        message = `LEASE RENEWAL\n\nDear {{TENANT_NAME}},\n\nYour lease for {{PROPERTY_ADDRESS}} is expiring soon. We invite you to renew your tenancy agreement. Please contact {{FIRM_NAME}} to discuss renewal terms.`; 
        break;
      case 'welcome_note': 
        message = `Welcome to your new home at {{PROPERTY_ADDRESS}}, {{TENANT_NAME}}! We are excited to have you. Please find the tenant handbook in your portal. — {{FIRM_NAME}}`; 
        break;
      case 'promotion': 
        message = `Hello {{TENANT_NAME}}, we have a special offer for our residents! Get 10% off professional cleaning services this month. Use code: CLEAN10. — {{FIRM_NAME}}`; 
        break;
      case 'vendor_update': 
        message = `Dear {{TENANT_NAME}}, we have partnered with new verified maintenance vendors to serve you better. You can now request plumbing and electrical repairs directly from the app. — {{FIRM_NAME}}`; 
        break;
      case 'general_announcement': 
        message = `Attention residents of {{PROPERTY_ADDRESS}}: Routine maintenance will be carried out on the central generators this Saturday. Expect intermittent power supply between 10am and 2pm. — {{FIRM_NAME}}`; 
        break;
      case 'maintenance_update': 
        message = `Update on your maintenance request for {{PROPERTY_ADDRESS}}: The vendor has confirmed your appointment for tomorrow. Please ensure someone is available to grant access. — {{FIRM_NAME}}`; 
        break;
      default: 
        message = ''; 
        break;
    }
  }

  if (!message) return '';

  const scLine = sc > 0 ? `- Service Charge: ₦${sc.toLocaleString('en-NG')}\n` : '';
  const cdLine = cd > 0 ? `- Caution Deposit: ₦${cd.toLocaleString('en-NG')}\n` : '';
  const feesLine = (lf + af) > 0 ? `- Legal/Agency Fees: ₦${(lf + af).toLocaleString('en-NG')}\n` : '';

  let result = message
    .replace(/\{\{TENANT_NAME\}\}/g, name)
    .replace(/\{\{AMOUNT\}\}/g, amtStr)
    .replace(/\{\{TOTAL_PAYABLE\}\}/g, totalStr)
    .replace(/\{\{SERVICE_CHARGE_LINE\}\}/g, scLine)
    .replace(/\{\{CAUTION_DEPOSIT_LINE\}\}/g, cdLine)
    .replace(/\{\{FEES_LINE\}\}/g, feesLine)
    .replace(/\{\{FIRM_NAME\}\}/g, extraData?.firmName || 'Management');

  // Handle Unit Context smartly
  if (addr === 'General') {
      result = result.replace(/ for \{\{PROPERTY_ADDRESS\}\}/g, '');
      result = result.replace(/ at \{\{PROPERTY_ADDRESS\}\}/g, '');
      result = result.replace(/\{\{PROPERTY_ADDRESS\}\}/g, 'your unit');
  } else {
      result = result.replace(/\{\{PROPERTY_ADDRESS\}\}/g, addr);
  }
  
  if (extraData) {
    result = result.replace(/\{\{SERVICE_CHARGE\}\}/g, `₦${sc.toLocaleString('en-NG')}`);
    result = result.replace(/\{\{LEGAL_FEE\}\}/g, `₦${lf.toLocaleString('en-NG')}`);
    result = result.replace(/\{\{AGENCY_FEE\}\}/g, `₦${af.toLocaleString('en-NG')}`);
    result = result.replace(/\{\{CAUTION_DEPOSIT\}\}/g, `₦${cd.toLocaleString('en-NG')}`);
    result = result.replace(/\{\{DUE_DATE\}\}/g, extraData.dueDate || 'the due date');
  }
  
  return result;
}

export const ComposeModal: React.FC<{ firmId: string; onClose: () => void; onToast: (m: string) => void }> = ({ firmId, onClose, onToast }) => {
  const { coreState } = useCoreState();
  const { currentUser } = useAuth();
  const convex = useConvex();
  const logAuto = useMutation(api.sentry.logAutomation);
  const [msgType, setMsgType] = useState<AutomationMessageType>('custom');
  const [channel, setChannel] = useState<AutomationChannel>('whatsapp');
  const [unitId, setUnitId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [countryCode, setCountryCode] = useState('+234');
  const [tenantName, setTenantName] = useState('');
  const [amount, setAmount] = useState('');
  const [customText, setCustomText] = useState('');
  const [isEdited, setIsEdited] = useState(false);
  const [serviceCharge, setServiceCharge] = useState('');
  const [legalFee, setLegalFee] = useState('');
  const [agencyFee, setAgencyFee] = useState('');
  const [cautionDeposit, setCautionDeposit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [step, setStep] = useState<'compose' | 'preview'>('compose');
  const [loading, setLoading] = useState(false);

  const units = useMemo(() => (coreState.properties || []).map(p => ({ 
    id: p.id, 
    label: p.address,
    rental: p.rentalDetails 
  })), [coreState.properties]);
  
  const selectedUnit = units.find(u => u.id === unitId);

  React.useEffect(() => {
    if (selectedUnit?.rental) {
      const r = selectedUnit.rental;
      setTenantName(r.tenantName || '');
      setAmount(r.rentAmount?.toString() || '');
      setServiceCharge(r.serviceCharge?.toString() || '');
      setLegalFee(r.legalFee?.toString() || '');
      setAgencyFee(r.agencyFee?.toString() || '');
      setCautionDeposit(r.cautionDeposit?.toString() || '');
    }
  }, [unitId]);

  React.useEffect(() => {
    if (!isEdited) {
      const generated = buildMessage(
        msgType, 
        selectedUnit?.label || 'General', 
        tenantName, 
        parseFloat(amount) || 0, 
        undefined,
        coreState.firmDetails?.automationSettings?.automationTemplates,
        {
          serviceCharge: parseFloat(serviceCharge) || 0,
          legalFee: parseFloat(legalFee) || 0,
          agencyFee: parseFloat(agencyFee) || 0,
          cautionDeposit: parseFloat(cautionDeposit) || 0,
          dueDate,
          firmName: coreState.firmDetails?.name || 'Management'
        }
      );
      setCustomText(generated);
    }
  }, [msgType, selectedUnit, tenantName, amount, serviceCharge, legalFee, agencyFee, cautionDeposit, dueDate, isEdited, coreState.firmDetails?.automationSettings?.automationTemplates]);

  const handleSend = async () => {
    if (!recipient) return;
    setLoading(true);
    let sendResult: { success: boolean; simulated?: boolean; error?: string } = { success: true, simulated: true };
    const finalRecipient = channel === 'email' ? recipient : `${countryCode}${recipient.replace(/^0+/, '')}`;

    try {
      if (channel === 'whatsapp') {
        sendResult = await convex.action(api.communications.sendWhatsApp, {
          to: finalRecipient,
          messageText: customText,
          firmId,
        });
      } else if (channel === 'email') {
        sendResult = await convex.action(api.communications.sendEmail, {
          to: finalRecipient,
          subject: `${getMsgTypeLabel(msgType)} — ${coreState.firmDetails?.name || 'Atrium OS'}`,
          htmlContent: `<p style="font-family:sans-serif;line-height:1.6">${customText.replace(/\n/g, '<br/>')}</p>`,
          firmId,
        });
      }

      const status = sendResult.simulated ? 'simulated' : sendResult.success ? 'sent' : 'failed';
      await logAuto({ firmId, unitId: unitId || undefined, messageType: msgType as any, channel, recipient: finalRecipient, messagePreview: customText, status, triggeredBy: currentUser?.id });

      if (sendResult.success) {
        onToast(channel === 'whatsapp' ? 'WhatsApp message delivered successfully' : 'Email sent successfully');
      } else {
        onToast(`Failed to send: ${sendResult.error || 'Unknown error'}`);
      }
      onClose();
    } catch (e: any) {
      console.error("Error during send:", e);
      onToast(`Error: ${e.message || 'Validation failed'}`);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4 text-white">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[90vh] max-h-[calc(100vh-env(safe-area-inset-top)-4rem)]">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-lg">Compose Message</h3>
            <p className="text-xs text-slate-500">Preview before sending — all sends are logged</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">×</button>
        </div>

        {step === 'compose' ? (
          <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Message Type</label>
                <select value={msgType} onChange={e => { setMsgType(e.target.value as AutomationMessageType); setIsEdited(false); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
                  <optgroup label="Standard" className="bg-slate-900">
                    {Object.entries(MSG_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{getMsgTypeIcon(k)} {v}</option>)}
                  </optgroup>
                  {Object.keys(coreState.firmDetails?.automationSettings?.automationTemplates || {}).filter(k => !MSG_TYPE_LABELS[k as AutomationMessageType]).length > 0 && (
                    <optgroup label="Custom Templates" className="bg-slate-900">
                      {Object.keys(coreState.firmDetails?.automationSettings?.automationTemplates || {}).filter(k => !MSG_TYPE_LABELS[k as AutomationMessageType]).map(k => (
                        <option key={k} value={k}>{getMsgTypeLabel(k)}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Channel</label>
                <select value={channel} onChange={e => setChannel(e.target.value as AutomationChannel)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Unit / Property</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
                  <option value="">All / General</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Rent Amount (₦)</label>
                <input type="text" value={formatNumberWithCommas(amount)} onChange={e => setAmount(parseFormattedNumber(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Service Charge (₦)</label>
                <input type="text" value={formatNumberWithCommas(serviceCharge)} onChange={e => setServiceCharge(parseFormattedNumber(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Caution Deposit (₦)</label>
                <input type="text" value={formatNumberWithCommas(cautionDeposit)} onChange={e => setCautionDeposit(parseFormattedNumber(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Legal Fee (₦)</label>
                <input type="text" value={formatNumberWithCommas(legalFee)} onChange={e => setLegalFee(parseFormattedNumber(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Agency Fee (₦)</label>
                <input type="text" value={formatNumberWithCommas(agencyFee)} onChange={e => setAgencyFee(parseFormattedNumber(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Tenant Name</label>
                <input value={tenantName} onChange={e => setTenantName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Mr. Ade Bello" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Recipient ({channel === 'email' ? 'email' : 'phone'})</label>
                {channel === 'email' ? (
                  <input value={recipient} onChange={e => setRecipient(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="tenant@email.com" />
                ) : (
                  <div className="flex">
                    <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-l-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 border-r-0 outline-none">
                      <option value="+234">🇳🇬 +234</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+27">🇿🇦 +27</option>
                      <option value="+254">🇰🇪 +254</option>
                    </select>
                    <input value={recipient} onChange={e => setRecipient(e.target.value)} required className="w-full bg-slate-800 border border-slate-700 border-l-0 rounded-r-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="800 000 0000" />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-slate-500 uppercase tracking-wider">Message Content</label>
                <button 
                  onClick={() => setIsEdited(false)} 
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded transition-colors ${isEdited ? 'text-emerald-400 bg-emerald-900/30 hover:bg-emerald-900/50' : 'text-slate-600 opacity-50 cursor-not-allowed'}`}
                  disabled={!isEdited}
                >
                  Reset Template
                </button>
              </div>
              <textarea 
                value={customText} 
                onChange={e => { setCustomText(e.target.value); setIsEdited(true); }} 
                rows={7}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600 font-mono leading-relaxed resize-none"
                placeholder="Type your message here..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={() => setStep('preview')} disabled={!recipient} className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                <EyeIcon /> Preview Message
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{MSG_TYPE_ICONS[msgType]}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[channel]}`}>{channel.toUpperCase()}</span>
                <span className="text-xs text-slate-500">→ {recipient}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{customText}</p>
            </div>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
              <ZapIcon className="w-3 h-3" /> Review message carefully before sending. Logs are always recorded.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep('compose')} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors">← Edit</button>
              <button onClick={handleSend} disabled={loading} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-500 transition-colors flex items-center justify-center gap-2">
                <SendIcon /> {loading ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
