/**
 * SecurityAccessView — the VMS (SentryPass) surface for firm admins.
 *
 * ENTITLEMENT GATING (2026-11-27): VMS access is a paid + founder-approved
 * add-on. The capability lives on the workspace record (firms.vmsEnabled /
 * firms.vmsRequestStatus) and is enforced server-side by
 * assertVmsEntitlement (convex/visitorManagement.ts) on every VMS query and
 * mutation. This view renders the matching screen per product:
 *
 *   • Vega (legal-only)      → Forbidden — VMS is not applicable.
 *   • Komplete (unified)     → excluded by default; tailored Request Access
 *                             screen (VMS is built for dedicated facilities/
 *                             estate-management teams; requests still welcome
 *                             from firms that manage physical estate security).
 *   • Atrium (property)     → approval-required PAID add-on: the paywall
 *                             (annual pricing / tier details) + Request
 *                             Access form; founder approval unlocks it.
 *   • vmsEnabled === true   → the full architecture documentation + live
 *                             panels (Sentry reports, gatehouse stations,
 *                             staff passes) below.
 *
 * The old body (code generation / verification / data isolation / audit
 * trail docs) is unchanged and renders only for entitled workspaces.
 */
import React from 'react';
import { Shield, KeyRound, Eye, FileCheck, Lock, Server, Smartphone, Wifi, Building2, ClipboardList, Ban, CheckCircle2, Clock } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button, Input, Textarea } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { SentryReportsPanel } from './settings/SentryReportsPanel';
import { GatehouseAccountsPanel } from './settings/GatehouseAccountsPanel';
import { StaffPassesPanel } from './settings/StaffPassesPanel';

interface SecurityAccessViewProps {
  onBack?: () => void;
}

// ─── Vega: hard Forbidden screen ───────────────────────────────────────
const VmsForbiddenScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-6 sm:p-8 text-center shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-4">
        <Ban className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">VMS (SentryPass) is not available on this workspace</h2>
      <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-xl mx-auto mb-6">
        SentryPass is an Atrium estate-operations add-on — visitor access codes, gatehouse
        verification, and estate security reporting. It is not applicable to legal-only (Vega)
        workspaces, so the section is hidden from navigation and direct routes are rejected on
        the backend as well.
      </p>
      {onBack && (
        <Button variant="secondary" size="md" onClick={onBack}>
          Go back
        </Button>
      )}
    </div>
  </div>
);

// ─── Request Access: the lightweight qualification form ────────────────
// 2–3 quick questions per the founder-review flow: Property/Estate Name,
// Approximate Number of Units/Gates, Brief Use Case.
const VmsRequestAccessForm: React.FC<{
  productMode: 'property' | 'unified';
  onSubmit: (form: { estateName: string; unitCount: string; useCase: string }) => Promise<void>;
  busy: boolean;
  error: string | null;
}> = ({ productMode, onSubmit, busy, error }) => {
  const [estateName, setEstateName] = React.useState('');
  const [unitCount, setUnitCount] = React.useState('');
  const [useCase, setUseCase] = React.useState('');
  const isAtrium = productMode === 'property';

  return (
    <form
      className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 sm:p-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        onSubmit({ estateName: estateName.trim(), unitCount: unitCount.trim(), useCase: useCase.trim() });
      }}
    >
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <ClipboardList className="w-4 h-4 text-primary-500" />
          Request VMS access
        </h3>
        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          {isAtrium
            ? 'Three quick questions — the founder reviews each estate and follows up with activation and pricing details.'
            : 'Three quick questions — the founder reviews each request and follows up with a message.'}
        </p>
      </div>
      <Input
        label="Property / Estate Name"
        placeholder="e.g. Lekki Gardens Estate, Phase 2"
        value={estateName}
        onChange={(e) => setEstateName(e.target.value)}
        required
        maxLength={120}
        containerClassName=""
      />
      <Input
        label="Approximate Number of Units / Gates"
        placeholder="e.g. 120 units across 2 gates"
        value={unitCount}
        onChange={(e) => setUnitCount(e.target.value)}
        required
        maxLength={60}
      />
      <Textarea
        label="Brief Use Case"
        placeholder={
          isAtrium
            ? 'e.g. We manage 3 gated estates and need verifiable visitor codes at the main gates.'
            : 'e.g. Alongside legal work we manage physical estate security for two gated properties.'
        }
        value={useCase}
        onChange={(e) => setUseCase(e.target.value)}
        required
        maxLength={600}
        rows={3}
      />
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">{error}</p>
      )}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-2xs text-slate-400 dark:text-zinc-500 hidden sm:block">
          Submitted to the founder for review — you'll be notified in-app and by email.
        </p>
        <Button type="submit" variant="primary" size="md" loading={busy} className="flex-shrink-0">
          {busy ? 'Submitting…' : 'Submit Request'}
        </Button>
      </div>
    </form>
  );
};

