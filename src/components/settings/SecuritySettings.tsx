
import React, { useState, useMemo, useEffect } from 'react';
import { FirmActivity, User, UserRole } from '../../types';
import { SearchIcon, LockClosedIcon, ShieldCheckIcon, DownloadIcon, TrashIcon, RevertIcon } from '../../constants';
import { useFeatures } from '../../hooks/useFeatures';
import { biometricAuth } from '../../utils/biometric';
import { Capacitor } from '@capacitor/core';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface SecuritySettingsProps {
    activities: FirmActivity[];
    users: User[];
    onEnableDevMode: () => void;
}

const AuditLogViewer: React.FC<SecuritySettingsProps> = ({ activities, users }) => {
    const [search, setSearch] = useState('');
    const [filterUser, setFilterUser] = useState('All');
    const [filterAction, setFilterAction] = useState('All');
    const { addToast } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const uniqueActions = useMemo(() => {
        const actions = new Set(activities.map(a => a.action.split(' ')[0])); // Get first word for simplified grouping or just full action
        return Array.from(actions);
    }, [activities]);

    const filteredLogs = useMemo(() => {
        return activities.filter(log => {
            const matchesSearch =
                log.action.toLowerCase().includes(search.toLowerCase()) ||
                (log.targetName && log.targetName.toLowerCase().includes(search.toLowerCase()));
            const matchesUser = filterUser === 'All' || log.userId === filterUser;
            const matchesAction = filterAction === 'All' || log.action.includes(filterAction);
            return matchesSearch && matchesUser && matchesAction;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [activities, search, filterUser, filterAction]);

    const handleExportCsv = () => {
        if (filteredLogs.length === 0) {
            addToast("No logs to export.", { type: 'error' });
            return;
        }

        // CSV Header
        const headers = ["Timestamp", "User ID", "User Name", "Action", "Target Type", "Target Name", "IP Address"];

        // Map data
        const rows = filteredLogs.map(log => [
            `"${new Date(log.timestamp).toLocaleString()}"`,
            `"${log.userId}"`,
            `"${log.userName}"`,
            `"${log.action}"`,
            `"${log.targetType}"`,
            `"${log.targetName || ''}"`,
            `"${log.metadata?.ip || 'N/A'}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        // Create Blob and Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addToast("Audit log exported successfully.", { type: 'success' });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                <div className="relative flex-grow min-w-[200px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        placeholder="Search actions, targets, or IPs..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-primary-500"
                    />
                </div>
                <select
                    value={filterUser}
                    onChange={e => setFilterUser(e.target.value)}
                    className="p-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-primary-500"
                >
                    <option value="All">All Users</option>
                    <option value="system">System</option>
                    {users.filter(u => u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.ExternalCounsel && u.role !== UserRole.Pending).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="flex gap-2">
                    <select
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="p-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-primary-500 min-w-[120px]"
                    >
                        <option value="All">All Actions</option>
                        <option value="login">Login</option>
                        <option value="delete">Delete</option>
                        <option value="export">Export</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                    </select>
                    <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold transition-colors"
                        title="Export filtered logs to CSV"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>

            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 font-medium border-b border-slate-200 dark:border-zinc-700">
                            <tr>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Target</th>
                                <th className="px-4 py-3">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                            {filteredLogs.slice(0, 50).map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-700/50">
                                    <td className="px-4 py-2 text-slate-500 dark:text-zinc-500 whitespace-nowrap font-mono text-xs">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                                        {log.userName}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-300">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.action.includes('delete') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                            log.action.includes('create') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                log.action.includes('login') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                    'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-600 dark:text-zinc-300 max-w-xs truncate" title={log.targetName}>
                                        {log.targetName || log.targetId || '-'}
                                    </td>
                                    <td className="px-4 py-2 text-slate-400 dark:text-zinc-500 font-mono text-xs">
                                        {log.metadata?.ip || '127.0.0.1'}
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No activity logs found matching your filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-xs text-slate-400 text-center">Showing last 50 records. Use <strong>Export</strong> to download full history.</p>
        </div>
    );
};

const SecuritySettings: React.FC<SecuritySettingsProps> = (props) => {
    const { canUseAuditLogs } = useFeatures();
    const { openModal, closeModal, addToast } = useUI();
    const { restoreFromLocalBackup } = useDataActions();

    const handleUpgrade = () => {
        openModal('upgradePlan', null, { featureName: 'Audit Logs & Security' });
    };

    const handleRestore = () => {
        openModal('deleteConfirmation', 'emergencyRestore', {
            title: "Emergency Force Restore?",
            message: "WARNING: This will overwrite the current server data with the version stored on this browser cache. Only use this if the cloud data has been corrupted or lost. Continue?",
            onConfirm: () => {
                restoreFromLocalBackup();
                closeModal();
            },
            confirmText: "Force Restore",
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const { currentUser } = useAuth();
    const updateUserSecurity = useMutation(api.myFunctions.updateUserSecurity);

    const handleToggleMfa = async (newValue: boolean) => {
        if (!currentUser) return;
        try {
            // Using type assertion for convex IDs dynamically
            await updateUserSecurity({ userId: currentUser._id as any, isMfaEnabled: newValue });
            addToast(`Two-Factor Authentication ${newValue ? 'Enabled' : 'Disabled'}.`, { type: 'success' });
        } catch (e: any) {
            addToast(`Failed to update settings: ${e.message}`, { type: 'error' });
        }
    };

    return (
        <div className="space-y-6">

            {/* MULTI-FACTOR AUTHENTICATION */}
            <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <ShieldCheckIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Two-Factor Authentication (2FA)</h3>
                            <p className="text-sm text-slate-500 dark:text-zinc-400">
                                Strengthen your account security with an extra verification step during login.
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input autoComplete="off" data-lpignore="true"
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!currentUser?.isMfaEnabled}
                            onChange={(e) => handleToggleMfa(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
                {currentUser?.isMfaEnabled && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                            <strong>Important:</strong> If you lose access to your 2FA device, contact your firm administrator to disable 2FA for your account. Admins can reset 2FA from Settings → Account Recovery. Consider enabling biometric login on the mobile app as a backup authentication method.
                        </p>
                    </div>
                )}
            </div>

            {/* CONTENT PROTECTION */}
            <ContentProtectionSection />

            {/* BIOMETRIC UNLOCK */}
            <BiometricSection currentUser={currentUser} />

            {/* EMERGENCY DATA RESCUE */}
            <div 
                onClick={() => {
                    const now = Date.now();
                    const last = (window as any)._devClickLast || 0;
                    const count = (window as any)._devClickCount || 0;
                    
                    if (now - last < 500) {
                        const newCount = count + 1;
                        if (newCount >= 5) {
                            props.onEnableDevMode();
                            (window as any)._devClickCount = 0;
                        } else {
                            (window as any)._devClickCount = newCount;
                        }
                    } else {
                        (window as any)._devClickCount = 1;
                    }
                    (window as any)._devClickLast = now;
                }}
                className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-xl p-6 shadow-sm cursor-default hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors"
            >
                <div className="flex items-start gap-4 pointer-events-none select-none">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                        <RevertIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-lg font-bold text-red-900 dark:text-red-100">Emergency Data Rescue</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            If data appears missing or corrupted on the server, you can attempt to restore it from this browser's local backup cache.
                            This will force-push your local data to the cloud.
                        </p>
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Don't trigger the hidden toolkit
                                handleRestore();
                            }}
                            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-md transition-colors pointer-events-auto"
                        >
                            Force Restore from Local Backup
                        </button>
                    </div>
                </div>
            </div>


            {/* AUDIT LOGS */}
            <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-200 dark:bg-zinc-700 rounded-lg">
                            <ShieldCheckIcon className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Audit Logs</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">Track user activity and system events.</p>
                        </div>
                    </div>
                    {!canUseAuditLogs && (
                        <span className="px-3 py-1 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold rounded-full flex items-center gap-1">
                            <LockClosedIcon className="w-3 h-3" /> Enterprise
                        </span>
                    )}
                </div>

                <div className="p-6 relative">
                    {!canUseAuditLogs && (
                        <div className="absolute inset-0 z-10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
                            <LockClosedIcon className="w-16 h-16 text-slate-400 dark:text-zinc-600 mb-4" />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Enterprise Security Feature</h3>
                            <p className="text-slate-600 dark:text-zinc-300 max-w-md mb-6">
                                Audit Logs provide a detailed trail of every action taken within your firm. This feature is essential for compliance and security in larger firms.
                            </p>
                            <button
                                onClick={handleUpgrade}
                                className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold hover:opacity-90 transition-opacity shadow-lg"
                            >
                                Upgrade to Enterprise
                            </button>
                        </div>
                    )}

                    <AuditLogViewer {...props} />
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;

// ─── Content Protection Section ──────────────────────────────────────────────
const ContentProtectionSection: React.FC = () => {
    const [enabled, setEnabled] = useState(() => {
        try { return localStorage.getItem('practicepro_content_protection') !== 'false'; }
        catch { return true; }
    });

    const toggle = (val: boolean) => {
        setEnabled(val);
        try {
            localStorage.setItem('practicepro_content_protection', val ? 'true' : 'false');
            // Dispatch a synthetic storage event so useContentProtection picks it up
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'practicepro_content_protection',
                newValue: val ? 'true' : 'false',
            }));
        } catch { /* ignore */ }
    };

    return (
        <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Content Protection</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                            Prevents screenshots and screen recording on mobile. Blocks copy-paste of sensitive content.
                        </p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                </label>
            </div>
        </div>
    );
};

// ─── Biometric Unlock Section ────────────────────────────────────────────────
const BiometricSection: React.FC<{ currentUser: any }> = ({ currentUser }) => {
    const { addToast } = useUI();
    const [isNative] = useState(() => Capacitor.isNativePlatform());
    const [registered, setRegistered] = useState(() => biometricAuth.isRegistered());
    const [available, setAvailable] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        const check = async () => {
            try {
                const avail = await biometricAuth.isAvailable();
                setAvailable(avail);
            } catch { setAvailable(false); }
        };
        check();
    }, []);

    const handleRegister = async () => {
        if (!currentUser?.email) return;
        setChecking(true);
        try {
            const result = await biometricAuth.register(currentUser.email);
            if (result) {
                setRegistered(true);
                addToast('Biometric unlock enabled. You can now use Face ID / fingerprint to log in.', { type: 'success' });
            } else {
                addToast('Biometric authentication failed. Please try again.', { type: 'error' });
            }
        } catch (e: any) {
            addToast('Could not enable biometrics: ' + (e.message || 'Unknown error'), { type: 'error' });
        } finally {
            setChecking(false);
        }
    };

    const handleUnregister = () => {
        biometricAuth.unregister();
        setRegistered(false);
        addToast('Biometric unlock disabled.', { type: 'info' });
    };

    // On web, show a different message
    if (!isNative) {
        return (
            <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 dark:bg-zinc-700 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.568 8.268m9.14-9.14a3 3 0 11-4.243 4.243M3 3l18 18" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Biometric Unlock</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                            Available on the mobile app (APK). Install the app on your phone to enable fingerprint / Face ID login.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Native but biometrics not available
    if (!available) {
        return (
            <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Biometric Unlock</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                            Your device doesn't support biometric authentication, or it hasn't been set up in your phone's settings.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Native + available
    return (
        <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden p-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.568 8.268m9.14-9.14a3 3 0 11-4.243 4.243M3 3l18 18" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Biometric Unlock</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">
                            Use fingerprint or Face ID to log in without typing your password.
                        </p>
                    </div>
                </div>
                {registered ? (
                    <button
                        onClick={handleUnregister}
                        className="px-4 py-2 text-sm font-bold text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        Disable
                    </button>
                ) : (
                    <button
                        onClick={handleRegister}
                        disabled={checking}
                        className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {checking ? 'Enabling...' : 'Enable'}
                    </button>
                )}
            </div>
            {registered && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-3 font-medium">
                    ✓ Biometric unlock is enabled for {biometricAuth.getEmail()}
                </p>
            )}
        </div>
    );
};
