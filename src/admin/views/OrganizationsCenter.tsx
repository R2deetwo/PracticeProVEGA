/**
 * OrganizationsCenter — unified view replacing the separate Firm Management
 * and User Management pages.
 *
 * Shows all firms/organizations in a master table. Tapping a row opens
 * a detail drawer with:
 *   - Organization details & subscription tier
 *   - Associated administrators, users, and roles
 *   - Activity history and active product usage
 *
 * PRIVACY: Only shows platform subscription billing data (what the firm
 * pays PracticePro). Client-level invoices and financials are NEVER shown.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';
import { useFounderToast } from '../FounderContexts';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../../components/NairaSymbol';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';

const PRODUCT_LABEL: Record<string, string> = {
    legal: 'Vega (Legal)',
    property: 'Atrium (Property)',
    unified: 'Komplete',
    vega: 'Vega (Legal)',
    atrium: 'Atrium (Property)',
    komplete: 'Komplete',
};

export const OrganizationsCenter: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const { addToast } = useFounderToast();
    const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
    const firms = useQuery(api.founderMetrics.getAllFirmsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");
    const updateFirmSettings = useMutation(api.founderMetrics.updateFirmAdminSettings);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPlan, setEditPlan] = useState('');
    const [editStatus, setEditStatus] = useState('');

    if (firms === undefined) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
                <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Organizations</h2>
                </div>
                <div className="px-4 sm:px-6 lg:px-8 space-y-3">
                    <div className="h-20 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 animate-pulse" />
                    <div className="h-20 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 animate-pulse" />
                    <div className="h-20 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 animate-pulse" />
                </div>
            </div>
        );
    }

    if (firms === null || (firms as any)?.error) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <p className="text-sm">Unable to load organizations.</p>
            </div>
        );
    }

    const filtered = (firms as any[]).filter((f: any) =>
        !search || f.firmName?.toLowerCase().includes(search.toLowerCase()) ||
        f.adminEmail?.toLowerCase().includes(search.toLowerCase())
    );

    const selectedFirm = selectedId ? (firms as any[]).find(f => f.id === selectedId) : null;

    const handleSave = async (firmId: string) => {
        try {
            await updateFirmSettings({
                tokenIdentifier,
                firmId,
                settings: {
                    subscriptionPlan: editPlan || undefined,
                    adminStatus: editStatus || undefined,
                },
            });
            addToast('Organization updated.', { type: 'success' });
            setEditingId(null);
        } catch (e: any) {
            addToast(e?.message || 'Failed to update.', { type: 'error' });
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Organizations</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{filtered.length} firms & organizations</p>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search organizations..."
                        className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 w-32 sm:w-64"
                    />
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
                        <p className="text-sm text-slate-400">No organizations found.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-700 text-left bg-slate-50 dark:bg-zinc-900/50">
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Organization</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Product</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Plan</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Team</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Monthly Sub.</th>
                                        <th className="py-3 px-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                    {filtered.map((firm: any) => (
                                        <tr
                                            key={firm.id}
                                            onClick={() => setSelectedId(firm.id)}
                                            className={`cursor-pointer transition-colors ${selectedId === firm.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/30'}`}
                                        >
                                            <td className="py-2.5 px-3">
                                                <p className="font-semibold text-slate-700 dark:text-zinc-200 truncate max-w-[140px]">{firm.firmName}</p>
                                                <p className="text-2xs text-slate-400 truncate max-w-[140px]">{firm.adminEmail}</p>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400">
                                                    {PRODUCT_LABEL[firm.product] || firm.product || 'Vega'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.plan === 'Enterprise' || firm.plan === 'Komplete' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>{firm.plan}</span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">{firm.userCount}</td>
                                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300 font-bold">
                                                {firm.monthlySubscription > 0 ? <><NairaSymbol />{formatNaira(firm.monthlySubscription)}</> : <span className="text-slate-400">Free</span>}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold ${firm.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : firm.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{firm.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Detail Drawer */}
                {selectedFirm && (
                    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center" onClick={() => setSelectedId(null)}>
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div
                            className="relative bg-white dark:bg-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-full sm:max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="sticky top-0 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 p-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedFirm.firmName}</h3>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400">{PRODUCT_LABEL[selectedFirm.product] || selectedFirm.product || 'Vega'}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedId(null)}
                                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 space-y-4">
                                {/* Subscription */}
                                <div className={CARD}>
                                    <p className={LABEL}>Platform Subscription</p>
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        <div>
                                            <p className="text-2xs text-slate-400">Plan</p>
                                            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{selectedFirm.plan}</p>
                                        </div>
                                        <div>
                                            <p className="text-2xs text-slate-400">Monthly</p>
                                            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">
                                                {selectedFirm.monthlySubscription > 0 ? <><NairaSymbol />{formatNaira(selectedFirm.monthlySubscription)}</> : 'Free'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-2xs text-slate-400">Billing</p>
                                            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{selectedFirm.billingInterval || 'monthly'}</p>
                                        </div>
                                        <div>
                                            <p className="text-2xs text-slate-400">Setup Fee</p>
                                            <p className={`text-sm font-bold ${selectedFirm.setupFeePaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {selectedFirm.setupFeePaid ? 'Paid' : 'Pending'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Team */}
                                <div className={CARD}>
                                    <p className={LABEL}>Team & Usage</p>
                                    <div className="grid grid-cols-3 gap-3 mt-2">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-slate-700 dark:text-zinc-200">{selectedFirm.userCount}</p>
                                            <p className="text-2xs text-slate-400">Users</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-slate-700 dark:text-zinc-200">{selectedFirm.matterCount}</p>
                                            <p className="text-2xs text-slate-400">Matters</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-slate-700 dark:text-zinc-200">{selectedFirm.joinedAt}</p>
                                            <p className="text-2xs text-slate-400">Joined</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Admin Contact */}
                                <div className={CARD}>
                                    <p className={LABEL}>Administrator</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 mt-2">{selectedFirm.adminEmail}</p>
                                    {selectedFirm.address && (
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{selectedFirm.address}</p>
                                    )}
                                </div>

                                {/* Admin Actions */}
                                <div className={CARD}>
                                    <p className={LABEL}>Admin Actions</p>
                                    {editingId === selectedFirm.id ? (
                                        <div className="space-y-3 mt-2">
                                            <div>
                                                <label className="text-2xs font-bold text-slate-400">Plan</label>
                                                <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-zinc-900 text-xs rounded px-2 py-1.5 border border-slate-200 dark:border-zinc-600">
                                                    <option value="">Keep Current</option>
                                                    <option value="Core">Core</option>
                                                    <option value="Growth">Growth</option>
                                                    <option value="Pro">Pro</option>
                                                    <option value="Enterprise">Enterprise</option>
                                                    <option value="Komplete">Komplete</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-2xs font-bold text-slate-400">Status</label>
                                                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full mt-1 bg-slate-50 dark:bg-zinc-900 text-xs rounded px-2 py-1.5 border border-slate-200 dark:border-zinc-600">
                                                    <option value="">Keep Current</option>
                                                    <option value="active">Active</option>
                                                    <option value="suspended">Suspended</option>
                                                    <option value="trial">Trial</option>
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSave(selectedFirm.id)} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Save</button>
                                                <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg text-xs font-bold">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setEditingId(selectedFirm.id); setEditPlan(''); setEditStatus(''); }}
                                            className="mt-2 px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 w-full"
                                        >
                                            Edit Subscription & Status
                                        </button>
                                    )}
                                </div>

                                {/* Impersonation / Login As */}
                                <div className={CARD}>
                                    <p className={LABEL}>Support Actions</p>
                                    <button
                                        onClick={() => {
                                            // Open the consumer web app with the firm admin's email
                                            // as a URL query parameter. The consumer app reads this
                                            // on load and auto-logs in as that admin.
                                            //
                                            // WHY URL PARAM (not localStorage):
                                            //   The admin APK runs on capacitor://localhost while
                                            //   the consumer web app is at vercel.app — different
                                            //   origins. localStorage is NOT shared across origins,
                                            //   so setting it here does nothing for the web app.
                                            //   URL params ARE visible to the target page.
                                            const adminEmail = selectedFirm.adminEmail;
                                            if (adminEmail && adminEmail !== 'unknown') {
                                                const url = `https://practice-pro-vega.vercel.app/?impersonate=${encodeURIComponent(adminEmail.toLowerCase())}`;
                                                window.open(url, '_blank');
                                                addToast(`Opening firm dashboard as ${adminEmail}...`, { type: 'success' });
                                            } else {
                                                addToast('No admin email found for this firm.', { type: 'error' });
                                            }
                                        }}
                                        className="mt-2 w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                        Login As This Firm
                                    </button>
                                    <p className="text-2xs text-slate-400 mt-1">Opens the consumer app in a new tab as this firm's admin.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
