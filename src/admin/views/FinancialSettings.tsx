/**
 * FinancialSettings — Founder App centralized financial hub.
 *
 * Single source of truth for PracticePro Systems Limited's corporate bank
 * account. Used by ALL manual bank transfer checkouts across Vega, Atrium,
 * Komplete, and add-on purchases.
 *
 * When the founder updates the bank details here, changes write instantly
 * to the organization_payout_details table. All checkout components
 * across the platform read from this table via getOrgPayoutDetails.
 *
 * GRACE PERIOD: Active checkout sessions in a user's browser may retain
 * their rendered modal state for ~2 minutes (due to React query caching).
 * New checkouts or refreshed views pull the new details immediately.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const INPUT = 'w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500';

export const FinancialSettings: React.FC = () => {
  const { currentUser } = useFounderAuth();
  const { addToast } = useFounderToast();

  const existingDetails = useQuery(api.myFunctions.getOrgPayoutDetails, {});
  const updateDetails = useMutation(api.myFunctions.updateOrgPayoutDetails);

  const [corporateName, setCorporateName] = useState('PracticePro Systems Limited');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing details into the form
  useEffect(() => {
    if (existingDetails) {
      setCorporateName(existingDetails.corporateName || 'PracticePro Systems Limited');
      setBankName(existingDetails.bankName || '');
      setAccountNumber(existingDetails.accountNumber || '');
      setAccountName(existingDetails.accountName || '');
    }
  }, [existingDetails]);

  const handleSave = async () => {
    if (!currentUser?.email) return;

    // Validate NUBAN
    if (!/^\d{10}$/.test(accountNumber)) {
      addToast('Account number must be exactly 10 digits (NUBAN).', { type: 'error' });
      return;
    }
    if (!bankName.trim() || !accountName.trim()) {
      addToast('Please fill in all fields.', { type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await updateDetails({
        corporateName,
        bankName: bankName.trim(),
        accountNumber,
        accountName: accountName.trim(),
        founderEmail: currentUser.email,
      });
      addToast('Bank details updated. All new checkouts will use these details.', { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed to update bank details.', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
      {/* Header */}
      <div style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financial Hub</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Corporate bank account configuration — single source of truth for all checkout payments
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Corporate Identity */}
        <div className={CARD + ' mb-4'}>
          <p className={LABEL + ' mb-3'}>Corporate Identity</p>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Official Corporate Name</label>
            <input
              type="text"
              value={corporateName}
              onChange={e => setCorporateName(e.target.value)}
              className={INPUT}
              placeholder="PracticePro Systems Limited"
            />
            <p className="text-3xs text-slate-400 dark:text-zinc-500 mt-1">
              Locked to the registered corporate entity. Changes here propagate to all checkout flows.
            </p>
          </div>
        </div>

        {/* Bank Account Details */}
        <div className={CARD + ' mb-4'}>
          <p className={LABEL + ' mb-3'}>Bank Account Details</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className={INPUT}
                placeholder="e.g. Providus Bank"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Account Number (NUBAN)</label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={INPUT + ' font-mono'}
                placeholder="0000000000"
                maxLength={10}
              />
              <p className="text-3xs text-slate-400 dark:text-zinc-500 mt-1">
                Must be exactly 10 digits (Nigerian NUBAN format).
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className={INPUT}
                placeholder="PracticePro Systems Limited"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Update Bank Details
            </>
          )}
        </button>

        {/* Info Note */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
            These details are used by ALL manual bank transfer checkouts across Vega, Atrium, Komplete, and add-on purchases. Users see them when they select "Bank Transfer" as a payment method. Changes take effect immediately for new checkout sessions.
          </p>
        </div>

        {/* Current Active Config */}
        {existingDetails && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <p className="text-2xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Active Configuration</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Last updated {new Date(existingDetails.updatedAt).toLocaleString()} by {existingDetails.updatedBy}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
