/**
 * SecurityAccessView — explains the security architecture of PracticePro's
 * access code generation, verification, and overall security model.
 *
 * This is a USER-FACING page (for firm admins/lawyers/property managers)
 * that explains:
 * - How access codes are generated (algorithm, collision detection)
 * - Who verifies the code (gatekeeper interface)
 * - How the code can be shipped as a product (deployment, configuration)
 * - Data isolation between firms, properties, and residents
 * - Audit trail and logging
 * - Privacy guarantees
 *
 * This page serves both as user documentation AND as a product spec
 * that helps stakeholders understand the security architecture.
 */
import React from 'react';
import { Shield, KeyRound, Eye, FileCheck, Lock, Server, Smartphone, Wifi } from 'lucide-react';

interface SecurityAccessViewProps {
  onBack?: () => void;
}

const SecurityAccessView: React.FC<SecurityAccessViewProps> = ({ onBack }) => {
  const securityPillars = [
    {
      icon: <KeyRound className="w-5 h-5" />,
      title: 'Code Generation',
      status: 'Production-Ready',
      description: 'Access codes are 6-digit numeric tokens generated server-side using a combination of Math.random() entropy and Date.now() timestamp mixing. Before a code is committed, the system checks for collisions against all active tokens in the same property over a 24-hour window — retrying up to 10 times until a unique code is found. This guarantees no two visitors to the same property will ever have the same active code simultaneously.',
      technicalDetails: [
        'Algorithm: Math.random() × 2 + Date.now() entropy, zero-padded to 6 digits',
        'Collision check: by_property_code index, 24h window, max 10 retries',
        'Storage: visitor_tokens table with 10 indexes for fast lookup',
        'Expiry: configurable (2/6/12/24 hours), default from portal_settings.vmsDefaultExpiryHours',
      ],
    },
    {
      icon: <Eye className="w-5 h-5" />,
      title: 'Code Verification',
      status: 'Production-Ready',
      description: 'When a visitor arrives, the gatekeeper enters the 6-digit code at the gatehouse terminal (a public, unauthenticated web page at /gatehouse?firmId=xxx). The system verifies the code against active tokens, checks validity (not expired, not revoked, not already used), and returns the visitor name, host name, and unit number. The gatekeeper then approves entry, which logs the check-in with a timestamp.',
      technicalDetails: [
        'Verification: verifyToken query (public, no auth required)',
        'Grace period: configurable (default 30 min) to accommodate slight delays',
        'States checked: active, expired, revoked, used, already_inside, not_yet_valid',
        'Offline fallback: last 100 verified tokens cached in localStorage',
      ],
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: 'Data Isolation',
      status: 'Always Active',
      description: 'Every access code is scoped to a specific firmId + propertyId + unitId. The verifyToken query only returns data for the property the gatekeeper is configured for. Residents can only see and revoke their own codes — the getResidentTokens query filters by residentId. The gatekeeper never sees financial data, messages, or any information beyond what is needed for entry (visitor name, host, unit).',
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
        'Delivery: client_share (free, resident shares via WhatsApp) or portal_api (system sends via Chakra API)',
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
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
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
        </div>
      </div>
    </div>
  );
};

export default SecurityAccessView;
