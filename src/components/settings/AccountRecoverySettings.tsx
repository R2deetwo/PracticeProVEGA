import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
import { SearchIcon, TrashIcon, CheckCircleIcon, ShieldCheckIcon } from '../../constants';
import { translateError } from '../../utils/errorTranslator';
import { useConfirm } from '../ui/ConfirmDialog';


const AccountRecoverySettings: React.FC = () => {
    const { addToast } = useUI();
    const { confirm, ConfirmDialog } = useConfirm();
    const [searchEmail, setSearchEmail] = useState('');
    const [debouncedEmail, setDebouncedEmail] = useState('');
    
    // Fetch matching users
    const users = useQuery(api.myFunctions.adminSearchUsersByEmail, debouncedEmail ? { email: debouncedEmail } : 'skip');
    
    const adminDeleteUser = useMutation(api.myFunctions.adminDeleteUser);
    const adminForceVerify = useMutation(api.myFunctions.adminForceVerify);
    const updateUserSecurity = useMutation(api.myFunctions.updateUserSecurity);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedEmail(searchEmail);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchEmail]);

    const handleDelete = async (userId: string) => {
        const ok = await confirm({
            title: 'Delete user record?',
            message: 'Are you sure you want to delete this user record? This action cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true,
        });
        if (!ok) return;
        try {
            await adminDeleteUser({ userId: userId as any });
            addToast('User deleted successfully.', { type: 'success' });
        } catch (e: any) {
            addToast(translateError(e), { type: 'error' });
        }
    };

    const handleForceVerify = async (userId: string) => {
        const ok = await confirm({
            title: 'Force verify account?',
            message: 'Are you sure you want to force verify this account?',
            confirmLabel: 'Force Verify',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        try {
            await adminForceVerify({ userId: userId as any });
            addToast('User verified successfully.', { type: 'success' });
        } catch (e: any) {
            addToast(translateError(e), { type: 'error' });
        }
    };

    const handleDisable2FA = async (userId: string) => {
        const ok = await confirm({
            title: 'Disable 2FA for this user?',
            message: 'This will turn off Two-Factor Authentication for this account. The user will be able to log in with just their password. Use this when a user has lost their 2FA device.',
            confirmLabel: 'Disable 2FA',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        try {
            await updateUserSecurity({ userId: userId as any, isMfaEnabled: false });
            addToast('2FA disabled for this user. They can now log in with just their password.', { type: 'success' });
        } catch (e: any) {
            addToast(translateError(e), { type: 'error' });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheckIcon className="w-5 h-5 text-indigo-500" />
                        Account Recovery Tool
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Find and resolve stuck or duplicate user accounts.
                    </p>
                </div>
            </div>

            <div className="p-5 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-5">
                <div className="relative">
                    <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        placeholder="Search user by email address..."
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm dark:text-white transition-all"
                    />
                </div>

                {debouncedEmail && users === undefined && (
                    <div className="text-center py-8 text-sm text-slate-500">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Searching...
                    </div>
                )}

                {users !== undefined && users.length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-500">
                        No accounts found for "{debouncedEmail}".
                    </div>
                )}

                {users !== undefined && users.length > 0 && (
                    <div className="space-y-3">
                        {users.map((user: any) => (
                            <div key={user._id} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-900/50 hover:border-indigo-300 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-slate-900 dark:text-white">{user.name}</h4>
                                        {user.isVerified ? (
                                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 text-2xs py-0.5 px-2 rounded-full border">Verified</span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 text-2xs py-0.5 px-2 rounded-full border">Unverified</span>
                                        )}
                                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 text-2xs py-0.5 px-2 capitalize rounded-full border">{user.product || 'legal'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                                        <div><strong>Email:</strong> {user.email}</div>
                                        <div><strong>Token ID:</strong> <span className="font-mono text-2xs">{user.tokenIdentifier}</span></div>
                                        <div><strong>Firm ID:</strong> {user.firmId || <span className="text-red-400">None</span>}</div>
                                        <div><strong>Created:</strong> {new Date(user._creationTime).toLocaleDateString("en-GB")}</div>
                                    </div>
                                </div>
                                <div className="flex sm:flex-col gap-2 justify-end">
                                    {!user.isVerified && (
                                        <button
                                            onClick={() => handleForceVerify(user._id)}
                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                                        >
                                            <CheckCircleIcon className="w-3.5 h-3.5" /> Force Verify
                                        </button>
                                    )}
                                    {user.isMfaEnabled && (
                                        <button
                                            onClick={() => handleDisable2FA(user._id)}
                                            className="px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                                        >
                                            <ShieldCheckIcon className="w-3.5 h-3.5" /> Disable 2FA
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(user._id)}
                                        className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" /> Delete Record
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {ConfirmDialog}
        </div>
    );
};

export default AccountRecoverySettings;
