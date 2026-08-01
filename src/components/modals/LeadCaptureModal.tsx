
import * as React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { SparklesIcon, MailIcon } from '../../constants';
import { openLegalDocument } from '../../utils/legalLinks';

const LeadCaptureModal: React.FC = () => {
  const { loginAsDemoUser } = useAuth();
  const { closeModal, openModal, navigateTo, addToast, modalContext } = useUI();
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<'vega' | 'atrium'>(modalContext?.demoProduct || 'vega');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      addToast("Please provide a valid work email.", { type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      sessionStorage.setItem('practicepro_demo_product', selectedProduct);
      // Log the lead and enter demo
      const result = await loginAsDemoUser(email);
      if (result && result.success === false) {
        // Demo mode is not available in production — guide user to sign up instead
        addToast("Demo mode is not available here. Please create a free account to explore.", { type: 'info', duration: 5000 });
        closeModal();
        // Open the signup modal so the user has a clear next step
        setTimeout(() => openModal('signup'), 500);
        return;
      }
      addToast("Welcome! Launching Demo Mode...", { type: 'success' });
      closeModal();
    } catch (err) {
      console.error("Demo launch failed", err);
      addToast("Something went wrong. Please try creating an account instead.", { type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-1 sm:p-2 animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4 scale-110 shadow-sm">
          <SparklesIcon className="w-8 h-8 text-primary-600 dark:text-primary-300" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Access Interactive Demo</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          Experience the full PracticePro suite. Enter your work email for instant, password-free access.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setSelectedProduct('vega')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${selectedProduct === 'vega' ? 'bg-white dark:bg-zinc-900 text-primary-600 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-200 dark:text-zinc-300'}`}
          >
            Vega (Legal OS)
          </button>
          <button
            type="button"
            onClick={() => setSelectedProduct('atrium')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${selectedProduct === 'atrium' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-200 dark:text-zinc-300'}`}
          >
            Atrium (Property OS)
          </button>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-primary-500 transition-colors">
            <MailIcon className="w-5 h-5 text-slate-400" />
          </div>
          <input autoComplete="off" data-lpignore="true" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work Email Address"
            className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            required
            autoFocus
          />
        </div>

        <div className="bg-slate-100 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <p className="text-2xs text-slate-500 leading-normal">
            <strong>Instant Access:</strong> No credit card or password required. Your data is encrypted in compliance with NDPA 2023 standards.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-gradient-to-r from-primary-600 to-emerald-600 text-white rounded-2xl font-bold text-lg hover:from-primary-500 hover:to-emerald-500 transition-all shadow-lg shadow-primary-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
              <span>Initialising Demo...</span>
            </>
          ) : (
            <>
              <span>Start Exploring Now</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </>
          )}
        </button>
        
        <p className="text-center text-xs text-slate-400">
          By continuing, you agree to our <button type="button" onClick={() => openLegalDocument('privacy')} className="underline hover:text-slate-600 dark:hover:text-zinc-300 dark:text-zinc-400">Privacy Policy</button> and <button type="button" onClick={() => openLegalDocument('terms')} className="underline hover:text-slate-600 dark:hover:text-zinc-300 dark:text-zinc-400">Terms of Service</button>.
        </p>
      </form>
    </div>
  );
};

export default LeadCaptureModal;
