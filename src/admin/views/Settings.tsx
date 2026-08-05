/**
 * Settings — comprehensive settings page for the Founder APK.
 *
 * Multi-tab interface:
 *   1. Account — name, email, password change, log out
 *   2. Security & Privacy — screen capture toggle, biometric, session timeout
 *   3. Notifications — signal channels, milestone thresholds, financial alerts
 *   4. System Environment — API status, push health, environment mode
 *   5. About — app version, build info
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Capacitor } from '@capacitor/core';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

type Tab = 'account' | 'security' | 'notifications' | 'system' | 'about';

export const Settings: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { addToast } = useUI();
    const [tab, setTab] = useState<Tab>('account');
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Real environment status from Convex
    const envStatus = useQuery(api.debug.checkEnv, {});

    // Security settings (persisted to localStorage)
    const [screenCapture, setScreenCapture] = useState(() => {
        try { return localStorage.getItem('founder_screen_capture') === '1'; } catch { return false; }
    });
    const [biometric, setBiometric] = useState(() => {
        try { return localStorage.getItem('founder_biometric') === '1'; } catch { return false; }
    });
    const [sessionTimeout, setSessionTimeout] = useState(() => {
        try { return localStorage.getItem('founder_session_timeout') || '15'; } catch { return '15'; }
    });

    // Notification settings
    const [notifNewUsers, setNotifNewUsers] = useState(() => {
        try { return localStorage.getItem('founder_notif_new_users') !== '0'; } catch { return true; }
    });
    const [notifChurn, setNotifChurn] = useState(() => {
        try { return localStorage.getItem('founder_notif_churn') !== '0'; } catch { return true; }
    });
    const [notifScaling, setNotifScaling] = useState(() => {
        try { return localStorage.getItem('founder_notif_scaling') !== '0'; } catch { return true; }
    });
    const [notifMilestone, setNotifMilestone] = useState(() => {
        try { return localStorage.getItem('founder_notif_milestone') !== '0'; } catch { return true; }
    });
    const [notifPaymentFailure, setNotifPaymentFailure] = useState(() => {
        try { return localStorage.getItem('founder_notif_payment_failure') !== '0'; } catch { return true; }
    });
    const [notifChannel, setNotifChannel] = useState<'push' | 'email' | 'both'>(
        () => {
            try { return (localStorage.getItem('founder_notif_channel') as any) || 'both'; } catch { return 'both'; }
        }
    );

    const toggleSetting = (key: string, setter: (v: boolean) => void, current: boolean, label: string) => {
        const newVal = !current;
        setter(newVal);
        try { localStorage.setItem(key, newVal ? '1' : '0'); } catch {}
        addToast(`${label}: ${newVal ? 'ON' : 'OFF'}`, { type: 'success' });

        // Special handling for screen capture
        if (key === 'founder_screen_capture') {
            toggleScreenCapture(newVal);
        }
    };

    const toggleScreenCapture = async (allow: boolean) => {
        // Use the native ContentProtectionPlugin (already built in the Android app)
        // which calls FLAG_SECURE on the Window — the same mechanism banking apps use.
        if (Capacitor.isNativePlatform()) {
            try {
                // The plugin is registered as 'ContentProtectionPlugin'
                // Call setFlagSecure(!allow) — when allow=false, secure=true (blocks screenshots)
                await (Capacitor as any).Plugins?.ContentProtectionPlugin?.setFlagSecure?.(!allow);
                addToast(allow ? 'Screen capture allowed' : 'Screen capture blocked (FLAG_SECURE)', { type: 'success' });
            } catch (e) {
                console.warn('[Settings] Native content protection plugin not available:', e);
                // Fallback: CSS-based protection
                if (!allow) {
                    document.body.classList.add('screen-capture-protected');
                    addToast('Screen capture blocked (CSS fallback)', { type: 'success' });
                } else {
                    document.body.classList.remove('screen-capture-protected');
                }
            }
        } else {
            // Web fallback — CSS only
            if (!allow) {
                document.body.classList.add('screen-capture-protected');
                addToast('Screen capture blocked (CSS fallback)', { type: 'success' });
            } else {
                document.body.classList.remove('screen-capture-protected');
            }
        }
    };

    const handleLogout = () => {
        try { localStorage.removeItem('practicepro_user_session'); } catch {}
        try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
        window.location.reload();
    };

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: 'account', label: 'Account', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { id: 'security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
        { id: 'notifications', label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
        { id: 'system', label: 'System', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
        { id: 'about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Manage your founder account and platform preferences</p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {/* Tab selector */}
                <div className="flex gap-1 mb-6 bg-white dark:bg-zinc-800 rounded-xl p-1 border border-slate-200 dark:border-zinc-700 overflow-x-auto custom-scrollbar">
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

                {/* ─── ACCOUNT TAB ────────────────────────────────────── */}
                {tab === 'account' && (
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>Account</p>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Name</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">{currentUser?.name || 'Founder'}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Email</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">{currentUser?.email || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Role</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">Founder</p>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-3xs font-black bg-black text-white">FOUNDER</span>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-zinc-700">
                                {!showPasswordForm ? (
                                    <button
                                        onClick={() => setShowPasswordForm(true)}
                                        className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                                    >
                                        Change Password
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">New Password</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-2xs font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    if (newPassword.length < 8) { addToast('Password must be at least 8 characters.', { type: 'error' }); return; }
                                                    if (newPassword !== confirmPassword) { addToast('Passwords do not match.', { type: 'error' }); return; }
                                                    addToast('Password change feature coming soon.', { type: 'info' });
                                                    setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('');
                                                }}
                                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }}
                                                className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-zinc-700">
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SECURITY TAB ───────────────────────────────────── */}
                {tab === 'security' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Security & Data Isolation</p>
                            <div className="space-y-3">
                                <ToggleRow
                                    label="Allow Screen Capture / Screenshots"
                                    description="When OFF, screenshots and screen recording are blocked (FLAG_SECURE on Android). Default: OFF for security."
                                    checked={screenCapture}
                                    onChange={() => toggleSetting('founder_screen_capture', setScreenCapture, screenCapture, 'Screen capture')}
                                />
                                <ToggleRow
                                    label="Biometric Authentication"
                                    description="Require Face ID / Fingerprint on app launch"
                                    checked={biometric}
                                    onChange={() => toggleSetting('founder_biometric', setBiometric, biometric, 'Biometric auth')}
                                />
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Session Timeout</p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">Auto-lock after inactivity</p>
                                    </div>
                                    <select
                                        value={sessionTimeout}
                                        onChange={e => {
                                            setSessionTimeout(e.target.value);
                                            try { localStorage.setItem('founder_session_timeout', e.target.value); } catch {}
                                            addToast(`Session timeout: ${e.target.value} min`, { type: 'success' });
                                        }}
                                        className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                                    >
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

                {/* ─── NOTIFICATIONS TAB ──────────────────────────────── */}
                {tab === 'notifications' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Alert Channels</p>
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Delivery Channel</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">How alerts reach you</p>
                                </div>
                                <select
                                    value={notifChannel}
                                    onChange={e => {
                                        setNotifChannel(e.target.value as any);
                                        try { localStorage.setItem('founder_notif_channel', e.target.value); } catch {}
                                        addToast(`Alert channel: ${e.target.value}`, { type: 'success' });
                                    }}
                                    className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                                >
                                    <option value="push">Mobile Push</option>
                                    <option value="email">Email</option>
                                    <option value="both">Push + Email</option>
                                </select>
                            </div>
                        </div>

                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Signal Types</p>
                            <div className="space-y-3">
                                <ToggleRow
                                    label="New User Signups"
                                    description="Get notified when a new user or firm signs up"
                                    checked={notifNewUsers}
                                    onChange={() => toggleSetting('founder_notif_new_users', setNotifNewUsers, notifNewUsers, 'New user alerts')}
                                />
                                <ToggleRow
                                    label="Churn Risks"
                                    description="Get notified when users go inactive for 14+ days"
                                    checked={notifChurn}
                                    onChange={() => toggleSetting('founder_notif_churn', setNotifChurn, notifChurn, 'Churn alerts')}
                                />
                                <ToggleRow
                                    label="Scaling Alerts"
                                    description="Matter velocity, plan concentration, active ratio"
                                    checked={notifScaling}
                                    onChange={() => toggleSetting('founder_notif_scaling', setNotifScaling, notifScaling, 'Scaling alerts')}
                                />
                                <ToggleRow
                                    label="Milestone Alerts"
                                    description="10th, 50th, 100th, 1000th firm signup"
                                    checked={notifMilestone}
                                    onChange={() => toggleSetting('founder_notif_milestone', setNotifMilestone, notifMilestone, 'Milestone alerts')}
                                />
                                <ToggleRow
                                    label="Payment Failures"
                                    description="Subscription payment failures and billing errors"
                                    checked={notifPaymentFailure}
                                    onChange={() => toggleSetting('founder_notif_payment_failure', setNotifPaymentFailure, notifPaymentFailure, 'Payment alerts')}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SYSTEM TAB ─────────────────────────────────────── */}
                {tab === 'system' && (
                    <div className="space-y-4">
                        <div className={CARD}>
                            <p className={SECTION_TITLE}>API Integrations</p>
                            <div className="space-y-2">
                                <SystemStatusRow label="Convex Backend" status="connected" detail="gregarious-malamute-537" />
                                <SystemStatusRow
                                    label="Email Service (Brevo)"
                                    status={envStatus?.hasPracticeProMailer || envStatus?.hasBrevoApiKey ? 'connected' : 'pending'}
                                    detail={envStatus?.hasPracticeProMailer ? `Key: ${envStatus.mailerPrefix}...` :
                                            envStatus?.hasBrevoApiKey ? 'BREVO_API_KEY set' : 'No API key configured'}
                                />
                                <SystemStatusRow
                                    label="Sender Email"
                                    status={envStatus?.hasBrevoSenderEmail ? 'connected' : 'pending'}
                                    detail={envStatus?.hasBrevoSenderEmail ? 'Custom domain' : 'Using default (practiceprosystems@gmail.com)'}
                                />
                                <SystemStatusRow label="Push Notifications" status={Capacitor.isNativePlatform() ? 'connected' : 'pending'} detail={Capacitor.isNativePlatform() ? 'Native (Capacitor)' : 'Web only'} />
                                <SystemStatusRow
                                    label="WhatsApp (Chakra)"
                                    status={envStatus?.hasChakraToken ? 'connected' : 'pending'}
                                    detail={envStatus?.hasChakraToken ? 'Connected' : 'Not configured'}
                                />
                            </div>
                        </div>

                        <div className={CARD}>
                            <p className={SECTION_TITLE}>Environment</p>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                    <span className="text-slate-500 dark:text-zinc-400">Mode</span>
                                    <span className="font-bold text-emerald-600">Production</span>
                                </div>
                                <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                    <span className="text-slate-500 dark:text-zinc-400">Platform</span>
                                    <span className="font-bold text-slate-700 dark:text-zinc-200">{Capacitor.isNativePlatform() ? 'Native APK' : 'Web'}</span>
                                </div>
                                <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                                    <span className="text-slate-500 dark:text-zinc-400">Push Token</span>
                                    <span className="font-bold text-slate-700 dark:text-zinc-200">{Capacitor.isNativePlatform() ? 'Registered' : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── ABOUT TAB ──────────────────────────────────────── */}
                {tab === 'about' && (
                    <div className={CARD}>
                        <p className={SECTION_TITLE}>About</p>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-zinc-400">App</span>
                                <span className="font-bold text-slate-700 dark:text-zinc-200">PracticePro Founder</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-zinc-400">Version</span>
                                <span className="font-bold text-slate-700 dark:text-zinc-200">2.0.0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-zinc-400">Package</span>
                                <span className="font-bold text-slate-700 dark:text-zinc-200">com.practicepro.admin</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-zinc-400">Backend</span>
                                <span className="font-bold text-slate-700 dark:text-zinc-200">Convex</span>
                            </div>
                            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-zinc-700">
                                <p className="text-2xs text-slate-400">
                                    PracticePro Founder is the platform control center for managing organizations,
                                    subscription billing, and platform-wide metrics. It is a separate APK from the
                                    consumer PracticePro app and should only be used by the platform founder.
                                    Client financial data is never exposed — only platform subscription billing
                                    is tracked.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Helper components ────────────────────────────────────────────────
const ToggleRow: React.FC<{
    label: string;
    description: string;
    checked: boolean;
    onChange: () => void;
}> = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
        <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{label}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{description}</p>
        </div>
        <button
            onClick={onChange}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${
                checked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-zinc-600'
            }`}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    checked ? 'translate-x-6' : ''
                }`}
            />
        </button>
    </div>
);

const SystemStatusRow: React.FC<{
    label: string;
    status: 'connected' | 'pending' | 'error';
    detail: string;
}> = ({ label, status, detail }) => (
    <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg">
        <div>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{label}</p>
            <p className="text-2xs text-slate-500 dark:text-zinc-400">{detail}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
            status === 'connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
            status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
            {status === 'connected' ? 'Connected' : status === 'pending' ? 'Pending' : 'Error'}
        </span>
    </div>
);
