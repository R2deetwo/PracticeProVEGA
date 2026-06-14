/**
 * ClientPortalLogin — Standalone login page for Vega Client Portal
 *
 * External-facing login at /portal/client/login for law firm clients
 * to access their matter milestones, document vault, and billing.
 *
 * Supports magic-link invitations: ?token=ABC auto-fills email and
 * marks the invite as accepted on successful login.
 * Supports password reset: ?recoveryCode=RCV-XXXXXX&email=... auto-fills
 * the recovery code and enables the reset-password flow.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Logo, MailIcon } from '../../constants';

// Inline icon for alert circle
const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
);

// Password strength indicator
const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: '', color: '', width: '0%' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
    if (score === 2) return { label: 'Fair', color: 'bg-orange-500', width: '40%' };
    if (score === 3) return { label: 'Good', color: 'bg-yellow-500', width: '60%' };
    if (score === 4) return { label: 'Strong', color: 'bg-emerald-500', width: '80%' };
    return { label: 'Excellent', color: 'bg-emerald-600', width: '100%' };
};

type ViewMode = 'login' | 'forgot' | 'reset';

const ClientPortalLogin: React.FC = () => {
    const { login } = useAuth();
    const { addToast } = useUI();
    const navigate = useNavigate();

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isRevoked, setIsRevoked] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);

    // Forgot / reset password state
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSent, setForgotSent] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetError, setResetError] = useState('');

    // Mutations
    const requestReset = useMutation(api.myFunctions.requestPortalPasswordReset);
    const resetPasswordAction = useAction(api.myFunctions.resetPassword);
    const ensureToken = useMutation(api.portals.ensurePortalAccessToken);

    // Read URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) setInviteToken(token);
        if (params.get('revoked') === '1') {
            setIsRevoked(true);
        }
        // Recovery code from email link — auto-fill and switch to reset mode
        const rcCode = params.get('recoveryCode');
        const rcEmail = params.get('email');
        if (rcCode && rcEmail) {
            setRecoveryCode(rcCode);
            setForgotEmail(rcEmail);
            setEmail(rcEmail);
            setViewMode('reset');
        }
    }, []);

    // Look up invite by token
    const invite = useQuery(
        api.portals.getInviteByToken,
        inviteToken ? { token: inviteToken } : 'skip'
    );

    // Accept invite mutation
    const acceptInvite = useMutation(api.portals.acceptPortalInviteByToken);

    // Auto-fill email from invite when data arrives
    useEffect(() => {
        if (invite && invite.inviteeEmail && !email) {
            setEmail(invite.inviteeEmail);
        }
    }, [invite]);

    const handleSignIn = async () => {
        if (!email.trim() || !password) {
            setError('Please enter your email and password.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        setIsRevoked(false);

        try {
            const result = await login(email.trim(), password);
            if (result.success) {
                if (inviteToken) {
                    try {
                        await acceptInvite({ token: inviteToken });
                    } catch (e) {
                        console.warn('Invite accept failed:', e);
                    }
                }
                addToast('Welcome to the Client Portal.', { type: 'success' });
                sessionStorage.setItem('practicepro_portal_type', 'client');
                localStorage.setItem('practicepro_portal_type', 'client');
                // Try to get the portal access token for a token-based URL
                try {
                    const token = await ensureToken({ email: email.trim().toLowerCase() });
                    if (token) {
                        navigate(`/portal/client/${token}`, { replace: true });
                    } else {
                        navigate('/portal/client', { replace: true });
                    }
                } catch {
                    navigate('/portal/client', { replace: true });
                }
            } else {
                if (result.isRevoked) {
                    setError('Your portal access has been revoked.');
                    setIsRevoked(true);
                } else if (result.isLocked) {
                    setError('Your account has been locked. Please contact your firm administrator.');
                } else if (result.requiresMfa) {
                    setError('Multi-factor authentication is required. Please sign in through the main app.');
                } else {
                    setError(result.message || 'Invalid email or password.');
                }
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!forgotEmail.trim()) {
            setResetError('Please enter your email address.');
            return;
        }
        setIsSubmitting(true);
        setResetError('');
        try {
            await requestReset({ email: forgotEmail.trim(), portalType: 'client' });
            setForgotSent(true);
        } catch (e) {
            setForgotSent(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async () => {
        if (!recoveryCode.trim()) {
            setResetError('Please enter the recovery code.');
            return;
        }
        if (!newPassword || newPassword.length < 8) {
            setResetError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetError('Passwords do not match.');
            return;
        }
        setIsSubmitting(true);
        setResetError('');
        try {
            const result = await resetPasswordAction({
                email: forgotEmail,
                newPassword: newPassword,
                overrideCode: recoveryCode.trim(),
            });
            if (result.success) {
                addToast('Password reset successfully! You can now sign in with your new password.', { type: 'success' });
                setViewMode('login');
                setPassword('');
                setRecoveryCode('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setResetError(result.message || 'Failed to reset password. Please try again.');
            }
        } catch (e: any) {
            setResetError(e?.message || 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isSubmitting) {
            if (viewMode === 'login') handleSignIn();
            else if (viewMode === 'forgot') handleForgotPassword();
            else if (viewMode === 'reset') handleResetPassword();
        }
    };

    const showInviteBanner = invite && invite.status === 'pending' && invite.expiresAt > Date.now();
    const pwStrength = getPasswordStrength(newPassword);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col overflow-x-hidden overflow-y-auto">
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[400px] rounded-full blur-[120px] bg-primary-500/10 pointer-events-none" />

            {/* Brand header */}
            <div className="relative z-10 flex-shrink-0">
                <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center">
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
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                <div className="relative z-10 w-full max-w-md">
                    <div className="text-center mb-6 sm:mb-8">
                        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
                            {viewMode === 'forgot' ? 'Reset Password' : viewMode === 'reset' ? 'Set New Password' : 'Client Portal'}
                        </h1>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            {viewMode === 'forgot'
                                ? 'Enter your email and we\'ll send you a recovery code to reset your password.'
                                : viewMode === 'reset'
                                ? 'Enter the recovery code from your email and choose a new password.'
                                : 'View matter milestones, upload and access documents, and track case progress.'}
                        </p>
                    </div>

                    {/* Invite banner */}
                    {showInviteBanner && viewMode === 'login' && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                            <div className="flex items-start gap-2">
                                <MailIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">You've been invited!</p>
                                    <p className="text-amber-400/80 text-xs mt-0.5">
                                        {invite.inviteeName
                                            ? `Welcome, ${invite.inviteeName}. Your email has been pre-filled.`
                                            : 'Your email has been pre-filled from the invitation.'}
                                        {invite.expiresAt && (
                                            <span> This invite expires {new Date(invite.expiresAt).toLocaleDateString()}.</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expired invite banner */}
                    {invite && invite.status !== 'pending' && inviteToken && viewMode === 'login' && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                            {invite.status === 'expired' || invite.expiresAt < Date.now()
                                ? 'This invitation has expired. Please request a new one from your firm.'
                                : invite.status === 'revoked'
                                ? 'This invitation has been revoked by the firm.'
                                : invite.status === 'accepted'
                                ? 'This invitation has already been accepted. You can sign in directly.'
                                : null}
                        </div>
                    )}

                    {/* Access revoked banner */}
                    {isRevoked && viewMode === 'login' && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                            <div className="flex items-start gap-2">
                                <AlertCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">Portal Access Revoked</p>
                                    <p className="text-rose-400/80 text-xs mt-0.5">
                                        Your access to the Client Portal has been revoked by the firm administrator. Please contact them to request a new invitation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── LOGIN VIEW ── */}
                    {viewMode === 'login' && (
                        <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 sm:p-8 shadow-2xl">
                            <div className="space-y-4">
                                {error && !isRevoked && (
                                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                        {error}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="your@email.com"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => { setViewMode('forgot'); setForgotEmail(email); setForgotSent(false); setResetError(''); }}
                                            className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter your password"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                    />
                                </div>

                                <button
                                    onClick={handleSignIn}
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        'Sign In to Client Portal'
                                    )}
                                </button>

                                <button
                                    onClick={() => { window.location.href = '/'; }}
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all disabled:opacity-50"
                                >
                                    Back to PracticePro
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── FORGOT PASSWORD VIEW ── */}
                    {viewMode === 'forgot' && (
                        <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 sm:p-8 shadow-2xl">
                            {forgotSent ? (
                                <div className="space-y-4 text-center">
                                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                                        <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Check Your Email</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        If an account exists for <span className="text-white font-medium">{forgotEmail}</span>, you'll receive a recovery code shortly. Check your inbox and spam folder.
                                    </p>
                                    <button
                                        onClick={() => { setViewMode('reset'); setResetError(''); }}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98]"
                                    >
                                        I Have a Recovery Code
                                    </button>
                                    <button
                                        onClick={() => { setViewMode('login'); setForgotSent(false); }}
                                        className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all"
                                    >
                                        Back to Sign In
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {resetError && (
                                        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                            {resetError}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="your@email.com"
                                            disabled={isSubmitting}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleForgotPassword}
                                        disabled={isSubmitting}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Sending…
                                            </>
                                        ) : (
                                            'Send Recovery Code'
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { setViewMode('login'); setResetError(''); }}
                                        className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all"
                                    >
                                        Back to Sign In
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── RESET PASSWORD VIEW ── */}
                    {viewMode === 'reset' && (
                        <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 sm:p-8 shadow-2xl">
                            <div className="space-y-4">
                                {resetError && (
                                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                        {resetError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        value={forgotEmail}
                                        onChange={e => setForgotEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recovery Code</label>
                                    <input
                                        type="text"
                                        value={recoveryCode}
                                        onChange={e => setRecoveryCode(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="RCV-XXXXXX"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm font-mono tracking-widest focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                    />
                                    <p className="text-xs text-slate-500 mt-1.5">Enter the code from the recovery email we sent you.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="At least 8 characters"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                    />
                                    {newPassword && (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                                    <div className={`h-full ${pwStrength.color} rounded-full transition-all duration-300`} style={{ width: pwStrength.width }} />
                                                </div>
                                                <span className={`text-xs font-bold ${pwStrength.color.replace('bg-', 'text-')}`}>{pwStrength.label}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Re-enter your new password"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30 transition-all disabled:opacity-50"
                                    />
                                    {confirmPassword && confirmPassword !== newPassword && (
                                        <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
                                    )}
                                </div>
                                <button
                                    onClick={handleResetPassword}
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-sm hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Resetting…
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                                <button
                                    onClick={() => { setViewMode('forgot'); setResetError(''); }}
                                    className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all"
                                >
                                    Resend Recovery Code
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClientPortalLogin;
