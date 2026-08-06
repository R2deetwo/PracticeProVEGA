/**
 * FirmManagement — full-screen firm management table for the Founder APK.
 * Consumes getAllFirmsForAdmin and updateFirmAdminSettings from Convex.
 *
 * Passes tokenIdentifier for server-side requireFounder() verification.
 * Handles loading and error states gracefully.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';
import { useFounderToast } from '../FounderContexts';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../../components/NairaSymbol';

export const FirmManagement: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const { addToast } = useFounderToast();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const firms = useQuery(api.founderMetrics.getAllFirmsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");
    const updateFirmSettings = useMutation(api.founderMetrics.updateFirmAdminSettings);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPlan, setEditPlan] = useState('');
    const [editStatus, setEditStatus] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [search, setSearch] = useState('');

    if (firms === undefined) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <div className="w-8 h-8 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    // If the query errored (e.g., not authorized), show a friendly message
    if (firms === null || (firms as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <p className="text-sm">Unable to load firms. You may not have founder permissions.</p>
            </div>
        );
    }

    const filtered = (firms as any[]).filter((f: any) =>
        !search || f.firmName?.toLowerCase().includes(search.toLowerCase()) ||
        f.adminEmail?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSave = async (firmId: string) => {
        try {
            await updateFirmSettings({
                tokenIdentifier,
                firmId,
                settings: {
                    subscriptionPlan: editPlan || undefined,
                    adminStatus: editStatus || undefined,
                    adminNotes: editNotes || undefined,
                },
            });
            addToast('Firm updated successfully.', { type: 'success' });
            setEditingId(null);
        } catch (e: any) {
            addToast(e?.message || 'Failed to update firm.', { type: 'error' });
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Firm Management</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{filtered.length} firms on the platform</p>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search firms..."
                        className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 w-48 sm:w-64"
                    />
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No firms found. Once firms sign up on the platform, they'll appear here.</p>
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
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Users</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Matters</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Monthly Sub.</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Sub. Status</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Joined</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                    {filtered.map((firm: any) => (
                                        <tr key={firm.id} className="hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-zinc-200 truncate max-w-[160px]" title={firm.firmName}>{firm.firmName}</td>
                                            <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 truncate max-w-[140px]" title={firm.adminEmail}>{firm.adminEmail}</td>
                                            <td className="py-2.5 px-3">
                                                {editingId === firm.id ? (
                                                    <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="bg-slate-50 dark:bg-zinc-700 text-xs rounded px-1 py-0.5 border border-slate-200 dark:border-zinc-600">
                                                        <option value="">Keep</option>
                                                        <option value="Core">Core</option>
                                                        <option value="Growth">Growth</option>
                                                        <option value="Pro">Pro</option>
                                                        <option value="Enterprise">Enterprise</option>
                                                        <option value="Komplete">Komplete</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.plan === 'Enterprise' || firm.plan === 'Komplete' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>{firm.plan}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">{firm.userCount}</td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">{firm.matterCount}</td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">
                                                {firm.monthlySubscription > 0 ? <><NairaSymbol />{formatNaira(firm.monthlySubscription)}</> : <span className="text-slate-400">Free</span>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                                    {firm.subscriptionStatus || 'pending'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {editingId === firm.id ? (
                                                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="bg-slate-50 dark:bg-zinc-700 text-xs rounded px-1 py-0.5 border border-slate-200 dark:border-zinc-600">
                                                        <option value="">Keep</option>
                                                        <option value="active">Active</option>
                                                        <option value="suspended">Suspended</option>
                                                        <option value="trial">Trial</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : firm.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{firm.status}</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-400 text-2xs whitespace-nowrap">{firm.joinedAt}</td>
                                            <td className="py-2.5 px-3">
                                                {editingId === firm.id ? (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleSave(firm.id)} className="px-2 py-0.5 bg-emerald-600 text-white rounded text-3xs font-bold hover:bg-emerald-700">Save</button>
                                                        <button onClick={() => setEditingId(null)} className="px-2 py-0.5 bg-slate-200 dark:bg-zinc-600 text-slate-600 dark:text-zinc-300 rounded text-3xs font-bold">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setEditingId(firm.id); setEditPlan(''); setEditStatus(''); setEditNotes(firm.notes || ''); }} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded text-3xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600">Edit</button>
                                                )}
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
