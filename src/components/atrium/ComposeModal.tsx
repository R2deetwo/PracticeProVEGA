import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { useMutation, useConvex, useQuery } from 'convex/react';
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
import { resolveFinancials, parseMoneyInput } from '../../utils/messageFinancials';
import { sendWhatsAppWithTemplateFallback, isWhatsAppWindowError, summarizeError, resolveTemplateFor, FirmTemplateMapping } from '../../utils/deliveryErrors';
import { buildEmailHtml } from '../../utils/emailTemplate';
import { MSG_TYPE_LABELS, getMsgTypeLabel, MSG_TYPE_FINANCE, getTypeFinance } from '../../utils/messageTypes';
import type { FinanceField } from '../../utils/messageTypes';
import { buildMessage } from '../../utils/messageTemplates';
// Re-export for existing callers (AutomationCenter imports buildMessage from here).
export { buildMessage } from '../../utils/messageTemplates';
import { PenLine, Calendar, AlertTriangle, Receipt, Zap, Lock, Wallet, ClipboardList, Users, Gift, Wrench, Megaphone, FileText, ChevronDown, ChevronUp, X, Clock, Radio, Building2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

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
const MSG_TYPE_ICONS: Record<string, React.ReactNode> = {
  custom: <PenLine className="w-3.5 h-3.5" />, rent_reminder: <Calendar className="w-3.5 h-3.5" />, late_notice: <AlertTriangle className="w-3.5 h-3.5" />, payment_receipt: <Receipt className="w-3.5 h-3.5" />,
  service_charge_alert: <Zap className="w-3.5 h-3.5" />, access_restriction: <Lock className="w-3.5 h-3.5" />, penalty_notice: <Wallet className="w-3.5 h-3.5" />, lease_renewal: <ClipboardList className="w-3.5 h-3.5" />,
  welcome_note: <Users className="w-3.5 h-3.5" />, promotion: <Gift className="w-3.5 h-3.5" />, vendor_update: <Wrench className="w-3.5 h-3.5" />, general_announcement: <Megaphone className="w-3.5 h-3.5" />, maintenance_update: <Wrench className="w-3.5 h-3.5" />
};
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

export interface ComposeModalPrefill {
  unitId?: string;
  unitName?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  rentAmount?: number;
  propertyAddress?: string;
  channel?: AutomationChannel;
  // MESSAGES OVERHAUL: callers that already KNOW why they're messaging
  // (e.g. ServiceChargeMonitor's per-charge WhatsApp button) can preselect
  // the message type so the user lands on a ready-to-review template
  // instead of starting from "Custom Message".
  messageType?: AutomationMessageType;
  // Contact-initiated messaging — when a user clicks "Message" on a
  // contact in ContactDetailView, these fields are set so the compose
  // modal opens with the contact pre-selected.
  contactId?: string;
  contactName?: string;
  recipientType?: RecipientType;
}

// ── Selectable Recipient type ────────────────────────────────────────────
type RecipientType = 'tenant' | 'client' | 'team' | 'external';

/** Per-recipient send outcome shown in the result panel. */
interface SendResultRow {
  id: string;
  name: string;
  contact: string;            // phone / email / portal target
  channel: AutomationChannel;
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
  usedTemplate?: boolean;
}

interface SelectableRecipient {
  id: string;
  label: string;
  recipientType: RecipientType;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  rentAmount?: number;
  propertyAddress?: string;
  propertyId?: string;
  serviceCharge?: number;
  legalFee?: number;
  agencyFee?: number;
  cautionDeposit?: number;
  /** Existing resident (tenancy commenced) — move-in fees excluded from
   *  demands unless typed manually. Set from UnitOption.isExistingTenant. */
  isExistingTenant?: boolean;
}

export const ComposeModal: React.FC<{ firmId: string; onClose: () => void; onToast: (m: string) => void; prefill?: ComposeModalPrefill }> = ({ firmId, onClose, onToast, prefill }) => {
  const actions = useDataActions();
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const contacts = (matterState as any).contacts || (coreState as any).contacts || [];
  const { currentUser, bearerToken } = useAuth();
  const { isGrowthOrAbove, isKompleteFirm } = useFeatures();
  // Product-aware flags. Previously this modal had NO product awareness at all
  // — it always defaulted to the "Residents" tab and showed "Select All Tenanted"
  // even for legal-only firms. Now we know whether the firm has property features,
  // legal features, or both (Komplete).
  const { isProperty: isPropertyFirm, isLegal: isLegalFirm, isUnified, hasPropertyFeatures, hasLegalFeatures } = useProduct();
  const convex = useConvex();
  const logAuto = useMutation(api.sentry.logAutomation);

  // ── Firm's CONFIGURED WhatsApp template mappings (Settings →
  // Communications → WhatsApp Templates). These are the firm's REAL
  // Meta-registered templates — names, languages and variable orders
  // pulled from Meta itself, not app-side guesses. Used by the automatic
  // template retry when a free-form send hits the 24h window error.
  const templateMappings = useQuery(
    api.whatsappTemplates.getWhatsAppTemplateMappings,
    currentUser?.email && bearerToken
      ? { sessionToken: bearerToken, userEmail: currentUser.email }
      : 'skip'
  ) as FirmTemplateMapping[] | undefined;

  // ── State ────────────────────────────────────────────────────────────
  const [msgType, setMsgType] = useState<AutomationMessageType>(() => prefill?.messageType || 'custom');
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
  // AUTO-FILL HINT (user feedback 2026-09-08): tracks whether the financial
  // fields were populated from the selected resident's record, so the UI
  // can tell the user where the figures came from and that they can edit.
  const [autoFilledFrom, setAutoFilledFrom] = useState<string | null>(null);
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
  const [step, setStep] = useState<'compose' | 'preview' | 'result'>('compose');
  const [loading, setLoading] = useState(false);
  // ── Send results (per-recipient) for the result panel ───────────────
  // Previously the send loop only counted successes/failures and the
  // provider's error text was DISCARDED — the user saw "0 sent, 1 failed"
  // with no reason anywhere. Each recipient's outcome + reason is now
  // kept so the result panel can show exactly what happened and offer a
  // targeted retry of only the failures.
  const [sendResults, setSendResults] = useState<SendResultRow[]>([]);
  const [retrying, setRetrying] = useState(false);
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
      isExistingTenant: u.isExistingTenant,
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

  // ── Type-driven financials ───────────────────────────────────────────
  // USER FEEDBACK (2026-09-08): "I'm talking about the service charge but
  // it adds up figures it ought not to have added... there should be a
  // better and more simplified system so as to reduce confusion."
  // The selected message type now drives BOTH which financial fields are
  // shown (a Service Charge Alert shows Service Charge + Due Date only;
  // free-form types hide the section entirely) and which figures the
  // message's "Total Payable" may sum (see MSG_TYPE_FINANCE).
  const typeFinance = getTypeFinance(msgType);
  const showFinanceField = (f: FinanceField) => typeFinance.fields.includes(f);

  const fieldValue = (f: FinanceField): string =>
    f === 'amount' ? amount
    : f === 'serviceCharge' ? serviceCharge
    : f === 'cautionDeposit' ? cautionDeposit
    : f === 'legalFee' ? legalFee
    : f === 'agencyFee' ? agencyFee
    : dueDate;

  const setFieldByFinance = (f: FinanceField, v: string) => {
    if (f === 'amount') setAmount(v);
    else if (f === 'serviceCharge') setServiceCharge(v);
    else if (f === 'cautionDeposit') setCautionDeposit(v);
    else if (f === 'legalFee') setLegalFee(v);
    else if (f === 'agencyFee') setAgencyFee(v);
    else setDueDate(v);
  };

  // Fields the user has typed (or cleared) are theirs — auto-fill never
  // touches them again, for any type switch or data refetch.
  const userTouchedRef = useRef<Set<string>>(new Set());

  // Live preview of the total that will appear in the message. Uses the
  // SAME resolution order as the send path (manual override → the primary
  // recipient's own record) so what you see is what gets sent.
  const previewFigures = useMemo(() => {
    const manual = {
      amount: parseMoneyInput(amount),
      serviceCharge: parseMoneyInput(serviceCharge),
      legalFee: parseMoneyInput(legalFee),
      agencyFee: parseMoneyInput(agencyFee),
      cautionDeposit: parseMoneyInput(cautionDeposit),
    };
    return primaryRecipient
      ? resolveFinancials(manual, primaryRecipient as any)
      : {
          amount: manual.amount ?? 0,
          serviceCharge: manual.serviceCharge ?? 0,
          legalFee: manual.legalFee ?? 0,
          agencyFee: manual.agencyFee ?? 0,
          cautionDeposit: manual.cautionDeposit ?? 0,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, serviceCharge, legalFee, agencyFee, cautionDeposit, primaryRecipient?.id]);
  const totalPreview = typeFinance.total.reduce(
    (sum, f) => sum + ((previewFigures as Record<string, number>)[f] ?? 0), 0
  );

  // ── Auto-fill financials from the selected resident's record ─────────
  // USER FEEDBACK (2026-09-08): "when I selected late service charge for a
  // resident it still required me to fill in the information — the whole
  // idea is that it should use the correct info for the correct client
  // and fill it in." The auto-fill pulls the resident's TRACKED service
  // charge (outstanding balance + due date from the Service Charge
  // monitor rows — handles composite unit ids), OPENS the Financial
  // Details section so the figures are actually visible, and labels
  // where the numbers came from so the user knows they can edit.
  const findTrackedCharge = (unitId: string, propId?: string): any =>
    (coreState.serviceCharges || []).find((c: any) => {
      const cu = String(c.unitId ?? '');
      return cu === unitId || (propId && cu === propId) || unitId.endsWith(`_${cu}`) || cu.endsWith(`_${unitId}`);
    });

  // TYPE-AWARE + STOMP-SAFE: only fills the fields RELEVANT to the current
  // message type, only when they are EMPTY, and never ones the user has
  // touched. Because it only ever fills blanks, re-runs (Convex refetch,
  // type switch) are idempotent — they can't overwrite anything, so the
  // old coarse "bail if anything is non-empty" guard (which also blocked
  // legitimate fills after a type switch) is gone.
  useEffect(() => {
    if (selectedRecipients.length !== 1) {
      setAutoFilledFrom(null);
      return;
    }
    const r = selectedRecipients[0] as SelectableRecipient & { recipientType?: RecipientType };
    if ((r as any).recipientType !== 'tenant') {
      setAutoFilledFrom(null);
      return;
    }
    const fields = getTypeFinance(msgType).fields;
    if (fields.length === 0) return; // free-form type — no figures to fill

    const tracked = findTrackedCharge(r.id, (r as any).propertyId);
    const scTracked = tracked?.outstandingBalance ?? tracked?.amount ?? r.serviceCharge ?? 0;

    let filledAny = false;
    // MOVE-IN FEES FOR EXISTING RESIDENTS (user feedback 2026-09-11):
    // "an existing tenant with rent due only has to pay the rent. these
    // other fees are for new tenants only." Caution deposit and legal/
    // agency fees are one-time move-in charges — never auto-filled for a
    // resident whose tenancy has commenced, so their demands carry rent
    // (and service charge) only. A manager can still TYPE a figure to
    // deliberately demand an unpaid move-in fee.
    const isExisting = (r as any).isExistingTenant === true;
    for (const f of fields) {
      if (userTouchedRef.current.has(f)) continue; // user owns this field
      if (fieldValue(f)) continue;                  // already holds a figure
      if (isExisting && (f === 'cautionDeposit' || f === 'legalFee' || f === 'agencyFee')) continue;
      if (f === 'dueDate') {
        if (tracked?.nextDueDate) {
          setDueDate(new Date(tracked.nextDueDate).toISOString().slice(0, 10));
          filledAny = true;
        }
        continue;
      }
      const v = f === 'amount' ? (r as any).rentAmount : f === 'serviceCharge' ? scTracked : (r as any)[f];
      if (typeof v === 'number' && v > 0) {
        setFieldByFinance(f, String(v));
        filledAny = true;
      }
    }
    if (filledAny) {
      setShowFinancials(true);
      setAutoFilledFrom(r.tenantName || r.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecipientIds, msgType, coreState.serviceCharges]);


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
        // FIX (TS2304): addToast/showToast never existed in this scope —
        // ComposeModal's toast API is the onToast prop (single string arg).
        onToast('AI key not configured. Set your Gemini API key in Settings.');
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
          onToast('AI draft generated. Review and edit before sending.');
        } else {
          onToast('AI returned empty response. Try rephrasing.');
        }
      } else {
        onToast('AI request failed. Check your API key.');
      }
    } catch (e: any) {
      onToast(`AI draft error: ${e?.message || 'Failed'}`);
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
      convex.query(api.sentry.getAutomationLogs, { firmId, limit: 10, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) })
        .then((logs: any[]) => {
          // Includes FAILED rows (the old filter hid failures — the user could
          // never see what went wrong). All statuses shown with their reason.
          setUpcomingLogs(logs);
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
  // FINANCIAL FALLBACK (user feedback 2026-09-08): when the user didn't
  // type a figure, the RECIPIENT'S OWN unit data fills it — each resident
  // in a bulk send gets their own numbers instead of one shared set.
  const previewMessages = useMemo(() => {
    if (selectedRecipients.length === 0) return [];
    const manual = {
      amount: parseMoneyInput(amount),
      serviceCharge: parseMoneyInput(serviceCharge),
      legalFee: parseMoneyInput(legalFee),
      agencyFee: parseMoneyInput(agencyFee),
      cautionDeposit: parseMoneyInput(cautionDeposit),
    };
    return selectedRecipients.map(r => {
      const name = r.tenantName || 'Resident';
      const label = r.label || r.propertyAddress || 'General';
      const fin = resolveFinancials(manual, r as any);
      const msg = buildMessage(
        msgType,
        label,
        name,
        fin.amount,
        undefined,
        coreState.firmDetails?.automationSettings?.automationTemplates,
        {
          serviceCharge: fin.serviceCharge,
          legalFee: fin.legalFee,
          agencyFee: fin.agencyFee,
          cautionDeposit: fin.cautionDeposit,
          dueDate,
          firmName: coreState.firmDetails?.name || 'Management'
        }
      );
      return { recipient: r, message: msg };
    });
  }, [selectedRecipients, msgType, amount, serviceCharge, legalFee, agencyFee, cautionDeposit, dueDate, coreState.firmDetails?.automationSettings?.automationTemplates]);

  // ── Send handler ─────────────────────────────────────────────────────
  // REWORKED (2026-09-08) — "email service behaviour" per user feedback:
  //   • the provider's error text is CAPTURED per recipient (previously
  //     discarded — "0 sent, 1 failed" with no reason anywhere);
  //   • ALL-success → success toast + close (as before);
  //   • ANY failure → a result panel inside the modal lists every
  //     recipient's outcome + reason with a targeted "Retry failed"
  //     button — the modal no longer closes over silent failures, and
  //     the user can no longer blindly re-send to everyone;
  //   • email sends now carry the FIRM's name as the sender display name
  //     and the staff member's address as reply-to;
  //   • WhatsApp free-form sends that hit Meta's 24-hour customer-service
  //     window restriction auto-retry with the registered rent-reminder
  //     template when the message type has one.
  const handleSend = async (retryOnlyFailed = false) => {
    if (selectedRecipients.length === 0) return;
    if (channel === 'whatsapp' && !isGrowthOrAbove && !isKompleteFirm) {
      onToast('WhatsApp requires Growth plan or above. Upgrade to unlock this channel.');
      return;
    }
    setLoading(true);

    const targets = retryOnlyFailed
      ? selectedRecipients.filter(r => sendResults.find(sr => sr.id === r.id && sr.status === 'failed'))
      : selectedRecipients;
    if (targets.length === 0) { setLoading(false); return; }

    try {
      const results: SendResultRow[] = [];
      const firmName = coreState.firmDetails?.name || 'PracticePro';
      const manual = {
        amount: parseMoneyInput(amount),
        serviceCharge: parseMoneyInput(serviceCharge),
        legalFee: parseMoneyInput(legalFee),
        agencyFee: parseMoneyInput(agencyFee),
        cautionDeposit: parseMoneyInput(cautionDeposit),
      };

      for (const r of targets) {
        const resultRow: SendResultRow = {
          id: r.id,
          name: r.tenantName || r.label || 'Recipient',
          contact: '',
          channel,
          status: 'failed',
        };

        if (channel === 'in-app' || channel === 'portal') {
          // In-app and Portal don't need phone/email, just a valid recipient ID
          if (!r.id) {
            resultRow.error = 'Missing recipient id';
            results.push(resultRow);
            continue;
          }
          resultRow.contact = r.id;
        } else {
          const recipient = channel === 'email'
            ? (r.tenantEmail || r.email || '')
            : (r.tenantPhone || r.phone || '');

          if (!recipient) {
            resultRow.contact = '—';
            resultRow.error = `No ${channel === 'email' ? 'email address' : 'phone number'} saved for this recipient — update the contact record first.`;
            results.push(resultRow);
            continue;
          }
          resultRow.contact = recipient;
        }

        const finalRecipient = channel === 'in-app'
          ? (r.id || '')
          : channel === 'portal'
            ? (r.id || '')
            : channel === 'email'
              ? (r.tenantEmail || r.email || '')
              : `${countryCode}${(r.tenantPhone || r.phone || '').replace(/^0+/, '')}`;

        // Build personalized message for this recipient — with the
        // per-recipient financial fallback (their own unit figures when
        // the user didn't type an override).
        const name = r.tenantName || 'Resident';
        const label = r.label || r.propertyAddress || 'General';
        const fin = resolveFinancials(manual, r as any);
        const personalizedMessage = buildMessage(
          msgType,
          label,
          name,
          fin.amount,
          undefined,
          coreState.firmDetails?.automationSettings?.automationTemplates,
          {
            serviceCharge: fin.serviceCharge,
            legalFee: fin.legalFee,
            agencyFee: fin.agencyFee,
            cautionDeposit: fin.cautionDeposit,
            dueDate,
            firmName: coreState.firmDetails?.name || 'Management'
          }
        );

        let sendResult: { success: boolean; simulated?: boolean; error?: string; messageId?: string; usedTemplate?: boolean } = { success: false, error: 'No channel handler' };

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
            // Free-form send with the SERVER-SIDE template fallback: Meta
            // only delivers free-form messages within 24h of the
            // resident's last reply; business-initiated reminders need
            // an approved template. The server resolves the firm's
            // mapping, builds the variables and retries automatically —
            // one call, one quota charge, locale chain handled server-side.
            sendResult = await sendWhatsAppWithTemplateFallback(
              (fallbackArgs) => convex.action(api.communications.sendWhatsApp, {
                to: finalRecipient,
                messageText: personalizedMessage,
                firmId,
                ...(fallbackArgs.fallback ? { fallback: fallbackArgs.fallback } : {}),
              }),
              {
                messageType: msgType,
                recipient: { tenantName: name, amount: fin.amount, address: r.propertyAddress || label },
                firmMappings: templateMappings,
              }
            );
          } else if (channel === 'email') {
            sendResult = await convex.action(api.communications.sendEmail, {
              to: finalRecipient,
              toName: name,
              senderName: firmName,
              replyTo: currentUser?.email || undefined,
              subject: `${getMsgTypeLabel(msgType)} — ${firmName}`,
              htmlContent: buildEmailHtml({
                firmName,
                body: personalizedMessage,
                footerNote: 'This is an official notification from your property manager.',
              }),
              firmId,
            });
          }
        } catch (e: any) {
          sendResult = { success: false, error: e?.message || 'Send failed' };
        }

        const status: 'sent' | 'simulated' | 'failed' = sendResult.simulated ? 'simulated' : sendResult.success ? 'sent' : 'failed';
        resultRow.status = status;
        resultRow.error = status === 'failed' ? sendResult.error : undefined;
        resultRow.usedTemplate = sendResult.usedTemplate;
        results.push(resultRow);

        // LOG the send. Logging failures are isolated from the send
        // outcome — a logging error must never flip a delivered message
        // to "failed" (the pre-rework code did exactly that: an in-app
        // send succeeded, the log write threw, the toast said failed).
        try {
          await logAuto({
            firmId,
            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
            unitId: r.id || undefined,
            messageType: msgType as any,
            channel,
            recipient: finalRecipient,
            messagePreview: personalizedMessage.substring(0, 200),
            messageContent: personalizedMessage,
            direction: 'outbound' as const,
            senderName: currentUser?.name || 'Property Manager',
            status,
            errorMessage: status === 'failed' ? sendResult.error : undefined,
            messageId: sendResult.messageId,
            triggeredBy: currentUser?.id
          });
        } catch (logErr) {
          console.error('[ComposeModal] automation log write failed (send already completed):', logErr);
        }
      }

      // Merge retry results with the previous round (retries replace their rows)
      const merged = retryOnlyFailed
        ? [...sendResults.filter(sr => !results.find(nr => nr.id === sr.id)), ...results]
        : results;
      setSendResults(merged);

      const successCount = merged.filter(r => r.status === 'sent').length;
      const simulatedCount = merged.filter(r => r.status === 'simulated').length;
      const failCount = merged.filter(r => r.status === 'failed').length;
      const totalSent = successCount + simulatedCount;

      if (failCount === 0) {
        if (simulatedCount > 0) {
          onToast(`${totalSent} message(s) logged (channel not configured). ${simulatedCount} simulated.`);
        } else {
          onToast(`${successCount} message(s) delivered successfully — recorded in Messages → Sent.`);
        }
        onClose();
      } else {
        // Failures stay ON SCREEN with the reasons — no more silent closes.
        const firstError = merged.find(r => r.status === 'failed')?.error;
        onToast(`${totalSent} sent, ${failCount} failed — ${summarizeError(firstError, 90)}`);
        setStep('result');
      }
    } catch (e: any) {
      console.error("Error during send:", e);
      onToast(translateError(e, "send message"));
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = () => handleSend(true);

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
  // Render through a React portal to document.body.
  // REASON: this modal uses `fixed inset-0`, but any ancestor with a
  // retained CSS transform (e.g. `.animate-fade-in` with fill-mode
  // `forwards`, or DockedModal's `translate-x-0` panel) becomes the
  // containing block for fixed descendants — which clipped/offset this
  // modal and left the page un-dimmed behind it ("not rendering properly"
  // bug). Escaping to document.body guarantees viewport-true positioning
  // regardless of where the modal is mounted in the tree. Same pattern
  // as ComposeMessageModal.
  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92dvh] text-slate-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">New Message</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Send via WhatsApp, email, or in-app — every send is recorded in Messages → Sent. To reach everyone at once, post a Notice instead.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-xl leading-none p-1" aria-label="Close">×</button>
        </div>

        {step === 'compose' ? (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* ── Recipients (multi-select chip input) ────────────────── */}
            <div ref={dropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-bold">
                  To {selectedRecipients.length > 0 && <span className="text-primary-600 dark:text-primary-400">({selectedRecipients.length})</span>}
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

            {/* ── Message Type + Channel (after the To field) ──────────────────────── */}
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

            {/* ── Financial Details (type-driven) ──────────────────────
                Only the fields relevant to the selected message type are
                shown — a Service Charge Alert shows Service Charge + Due
                Date only; free-form types hide the section entirely.
                The live total preview states exactly what the message's
                "Total Payable" will sum, so no surprise figures. */}
            {typeFinance.fields.length > 0 && (
            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFinancials(!showFinancials)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium">
                  <Receipt className="w-3.5 h-3.5" />
                  {showFinancials ? 'Hide' : 'Show'} {msgType === 'payment_receipt' ? 'Payment' : 'Financial'} Details
                </span>
                {showFinancials ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showFinancials && (
                <div className="px-4 pb-3">
                  {/* Existing-resident note — explains why move-in fee fields
                      stay empty for a resident whose tenancy has commenced
                      (feedback 2026-09-11: existing tenants owe RENT only). */}
                  {selectedRecipients.length === 1
                    && (selectedRecipients[0] as any).recipientType === 'tenant'
                    && (selectedRecipients[0] as any).isExistingTenant === true
                    && (showFinanceField('cautionDeposit') || showFinanceField('legalFee') || showFinanceField('agencyFee')) && (
                    <p className="text-2xs text-emerald-700 dark:text-emerald-400 mb-2 leading-relaxed">
                      <span className="font-bold">Existing resident:</span> caution deposit &amp; legal/agency fees are
                      move-in charges and are <span className="font-bold">not included</span> — {effectiveTenantName || 'this resident'}&apos;s
                      tenancy has commenced. The demand totals rent{showFinanceField('serviceCharge') ? ' + service charge' : ''} only.
                      Type a figure above only if you are deliberately demanding an unpaid move-in fee.
                    </p>
                  )}
                  {/* Auto-fill provenance — tells the user the figures came
                      from the resident's own record (and can be edited). */}
                  {autoFilledFrom && (
                    <p className="text-2xs text-primary-600 dark:text-primary-400 mb-2 flex items-center gap-1">
                      <Receipt className="w-3 h-3" />
                      Auto-filled from {autoFilledFrom}'s record — edit any figure to override. Empty fields fall back to each resident's own numbers.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                  {showFinanceField('amount') && (
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">
                      {msgType === 'payment_receipt' ? 'Amount Received (₦)' : 'Rent Amount (₦)'}
                    </label>
                    <input type="text" value={formatNumberWithCommas(amount)} onChange={e => { userTouchedRef.current.add('amount'); setAmount(parseFormattedNumber(e.target.value)); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  )}
                  {showFinanceField('serviceCharge') && (
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Service Charge (₦)</label>
                    <input type="text" value={formatNumberWithCommas(serviceCharge)} onChange={e => { userTouchedRef.current.add('serviceCharge'); setServiceCharge(parseFormattedNumber(e.target.value)); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  )}
                  {showFinanceField('cautionDeposit') && (
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Caution Deposit (₦)</label>
                    <input type="text" value={formatNumberWithCommas(cautionDeposit)} onChange={e => { userTouchedRef.current.add('cautionDeposit'); setCautionDeposit(parseFormattedNumber(e.target.value)); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  )}
                  {showFinanceField('legalFee') && (
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Legal Fee (₦)</label>
                    <input type="text" value={formatNumberWithCommas(legalFee)} onChange={e => { userTouchedRef.current.add('legalFee'); setLegalFee(parseFormattedNumber(e.target.value)); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  )}
                  {showFinanceField('agencyFee') && (
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Agency Fee (₦)</label>
                    <input type="text" value={formatNumberWithCommas(agencyFee)} onChange={e => { userTouchedRef.current.add('agencyFee'); setAgencyFee(parseFormattedNumber(e.target.value)); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" placeholder="0.00" />
                  </div>
                  )}
                  {showFinanceField('dueDate') && (
                  <div>
                    <label className="block text-2xs text-slate-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wider font-bold">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => { userTouchedRef.current.add('dueDate'); setDueDate(e.target.value); }} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400" />
                  </div>
                  )}
                  </div>

                  {/* Live total preview — exactly what the message will say.
                      This is the transparency fix: the user SEES which
                      figures are summed (and which are excluded) before
                      sending, instead of discovering a wrong total in the
                      generated text. */}
                  {typeFinance.total.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-zinc-700">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xs uppercase tracking-wider font-bold text-slate-500 dark:text-zinc-400">Total in this message</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">₦{formatNumberWithCommas(String(Math.round(totalPreview)))}</span>
                      </div>
                      <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1 justify-end">
                        <Receipt className="w-2.5 h-2.5 shrink-0" />
                        {typeFinance.note}{isMultiRecipient ? ' — empty fields use each recipient\u2019s own figures' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

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

            {/* ── Recently Sent Panel ─────────────────────────────── */}
            {/* Renamed + includes FAILED rows (user feedback 2026-09-08:
                "where do I see the record of mails sent?" — the old panel
                was labelled "Upcoming Messages" AND filtered out failed
                rows, hiding the exact history the user needed). */}
            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowUpcoming(!showUpcoming)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Recently Sent
                </span>
                {showUpcoming ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showUpcoming && (
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span className="text-2xs text-amber-600 dark:text-amber-400">Last 10 messages — full history in Messages → Sent</span>
                  </div>
                  {upcomingLoading ? (
                    <div className="text-xs text-slate-400 dark:text-zinc-500 py-2 text-center">Loading…</div>
                  ) : upcomingLogs.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-zinc-600 py-2 text-center">No messages sent yet</div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                      {upcomingLogs.map((log: any) => (
                        <div key={log._id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/50" title={log.errorMessage || undefined}>
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
                            : log.status === 'sending' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' 
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
        ) : step === 'preview' ? (
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
              <button onClick={() => handleSend()} disabled={loading} className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <SendIcon /> {loading ? 'Sending…' : `Confirm & Send${isMultiRecipient ? ` (${selectedRecipients.length})` : ''}`}
              </button>
            </div>
          </div>
        ) : step === 'result' ? (
          /* ── Result Step — what ACTUALLY happened, per recipient ───── */
          <div className="p-4 sm:p-5 overflow-y-auto flex-1">
            <div className="mb-4">
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {sendResults.every(r => r.status !== 'failed') ? (
                  <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Delivery complete</>
                ) : (
                  <><XCircle className="w-5 h-5 text-rose-500" /> Some messages failed</>
                )}
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Every send is recorded in Messages → Sent with its status and reason.
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {sendResults.map(r => (
                <div key={r.id} className={`rounded-lg border p-3 flex items-start gap-3 ${
                  r.status === 'sent'
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40'
                    : r.status === 'simulated'
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40'
                      : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/40'
                }`}>
                  <span className="flex-shrink-0 mt-0.5">
                    {r.status === 'sent' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : r.status === 'simulated' ? <Clock className="w-4 h-4 text-amber-500" />
                      : <XCircle className="w-4 h-4 text-rose-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.name}</span>
                      <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${CHANNEL_COLORS[r.channel]}`}>{r.channel.toUpperCase()}</span>
                      <span className="text-2xs text-slate-400 dark:text-zinc-500 truncate">→ {r.contact}</span>
                    </div>
                    <p className={`text-2xs font-bold uppercase tracking-wider mt-1 ${
                      r.status === 'sent' ? 'text-emerald-600 dark:text-emerald-400'
                        : r.status === 'simulated' ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }}`}>
                      {r.status === 'sent'
                        ? `Delivered${r.usedTemplate ? ' (via template)' : ''}`
                        : r.status === 'simulated' ? 'Logged — channel not configured' : 'Failed'}
                    </p>
                    {r.status === 'failed' && r.error && (
                      <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed mt-1">{r.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* WhatsApp guidance — only when a WA send failed with the window error */}
            {channel === 'whatsapp' && sendResults.some(r => r.status === 'failed' && isWhatsAppWindowError(r.error)) && (
              <div className="mb-4 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800/40 text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                <span className="font-bold">Why this happens:</span> WhatsApp only delivers free-form messages within
                24 hours of the resident's last reply to your business number. For business-initiated reminders, Meta
                requires an <span className="font-bold">approved message template</span>.
                {(() => {
                  const tpl = resolveTemplateFor(msgType, templateMappings);
                  if (!tpl) return (<> No template is mapped for this message type yet — open
                    {' '}<span className="font-bold">Settings → Communications → WhatsApp Templates</span> to sync your
                    approved templates from Meta and map them.</>);
                  return (<> The template <span className="font-bold">{tpl.name}</span>
                  {' '}(tried under {tpl.languages.join(', ')}) was used automatically — Meta matches templates by
                  name <span className="font-bold">and language</span> exactly. If it still failed, open
                  {' '}<span className="font-bold">Settings → Communications → WhatsApp Templates</span>, press
                  {' '}"Sync from Meta" to see your exact approved names, languages and variable counts, and map the
                  right template to this message type.</>);
                })()}
              </div>
            )}

            <div className="flex gap-3">
              {sendResults.some(r => r.status === 'failed') && (
                <button
                  onClick={handleRetryFailed}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Retrying…' : `Retry Failed (${sendResults.filter(r => r.status === 'failed').length})`}
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">Done</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
