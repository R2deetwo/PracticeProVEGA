import * as React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { inputLarge } from '../../utils/formStyles';
import { useUI } from '../../contexts/UIContext';
import { isNativePlatform } from '../../utils/capacitor';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { EyeIcon, EyeOffIcon, MailIcon, CheckCircleIcon, SparklesIcon, ZapIcon } from '../../constants';
import { AppMode, SubscriptionPlan } from '../../types';

interface SignupProps {
    onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
    const { signup, verifyEmail } = useAuth();
    const { closeModal, addToast, navigateTo, openModal, modalContext } = useUI();

    const [step, setStep] = React.useState<'product_selection' | 'form' | 'verify' | 'restore'>('product_selection');
    const [selectedProduct, setSelectedProduct] = React.useState<'legal' | 'property' | 'unified'>('legal');
    // TASK 18: Use a REF to store the product. Unlike state, a ref persists
    // across ALL re-renders and is NEVER lost. This is the bulletproof fix
    // for the email branding bug — even if modalContext becomes null, the
    // ref preserves the product that was set when the modal opened.
    const productRef = React.useRef<'legal' | 'property' | 'unified'>('legal');
    const [isLoading, setIsLoading] = React.useState(false);

    const [fullName, setFullName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [acceptedTerms, setAcceptedTerms] = React.useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = React.useState(false);
    const [verificationCode, setVerificationCode] = React.useState('');

    // Migration restore state
    const [migrationOldEmail, setMigrationOldEmail] = React.useState('');
    const [restoreFirmName, setRestoreFirmName] = React.useState('');
    const [restoreNotes, setRestoreNotes] = React.useState('');
    const [restoreSubmitted, setRestoreSubmitted] = React.useState(false);
    const [isSubmittingRestore, setIsSubmittingRestore] = React.useState(false);
    const submitDataRestoreRequest = useMutation(api.feedback.submitDataRestoreRequest);

    const [passwordError, setPasswordError] = React.useState<string | null>(null);

    // On mount, check if the user came here from the migration flow or via a direct product selection on Landing Page
    React.useEffect(() => {
        const savedMigrationEmail = localStorage.getItem('pp_migration_email');
        if (savedMigrationEmail) {
            setMigrationOldEmail(savedMigrationEmail);
            setEmail(savedMigrationEmail); // Pre-fill the email field
            setStep('form'); // Skip product selection for migration users
            return;
        }

        // Handle direct product selection from Landing Page
        if (modalContext?.selectedProduct) {
            const mappedProduct = 
                modalContext.selectedProduct === 'vega' ? 'legal' : 
                modalContext.selectedProduct === 'atrium' ? 'property' : 
                modalContext.selectedProduct;
            setSelectedProduct(mappedProduct as any);
            // TASK 18: Also store in the ref — this is the bulletproof path.
            // Even if modalContext becomes null later (React re-renders,
            // context cleared, etc.), the ref preserves the product.
            productRef.current = mappedProduct as 'legal' | 'property' | 'unified';
            setStep('form');
        } else {
            // BUG FIX (Task 14): When NO product is selected, ALWAYS reset to
            // the product_selection step.
            setStep('product_selection');
            // Don't reset productRef here — if the user picks a product from
            // the selection step, the onClick handler will set both state and ref.
        }
    }, [modalContext]);

    const isMigrationUser = !!migrationOldEmail;

    const validatePassword = (pwd: string) => {
        if (!pwd) return "Password is required.";
        if (pwd.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter.";
        if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter.";
        if (!/[0-9]/.test(pwd)) return "Password must contain at least one number.";
        if (!/[^A-Za-z0-9]/.test(pwd)) return "Password must contain at least one special character.";
        return null;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPassword(val);
        setPasswordError(validatePassword(val));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const error = validatePassword(password);
        if (error) {
            setPasswordError(error);
            return;
        }

        if (!acceptedTerms) {
            addToast("Please agree to the Terms of Service.", { type: 'error' });
            return;
        }
        if (!acceptedPrivacy) {
            addToast("Please acknowledge the Privacy Policy.", { type: 'error' });
            return;
        }

        setIsLoading(true);

        try {
            // TASK 18: Use productRef.current as the PRIMARY source of truth.
            // The ref is set when:
            //   1. The modal opens with modalContext.selectedProduct (from /vega or /atrium)
            //   2. The user clicks a product card in the product_selection step
            // The ref persists across ALL re-renders — even if modalContext
            // becomes null or selectedProduct state gets reset, the ref
            // preserves the correct product. This is the BULLETPROOF fix for
            // the "vega email from atrium signup" bug.
            const productToSend = productRef.current;
            console.log('[Signup] Submitting with product:', productToSend, '(ref:', productRef.current, ', state:', selectedProduct, ', modalContext:', modalContext?.selectedProduct, ')');

            const result = await signup(
                '',
                fullName,
                email,
                password,
                AppMode.Multi,
                undefined,
                SubscriptionPlan.Growth, // Default plan, overridden in OnboardingWizard
                productToSend
            );

            if (result.success) {
                setStep('verify');
            } else {
                if (result.code === 'EMAIL_EXISTS') {
                    addToast("Account already exists. Please log in.", { type: 'error' });
                    onSwitchToLogin();
                } else if (result.code === 'PRODUCT_MISMATCH') {
                    addToast(result.message || "Email is registered for another product.", { type: 'error' });
                } else {
                    addToast(result.message || "Signup failed.", { type: 'error' });
                }
            }
        } catch (err) {
            console.error(err);
            addToast("Failed to connect. Please try again.", { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verificationCode) return;

        setIsLoading(true);
        try {
            const result = await verifyEmail(email, verificationCode);

            if (result.success) {
                // Clean up migration flag regardless of path
                localStorage.removeItem('pp_migration_email');

                if (isMigrationUser) {
                    // Show the restore request step instead of closing
                    addToast("Account verified! Let's restore your workspace.", { type: 'success' });
                    setStep('restore');
                } else {
                    addToast("Account verified! Proceeding to setup...", { type: 'success' });
                    closeModal();
                }
            } else {
                addToast(result.message || "Invalid code.", { type: 'error' });
            }
        } catch (err) {
            addToast("Verification failed. Please try again.", { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingRestore(true);
        try {
            await submitDataRestoreRequest({
                email: migrationOldEmail || email,
                previousFirmName: restoreFirmName.trim() || undefined,
                newAccountEmail: email,
                notes: restoreNotes.trim() || undefined,
                source: 'signup_flow',
            });
            setRestoreSubmitted(true);
            addToast('Restoration request sent! We will reach out within 24 hours.', { type: 'success' });
        } catch (err) {
            addToast('Could not submit. Please email practiceprovega@gmail.com directly.', { type: 'error' });
        } finally {
            setIsSubmittingRestore(false);
        }
    };

    const handleDemoLogin = () => {
        closeModal();
        setTimeout(() => openModal('leadCapture'), 100);
    };

    // inputLarge is now imported at top level
    const commonInputClass = inputLarge + " min-h-[52px] rounded-lg transition-all placeholder:text-slate-400";

    // ─── STEP 3: RESTORE REQUEST (migration users only) ───────────────────────
    if (step === 'restore') {
        return (
            <div className="animate-fade-in space-y-5">
                <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ZapIcon className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Almost done! 🎉</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                        Your new account is ready. Fill in a few details and we'll restore your previous workspace to this account.
                    </p>
                </div>

                {!restoreSubmitted ? (
                    <form onSubmit={handleRestoreSubmit} className="space-y-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                <strong>New account:</strong> {email}
                            </p>
                            {migrationOldEmail && migrationOldEmail !== email && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                    <strong>Old account:</strong> {migrationOldEmail}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Previous Firm / Workspace Name
                                <span className="text-slate-400 font-normal ml-1">(helps us find your data faster)</span>
                            </label>
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={restoreFirmName}
                                onChange={e => setRestoreFirmName(e.target.value)}
                                placeholder="e.g. Adenike & Associates"
                                className={commonInputClass}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Any other details
                                <span className="text-slate-400 font-normal ml-1">(optional — team size, last used date, etc.)</span>
                            </label>
                            <textarea
                                value={restoreNotes}
                                onChange={e => setRestoreNotes(e.target.value)}
                                rows={3}
                                placeholder="Anything that helps us locate your workspace..."
                                className="w-full text-slate-900 dark:text-gray-100 bg-white dark:bg-zinc-700/50 border border-slate-300 dark:border-zinc-600 rounded-lg shadow-sm p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder:text-slate-400 resize-none text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmittingRestore}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmittingRestore
                                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Sending Request...</>
                                : '🔁 Request Workspace Restoration'
                            }
                        </button>

                        <button
                            type="button"
                            onClick={() => closeModal()}
                            className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
                        >
                            Skip for now — I'll do this later via Feedback
                        </button>

                        <p className="text-center text-xs text-slate-400">
                            We'll contact you at <strong>{email}</strong> once your workspace is restored.
                        </p>
                    </form>
                ) : (
                    <div className="text-center space-y-4 py-4">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircleIcon className="w-9 h-9 text-green-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">Request Received!</p>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                                We'll reach out to <strong>{email}</strong> within 24 hours to confirm your workspace has been restored.
                            </p>
                        </div>
                        <button
                            onClick={() => closeModal()}
                            className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-md"
                        >
                            Continue to App
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ─── STEP 2: EMAIL VERIFICATION ───────────────────────────────────────────
    if (step === 'verify') {
        return (
            <div className="text-center py-6 animate-fade-in">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MailIcon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h3>
                <p className="text-slate-600 dark:text-zinc-400 mb-6 max-w-sm mx-auto text-sm">
                    We've sent a 6-digit code to <strong>{email}</strong>.
                </p>

                {/* 15 — Signatures Removed for DEV bypass */}

                <form onSubmit={handleVerify} className="space-y-4">
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                        placeholder="Enter 6-digit Code"
                        className="text-center text-2xl tracking-widest font-mono w-full bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-xl p-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        maxLength={6}
                        autoFocus
                    />

                    <button
                        type="submit"
                        disabled={isLoading || verificationCode.length < 6}
                        className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>Verify &amp; {isMigrationUser ? 'Restore Workspace' : 'Login'} <CheckCircleIcon className="w-5 h-5" /></>
                        )}
                    </button>
                </form>

                <p className="mt-4 text-xs text-slate-400">
                    If no code arrives, please check your spam folder.
                </p>

                <button
                    onClick={() => setStep('form')}
                    className="mt-6 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                    Back to Signup
                </button>
            </div>
        );
    }

    // ─── STEP 0: PRODUCT SELECTION ───────────────────────────────────────────
    if (step === 'product_selection') {
        return (
            <div className="flex flex-col h-full animate-fade-in space-y-6">
                <div className="text-center mb-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Choose Your Solution</h2>
                    <p className="text-sm text-slate-500 mt-2">PracticePro builds dedicated operating systems for the organizations that run modern Africa. Which one fits yours?</p>
                </div>

                <div className="space-y-4">
                    {/* Vega — Legal — amber glow */}
                    <button
                        onClick={() => { setSelectedProduct('legal'); productRef.current = 'legal'; setStep('form'); }}
                        style={{ '--glow-color': 'rgba(245, 158, 11, 0.12)', '--glow-border': 'rgba(245, 158, 11, 0.25)' } as React.CSSProperties}
                        className="product-glow-pulse product-glow-pulse-delay-1 w-full p-4 text-left border-2 rounded-2xl transition-all flex items-start gap-3 hover:border-amber-500 bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 shadow-sm hover:shadow-md group"
                    >
                        <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 group-hover:bg-amber-100 transition-colors">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-black text-lg text-slate-900 dark:text-white">Vega <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Legal</span></div>
                            <div className="text-xs text-slate-500 mt-1">For law firms and legal teams.</div>
                        </div>
                    </button>

                    {/* Atrium — Property — blue glow */}
                    <button
                        onClick={() => { setSelectedProduct('property'); productRef.current = 'property'; setStep('form'); }}
                        style={{ '--glow-color': 'rgba(59, 130, 246, 0.12)', '--glow-border': 'rgba(59, 130, 246, 0.25)' } as React.CSSProperties}
                        className="product-glow-pulse product-glow-pulse-delay-2 w-full p-4 text-left border-2 rounded-2xl transition-all flex items-start gap-3 hover:border-blue-500 bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 shadow-sm hover:shadow-md group"
                    >
                        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 group-hover:bg-blue-100 transition-colors">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="font-black text-lg text-slate-900 dark:text-white">Atrium <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Property</span></div>
                            <div className="text-xs text-slate-500 mt-1">For property managers and portfolios.</div>
                        </div>
                    </button>

                    {/* Komplet — Unified — indigo glow */}
                    <button
                        onClick={() => { setSelectedProduct('unified'); productRef.current = 'unified'; setStep('form'); }}
                        style={{ '--glow-color': 'rgba(99, 102, 241, 0.12)', '--glow-border': 'rgba(99, 102, 241, 0.25)' } as React.CSSProperties}
                        className="product-glow-pulse product-glow-pulse-delay-3 w-full p-4 text-left border-2 rounded-2xl transition-all flex items-start gap-3 hover:border-indigo-500 bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 shadow-sm hover:shadow-md group"
                    >
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 group-hover:bg-indigo-100 transition-colors relative">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                        <div className="w-full relative">
                            <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider dark:bg-indigo-900 dark:text-indigo-300">Premium</div>
                            <div className="font-black text-lg text-slate-900 dark:text-white">Komplet <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Unified</span></div>
                            <div className="text-xs text-slate-500 mt-1 pr-10">Unified workspace for both legal (Vega) and property (Atrium).</div>
                        </div>
                    </button>
                </div>

                <div className="mt-auto pt-4 pb-2 text-center text-sm text-slate-600 dark:text-zinc-400 space-y-2">
                    <div>
                        Already have an account?{' '}
                        <button onClick={onSwitchToLogin} className="font-bold text-primary-600 hover:text-primary-700 hover:underline">
                            Log in
                        </button>
                    </div>
                    {/* TASK: Portal login option — visible only in native app.
                        Lets tenants/clients log in directly from the app. */}
                    {isNativePlatform() && (
                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                            <p className="text-xs text-slate-400 dark:text-zinc-500 mb-1.5">Portal User?</p>
                            <div className="flex gap-2 justify-center">
                                <button
                                    onClick={() => window.location.href = '/portal/tenant/login'}
                                    className="active-press touch-target text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                >
                                    Resident Portal
                                </button>
                                <button
                                    onClick={() => window.location.href = '/portal/client/login'}
                                    className="active-press touch-target text-xs font-bold text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                    Client Portal
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── STEP 1: SIGNUP FORM ─────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex-grow space-y-5">
                <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setStep('product_selection')} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">← Back</button>
                </div>
                <div className="text-center mb-6">
                    <p className="text-sm text-slate-500">
                        {isMigrationUser
                            ? 'Create your new account and we\'ll restore your previous workspace.'
                            : 'Your workspace is waiting. Get started in under a minute.'}
                    </p>
                </div>

                {isMigrationUser && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <ZapIcon className="w-4 h-4 text-blue-600 shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            Restoring workspace for <strong>{migrationOldEmail}</strong>. Your email has been pre-filled below.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <input autoComplete="off" data-lpignore="true"  type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className={commonInputClass} required />
                        <input autoComplete="off" data-lpignore="true"  type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Work Email" className={commonInputClass} required />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="relative">
                            <input autoComplete="off" data-lpignore="true" 
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={handlePasswordChange}
                                placeholder="Password"
                                className={`${commonInputClass} pr-12 ${passwordError ? 'border-red-500 focus:ring-red-500' : ''}`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        {passwordError && <p className="text-[10px] text-red-500 font-bold ml-1">{passwordError}</p>}
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        <div className="flex items-center gap-3">
                            <input autoComplete="off" data-lpignore="true" 
                                type="checkbox"
                                id="terms"
                                checked={acceptedTerms}
                                onChange={e => setAcceptedTerms(e.target.checked)}
                                className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="terms" className="text-xs text-slate-600 dark:text-zinc-400">
                                I agree to the <button type="button" onClick={() => navigateTo('termsOfService')} className="text-primary-600 font-bold hover:underline">Terms of Service</button>.
                            </label>
                        </div>
                        <div className="flex items-center gap-3">
                            <input autoComplete="off" data-lpignore="true" 
                                type="checkbox"
                                id="privacy"
                                checked={acceptedPrivacy}
                                onChange={e => setAcceptedPrivacy(e.target.checked)}
                                className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="privacy" className="text-xs text-slate-600 dark:text-zinc-400">
                                I have read and agree to the <button type="button" onClick={() => navigateTo('privacyPolicy')} className="text-primary-600 font-bold hover:underline">Privacy Policy</button>.
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-lg hover:bg-primary-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Processing...' : isMigrationUser ? 'Create Account & Restore →' : 'Create Account'}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-600 dark:text-zinc-400 mt-4">
                    Already have an account?{' '}
                    <button onClick={onSwitchToLogin} className="font-bold text-primary-600 hover:text-primary-700 hover:underline">
                        Log in
                    </button>
                </p>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200 dark:border-zinc-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-zinc-800 text-slate-500">Or</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="w-full flex justify-center items-center gap-2 px-4 py-2.5 border-2 border-dashed border-primary-300 dark:border-primary-800 rounded-lg font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                    <SparklesIcon className="w-5 h-5" />
                    Explore Demo Mode
                </button>
            </div>
        </div>
    );
};

export default Signup;
