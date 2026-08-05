/**
 * UserManagement — all users across all firms on the platform.
 * Shows firm name, admin email, plan, team size, matters, status.
 *
 * Passes tokenIdentifier for server-side requireFounder() verification.
 * Handles loading and error states gracefully.
 */

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';

export const UserManagement: React.FC = () => {
    const { currentUser } = useAuth();
    const [search, setSearch] = useState('');
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const firms = useQuery(api.founderMetrics.getAllFirmsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");

    if (firms === undefined) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <div className="w-8 h-8 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (firms === null || (firms as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <p className="text-sm">Unable to load users. You may not have founder permissions.</p>
            </div>
        );
    }

    // Flatten all firms into a user-like view (firm admin level)
    const allUsers: any[] = (firms as any[]).map((firm: any) => ({
        id: firm.id,
        name: firm.firmName,
        email: firm.adminEmail,
        role: 'Admin',
        firm: firm.firmName,
        plan: firm.plan,
        status: firm.status,
        userCount: firm.userCount,
        matterCount: firm.matterCount,
        firmSpecialties: firm.firmSpecialties || [],
    }));

    const filtered = allUsers.filter(u =>
        !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.firm?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Firm Administrators</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{filtered.length} firm admins across the platform</p>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search users..."
                        className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 w-48 sm:w-64"
                    />
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No firm administrators found.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-700 text-left bg-slate-50 dark:bg-zinc-900/50">
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Firm</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Admin Email</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Plan</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Team Size</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Matters</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Specialties</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                    {filtered.map((user: any) => (
                                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-zinc-200 truncate max-w-[160px]" title={user.firm}>{user.firm}</td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 truncate max-w-[180px]" title={user.email}>{user.email}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${user.plan === 'Enterprise' || user.plan === 'Komplete' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>{user.plan}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">{user.userCount}</td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">{user.matterCount}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : user.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{user.status}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 text-2xs truncate max-w-[120px]">
                                                {(user.firmSpecialties || []).join(', ') || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
