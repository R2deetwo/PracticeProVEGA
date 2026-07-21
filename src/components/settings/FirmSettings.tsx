
import React, { useState, useMemo } from 'react';
import { User, FirmDetails, ModalType, CourtType, UserRole, SubscriptionPlan } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { EditIcon, TrashIcon, SearchIcon, UserCircleIcon, PlusIcon, GavelIconLarge, CalculatorIcon, DocumentIcon, ZapIcon, GlobeIcon, LockClosedIcon, ShieldCheckIcon, RevertIcon, OfficeBuildingIcon, BillingIcon } from '../../constants';
import RpcGuidanceAgent from '../RpcGuidanceTip';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import ProTip from '../ProTip';
import { useFeatures } from '../../hooks/useFeatures';
import { useProduct } from '../../contexts/ProductContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string, onTitleClick?: () => void }> = ({ title, children, id, className, onTitleClick }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3
                className={`text-xl font-bold text-gray-900 dark:text-white mb-4 ${onTitleClick ? 'cursor-pointer select-none active:text-primary-500' : ''}`}
                onClick={onTitleClick}
            >
                {title}
            </h3>
            {children}
        </div>
    </div>
);

// Unified Role Badge Component
const RoleBadge: React.FC<{ role: UserRole, isPrimaryAdmin: boolean }> = ({ role, isPrimaryAdmin }) => {
    const { isProperty } = useProduct();
    let classes = "";
    let label = role.toString();
    let isPortalUser = role === UserRole.Client || role === UserRole.Tenant;

    // Primary Admin (Purple/Royal)
    if (isPrimaryAdmin) {
        classes = "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
        label = "Admin (Primary)";
    }
    // Secondary Admin (Orange/Gold)
    else if (role === UserRole.Admin) {
        classes = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800";
        label = "Admin";
    }
    // Lawyer (Blue)
    else if (role === UserRole.Lawyer) {
        classes = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
        label = isProperty ? "Manager" : "Lawyer";
    }
    // Paralegal (Green)
    else if (role === UserRole.Paralegal) {
        classes = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800";
        label = isProperty ? "Associate" : "Paralegal";
    }
    // Client (Violet with portal icon)
    else if (role === UserRole.Client) {
        classes = "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800";
        label = "Client Portal";
    }
    // Tenant (Sky with portal icon)
    else if (role === UserRole.Tenant) {
        classes = "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800";
        label = "Resident Portal";
    }
    // Pending (Amber)
    else if (role === UserRole.Pending) {
        classes = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500 border border-amber-200 dark:border-amber-800 animate-pulse";
        label = "Pending Access";
    }
    // Default/Other
    else {
        classes = "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600";
    }

    return (
        <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md ${classes} inline-flex items-center gap-1`}>
            {isPortalUser && (
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            )}
            {label}
        </span>
    );
};

interface FirmSettingsProps {
    firmDetails: FirmDetails;
    onUpdateFirmDetails: (details: FirmDetails) => void;
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    users: User[];
    currentUser: User;
    openUserModal: (modalType: ModalType, id?: string) => void;
    onDeleteUser: (userId: string) => void;
    onEnableDevMode: () => void;
}

const FirmSettings: React.FC<FirmSettingsProps> = ({ firmDetails, onUpdateFirmDetails, openModal, users, currentUser, openUserModal, onDeleteUser, onEnableDevMode }) => {
    const permissions = usePermissions();
    const { isProperty } = useProduct();
    const { loginAsUser } = useAuth();
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const { addToast, navigateTo, closeModal, activePeers } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const { handleClearMatterLogs, handleDeleteAllChats, handleUpdateUser, regenerateInviteCode } = useDataActions();
    const { maxUsers, canAddUsers } = useFeatures();
    const [clickCount, setClickCount] = useState(0);
    const [isRotating, setIsRotating] = useState(false);

    // Identify Primary Admin (Creator)
    const primaryAdminId = firmDetails.created_by || users.find(u => u.role === UserRole.Admin)?.id;

    // Filter out client users for counting limit
    const staffUsers = users.filter(u => u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.ExternalCounsel && u.role !== UserRole.Pending);
    const canAddMoreUsers = maxUsers === null || staffUsers.length < (maxUsers as number);

    const handleTitleClick = () => {
        const newCount = clickCount + 1;
        setClickCount(newCount);
        if (newCount === 5) {
            onEnableDevMode();
            addToast("Developer Toolkit Activated!", { type: 'success' });
            setClickCount(0);
        }
    };

    const filteredUsers = useMemo(() => {
        const userList = users || [];
        const uniqueUsersMap = new Map();
        userList.forEach(u => {
            if (u && u.id) uniqueUsersMap.set(u.id, u);
        });
        const uniqueUsers = Array.from(uniqueUsersMap.values());
        // Filter OUT portal users (clients, tenants, external counsel)
        // from the team management table. Portal users are managed separately
        // in the Portal Access settings tab.
        // NOTE: Pending users ARE included here so admins can see and accept/reject
        // join requests. Previously Pending was filtered out, making join requests
        // invisible to admins — they'd get the notification but couldn't see the
        // user in the list to accept them.
        const teamUsers = uniqueUsers.filter(u =>
            u.role !== UserRole.Client &&
            u.role !== UserRole.Tenant &&
            u.role !== UserRole.ExternalCounsel
        );
        // Sort: Pending users first (so admins see join requests immediately),
        // then alphabetical by name
        const sortedUsers = teamUsers.sort((a, b) => {
            const aPending = a.role === UserRole.Pending ? 0 : 1;
            const bPending = b.role === UserRole.Pending ? 0 : 1;
            if (aPending !== bPending) return aPending - bPending;
            return (a.name || '').localeCompare(b.name || '');
        });

        if (!userSearchTerm.trim()) {
            return sortedUsers;
        }
        const lowercasedFilter = userSearchTerm.toLowerCase();
        return sortedUsers.filter(user =>
            user && (
                (user.name || '').toLowerCase().includes(lowercasedFilter) ||
                (user.email || '').toLowerCase().includes(lowercasedFilter) ||
                (user.role || '').toLowerCase().includes(lowercasedFilter)
            )
        );
    }, [users, userSearchTerm]);

    const handleRemoveUser = (user: User) => {
        if (!user) return;
        openModal('deleteConfirmation', user.id, {
            title: 'Remove User?',
            message: `Are you sure you want to remove ${user.name}? They will lose all access and be unassigned from all items. This action cannot be undone.`,
            onConfirm: () => { onDeleteUser(user.id); closeModal(); },
            confirmText: 'Yes, Remove User',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        try {
            await handleUpdateUser(userId, { role: newRole });
            addToast(`User access updated to ${newRole}.`, { type: 'success' });
        } catch (e: any) {
            console.error('[FirmSettings] handleRoleChange failed:', e);
            addToast(e?.message || "Failed to update user role. Please try again.", { type: 'error' });
        }
    };

    const handleCopyInviteCode = () => {
        if (firmDetails.inviteCode) {
            navigator.clipboard.writeText(firmDetails.inviteCode);
            addToast("Invite code copied to clipboard!", { type: 'success' });
        }
    };

    const handleRotateCode = async () => {
        openModal('deleteConfirmation', 'rotateCode', {
            title: "Rotate Invite Code?",
            message: "Are you sure? This will invalidate the old code immediately. Any users trying to join with the old code will fail.",
            onConfirm: async () => {
                setIsRotating(true);
                try {
                    await regenerateInviteCode(firmDetails._id || firmDetails.id || currentUser.firmId);
                    addToast("Invite Code Rotated!", { type: 'success' });
                } catch (e) {
                    console.error(e);
                    addToast("Failed to rotate code. Check permissions.", { type: 'error' });
                } finally {
                    setIsRotating(false);
                }
                closeModal();
            },
            confirmText: "Rotate Code",
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const currentPlan = firmDetails.subscriptionPlan || SubscriptionPlan.Core;
    const isHighTier = currentPlan === SubscriptionPlan.Enterprise || currentPlan === SubscriptionPlan.Komplete;
    const bankAccounts = firmDetails.bankAccounts || [];

    return (
        <div className="space-y-8">
            <SettingsCard title={isProperty ? "Portfolio Profile" : "Firm Profile"} onTitleClick={handleTitleClick} id="firm-details">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-700 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                            {firmDetails && firmDetails.logoUrl ? (
                                <img src={firmDetails.logoUrl} alt="Firm Logo" className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-xs text-gray-400 text-center px-1">No Logo</span>
                            )}
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">{firmDetails?.name || (isProperty ? 'Your Portfolio' : 'Your Firm')}</h4>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 whitespace-pre-line">{firmDetails?.address || 'Address not set'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => openModal('editFirmDetails')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full text-slate-500 transition-colors"
                        title="Edit Profile"
                    >
                        <EditIcon className="w-5 h-5" />
                    </button>
                </div>
            </SettingsCard>

            {/* Financial Configuration Section */}
            <SettingsCard title="Financial Configuration" id="financial-config">
                <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                    Manage the bank accounts that appear on your invoices.
                </p>
                <div className="space-y-3">
                    {bankAccounts.length > 0 ? (
                        bankAccounts.map(account => (
                            <div key={account.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{account.bankName}</p>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">{account.accountNumber}</p>
                                    {account.accountName && <p className="text-xs text-slate-400">{account.accountName}</p>}
                                </div>
                                <button
                                    onClick={() => openModal('editBankAccount', account.id)}
                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-4 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg">
                            <p className="text-sm text-slate-400 mb-2">No bank accounts added.</p>
                        </div>
                    )}

                    <button
                        onClick={() => openModal('newBankAccount')}
                        className="w-full py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 rounded-lg font-bold text-sm hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4" /> Add Bank Account
                    </button>
                </div>
            </SettingsCard>

            {/* TRUST ACCOUNTING TOGGLE — Legal firms only */}
            {!isProperty && (
                <SettingsCard title="Trust Accounting" id="trust-accounting">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="font-semibold text-slate-900 dark:text-white text-sm">Enable Trust Account</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                Track client funds held in trust separately from your operating account. Adds a "Trust Account" tab to your Financials page where you can record deposits, withdrawals, and transfers with running balance tracking.
                            </p>
                            <p className="text-2xs text-slate-400 mt-2">
                                You can turn this off anytime — existing trust transactions are preserved.
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateFirmDetails({
                                ...firmDetails,
                                trustAccountingEnabled: !firmDetails.trustAccountingEnabled,
                            })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${firmDetails.trustAccountingEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-600'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${firmDetails.trustAccountingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </SettingsCard>
            )}
            <SettingsCard title={isProperty ? "Portfolio Switching" : "Firm Switching"} id="firm-switching">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-600 dark:text-zinc-400">
                        <p className="font-semibold text-slate-900 dark:text-white mb-1">{isProperty ? "Switch to Another Portfolio" : "Switch to Another Firm"}</p>
                        <p className="max-w-md">
                            {isHighTier
                                ? "As a Komplete or Enterprise user, you can join multiple workspaces and switch between them instantly while retaining data."
                                : `Joining a new ${isProperty ? 'portfolio' : 'firm'} will overwrite your current workspace connection and clear local data.`}
                        </p>
                        {!isHighTier && (
                            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center cursor-pointer hover:underline" onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}>
                                <ShieldCheckIcon className="w-3 h-3 mr-1" /> Upgrade to Pro to enable Multi-Workspace Retention.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => openModal('joinFirm')}
                            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                        >
                            <OfficeBuildingIcon className="w-5 h-5 text-primary-600" /> {isProperty ? "Join Another Portfolio" : "Join Another Firm"}
                        </button>
                        {!isHighTier && (
                            <button
                                onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                                className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline text-center"
                            >
                                Upgrade Plan
                            </button>
                        )}
                    </div>
                </div>
            </SettingsCard>

            {permissions.canManageUsers && (
                <SettingsCard title="Team" id="user-management">
                    {/* Invitation Key Component */}
                    <div className="mb-8 p-6 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform">
                            <LockClosedIcon className="w-40 h-40 text-slate-500 dark:text-white" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{isProperty ? 'Workspace Secret Access Code' : 'Firm Secret Access Code'}</h4>
                                </div>
                                <button onClick={handleRotateCode} disabled={isRotating} className="text-2xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors disabled:opacity-50">
                                    <RevertIcon className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} /> {isRotating ? 'Rotating...' : 'Rotate Code'}
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="flex-grow w-full sm:w-auto">
                                    <div className="bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-4 flex items-center justify-between">
                                        <span className="text-2xl font-mono font-bold tracking-[0.2em] text-slate-800 dark:text-white uppercase">
                                            {firmDetails.inviteCode || 'GENERATING...'}
                                        </span>
                                        <button
                                            onClick={handleCopyInviteCode}
                                            className="px-3 py-1 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-md text-2xs font-bold uppercase transition-colors text-slate-600 dark:text-slate-200"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 text-sm text-slate-500 dark:text-slate-400 max-w-xs text-center sm:text-left">
                                    Share this code with your team. They can join by selecting "Join Existing" during signup.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <div className="relative w-full sm:w-64">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                placeholder="Search users..."
                                value={userSearchTerm}
                                onChange={e => setUserSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        {canAddMoreUsers ? (
                            <button onClick={() => openModal('newUser')} className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2 text-sm">
                                <PlusIcon className="w-4 h-4" />
                                Add User
                            </button>
                        ) : (
                            <button onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })} className="w-full sm:w-auto px-4 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2 text-sm">
                                <LockClosedIcon className="w-4 h-4" />
                                Limit Reached (Upgrade)
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-slate-200 dark:border-zinc-700 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 uppercase font-medium text-xs">
                                <tr>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                                {filteredUsers.map(user => {
                                    const isOnline = activePeers?.includes(user.id);
                                    const isInAnotherFirm = user.firmId !== firmDetails.id;
                                    const isMe = user.id === currentUser.id;
                                    
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${getUserColor(user.name)}`}>
                                                        {getInitials(user.name)}
                                                    </div>
                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-800 ${isOnline ? 'bg-green-500' : 'bg-slate-300 dark:bg-zinc-600'}`}></span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-1.5 text-sm">
                                                        {user.name}
                                                        {isMe && <span className="text-2xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">You</span>}
                                                        {(user.role === UserRole.Client || user.role === UserRole.Tenant) && (
                                                            <span className="text-3xs font-bold bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                                Portal
                                                            </span>
                                                        )}
                                                    </span>
                                                    {isInAnotherFirm && (
                                                        <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">
                                                            Currently in other workspace
                                                        </span>
                                                     )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <RoleBadge role={user.role} isPrimaryAdmin={user.id === primaryAdminId} />
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{user.email}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {/* Role Switcher or Grant Access */}
                                                    {user.id !== currentUser.id && user.role === UserRole.Pending && (
                                                        <button
                                                            onClick={() => handleRoleChange(user.id, UserRole.Lawyer)}
                                                            className="px-3 py-1 bg-green-600 text-white rounded-md text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-1 shadow-sm"
                                                        >
                                                            <ShieldCheckIcon className="w-3 h-3" /> Grant Access
                                                        </button>
                                                    )}
                                                    
                                                    {user.id !== currentUser.id && user.role !== UserRole.Pending && (
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                                            className="text-xs p-1 border border-slate-200 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 focus:ring-primary-500"
                                                        >
                                                            <option value={UserRole.Admin}>Admin</option>
                                                            <option value={UserRole.Lawyer}>{isProperty ? 'Manager' : 'Lawyer'}</option>
                                                            <option value={UserRole.Paralegal}>{isProperty ? 'Associate' : 'Paralegal'}</option>
                                                        </select>
                                                    )}

                                                    {/* Edit User Button */}
                                                    <button
                                                        onClick={() => openUserModal('editUser', user.id)}
                                                        className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                                                        title="Edit User"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>

                                                    {/* Simulate Login (Dev Only) */}
                                                    <button
                                                        onClick={() => {
                                                            openModal('deleteConfirmation', user.id, {
                                                                title: "Switch User?",
                                                                message: `Switch view to ${user.name}? This will reload the application as this user.`,
                                                                onConfirm: () => {
                                                                    loginAsUser(user);
                                                                    setTimeout(() => window.location.reload(), 100);
                                                                },
                                                                confirmText: "Switch & Reload"
                                                            });
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                        title="Simulate Login"
                                                    >
                                                        <UserCircleIcon className="w-4 h-4" />
                                                    </button>

                                                    {/* Remove User Button */}
                                                    {user.id !== currentUser.id && (
                                                        <button
                                                            onClick={() => handleRemoveUser(user)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                            title="Remove User"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </SettingsCard>
            )}
        </div>
    );
};

export default FirmSettings;
