/**
 * TenantPortalLogin — Standalone login page for Atrium Residents' Portal
 *
 * External-facing login at /portal/tenant/login for residents
 * to access their SC/MV financial ledger, download receipts,
 * and log maintenance tickets.
 *
 * Feature-gated: Available on Atrium Growth and Pro plans only.
 */
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Logo, LockClosedIcon, ShieldCheckIcon } from '../../constants';

const TenantPortalLogin: React.FC = () => {
    const { openModal } = useUI();
    const { isAuthenticated, currentUser } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // If already authenticated as a tenant, redirect to portal
    if (isAuthenticated && currentUser?.role === 'Tenant') {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center p-6">
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] bg-amber-500/10 pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                {/* Brand header — matches footer layout */}
                <div className="text-center mb-8">
                    <div className="inline-flex flex-col items-center gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                            <Logo className="h-6 w-6 text-primary-500" />
                            <span className="text-xl font-bold text-white tracking-tight flex items-center">
                                Practice<span className="text-primary-500">Pro</span>
                                <span className="ml-2 text-[11px] font-black uppercase tracking-tight text-violet-400">
                                    ATRIUM
                                </span>
                            </span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Residents' Portal</h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        View your SC/MV payment status, download rent receipts, and log maintenance issues.
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
                                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all"
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
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => openModal('login')}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                        >
                            Sign In to Residents' Portal
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
    );
};

export default TenantPortalLogin;
