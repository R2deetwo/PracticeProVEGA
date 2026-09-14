/**
 * TenantPortal Payments tab — submit payment proofs (rent, service charge, utilities).
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { surfaceUploadError } from '../../../utils/convexUpload';
import { CheckIcon, ExclamationTriangleIcon } from '../../../constants';
import { Receipt as ReceiptIcon } from 'lucide-react';
import { UploadIcon, XCircleIcon, formatDate } from './shared';

export const PaymentsTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser, bearerToken } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // ─── MANAGEMENT-ONLY CHECK ──────────────────────────────────────────
  // If the property is marked 'Management Only (No Rent)', the entire
  // Payments tab shows a notice instead of payment options.
  const isManagementOnly = tenantInfo?.primaryRentCollectionMode === 'Management Only (No Rent)';

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── PAYMENT METHOD TOGGLE ──────────────────────────────────────────
  // 'paystack' = Pay with Paystack (inline SDK, card/bank/USSD)
  // 'bank_transfer' = Manual Bank Transfer (upload proof of payment)
  // Default is 'paystack' for the best conversion rate.
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'bank_transfer'>('paystack');
  const [showBankDetails, setShowBankDetails] = useState(false);

  const submitProof = useMutation(api.portals.submitPaymentProof);
  const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

  // ─── Dynamic bank details from organization_payout_details ────────
  // Fetches the active corporate bank account configured by the Founder
  // App. NO hardcoded mock data — if no config exists, shows clean
  // placeholders ([Bank Name] / 0000000000) instead of real bank entities.
  const orgPayoutDetails = useQuery(api.myFunctions.getOrgPayoutDetails, {});
  const BANK_DETAILS = {
    bankName: orgPayoutDetails?.bankName || '[Bank Name]',
    accountName: orgPayoutDetails?.accountName || 'PracticePro Systems Limited',
    accountNumber: orgPayoutDetails?.accountNumber || '0000000000',
    referenceCode: `PP-${(resolvedTenantId || 'GUEST').slice(-6).toUpperCase()}-${String(Date.now()).slice(-4)}`,
  };

  const handlePaystack = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      addToast('Please enter the amount to pay.', { type: 'info' });
      return;
    }
    // Paystack Inline SDK — loads the Paystack popup.
    // In production, the key should come from environment variables.
    const PAYSTACK_PUBLIC_KEY = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    if (PAYSTACK_PUBLIC_KEY.startsWith('pk_test_xxx')) {
      addToast('Paystack is not configured yet. Please use Manual Bank Transfer for now.', { type: 'info', duration: 5000 });
      setPaymentMethod('bank_transfer');
      return;
    }
    // Load Paystack inline script if not already loaded
    if (!(window as any).PaystackPop) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      document.body.appendChild(script);
      await new Promise<void>((resolve) => {
        script.onload = () => resolve();
        script.onerror = () => resolve();
      });
    }
    if (!(window as any).PaystackPop) {
      addToast('Failed to load Paystack. Check your internet connection or try Manual Bank Transfer.', { type: 'error' });
      return;
    }
    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: currentUser?.email || '',
      amount: Math.round(parseFloat(amount) * 100), // Paystack uses kobo
      currency: 'NGN',
      ref: BANK_DETAILS.referenceCode,
      metadata: {
        custom_fields: [
          { display_name: 'Tenant', variable_name: 'tenant', value: currentUser?.name || '' },
          { display_name: 'Property', variable_name: 'property', value: tenantInfo?.primaryPropertyName || '' },
          { display_name: 'Unit', variable_name: 'unit', value: tenantInfo?.primaryUnitName || '' },
          { display_name: 'Period', variable_name: 'period', value: period || '' },
        ],
      },
      callback: (response: any) => {
        // HONESTY FIX: the old callback declared "Payment successful!" on the
        // client's word alone, filed the proof as 'pending_verification' (a
        // status nothing in the backend ever transitions — the tenant stayed on
        // "Verifying" forever), and swallowed proof-submission errors with
        // .catch(() => {}). Now: submit as 'pending_review' (the real admin
        // review queue status), surface submission errors, and word the toast
        // as submitted-for-confirmation rather than "successful".
        addToast(`Payment submitted — reference ${response.reference}. Your property manager will confirm it shortly.`, { type: 'success', duration: 6000 });
        submitProof({
          firmId,
          tenantId: resolvedTenantId,
          tenantName: currentUser?.name || undefined,
          tenantEmail: currentUser?.email || undefined,
          propertyId: tenantInfo?.primaryPropertyId || undefined,
          unitId: tenantInfo?.primaryUnitId || undefined,
          amount: parseFloat(amount),
          period: period.trim() || undefined,
          description: `Paystack payment — Ref: ${response.reference}`,
          storageIds: [],
          paymentMethod: 'paystack',
          paystackReference: response.reference,
          status: 'pending_review',
        }).then(() => {
          addToast('Payment record sent to your property manager for confirmation.', { type: 'info', duration: 5000 });
        }).catch((e: any) => {
          // CRITICAL: this happens AFTER money may have moved. Make sure the
          // tenant knows to keep the reference and tell the PM.
          addToast(`Could not notify your property manager automatically (${e?.message || 'network error'}). Please keep reference ${response.reference} and send it to them in Messages.`, { type: 'warning', duration: 10000 });
        });
        setAmount('');
        setPeriod('');
        setDescription('');
      },
      onClose: () => {
        addToast('Payment cancelled.', { type: 'info' });
      },
    });
    handler.openIframe();
  };

  // Fetch existing payment proofs
  const paymentProofs = useQuery(
    api.portals.getPaymentProofsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter(f => {
      if (!validTypes.includes(f.type)) {
        addToast(`"${f.name}" is not a supported file type. Use images or PDFs.`, { type: 'error' });
        return false;
      }
      if (f.size > maxSize) {
        addToast(`"${f.name}" exceeds 10MB limit.`, { type: 'error' });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (pendingFiles.length === 0) {
      addToast('Please upload at least one payment proof file.', { type: 'info' });
      return;
    }
    // OFFLINE GUARD — payment proof upload requires internet to upload the
    // file to Convex storage. Cannot be queued. Fail fast with a clear msg.
    if (!navigator.onLine) {
      addToast("You're offline. Payment proof upload requires internet — please reconnect and try again.", { type: 'error', duration: 6000 });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload files to Convex storage
      const storageIds: string[] = [];
      for (const file of pendingFiles) {
        try {
          const postUrl = await generateUploadUrl();
          const res = await fetch(postUrl, {
            method: 'POST',
            body: file,
          });
          if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
          const { storageId } = await res.json();
          if (storageId) storageIds.push(storageId);
        } catch (uploadErr: any) {
          surfaceUploadError(addToast, file, uploadErr);
        }
      }

      if (storageIds.length === 0) {
        addToast('Failed to upload files. Please try again.', { type: 'error' });
        setIsSubmitting(false);
        return;
      }

      await submitProof({
        firmId,
        tenantId: resolvedTenantId,
        tenantName: currentUser?.name || undefined,
        tenantEmail: currentUser?.email || undefined,
        propertyId: tenantInfo?.primaryPropertyId || undefined,
        unitId: tenantInfo?.primaryUnitId || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        period: period.trim() || undefined,
        description: description.trim() || undefined,
        storageIds,
        paymentMethod: 'bank_transfer',
        status: 'pending_review',
      });

      addToast('Payment proof submitted successfully. Your property manager will review it and issue an official receipt.', { type: 'success' });
      setDescription('');
      setAmount('');
      setPeriod('');
      setPendingFiles([]);
    } catch (err: any) {
      addToast(err.message || 'Failed to submit payment proof.', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"><CheckIcon className="w-3 h-3" /> Approved</span>;
      case 'verified':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"><CheckIcon className="w-3 h-3" /> Verified</span>;
      case 'rejected':
      case 'declined':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"><XCircleIcon className="w-3 h-3" /> {status === 'declined' ? 'Declined' : 'Rejected'}</span>;
      case 'pending_verification':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"><div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Verifying</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><ExclamationTriangleIcon className="w-3 h-3" /> Pending Review</span>;
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payments</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        Pay your rent and utilities securely. Choose your preferred payment method below.
      </p>

      {/* Payments page — always show payment methods regardless of rentCollectionMode.
          The management-only block has been removed per user request. */}
          {/* ─── Payment Method Selector ─────────────────────────────── */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5 mb-6">
            <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Payment Method</h4>
            {/* Amount + Period inputs — shared between both methods */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Period (Optional)</label>
                <input
                  type="text"
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  placeholder="e.g., January 2026"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Method toggle — Paystack vs Bank Transfer */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setPaymentMethod('paystack')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  paymentMethod === 'paystack'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="2" fill="#00C3F7" opacity="0.15"/>
                    <path d="M5 8h2M5 11h3M5 14h2" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="14" y="9" width="5" height="3" rx="0.5" fill="#0EA5E9"/>
                  </svg>
                  <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Paystack</span>
                </div>
                <p className="text-2xs text-slate-500 dark:text-zinc-400">Card, Bank, USSD</p>
              </button>
              <button
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-slate-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Bank Transfer</span>
                </div>
                <p className="text-2xs text-slate-500 dark:text-zinc-400">Manual + Upload Proof</p>
              </button>
            </div>

            {/* ─── Paystack Method ─────────────────────────────────── */}
            {paymentMethod === 'paystack' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g., Rent payment for January"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handlePaystack}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className="w-full py-3 bg-[#00C3F7] hover:bg-[#00B0E0] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                    <path d="M14 5l-2 2-2-2v6h4V5z M10 13l2 2 2-2v6h-4v-6z"/>
                  </svg>
                  Pay ₦{amount && parseFloat(amount) > 0 ? parseFloat(amount).toLocaleString() : '0'} with Paystack
                </button>
                <p className="text-2xs text-slate-400 dark:text-zinc-500 text-center">
                  Secure payment via Paystack. Supports cards, bank accounts, and USSD.
                </p>
              </div>
            )}

            {/* ─── Bank Transfer Method ────────────────────────────── */}
            {paymentMethod === 'bank_transfer' && (
              <div className="space-y-3">
                {/* Bank Details — toggle to show/hide */}
                <button
                  onClick={() => setShowBankDetails(!showBankDetails)}
                  className="w-full text-left p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">View Company Bank Details</p>
                      <p className="text-2xs text-slate-500 dark:text-zinc-500 mt-0.5">Tap to show account number and reference</p>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showBankDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>
                {showBankDetails && (
                  <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Bank:</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{BANK_DETAILS.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Account Name:</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{BANK_DETAILS.accountName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Account Number:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-zinc-200">{BANK_DETAILS.accountNumber}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(BANK_DETAILS.accountNumber); addToast('Account number copied.', { type: 'success' }); }}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Reference:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-primary-600 dark:text-primary-400">{BANK_DETAILS.referenceCode}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(BANK_DETAILS.referenceCode); addToast('Reference code copied.', { type: 'success' }); }}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <p className="text-2xs text-amber-600 dark:text-amber-400 mt-2 pt-2 border-t border-slate-200 dark:border-zinc-700">
                      Use the reference code as the transfer description so your payment can be matched.
                    </p>
                  </div>
                )}

                {/* Description + Upload form (existing) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g., Rent payment via bank transfer"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                {/* File Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Upload Proof *</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
                  >
                    <UploadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                      Click to upload payment receipt or stub
                    </p>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                      JPG, PNG, PDF · Max 10MB each
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {/* Selected files */}
                  {pendingFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pendingFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-900 rounded px-3 py-1.5">
                          <span className="text-xs text-slate-600 dark:text-zinc-300 truncate">{file.name}</span>
                          <button onClick={() => removeFile(idx)} className="text-rose-500 hover:text-rose-600 text-xs font-bold">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={pendingFiles.length === 0 || isSubmitting}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </div>
            )}
          </div>

      {/* ─── Payment History (Previous Submissions) ─────────────────── */}
      {/* Shows real-time statuses: PENDING, VERIFIED, APPROVED, DECLINED.
          Shared between Paystack and Bank Transfer methods. */}
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3 mt-6">Payment History</h4>
      {paymentProofs === undefined ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-40 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : paymentProofs.length > 0 ? (
        <div className="space-y-2">
          {paymentProofs.map((proof: any) => (
            <div
              key={proof._id}
              className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  proof.status === 'approved'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : proof.status === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-900/20'
                    : 'bg-amber-50 dark:bg-amber-900/20'
                }`}>
                  <ReceiptIcon className={`w-4 h-4 ${
                    proof.status === 'approved'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : proof.status === 'rejected'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">
                    {proof.description || 'Payment proof'}
                    {proof.amount && <span className="ml-2 text-emerald-600 dark:text-emerald-400">₦{proof.amount.toLocaleString()}</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {proof.period && `${proof.period} · `}
                    {formatDate(proof.createdAt)}
                    {proof.storageIds?.length > 0 && <span className="ml-1">· {proof.storageIds.length} file(s)</span>}
                  </p>
                  {proof.adminNote && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 italic">
                      Note: {proof.adminNote}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">{getStatusBadge(proof.status)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ReceiptIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No payment proofs submitted</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Upload a receipt or payment stub above to get an official receipt from your property manager.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Documents Tab ───────────────────────────────────────────────────────────
