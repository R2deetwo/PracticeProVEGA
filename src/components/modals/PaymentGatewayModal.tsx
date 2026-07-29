
import React, { useState } from 'react';
import { CheckCircleIcon, ClipboardIcon } from '../../constants';
import { Building as BuildingLibraryIcon } from 'lucide-react';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { useCoreState } from '../../contexts/CoreContext';

interface PaymentGatewayModalProps {
  amount: number;
  email: string;
  title: string;
  description?: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({ amount, email, title, description, onSuccess, onClose }) => {
  const [step, setStep] = useState<'instructions' | 'confirming' | 'confirmed'>('instructions');
  const [confirmChecked, setConfirmChecked] = useState(false);
  const { coreState } = useCoreState();

  // Get bank details from firm settings, with sensible defaults
  const bankAccounts = coreState.firmDetails?.bankAccounts;
  const primaryBank = bankAccounts && bankAccounts.length > 0 ? bankAccounts[0] : null;

  const bankName = primaryBank?.bankName || 'Contact firm for details';
  const accountNumber = primaryBank?.accountNumber || '—';
  const accountName = primaryBank?.accountName || coreState.firmDetails?.name || '—';

  const handleConfirmPayment = () => {
    setStep('confirming');
    // Brief processing state for UX feedback
    setTimeout(() => {
      setStep('confirmed');
    }, 800);
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
    <div className="bg-slate-50 dark:bg-zinc-900 p-6 flex flex-col items-center justify-center min-h-[400px]">
      {step === 'instructions' && (
        <div className="w-full max-w-sm space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BuildingLibraryIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Bank Transfer</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-4"><NairaSymbol />{formatNaira(amount)}</p>
          </div>

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
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:bg-zinc-700 disabled:text-slate-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-[1.02] disabled:hover:scale-100"
          >
            I've Completed This Payment
          </button>

          <div className="text-center">
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">Cancel</button>
          </div>

          {/* Honest Disclaimer */}
          <p className="text-2xs text-center text-slate-400 leading-relaxed">
            Transfer to the account above, then confirm. Your plan activates after verification. Online card payments coming soon.
          </p>
        </div>
      )}

      {step === 'confirming' && (
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100 mb-2">Recording Confirmation...</h3>
          <p className="text-slate-500">Your payment will be verified by the firm.</p>
        </div>
      )}

      {step === 'confirmed' && (
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-zinc-100 mb-2">Payment Reported</h3>
          <p className="text-slate-500 mb-6">Your firm will verify the transfer and update the invoice status.</p>
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
