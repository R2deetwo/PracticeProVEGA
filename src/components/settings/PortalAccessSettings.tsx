/**
 * PortalAccessSettings — Manage portal invitations for clients and/or residents
 *
 * Product-aware layout:
 * - Komplete / Unified: Shows BOTH Client Portal and Residents' Portal sections
 * - Vega (legal-only): Shows Client Portal only
 * - Atrium (property-only): Shows Residents' Portal only
 *
 * Features:
 * - Send invitations via Email, WhatsApp, or Both
 * - Auto-populate name/phone from linked matter (client) or property/unit (resident)
 * - Magic-link tokens embedded in invite URLs for setup-password flow
 * - Resend, revoke, and copy invite links with real token
 * - Track invitation status (pending / accepted / expired / revoked)
 * - Delete with confirmation + cleanup of associated portal user
 * - Preview portal as a specific client/resident
 * - Grouped property/unit dropdown (address headers + selectable units)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { usePropertyGroups, PropertyGroup } from '../../hooks/usePropertyGroups';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { useFeatures } from '../../hooks/useFeatures';
import {
  ShieldCheckIcon, LockClosedIcon, LockOpenIcon,
  PlusIcon, XIcon, ClipboardIcon, RefreshIcon, TrashIcon,
  MailIcon, CheckIcon, ClockIcon,
  ExclamationTriangleIcon, SendIcon, DeviceMobileIcon,
  UsersIcon, OfficeBuildingIcon, EyeIcon, BellIcon,
} from '../../constants';

// ─── Delete Confirmation Dialog ──────────────────────────────────────────
const DeleteConfirmDialog: React.FC<{
  isOpen: boolean;
  inviteName: string;
  inviteEmail: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, inviteName, inviteEmail, isDeleting, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Portal Access</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed mb-4">
          Are you sure you want to permanently delete portal access for{' '}
          <strong className="text-slate-900 dark:text-white">{inviteName || inviteEmail}</strong>?
          This will also remove their portal user account, allowing them to be re-invited with a fresh invitation.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100 rounded-lg border border-slate-200 dark:border-zinc-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', label: 'Pending' },
    accepted: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Active' },
    expired: { bg: 'bg-slate-100 dark:bg-zinc-700', text: 'text-slate-500 dark:text-zinc-400', label: 'Expired' },
    revoked: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', label: 'Revoked' },
    superseded: { bg: 'bg-slate-100 dark:bg-zinc-700', text: 'text-slate-400 dark:text-zinc-500', label: 'Superseded' },
  };
  const c = cfg[status] || cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      {status === 'pending' && <ClockIcon className="w-3 h-3" />}
      {status === 'accepted' && <CheckIcon className="w-3 h-3" />}
      {status === 'expired' && <ExclamationTriangleIcon className="w-3 h-3" />}
      {status === 'revoked' && <XIcon className="w-3 h-3" />}
      {status === 'superseded' && <RefreshIcon className="w-3 h-3" />}
      {c.label}
    </span>
  );
};

// ─── Channel Badge ──────────────────────────────────────────────────────────
const ChannelBadge: React.FC<{ channel?: string }> = ({ channel }) => {
  const ch = channel || 'email';
  if (ch === 'whatsapp') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
        <DeviceMobileIcon className="w-2.5 h-2.5" /> WhatsApp
      </span>
    );
  }
  if (ch === 'both') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
        <MailIcon className="w-2.5 h-2.5" /> Email + WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400">
      <MailIcon className="w-2.5 h-2.5" /> Email
    </span>
  );
};

// ─── Portal Type Badge ──────────────────────────────────────────────────────
const PortalTypeBadge: React.FC<{ portalType: string }> = ({ portalType }) => {
  if (portalType === 'resident') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400">
        <OfficeBuildingIcon className="w-2.5 h-2.5" /> Resident
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">
      <UsersIcon className="w-2.5 h-2.5" /> Client
    </span>
  );
};

// ─── Invite Form ─────────────────────────────────────────────────────────────
const InviteForm: React.FC<{
  firmId: string;
  inviterId: string;
  portalType: 'client' | 'resident';
  onSent: () => void;
  onCancel: () => void;
}> = ({ firmId, inviterId, portalType, onSent, onCancel }) => {
  const { addToast } = useUI();
  const sendInvite = useAction(api.portals.createPortalInvite);
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();

  const isProperty = portalType === 'resident';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [isSending, setIsSending] = useState(false);
  const [isNameAutoFilled, setIsNameAutoFilled] = useState(false);

  // Build list of matters (client portal) or properties (resident portal) to link invite to
  const { groups: propertyGroups, flatUnits } = usePropertyGroups(coreState.properties || []);
  const relatedItems = useMemo(() => {
    if (isProperty) {
      return flatUnits.map(u => ({
        id: u.id,
        label: u.label,
        tenantName: u.tenantName || '',
        tenantPhone: u.tenantPhone || '',
        tenantEmail: u.tenantEmail || '',
      }));
    } else {
      return (matterState.matters || []).map((m: any) => ({
        id: m.id,
        label: m.title || m.name || `Matter ${String(m.id || '').slice(-5)}`,
        clientName: m.clientName || '',
        clientEmail: m.clientEmail || '',
        clientPhone: m.clientPhone || '',
      }));
    }
  }, [isProperty, flatUnits, matterState.matters]);

  // Auto-populate when user selects a matter/property
  const handleRelatedChange = useCallback((selectedId: string) => {
    setRelatedId(selectedId);
    if (!selectedId) {
      setIsNameAutoFilled(false);
      return;
    }
    const item = relatedItems.find((r: any) => r.id === selectedId);
    if (!item) return;
    if (isProperty) {
      // Auto-fill from property tenant data — always override if tenant data exists
      // For resident invites, the tenant name comes from the property record (source of truth)
      const propItem = item as { id: string; label: string; tenantName: string; tenantPhone: string; tenantEmail: string };
      if (propItem.tenantName) {
        setName(propItem.tenantName);
        setIsNameAutoFilled(true);
      } else {
        setIsNameAutoFilled(false);
      }
      if (propItem.tenantPhone) setPhone(propItem.tenantPhone);
      if (propItem.tenantEmail) setEmail(propItem.tenantEmail);
    } else {
      // Auto-fill from matter client data
      const matterItem = item as { id: any; label: any; clientName: any; clientEmail: any; clientPhone: any };
      if (matterItem.clientName) setName(matterItem.clientName);
      if (matterItem.clientEmail) setEmail(matterItem.clientEmail);
      if (matterItem.clientPhone) setPhone(matterItem.clientPhone);
    }
  }, [relatedItems, isProperty]);

  const handleSubmit = async () => {
    if (!email.trim() && channel !== 'whatsapp') {
      addToast('Please enter an email address', { type: 'error' });
      return;
    }
    if ((channel === 'whatsapp' || channel === 'both') && !phone.trim()) {
      addToast('Please enter a phone number for WhatsApp delivery', { type: 'error' });
      return;
    }
    setIsSending(true);
    try {
      // Add a timeout wrapper to prevent infinite spinning if the action hangs
      const invitePromise = sendInvite({
        firmId,
        inviterId,
        inviteeEmail: email.trim().toLowerCase() || undefined,
        inviteeName: name.trim() || undefined,
        inviteePhone: phone.trim() || undefined,
        portalType,
        relatedId: relatedId || undefined,
        channel,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. The server may be busy — please try again.')), 30000)
      );

      const result = await Promise.race([invitePromise, timeoutPromise]);

      // Build feedback message based on result
      const parts: string[] = [];
      if (result.emailSent) parts.push('email delivered');
      else if (result.emailSimulated) parts.push('email simulated (Brevo API key not configured)');
      else if (result.emailError) parts.push(`email failed: ${result.emailError}`);
      if (result.whatsappSent) parts.push('WhatsApp delivered');
      else if (result.whatsappSimulated) parts.push('WhatsApp simulated');
      else if (result.whatsappError) parts.push(`WhatsApp failed: ${result.whatsappError}`);
      else if (result.whatsappSkipped && (channel === 'whatsapp' || channel === 'both')) parts.push('WhatsApp skipped (no phone number)');

      const feedback = parts.length > 0 ? parts.join(', ') : 'invitation created';
      const hasErrors = result.emailError || result.whatsappError;
      const isSimulated = result.emailSimulated && !result.emailSent;
      // CRITICAL: When email is simulated (Brevo API key not configured), show a WARNING
      // instead of success. The email was NOT actually delivered — the recipient won't
      // receive the invitation. The admin needs to know this is a configuration issue.
      const toastType = hasErrors ? 'error' : isSimulated ? 'warning' : 'success';
      addToast(`Invitation created — ${feedback}${isSimulated ? '. IMPORTANT: The email was NOT actually sent — configure the Brevo API key in Convex environment variables.' : ''}`, { type: toastType });
      onSent();
    } catch (err: any) {
      const msg = err?.message || 'Failed to send invitation';
      // Make error messages more user-friendly
      if (msg.includes('rate limit') || msg.includes('429')) {
        addToast('Too many requests. Please wait a moment and try again.', { type: 'error' });
      } else if (msg.includes('timed out') || msg.includes('timeout')) {
        addToast('The request timed out. Your invitation may still have been created — check the list below.', { type: 'info' });
        onSent(); // Refresh the list to check
      } else {
        addToast(msg, { type: 'error' });
      }
    } finally {
      setIsSending(false);
    }
  };

  const needsPhone = channel === 'whatsapp' || channel === 'both';

  const portalLabel = isProperty ? 'Resident' : 'Client';
  const portalDescription = isProperty
    ? 'Invite a resident to access their payment ledger, maintenance tickets, and receipts.'
    : 'Invite a client to access their matters, documents, messages, and billing.';

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {isProperty ? <OfficeBuildingIcon className="w-4 h-4 text-sky-500" /> : <UsersIcon className="w-4 h-4 text-violet-500" />}
            Invite {portalLabel} to Portal
          </h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{portalDescription}</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Channel Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
            Send Via
          </label>
          <div className="flex gap-2">
            {[
              { value: 'email' as const, label: 'Email', icon: MailIcon },
              { value: 'whatsapp' as const, label: 'WhatsApp', icon: DeviceMobileIcon },
              { value: 'both' as const, label: 'Both', icon: SendIcon },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setChannel(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  channel === opt.value
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-600 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <opt.icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Email — required unless WhatsApp-only */}
        {channel !== 'whatsapp' && (
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={isProperty ? 'resident@example.com' : 'client@example.com'}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        )}

        {/* Phone — required for WhatsApp/Both */}
        {needsPhone && (
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
              Phone / WhatsApp <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <DeviceMobileIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g., +2348012345678"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        )}

        {/* Name — auto-filled from tenant record for resident invites, optional for client invites */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Full Name{' '}
            {isProperty && isNameAutoFilled ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-normal normal-case tracking-normal">· from tenant record</span>
            ) : (
              <span className="text-slate-400">(optional)</span>
            )}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); if (isProperty && isNameAutoFilled) setIsNameAutoFilled(false); }}
            readOnly={isProperty && isNameAutoFilled}
            placeholder={isProperty ? 'e.g., Chidi Okafor' : 'e.g., Adebayo & Associates'}
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${
              isProperty && isNameAutoFilled
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10 text-slate-800 dark:text-zinc-200 cursor-default'
                : 'border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            }`}
          />
          {isProperty && isNameAutoFilled && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              This name is from the property's tenant record and will be used as the official name on the portal.
              Edit only if the tenant record is incorrect.
            </p>
          )}
        </div>

        {/* Link to matter/property — auto-fills name/phone/email */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Link to {isProperty ? 'Property' : 'Matter'} <span className="text-slate-400">(optional — auto-fills details)</span>
          </label>
          {isProperty && flatUnits.length === 0 ? (
            <div className="w-full px-3 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-400 dark:text-zinc-500 italic">
              No properties on file yet. Add properties to link them here.
            </div>
          ) : !isProperty && (matterState.matters || []).length === 0 ? (
            <div className="w-full px-3 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-400 dark:text-zinc-500 italic">
              No matters on file yet. Create a matter to link it here.
            </div>
          ) : isProperty ? (
            /* Grouped property/unit dropdown: address as non-selectable header, units below */
            <>
              <select
                value={relatedId}
                onChange={e => handleRelatedChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Select a unit to auto-fill details</option>
                {propertyGroups.map((group: PropertyGroup) => (
                  <optgroup key={group.addressKey} label={group.shortAddress}>
                    {group.units.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.unitName ? `${u.unitName}` : u.shortAddress}{u.tenantName ? ` — ${u.tenantName}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {relatedId && (
                <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-1 font-medium">
                  Name, email, and phone will be auto-filled from the selected tenant record.
                </p>
              )}
            </>
          ) : (
            <>
              <select
                value={relatedId}
                onChange={e => handleRelatedChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              >
                <option value="">Select a matter to auto-fill details</option>
                {relatedItems.map((item: any) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              {relatedId && (
                <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-1 font-medium">
                  Name, email, and phone will be auto-filled from the selected client record.
                </p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSending || (!email.trim() && channel !== 'whatsapp') || (needsPhone && !phone.trim())}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <SendIcon className="w-4 h-4" />
                Send via {channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'WhatsApp' : 'Email & WhatsApp'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Invite List ────────────────────────────────────────────────────────────
const InviteList: React.FC<{
  invites: any[];
  portalType: 'client' | 'resident';
  resendingId: string | null;
  onResend: (invite: any) => void;
  onRevoke: (inviteId: string) => void;
  onDelete: (invite: any) => void;
  onCopyLink: (invite: any) => void;
  onPreview: (invite: any) => void;
  showPortalTypeBadge?: boolean;
}> = ({ invites, portalType, resendingId, onResend, onRevoke, onDelete, onCopyLink, onPreview, showPortalTypeBadge }) => {
  const isProperty = portalType === 'resident';

  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredInvites = useMemo(() => {
    if (filterStatus === 'all') return invites;
    return invites.filter((inv: any) => inv.status === filterStatus);
  }, [invites, filterStatus]);

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      all: invites.length,
      pending: invites.filter((i: any) => i.status === 'pending').length,
      accepted: invites.filter((i: any) => i.status === 'accepted').length,
      expired: invites.filter((i: any) => i.status === 'expired').length,
      revoked: invites.filter((i: any) => i.status === 'revoked').length,
    };
  }, [invites]);

  const portalLabel = isProperty ? 'resident' : 'client';

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'accepted', label: 'Active' },
          { key: 'expired', label: 'Expired' },
          { key: 'revoked', label: 'Revoked' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              filterStatus === tab.key
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50'
                : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 border border-transparent hover:bg-slate-200 dark:hover:bg-zinc-600'
            }`}
          >
            {tab.label}
            {(statusCounts as any)[tab.key] > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                filterStatus === tab.key
                  ? 'bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-300'
                  : 'bg-slate-200 dark:bg-zinc-600 text-slate-500 dark:text-zinc-400'
              }`}>
                {(statusCounts as any)[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invitations List */}
      {filteredInvites.length === 0 ? (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-6 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-2">
            <MailIcon className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            No {filterStatus === 'all' ? '' : filterStatus + ' '}{portalLabel} invitations
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {filterStatus === 'all'
              ? `Click "Invite ${isProperty ? 'Resident' : 'Client'}" to send your first portal invitation.`
              : `No ${filterStatus} invitations found. Try a different filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvites.map((invite: any) => {
            const isPending = invite.status === 'pending';
            const isActive = invite.status === 'accepted';
            const isResending = resendingId === String(invite._id);

            return (
              <div
                key={invite._id}
                className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : isPending
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                  }`}>
                    {(invite.inviteeName || invite.inviteeEmail || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {invite.inviteeName || invite.inviteeEmail}
                      </p>
                      {showPortalTypeBadge && <PortalTypeBadge portalType={invite.portalType} />}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {invite.inviteeEmail}
                      </p>
                      {invite.inviteePhone && (
                        <p className="text-xs text-slate-500 dark:text-zinc-400">· {invite.inviteePhone}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status + Channel + Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <ChannelBadge channel={invite.channel} />
                  <StatusBadge status={invite.status} />
                  {isActive && (
                    <button
                      onClick={() => onPreview(invite)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                      title="Preview portal as this user"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                  )}
                  {isPending && (
                    <>
                      <button
                        onClick={() => onCopyLink(invite)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title="Copy invite link"
                      >
                        <ClipboardIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onResend(invite)}
                        disabled={isResending}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                        title="Resend invitation"
                      >
                        {isResending ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RefreshIcon className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onRevoke(String(invite._id))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        title="Revoke invitation"
                      >
                        <LockClosedIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {/* Revoke/Restore toggle — available on accepted and revoked statuses */}
                  {(isActive || invite.status === 'revoked') && (
                    <button
                      onClick={() => onRevoke(String(invite._id))}
                      className={`p-1.5 rounded-lg transition-colors ${
                        invite.status === 'revoked'
                          ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                      }`}
                      title={invite.status === 'revoked' ? 'Restore portal access' : 'Revoke portal access'}
                    >
                      {invite.status === 'revoked' ? <LockOpenIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
                    </button>
                  )}
                  {/* Delete permanently — available on all statuses */}
                  <button
                    onClick={() => onDelete(invite)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete permanently"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Portal Section ─────────────────────────────────────────────────────────
// A reusable section for one portal type (Client or Resident)
const PortalSection: React.FC<{
  portalType: 'client' | 'resident';
  invites: any[];
  firmId: string;
  inviterId: string;
  canUsePortal: boolean;
  isUnified: boolean;
  hasRelatedData: boolean;  // Has matters (client) or properties (resident)
  relatedDataHint: string;  // What to show when no related data
  resendingId: string | null;
  onResend: (invite: any) => void;
  onRevoke: (inviteId: string) => void;
  onDelete: (invite: any) => void;
  onCopyLink: (invite: any, portalType: string) => void;
  onPreview: (invite: any) => void;
}> = ({ portalType, invites, firmId, inviterId, canUsePortal, isUnified, hasRelatedData, relatedDataHint, resendingId, onResend, onRevoke, onDelete, onCopyLink, onPreview }) => {
  const isProperty = portalType === 'resident';
  const [showInviteForm, setShowInviteForm] = useState(false);

  const title = isProperty ? "Residents' Portal" : 'Client Portal';
  const icon = isProperty ? <OfficeBuildingIcon className="w-5 h-5 text-sky-500" /> : <UsersIcon className="w-5 h-5 text-violet-500" />;
  const inviteLabel = isProperty ? 'Resident' : 'Client';
  const description = isProperty
    ? 'Grant residents self-service access to their payment ledgers, maintenance tickets, and receipts.'
    : 'Grant clients self-service access to their matters, documents, messages, and billing.';

  // ── Plan gate ──
  if (!canUsePortal) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4">
          <LockClosedIcon className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          {title} — Upgrade Required
        </h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md leading-relaxed">
          Portal access management is available on <strong>Growth</strong> and <strong>Pro</strong> plans.
          Upgrade your subscription to invite {isProperty ? 'residents' : 'clients'} and grant them self-service access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {description}
            {!hasRelatedData && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                {relatedDataHint}
              </span>
            )}
          </p>
        </div>
        {!showInviteForm && (
          <button
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" />
            Invite {inviteLabel}
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <InviteForm
          firmId={firmId}
          inviterId={inviterId}
          portalType={portalType}
          onSent={() => setShowInviteForm(false)}
          onCancel={() => setShowInviteForm(false)}
        />
      )}

      {/* Invite List */}
      <InviteList
        invites={invites}
        portalType={portalType}
        resendingId={resendingId}
        onResend={onResend}
        onRevoke={onRevoke}
        onDelete={onDelete}
        onCopyLink={(invite) => onCopyLink(invite, portalType)}
        onPreview={(invite) => onPreview(invite)}
      />
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
export const PortalAccessSettings: React.FC = () => {
  const { currentUser, loginAsUser } = useAuth();
  const { addToast, navigateTo } = useUI();
  const { isProperty, isLegal, isUnified } = useProduct();
  const { canUseClientPortal, canUseTenantPortal } = useFeatures();

  const firmId = currentUser?.firmId || '';

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);  // The invite being deleted
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch ALL portal invites for this firm
  const invites = useQuery(
    api.portals.getPortalInvitesByFirm,
    firmId ? { firmId } : 'skip'
  );

  // Fetch portal settings for messaging toggles
  const portalSettings = useQuery(
    api.portals.getFirmPortalSettings,
    firmId ? { firmId } : 'skip'
  );

  const updateSettings = useMutation(api.portals.updateFirmPortalSettings);

  const revokeInvite = useMutation(api.portals.revokePortalInvite);
  const deleteInvite = useMutation(api.portals.deletePortalInviteAndCleanup);
  const resendInvite = useAction(api.portals.resendPortalInvite);

  // Separate invites by portal type
  const clientInvites = useMemo(() => {
    if (!invites) return [];
    return invites.filter((inv: any) => inv.portalType === 'client');
  }, [invites]);

  const residentInvites = useMemo(() => {
    if (!invites) return [];
    return invites.filter((inv: any) => inv.portalType === 'resident');
  }, [invites]);

  // Check if firm has matters and properties
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const hasMatters = (matterState.matters || []).length > 0;
  const hasProperties = (coreState.properties || []).length > 0;

  // Determine which portal sections to show
  const showClientPortal = isLegal;
  const showResidentPortal = isProperty;
  const showBoth = showClientPortal && showResidentPortal;

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite({ inviteId: inviteId as any });
      // Check if the invite was revoked or restored by checking its current status
      // The backend toggles: revoked -> accepted (restore), active/pending -> revoked
      addToast('Portal access updated.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to update access.', { type: 'error' });
    }
  };

  // Delete with confirmation — shows dialog, then calls cleanup mutation
  const handleDeleteRequest = (invite: any) => {
    console.log('[PortalAccessSettings] Delete requested for invite:', invite?._id, invite?.inviteeEmail);
    setDeleteTarget(invite);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || isDeleting) return;
    const inviteId = deleteTarget._id;
    const inviteEmail = deleteTarget.inviteeEmail || '';
    const invitePhone = deleteTarget.inviteePhone || '';
    console.log('[PortalAccessSettings] Confirming delete:', { inviteId, inviteEmail, invitePhone, inviteIdType: typeof inviteId });
    setIsDeleting(true);
    try {
      // Try the full cleanup mutation first — pass both email and phone for robust user lookup
      await deleteInvite({
        inviteId: inviteId as any,
        inviteeEmail: inviteEmail || undefined,
        inviteePhone: invitePhone || undefined,
      });
      console.log('[PortalAccessSettings] Delete succeeded for:', inviteId);
      addToast('Portal access deleted. The user can now be re-invited with a fresh invitation.', { type: 'success' });
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('[PortalAccessSettings] Delete failed:', err);
      // If the cleanup mutation fails, try a simpler revoke as fallback
      try {
        console.log('[PortalAccessSettings] Attempting fallback revoke for:', inviteId);
        await revokeInvite({ inviteId: inviteId as any });
        addToast('Portal access revoked (cleanup partially failed — user account may need manual reset).', { type: 'warning' });
        setDeleteTarget(null);
      } catch (fallbackErr: any) {
        console.error('[PortalAccessSettings] Fallback revoke also failed:', fallbackErr);
        addToast(fallbackErr.message || err.message || 'Failed to delete invitation. Please try again.', { type: 'error' });
      }
      // Don't close the dialog on error — let the user retry or cancel
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResend = async (invite: any) => {
    setResendingId(String(invite._id));
    try {
      const result = await resendInvite({ inviteId: invite._id });
      const parts: string[] = [];
      if (result.emailSent) parts.push('email delivered');
      else if (result.emailSimulated) parts.push('email simulated (Brevo API key not configured)');
      if (result.whatsappSent) parts.push('WhatsApp delivered');
      else if (result.whatsappSimulated) parts.push('WhatsApp simulated');
      addToast(`Invitation resent — ${parts.join(', ') || 'refreshed'}`, { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to resend invitation.', { type: 'error' });
    } finally {
      setResendingId(null);
    }
  };

  // FIX: Copy link now uses /setup-password URL (not the login page)
  // This ensures new users without accounts can create their password
  const handleCopyInviteLink = (invite: any, portalType: string) => {
    const portalBase = 'https://practice-pro-vega.vercel.app/setup-password';
    const inviteUrl = invite.token
      ? `${portalBase}?token=${invite.token}`
      : portalBase;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      addToast('Invite link copied! The recipient can use this link to set up their password and access the portal.', { type: 'success' });
    }).catch(() => {
      addToast('Failed to copy link', { type: 'error' });
    });
  };

  // Preview portal as a specific client/resident (impersonation)
  const handlePreview = (invite: any) => {
    const portalEmail = invite.inviteeEmail;
    if (!portalEmail) {
      addToast('No email on file for this portal user.', { type: 'error' });
      return;
    }
    // Use the auth system's impersonation to view the portal as this user
    const portalUser = {
      id: invite.inviteeEmail,
      firmId: firmId,
      name: invite.inviteeName || invite.inviteeEmail,
      email: invite.inviteeEmail,
      role: invite.portalType === 'client' ? 'Client' as any : 'Tenant' as any,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(invite.inviteeName || invite.inviteeEmail)}&background=random`,
      onboardingCompleted: true,
      showProTips: false,
      product: invite.portalType === 'client' ? 'legal' : 'property',
      portalPresenceHidden: invite.portalType === 'resident',
    };
    loginAsUser(portalUser as any);
    addToast(`Viewing portal as ${invite.inviteeName || invite.inviteeEmail}. Click "Return to Admin" at the top to go back.`, { type: 'success' });
    // Navigate to root so the portal dashboard is shown (not the settings page)
    // Use navigate() to preserve in-memory state during impersonation
    navigateTo('dashboard');
  };

  const isLoading = invites === undefined;

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-zinc-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-zinc-700 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Build delete dialog info
  const deleteDialogName = deleteTarget?.inviteeName || '';
  const deleteDialogEmail = deleteTarget?.inviteeEmail || '';

  // ── Unified/Komplete layout: dual portal sections ──
  if (showBoth) {
    return (
      <div className="space-y-8">
        <DeleteConfirmDialog
          isOpen={!!deleteTarget}
          inviteName={deleteDialogName}
          inviteEmail={deleteDialogEmail}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { if (!isDeleting) setDeleteTarget(null); }}
        />

        {/* Page header */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-primary-500" />
            Portal Access
          </h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage portal access for your clients and residents. Send invitations via email or WhatsApp.
          </p>
        </div>

        {/* Portal Settings Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-4">Portal Settings</h3>
          <div className="space-y-4">
            {/* Resident Messaging Toggle */}
            {showResidentPortal && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Resident Messaging</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Allow residents to send messages to their property manager through the portal. Off by default.</p>
                </div>
                <button
                  onClick={() => updateSettings({ firmId, tenantMessagingEnabled: !portalSettings?.tenantMessagingEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${portalSettings?.tenantMessagingEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${portalSettings?.tenantMessagingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
            {/* Client Messaging Toggle */}
            {showClientPortal && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Client Messaging</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Allow clients to send messages to their firm through the portal. Off by default.</p>
                </div>
                <button
                  onClick={() => updateSettings({ firmId, clientMessagingEnabled: !portalSettings?.clientMessagingEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${portalSettings?.clientMessagingEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${portalSettings?.clientMessagingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notice Board — prominent placement for property managers */}
        {showResidentPortal && (
          <NoticeBoardAdmin firmId={firmId} authorId={currentUser?.id || ''} authorName={currentUser?.name || ''} />
        )}

        {/* Client Portal Section — primary for Komplete/lawyers */}
        <div className="bg-violet-50/30 dark:bg-violet-900/5 rounded-2xl border border-violet-100 dark:border-violet-900/20 p-4 sm:p-6">
          <PortalSection
            portalType="client"
            invites={clientInvites}
            firmId={firmId}
            inviterId={currentUser?.id || ''}
            canUsePortal={canUseClientPortal}
            isUnified={isUnified}
            hasRelatedData={hasMatters}
            relatedDataHint="No matters yet — create a matter to link it when inviting a client."
            resendingId={resendingId}
            onResend={handleResend}
            onRevoke={handleRevoke}
            onDelete={handleDeleteRequest}
            onCopyLink={handleCopyInviteLink}
            onPreview={handlePreview}
          />
        </div>

        {/* Residents' Portal Section — secondary for Komplete/lawyers */}
        <div className="bg-sky-50/30 dark:bg-sky-900/5 rounded-2xl border border-sky-100 dark:border-sky-900/20 p-4 sm:p-6">
          <PortalSection
            portalType="resident"
            invites={residentInvites}
            firmId={firmId}
            inviterId={currentUser?.id || ''}
            canUsePortal={canUseTenantPortal}
            isUnified={isUnified}
            hasRelatedData={hasProperties}
            relatedDataHint="No properties yet — add properties to link them when inviting a resident."
            resendingId={resendingId}
            onResend={handleResend}
            onRevoke={handleRevoke}
            onDelete={handleDeleteRequest}
            onCopyLink={handleCopyInviteLink}
            onPreview={handlePreview}
          />
        </div>

        {/* Security Notice */}
        <SecurityNotice isProperty={false} isUnified={true} />
      </div>
    );
  }

  // ── Single-product layout (Vega or Atrium) ──
  const singlePortalType = showClientPortal ? 'client' as const : 'resident' as const;
  const singleCanUse = showClientPortal ? canUseClientPortal : canUseTenantPortal;
  const singleInvites = showClientPortal ? clientInvites : residentInvites;
  const singleHasRelatedData = showClientPortal ? hasMatters : hasProperties;
  const singleRelatedHint = showClientPortal
    ? "No matters yet — create a matter to link it when inviting a client."
    : "No properties yet — add properties to link them when inviting a resident.";

  if (!singleCanUse) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4">
          <LockClosedIcon className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {isProperty ? "Residents' Portal" : "Client Portal"} — Upgrade Required
        </h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md leading-relaxed">
          Portal access management is available on <strong>Growth</strong> and <strong>Pro</strong> plans.
          Upgrade your subscription to invite {isProperty ? 'residents' : 'clients'} and grant them self-service access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        inviteName={deleteDialogName}
        inviteEmail={deleteDialogEmail}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!isDeleting) setDeleteTarget(null); }}
      />

      {/* Portal Settings Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-4">Portal Settings</h3>
        <div className="space-y-4">
          {/* Resident Messaging Toggle */}
          {showResidentPortal && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Resident Messaging</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Allow residents to send messages to their property manager through the portal. Off by default.</p>
              </div>
              <button
                onClick={() => updateSettings({ firmId, tenantMessagingEnabled: !portalSettings?.tenantMessagingEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${portalSettings?.tenantMessagingEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${portalSettings?.tenantMessagingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
          {/* Client Messaging Toggle */}
          {showClientPortal && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Client Messaging</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Allow clients to send messages to their firm through the portal. Off by default.</p>
              </div>
              <button
                onClick={() => updateSettings({ firmId, clientMessagingEnabled: !portalSettings?.clientMessagingEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${portalSettings?.clientMessagingEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${portalSettings?.clientMessagingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notice Board — prominent placement right after settings */}
      {showResidentPortal && (
        <NoticeBoardAdmin firmId={firmId} authorId={currentUser?.id || ''} authorName={currentUser?.name || ''} />
      )}

      <PortalSection
        portalType={singlePortalType}
        invites={singleInvites}
        firmId={firmId}
        inviterId={currentUser?.id || ''}
        canUsePortal={singleCanUse}
        isUnified={false}
        hasRelatedData={singleHasRelatedData}
        relatedDataHint={singleRelatedHint}
        resendingId={resendingId}
        onResend={handleResend}
        onRevoke={handleRevoke}
        onDelete={handleDeleteRequest}
        onCopyLink={handleCopyInviteLink}
        onPreview={handlePreview}
      />

      <SecurityNotice isProperty={isProperty} isUnified={false} />
    </div>
  );
};

// ─── Security Notice ────────────────────────────────────────────────────────
const SecurityNotice: React.FC<{ isProperty: boolean; isUnified: boolean }> = ({ isProperty, isUnified }) => (
  <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <ShieldCheckIcon className="w-5 h-5 text-slate-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Security & Data Protection</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
          Invitation links expire after 7 days for security, but once a resident sets their password they can
          access the portal anytime — the 7-day window only applies to the initial invitation, not to ongoing access.
          Passwords are hashed with PBKDF2-SHA512 and never stored in plaintext. All data is encrypted in transit and at rest, compliant with NDPA 2023.
          {isUnified && ' Both Client and Resident portals share the same security infrastructure.'}
        </p>
      </div>
    </div>
  </div>
);

// ─── Notice Board Admin ────────────────────────────────────────────────────────
const NoticeBoardAdmin: React.FC<{ firmId: string; authorId: string; authorName: string }> = ({ firmId, authorId, authorName }) => {
  const { addToast } = useUI();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newPriority, setNewPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [newPinned, setNewPinned] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Fetch all notices (active + archived) for admin management
  const notices = useQuery(
    api.portals.getAllNotices,
    firmId ? { firmId } : 'skip'
  );

  const createNotice = useMutation(api.portals.createNotice);
  const archiveNotice = useMutation(api.portals.archiveNotice);
  const restoreNotice = useMutation(api.portals.restoreNotice);

  const activeNotices = useMemo(() => (notices || []).filter((n: any) => n.status === 'active'), [notices]);
  const archivedNotices = useMemo(() => (notices || []).filter((n: any) => n.status === 'archived'), [notices]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      addToast('Please enter a title and message for the notice.', { type: 'error' });
      return;
    }
    setIsCreating(true);
    try {
      await createNotice({
        firmId,
        authorId,
        authorName,
        title: newTitle.trim(),
        body: newBody.trim(),
        priority: newPriority,
        isPinned: newPinned,
      });
      setNewTitle('');
      setNewBody('');
      setNewPriority('normal');
      setNewPinned(false);
      setShowForm(false);
      addToast('Notice posted successfully.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to create notice.', { type: 'error' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async (noticeId: any) => {
    try {
      await archiveNotice({ noticeId });
      addToast('Notice archived.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to archive notice.', { type: 'error' });
    }
  };

  const handleRestore = async (noticeId: any) => {
    try {
      await restoreNotice({ noticeId });
      addToast('Notice restored.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to restore notice.', { type: 'error' });
    }
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    normal: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <BellIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Notice Board</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Post updates visible to all residents on their portal</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          New Notice
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Notice title..."
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Notice content..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Priority:</label>
              {(['normal', 'important', 'urgent'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setNewPriority(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${newPriority === p ? priorityColors[p] + ' ring-2 ring-offset-1' : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500'}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newPinned}
                onChange={e => setNewPinned(e.target.checked)}
                className="rounded border-slate-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500/30"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Pin to top</span>
            </label>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isCreating ? 'Posting...' : 'Post Notice'}
            </button>
          </div>
        </div>
      )}

      {/* Active Notices */}
      {activeNotices.length > 0 ? (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Active ({activeNotices.length})</p>
          {activeNotices.map((notice: any) => (
            <div key={notice._id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {notice.isPinned && (
                    <svg className="w-3 h-3 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                  )}
                  <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate">{notice.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${priorityColors[notice.priority] || priorityColors.normal}`}>
                    {notice.priority}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">{notice.body}</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  {new Date(notice.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleArchive(notice._id)}
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex-shrink-0"
                title="Archive notice"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4">No active notices. Post one to keep your residents informed.</p>
      )}

      {/* Archived Notices */}
      {archivedNotices.length > 0 && (
        <details className="group">
          <summary className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
            Archived ({archivedNotices.length})
          </summary>
          <div className="mt-2 space-y-2">
            {archivedNotices.map((notice: any) => (
              <div key={notice._id} className="flex items-center justify-between gap-3 p-2 bg-slate-50/50 dark:bg-zinc-800/50 rounded-lg opacity-60">
                <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">{notice.title}</span>
                <button
                  onClick={() => handleRestore(notice._id)}
                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-500 flex-shrink-0"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
