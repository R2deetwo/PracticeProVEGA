/**
 * TenantPortal Help & Support tab — security & privacy, resident guide/FAQs, contact PM.
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React, { useState } from 'react';
import NairaSymbol from '../../NairaSymbol';
import { OfficeBuildingIcon, DownloadIcon, MailIcon, VisitorIcon, HelpCircleIcon } from '../../../constants';
import { Shield as ShieldIcon } from 'lucide-react';
import { type TabId, WrenchIcon, ChatIcon } from './shared';

export const HelpAndSupportTab: React.FC<{
  tenantInfo: any;
  portalSettings: any;
  onNavigate: (tab: TabId) => void;
}> = ({ tenantInfo, portalSettings, onNavigate }) => {
  const [openSection, setOpenSection] = useState<string | null>('security');

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const securityFeatures = [
    {
      icon: <ShieldIcon className="w-5 h-5" />,
      title: 'Code Generation',
      description: 'Access codes are 6-digit numeric tokens generated using a cryptographically-informed algorithm with collision detection. Each code is unique within a 24-hour window for your property, preventing duplicate or guessed codes.',
      status: portalSettings?.vmsEnabled ? 'Active' : 'Available on Request',
    },
    {
      icon: <VisitorIcon className="w-5 h-5" />,
      title: 'Code Verification',
      description: 'When a visitor arrives, the gatekeeper enters the code at the Sentry Pass terminal. The system verifies the code against active tokens, checks validity (not expired, not revoked, not already used), and logs the check-in with a timestamp.',
      status: portalSettings?.vmsEnabled ? 'Active' : 'Available on Request',
    },
    {
      icon: <ShieldIcon className="w-5 h-5" />,
      title: 'Data Isolation',
      description: 'Your access codes are scoped to your property and unit. Other residents cannot see your codes, and you cannot see theirs. The gatekeeper only sees the visitor name, host (you), and unit — never your financial data or personal information beyond what is needed for entry.',
      status: 'Always Active',
    },
    {
      icon: <ShieldIcon className="w-5 h-5" />,
      title: 'Code Revocation',
      description: 'You can revoke any active access code at any time from the Visitors tab. Revoked codes are immediately rejected at the Sentry Pass. This gives you full control over who can enter, even after a code has been shared.',
      status: portalSettings?.vmsEnabled ? 'Active' : 'Available on Request',
    },
    {
      icon: <ShieldIcon className="w-5 h-5" />,
      title: 'Audit Trail',
      description: 'Every access code generation, verification, check-in, check-out, and revocation is logged with a timestamp. This audit trail is available to your property manager for security investigations and dispute resolution.',
      status: 'Always Active',
    },
    {
      icon: <ShieldIcon className="w-5 h-5" />,
      title: 'Grace Period',
      description: `Codes have a configurable grace period (default: ${portalSettings?.vmsGracePeriodMinutes || 30} minutes) to accommodate slight delays. A code valid until 6:00 PM will still work at 6:25 PM, preventing unnecessary turn-aways at the gate.`,
      status: portalSettings?.vmsEnabled ? 'Active' : 'Available on Request',
    },
  ];

  const faqs = [
    {
      q: 'How do I make a payment?',
      a: 'Go to the Payments tab, upload your payment proof (bank transfer receipt, POS slip, or cash deposit confirmation). Your property manager will verify and issue a receipt automatically. You can track payment status in the Ledger tab.',
    },
    {
      q: 'How do I log a maintenance ticket?',
      a: 'Open the Maintenance tab, tap "New Request", describe the issue, attach photos if needed, and submit. Your property manager will be notified instantly. You can track the status of all your maintenance requests in the same tab.',
    },
    {
      q: 'How do I generate a visitor pass?',
      a: 'Go to the Visitors tab, tap "Generate Access Code", enter your visitor\'s name and phone number, choose how long the code should be valid (2, 6, 12, or 24 hours), and share the code with your visitor via WhatsApp or SMS. The gatekeeper will verify the code at the Sentry Pass.',
    },
    {
      q: 'How do I view my receipts?',
      a: 'Open the Receipts tab to see all your payment receipts. You can download or print any receipt as a PDF. Receipts are generated automatically when your property manager confirms your payment.',
    },
    {
      q: 'How do I check my outstanding balance?',
      a: 'Your outstanding balance is shown on the Home dashboard at the top. Tap it to see a full breakdown in the Ledger tab, including service charges, rent, and minimum vend if applicable.',
    },
    {
      q: 'How do I contact my property manager?',
      a: 'If messaging is enabled, use the Messages tab to send a direct message. You can also find their contact details in the "Contact Property Manager" section below.',
    },
  ];

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-black dark:to-zinc-950 text-white rounded-premium p-5 shadow-premium">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
            <HelpCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xs font-bold text-white/85 uppercase tracking-widest">Help & Support</p>
            <h2 className="text-xl font-bold tracking-tight">How can we help?</h2>
          </div>
        </div>
        <p className="text-sm text-white/85 leading-relaxed">
          Find answers to common questions, learn about our security architecture,
          and get in touch with your property manager.
        </p>
      </div>

      {/* ─── Section 1: Security & Privacy ─── */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft overflow-hidden">
        <button
          onClick={() => toggleSection('security')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Security & Privacy</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">How access codes work and your data is protected</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${openSection === 'security' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {openSection === 'security' && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-zinc-700/50 pt-3">
            {securityFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  {feature.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{feature.title}</h4>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      feature.status === 'Active'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : feature.status === 'Always Active'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {feature.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
            {/* Privacy Note */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 mt-2">
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">Your Privacy</h4>
              <p className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                Your personal data — financial ledger, payment history, messages — is
                never visible to the gatekeeper or other residents. The access code
                system only shares the minimum information needed for visitor entry.
                All data is encrypted in transit and at rest.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 2: Resident Guide & FAQs ─── */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft overflow-hidden">
        <button
          onClick={() => toggleSection('faqs')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <HelpCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Resident Guide & FAQs</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Quick guides on payments, maintenance, visitors, and receipts</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${openSection === 'faqs' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {openSection === 'faqs' && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-zinc-700/50 pt-3">
            {/* Quick action buttons */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => onNavigate('payments')} className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                <NairaSymbol className="w-4 h-4 inline" /> Make Payment
              </button>
              <button onClick={() => onNavigate('maintenance')} className="flex items-center gap-2 p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors">
                <WrenchIcon className="w-4 h-4" /> Log Maintenance
              </button>
              <button onClick={() => onNavigate('visitors')} className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <VisitorIcon className="w-4 h-4" /> Visitor Pass
              </button>
              <button onClick={() => onNavigate('receipts')} className="flex items-center gap-2 p-2.5 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-teal-700 dark:text-teal-400 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors">
                <DownloadIcon className="w-4 h-4" /> View Receipts
              </button>
            </div>
            {/* FAQ list */}
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-slate-100 dark:border-zinc-700/50 pb-3 last:border-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{faq.q}</h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 3: Contact Property Manager ─── */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft overflow-hidden">
        <button
          onClick={() => toggleSection('contact')}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ChatIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contact Property Manager</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Direct contact details and quick message</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-slate-400 transition-transform ${openSection === 'contact' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {openSection === 'contact' && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-zinc-700/50 pt-3">
            {/* Contact details — with deep links (mailto: / tel:) */}
            <div className="space-y-2">
              {/* Email — mailto: deep link triggers native email client */}
              {(() => {
                const email = tenantInfo?.propertyManagerEmail || tenantInfo?.firmEmail;
                return email ? (
                  <a
                    href={`mailto:${email}?subject=Inquiry from ${encodeURIComponent(tenantInfo?.tenantName || 'Resident')}`}
                    className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-zinc-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <MailIcon className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Email</p>
                      <p className="text-sm text-primary-600 dark:text-primary-400 truncate underline">
                        {email}
                      </p>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-zinc-900/50 rounded-lg">
                    <MailIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Email</p>
                      <p className="text-sm text-slate-900 dark:text-white truncate">Contact via Messages tab</p>
                    </div>
                  </div>
                );
              })()}
              {/* Phone — tel: deep link triggers native dialer */}
              {(() => {
                const phone = tenantInfo?.propertyManagerPhone || tenantInfo?.firmPhone;
                return phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-zinc-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <OfficeBuildingIcon className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Office Phone</p>
                      <p className="text-sm text-primary-600 dark:text-primary-400 underline">{phone}</p>
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-zinc-900/50 rounded-lg">
                    <OfficeBuildingIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Office Phone</p>
                      <p className="text-sm text-slate-900 dark:text-white">Contact via Messages tab</p>
                    </div>
                  </div>
                );
              })()}
              {/* Sentry Pass phone — tel: deep link */}
              {tenantInfo?.gatehousePhone && (
                <a
                  href={`tel:${tenantInfo.gatehousePhone}`}
                  className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-zinc-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <VisitorIcon className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Sentry Pass Desk</p>
                    <p className="text-sm text-primary-600 dark:text-primary-400 underline">{tenantInfo.gatehousePhone}</p>
                  </div>
                </a>
              )}
            </div>
            {/* Quick message button — deep links to internal message thread */}
            {portalSettings?.tenantMessagingEnabled ? (
              <button
                onClick={() => onNavigate('messages')}
                className="w-full flex items-center justify-center gap-2 p-3 bg-primary-600 text-white rounded-md text-sm font-bold hover:bg-primary-700 transition-colors"
              >
                <ChatIcon className="w-4 h-4" />
                Message Property Manager
              </button>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Messaging is not enabled for your property. Please contact your property manager directly using the details above.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
