/**
 * PortalAccessSettings — Manage portal invitations for clients (Vega) or residents (Atrium)
 *
 * Features:
 * - Send invitations via Email, WhatsApp, or Both
 * - Auto-populate name/phone from linked matter (Vega) or property/unit (Atrium)
 * - Magic-link tokens embedded in invite URLs for auto-fill on portal login
 * - Resend, revoke, and copy invite links with real token
 * - Track invitation status (pending / accepted / expired / revoked)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { useFeatures } from '../../hooks/useFeatures';
import {
  ShieldCheckIcon, LockClosedIcon,
  PlusIcon, XIcon, ClipboardIcon, RefreshIcon, TrashIcon,
  MailIcon, CheckIcon, ClockIcon,
  ExclamationTriangleIcon, SendIcon, DeviceMobileIcon,
} from '../../constants';

// ─── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', label: 'Pending' },
    accepted: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Active' },
    expired: { bg: 'bg-slate-100 dark:bg-zinc-700', text: 'text-slate-500 dark:text-zinc-400', label: 'Expired' },
    revoked: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', label: 'Revoked' },
  };
  const c = cfg[status] || cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
      {status === 'pending' && <ClockIcon className="w-3 h-3" />}
      {status === 'accepted' && <CheckIcon className="w-3 h-3" />}
      {status === 'expired' && <ExclamationTriangleIcon className="w-3 h-3" />}
      {status === 'revoked' && <XIcon className="w-3 h-3" />}
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

// ─── Invite Form ─────────────────────────────────────────────────────────────
const InviteForm: React.FC<{
  firmId: string;
  inviterId: string;
  portalType: 'client' | 'resident';
  isProperty: boolean;
  onSent: () => void;
  onCancel: () => void;
}> = ({ firmId, inviterId, portalType, isProperty, onSent, onCancel }) => {
  const { addToast } = useUI();
  const sendInvite = useAction(api.portals.createPortalInvite);
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [isSending, setIsSending] = useState(false);

  // Build list of matters (Vega) or properties (Atrium) to link invite to
  const relatedItems = useMemo(() => {
    if (isProperty) {
      return (coreState.properties || []).map((p: any) => ({
        id: p.id,
        label: p.address || p.name || `Property ${String(p.id || '').slice(-5)}`,
        tenantName: p.tenantName || p.currentTenantName || '',
        tenantPhone: p.tenantPhone || p.currentTenantPhone || '',
        tenantEmail: p.tenantEmail || p.currentTenantEmail || '',
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
  }, [isProperty, coreState.properties, matterState.matters]);

  // Auto-populate when user selects a matter/property
  const handleRelatedChange = useCallback((selectedId: string) => {
    setRelatedId(selectedId);
    if (!selectedId) return;
    const item = relatedItems.find((r: any) => r.id === selectedId);
    if (!item) return;
    if (isProperty) {
      // Auto-fill from property tenant data
      if (item.tenantName && !name) setName(item.tenantName);
      if (item.tenantPhone && !phone) setPhone(item.tenantPhone);
      if (item.tenantEmail && !email) setEmail(item.tenantEmail);
    } else {
      // Auto-fill from matter client data
      if (item.clientName && !name) setName(item.clientName);
      if (item.clientEmail && !email) setEmail(item.clientEmail);
      if (item.clientPhone && !phone) setPhone(item.clientPhone);
    }
  }, [relatedItems, isProperty, name, phone, email]);

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
      const result = await sendInvite({
        firmId,
        inviterId,
        inviteeEmail: email.trim().toLowerCase() || undefined,
        inviteeName: name.trim() || undefined,
        inviteePhone: phone.trim() || undefined,
        portalType,
        relatedId: relatedId || undefined,
        channel,
      });
      // Build feedback message based on result
      const parts: string[] = [];
      if (result.emailSent) parts.push('email delivered');
      else if (result.emailSimulated) parts.push('email simulated (Brevo API key not configured)');
      if (result.whatsappSent) parts.push('WhatsApp delivered');
      else if (result.whatsappSimulated) parts.push('WhatsApp simulated');
      else if (result.whatsappSkipped && (channel === 'whatsapp' || channel === 'both')) parts.push('WhatsApp skipped (no phone number)');

      const feedback = parts.length > 0 ? parts.join(', ') : 'invitation created';
      addToast(`Invitation sent — ${feedback}`, { type: 'success' });
      onSent();
    } catch (err: any) {
      addToast(err.message || 'Failed to send invitation', { type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const needsPhone = channel === 'whatsapp' || channel === 'both';

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          Invite {isProperty ? 'Resident' : 'Client'} to Portal
        </h4>
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

        {/* Name — always shown but optional */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Full Name <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={isProperty ? 'e.g., Chidi Okafor' : 'e.g., Adebayo & Associates'}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Link to matter/property — auto-fills name/phone/email */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Link to {isProperty ? 'Property' : 'Matter'} <span className="text-slate-400">(optional — auto-fills details)</span>
          </label>
          <select
            value={relatedId}
            onChange={e => handleRelatedChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">Select {isProperty ? 'a property' : 'a matter'} to auto-fill details</option>
            {relatedItems.map((item: any) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {relatedId && (
            <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-1 font-medium">
              Name, email, and phone will be auto-filled from the selected {isProperty ? 'tenant' : 'client'} record.
            </p>
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

// ─── Main Component ────────────────────────────────────────────────────────
export const PortalAccessSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const { isProperty } = useProduct();
  const { canUseClientPortal, canUseTenantPortal } = useFeatures();

  const firmId = currentUser?.firmId || '';
  const canUsePortal = isProperty ? canUseTenantPortal : canUseClientPortal;

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Fetch portal invites
  const invites = useQuery(
    api.portals.getPortalInvitesByFirm,
    firmId ? { firmId } : 'skip'
  );

  const revokeInvite = useMutation(api.portals.revokePortalInvite);
  const deleteInvite = useMutation(api.portals.deletePortalInvite);
  const resendInvite = useAction(api.portals.resendPortalInvite);

  const filteredInvites = useMemo(() => {
    if (!invites) return [];
    if (filterStatus === 'all') return invites;
    return invites.filter((inv: any) => inv.status === filterStatus);
  }, [invites, filterStatus]);

  // Count by status
  const statusCounts = useMemo(() => {
    if (!invites) return { all: 0, pending: 0, accepted: 0, expired: 0, revoked: 0 };
    return {
      all: invites.length,
      pending: invites.filter((i: any) => i.status === 'pending').length,
      accepted: invites.filter((i: any) => i.status === 'accepted').length,
      expired: invites.filter((i: any) => i.status === 'expired').length,
      revoked: invites.filter((i: any) => i.status === 'revoked').length,
    };
  }, [invites]);

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite({ inviteId: inviteId as any });
      addToast('Portal access revoked successfully.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to revoke access.', { type: 'error' });
    }
  };

  const handleDelete = async (inviteId: string) => {
    try {
      await deleteInvite({ inviteId: inviteId as any });
      addToast('Invitation deleted permanently.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to delete invitation.', { type: 'error' });
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

  const handleCopyInviteLink = (invite: any) => {
    const portalBase = isProperty
      ? 'https://practice-pro-vega.vercel.app/portal/tenant/login'
      : 'https://practice-pro-vega.vercel.app/portal/client/login';
    const inviteUrl = invite.token
      ? `${portalBase}?token=${invite.token}`
      : portalBase;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      addToast('Invite link copied! The link includes a token that will auto-fill their email on the portal login page.', { type: 'success' });
    }).catch(() => {
      addToast('Failed to copy link', { type: 'error' });
    });
  };

  // ── Plan gate ──
  if (!canUsePortal) {
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

  const isLoading = invites === undefined;

  return (
    <div className="space-y-6">
      {/* Header with CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-primary-500" />
            {isProperty ? "Residents' Portal" : 'Client Portal'} Access
          </h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Manage who can access the {isProperty ? 'residents' : 'client'} portal. Send invitations via email or WhatsApp.
          </p>
        </div>
        {!showInviteForm && (
          <button
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" />
            Invite {isProperty ? 'Resident' : 'Client'}
          </button>
        )}
      </div>

      {/* Invite Form (shown when "Invite" button clicked) */}
      {showInviteForm && (
        <InviteForm
          firmId={firmId}
          inviterId={currentUser?.id || ''}
          portalType={isProperty ? 'resident' : 'client'}
          isProperty={isProperty}
          onSent={() => setShowInviteForm(false)}
          onCancel={() => setShowInviteForm(false)}
        />
      )}

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
      {isLoading ? (
        <div className="space-y-3">
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
      ) : filteredInvites.length === 0 ? (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <MailIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            No {filterStatus === 'all' ? '' : filterStatus + ' '}invitations yet
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {filterStatus === 'all'
              ? `Click "Invite ${isProperty ? 'Resident' : 'Client'}" above to send your first portal invitation via email or WhatsApp.`
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
                className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : isPending
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'
                  }`}>
                    {(invite.inviteeName || invite.inviteeEmail || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {invite.inviteeName || invite.inviteeEmail}
                    </p>
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
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleCopyInviteLink(invite)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title="Copy invite link"
                      >
                        <ClipboardIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResend(invite)}
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
                        onClick={() => handleRevoke(String(invite._id))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        title="Revoke invitation"
                      >
                        <LockClosedIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {isActive && (
                    <button
                      onClick={() => handleRevoke(String(invite._id))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      title="Revoke portal access"
                    >
                      <LockClosedIcon className="w-4 h-4" />
                    </button>
                  )}
                  {/* Delete permanently — available on all statuses */}
                  <button
                    onClick={() => handleDelete(String(invite._id))}
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

      {/* Security Notice */}
      <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="w-5 h-5 text-slate-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Security & Data Protection</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Each invitation contains a unique token that auto-fills the recipient's email on the portal login page.
              Invite links expire after 7 days. All portal data is encrypted at rest (AES-256) and in transit (TLS 1.3).
              {isProperty ? ' Residents' : ' Clients'} can only see information specifically shared with them.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalAccessSettings;
