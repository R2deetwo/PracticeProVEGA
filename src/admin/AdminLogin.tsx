/**
 * AdminLogin — login + signup + ACCOUNT RECOVERY screen for the PracticePro Founder APK.
 *
 * THREE MODES:
 *   1. LOGIN: Existing founder enters email + password → verified via
 *      Convex verifyLogin action → if role='Founder', access granted.
 *   2. SIGNUP: New founder enters name + email + password → creates
 *      account via Convex createFounderAccount action → auto-logs in.
 *   3. RECOVER (2026-09-14 — the founder forgot the password AND the
 *      email): a two-lane self-service flow —
 *        a) "I know my email" → requestPasswordReset emails a recovery
 *           code → enter code + new password → resetPassword.
 *        b) "I don't remember the email" → search by the name on the
 *           account (findFounderAccounts → masked addresses only) →
 *           sendFounderRecoveryCode emails the picked account a recovery
 *           link (which also reveals which inbox to check) → continue
 *           at (a) with the code from that inbox.
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
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useFounderAuth } from './FounderContexts';

type Mode = 'login' | 'signup' | 'recover';
type RecoverStep = 'email-or-find' | 'enter-code';

export const AdminLogin: React.FC = () => {
    const { login } = useFounderAuth();
    const convex = useConvex();
    const [mode, setMode] = useState<Mode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ── Recovery state ──
    const [recoverStep, setRecoverStep] = useState<RecoverStep>('email-or-find');
    const [findQuery, setFindQuery] = useState('');
    const [findResults, setFindResults] = useState<Array<{ maskedEmail: string; displayName: string; memberSince: string | null }>>([]);
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    // ── Recovery actions ──
    const requestCode = async () => {
        if (!/\S+@\S+\.\S+/.test(email.trim())) {
            setError('Enter the email address on your founder account.');
            return;
        }
        setError(''); setNotice('');
        setIsLoading(true);
        try {
            await convex.mutation(api.myFunctions.requestPasswordReset, { email: email.trim().toLowerCase() });
            setRecoverStep('enter-code');
            setNotice(`If ${email.trim()} is a registered account, a recovery code is on its way. Check that inbox (and spam).`);
        } catch (e: any) {
            setError(e?.message || 'Could not send the recovery code.');
        } finally {
            setIsLoading(false);
        }
    };

    const searchAccounts = async () => {
        if (findQuery.trim().length < 3) {
            setError('Type at least 3 letters of the name on the account.');
            return;
        }
        setError(''); setNotice('');
        setIsLoading(true);
        try {
            const result: any = await convex.query(api.myFunctions.findFounderAccounts, { nameQuery: findQuery.trim() });
            setFindResults(result?.matches || []);
            if (!result?.matches?.length) {
                setNotice('No founder accounts match that name — try another spelling, or search part of the email.');
            }
        } catch (e: any) {
            setError(e?.message || 'Search failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const sendToMatch = async (index: number) => {
        setError(''); setNotice('');
        setIsLoading(true);
        try {
            const result: any = await convex.mutation(api.myFunctions.sendFounderRecoveryCode, {
                nameQuery: findQuery.trim(), matchIndex: index,
            });
            if (result?.success) {
                setRecoverStep('enter-code');
                setNotice(`Recovery code sent to that account's inbox. Open the email — it also shows the exact address to enter below with the code.`);
                setEmail('');
            } else {
                setError(result?.message || 'Could not send the recovery email.');
            }
        } catch (e: any) {
            setError(e?.message || 'Could not send the recovery email.');
        } finally {
            setIsLoading(false);
        }
    };

    const completeReset = async () => {
        if (!/\S+@\S+\.\S+/.test(email.trim())) {
            setError('Enter the email the recovery code was sent to.');
            return;
        }
        if (!code.trim()) { setError('Enter the recovery code from the email.'); return; }
        if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
        if (newPassword !== confirmNewPassword) { setError('The passwords do not match.'); return; }
        setError(''); setNotice('');
        setIsLoading(true);
        try {
            const result: any = await convex.action(api.myFunctions.resetPassword, {
                email: email.trim().toLowerCase(), newPassword, overrideCode: code.trim(),
            });
            if (result?.success) {
                setPassword(newPassword);
                setMode('login');
                setRecoverStep('email-or-find');
                setCode(''); setNewPassword(''); setConfirmNewPassword('');
                setNotice('Password updated — sign in with your new password.');
            } else {
                setError(result?.message || 'Recovery failed — check the code and email.');
            }
        } catch (e: any) {
            setError(e?.message || 'Recovery failed.');
        } finally {
            setIsLoading(false);
        }
    };

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
                    <h1 className="text-2xl font-bold text-white tracking-tight">PracticePro Founder</h1>
                    <p className="text-sm text-zinc-500 mt-1">Platform Control Center</p>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-1">
                    <button
                        onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                            mode === 'login' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => { setMode('signup'); setError(''); setNotice(''); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                            mode === 'signup' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        Create Account
                    </button>
                    {mode === 'recover' && (
                        <span className="flex-1 py-2 rounded-md text-sm font-bold bg-zinc-800 text-white">
                            Recover
                        </span>
                    )}
                </div>

                {/* ── RECOVERY MODE ── */}
                {mode === 'recover' && recoverStep === 'email-or-find' && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <div>
                            <h2 className="text-base font-bold text-white">Recover your account</h2>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                                Forgot your password? Start with your email. Forgot the email too? Search by the
                                name on the account and we'll send a recovery code to its inbox.
                            </p>
                        </div>
                        <div>
                            <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">I know my email</label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="flex-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                                />
                                <button
                                    onClick={requestCode}
                                    disabled={isLoading}
                                    className="px-4 py-2.5 bg-white text-black rounded-lg font-bold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
                                >
                                    Email me a code
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="flex-1 h-px bg-zinc-800" />
                            <span className="text-2xs text-zinc-600 font-bold uppercase">or</span>
                            <span className="flex-1 h-px bg-zinc-800" />
                        </div>
                        <div>
                            <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">I don't remember the email</label>
                            <div className="flex gap-2 mt-1">
                                <input
                                    type="text"
                                    value={findQuery}
                                    onChange={e => setFindQuery(e.target.value)}
                                    placeholder="Name (or part of it) on the account"
                                    className="flex-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                                />
                                <button
                                    onClick={searchAccounts}
                                    disabled={isLoading}
                                    className="px-4 py-2.5 bg-white text-black rounded-lg font-bold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
                                >
                                    Find
                                </button>
                            </div>
                        </div>
                        {findResults.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-2xs text-zinc-500 leading-relaxed">
                                    Matching founder accounts (addresses masked for safety). Pick yours — we'll email it a recovery code.
                                </p>
                                {findResults.map((m, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendToMatch(i)}
                                        disabled={isLoading}
                                        className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-black border border-zinc-800 hover:border-zinc-600 transition-colors text-left disabled:opacity-50"
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-sm text-white font-semibold truncate">{m.displayName || 'Founder account'}</span>
                                            <span className="block text-2xs text-zinc-500 truncate">{m.maskedEmail}{m.memberSince ? ` · since ${m.memberSince}` : ''}</span>
                                        </span>
                                        <span className="text-2xs font-bold text-white flex-shrink-0">Send code →</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {notice && (
                            <div className="bg-zinc-800/70 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 leading-relaxed">{notice}</div>
                        )}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 font-medium">{error}</div>
                        )}
                        <button
                            onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                            className="w-full text-2xs text-zinc-500 hover:text-white underline"
                        >
                            ← Back to sign in
                        </button>
                    </div>
                )}

                {/* ── RECOVERY: enter code + new password ── */}
                {mode === 'recover' && recoverStep === 'enter-code' && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <div>
                            <h2 className="text-base font-bold text-white">Check your inbox</h2>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                                Enter the email the code was sent to, the recovery code (it looks like
                                <span className="font-mono text-zinc-300"> RCV-123456</span>), and your new password.
                            </p>
                        </div>
                        <div>
                            <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                            />
                        </div>
                        <div>
                            <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Recovery code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="RCV-123456"
                                className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:ring-2 focus:ring-white"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">New password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                                />
                            </div>
                            <div>
                                <label className="text-2xs font-bold text-zinc-400 uppercase tracking-widest">Confirm new password</label>
                                <input
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={e => setConfirmNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full mt-1 px-3 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white"
                                />
                            </div>
                        </div>
                        {notice && (
                            <div className="bg-zinc-800/70 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 leading-relaxed">{notice}</div>
                        )}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 font-medium">{error}</div>
                        )}
                        <button
                            onClick={completeReset}
                            disabled={isLoading}
                            className="w-full py-2.5 bg-white text-black rounded-lg font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Resetting…' : 'Set new password'}
                        </button>
                        <button
                            onClick={() => { setRecoverStep('email-or-find'); setError(''); }}
                            className="w-full text-2xs text-zinc-500 hover:text-white underline"
                        >
                            ← Send another code
                        </button>
                    </div>
                )}

                {/* ── LOGIN / SIGNUP FORMS ── */}
                {mode !== 'recover' && (
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
                    {mode === 'login' && notice && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-400 leading-relaxed">
                            {notice}
                        </div>
                    )}

                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={() => { setMode('recover'); setRecoverStep('email-or-find'); setError(''); setNotice(''); }}
                            className="w-full text-2xs text-zinc-500 hover:text-white underline"
                        >
                            Forgot password — or the email you used?
                        </button>
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
                )}

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
