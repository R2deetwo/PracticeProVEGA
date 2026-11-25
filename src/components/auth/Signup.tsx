import * as React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { inputLarge } from '../../utils/formStyles';
import { useUI } from '../../contexts/UIContext';
import { openLegalDocument } from '../../utils/legalLinks';
import { isNativePlatform } from '../../utils/capacitor';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { EyeIcon, EyeOffIcon, MailIcon, CheckCircleIcon, ZapIcon } from '../../constants';
import { AppMode, SubscriptionPlan } from '../../types';
// R13: the signup form's ToS + Privacy checkboxes are a REAL legal consent —
// record them so the app never re-prompts the same acceptance.
import { markTermsAccepted, TERMS_VERSION } from '../TermsAcceptance';
// TASK 54: click-event-safe product normalization. A React SyntheticEvent
// once leaked into modalContext.selectedProduct (truthy object) — it skipped
// this modal's product_selection step and reached the backend as the string
// "[object Object]", branding the account Vega regardless of what the user
// chose. Every product value now passes through normalizeSignupProduct.
import {
 normalizeSignupProduct,
 isInternalProduct,
 PRODUCT_DISPLAY_NAMES,
} from '../../utils/signupProduct';
import { AuthHeader, AUTH_THEMES, resolveAuthThemeId } from './authTheme';
// 2026-11-24: colleague-invite links (/signup?invite=INV-1234) park the
// join code here; the OnboardingWizard consumes it on its "Join Existing"
// step so a chambers colleague clicking the link lands joined to the
// workspace with zero manual code typing.
import { parseInviteCodeParam, PENDING_INVITE_STORAGE_KEY } from '../../utils/colleagueInvite';

interface SignupProps {
 onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
 const { signup, verifyEmail } = useAuth();
 const { closeModal, addToast, navigateTo, modalContext } = useUI();

 // R27: themed to the page that opened the funnel (owner: "the modals
 // have not been made to match the products"). Hub/native stay 'hub'.
 const authThemeId = resolveAuthThemeId(modalContext);
 const authTheme = AUTH_THEMES[authThemeId];

 const [step, setStep] = React.useState<'product_selection' | 'form' | 'verify' | 'restore'>('product_selection');
 // 2026-11-25 (product-scoped signup round): a product-scoped entry
 // (Get Started on /vega or /atrium) skips the chooser entirely — the
 // form opens with the page's product pre-selected, and NO Back/product-
 // switcher control renders (the modal's close button is the safe way back
 // to the originating product page). Only a user who picked a product on
 // THIS modal's chooser (the hub signup path) gets the conventional ← Back.
 const [viaChooser, setViaChooser] = React.useState(false);
 // FIX: Default to null instead of 'legal' (Vega). This ensures the user MUST
 // select a product before proceeding — the verification email won't falsely
 // say "PracticePro Vega" if they didn't pick Vega.
 const [selectedProduct, setSelectedProduct] = React.useState<'legal' | 'property' | 'unified' | null>(null);
 // TASK 18: Use a REF to store the product. Unlike state, a ref persists
 // across ALL re-renders and is NEVER lost. This is the bulletproof fix
 // for the email branding bug — even if modalContext becomes null, the
 // ref preserves the product that was set when the modal opened.
 const productRef = React.useRef<'legal' | 'property' | 'unified' | null>(null);
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

 // PROFESSIONAL IDENTITY moved to the OnboardingWizard (user feedback
 // 2026-09-16): the "How should you appear in correspondence?" card
 // (professional title + legal form) used to sit here at the name/email
 // stage, but this is the account-creation step, not where the user
 // expects to describe their practice. It now renders in the wizard's
 // Step 1 (right under the firm name) and is parked + applied through the
 // same savePendingIdentity mechanism in OnboardingWizard.
 const submitDataRestoreRequest = useMutation(api.feedback.submitDataRestoreRequest);
 // R13: durable consent record (NDPA §25) — same mutation the in-app
 // TermsAcceptance bar writes, so the server sees the signup consent too.
 const recordTermsAcceptance = useMutation(api.myFunctions.recordTermsAcceptance);

 const [passwordError, setPasswordError] = React.useState<string | null>(null);