// ─── The gated hub: paywall / request / pending / declined / enabled ───
const VmsAccessGate: React.FC<{
  onBack?: () => void;
  children: React.ReactNode; // the entitled docs body
}> = ({ onBack, children }) => {
  const { currentUser, bearerToken } = useAuth();
  const { hasPropertyFeatures } = useProduct();
  const firmId = currentUser?.firmId || '';
  const sessionToken = bearerToken ?? undefined;
  const userEmail = currentUser?.email;

  const state = useQuery(
    api.myFunctions.getVmsAccessState,
    firmId && userEmail ? { firmId, userEmail, sessionToken } : 'skip'
  ) as any;

  const submitRequest = useMutation(api.myFunctions.submitVmsAccessRequest);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = React.useState(false);

  // No firm on the account (or still resolving) — nothing to gate on yet.
  if (!firmId || !hasPropertyFeatures || state === undefined) {
    if (hasPropertyFeatures && firmId && state === undefined) {
      // Loading the entitlement state.
      return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4 animate-pulse">
            <div className="h-8 w-64 bg-slate-200 dark:bg-zinc-700 rounded" />
            <div className="h-40 bg-slate-100 dark:bg-zinc-800/60 rounded-2xl" />
          </div>
        </div>
      );
    }
    // Legal-only product (or no firm context) — VMS is not applicable.
    return (
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-20">
        <VmsForbiddenScreen onBack={onBack} />
      </div>
    );
  }

  // Vega (defense-in-depth — the query returns productMode 'legal').
  if (state?.productMode === 'legal') {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-20">
        <VmsForbiddenScreen onBack={onBack} />
      </div>
    );
  }

  // ENTITLED — the full docs + live panels.
  if (state?.vmsEnabled === true) {
    return <>{children}</>;
  }

  // ─── Not enabled: paywall (Atrium) / tailored notice (Komplete) ────
  const isAtrium = state?.productMode === 'property';
  const requestStatus: string = state?.vmsRequestStatus || 'none';
  const request = state?.vmsRequest || null;

  const handleSubmit = async (form: { estateName: string; unitCount: string; useCase: string }) => {
    if (!firmId || !userEmail) return;
    setBusy(true);
    setError(null);
    try {
      await submitRequest({ firmId, userEmail, sessionToken, ...form });
      setJustSubmitted(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to submit the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-200 dark:border-zinc-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {onBack && (
            <Button
              variant="bare"
              size="sm"
              iconOnly
              aria-label="Back"
              onClick={onBack}
              className="p-2 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              VMS (SentryPass)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
              Visitor access codes · Gatehouse verification · Estate security reports
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* PENDING — request received, under founder review */}
        {(justSubmitted || requestStatus === 'pending') && !error && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-amber-200 dark:border-amber-900/40 p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Request received — under founder review</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
                  {isAtrium
                    ? 'Your request to enable VMS (SentryPass) has been received. The founder will review your estate details and follow up shortly with activation and pricing details.'
                    : 'VMS (SentryPass) is typically reserved for dedicated facilities and estate management teams rather than Komplete workspaces — however, we\u2019ve logged your request and you\u2019ll receive a message from the founder shortly.'}
                </p>
              </div>
            </div>
            {request && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Property / Estate</p>
                  <p className="text-sm text-slate-700 dark:text-zinc-300">{request.estateName}</p>
                </div>
                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Units / Gates</p>
                  <p className="text-sm text-slate-700 dark:text-zinc-300">{request.unitCount}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Use Case</p>
                  <p className="text-sm text-slate-700 dark:text-zinc-300">{request.useCase}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Submitted</p>
                  <p className="text-sm text-slate-700 dark:text-zinc-300">
                    {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : '—'}
                    {request.requestedBy ? ` · ${request.requestedBy}` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DECLINED — honest state + re-request path */}
        {requestStatus === 'declined' && !justSubmitted && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-rose-200 dark:border-rose-900/40 p-5 sm:p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base mb-2">Request not approved at this time</h3>
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              The founder declined this workspace\u2019s VMS request.
              {request?.decisionNote ? ` Note: ${request.decisionNote}` : ''} You can submit a
              new request below if your estate operations change.
            </p>
          </div>
        )}

        {/* PAYWALL — Atrium only: approval-required paid add-on */}
        {isAtrium && requestStatus !== 'pending' && !justSubmitted && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-black dark:to-zinc-950 text-white rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-lg font-bold">VMS (SentryPass) — Estate Operations Add-On</h2>
                  <span className="text-2xs font-bold bg-amber-400/90 text-slate-900 px-2 py-0.5 rounded uppercase tracking-wider">Approval Required</span>
                </div>
                <p className="text-sm text-white/85 leading-relaxed mb-4">
                  Verifiable 6-digit visitor codes generated by residents, verified at the gatehouse
                  terminal, with full audit trail, staff passes, and Sentry security reports. Sold as
                  a separately-billed annual add-on for Atrium workspaces — activated after founder
                  review of your estate.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-2xs font-bold text-white/60 uppercase tracking-wider mb-1">Standard estates</p>
                    <p className="text-xl font-black">₦90,000<span className="text-sm font-normal text-white/70">/year</span></p>
                    <p className="text-2xs text-white/60 mt-1">₦7,500/mo equivalent · up to 50 units</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-2xs font-bold text-white/60 uppercase tracking-wider mb-1">Large / multi-estate</p>
                    <p className="text-xl font-black">Custom quote</p>
                    <p className="text-2xs text-white/60 mt-1">Per estate/unit tier · arranged with the founder</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KOMPLETE tailored notice — excluded by default, request still possible */}
        {!isAtrium && requestStatus !== 'pending' && !justSubmitted && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex-shrink-0">
                <Building2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">An estate-operations add-on — not part of Komplete</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
                  VMS (SentryPass) is designed for dedicated facilities and estate-management
                  teams — resident-generated visitor codes verified at staffed gates — rather than
                  standard legal-property practice, so it is excluded from Komplete by default. If
                  your firm directly manages physical estate security, you can still request it:
                  the founder reviews each case and follows up personally.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* The form — shown unless a request is already pending (or just submitted) */}
        {requestStatus !== 'pending' && (
          <VmsRequestAccessForm productMode={isAtrium ? 'property' : 'unified'} onSubmit={handleSubmit} busy={busy} error={error} />
        )}

        {/* What's inside — shared feature recap for both products */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 sm:p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3">What\u2019s inside once activated</h3>
          <ul className="space-y-2">
            {[
              'Residents generate cryptographically-secure 6-digit visitor codes with configurable validity (2–24h) and a 30-min grace period.',
              'Gatehouse terminal (no login needed) verifies codes at the gate — optionally locked to a provisioned station PIN.',
              'Staff passes with gate check-in/check-out attendance logs for workers and service personnel.',
              'Sentry reports: daily visitor log, on-site occupancy, historical records, and denied-entry security reports.',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const SecurityAccessView: React.FC<SecurityAccessViewProps> = ({ onBack }) => {
  const securityPillars = [
    {
      icon: <KeyRound className="w-5 h-5" />,
      title: 'Code Generation',
      status: 'Production-Ready',
      description: 'Access codes are 6-digit numeric tokens generated server-side using cryptographically secure randomness (crypto-secure rejection sampling — never Math.random). Before a code is committed, the system checks for collisions against all active tokens in the same property over a 24-hour window — retrying up to 10 times until a unique code is found. This guarantees no two visitors to the same property will ever have the same active code simultaneously.',
      technicalDetails: [
        'Algorithm: crypto-secure rejection sampling, zero-padded to 6 digits',
        'Collision check: by_property_code index, 24h window, max 10 retries',
        'Storage: visitor_tokens table with 11 indexes for fast lookup',
        'Expiry: configurable (2/6/12/24 hours), default from portal_settings.vmsDefaultExpiryHours',
      ],
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: 'Code Verification',
      status: 'Production-Ready',
      description: 'When a visitor arrives, the gatekeeper enters the 6-digit code (or the 12-character Pass ID) at the gatehouse terminal (/gatehouse). The system verifies the code against active tokens, checks validity (not expired, not revoked, not already used), and returns the visitor name, host name, and unit number. The gatekeeper then approves entry, which logs the check-in with a timestamp. TASK 94 (2026-11-25): the terminal can be LOCKED — once the estate admin provisions a Gatehouse Station (below), the terminal requires the station\u2019s PIN and every gate endpoint validates the station session.',
      technicalDetails: [
        'Verification: verifyToken endpoint (public; station-gated when the estate has active stations; Round 20 — a mutation, because its throttle writes)',
        'Grace period: configurable (default 30 min) to accommodate slight delays',
        'States checked: active, expired, revoked, used, already_inside, not_yet_valid',
        'Offline fallback: last 100 verified tokens cached in localStorage',
      ],
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: 'Data Isolation',
      status: 'Always Active',
      description: 'Every access code is scoped to a specific firmId + propertyId + unitId. The verifyToken endpoint only returns data for the property the gatekeeper is configured for. Residents can only see and revoke their own codes — the getResidentTokens query filters by residentId. The gatekeeper never sees financial data, messages, or any information beyond what is needed for entry (visitor name, host, unit).',
      technicalDetails: [
        'Firm-level isolation: every query/mutation requires firmId context',
        'Resident-level isolation: getResidentTokens filters by residentId',
        'Gatekeeper isolation: verifyToken only returns entry-minimum data',
        'No cross-firm data access: enforced at the Convex query level',
      ],
    },
    {
      icon: <FileCheck className="w-5 h-5" />,
      title: 'Audit Trail',
      status: 'Always Active',
      description: 'Every action in the VMS lifecycle is logged with a timestamp: code generation, code verification, check-in, check-out, and revocation. This audit trail is available to the firm admin for security investigations and dispute resolution. The logs are stored in the visitor_tokens table itself (status, checkedInAt, checkedOutAt, revokedAt fields) and are never deleted — only archived.',
      technicalDetails: [
        'Logged events: generate, verify, check-in, check-out, revoke',
        'Storage: visitor_tokens table (status transitions + timestamps)',
        'Retention: indefinite (no auto-deletion)',
        'Access: firm admin via Portal Access Settings',
      ],
    },
    {
      icon: <Server className="w-5 h-5" />,
      title: 'Backend Security',
      status: 'Always Active',
      description: 'The VMS backend runs on Convex, a serverless database with built-in row-level security. All mutations (generateVisitorToken, revokeVisitorToken, checkInVisitor, checkOutVisitor) validate their inputs and check ownership before writing. The cleanupExpiredTokens cron job runs every 15 minutes to mark expired tokens, preventing stale codes from being used.',
      technicalDetails: [
        'Platform: Convex serverless (automatic scaling, no servers to manage)',
        'RLS: requireFirmUser() on all protected mutations',
        'Cron: cleanupExpiredTokens every 15 minutes',
        'Validation: Convex validators on all args (types, ranges, required fields)',
      ],
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Product Shipping',
      status: 'Configurable',
      description: 'The VMS is shipped as a configurable feature, not a separate product. Firm admins enable it in Portal Access Settings, which toggles vmsEnabled in the portal_settings table. Once enabled, residents see the Visitors tab in their portal and can generate codes immediately. The gatehouse URL (/gatehouse?firmId=xxx) can be shared with security guards — no PracticePro account needed.',
      technicalDetails: [
        'Enable: Portal Access Settings → Visitor Management System → Enable',
        'Config: vmsEnabled, vmsGracePeriodMinutes, vmsDefaultExpiryHours',
        'Notifications: vmsGatekeeperNotifications, vmsResidentNotifications',
        'Delivery: client_share (free, resident shares via WhatsApp) or portal_api (system sends via WhatsApp API)',
      ],
    },
  ];

  const deploymentSteps = [
    {
      step: 1,
      title: 'Enable VMS in Portal Settings',
      description: 'Firm admin navigates to Settings → Portal Access → Visitor Management System and toggles "Enable Visitor Codes". Configures grace period (default 30 min) and default expiry (default 6 hours).',
      actor: 'Firm Admin',
    },
    {
      step: 2,
      title: 'Share Gatehouse URL',
      description: 'Firm admin shares the gatehouse URL (/gatehouse?firmId=xxx) with their security guards. The URL can be bookmarked on a tablet or phone at the gatehouse. No login required.',
      actor: 'Firm Admin',
    },
    {
      step: 3,
      title: 'Residents Generate Codes',
      description: 'Residents open the Visitors tab in their portal, enter visitor name + phone, choose expiry window, and share the code via WhatsApp (either manually or the system sends it).',
      actor: 'Resident',
    },
    {
      step: 4,
      title: 'Gatekeeper Verifies',
      description: 'When a visitor arrives, the gatekeeper enters the 6-digit code at the gatehouse terminal. The system shows the visitor name, host, and unit. The gatekeeper approves entry.',
      actor: 'Gatekeeper',
    },
    {
      step: 5,
      title: 'Audit & Monitor',
      description: 'All activity is logged. Firm admins can review the audit trail in Portal Access Settings. Expired codes are auto-cleaned every 15 minutes.',
      actor: 'Firm Admin',
    },
  ];

  return (
    // ENTITLEMENT GATE (2026-11-27): the body below is the entitled docs +
    // live-panels view — VmsAccessGate renders the Forbidden / paywall /
    // request / pending screens for workspaces without vmsEnabled.
    <VmsAccessGate onBack={onBack}>
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-slate-200 dark:border-zinc-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Security & Access Architecture
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
              How access codes are generated, verified, and shipped as a product
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Overview Hero */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-black dark:to-zinc-950 text-white rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-2">PracticePro Visitor Management System</h2>
              <p className="text-sm text-white/85 leading-relaxed">
                A secure, verifiable access code system that lets residents grant
                temporary entry to their visitors. Codes are generated with
                collision detection, verified at the gatehouse, and logged for
                audit — giving property managers full visibility and residents
                full control.
              </p>
            </div>
          </div>
        </div>

        {/* Security Pillars */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Security Pillars</h2>
          <div className="space-y-4">
            {securityPillars.map((pillar, idx) => (
              <div key={idx} className="bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-zinc-700">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    {pillar.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{pillar.title}</h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        pillar.status === 'Production-Ready' || pillar.status === 'Always Active'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {pillar.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-3">
                      {pillar.description}
                    </p>
                    <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-slate-100 dark:border-zinc-700/50">
                      <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2">Technical Details</p>
                      <ul className="space-y-1">
                        {pillar.technicalDetails.map((detail, i) => (
                          <li key={i} className="text-xs text-slate-600 dark:text-zinc-400 flex items-start gap-2">
                            <span className="text-emerald-500 flex-shrink-0 mt-0.5">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deployment Steps */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">How to Ship This Feature</h2>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-zinc-700">
            <div className="space-y-4">
              {deploymentSteps.map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
                      <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-full">
                        {item.actor}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy & Compliance */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-2">Privacy & Data Protection</h3>
              <ul className="space-y-2">
                <li className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                  <strong>Minimum data sharing:</strong> The gatekeeper only sees the visitor name, host name, and unit number — never financial data, messages, or personal information beyond what is needed for entry.
                </li>
                <li className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                  <strong>No cross-resident visibility:</strong> Residents can only see and revoke their own codes. One resident cannot see another resident's visitor history.
                </li>
                <li className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                  <strong>Encrypted in transit:</strong> All API calls use HTTPS/WSS. Convex enforces TLS for all connections.
                </li>
                <li className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                  <strong>Right to revoke:</strong> Residents can revoke any active code at any time. Revoked codes are immediately rejected at the gatehouse.
                </li>
                <li className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                  <strong>Audit trail:</strong> All actions are logged indefinitely for security investigations and dispute resolution.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Platform Architecture */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Platform Architecture</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Backend</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Convex serverless database. Automatic scaling, built-in row-level
                security, real-time sync. No servers to manage.
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Clients</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Resident portal (web + APK), gatehouse terminal (public web page),
                firm admin app (APK). All share the same Convex backend.
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Connectivity</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Online-first with offline fallback. Gatehouse caches last 100
                verified tokens in localStorage for network-outage resilience.
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Compliance</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                NDPR-compliant (Nigeria Data Protection Regulation). Data is
                scoped to the firm, never shared across tenants.
              </p>
            </div>
          </div>

          {/* ROUND SENTRY 5: the live §5 report suite (daily / on-site /
              historical / security). Each pull is authenticated and
              audit-logged before the data is returned. */}
          <div className="mt-8">
            <SentryReportsPanel />
          </div>

          {/* TASK 94 (2026-11-25): gatehouse station provisioning + the
              quiet staff time-tracking surface. The station panel is the
              owner's test path — provision “Main Gate”, copy the terminal
              URL, walk to /gatehouse and log in with the PIN. */}
          <div className="mt-8 space-y-8">
            <GatehouseAccountsPanel />
            <StaffPassesPanel />
          </div>
        </div>
      </div>
    </div>
    </VmsAccessGate>
  );
};

export default SecurityAccessView;
