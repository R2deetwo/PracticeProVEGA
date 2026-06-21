/**
 * SetupPassword — Dedicated page for portal invitees to create their password
 *
 * Flow:
 * 1. Extract ?token= from URL
 * 2. Call verifyInviteToken to validate the token is real, unexpired, and pending
 * 3. Show a polished "Create Your Password" form with pre-filled, disabled email
 * 4. On submit, call setupPortalPassword which:
 *    - Creates or updates the user account with the hashed password
 *    - Marks the invite as accepted
 *    - Clears the token to prevent replay attacks
 * 5. Redirect to the appropriate portal login page
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useAction } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Logo, LockClosedIcon, ShieldCheckIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, XIcon, ExternalLinkIcon } from '../../constants';

// Inline icons that aren't in constants
const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
);

type Step = 'loading' | 'invalid' | 'form' | 'submitting' | 'success';

const SetupPassword: React.FC = () => {
    const { login } = useAuth();
    const { addToast } = useUI();
    const navigate = useNavigate();

    // URL token
    const [token, setToken] = useState<string | null>(null);
    const [step, setStep] = useState<Step>('loading');
    const [invalidReason, setInvalidReason] = useState<string>('');
    const [inviteData, setInviteData] = useState<any>(null);
    // Store portal type separately — available even when verification returns valid:false
    const [portalTypeFromVerification, setPortalTypeFromVerification] = useState<'client' | 'resident' | null>(null);

    // Form state
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loginError, setLoginError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [termsError, setTermsError] = useState('');

    // Extract token from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        if (t) {
            setToken(t);
        } else {
            setStep('invalid');
            setInvalidReason('no_token');
        }
    }, []);

    // Verify the token
    const verification = useQuery(
        api.portals.verifyInviteToken,
        token ? { token } : 'skip'
    );

    // Setup password action
    const setupPassword = useAction(api.portals.setupPortalPassword);

    // Handle verification result
    useEffect(() => {
        if (verification === undefined) return; // still loading

        if (verification && 'valid' in verification) {
            // Store portalType from verification result regardless of validity
            const pt = (verification as any).portalType || verification.invite?.portalType;
            if (pt) setPortalTypeFromVerification(pt);

            if (verification.valid) {
                setInviteData(verification);
                setName(verification.invite?.inviteeName || '');
                setStep('form');
            } else {
                setStep('invalid');
                setInvalidReason(verification.reason || 'unknown');
            }
        }
    }, [verification]);

    // Password strength indicator
    const getPasswordStrength = useCallback((pw: string) => {
        if (!pw) return { label: '', score: 0, color: '' };
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        if (score <= 1) return { label: 'Weak', score: 1, color: 'bg-red-500' };
        if (score <= 2) return { label: 'Fair', score: 2, color: 'bg-orange-500' };
        if (score <= 3) return { label: 'Good', score: 3, color: 'bg-yellow-500' };
        if (score <= 4) return { label: 'Strong', score: 4, color: 'bg-emerald-400' };
        return { label: 'Excellent', score: 5, color: 'bg-emerald-500' };
    }, []);

    const strength = getPasswordStrength(password);

    const handleSubmit = async () => {
        setError('');
        setTermsError('');

        // Validation
        if (!password) {
            setError('Please enter a password.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!agreedToTerms) {
            setTermsError('You must agree to the Portal Terms of Use and the PracticePro Terms and Conditions of Service to proceed.');
            return;
        }
        if (!token) {
            setError('Invalid invitation link.');
            return;
        }

        setStep('submitting');

        try {
            const result = await setupPassword({
                token,
                password,
                name: name || undefined,
            });

            if (result.success) {
                setStep('success');

                // Store portal type immediately so App.tsx knows this is a portal user
                // during the auth loading phase (prevents flash of LandingPage)
                const portalType = inviteData?.invite?.portalType;
                if (portalType === 'client') {
                    sessionStorage.setItem('practicepro_portal_type', 'client');
                    localStorage.setItem('practicepro_portal_type', 'client');
                } else if (portalType === 'resident') {
                    sessionStorage.setItem('practicepro_portal_type', 'tenant');
                    localStorage.setItem('practicepro_portal_type', 'tenant');
                }

                // Auto-login after a short delay
                setTimeout(async () => {
                    try {
                        const loginResult = await login(result.email!, password);
                        if (loginResult.success) {
                            // Navigate to the portal-specific URL — this makes the URL
                            // meaningful and ties the session to the correct portal type
                            const portalPath = portalType === 'client' ? '/portal/client' : '/portal/tenant';
                            navigate(portalPath, { replace: true });
                        } else {
                            setLoginError('Your password has been set! Please sign in using the button below.');
                            setStep('success');
                        }
                    } catch {
                        setLoginError('Your password has been set! Please sign in manually.');
                        setStep('success');
                    }
                }, 1500);
            } else {
                setError(result.message || 'Something went wrong. Please try again.');
                setStep('form');
            }
        } catch (e: any) {
            setError(e.message || 'An error occurred. Please try again.');
            setStep('form');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && step === 'form') handleSubmit();
    };

    // Determine product branding from invite data — use portalTypeFromVerification
    // as a fallback for cases where inviteData isn't set (e.g., already_accepted screen)
    const effectivePortalType = inviteData?.invite?.portalType || portalTypeFromVerification;
    const isClientPortal = effectivePortalType === 'client';
    const productName = isClientPortal ? 'VEGA' : 'ATRIUM';
    const portalLabel = isClientPortal ? 'Client Portal' : "Residents' Portal";
    // Use concrete classes instead of dynamic template strings — Tailwind JIT can't compile bg-${color}-500
    const glowClass = isClientPortal ? 'bg-violet-500/10' : 'bg-amber-500/10';
    const brandTextClass = isClientPortal ? 'text-violet-400' : 'text-amber-400';

    // ─── Invalid token screen ─────────────────────────────────────────────
    if (step === 'invalid') {
        const messages: Record<string, { title: string; body: string }> = {
            no_token: {
                title: 'Missing Invitation',
                body: 'No invitation token was found. Please use the link from your invitation email.',
            },
            not_found: {
                title: 'Invalid Invitation Link',
                body: 'This invitation link does not exist or has already been used. Please request a new invitation.',
            },
            expired: {
                title: 'Invitation Expired',
                body: 'This invitation has expired. Please contact your manager to request a new one.',
            },
            revoked: {
                title: 'Invitation Revoked',
                body: 'This invitation has been revoked by the sender. Please contact them for more information.',
            },
            already_accepted: {
                title: 'Already Accepted',
                body: 'Your invitation has already been used and your account is set up. You can sign in directly using your email and password.',
            },
        };
        const msg = messages[invalidReason] || messages.not_found;

        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col overflow-x-hidden overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] bg-rose-500/10 pointer-events-none" />
                <div className="relative z-10 flex-shrink-0">
                    <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center">
                        <div className="flex items-center gap-2.5">
                            <Logo className="h-7 w-7 text-primary-500" />
                            <span className="text-[19px] font-bold tracking-tight text-white">Practice<span className="text-primary-500">Pro</span></span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="relative z-10 w-full max-w-md text-center">
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                            <AlertCircleIcon className="w-8 h-8 text-rose-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white mb-3">{msg.title}</h1>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">{msg.body}</p>
                        <button
                            onClick={() => { navigate('/'); }}
                            className="px-6 py-3 rounded-xl text-slate-300 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.08] transition-all"
                        >
                            Back to PracticePro
                        </button>
                        {invalidReason === 'already_accepted' && (
                            <button
                                onClick={() => {
                                    const isClient = effectivePortalType === 'client';
                                    navigate(isClient ? '/portal/client/login' : '/portal/tenant/login');
                                }}
                                className="ml-3 px-6 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-400 transition-all"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Loading screen ───────────────────────────────────────────────────
    if (step === 'loading') {
        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-slate-400">Verifying your invitation…</p>
                </div>
            </div>
        );
    }

    // ─── Success screen ───────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col overflow-x-hidden overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] bg-emerald-500/10 pointer-events-none" />
                <div className="relative z-10 flex-shrink-0">
                    <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center">
                        <div className="flex items-center gap-2.5">
                            <Logo className="h-7 w-7 text-primary-500" />
                            <span className="text-[19px] font-bold tracking-tight text-white">Practice<span className="text-primary-500">Pro</span></span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="relative z-10 w-full max-w-md text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                            <CheckCircleIcon className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-xl font-bold text-white mb-3">You're All Set!</h1>
                        <p className="text-sm text-slate-400 leading-relaxed mb-2">
                            Your password has been created and your account is now active.
                        </p>
                        <p className="text-sm text-slate-400 mb-6">
                            Signing you in automatically…
                        </p>
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
                        {loginError && (
                            <div className="mt-4">
                                <p className="text-sm text-amber-400 mb-4">{loginError}</p>
                                <button
                                    onClick={() => {
                                        // Go to the portal login page to sign in manually
                                        const isClient = effectivePortalType === 'client';
                                        navigate(isClient ? '/portal/client/login' : '/portal/tenant/login');
                                    }}
                                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all"
                                >
                                    Sign In to {portalLabel}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Main form ────────────────────────────────────────────────────────
    // CRITICAL: On Safari iOS, min-h-screen + flex-col WITHOUT overflow-y-auto
    // causes the page to be clipped — the user can't scroll to see the password
    // fields at the bottom. Added overflow-y-auto and -webkit-overflow-scrolling
    // for smooth scrolling on iOS. Also changed from min-h-screen to min-h-[100dvh]
    // which accounts for Safari's dynamic toolbar (100vh is too tall on iOS).
    return (
        <div
            className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col overflow-x-hidden overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            {/* Ambient glow */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[400px] rounded-full blur-[120px] ${glowClass} pointer-events-none`} />

            {/* Brand header */}
            <div className="relative z-10 flex-shrink-0">
                <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center">
                    <div className="flex items-center gap-2.5">
                        <Logo className="h-7 w-7 text-primary-500" />
                        <span className="text-[19px] font-bold tracking-tight text-white flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                            <span className={`ml-2 text-[15px] font-black uppercase tracking-tight ${brandTextClass}`}>
                                {productName}
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Form card */}
            <div className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6 overflow-y-auto">
                <div className="relative z-10 w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-6 sm:mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                            <LockClosedIcon className="w-6 h-6 text-amber-400" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                            Create Your Password
                        </h1>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Set up your secure password to access the {portalLabel}
                        </p>
                    </div>

                    {/* Invite info */}
                    {inviteData?.invite && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
                            <div className="flex items-start gap-2">
                                <ShieldCheckIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">Invitation Verified</p>
                                    <p className="text-violet-400/80 text-xs mt-0.5">
                                        {inviteData.invite.inviteeName
                                            ? `Welcome, ${inviteData.invite.inviteeName}. `
                                            : ''}
                                        {inviteData.hasAccount
                                            ? 'Your account has been located — setting your password will activate portal access.'
                                            : 'Your account will be created automatically.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 sm:p-8 shadow-2xl">
                        <div className="space-y-4">
                            {error && (
                                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Name (optional, for new accounts) */}
                            {inviteData && !inviteData.hasAccount && !inviteData.invite?.inviteeName && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Full name"
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all"
                                    />
                                </div>
                            )}

                            {/* Email (disabled, pre-filled) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    value={inviteData?.invite?.inviteeEmail || ''}
                                    disabled
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-sm cursor-not-allowed"
                                />
                                <p className="text-[10px] text-slate-600 mt-1">This is locked to your invitation email</p>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Create Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="At least 8 characters"
                                        className="w-full px-4 py-3 pr-10 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                                {/* Password strength bar */}
                                {password && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : 'bg-slate-700'} transition-all`} />
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-slate-500">{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Re-enter your password"
                                        className={`w-full px-4 py-3 pr-10 rounded-xl bg-white/[0.06] border text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 transition-all ${
                                            confirmPassword && confirmPassword !== password
                                                ? 'border-rose-500/50 focus:border-rose-500/50'
                                                : confirmPassword && confirmPassword === password
                                                ? 'border-emerald-500/50 focus:border-emerald-500/50'
                                                : 'border-white/[0.08] focus:border-amber-500/30'
                                        }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showConfirm ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                                {confirmPassword && confirmPassword === password && (
                                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                                        <CheckCircleIcon className="w-3 h-3" /> Passwords match
                                    </p>
                                )}
                            </div>

                            {/* Terms & Conditions */}
                            <div className={`mt-4 p-3 rounded-xl bg-white/[0.04] border ${termsError ? 'border-rose-500/50' : 'border-white/[0.08]'} transition-colors`}>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={agreedToTerms}
                                        onChange={e => { setAgreedToTerms(e.target.checked); if (e.target.checked) setTermsError(''); }}
                                        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-zinc-600 text-primary-600 focus:ring-primary-500 accent-amber-500"
                                    />
                                    <span className="text-xs text-slate-400 leading-relaxed">
                                        I agree to the{' '}
                                        <button
                                            type="button"
                                            onClick={() => setShowTerms(true)}
                                            className="text-amber-400 underline hover:text-amber-300 font-medium"
                                        >
                                            Portal Terms of Use
                                        </button>
                                        {' '}and the{' '}
                                        <a
                                            href="/terms-of-service"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-amber-400 underline hover:text-amber-300 font-medium"
                                        >
                                            PracticePro Terms and Conditions of Service
                                        </a>
                                    </span>
                                </label>
                                {termsError && (
                                    <p className="text-xs text-rose-400 mt-2 ml-7">{termsError}</p>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={step === 'submitting' || !password || !confirmPassword || password !== confirmPassword || !agreedToTerms}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {step === 'submitting' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creating Your Account…
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheckIcon className="w-4 h-4" />
                                        Set Up Password & Activate
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => { navigate('/'); }}
                                disabled={step === 'submitting'}
                                className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all disabled:opacity-50"
                            >
                                Back to PracticePro
                            </button>
                        </div>
                    </div>

                    {/* Portal Terms of Use overlay */}
                    {showTerms && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white">Portal Terms of Use</h3>
                                    <button onClick={() => setShowTerms(false)} className="text-slate-400 hover:text-slate-200">
                                        <XIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="prose prose-sm prose-invert max-w-none text-slate-400 space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">PracticePro {isClientPortal ? 'Client' : "Residents'"} Portal — Portal Terms of Use</p>
                                    <p className="text-xs text-slate-500 italic">Effective Date: January 1, 2026 • Version 1.0</p>
                                    <p>By accessing this portal, you agree to the following terms:</p>

                                    <h4 className="text-sm font-bold text-slate-200">1. Purpose and Scope</h4>
                                    <p>The PracticePro {isClientPortal ? 'Client' : "Residents'"} Portal is a secure, web-based interface that allows you to interact with your {isClientPortal ? 'legal service provider' : 'property manager'} through the PracticePro {productName} platform. Your access is limited to the features and data that your {isClientPortal ? 'law firm' : 'property management firm'} has expressly enabled for your account.</p>

                                    <h4 className="text-sm font-bold text-slate-200">2. User Responsibilities</h4>
                                    <p>You represent and warrant that all information you provide through the Portal is accurate, complete, and current. You are solely responsible for maintaining the confidentiality of your login credentials. You must not share your password with any third party.</p>
                                    <p>You must not use the Portal to upload unlawful content, attempt to gain unauthorized access, interfere with the platform's integrity, use automated means to extract data, reverse-engineer any component, or impersonate any person or entity.</p>

                                    <h4 className="text-sm font-bold text-slate-200">3. Privacy and Data Protection</h4>
                                    <p>Your personal data is processed in accordance with the Nigeria Data Protection Act 2023 (NDPA 2023). PracticePro employs AES-256 encryption at rest, TLS 1.3 for data in transit, and PBKDF2 password hashing. Under the NDPA 2023, you have the right to access, rectify, erase, and restrict the processing of your personal data.</p>

                                    <h4 className="text-sm font-bold text-slate-200">4. Communication Through the Portal</h4>
                                    <p>All messages, comments, and communications sent through the Portal are logged and stored for security, audit, and compliance purposes. Portal communications are secured in transit using TLS encryption but are not end-to-end encrypted. You should not use the Portal to transmit highly sensitive or privileged information without first consulting your {isClientPortal ? 'legal service provider' : 'property manager'}.</p>

                                    <h4 className="text-sm font-bold text-slate-200">5. Payment Submissions and Proof of Payment</h4>
                                    <p>If you submit proof of payment through the Portal, you warrant that it is genuine, accurate, and relates to the {isClientPortal ? 'invoice' : 'obligation'} for which it is submitted. Submitting false or misleading proof of payment constitutes a material breach of these terms and may constitute a criminal offence. Submission of proof of payment does not constitute payment confirmation or acceptance.</p>

                                    <h4 className="text-sm font-bold text-slate-200">6. {!isClientPortal ? 'Maintenance Requests and Service Charges' : 'Document Submissions'}</h4>
                                    {!isClientPortal ? (
                                        <p>You may submit maintenance requests through the Portal with accurate and complete information. Deliberate or repeated submission of false requests may result in restriction of your access. Service charge statements are provided for informational purposes; your property manager is responsible for their accuracy. By submitting a maintenance request, you may be consenting to reasonable access to your unit for repairs.</p>
                                    ) : (
                                        <p>You may submit documents through the Portal at the request of your legal service provider. You warrant that all submitted documents are authentic and complete to the best of your knowledge. Documents must comply with any file size, format, or content restrictions displayed at the point of upload.</p>
                                    )}

                                    <h4 className="text-sm font-bold text-slate-200">7. Intellectual Property Restrictions</h4>
                                    <p>The PracticePro platform, including the Portal, is the exclusive property of PracticePro Technologies Limited and is protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Portal solely for its intended purposes. You must not modify, copy, redistribute, reverse-engineer, or remove proprietary notices from the Portal.</p>

                                    <h4 className="text-sm font-bold text-slate-200">8. Limitation of Liability</h4>
                                    <p>PracticePro does not control, verify, or endorse the content displayed on the Portal. The Portal is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted by applicable law, PracticePro shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Portal. PracticePro&apos;s total aggregate liability shall not exceed the amount of fees paid by your {isClientPortal ? 'law firm' : 'property management firm'} in the twelve months preceding the event, or ₦100,000, whichever is greater.</p>

                                    <h4 className="text-sm font-bold text-slate-200">9. Termination of Portal Access</h4>
                                    <p>Your {isClientPortal ? 'legal service provider' : 'property manager'} may revoke your Portal access at any time. PracticePro reserves the right to suspend or terminate your access if you breach these terms. Upon termination, you must immediately cease all use of the Portal, and your login credentials will be deactivated.</p>

                                    <h4 className="text-sm font-bold text-slate-200">10. Governing Law</h4>
                                    <p>These Portal Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.</p>

                                    <h4 className="text-sm font-bold text-slate-200">11. Contact Information</h4>
                                    <p>PracticePro Technologies Limited, No. 6 Sulaiman Adekanbi Street, Igbo-Efon, Lekki-Epe Expressway, Lagos State, Nigeria. Email: <a href="mailto:practiceprovega@gmail.com" className="text-amber-400 underline">practiceprovega@gmail.com</a></p>

                                    <div className="mt-4 pt-4 border-t border-white/[0.08]">
                                        <p className="text-xs text-slate-500">For full details, see the PracticePro <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline">Terms and Conditions of Service</a>, <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline">Privacy Policy</a>, and <a href="/data-processing-agreement" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline">Data Processing Agreement</a>.</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end gap-3">
                                    <a
                                        href="/portal-terms-of-use"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 text-amber-400 text-sm font-medium hover:text-amber-300 transition-colors flex items-center gap-1"
                                    >
                                        View Full Terms
                                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                                    </a>
                                    <button
                                        onClick={() => { setShowTerms(false); setAgreedToTerms(true); setTermsError(''); }}
                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors"
                                    >
                                        I Agree
                                    </button>
                                    <button
                                        onClick={() => setShowTerms(false)}
                                        className="px-4 py-2 text-slate-400 rounded-lg text-sm font-medium hover:text-white hover:bg-white/[0.06] transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trust badges */}
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6">
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <ShieldCheckIcon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">NDPA 2023</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <LockClosedIcon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">AES-256</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <ShieldCheckIcon className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider">PBKDF2</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupPassword;
