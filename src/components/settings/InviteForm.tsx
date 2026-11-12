import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useAction, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import { usePropertyGroups, PropertyGroup } from '../../hooks/usePropertyGroups';
import { useUI } from '../../contexts/UIContext';
import { OfficeBuildingIcon, UsersIcon, XIcon, MailIcon, DeviceMobileIcon, SendIcon, CheckCircleIcon, ClipboardIcon } from '../../constants';
import { translateError } from '../../utils/errorTranslator';
import { whatsappShareUrl } from '../../utils/whatsappShare';
import { portalInviteUrl, portalSetupPasswordBase } from '../../utils/portalOrigins';

/**
 * InviteForm — the ONE portal-invite composer (UX-24 extraction).
 *
 * Previously a local component of PortalAccessSettings (the ONLY invite
 * entry point in the product); now a module so ContactDetailView can open
 * it directly ("Invite to Client Portal") with the contact's identity
 * prefilled. Same behavior, same WhatsApp/email channels, same security
 * firewall (staff-email conflict check, caller identity on
 * createPortalInvite).
 */

export const InviteForm: React.FC<{
  firmId: string;
  inviterId: string;
  portalType: 'client' | 'resident';
  onSent: () => void;
  onCancel: () => void;
  /** UX-24: prefilled contact identity when the form is opened from a
   *  contact's page ("Invite to Client Portal") instead of Settings. */
  initialEmail?: string;
  initialName?: string;
  initialPhone?: string;
}> = ({ firmId, inviterId, portalType, onSent, onCancel, initialEmail = '', initialName = '', initialPhone = '' }) => {
  const { bearerToken } = useAuth();
  const { addToast } = useUI();
  const convex = useConvex();
  const { currentUser } = useAuth() as any; // round 8: caller identity for createPortalInvite
  const sendInvite = useAction(api.portals.createPortalInvite);
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();

  const isProperty = portalType === 'resident';

  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [relatedId, setRelatedId] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [isSending, setIsSending] = useState(false);
  const [isNameAutoFilled, setIsNameAutoFilled] = useState(false);
  // WHATSAPP MANUAL SHARE — populated when a whatsapp-channel invite wasn't
  // delivered by the (retired) API; renders the wa.me handoff card below.
  const [manualWaShare, setManualWaShare] = useState<{ url: string; link: string } | null>(null);

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

    // ─── SECURITY FIREWALL: Pre-flight email conflict check ────────────
    // Before creating any invitation, check if the email is already
    // registered as an internal staff member (Admin/Lawyer/Paralegal).
    // If so, BLOCK the invitation entirely — this prevents cross-portal
    // session contamination where a portal link could grant admin access.
    if (email.trim()) {
      try {
        const conflictCheck = await convex.query(api.portalSecurity.checkEmailForPortalConflict, {
          email: email.trim().toLowerCase(),
          firmId,
        });
        if (conflictCheck.hasConflict) {
          addToast(
            `Security: This email is already registered as ${conflictCheck.role === 'Admin' ? 'an administrator' : 'a ' + String(conflictCheck.role ?? 'unknown').toLowerCase()} account (${conflictCheck.name}). Portal access cannot be granted to internal staff. Please use a different email address.`,
            { type: 'error', duration: 8000 }
          );
          setIsSending(false);
          return;
        }
      } catch (e) {
        // If the check fails, proceed — the backend setupPortalPassword
        // has its own defense-in-depth check that will catch it.
        console.warn('[PortalAccess] Pre-flight email check failed:', e);
      }
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
        userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || undefined,
        // UX-12 (Phase 1): tell the server which deployment is sending, so
        // the invite link matches it (allowlisted server-side) instead of
        // always routing to the Vega-branded production domain.
        origin: window.location.origin,
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
      // User-friendly message — no technical jargon about API keys or environment variables.
      // If email wasn't sent, the message says so plainly and suggests contacting support.
      const simulatedSuffix = isSimulated
          ? '. The email could not be delivered — please contact support to complete email setup.'
          : '';
      addToast(`Invitation created — ${feedback}${simulatedSuffix}`, { type: toastType });

      // WHATSAPP MANUAL SHARE (2026-09-14): the WhatsApp API integration is
      // retired — automated invites can't be delivered to phones anymore.
      // The next-best-thing handoff: we already generated the invite token;
      // offer a one-tap wa.me link (message prefilled to the resident's
      // number) + a copyable invite link. The admin reviews & sends.
      const wantsWhatsApp = channel === 'whatsapp' || channel === 'both';
      const waNotDelivered = wantsWhatsApp && !result.whatsappSent;
      if (waNotDelivered && result.token) {
        const portalName = isProperty ? "Residents' Portal" : 'Client Portal';
        // UX-12 (Phase 1): the share link is the EXACT link the email would
        // carry (server-returned inviteUrl) with the client resolver as
        // fallback — never a divergent hard-coded domain.
        const inviteLink = result.inviteUrl || portalInviteUrl(result.token, window.location.origin);
        const shareText = `PracticePro ${portalName} Invitation\n\nHello ${name.trim() || email.trim() || ''}, you've been invited to the ${portalName}.\n\nClick here to access: ${inviteLink}\n\nThis link expires in 30 days.\n\n— PracticePro`;
        setManualWaShare({
          url: whatsappShareUrl(phone.trim(), shareText),
          link: inviteLink,
        });
      } else {
        setManualWaShare(null);
      }
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
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 sm:p-6">
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
            <p className="text-2xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
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
                <p className="text-2xs text-primary-600 dark:text-primary-400 mt-1 font-medium">
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
                <p className="text-2xs text-primary-600 dark:text-primary-400 mt-1 font-medium">
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

      {/* ── WHATSAPP HANDOFF CARD (2026-09-14) ──────────────────────────
          The WhatsApp API integration is retired. When an invite couldn't
          be delivered automatically to the phone, show the generated invite
          with a one-tap "Open WhatsApp" (message prefilled — the resident
          just taps send) and a copyable link. Codes/tokens are generated by
          the app either way; only the transport is manual now. */}
      {manualWaShare && (
        <div className="mt-4 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-900/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <DeviceMobileIcon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Invitation ready — send it on WhatsApp</p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 leading-relaxed">
                Automated WhatsApp sending is no longer available, so we prepared the message for you.
                Tap below to open WhatsApp with the invitation (and the secure link) already typed to{' '}
                {phone.trim() || 'the recipient'} — just review and press send.
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <a
                  href={manualWaShare.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Open WhatsApp
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(manualWaShare.link).then(() => {
                      addToast('Invite link copied — paste it in any chat or email.', { type: 'success' });
                    }).catch(() => {
                      addToast('Copy failed — select the link text manually.', { type: 'error' });
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <ClipboardIcon className="w-4 h-4" />
                  Copy invite link
                </button>
              </div>
            </div>
            <button
              onClick={() => setManualWaShare(null)}
              className="p-1.5 rounded-lg text-emerald-500/70 hover:text-emerald-700 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 transition-colors flex-shrink-0"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Invite List ────────────────────────────────────────────────────────────
