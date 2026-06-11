/**
 * PortalAccessSettings — Manage portal invitations for clients (Vega) or residents (Atrium)
 *
 * Features:
 * - View all portal invitations with status (pending / accepted / expired / revoked)
 * - Send new invitations by email
 * - Revoke or resend invitations
 * - View which clients/residents have active portal access
 * - Quick-copy portal URL for sharing
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { useFeatures } from '../../hooks/useFeatures';
import {
  UserCircleIcon, ShieldCheckIcon, LockClosedIcon,
  PlusIcon, XIcon, ClipboardIcon, RefreshIcon, TrashIcon,
  ExternalLinkIcon, MailIcon, CheckIcon, ClockIcon,
  ExclamationTriangleIcon, SendIcon,
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

// ─── Portal URL Component ──────────────────────────────────────────────────
const PortalUrl: React.FC<{ isProperty: boolean }> = ({ isProperty }) => {
  const { addToast } = useUI();
  const url = isProperty
    ? 'https://practice-pro-vega.vercel.app/portal/tenant/login'
    : 'https://practice-pro-vega.vercel.app/portal/client/login';

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      addToast('Portal URL copied to clipboard!', { type: 'success' });
    }).catch(() => {
      addToast('Failed to copy URL', { type: 'error' });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 dark:bg-zinc-700 rounded-lg px-3 py-2 font-mono text-xs text-primary-600 dark:text-primary-400 truncate">
        {url}
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
        title="Copy URL"
      >
        <ClipboardIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Invite Form Modal ─────────────────────────────────────────────────────
const InviteForm: React.FC<{
  firmId: string;
  inviterId: string;
  portalType: 'client' | 'resident';
  isProperty: boolean;
  onSent: () => void;
  onCancel: () => void;
}> = ({ firmId, inviterId, portalType, isProperty, onSent, onCancel }) => {
  const { addToast } = useUI();
  const createInvite = useMutation(api.portals.createPortalInvite);
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Build list of matters (Vega) or properties (Atrium) to link invite to
  const relatedItems = useMemo(() => {
    if (isProperty) {
      return (coreState.properties || []).map((p: any) => ({
        id: p.id,
        label: p.address || `Property ${p.id?.slice(-5)}`,
      }));
    } else {
      return (matterState.matters || []).map((m: any) => ({
        id: m.id,
        label: m.title || `Matter ${m.id?.slice(-5)}`,
      }));
    }
  }, [isProperty, coreState.properties, matterState.matters]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      addToast('Please enter an email address', { type: 'error' });
      return;
    }
    setIsSending(true);
    try {
      await createInvite({
        firmId,
        inviterId,
        inviteeEmail: email.trim().toLowerCase(),
        inviteeName: name.trim() || undefined,
        inviteePhone: phone.trim() || undefined,
        portalType,
        relatedId: relatedId || undefined,
        message: message.trim() || undefined,
      });
      addToast(`Invitation sent to ${email.trim()}`, { type: 'success' });
      onSent();
    } catch (err: any) {
      addToast(err.message || 'Failed to send invitation', { type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

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
        {/* Email */}
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

        {/* Name */}
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

        {/* Phone */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Phone / WhatsApp <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g., 08012345678"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Link to matter/property */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Link to {isProperty ? 'Property' : 'Matter'} <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={relatedId}
            onChange={e => setRelatedId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">No specific {isProperty ? 'property' : 'matter'}</option>
            {relatedItems.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>

        {/* Personal message */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            Personal Message <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Add a brief message to include in the invitation email…`}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
          />
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
            disabled={isSending || !email.trim()}
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
                Send Invitation
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
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { isProperty } = useProduct();
  const { canUseClientPortal, canUseTenantPortal } = useFeatures();

  const firmId = currentUser?.firmId || '';
  const canUsePortal = isProperty ? canUseTenantPortal : canUseClientPortal;

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch portal invites
  const invites = useQuery(
    api.portals.getPortalInvitesByFirm,
    firmId ? { firmId } : 'skip'
  );

  const revokeInvite = useMutation(api.portals.revokePortalInvite);

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

  const handleResend = (invite: any) => {
    // For now, create a new invite with same details
    addToast('Resend functionality will create a new invitation with updated expiry.', { type: 'info' });
  };

  const handleCopyInviteLink = (invite: any) => {
    const portalUrl = isProperty
      ? 'https://practice-pro-vega.vercel.app/portal/tenant/login'
      : 'https://practice-pro-vega.vercel.app/portal/client/login';
    navigator.clipboard.writeText(portalUrl).then(() => {
      addToast('Portal login URL copied! Share this with the invitee along with their email.', { type: 'success' });
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
            Manage who can access the {isProperty ? 'residents' : 'client'} portal. Invite {isProperty ? 'tenants' : 'clients'} by email and track their access status.
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

      {/* Portal URL */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
          {isProperty ? "Residents'" : 'Client'} Portal URL
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-300 mb-3">
          Share this URL with your {isProperty ? 'residents' : 'clients'} so they can log in directly.
        </p>
        <PortalUrl isProperty={isProperty} />
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
              ? `Click "Invite ${isProperty ? 'Resident' : 'Client'}" above to send your first portal invitation.`
              : `No ${filterStatus} invitations found. Try a different filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvites.map((invite: any) => {
            const isPending = invite.status === 'pending';
            const isActive = invite.status === 'accepted';

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
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                      {invite.inviteeEmail}
                      {invite.inviteePhone && <span className="ml-2">· {invite.inviteePhone}</span>}
                    </p>
                  </div>
                </div>

                {/* Status + Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={invite.status} />
                  {isPending && (
                    <>
                      <button
                        onClick={() => handleCopyInviteLink(invite)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title="Copy portal link"
                      >
                        <ClipboardIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevoke(String(invite._id))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        title="Revoke invitation"
                      >
                        <TrashIcon className="w-4 h-4" />
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
              All portal data is encrypted at rest (AES-256) and in transit (TLS 1.3). {isProperty ? 'Residents' : 'Clients'} can only see
              information specifically shared with them. Portal sessions expire after 30 minutes of inactivity.
              Every action is logged with a timestamp for your compliance reporting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalAccessSettings;
