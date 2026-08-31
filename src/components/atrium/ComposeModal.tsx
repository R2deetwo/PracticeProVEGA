import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useProduct } from '../../contexts/ProductContext';
import { useDataActions } from '../../contexts/DataContext';
import { AutomationMessageType, AutomationChannel } from '../../types';
import { useFeatures } from '../../hooks/useFeatures';
import { translateError } from '../../utils/errorTranslator';
import { getGeminiApiKey } from '../../utils/aiUtils';
import { usePropertyGroups, UnitOption } from '../../hooks/usePropertyGroups';
import { PenLine, Calendar, AlertTriangle, Receipt, Zap, Lock, Wallet, ClipboardList, Users, Gift, Wrench, Megaphone, FileText, ChevronDown, ChevronUp, X, Clock, Radio, Building2 } from 'lucide-react';

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
  whatsapp: 'text-green-400 bg-green-900/30', email: 'text-blue-400 bg-blue-900/30',
  portal: 'text-emerald-400 bg-emerald-900/30', 'in-app': 'text-violet-400 bg-violet-900/30',
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

  const name = tenantName || 'Resident';
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
        message = `PAYMENT RECEIPT\n\nDear {{TENANT_NAME}},\n\nWe confirm receipt of {{TOTAL_PAYABLE}} for {{PROPERTY_ADDRESS}}.\n\nThank you for your prompt payment.\n\n— {{FIRM_NAME}}`;
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
        message = `Welcome to your new home at {{PROPERTY_ADDRESS}}, {{TENANT_NAME}}! We are excited to have you. Please find the resident handbook in your portal. — {{FIRM_NAME}}`; 
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
  if (addr === 'General' || addr === 'All Residents') {
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

export interface ComposeModalPrefill {
  unitId?: string;
  unitName?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  rentAmount?: number;
  propertyAddress?: string;
  channel?: AutomationChannel;
  // Contact-initiated messaging — when a user clicks "Message" on a
  // contact in ContactDetailView, these fields are set so the compose
  // modal opens with the contact pre-selected.
  contactId?: string;
  contactName?: string;
  recipientType?: RecipientType;
}

// ── Selectable Recipient type ────────────────────────────────────────────
type RecipientType = 'tenant' | 'client' | 'team' | 'external';

interface SelectableRecipient {
  id: string;
  label: string;
  recipientType: RecipientType;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  rentAmount?: number;
  propertyAddress?: string;
  serviceCharge?: number;
  legalFee?: number;
  agencyFee?: number;
  cautionDeposit?: number;
}

export const ComposeModal: React.FC<{ firmId: string; onClose: () => void; onToast: (m: string) => void; prefill?: ComposeModalPrefill }> = ({ firmId, onClose, onToast, prefill }) => {
  const actions = useDataActions();
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const contacts = (matterState as any).contacts || (coreState as any).contacts || [];
  const { currentUser } = useAuth();
  const { isGrowthOrAbove, isKompleteFirm } = useFeatures();
  // Product-aware flags. Previously this modal had NO product awareness at all
  // — it always defaulted to the "Residents" tab and showed "Select All Tenanted"
  // even for legal-only firms. Now we know whether the firm has property features,
  // legal features, or both (Komplete).
  const { isProperty: isPropertyFirm, isLegal: isLegalFirm, isUnified, hasPropertyFeatures, hasLegalFeatures } = useProduct();
  const convex = useConvex();
  const logAuto = useMutation(api.sentry.logAutomation);

  // ── State ────────────────────────────────────────────────────────────
  const [msgType, setMsgType] = useState<AutomationMessageType>('custom');
  const [channel, setChannel] = useState<AutomationChannel>(() => {
    // Default to 'in-app' when the prefill recipient is a team member
    if (prefill?.recipientType === 'team') return 'in-app';
    const waAllowed = isGrowthOrAbove || isKompleteFirm;
    const preferred = prefill?.channel || (prefill?.tenantPhone ? 'whatsapp' : prefill?.tenantEmail ? 'email' : 'whatsapp');
    return (preferred === 'whatsapp' && !waAllowed) ? 'email' : preferred;
  });
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(() => {
    // Preselect by unitId (tenant) OR contactId (client) from the prefill
    if (prefill?.unitId) return [prefill.unitId];
    if (prefill?.contactId) return [prefill.contactId];
    return [];
  });
  const [showFinancials, setShowFinancials] = useState(false);
  // AI Drafting Assistant state
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [aiDraftPrompt, setAiDraftPrompt] = useState('');
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [countryCode, setCountryCode] = useState('+234');
  const [amount, setAmount] = useState(() => prefill?.rentAmount ? String(prefill.rentAmount) : '');
  const [customText, setCustomText] = useState('');
  const [isEdited, setIsEdited] = useState(false);
  const [serviceCharge, setServiceCharge] = useState('');
  const [legalFee, setLegalFee] = useState('');
  const [agencyFee, setAgencyFee] = useState('');
  const [cautionDeposit, setCautionDeposit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [step, setStep] = useState<'compose' | 'preview'>('compose');
  const [loading, setLoading] = useState(false);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientTab, setRecipientTab] = useState<RecipientType>(() => {
    // If the prefill specifies a recipientType (e.g. 'client' from a
    // contact-initiated message), use it directly.
    if (prefill?.recipientType) return prefill.recipientType;
    // Product-aware default:
    // - Pure legal (Vega) → 'client' (lawyers message their clients)
    // - Pure property (Atrium) → 'tenant' (property managers message residents)
    // - Komplete (unified) → 'client' by default (most law-firm comms go to clients)
    //   Users can switch to 'tenant' tab if they need to message residents.
    if (hasLegalFeatures && !hasPropertyFeatures) return 'client';
    if (hasLegalFeatures && hasPropertyFeatures) return 'client'; // Komplete defaults to clients
    return 'tenant'; // Pure property (Atrium)
  });
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [upcomingLogs, setUpcomingLogs] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Build selectable recipients using shared grouping hook ───────────
  const { groups: propertyGroups, flatUnits } = usePropertyGroups(coreState.properties || []);

  // Convert UnitOptions to SelectableRecipients (only those with tenants)
  const tenantRecipients = useMemo(() =>
    flatUnits.filter(u => u.tenantName).map(u => ({
      id: u.id,
      label: u.label,
      recipientType: 'tenant' as RecipientType,
      tenantName: u.tenantName,
      tenantPhone: u.tenantPhone,
      tenantEmail: u.tenantEmail,
      rentAmount: u.rentAmount,
      propertyAddress: u.address,
      propertyId: u.propertyId,  // ← needed for portal messaging thread resolution
      serviceCharge: u.serviceCharge,
      legalFee: u.legalFee,
      agencyFee: u.agencyFee,
      cautionDeposit: u.cautionDeposit,
    })),
    [flatUnits]
  );

  // Also include client contacts (for legal/unified firms) — allows
  // composing messages to clients, not just residents.
  const clientRecipients = useMemo(() =>
    (contacts || [])
      .filter((c: any) => c.email || c.phone)
      .map((c: any) => ({
        id: c.id || c._id,
        label: c.name || c.email || 'Client',
        recipientType: 'client' as RecipientType,
        tenantName: c.name,
        tenantPhone: c.phone,
        tenantEmail: c.email,
        rentAmount: 0,
        propertyAddress: '',
        serviceCharge: 0,
        legalFee: 0,
        agencyFee: 0,
        cautionDeposit: 0,
      })),
    [contacts]
  );

  // Team members as recipients (for internal communication)
  const teamRecipients = useMemo(() =>
    (coreState.users || [])
      .filter((u: any) => u.email)
      .map((u: any) => ({
        id: u.id || u._id,
        label: u.name || u.email,
        recipientType: 'team' as RecipientType,
        tenantName: u.name,
        tenantPhone: u.phone || '',
        tenantEmail: u.email,
        rentAmount: 0,
        propertyAddress: '',
        serviceCharge: 0,
        legalFee: 0,
        agencyFee: 0,
        cautionDeposit: 0,
      })),
    [coreState.users]
  );

  // Combine all recipient types
  const selectableRecipients = useMemo(() =>
    [...tenantRecipients, ...clientRecipients, ...teamRecipients],
    [tenantRecipients, clientRecipients, teamRecipients]
  );

  // Renamed from `tenantedRecipients` — that name was wrong because the array
  // contains ALL recipient types (clients + team + tenants), not just tenants.
  // The "Select All Tenanted" button was selecting lawyers' clients and team
  // members while claiming to select only tenants.
  const allRecipients = useMemo(() => selectableRecipients, [selectableRecipients]);

  // ── Collapsible group state ─────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (addressKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(addressKey)) next.delete(addressKey); else next.add(addressKey);
      return next;
    });
  };

  // Auto-expand groups that contain selected recipients
  useEffect(() => {
    if (selectedRecipientIds.length === 0) return;
    setExpandedGroups(prev => {
      const next = new Set(prev);
      for (const g of propertyGroups) {
        if (g.isMultiUnit && g.units.some(u => selectedRecipientIds.includes(u.id))) {
          next.add(g.addressKey);
        }
      }
      return next;
    });
  }, [selectedRecipientIds, propertyGroups]);

  // ── Selected recipients data ─────────────────────────────────────────
  const selectedRecipients = useMemo(() => 
    selectableRecipients.filter(r => selectedRecipientIds.includes(r.id)),
    [selectableRecipients, selectedRecipientIds]
  );

  const isMultiRecipient = selectedRecipients.length > 1;

  // Get the "primary" recipient for template building (first selected, or "General")
  const primaryRecipient = selectedRecipients[0];
  const effectiveTenantName = isMultiRecipient 
    ? 'Resident' 
    : (primaryRecipient?.tenantName || prefill?.tenantName || '');
  const effectiveUnitLabel = isMultiRecipient 
    ? 'All Residents' 
    : (primaryRecipient?.label || primaryRecipient?.propertyAddress || prefill?.unitName || 'General');

  // ── Auto-fill financials when a single recipient is selected ─────────
  useEffect(() => {
    if (selectedRecipients.length === 1) {
      const r = selectedRecipients[0];
      if (r.rentAmount) setAmount(r.rentAmount.toString());
      if (r.serviceCharge) setServiceCharge(r.serviceCharge.toString());
      if (r.legalFee) setLegalFee(r.legalFee.toString());
      if (r.agencyFee) setAgencyFee(r.agencyFee.toString());
      if (r.cautionDeposit) setCautionDeposit(r.cautionDeposit.toString());
    }
  }, [selectedRecipientIds]);

  // ── Auto-generate message template ───────────────────────────────────
  useEffect(() => {
    if (!isEdited) {
      const generated = buildMessage(
        msgType, 
        effectiveUnitLabel, 
        effectiveTenantName, 
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
  }, [msgType, effectiveUnitLabel, effectiveTenantName, amount, serviceCharge, legalFee, agencyFee, cautionDeposit, dueDate, isEdited, coreState.firmDetails?.automationSettings?.automationTemplates]);

  // ── AI Drafting Assistant ────────────────────────────────────────────
  const handleAiDraft = async () => {
    if (!aiDraftPrompt.trim() || isAiDrafting) return;
    setIsAiDrafting(true);
    try {
      // B2 FIX: use shared getGeminiApiKey() which reads from in-memory state
      // (set by AuthContext from server) instead of reading localStorage directly.
      const apiKey = getGeminiApiKey() || '';
      if (!apiKey) {
        addToast('AI key not configured. Set your Gemini API key in Settings.', { type: 'error' });
        setIsAiDrafting(false);
        return;
      }

      const context = [
        `Recipient: ${effectiveTenantName}`,
        effectiveUnitLabel ? `Unit: ${effectiveUnitLabel}` : '',
        amount ? `Rent: ₦${amount}` : '',
        serviceCharge ? `Service Charge: ₦${serviceCharge}` : '',
        dueDate ? `Due Date: ${dueDate}` : '',
        `Message Type: ${msgType}`,
        `Firm: ${coreState.firmDetails?.name || 'Management'}`,
      ].filter(Boolean).join('\n');

      const systemPrompt = `You are a professional property management assistant in Nigeria. Write a concise, direct, and highly professional message based on the user's instructions. No fluff, no emojis, no excessive pleasantries. Get straight to the point. Keep it under 150 words. Use Nigerian English spelling and Naira (₦) symbol where relevant.\n\nContext:\n${context}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiDraftPrompt.trim() }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const draft = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (draft) {
          setCustomText(draft);
          setIsEdited(true);
          setShowAiDraft(false);
          setAiDraftPrompt('');
          addToast('AI draft generated. Review and edit before sending.', { type: 'success' });
        } else {
          addToast('AI returned empty response. Try rephrasing.', { type: 'error' });
        }
      } else {
        addToast('AI request failed. Check your API key.', { type: 'error' });
      }
    } catch (e: any) {
      addToast(`AI draft error: ${e?.message || 'Failed'}`, { type: 'error' });
    } finally {
      setIsAiDrafting(false);
    }
  };

  // ── Close dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecipientDropdown(false);
        setRecipientSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Focus search input when dropdown opens ───────────────────────────
  useEffect(() => {
    if (showRecipientDropdown && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showRecipientDropdown]);

  // ── Load upcoming messages ───────────────────────────────────────────
  useEffect(() => {
    if (showUpcoming && firmId) {
      setUpcomingLoading(true);
      convex.query(api.sentry.getAutomationLogs, { firmId, limit: 10, userEmail: currentUser?.email })
        .then((logs: any[]) => {
          setUpcomingLogs(logs.filter((l: any) => l.status === 'simulated' || l.status === 'sent'));
          setUpcomingLoading(false);
        })
        .catch(() => setUpcomingLoading(false));
    }
  }, [showUpcoming, firmId]);

  // ── Toggle recipient selection ────────────────────────────────────────
  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Renamed from `selectAllTenanted` — selects ALL recipients (clients + team +
  // tenants), not just tenants. The "Select All Tenanted" label was misleading.
  const selectAll = () => {
    const allIds = allRecipients.map(r => r.id);
    const allSelected = allIds.every(id => selectedRecipientIds.includes(id));
    if (allSelected) {
      setSelectedRecipientIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedRecipientIds(prev => {
        const existing = prev.filter(id => !allIds.includes(id));
        return [...existing, ...allIds];
      });
    }
  };

  const removeRecipient = (id: string) => {
    setSelectedRecipientIds(prev => prev.filter(x => x !== id));
  };

  // ── Filtered recipients for dropdown (filtered by tab + search) ─────
  const filteredRecipients = useMemo(() => {
    let result = selectableRecipients.filter(r => r.recipientType === recipientTab);
    if (recipientSearch) {
      const lower = recipientSearch.toLowerCase();
      result = result.filter(r =>
        r.label.toLowerCase().includes(lower) ||
        (r.tenantName && r.tenantName.toLowerCase().includes(lower)) ||
        (r.propertyAddress && r.propertyAddress.toLowerCase().includes(lower))
      );
    }
    return result;
  }, [selectableRecipients, recipientSearch, recipientTab]);

  // Count recipients per tab for the tab labels
  const recipientCounts = useMemo(() => ({
    tenant: tenantRecipients.length,
    client: clientRecipients.length,
    team: teamRecipients.length,
  }), [tenantRecipients, clientRecipients, teamRecipients]);

  // ── Build per-recipient messages for preview ─────────────────────────
  const previewMessages = useMemo(() => {
    if (selectedRecipients.length === 0) return [];
    return selectedRecipients.map(r => {
      const name = r.tenantName || 'Resident';
      const label = r.label || r.propertyAddress || 'General';
      const msg = buildMessage(
        msgType,
        label,
        name,
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
      return { recipient: r, message: msg };
    });
  }, [selectedRecipients, msgType, amount, serviceCharge, legalFee, agencyFee, cautionDeposit, dueDate, coreState.firmDetails?.automationSettings?.automationTemplates]);

  // ── Send handler ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (selectedRecipients.length === 0) return;
    if (channel === 'whatsapp' && !isGrowthOrAbove && !isKompleteFirm) {
      onToast('WhatsApp requires Growth plan or above. Upgrade to unlock this channel.');
      return;
    }
    setLoading(true);

    try {
      let successCount = 0;
      let failCount = 0;
      let simulatedCount = 0;

      for (const r of selectedRecipients) {
        if (channel === 'in-app' || channel === 'portal') {
          // In-app and Portal don't need phone/email, just a valid recipient ID
          if (!r.id) {
            failCount++;
            continue;
          }
        } else {
          const recipient = channel === 'email'
            ? (r.tenantEmail || r.email || '')
            : (r.tenantPhone || r.phone || '');

          if (!recipient) {
            // FIX: Show a toast for empty recipient instead of silently skipping.
            // Previously, the send silently failed with no user feedback.
            showToast(`No ${channel === 'email' ? 'email' : 'phone number'} for ${r.tenantName || r.name || 'recipient'}. Skipped.`, 'error');
            failCount++;
            continue;
          }
        }

        const finalRecipient = channel === 'in-app'
          ? (r.id || '')
          : channel === 'portal'
            ? (r.id || '')
            : channel === 'email'
              ? (r.tenantEmail || r.email || '')
              : `${countryCode}${(r.tenantPhone || r.phone || '').replace(/^0+/, '')}`;

        // Build personalized message for this recipient
        const name = r.tenantName || 'Resident';
        const label = r.label || r.propertyAddress || 'General';
        const personalizedMessage = buildMessage(
          msgType,
          label,
          name,
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

        let sendResult: { success: boolean; simulated?: boolean; error?: string } = { success: true, simulated: true };

        try {
          if (channel === 'in-app') {
            // Send in-app message to team member via chatMessages/chatConversations.
            // This creates a direct message conversation between the sender and
            // the recipient, and saves the message content + sends a notification.
            try {
              const cid = uuidv4();
              await actions.addItem('chatConversations', {
                id: cid,
                type: 'direct',
                memberIds: [currentUser?.id || '', r.id],
                name: 'Direct Message',
                matterId: null,
                createdAt: new Date().toISOString(),
                hiddenForUserIds: [],
                firmId,
              }, 'Conversation');
              await actions.addItem('chatMessages', {
                conversationId: cid,
                content: personalizedMessage,
                authorId: currentUser?.id || '',
                timestamp: new Date().toISOString(),
                firmId,
                isDeleted: false,
                status: 'sent',
              }, 'Chat Message');
              // Send notification to the recipient
              await actions.addItem('notifications', {
                userId: r._id || r.id,
                title: 'New Message',
                message: `${currentUser?.name || 'A colleague'} sent you a message.`,
                type: 'message',
                isRead: false,
                createdAt: new Date().toISOString(),
                link: { view: 'messaging', id: cid, context: { activeConversationId: cid } },
                firmId,
              }, 'Notification');
              sendResult = { success: true, simulated: false };
            } catch (inAppErr: any) {
              sendResult = { success: false, error: inAppErr.message };
            }
          } else if (channel === 'portal') {
            // Send message to tenant's portal inbox.
            // MESSAGING SYNC FIX: Pass propertyId alongside unitId so the
            // backend's getOrCreateConversation can correctly resolve the
            // resident's conversation thread. Previously only unitId was
            // passed, which could cause duplicate threads if the participantId
            // lookup via unit.tenantEmail failed.
            try {
              await convex.mutation(api.portals.sendPortalMessage, {
                firmId,
                senderId: currentUser?.id || '',
                senderName: currentUser?.name || 'Property Manager',
                senderRole: 'admin',
                subject: getMsgTypeLabel(msgType),
                content: personalizedMessage,
                propertyId: r.propertyId || undefined,
                unitId: r.id || undefined,
              });
              sendResult = { success: true, simulated: false };
            } catch (portalErr: any) {
              sendResult = { success: false, error: portalErr.message };
            }
          } else if (channel === 'whatsapp') {
            sendResult = await convex.action(api.communications.sendWhatsApp, {
              to: finalRecipient,
              messageText: personalizedMessage,
              firmId,
            });
          } else if (channel === 'email') {
            sendResult = await convex.action(api.communications.sendEmail, {
              to: finalRecipient,
              subject: `${getMsgTypeLabel(msgType)} — ${coreState.firmDetails?.name || 'Atrium OS'}`,
              htmlContent: `<p style="font-family:sans-serif;line-height:1.6">${personalizedMessage.replace(/\n/g, '<br/>')}</p>`,
              firmId,
            });
          }

          const status = sendResult.simulated ? 'simulated' : sendResult.success ? 'sent' : 'failed';
          await logAuto({ 
            firmId, 
            userEmail: currentUser?.email,
            unitId: r.id || undefined, 
            messageType: msgType as any, 
            channel, 
            recipient: finalRecipient, 
            messagePreview: personalizedMessage.substring(0, 200), 
            messageContent: personalizedMessage,
            direction: 'outbound' as const,
            senderName: currentUser?.name || 'Property Manager',
            status, 
            triggeredBy: currentUser?.id 
          });

          if (sendResult.success) {
            if (sendResult.simulated) {
              simulatedCount++;
            } else {
              successCount++;
            }
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      // Summary toast
      const totalSent = successCount + simulatedCount;
      if (failCount === 0) {
        if (simulatedCount > 0) {
          onToast(`${totalSent} message(s) logged (channel not configured). ${simulatedCount} simulated.`);
        } else {
          onToast(`${successCount} message(s) delivered successfully!`);
        }
      } else {
        onToast(`${totalSent} sent, ${failCount} failed. Check logs for details.`);
      }
      onClose();
    } catch (e: any) {
      console.error("Error during send:", e);
      onToast(translateError(e, "send message"));
    } finally { 
      setLoading(false); 
    }
  };

  // ── Recipient chip component ─────────────────────────────────────────
  const RecipientChip: React.FC<{ recipient: SelectableRecipient }> = ({ recipient }) => (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/40 text-xs text-primary-700 dark:text-primary-300 font-medium max-w-[200px]">
      <span className="truncate">{recipient.label}</span>
      <button
        onClick={(e) => { e.stopPropagation(); removeRecipient(recipient.id); }}
        className="ml-0.5 text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 flex-shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );

  // ── Esc key handler ─────────────────────────────────────────────────
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92dvh] text-slate-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">Compose Message</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Preview before sending — all sends are logged</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-xl leading-none p-1" aria-label="Close">×</button>
        </div>

        {step === 'compose' ? (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* ── Row 1: Message Type + Channel ──────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider font-bold">Message Type</label>
                <select value={msgType} onChange={e => { setMsgType(e.target.value as AutomationMessageType); setIsEdited(false); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-400">
                  <optgroup label="Standard" className="bg-white dark:bg-zinc-900">
                    {Object.entries(MSG_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </optgroup>
                  {Object.keys(coreState.firmDetails?.automationSettings?.automationTemplates || {}).filter(k => !MSG_TYPE_LABELS[k as AutomationMessageType]).length > 0 && (
                    <optgroup label="Custom Templates" className="bg-white dark:bg-zinc-900">
                      {Object.keys(coreState.firmDetails?.automationSettings?.automationTemplates || {}).filter(k => !MSG_TYPE_LABELS[k as AutomationMessageType]).map(k => (
                        <option key={k} value={k}>{getMsgTypeLabel(k)}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider font-bold">Channel</label>
                <div className="flex gap-1.5">
                  {(['in-app', 'whatsapp', 'email', 'portal'] as AutomationChannel[]).map(ch => {
                    // 'in-app' is only for team recipients
                    if (ch === 'in-app' && recipientTab !== 'team') return null;
                    // 'portal' is only for client/tenant recipients, not team
                    if (ch === 'portal' && recipientTab === 'team') return null;
                    const waAllowed = ch !== 'whatsapp' || (isGrowthOrAbove || isKompleteFirm);

                    // CHANNEL AVAILABILITY — gray out WhatsApp/Email when the
                    // recipient doesn't have a phone number / email saved.
                    // User feedback: "if you don't have the person's phone
                    // number, let WhatsApp be grayed out. If you don't have
                    // the email, let the email be grayed out. When the user
                    // hovers over it, say 'no email saved, edit contact to
                    // add an email to send an email'."
                    const r = selectedRecipients[0] as any;
                    const hasPhone = !!(r?.tenantPhone || r?.phone);
                    const hasEmail = !!(r?.tenantEmail || r?.email);
                    let channelDisabled = !waAllowed;
                    let disabledReason = '';
                    if (ch === 'whatsapp' && !hasPhone && recipientTab !== 'team') {
                      channelDisabled = true;
                      disabledReason = 'No phone number saved. Edit the contact to add a phone number to send a WhatsApp message.';
                    } else if (ch === 'email' && !hasEmail && recipientTab !== 'team') {
                      channelDisabled = true;
                      disabledReason = 'No email saved. Edit the contact to add an email to send an email message.';
                    } else if (!waAllowed) {
                      disabledReason = 'WhatsApp requires Growth plan or above';
                    }

                    return (
                      <button
                        key={ch}
                        onClick={() => !channelDisabled && setChannel(ch)}
                        disabled={channelDisabled}
                        title={disabledReason || undefined}
                        className={`relative flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          channelDisabled
                            ? 'bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                            : channel === ch
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {ch === 'in-app' ? 'In-App' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'Portal'}
                        {channelDisabled && <Lock className="w-2.5 h-2.5 absolute top-1 right-1 text-slate-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Recipients (multi-select chip input) ────────────────── */}
            <div ref={dropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-bold">
                  Recipients {selectedRecipients.length > 0 && <span className="text-primary-600 dark:text-primary-400">({selectedRecipients.length})</span>}
                </label>
                {allRecipients.length > 1 && (
                  <button
                    onClick={selectAll}
                    className="text-2xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                  >
                    {allRecipients.every(r => selectedRecipientIds.includes(r.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Chip area + search input */}
              <div 
                className="min-h-[42px] bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-primary-500/30"
                onClick={() => setShowRecipientDropdown(true)}
              >
                {selectedRecipients.map(r => (
                  <RecipientChip key={r.id} recipient={r} />
                ))}
                <input
                  ref={searchInputRef}
                  value={recipientSearch}
                  onChange={e => { setRecipientSearch(e.target.value); setShowRecipientDropdown(true); }}
                  placeholder={selectedRecipients.length === 0
                    ? (hasLegalFeatures && !hasPropertyFeatures
                        ? 'Search clients…'
                        : hasLegalFeatures && hasPropertyFeatures
                          ? 'Search clients, residents, or team…'
                          : 'Search units or residents…')
                    : 'Add more…'}
                  className="flex-1 min-w-[100px] bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 py-1"
                />
              </div>

              {/* Dropdown list — with recipient type tabs */}
              {showRecipientDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 rounded-lg shadow-2xl max-h-80 overflow-hidden flex flex-col">
                  {/* Recipient type tabs — product-aware.
                      Pure legal (Vega): hide Residents tab entirely.
                      Pure property (Atrium): hide Clients tab entirely.
                      Komplete: show all three. */}
                  <div className="flex border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
                    {([
                      { key: 'tenant' as RecipientType, label: 'Residents', count: recipientCounts.tenant, show: hasPropertyFeatures },
                      { key: 'client' as RecipientType, label: 'Clients', count: recipientCounts.client, show: hasLegalFeatures },
                      { key: 'team' as RecipientType, label: 'Team', count: recipientCounts.team, show: true },
                    ]).filter(t => t.show && (t.count > 0 || t.key === 'tenant' && hasPropertyFeatures && !hasLegalFeatures)).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setRecipientTab(tab.key)}
                        className={`flex-1 px-2 py-2 text-2xs font-bold uppercase tracking-wider transition-colors ${
                          recipientTab === tab.key
                            ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                            : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && <span className="ml-1 opacity-50">({tab.count})</span>}
                      </button>
                    ))}
                  </div>

                  {/* Recipient list */}
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    {filteredRecipients.length === 0 && (
                      <div className="px-3 py-4 text-xs text-slate-400 dark:text-zinc-500 text-center">
                        {recipientTab === 'tenant'
                          ? 'No residents found. Add residents and contact info to your units.'
                          : recipientTab === 'client'
                            ? 'No clients with contact info found. Add clients in your Contacts directory.'
                            : 'No team members found. Invite team members in Settings.'}
                      </div>
                    )}
                  {(() => {
                    // Build grouped list from filtered recipients
                    const filteredSet = new Set(filteredRecipients.map(r => r.id));

                    return propertyGroups
                      .filter(g => g.units.some(u => u.tenantName && filteredSet.has(u.id)))
                      .map(g => {
                        const groupUnits = g.units.filter(u => u.tenantName && filteredSet.has(u.id));
                        if (groupUnits.length === 0) return null;

                        // Single-unit building — show as flat item (no group header needed)
                        if (!g.isMultiUnit) {
                          const u = groupUnits[0];
                          const r = selectableRecipients.find(sr => sr.id === u.id);
                          if (!r) return null;
                          return (
                            <button
                              key={r.id}
                              onClick={() => { toggleRecipient(r.id); setRecipientSearch(''); }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors flex items-center gap-2 ${
                                selectedRecipientIds.includes(r.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                                selectedRecipientIds.includes(r.id) 
                                  ? 'bg-primary-600 border-primary-600' 
                                  : 'border-slate-300 dark:border-zinc-600'
                              }`}>
                                {selectedRecipientIds.includes(r.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-slate-900 dark:text-white truncate">{r.label}</div>
                                {r.tenantPhone && <span className="text-2xs text-slate-400 dark:text-zinc-500 truncate block">{r.tenantPhone}</span>}
                              </div>
                            </button>
                          );
                        }

                        // Multi-unit building — show collapsible group
                        const isExpanded = expandedGroups.has(g.addressKey);
                        const allGroupIds = groupUnits.map(u => u.id);
                        const allSelected = allGroupIds.every(id => selectedRecipientIds.includes(id));
                        const someSelected = allGroupIds.some(id => selectedRecipientIds.includes(id));

                        return (
                          <div key={g.addressKey}>
                            {/* Group header — clickable to expand/collapse, with select-all checkbox */}
                            <button
                              onClick={() => {
                                if (!isExpanded) toggleGroup(g.addressKey);
                                else toggleGroup(g.addressKey);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-700/40 transition-colors flex items-center gap-2 border-b border-slate-100 dark:border-zinc-700/50"
                            >
                              <span
                                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center cursor-pointer ${
                                  allSelected
                                    ? 'bg-primary-600 border-primary-600'
                                    : someSelected
                                    ? 'bg-primary-400 border-primary-500'
                                    : 'border-slate-300 dark:border-zinc-600'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (allSelected) {
                                    setSelectedRecipientIds(prev => prev.filter(id => !allGroupIds.includes(id)));
                                  } else {
                                    setSelectedRecipientIds(prev => {
                                      const existing = prev.filter(id => !allGroupIds.includes(id));
                                      return [...existing, ...allGroupIds];
                                    });
                                  }
                                }}
                              >
                                {(allSelected || someSelected) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate block">{g.shortAddress}</span>
                                <span className="text-2xs text-slate-400 dark:text-zinc-500">{g.unitCount} unit{g.unitCount !== 1 ? 's' : ''}</span>
                              </div>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                            </button>

                            {/* Expanded units */}
                            {isExpanded && groupUnits.map(u => {
                              const r = selectableRecipients.find(sr => sr.id === u.id);
                              if (!r) return null;
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => { toggleRecipient(r.id); setRecipientSearch(''); }}
                                  className={`w-full text-left pl-9 pr-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors flex items-center gap-2 ${
                                    selectedRecipientIds.includes(r.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                                  }`}
                                >
                                  <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                                    selectedRecipientIds.includes(r.id) 
                                      ? 'bg-primary-600 border-primary-600' 
                                      : 'border-slate-300 dark:border-zinc-600'
                                  }`}>
                                    {selectedRecipientIds.includes(r.id) && (
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-slate-900 dark:text-white truncate text-xs">{r.label}</div>
                                    {r.tenantPhone && <span className="text-2xs text-slate-400 dark:text-zinc-500 truncate block">{r.tenantPhone}</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      });
                  })()}

                  {/* For non-tenant tabs (clients, team), render a flat list */}
                  {recipientTab !== 'tenant' && filteredRecipients.length > 0 && (
                    <>
                      {filteredRecipients.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { toggleRecipient(r.id); setRecipientSearch(''); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors flex items-center gap-2 ${
                            selectedRecipientIds.includes(r.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                            selectedRecipientIds.includes(r.id) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-600'
                          }`}>
                            {selectedRecipientIds.includes(r.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-800 dark:text-zinc-200 truncate">{r.tenantName || r.label}</p>
                            <p className="text-2xs text-slate-400 truncate">
                              {r.tenantEmail || r.tenantPhone || 'No contact info'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  </div>
                </div>
              )}

              {isMultiRecipient && (
                <p className="text-2xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <Radio className="w-3 h-3" /> Bulk send: each recipient gets a personalized message
                </p>
              )}
            </div>

            {/* ── Financial Details (collapsible) ────────────────────── */}
            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFinancials(!showFinancials)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium">
                  <Receipt className="w-3.5 h-3.5" />
                  {showFinancials ? 'Hide' : 'Show'} Financial Details
                </span>
                {showFinancials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showFinancials && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Rent Amount (₦)</label>
                    <input type="text" value={formatNumberWithCommas(amount)} onChange={e => setAmount(parseFormattedNumber(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Service Charge (₦)</label>
                    <input type="text" value={formatNumberWithCommas(serviceCharge)} onChange={e => setServiceCharge(parseFormattedNumber(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Caution Deposit (₦)</label>
                    <input type="text" value={formatNumberWithCommas(cautionDeposit)} onChange={e => setCautionDeposit(parseFormattedNumber(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Legal Fee (₦)</label>
                    <input type="text" value={formatNumberWithCommas(legalFee)} onChange={e => setLegalFee(parseFormattedNumber(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Agency Fee (₦)</label>
                    <input type="text" value={formatNumberWithCommas(agencyFee)} onChange={e => setAgencyFee(parseFormattedNumber(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Message Content ────────────────────────────────────── */}
            <div className="pt-2 border-t border-slate-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-bold">Message Content</label>
                <div className="flex items-center gap-2">
                  {/* AI Drafting Assistant */}
                  {showAiDraft ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={aiDraftPrompt}
                        onChange={e => setAiDraftPrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && aiDraftPrompt.trim()) handleAiDraft(); if (e.key === 'Escape') setShowAiDraft(false); }}
                        placeholder="What do you want your message to say?"
                        className="text-xs px-2 py-1 bg-white dark:bg-zinc-800 border border-violet-300 dark:border-violet-700 rounded-lg text-slate-700 dark:text-zinc-200 w-48 sm:w-64 focus:ring-1 focus:ring-violet-400"
                        autoFocus
                      />
                      <button
                        onClick={handleAiDraft}
                        disabled={!aiDraftPrompt.trim() || isAiDrafting}
                        className="text-2xs uppercase font-bold tracking-wider px-2 py-1 bg-violet-600 text-white rounded transition-colors hover:bg-violet-500 disabled:opacity-50"
                      >
                        {isAiDrafting ? '...' : 'Draft'}
                      </button>
                      <button onClick={() => { setShowAiDraft(false); setAiDraftPrompt(''); }} className="text-slate-400 hover:text-rose-500 px-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAiDraft(true)}
                      className="text-2xs uppercase font-bold tracking-wider px-2 py-1 rounded transition-colors text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 flex items-center gap-1"
                      title="AI Drafting Assistant"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
                      AI Draft
                    </button>
                  )}
                  <button
                    onClick={() => setIsEdited(false)}
                    className={`text-2xs uppercase font-bold tracking-wider px-2 py-1 rounded transition-colors ${isEdited ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40' : 'text-slate-400 dark:text-zinc-600 opacity-50 cursor-not-allowed'}`}
                    disabled={!isEdited}
                  >
                    Reset Template
                  </button>
                </div>
              </div>
              <textarea 
                value={customText} 
                onChange={e => { setCustomText(e.target.value); setIsEdited(true); }} 
                rows={7}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-3 text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 placeholder:text-slate-400 leading-relaxed resize-none"
                placeholder="Type your message here..."
              />
            </div>

            {/* ── Action Buttons ──────────────────────────────────────── */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Cancel</button>
              <button 
                onClick={() => setStep('preview')} 
                disabled={selectedRecipients.length === 0} 
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <EyeIcon /> Preview {isMultiRecipient ? `(${selectedRecipients.length})` : ''}
              </button>
            </div>

            {/* ── Upcoming Messages Panel ─────────────────────────────── */}
            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowUpcoming(!showUpcoming)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Upcoming Messages
                </span>
                {showUpcoming ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showUpcoming && (
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span className="text-2xs text-amber-600 dark:text-amber-400">Recent automated messages</span>
                  </div>
                  {upcomingLoading ? (
                    <div className="text-xs text-slate-400 dark:text-zinc-500 py-2 text-center">Loading…</div>
                  ) : upcomingLogs.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-zinc-600 py-2 text-center">No recent messages found</div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                      {upcomingLogs.map((log: any) => (
                        <div key={log._id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/50">
                          <span className="text-slate-400 dark:text-zinc-500">{getMsgTypeIcon(log.messageType)}</span>
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${CHANNEL_COLORS[log.channel as AutomationChannel]}`}>
                            {log.channel?.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-900 dark:text-white truncate flex-1">{getMsgTypeLabel(log.messageType)}</span>
                          <span className="text-2xs text-slate-400 dark:text-zinc-500 flex-shrink-0">
                            {log.sentAt ? new Date(log.sentAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          <span className={`text-2xs px-1.5 py-0.5 rounded-full font-bold ${
                            log.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : log.status === 'simulated' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Preview Step ────────────────────────────────────────────── */
          <div className="p-4 sm:p-5 overflow-y-auto flex-1">
            {/* Recipients summary for multi-send */}
            {isMultiRecipient && (
              <div className="mb-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Sending to {selectedRecipients.length} recipients</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="text-2xs px-2 py-0.5 rounded-md bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 truncate max-w-[160px]">
                      {r.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Message preview(s) */}
            {!isMultiRecipient ? (
              /* Single recipient — show full message */
              <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{MSG_TYPE_ICONS[msgType]}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[channel]}`}>{channel.toUpperCase()}</span>
                  {primaryRecipient && <span className="text-xs text-slate-500 dark:text-zinc-400">→ {primaryRecipient.tenantPhone || primaryRecipient.tenantEmail || primaryRecipient.label}</span>}
                </div>
                <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{customText}</p>
              </div>
            ) : (
              /* Multiple recipients — show first full + count */
              <div className="space-y-2 mb-4">
                {previewMessages.slice(0, 3).map((pm, i) => (
                  <div key={pm.recipient.id} className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[channel]}`}>{channel.toUpperCase()}</span>
                      <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">{pm.recipient.label}</span>
                      {pm.recipient.tenantPhone && <span className="text-2xs text-slate-400 dark:text-zinc-500">→ {pm.recipient.tenantPhone}</span>}
                      {pm.recipient.tenantEmail && !pm.recipient.tenantPhone && <span className="text-2xs text-slate-400 dark:text-zinc-500">→ {pm.recipient.tenantEmail}</span>}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap line-clamp-4">{pm.message}</p>
                  </div>
                ))}
                {previewMessages.length > 3 && (
                  <div className="text-xs text-slate-400 dark:text-zinc-500 text-center py-1">
                    + {previewMessages.length - 3} more personalized messages
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 flex items-center gap-1.5">
              <ZapIcon className="w-3 h-3" /> Review message carefully before sending. Logs are always recorded.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep('compose')} className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">← Edit</button>
              <button onClick={handleSend} disabled={loading} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <SendIcon /> {loading ? 'Sending…' : `Confirm & Send${isMultiRecipient ? ` (${selectedRecipients.length})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
