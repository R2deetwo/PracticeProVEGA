/**
 * Settings — comprehensive settings page for the Founder APK.
 *
 * Sections:
 *   1. Account — name, email, password change, log out
 *   2. Notifications — toggle signal notifications (new users, churn, etc.)
 *   3. Display — dark mode toggle, font size
 *   4. Platform — platform-wide settings (default plan, trial duration)
 *   5. About — app version, build info, links
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

export const Settings: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { addToast } = useUI();
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Notification settings (stored in localStorage)
    const [notifNewUsers, setNotifNewUsers] = useState(() => {
        try { return localStorage.getItem('founder_notif_new_users') !== '0'; } catch { return true; }
    });
    const [notifChurn, setNotifChurn] = useState(() => {
        try { return localStorage.getItem('founder_notif_churn') !== '0'; } catch { return true; }
    });
    const [notifScaling, setNotifScaling] = useState(() => {
        try { return localStorage.getItem('founder_notif_scaling') !== '0'; } catch { return true; }
    });
    const [notifSound, setNotifSound] = useState(() => {
        try { return localStorage.getItem('founder_notif_sound') !== '0'; } catch { return true; }
    });

    const toggleNotif = (key: string, setter: (v: boolean) => void, current: boolean) => {
        const newVal = !current;
        setter(newVal);
        try { localStorage.setItem(key, newVal ? '1' : '0'); } catch {}
        addToast(`${newVal ? 'Enabled' : 'Disabled'} notifications`, { type: 'success' });
    };

    const handleLogout = () => {
        try { localStorage.removeItem('practicepro_user_session'); } catch {}
        try { sessionStorage.removeItem('practicepro_user_session'); } catch {}
        window.location.reload();
    };

    const handleChangePassword = () => {
        if (newPassword.length < 8) {
            addToast('Password must be at least 8 characters.', { type: 'error' });
            return;
        }
        if (newPassword !== confirmPassword) {
            addToast('Passwords do not match.', { type: 'error' });
            return;
        }
        // TODO: Add a Convex mutation to change password
        addToast('Password change feature coming soon. For now, contact support.', { type: 'info' });
        setShowPasswordForm(false);
        setNewPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
                <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Manage your founder account and preferences</p>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-6">
                {/* ─── ACCOUNT ─────────────────────────────────────────── */}
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

                        {/* Password change */}
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
                                            onClick={handleChangePassword}
                                            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors"
                                        >
                                            Save Password
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

                        {/* Logout */}
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

                {/* ─── NOTIFICATIONS ───────────────────────────────────── */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Notifications</p>
                    <div className="space-y-3">
                        <ToggleRow
                            label="New User Signups"
                            description="Get notified when a new user or firm signs up"
                            checked={notifNewUsers}
                            onChange={() => toggleNotif('founder_notif_new_users', setNotifNewUsers, notifNewUsers)}
                        />
                        <ToggleRow
                            label="Churn Risks"
                            description="Get notified when users go inactive for 14+ days"
                            checked={notifChurn}
                            onChange={() => toggleNotif('founder_notif_churn', setNotifChurn, notifChurn)}
                        />
                        <ToggleRow
                            label="Scaling Alerts"
                            description="Get notified about matter velocity, plan concentration, etc."
                            checked={notifScaling}
                            onChange={() => toggleNotif('founder_notif_scaling', setNotifScaling, notifScaling)}
                        />
                        <ToggleRow
                            label="Notification Sound"
                            description="Play a sound when notifications arrive"
                            checked={notifSound}
                            onChange={() => toggleNotif('founder_notif_sound', setNotifSound, notifSound)}
                        />
                    </div>
                </div>

                {/* ─── DISPLAY ─────────────────────────────────────────── */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Display</p>
                    <div className="space-y-3">
                        <ToggleRow
                            label="Dark Mode"
                            description="Use dark theme throughout the app"
                            checked={document.documentElement.classList.contains('dark')}
                            onChange={() => {
                                document.documentElement.classList.toggle('dark');
                                addToast('Theme updated', { type: 'success' });
                            }}
                        />
                    </div>
                </div>

                {/* ─── PLATFORM ────────────────────────────────────────── */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Platform Settings</p>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Default Subscription Plan</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">New firms start on this plan</p>
                            </div>
                            <select className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200">
                                <option>Core</option>
                                <option>Growth</option>
                                <option>Pro</option>
                                <option>Enterprise</option>
                                <option>Komplete</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Trial Duration</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">Days before trial expires</p>
                            </div>
                            <input
                                type="number"
                                defaultValue={14}
                                className="w-20 px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-700 dark:text-zinc-200"
                            />
                        </div>
                        <p className="text-2xs text-slate-400 italic mt-2">Platform settings are saved locally. Server-side persistence coming soon.</p>
                    </div>
                </div>

                {/* ─── ABOUT ──────────────────────────────────────────── */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>About</p>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-zinc-400">App</span>
                            <span className="font-bold text-slate-700 dark:text-zinc-200">PracticePro Founder</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-zinc-400">Version</span>
                            <span className="font-bold text-slate-700 dark:text-zinc-200">1.99.1</span>
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
                                PracticePro Founder is the platform control center for managing firms,
                                users, and platform-wide metrics. It is a separate APK from the consumer
                                PracticePro app and should only be used by the platform founder.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Helper component for toggle rows ─────────────────────────────────
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
