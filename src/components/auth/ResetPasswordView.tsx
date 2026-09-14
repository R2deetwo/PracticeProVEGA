/**
 * ResetPasswordView — the ONE-CLICK password reset landing page (2026-09-14).
 *
 * USER CONTEXT: "can we just do it without the reset code? send me where I
 * can reset the password without the difficulty please." Recovery emails now
 * lead with a "Set a new password now" button that opens /reset-password with
 * a single-use, 60-minute token. This page asks for exactly ONE thing: the
 * new password. No code, no email typing.
 *
 * Flow:
 *   /reset-password?token=<48-hex>[&portal=client|tenant]
 *   → completePasswordResetWithToken (public action, hashed-token lookup)
 *   → success: which-account confirmation + log-in buttons (main app /
 *     portal / founder note depending on role + portal param)
 *   → failure: plain-language reason + "get a fresh link" routing.
 *
 * Rendered OUTSIDE the authed shell (mounted like /setup-password) so it
 * works for logged-out users in any browser — which is exactly when someone
 * clicks a reset email.
 */
import React, { useMemo, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Logo } from '../../constants';

const MIN_PASSWORD = 8;

const ResetPasswordView: React.FC = () => {
    const params = useMemo(
        () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
        []
    );
    const token = (params.get('token') || '').trim();
    const portalType = params.get('portal') === 'tenant' ? 'tenant' : params.get('portal') === 'client' ? 'client' : null;

    // ACTION, not mutation: completePasswordResetWithToken hashes the token
    // and (via ctx.runAction) the new password — actions can't run under
    // useMutation.
    const completeReset = useAction(api.myFunctions.completePasswordResetWithToken);

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<{ email: string | null; role: string | null } | null>(null);

    const passwordsMatch = password === confirm;
    const longEnough = password.length >= MIN_PASSWORD;
    const canSubmit = !!token && passwordsMatch && longEnough && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) {
            if (!passwordsMatch) setError('The two passwords do not match — please re-type them.');
            else if (!longEnough) setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
            else if (!token) setError('This link has no reset token — open the newest reset email and tap its button.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res: any = await completeReset({ token, newPassword: password });
            if (res?.success) {
                setDone({ email: res.email ?? null, role: res.role ?? null });
            } else {
                setError(String(res?.message || 'Something went wrong — please request a fresh reset link.'));
            }
        } catch (err: any) {
            setError(err?.message || 'Something went wrong — please request a fresh reset link.');
        } finally {
            setSubmitting(false);
        }
    };

    const loginHref = portalType === 'tenant'
        ? '/portal/tenant/login'
        : portalType === 'client'
            ? '/portal/client/login'
            : '/?view=login';

    return (
        <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col items-center justify-center px-4 py-10 overflow-x-hidden overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="w-full max-w-md">

                {/* Brand */}
                <div className="flex flex-col items-center mb-8">
                    <Logo className="w-12 h-12 text-emerald-500 mb-3" />
                    <h1 className="text-xl font-bold text-white tracking-tight">PracticePro</h1>
                    <p className="text-xs text-slate-400 mt-1">Set a new password — no code needed</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-8">

                    {!token && !done && (
                        <div className="text-center space-y-4">
                            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">This link is incomplete</h2>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                                Open the newest PracticePro reset email and tap{' '}
                                <span className="font-bold text-slate-700 dark:text-zinc-200">“Set a new password now”</span>.
                            </p>
                            <a href={loginHref} className="inline-block px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold hover:opacity-90 transition-opacity">
                                Go to Log in
                            </a>
                        </div>
                    )}

                    {token && !done && (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Choose a new password</h2>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                    This link works once and expires 60 minutes after it was emailed.
                                    You will not need to enter any code.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="new-password" className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                                    New password
                                </label>
                                <div className="relative">
                                    <input
                                        id="new-password"
                                        type={show ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        className="w-full px-3.5 py-2.5 pr-16 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShow((s) => !s)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-2xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded"
                                    >
                                        {show ? 'HIDE' : 'SHOW'}
                                    </button>
                                </div>
                                {password.length > 0 && !longEnough && (
                                    <p className="text-2xs text-amber-600 dark:text-amber-400">Use at least {MIN_PASSWORD} characters.</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="confirm-password" className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                                    Confirm new password
                                </label>
                                <input
                                    id="confirm-password"
                                    type={show ? 'text' : 'password'}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    autoComplete="new-password"
                                    placeholder="Type it once more"
                                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                                />
                                {confirm.length > 0 && !passwordsMatch && (
                                    <p className="text-2xs text-rose-500">The passwords do not match.</p>
                                )}
                            </div>

                            {error && (
                                <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 px-3.5 py-3">
                                    <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
                                    <a href={loginHref} className="inline-block mt-2 text-2xs font-bold text-rose-700 dark:text-rose-300 underline">
                                        Request a fresh link via “Forgot password?”
                                    </a>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                                    canSubmit
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99]'
                                        : 'bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                                }`}
                            >
                                {submitting ? 'Setting your new password…' : 'Set new password'}
                            </button>
                        </form>
                    )}

                    {done && (
                        <div className="text-center space-y-5">
                            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your password has been updated</h2>
                                {done.email && (
                                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                                        The password for <span className="font-bold text-slate-700 dark:text-zinc-200">{done.email}</span> was
                                        changed just now.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2.5">
                                <a href={loginHref} className="block w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition-colors">
                                    Log in now
                                </a>
                                {done.role === 'Founder' && (
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                                        This is a <span className="font-bold">Founder</span> account — open the PracticePro Founder app on your
                                        phone and log in there with your new password.
                                    </p>
                                )}
                                {(done.role === 'Tenant' || done.role === 'Client') && !portalType && (
                                    <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                                        This is a <span className="font-bold">{done.role === 'Tenant' ? 'resident' : 'client'}</span> portal
                                        account — log in on the{' '}
                                        <a className="underline font-bold" href={done.role === 'Tenant' ? '/portal/tenant/login' : '/portal/client/login'}>
                                            {done.role === 'Tenant' ? 'Residents' : 'Client'} portal
                                        </a>{' '}
                                        page.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center text-2xs text-slate-500 mt-6 leading-relaxed">
                    Didn’t request this? You can safely ignore the email — your password only changed if you completed this page.
                </p>
            </div>
        </div>
    );
};

export default ResetPasswordView;