 // 2026-11-24 — COLLEAGUE INVITE PARKING: a join link shared by a chambers
 // colleague or co-counsel (/signup?invite=INV-1234) parks the code in
 // sessionStorage (same pattern as pp_migration_email). The account is
 // created through this form as usual; the OnboardingWizard then opens
 // straight onto its "Join Existing" step with the code prefilled — the
 // invited lawyer never types the code. sessionStorage so a stale link
 // never survives a fresh browser session.
 React.useEffect(() => {
  try {
   const params = new URLSearchParams(window.location.search);
   const code = parseInviteCodeParam(params.get('invite'));
   if (code) sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, code);
  } catch { /* storage unavailable — the wizard falls back to manual entry */ }
 }, []);

 // On mount, check if the user came here from the migration flow or via a direct product selection on Landing Page
 React.useEffect(() => {
  // FIX: forceProductSelection takes ABSOLUTE priority — if the user clicked
  // "Start Free Trial" from the root landing page, they MUST see the product
  // selection step, even if pp_migration_email is in localStorage from a
  // previous session. The migration flow should only auto-skip when the user
  // didn't explicitly request product selection.
  if (modalContext?.forceProductSelection) {
   setStep('product_selection');
   return;
  }

  const savedMigrationEmail = localStorage.getItem('pp_migration_email');
  if (savedMigrationEmail) {
   setMigrationOldEmail(savedMigrationEmail);
   setEmail(savedMigrationEmail); // Pre-fill the email field
   setStep('form'); // Skip product selection for migration users
   return;
  }

  // Handle direct product selection from Landing Page
  // TASK 54: normalize BEFORE branching — only a KNOWN product id counts as
  // a selection. Events, objects, and unknown strings fall through to the
  // product_selection step instead of silently skipping it.
  const contextProduct = normalizeSignupProduct(modalContext?.selectedProduct);
  if (contextProduct) {
   setSelectedProduct(contextProduct);
   // TASK 18: Also store in the ref — this is the bulletproof path.
   // Even if modalContext becomes null later (React re-renders,
   // context cleared, etc.), the ref preserves the product.
   productRef.current = contextProduct;
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
   // 1. The modal opens with modalContext.selectedProduct (from /vega or /atrium)
   // 2. The user clicks a product card in the product_selection step
   // The ref persists across ALL re-renders — even if modalContext
   // becomes null or selectedProduct state gets reset, the ref
   // preserves the correct product. This is the BULLETPROOF fix for
   // the "vega email from atrium signup" bug.
   // TASK 54: normalize on the way out too — the backend must ONLY ever
   // receive 'legal' | 'property' | 'unified'. A truthy-but-invalid value
   // (the "[object Object]" incident) is treated as no selection.
   const productToSend = normalizeSignupProduct(productRef.current);

   // FIX: Guard against null/invalid product — don't let signup proceed
   // without a KNOWN product. (2026-11-25: the basic-signup chooser offers
   // Vega and Atrium only; Komplete is a later upgrade/bundle path.)
   if (!productToSend || !isInternalProduct(productToSend)) {
    addToast("Please select a product (Vega or Atrium) to continue.", { type: 'error' });
    setStep('product_selection');
    setIsLoading(false);
    return;
   }

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
   // R17/P0: pass the signup password so verifyEmail can mint a verified
   // BEARER session via the login gateway immediately after the code
   // verifies. Without it the fresh user lands in a code-verified but
   // bearer-less email session — every strict-mode query then throws and
   // the app death-loops (see AuthContext session validity gate).
   const result = await verifyEmail(email, verificationCode, password || undefined);

   if (result.success) {
    // Clean up migration flag regardless of path
    localStorage.removeItem('pp_migration_email');

    // R13 — kill the double terms prompt (both fresh + migration users:
    // BOTH hard-accepted ToS + Privacy checkboxes in this form).
    // Verification success = account active, so the consent recorded at
    // submit becomes binding NOW: localStorage (fast UI gating) + database
    // (durable NDPA §25 record — same mutation the in-app terms bar writes).
    // Without this, the first create action post-onboarding re-prompted the
    // SAME acceptance in the bottom terms bar — the exact duplicate the
    // user reported. roleContext 'admin' mirrors resolveRoleContext() for
    // a fresh firm creator (role=Admin).
    try { markTermsAccepted(); } catch { /* cosmetic gating only */ }
    recordTermsAcceptance({
     termsVersion: TERMS_VERSION,
     userEmail: email.toLowerCase().trim(),
     roleContext: 'admin',
     roleTermsVersion: 'admin-v1',
    }).catch(e => console.warn('[Signup] consent record failed (non-blocking):', e));

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
   addToast('Could not submit. Please email practiceprosystems@gmail.com directly.', { type: 'error' });
  } finally {
   setIsSubmittingRestore(false);
  }
 };

 // inputLarge is now imported at top level
 // R27: themed focus ring — the shared inputLarge's emerald ring belongs
 // to the hub register; vega/atrium modals get their product's ring.
 const commonInputClass = inputLarge
  + ` ${authTheme.inputFocus}`
  + " min-h-[52px] transition-all placeholder:text-slate-500";

 // ─── STEP 3: RESTORE REQUEST (migration users only) ───────────────────────
 if (step === 'restore') {
  return (
   <div className="animate-fade-in space-y-5">
    <div className="text-center">
     <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <ZapIcon className="w-8 h-8 text-primary-600" />
     </div>
     <h3 className="text-xl font-bold text-slate-900 ">Almost there</h3>
     <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
      Your new account is ready. Fill in a few details and we'll restore your previous workspace to this account.
     </p>
    </div>

    {!restoreSubmitted ? (
     <form onSubmit={handleRestoreSubmit} className="space-y-3">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
       <p className="text-xs text-blue-700 ">
        <strong>New account:</strong> {email}
       </p>
       {migrationOldEmail && migrationOldEmail !== email && (
        <p className="text-xs text-blue-600 mt-0.5">
         <strong>Old account:</strong> {migrationOldEmail}
        </p>
       )}
      </div>

      <div>
       <label className="block text-sm font-semibold text-slate-700 mb-1">
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
       <label className="block text-sm font-semibold text-slate-700 mb-1">
        Any other details
        <span className="text-slate-400 font-normal ml-1">(optional — team size, last used date, etc.)</span>
       </label>
       <textarea
        value={restoreNotes}
        onChange={e => setRestoreNotes(e.target.value)}
        rows={3}
        placeholder="Anything that helps us locate your workspace..."
        className="w-full text-slate-900 bg-white border border-slate-300 rounded-sm shadow-sm p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all placeholder:text-slate-500 resize-none text-sm"
       />
      </div>

      <button
       type="submit"
       disabled={isSubmittingRestore}
       className={`w-full py-3 ${authTheme.primaryBtn} text-white rounded-sm font-bold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2`}
      >
       {isSubmittingRestore
        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Sending Request...</>
        : 'Request workspace restoration'
       }
      </button>

      <button
       type="button"
       onClick={() => closeModal()}
       className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
       Skip for now — I'll do this later via Feedback
      </button>

      <p className="text-center text-xs text-slate-400">
       We'll contact you at <strong>{email}</strong> once your workspace is restored.
      </p>
     </form>
    ) : (
     <div className="text-center space-y-4 py-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
       <CheckCircleIcon className="w-9 h-9 text-green-600" />
      </div>
      <div>
       <p className="text-lg font-bold text-slate-900 ">Request received</p>
       <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
        We'll reach out to <strong>{email}</strong> within 24 hours to confirm your workspace has been restored.
       </p>
      </div>
      <button
       onClick={() => closeModal()}
       className={`w-full py-3 ${authTheme.primaryBtn} text-white rounded-sm font-bold transition-all shadow-sm`}
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
    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
     <MailIcon className="w-8 h-8 text-blue-600" />
    </div>
    <h3 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h3>
    <p className="text-slate-600 mb-6 max-w-sm mx-auto text-sm">
     We've sent a 6-digit code to <strong>{email}</strong>.
    </p>

    {/* 15 — Signatures Removed for DEV bypass */}

    <form onSubmit={handleVerify} className="space-y-4">
     <input autoComplete="off" data-lpignore="true" 
      type="text"
      value={verificationCode}
      onChange={e => setVerificationCode(e.target.value)}
      placeholder="Enter 6-digit Code"
      className="text-center text-2xl tracking-widest font-mono w-full bg-white border-2 border-slate-200 rounded-sm p-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
      maxLength={6}
      autoFocus
     />

     <button
      type="submit"
      disabled={isLoading || verificationCode.length < 6}
      className={`w-full py-3 ${authTheme.primaryBtn} text-white rounded-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
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
     className="mt-6 text-sm text-slate-500 hover:text-slate-800 "
    >
     Back to Signup
    </button>
   </div>
  );
 }

 // ─── STEP 0: PRODUCT SELECTION (the basic-signup chooser) ───────────────
 // 2026-11-25 (product-scoped signup round): the chooser offers Vega and
 // Atrium ONLY. Komplete must not appear as a choice during basic signup —
 // it is reached later, as an upgrade or the explicit bundle cross-sell
 // ("Explore Komplete" on /vega's final CTA). /vega and /atrium CTAs
 // never show this step at all (their signup opens pre-selected).
 if (step === 'product_selection') {
  return (
   <div className="flex flex-col h-full animate-fade-in space-y-6">
    <div className="text-center mb-2">
     <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Choose Your Solution</h2>
     <p className="text-sm text-slate-500 mt-2">PracticePro builds dedicated operating systems for the organizations that run modern Africa. Which one fits yours?</p>
    </div>

    <div className="space-y-4">
     {/* Vega — Legal — navy glow (the light-enterprise register) */}
     <button
      onClick={() => { setSelectedProduct('legal'); productRef.current = 'legal'; setViaChooser(true); setStep('form'); }}
      style={{ '--glow-color': 'rgba(30, 58, 138, 0.12)', '--glow-border': 'rgba(30, 58, 138, 0.25)' } as React.CSSProperties}
      className="product-glow-pulse product-glow-pulse-delay-1 w-full p-4 text-left border-2 rounded-md transition-all flex items-start gap-3 hover:border-vega-gilt bg-white border-slate-100 shadow-sm hover:shadow-md group"
     >
      <div className="p-2.5 rounded-md bg-vega-gilt/10 text-vega-gilt group-hover:bg-vega-gilt/20 transition-colors">
       <CheckCircleIcon className="w-6 h-6" />
      </div>
      <div>
       <div className="font-black text-lg text-slate-900 ">Vega <span className="text-2xs uppercase font-bold text-slate-400 ml-1">Legal</span></div>
       <div className="text-xs text-slate-500 mt-1">For law firms and legal teams.</div>
      </div>
     </button>

     {/* Atrium — Property — emerald glow (registered identity #059669; was mis-registered as blue) */}
     <button
      onClick={() => { setSelectedProduct('property'); productRef.current = 'property'; setViaChooser(true); setStep('form'); }}
      style={{ '--glow-color': 'rgba(5, 150, 105, 0.12)', '--glow-border': 'rgba(5, 150, 105, 0.25)' } as React.CSSProperties}
      className="product-glow-pulse product-glow-pulse-delay-2 w-full p-4 text-left border-2 rounded-md transition-all flex items-start gap-3 hover:border-emerald-600 bg-white border-slate-100 shadow-sm hover:shadow-md group"
     >
      <div className="p-2.5 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
       <CheckCircleIcon className="w-6 h-6" />
      </div>
      <div>
       <div className="font-black text-lg text-slate-900 ">Atrium <span className="text-2xs uppercase font-bold text-slate-400 ml-1">Property</span></div>
       <div className="text-xs text-slate-500 mt-1">For property managers and portfolios.</div>
      </div>
     </button>
    </div>

    <div className="mt-auto pt-4 pb-2 text-center text-sm text-slate-600 space-y-2">
     <div>
      Already have an account?{' '}
      <button onClick={onSwitchToLogin} className={`font-bold ${authTheme.linkBtn} hover:underline`}>
       Log in
      </button>
     </div>
     {/* TASK: Portal login option — visible only in native app.
      Lets tenants/clients log in directly from the app. */}
     {isNativePlatform() && (
      <div className="pt-2 border-t border-slate-100 ">
       <p className="text-xs text-slate-400 mb-1.5">Portal User?</p>
       <div className="flex gap-2 justify-center">
        <button
         onClick={() => window.location.href = '/portal/tenant/login'}
         className="active-press touch-target text-xs font-bold text-primary-600 px-3 py-1.5 rounded-sm bg-primary-50 hover:bg-primary-100 transition-colors"
        >
         Resident Portal
        </button>
        <button
         onClick={() => window.location.href = '/portal/client/login'}
         className="active-press touch-target text-xs font-bold text-primary-600 px-3 py-1.5 rounded-sm bg-primary-50 hover:bg-primary-100 transition-colors"
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
 // 2026-11-25 (product-scoped signup round):
 //  - Product-scoped entries (Get Started on /vega or /atrium) render the
 //    themed AuthHeader — "Create your Vega workspace" + the product
 //    tagline — with NO product chip, NO product switcher and NO ← Back
 //    (the modal's own close button safely returns to the originating
 //    product page).
 //  - The TASK 54 "PracticePro Vega | LEGAL | Change" clarity chip is
 //    retired: a user who clicked Get Started on a product page is already
 //    looking at that product's signup; the chip invited mid-funnel
 //    cross-product switching, which basic signup no longer offers.
 //  - The hub path (chooser) keeps a conventional ← Back to the chooser.
 //  - Migration users keep their dedicated copy and banner.
 const HUB_PRODUCT_TAGLINES: Record<'legal' | 'property' | 'unified', string> = {
  legal: 'Legal workflow automation for Nigerian law firms.',
  property: 'The Well-Kept Estate — property and portfolio management, built by PracticePro.',
  unified: 'Vega and Atrium in one unified workspace.',
 };
 return (
  <div className="flex flex-col h-full animate-fade-in">
   <div className="flex-grow space-y-4">
    {viaChooser && !isMigrationUser && (
     <div className="flex items-center gap-2 mb-1">
      <button onClick={() => setStep('product_selection')} className="text-xs font-bold text-slate-400 hover:text-slate-600">← Back</button>
     </div>
    )}
    <div className="text-center mb-4">
    {authThemeId !== 'hub' ? <AuthHeader theme={authTheme} mode="signup" /> : selectedProduct && !isMigrationUser ? (
     <div className="flex flex-col items-center">
      <h3 className="text-xl font-bold tracking-tight text-slate-900">
       Create your {PRODUCT_DISPLAY_NAMES[selectedProduct]} workspace
      </h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-[38ch]">
       {selectedProduct ? HUB_PRODUCT_TAGLINES[selectedProduct] : ''}
      </p>
     </div>
    ) : null}
     {isMigrationUser && (
      <p className="text-sm text-slate-500">
       Create your new account and we'll restore your previous workspace.
      </p>
     )}
    </div>

    {isMigrationUser && (
     <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-sm">
      <ZapIcon className="w-4 h-4 text-blue-600 shrink-0" />
      <p className="text-xs text-blue-700 ">
       Restoring workspace for <strong>{migrationOldEmail}</strong>. Your email has been pre-filled below.
      </p>
     </div>
    )}

    <form onSubmit={handleSubmit} className="space-y-4">
     <div className="grid grid-cols-1 gap-4">
      <input autoComplete="off" data-lpignore="true" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" className={commonInputClass} required />
      <input autoComplete="off" data-lpignore="true" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Work Email" className={commonInputClass} required />
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
      {passwordError && <p className="text-2xs text-red-500 font-bold ml-1">{passwordError}</p>}
     </div>

     <div className="flex flex-col gap-2.5 pt-1">
      <div className="flex items-center gap-3">
       <input autoComplete="off" data-lpignore="true" 
        type="checkbox"
        id="terms"
        checked={acceptedTerms}
        onChange={e => setAcceptedTerms(e.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
       />
       <label htmlFor="terms" className="text-xs text-slate-600 ">
        I agree to the <button type="button" onClick={() => openLegalDocument('terms')} className="text-primary-600 font-bold hover:underline">Terms of Service</button>.
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
       <label htmlFor="privacy" className="text-xs text-slate-600 ">
        I have read and agree to the <button type="button" onClick={() => openLegalDocument('privacy')} className="text-primary-600 font-bold hover:underline">Privacy Policy</button>.
       </label>
      </div>
     </div>

     {/* The trust line — the same vocabulary every product page carries
         (NDPA 2023-aligned safeguards), stated once, quietly, above the
         primary action. */}
     <p className="text-center text-2xs text-slate-500">
      Your data is encrypted with NDPA 2023-aligned safeguards.
     </p>

     <button
      type="submit"
      className={`w-full py-4 ${authTheme.primaryBtn} text-white rounded-sm font-bold text-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-50`}
      disabled={isLoading}
     >
      {isLoading ? 'Processing...' : isMigrationUser ? 'Create Account & Restore →' : 'Create Account'}
     </button>
    </form>

    <p className="text-center text-sm text-slate-600 mt-3">
     Already have an account?{' '}
     <button onClick={onSwitchToLogin} className={`font-bold ${authTheme.linkBtn} hover:underline`}>
      Log in
     </button>
    </p>

    {/* CTA section ends here — Sign-up only, no demo button */}
   </div>
  </div>
 );
};

export default Signup;
