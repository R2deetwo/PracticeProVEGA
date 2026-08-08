
import React, { useState } from 'react';
import { CheckCircleIcon, ClipboardIcon } from '../../constants';
import { Building as BuildingLibraryIcon, CreditCard as CreditCardIcon } from 'lucide-react';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { useCoreState } from '../../contexts/CoreContext';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';

interface PaymentGatewayModalProps {
  amount: number;
  email: string;
  title: string;
  description?: string;
  invoiceId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({ amount, email, title, description, invoiceId, onSuccess, onClose }) => {
  const [step, setStep] = useState<'instructions' | 'confirming' | 'confirmed' | 'card_redirect'>('instructions');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const { coreState } = useCoreState();
  const { currentUser } = useAuth();

  // Check if Paystack (online card payments) is active
  const paystackStatus = useQuery(api.paystack.isPaystackActive, {});
  const isCardPaymentActive = paystackStatus?.active === true;

  // Mutation to initiate Paystack payment
  const initiatePayment = useAction(api.paystack.initiateClientPayment);

  // Get bank details from firm settings, with PracticePro corporate defaults.
  // For plan upgrades/subscriptions, the payment goes to PracticePro Systems Ltd,
  // not the firm's own bank account.
  const bankAccounts = coreState.firmDetails?.bankAccounts;
  const primaryBank = bankAccounts && bankAccounts.length > 0 ? bankAccounts[0] : null;

  // PracticePro corporate bank details (used when firm hasn't configured their own)
  const PRACTICEPRO_BANK = {
    bankName: 'Providus Bank',
    accountNumber: '1203984572',
    accountName: 'PracticePro Systems Ltd',
  };

  const bankName = primaryBank?.bankName || PRACTICEPRO_BANK.bankName;
  const accountNumber = primaryBank?.accountNumber || PRACTICEPRO_BANK.accountNumber;
  const accountName = primaryBank?.accountName || PRACTICEPRO_BANK.accountName;

  const handleConfirmPayment = () => {
    setStep('confirming');
    // Brief processing state for UX feedback
    setTimeout(() => {
      setStep('confirmed');
    }, 800);
  };

  const handlePayWithCard = async () => {
    setCardError(null);
    setIsProcessingCard(true);
    try {
      const result = await initiatePayment({
        invoiceId: invoiceId || `manual-${Date.now()}`,
        amount,
        email,
        userEmail: currentUser?.email,
      });
      // Redirect to Paystack's hosted checkout page
      if (result.authorizationUrl) {
        setStep('card_redirect');
        window.location.href = result.authorizationUrl;
      }
    } catch (err: any) {
      setCardError(err.message || 'Failed to initialize card payment. Please try bank transfer.');
    } finally {
      setIsProcessingCard(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Quick visual feedback via the button is sufficient
    }).catch(() => {
      // Fallback — not critical
    });
  };

  return (
    <div className="bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 p-6 flex flex-col items-center justify-center min-h-[400px]">
      {step === 'instructions' && (
        <div className="w-full max-w-sm space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BuildingLibraryIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Payment</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4"><NairaSymbol />{formatNaira(amount)}</p>
          </div>

          {/* Pay with Card (Paystack) — only shown if active */}
          {isCardPaymentActive && (
            <div className="space-y-3">
              <button
                onClick={handlePayWithCard}
                disabled={isProcessingCard}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {isProcessingCard ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Initializing...
                  </>
                ) : (
                  <>
                    <CreditCardIcon className="w-5 h-5" />
                    Pay with Card
                  </>
                )}
              </button>
              {cardError && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center">{cardError}</p>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-grow border-t border-slate-200 dark:border-zinc-700"></div>
                <span className="text-2xs text-slate-400 uppercase font-bold">or</span>
                <div className="flex-grow border-t border-slate-200 dark:border-zinc-700"></div>
              </div>
            </div>
          )}

          {/* Bank Transfer Details */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transfer to this account</p>

            {/* Bank Name */}
            <div className="flex items-center justify-between group">
              <div>
                <p className="text-2xs font-bold text-slate-400 uppercase">Bank</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{bankName}</p>
              </div>
              <button
                onClick={() => copyToClipboard(bankName, 'Bank name')}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-60"
                title="Copy"
              >
                <ClipboardIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Account Number */}
            <div className="flex items-center justify-between group">
              <div>
                <p className="text-2xs font-bold text-slate-400 uppercase">Account Number</p>
                <p className="text-sm font-mono font-bold text-slate-900 dark:text-white tracking-wider">{accountNumber}</p>
              </div>
              <button
                onClick={() => copyToClipboard(accountNumber, 'Account number')}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-60"
                title="Copy"
              >
                <ClipboardIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Account Name */}
            <div className="flex items-center justify-between group">
              <div>
                <p className="text-2xs font-bold text-slate-400 uppercase">Account Name</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{accountName}</p>
              </div>
              <button
                onClick={() => copyToClipboard(accountName, 'Account name')}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-60"
                title="Copy"
              >
                <ClipboardIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Amount Reference */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-700">
              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase">Amount</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400"><NairaSymbol />{formatNaira(amount)}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(String(amount), 'Amount')}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-60"
                  title="Copy"
                >
                  <ClipboardIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              I have transferred the exact amount to the account above and understand that my payment will be verified manually by the firm.
            </span>
          </label>

          {/* Confirm Button */}
          <button
            onClick={handleConfirmPayment}
            disabled={!confirmChecked}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:text-slate-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-[1.02] disabled:hover:scale-100"
          >
            Report Payment Transferred
          </button>

          <div className="text-center">
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">Cancel</button>
          </div>

          {/* Disclaimer */}
          <p className="text-2xs text-center text-slate-400 leading-relaxed">
            PracticePro will verify your bank transfer and update your organization invoice status within 24 hours.
          </p>
        </div>
      )}

      {step === 'confirming' && (
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100 mb-2">Recording Report...</h3>
          <p className="text-slate-500">PracticePro will verify your bank transfer within 24 hours.</p>
        </div>
      )}

      {step === 'card_redirect' && (
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100 mb-2">Redirecting to Paystack...</h3>
          <p className="text-slate-500">You'll be redirected to complete your card payment securely.</p>
        </div>
      )}

      {step === 'confirmed' && (
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 mb-2">Payment Reported</h3>
          <p className="text-slate-500 mb-6">PracticePro will verify your bank transfer and update your organization invoice status within 24 hours.</p>
          <button
            onClick={handleFinish}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg transition-all"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentGatewayModal;
