/**
 * Settings — comprehensive settings page for the Founder APK.
 * All state safely initialized with try-catch + null-safe rendering.
 */

import React, { useState } from 'react';
import { useFounderAuth, useFounderToast } from '../FounderContexts';
import { Capacitor } from '@capacitor/core';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderTheme, THEME_OPTIONS } from '../useFounderTheme';

// Build-time constants — injected by vite.admin.config.ts at build time
// via Vite's `define` option. __APP_VERSION__ and __APP_MODE__ are
// replaced at build time with literal string values.
declare const __APP_VERSION__: string;
declare const __APP_MODE__: string;
const APP_VERSION = __APP_VERSION__;
const PACKAGE_NAME = 'com.practicepro.admin';
const CONVEX_DEPLOYMENT = 'Convex Cloud';
const APP_MODE = __APP_MODE__;

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

type Tab = 'account' | 'security' | 'appearance' | 'notifications' | 'system' | 'about';

// Safe localStorage getter
function safeGet(key: string, fallback: string): string {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function safeGetBool(key: string, fallback: boolean): boolean {
    try {
        const v = localStorage.getItem(key);
        if (v === null) return fallback;
        return v === '1';
    } catch { return fallback; }
}

export const Settings: React.FC = () => {
    const { currentUser, logout, bearerToken } = useFounderAuth();
    const { addToast } = useFounderToast();
    const { theme, setTheme } = useFounderTheme();
    const [tab, setTab] = useState<Tab>('account');
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const envStatus = useQuery(api.debug_env.checkEnv, {});
    const testPush = useMutation(api.pushNotifications.sendTestPush);

    const [screenCapture, setScreenCapture] = useState(() => safeGetBool('founder_screen_capture', true));
    const [biometric, setBiometric] = useState(() => safeGetBool('founder_biometric', false));
    const [sessionTimeout, setSessionTimeout] = useState(() => safeGet('founder_session_timeout', '15'));

    const [notifNewUsers, setNotifNewUsers] = useState(() => safeGetBool('founder_notif_new_users', true));
    const [notifChurn, setNotifChurn] = useState(() => safeGetBool('founder_notif_churn', true));
    const [notifScaling, setNotifScaling] = useState(() => safeGetBool('founder_notif_scaling', true));
    const [notifMilestone, setNotifMilestone] = useState(() => safeGetBool('founder_notif_milestone', true));
    const [notifPaymentFailure, setNotifPaymentFailure] = useState(() => safeGetBool('founder_notif_payment_failure', true));
    const [notifChannel, setNotifChannel] = useState<'push' | 'email' | 'both'>(() => {
        const v = safeGet('founder_notif_channel', 'both');
        return v === 'push' || v === 'email' || v === 'both' ? v : 'both';
    });

    const toggleSetting = (key: string, setter: (v: boolean) => void, current: boolean, label: string) => {
        const newVal = !current;
        setter(newVal);
        try { localStorage.setItem(key, newVal ? '1' : '0'); } catch {}
        addToast(`${label}: ${newVal ? 'ON' : 'OFF'}`, { type: 'success' });
        if (key === 'founder_screen_capture') {
            toggleScreenCapture(newVal);
        }
    };

    const toggleScreenCapture = async (allow: boolean) => {
        if (Capacitor.isNativePlatform()) {
            try {
                await (Capacitor as any).Plugins?.ContentProtectionPlugin?.setFlagSecure?.(!allow);
                addToast(allow ? 'Screen capture allowed' : 'Screen capture blocked (FLAG_SECURE)', { type: 'success' });
            } catch {
                if (!allow) { document.body.classList.add('screen-capture-protected'); }
                else { document.body.classList.remove('screen-capture-protected'); }
            }
        } else {
            if (!allow) { document.body.classList.add('screen-capture-protected'); }
            else { document.body.classList.remove('screen-capture-protected'); }
        }
    };

    const handleLogout = () => {
        // Use the context's logout (clears React state cleanly) then reload
        // to ensure all cached Convex query results are purged.
        logout();
        try { localStorage.removeItem('practicepro_user_session'); } catch {}
        try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
        window.location.reload();
    };

    const userName = currentUser?.name || 'Founder';
    const userEmail = currentUser?.email || '—';

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: 'account', label: 'Account', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { id: 'appearance', label: 'Theme', icon: 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42' },
        { id: 'security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
        { id: 'notifications', label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
        { id: 'system', label: 'System', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
        { id: 'about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Manage your founder account and platform preferences</p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex gap-1 mb-6 bg-white dark:bg-zinc-800 rounded-lg p-1 border border-slate-200 dark:border-zinc-700 overflow-x-auto custom-scrollbar">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                                tab === t.id ? 'bg-primary-600 text-white' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                            </svg>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'account' && (
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Account</p>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between min-w-0">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Name</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{userName}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between min-w-0">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Email</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{userEmail}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between min-w-0">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Role</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">Founder</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-3xs font-black bg-black text-white flex-shrink-0">FOUNDER</span>
                            </div>
                            <div className="pt-3 border-t border-slate-100 dark:border-zinc-700">
                                {!showPasswordForm ? (
                                    <button onClick={() => setShowPasswordForm(true)} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors">Change Password</button>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">New Password</label>
                                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
                                        </div>
                                        <div>
                                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => {
                                                if (newPassword.length < 8) { addToast('Password must be at least 8 characters.', { type: 'error' }); return; }
                                                if (newPassword !== confirmPassword) { addToast('Passwords do not match.', { type: 'error' }); return; }
                                                addToast('Password change feature coming soon.', { type: 'info' });
                                                setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('');
                                            }} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors">Save</button>
                                            <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold">Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="pt-3 border-t border-slate-100 dark:border-zinc-700">
                                <button onClick={handleLogout} className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">Log Out</button>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'appearance' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Theme</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">Choose how the Founder App looks. All themes from the main PracticePro app are available here.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {THEME_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            setTheme(opt.id);
                                            addToast(`Theme: ${opt.label}`, { type: 'success' });
                                        }}
                                        className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                                            theme === opt.id
                                                ? 'border-primary-500 shadow-md'
                                                : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                                        }`}
                                    >
                                        {/* Preview swatch */}
                                        <div className={`h-12 rounded-lg ${opt.preview.bg} flex items-center justify-center mb-2`}>
                                            <div className={`w-6 h-6 rounded-full ${opt.preview.accent}`} />
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{opt.label}</p>
                                        <p className="text-2xs text-slate-400 mt-0.5 line-clamp-1">{opt.description}</p>
                                        {theme === opt.id && (
                                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'security' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Security & Data Isolation</p>
                            <div className="space-y-3">
                                <ToggleRow label="Allow Screen Capture / Screenshots" description="When OFF, screenshots and screen recording are blocked (FLAG_SECURE on Android). Default: ON (allowed)." checked={screenCapture} onChange={() => toggleSetting('founder_screen_capture', setScreenCapture, screenCapture, 'Screen capture')} />
                                <ToggleRow label="Biometric Authentication (Coming Soon)" description="Require Face ID / Fingerprint on app launch — not yet enforced" checked={biometric} onChange={() => toggleSetting('founder_biometric', setBiometric, biometric, 'Biometric auth')} />
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Session Timeout</p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">Auto-lock after inactivity</p>
                                    </div>
                                    <select value={sessionTimeout} onChange={e => { setSessionTimeout(e.target.value); try { localStorage.setItem('founder_session_timeout', e.target.value); } catch {} addToast(`Session timeout: ${e.target.value} min`, { type: 'success' }); }} className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200 flex-shrink-0">
                                        <option value="5">5 min</option>
                                        <option value="15">15 min</option>
                                        <option value="30">30 min</option>
                                        <option value="60">1 hour</option>
                                        <option value="0">Never</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'notifications' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Alert Channels</p>
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg min-w-0">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Delivery Channel</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">How alerts reach you</p>
                                </div>
                                <select value={notifChannel} onChange={e => { const v = e.target.value as any; setNotifChannel(v); try { localStorage.setItem('founder_notif_channel', v); } catch {} addToast(`Alert channel: ${v}`, { type: 'success' }); }} className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200 flex-shrink-0">
                                    <option value="push">Mobile Push</option>
                                    <option value="email">Email</option>
                                    <option value="both">Push + Email</option>
                                </select>
                            </div>
                        </div>
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Signal Types</p>
                            <div className="space-y-3">
                                <ToggleRow label="New User Signups" description="Get notified when a new user or firm signs up" checked={notifNewUsers} onChange={() => toggleSetting('founder_notif_new_users', setNotifNewUsers, notifNewUsers, 'New user alerts')} />
                                <ToggleRow label="Churn Risks" description="Get notified when users go inactive for 14+ days" checked={notifChurn} onChange={() => toggleSetting('founder_notif_churn', setNotifChurn, notifChurn, 'Churn alerts')} />
                                <ToggleRow label="Scaling Alerts" description="Matter velocity, plan concentration, active ratio" checked={notifScaling} onChange={() => toggleSetting('founder_notif_scaling', setNotifScaling, notifScaling, 'Scaling alerts')} />
                                <ToggleRow label="Milestone Alerts" description="10th, 50th, 100th, 1000th firm signup" checked={notifMilestone} onChange={() => toggleSetting('founder_notif_milestone', setNotifMilestone, notifMilestone, 'Milestone alerts')} />
                                <ToggleRow label="Payment Failures" description="Subscription payment failures and billing errors" checked={notifPaymentFailure} onChange={() => toggleSetting('founder_notif_payment_failure', setNotifPaymentFailure, notifPaymentFailure, 'Payment alerts')} />
                            </div>
                        </div>
                        {/* Test Push Notification */}
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Push Notification Diagnostics</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                                Send a test FCM push notification to your device to verify the end-to-end push pipeline.
                            </p>
                            <button
                                onClick={async () => {
                                    try {
                                        const result = await testPush({
                                            tokenIdentifier: currentUser?.email || '', sessionToken: bearerToken ?? undefined,
                                            title: 'PracticePro Test Push',
                                            body: 'If you can see this, push notifications are working correctly!',
                                        });
                                        if (result.success) {
                                            addToast(`Test push sent! (${result.sent || 0} device(s) notified)`, { type: 'success' });
                                        } else {
                                            addToast(`Push failed: ${result.error || result.reason || 'Unknown error'}`, { type: 'error' });
                                        }
                                    } catch (e: any) {
                                        addToast(`Push test error: ${e?.message || 'Failed'}`, { type: 'error' });
                                    }
                                }}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                                Send Test Push Notification
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'system' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>API Integrations</p>
                            <div className="space-y-2">
                                <SystemStatusRow label="Convex Backend" status="connected" detail={CONVEX_DEPLOYMENT} />
                                <SystemStatusRow label="Email Service (Brevo)" status={envStatus?.hasPracticeProMailer || envStatus?.hasBrevoApiKey ? 'connected' : 'pending'} detail={envStatus?.hasPracticeProMailer ? `Key: ${envStatus.mailerPrefix || '...'}...` : envStatus?.hasBrevoApiKey ? 'BREVO_API_KEY set' : 'No API key configured'} />
                                <SystemStatusRow label="Sender Email" status={envStatus?.hasBrevoSenderEmail ? 'connected' : 'pending'} detail={envStatus?.hasBrevoSenderEmail ? 'Custom domain' : 'Using default (practiceprosystems@gmail.com)'} />
                                <SystemStatusRow label="Push Notifications" status={Capacitor.isNativePlatform() ? 'connected' : 'pending'} detail={Capacitor.isNativePlatform() ? 'Native (Capacitor)' : 'Web only'} />
                                <SystemStatusRow label="WhatsApp Business" status={envStatus?.hasChakraToken ? 'connected' : 'pending'} detail={envStatus?.hasChakraToken ? 'Connected' : 'Not configured'} />
                            </div>
                        </div>
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Environment</p>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500 dark:text-zinc-400">Mode</span><span className="font-bold text-emerald-600">{APP_MODE === 'production' ? 'Production' : APP_MODE}</span></div>
                                <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500 dark:text-zinc-400">Platform</span><span className="font-bold text-slate-700 dark:text-zinc-200">{Capacitor.isNativePlatform() ? 'Native APK' : 'Web'}</span></div>
                                <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500 dark:text-zinc-400">Push Token</span><span className="font-bold text-slate-700 dark:text-zinc-200">{Capacitor.isNativePlatform() ? 'Registered' : 'N/A'}</span></div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'about' && (
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>About</p>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">App</span><span className="font-bold text-slate-700 dark:text-zinc-200">PracticePro Founder</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">Version</span><span className="font-bold text-slate-700 dark:text-zinc-200">{APP_VERSION}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">Package</span><span className="font-bold text-slate-700 dark:text-zinc-200">{PACKAGE_NAME}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-zinc-400">Backend</span><span className="font-bold text-slate-700 dark:text-zinc-200">Convex</span></div>
                            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-700">
                                <p className="text-2xs text-slate-400">PracticePro Founder is the platform control center for managing organizations, subscription billing, and platform-wide metrics. It is a separate APK from the consumer PracticePro app and should only be used by the platform founder. Client financial data is never exposed — only platform subscription billing is tracked.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ToggleRow: React.FC<{ label: string; description: string; checked: boolean; onChange: () => void; }> = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg min-w-0">
        <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{label}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{description}</p>
        </div>
        <button onClick={onChange} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${checked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-zinc-600'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : ''}`} />
        </button>
    </div>
);

const SystemStatusRow: React.FC<{ label: string; status: 'connected' | 'pending' | 'error'; detail: string; }> = ({ label, status, detail }) => (
    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg min-w-0">
        <div className="min-w-0">
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{label}</p>
            <p className="text-2xs text-slate-500 dark:text-zinc-400 truncate">{detail}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-3xs font-bold flex-shrink-0 ${status === 'connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {status === 'connected' ? 'Connected' : status === 'pending' ? 'Pending' : 'Error'}
        </span>
    </div>
);
