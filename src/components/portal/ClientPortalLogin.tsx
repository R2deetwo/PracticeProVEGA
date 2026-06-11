/**
 * ClientPortalLogin — Standalone login page for Vega Client Portal
 *
 * External-facing login at /portal/client/login for law firm clients
 * to access their matter milestones, document vault, and billing.
 *
 * Uses the same Convex auth system but presents a simplified,
 * branded experience without the full app sidebar.
 */
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Logo, LockClosedIcon, ShieldCheckIcon } from '../../constants';

const ClientPortalLogin: React.FC = () => {
    const { openModal, navigateTo } = useUI();
    const { isAuthenticated, currentUser } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // If already authenticated as a client, redirect to dashboard
    if (isAuthenticated && currentUser?.role === 'Client') {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col">
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] bg-primary-500/10 pointer-events-none" />

            {/* Brand header — top-left, matches landing page header positioning */}
            <div className="relative z-10 flex-shrink-0">
                <div className="container mx-auto px-6 h-16 flex items-center">
                    <div className="flex items-center gap-2.5">
                        <Logo className="h-7 w-7 text-primary-500" />
                        <span className="text-[19px] font-bold tracking-tight text-white flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                            <span className="ml-2 text-[15px] font-black uppercase tracking-tight text-amber-500">
                                VEGA
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Login card — centred in remaining space */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="relative z-10 w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">Client Portal</h1>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            View matter milestones, upload and access documents, and track case progress.
                        </p>
                    </div>

                    {/* Login card */}
                    <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => openModal('login')}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98]"
                            >
                                Sign In to Client Portal
                            </button>

                            <button
                                onClick={() => {
                                    window.location.href = '/';
                                }}
                                className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all"
                            >
                                Back to PracticePro
                            </button>
                        </div>
                    </div>

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-4 mt-6">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <ShieldCheckIcon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">NDPA 2023</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <LockClosedIcon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">AES-256</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientPortalLogin;
