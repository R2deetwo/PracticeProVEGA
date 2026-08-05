/**
 * AdminLogin — login + signup screen for the PracticePro Founder APK.
 *
 * TWO MODES:
 *   1. LOGIN: Existing founder enters email + password → verified via
 *      Convex verifyLogin action → if role='Founder', access granted.
 *   2. SIGNUP: New founder enters name + email + password → creates
 *      account via Convex createFounderAccount action → auto-logs in.
 *
 * ROLE GATING:
 *   After login, if the user's role is NOT 'Founder', they see an
 *   "Access Denied" message. This prevents firm-level Admins (lawyers)
 *   from accessing platform-wide data if they download the wrong APK.
 *
 * NO EMAIL VERIFICATION:
 *   Founder accounts are auto-verified on signup (no 6-digit code).
 *   This is intentional — the founder is the only person using this APK.
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { UserRole } from '../types';

type Mode = 'login' | 'signup';

export const AdminLogin: React.FC = () => {
    const { login } = useAuth();
    const convex = useConvex();
    const [mode, setMode] = useState<Mode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password) {
            setError('Please enter your email and password.');
            return;
        }

        if (mode === 'signup' && !name.trim()) {
            setError('Please enter your name.');
            return;
        }

        if (mode === 'signup' && password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setIsLoading(true);

        try {
            if (mode === 'signup') {
                // Create the founder account
                const result = await convex.action(api.founderMetrics.createFounderAccount, {
                    fullName: name.trim(),
                    email: email.trim(),
                    password,
                });

                if (!result.success) {
                    setError(result.message || 'Signup failed.');
                    setIsLoading(false);
                    return;
                }
            }

            // Log in (works for both signup and login modes)
            const loginResult = await login(email.trim(), password);

            if (!loginResult.success) {
                setError(loginResult.message || 'Login failed.');
                setIsLoading(false);
                return;
            }

            // The AuthContext will re-render AdminApp, which checks the role.
            // If the user isn't a Founder, AdminApp shows "Access Denied".
        } catch (err: any) {
            setError(err?.message || 'An error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] flex items-center justify-center bg-black p-4">
            <div className="w-full max-w-sm">
                {/* Logo — black mark, standard for the Founder App */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-black border border-zinc-700 flex items-center justify-center text-white font-black text-2xl shadow-xl mb-3">
                        P
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">PracticePro Founder</h1>
                    <p className="text-sm text-zinc-500 mt-1">Platform Control Center</p>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1">
                    <button
                        onClick={() => { setMode('login'); setError(''); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                            mode === 'login' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => { setMode('signup'); setError(''); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                            mode === 'signup' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        Create Account
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    {mode === 'signup' && (
                        <div>
                            <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Your name"
                                required
                                autoFocus
                                className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoFocus={mode === 'login'}
                            className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                    </div>
                    <div>
                        <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                        />
                        {mode === 'signup' && (
                            <p className="text-3xs text-zinc-600 mt-1">Minimum 8 characters</p>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 bg-white text-black rounded-lg font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                            </span>
                        ) : (mode === 'signup' ? 'Create Founder Account' : 'Sign In')}
                    </button>
                </form>

                <p className="text-center text-2xs text-zinc-600 mt-4">
                    {mode === 'login' ? (
                        <>Don't have a founder account? <button onClick={() => { setMode('signup'); setError(''); }} className="text-zinc-400 underline hover:text-white">Create one</button></>
                    ) : (
                        <>Already have an account? <button onClick={() => { setMode('login'); setError(''); }} className="text-zinc-400 underline hover:text-white">Log in</button></>
                    )}
                </p>
            </div>
        </div>
    );
};
