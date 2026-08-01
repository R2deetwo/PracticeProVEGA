/**
 * AdminLogin — login screen for the PracticePro Admin APK.
 * Uses the same auth system as the main app (email/password against Convex).
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AdminLogin: React.FC = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setError('Please enter your email and password.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const result = await login(email.trim(), password);
            if (!result.success) {
                setError(result.message || 'Login failed.');
            }
            // On success, the AuthProvider will re-render and AdminApp will show
        } catch (err: any) {
            setError(err?.message || 'An error occurred during login.');
        } finally {
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

                {/* Login form */}
                <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div>
                        <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="founder@practicepro.ng"
                            required
                            autoFocus
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
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                <p className="text-center text-2xs text-zinc-600 mt-4">
                    Authorized personnel only. All actions are logged.
                </p>
            </div>
        </div>
    );
};
