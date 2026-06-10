
import * as React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { inputLarge } from '../../utils/formStyles';
import { useUI } from '../../contexts/UIContext';
import { EyeIcon, EyeOffIcon, SparklesIcon, MailIcon, ShieldCheckIcon, WarningIcon, ZapIcon } from '../../constants';
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface LoginProps {
    onSwitchToSignup: () => void;
    forClient?: boolean;
}

// #6 — Password strength helper
const getPasswordStrength = (pw: string): { score: number; label: string; color: string; barColor: string } => {
    if (!pw) return { score: 0, label: '', color: '', barColor: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'text-red-500', barColor: 'bg-red-500' };
    if (score === 3) return { score, label: 'Fair', color: 'text-orange-400', barColor: 'bg-orange-400' };
    if (score === 4) return { score, label: 'Good', color: 'text-yellow-400', barColor: 'bg-yellow-400' };
    return { score, label: 'Strong', color: 'text-green-500', barColor: 'bg-green-500' };
};

const Login: React.FC<LoginProps> = ({ onSwitchToSignup, forClient }) => {
    const { login, resendConfirmation } = useAuth();
    const { closeModal, addToast, setIsSessionLocked, openModal } = useUI();

    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showNewPassword, setShowNewPassword] = React.useState(false); // #2
    const [rememberMe, setRememberMe] = React.useState(false); // Default to false for better security
    const [isLoading, setIsLoading] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
    const [isLocked, setIsLocked] = React.useState(false);
    const [requiresMfa, setRequiresMfa] = React.useState(false);
    const [mfaCode, setMCode] = React.useState('');
    const [debugCode, setDebugCode] = React.useState<string | null>(null);
    const [showResend, setShowResend] = React.useState(false);

    // Password Recovery State
    const [isRecovering, setIsRecovering] = React.useState(false);
    const [recoveryCode, setRecoveryCode] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [sendingReset, setSendingReset] = React.useState(false);
    const resetPasswordFn = useAction(api.myFunctions.resetPassword);
    const requestPasswordResetFn = useMutation(api.myFunctions.requestPasswordReset);
    const diagnoseConnectivity = useMutation(api.myFunctions.diagnoseConnectivity);

    const pwStrength = getPasswordStrength(newPassword); // #6

    const handleMigrationSignup = () => {
        if (email.trim() && email.includes('@')) {
            localStorage.setItem('pp_migration_email', email.toLowerCase().trim());
        }
        onSwitchToSignup();
    };

    // Timeout guard
    React.useEffect(() => {
        let timer: number;
        if (isLoading) {
            timer = window.setTimeout(() => {
                setIsLoading(false);
                setErrorMsg("Login request timed out. Please check your connection.");
            }, 12000);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    // #3 — Parse URL magic-link params and activate recovery mode
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('recoveryCode');
        const encodedEmail = params.get('email');
        if (code && encodedEmail) {
            setEmail(decodeURIComponent(encodedEmail));
            setRecoveryCode(code);
            setIsRecovering(true);
            window.history.replaceState({}, document.title, window.location.pathname);
            addToast("Recovery link verified. Please enter your new password.", { type: 'success' });
        }
    }, [addToast]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (errorMsg?.includes('Network')) setErrorMsg(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);
        setShowResend(false);
        try {
            const result = await login(email, password, requiresMfa ? mfaCode : undefined, rememberMe);
            if (result.success) {
                addToast("Welcome back!", { type: 'success' });
                setIsSessionLocked(false);
                closeModal();
            } else if (result.requiresMfa) {
                setRequiresMfa(true);
                if ((result as any).debugCode) {
                    console.log(`[DEV MODE] MFA Code for ${email}: ${(result as any).debugCode}`);
                    setDebugCode((result as any).debugCode);
                }
                setIsLoading(false);
                addToast("Verification required. Check your email.", { type: 'info' });
            } else {
                setIsLoading(false);
                const msg = result.message || "Invalid email or password.";
                setErrorMsg(msg);
                setIsLocked(!!result.isLocked);
                if (msg.toLowerCase().includes('email not confirmed')) setShowResend(true);
            }
        } catch (err: any) {
            setIsLoading(false);
            setErrorMsg("An unexpected error occurred. Please try again.");
        }
    };

    const handleResendConfirmation = async () => {
        setIsLoading(true);
        const result = await resendConfirmation(email);
        setIsLoading(false);
        if (result.success) {
            addToast("Confirmation email resent! Please check your inbox.", { type: 'success' });
            setShowResend(false);
            setErrorMsg(null);
        } else {
            setErrorMsg(`Failed to resend: ${result.message}`);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !newPassword.trim() || !recoveryCode.trim()) {
            setErrorMsg("Please fill in all recovery fields.");
            return;
        }
        if (newPassword.length < 8) { setErrorMsg("Password must be at least 8 characters."); return; }
        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
            setErrorMsg("Password must contain uppercase, lowercase, number, and special character.");
            return;
        }
        setIsLoading(true);
        setErrorMsg(null);
        try {
            // Send raw password over TLS — server hashes with PBKDF2
            const result = await resetPasswordFn({ email, newPassword: newPassword, overrideCode: recoveryCode });
            setIsLoading(false);
            if (result.success) {
                addToast("Password reset successfully. You can now log in.", { type: "success" });
                setIsRecovering(false);
                setPassword(newPassword);
            } else {
                setErrorMsg(result.message || "Failed to reset password.");
            }
        } catch {
            setIsLoading(false);
            setErrorMsg("Error connecting to server. Please try again.");
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim() || !email.includes('@')) {
            setErrorMsg("Please enter your email address above first.");
            return;
        }
        setSendingReset(true);
        setErrorMsg(null);
        try {
            await requestPasswordResetFn({ email: email.toLowerCase().trim() });
            addToast("Recovery link sent! Check your email inbox.", { type: 'info' });
            setIsRecovering(true);
        } catch {
            setErrorMsg("Failed to send reset email. Please try again.");
        } finally {
            setSendingReset(false);
        }
    };

    const handleDemoLogin = () => {
        closeModal();
        setTimeout(() => openModal('leadCapture'), 100);
    };

    // inputLarge is now imported at top level
    const commonInputClass = inputLarge + " transition-all disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow space-y-6">
                <div className="text-center -mt-2 mb-6">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                        {requiresMfa ? "Two-Factor Authentication" : isRecovering ? "Reset Security Key" : "Welcome Back"}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {requiresMfa ? "Enhancing your account security." : isRecovering ? "Enter your new password below." : forClient ? "Access your secure client portal." : "Please enter your details to sign in."}
                    </p>
                </div>

                {errorMsg && (
                    <div className={`p-4 text-sm rounded-xl border ${isLocked ? 'bg-red-600 border-red-700 text-white font-bold shadow-lg animate-pulse' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border-red-100 dark:border-red-800'} flex items-start gap-3`}>
                        {isLocked ? <WarningIcon className="w-5 h-5 shrink-0" /> : null}
                        <div>{errorMsg}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={handleEmailChange}
                            className={commonInputClass}
                            required
                            autoFocus={forClient}
                            disabled={isLoading}
                            autoComplete="email"
                        />
                    </div>

                    {requiresMfa ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl text-sm">
                                <p className="font-bold text-primary-900 dark:text-primary-100 flex items-center gap-2">
                                    <ShieldCheckIcon className="w-5 h-5 text-primary-500" /> Security Check
                                </p>
                                <p className="text-primary-700 dark:text-primary-300 mt-2">We've sent a 6-digit code to <strong>{email}</strong>.</p>
                            </div>
                            <div>
                                <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
                                <input
                                    type="text"
                                    id="mfaCode"
                                    value={mfaCode}
                                    onChange={e => setMCode(e.target.value.toUpperCase())}
                                    className={`${commonInputClass} text-center tracking-[0.5em] font-mono text-2xl uppercase`}
                                    placeholder="000000"
                                    maxLength={6}
                                    required
                                    autoFocus
                                    disabled={isLoading}
                                />
                                {debugCode && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mt-3 animate-pulse">
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2 text-center font-sans">Localhost Debug Mode</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMCode(debugCode);
                                                // Trigger login with the code
                                                const mockEvent = { preventDefault: () => {} } as any;
                                                handleSubmit(mockEvent);
                                            }}
                                            className="w-full py-2 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition-all shadow-sm flex items-center justify-center gap-2 font-sans"
                                        >
                                            <ZapIcon className="w-4 h-4" /> Inject MFA Code ({debugCode}) & Sign In
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : isRecovering ? (
                        <>
                            <div>
                                <label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recovery Code</label>
                                <input
                                    type="text"
                                    id="recoveryCode"
                                    value={recoveryCode}
                                    onChange={e => setRecoveryCode(e.target.value)}
                                    className={commonInputClass}
                                    placeholder="Enter your recovery code"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            {/* #2 — Show/hide toggle on new password + #6 — Strength meter */}
                            <div>
                                <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        id="new_password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className={`${commonInputClass} pr-10`}
                                        required
                                        disabled={isLoading}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                        disabled={isLoading}
                                    >
                                        {showNewPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>

                                {/* #6 — Strength meter */}
                                {newPassword.length > 0 && (
                                    <div className="mt-2 space-y-1 animate-fade-in">
                                        <div className="flex gap-1 h-1.5">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.barColor : 'bg-slate-200 dark:bg-zinc-600'}`}
                                                />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-semibold ${pwStrength.color}`}>
                                            {pwStrength.label}
                                            {pwStrength.score < 5 && <span className="text-slate-400 dark:text-zinc-500 font-normal"> — add {pwStrength.score < 2 ? 'uppercase, number & special char' : pwStrength.score < 4 ? 'a special character' : 'more length'}</span>}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRecovering(false)}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg font-bold hover:bg-slate-200 transition-all"
                                >Cancel</button>
                                <button
                                    type="button"
                                    onClick={handleResetPassword}
                                    disabled={isLoading || pwStrength.score < 4}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Resetting...' : 'Save Password'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label htmlFor="password_login" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password_login"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className={`${commonInputClass} pr-10`}
                                        required
                                        disabled={isLoading}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        disabled={isLoading}
                                    >
                                        {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* #4 — Remember Me wired up */}
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        disabled={isLoading}
                                        checked={rememberMe}
                                        onChange={e => setRememberMe(e.target.checked)}
                                    />
                                    Remember me
                                    {!rememberMe && <span className="text-xs text-slate-400">(session only)</span>}
                                </label>
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-primary-600 hover:underline font-medium flex items-center gap-1"
                                    disabled={isLoading || sendingReset}
                                >
                                    {sendingReset ? <><div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div> Sending...</> : 'Forgot password?'}
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {isLoading ? 'Verifying...' : 'Sign In'}
                            </button>
                        </>
                    )}

                    {requiresMfa && (
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-4 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-400"
                        >
                            {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            {isLoading ? 'Verifying Code...' : 'Verify & Sign In'}
                        </button>
                    )}

                    {showResend && (
                        <button
                            type="button"
                            onClick={handleResendConfirmation}
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg font-bold hover:bg-yellow-100 transition-all flex items-center justify-center gap-2"
                        >
                            <MailIcon className="w-4 h-4" />
                            Resend Confirmation Email
                        </button>
                    )}
                </form>

                {/* #5 — Sign Up first, Demo below */}
                {!forClient && !isLoading && !requiresMfa && !isRecovering && (
                    <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
                        Don't have an account?{' '}
                        <button onClick={onSwitchToSignup} className="font-bold text-primary-600 hover:text-primary-700 hover:underline">
                            Sign up for free
                        </button>
                    </p>
                )}

                {!isLoading && !requiresMfa && !isRecovering && (
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-zinc-700" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white dark:bg-zinc-800 text-slate-400">or</span>
                        </div>
                    </div>
                )}

                {!isLoading && !requiresMfa && !isRecovering && (
                    <button
                        onClick={handleDemoLogin}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2.5 border-2 border-dashed border-primary-300 dark:border-primary-800 rounded-lg font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Explore Demo Mode
                    </button>
                )}

                {requiresMfa && (
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Need help?{' '}
                        <button type="button" onClick={() => { setRequiresMfa(false); setMCode(''); }} className="font-bold text-primary-600 hover:underline hover:text-primary-700 transition-colors">
                            Use a different account
                        </button>
                    </p>
                )}
            </div>
        </div>
    );
};

export default Login;
