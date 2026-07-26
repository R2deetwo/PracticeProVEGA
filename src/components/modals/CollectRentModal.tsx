
import React, { useState, useMemo } from 'react';
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Property, Contact, InvoiceStatus, InvoiceLineItem, BankAccount, RentPayment } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { generateReceiptNumber } from '../../utils/invoiceHelpers';
import { 
  CalendarIcon, 
  CheckCircleIcon, 
  XIcon, 
  OfficeBuildingIcon, 
  UserIcon, 
  CalculatorIcon,
  DownloadIcon
} from '../../constants';
import { Receipt } from 'lucide-react';
import NairaSymbol from '../NairaSymbol';
import { formatNaira, formatDateWithOrdinal } from '../../utils/formatting';
import { v4 as uuidv4 } from 'uuid';
import { generateReceiptPdf } from '../../services/reportGenerator';

interface CollectRentModalProps {
  property: Property;
  onClose: () => void;
}

/**
 * CollectRentModal — Accounting Principles
 * 
 * 1. RECEIPTS ARE FULL: The receipt issued to the tenant always reflects the full
 *  amount paid. No deductions are shown on the receipt. This is the standard
 *  practice for proper accounting and tax compliance.
 * 
 * 2. MANAGEMENT FEES ARE INVOICED: The agent/manager's fee is a separate obligation.
 *  When rent is collected, an invoice is auto-generated for the management fee,
 *  tied back to the rent receipt. The landlord owes this to the agent — it is NOT
 *  deducted from source on the receipt.
 * 
 * 3. FLEXIBLE ACCOUNTING: The "Net to Client" view is shown as an informational
 *  breakdown (what the landlord keeps after paying the agent), not as a receipt line.
 *  This accommodates different arrangements:
 *  - Landlord collects in full, pays agent separately
 *  - Agent collects and remits net (internal tracking only)
 * 
 * 4. LEDGER INTEGRITY: The ledger records the full rent amount. The management fee
 *  invoice creates a separate payable entry. Both are tied via a shared transactionRef.
 */
const CollectRentModal: React.FC<CollectRentModalProps> = ({ property, onClose }) => {
  const { coreState } = useCoreState();
  const { matterState } = useMatterState();
  const { financeState } = useFinanceState();
  const { updateItem, handleGenerateInvoice, logActivity } = useDataActions();
  const { addToast, modalContext } = useUI();
  const addLedgerEntry = useMutation(api.sentry.addLedgerEntry);

  // Unit-specific overrides from context (if opened from a specific unit)
  const overrideUnitId = modalContext?.unitId;
  const overrideUnitName = modalContext?.unitName;
  const overrideTenantName = modalContext?.tenantName;
  const overrideRentAmount = modalContext?.rentAmount;

  // Find the owner/contact
  const owner = matterState.contacts.find(c => 
    c.id === property.contactId || (c.properties || []).some(p => p.id === property.id)
  );

  // Get last payment
  const sortedHistory = [...(property.rentPaymentHistory || [])].sort((a, b) => {
    const dateA = a.paidDate ? new Date(a.paidDate).getTime() : 0;
    const dateB = b.paidDate ? new Date(b.paidDate).getTime() : 0;
    return dateB - dateA;
  });
  const lastPayment = sortedHistory[0];

  const initialAmount = overrideRentAmount || property.rentalDetails?.rentAmount || property.value || lastPayment?.amount || 0;
  const [amountValue, setAmountValue] = useState(initialAmount);
  const [displayAmount, setDisplayAmount] = useState(initialAmount.toLocaleString());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAmountChange = (val: string) => {
    // Remove commas and non-numeric chars except decimal
    const numeric = val.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const num = parseFloat(numeric) || 0;
    setAmountValue(num);
    
    // Format with commas for display
    if (numeric === '') {
      setDisplayAmount('');
    } else {
      setDisplayAmount(num.toLocaleString());
    }
  };

  // Fee Calculation — informational only, NOT deducted from receipt
  const feePercentage = property.managementFeePercentage || 0;
  const feeAmount = useMemo(() => (amountValue * feePercentage) / 100, [amountValue, feePercentage]);
  const tenantName = overrideTenantName || property.rentalDetails?.tenantName;
  // Build display label — allow wrapping instead of truncating
  const unitDisplayLabel = overrideUnitName ? `${property.address} - ${overrideUnitName}` : property.address;

  const handleCollect = async () => {
    if (!owner) {
      addToast("Owner not found for this property.", { type: 'error' });
      return;
    }

    setIsProcessing(true);
    try {
      // Generate a shared transaction reference to link receipt, invoice, and ledger
      const transactionRef = `TXN-${Date.now().toString().slice(-8)}`;

      // 1. Update Property Rent History — receipt records FULL amount
      const newPayment = {
        id: uuidv4(),
        dueDate: paymentDate,
        paidDate: paymentDate,
        amount: amountValue, // FULL amount — receipt is always for what was paid
        status: 'paid' as const,
        paymentMethod,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
        periodStart,
        periodEnd,
        transactionRef,
      };

      const updatedHistory = [...(property.rentPaymentHistory || []), newPayment];
      
      // Update standalone property record
      await updateItem('properties', { id: property.id, rentPaymentHistory: updatedHistory, status: 'Occupied' }, 'Property Payment');

      // Legacy support: also update contact if it has the nested property
      if (owner.properties?.some(p => p.id === property.id)) {
        const updatedProperties = owner.properties.map(p => 
          p.id === property.id ? { ...p, rentPaymentHistory: updatedHistory, status: 'Occupied' as const } : p
        );
        await updateItem('contacts', { id: owner.id, properties: updatedProperties }, 'Property Payment');
      }

      // 2. Generate Invoice for Management Fee (if applicable)
      //  This is a SEPARATE invoice the landlord owes the agent — not deducted from the receipt.
      //  It is tied back to the rent transaction via transactionRef.
      if (feeAmount > 0 && feePercentage > 0) {
        const linkedMatter = matterState.matters.find(m => m.clientId === owner.id && m.title.includes(property.address));

        const feeItem: InvoiceLineItem = {
          id: uuidv4(),
          description: `Management Fee — ${unitDisplayLabel} (${new Date(paymentDate).toLocaleString('default', { month: 'long', year: 'numeric' })})`,
          hours: 1,
          rate: feeAmount,
          total: feeAmount
        };

        const defaultAccount: BankAccount = coreState.firmDetails?.bankAccounts?.[0] || {
          id: '1',
          bankName: 'PracticePro Default',
          accountName: coreState.firmDetails?.name || 'Firm',
          accountNumber: '0000000000'
        };

        // Generate the management fee invoice — NOT marked as paid (landlord pays agent separately)
        await handleGenerateInvoice(
          linkedMatter || { id: property.id, title: `Property Management — ${property.address}`, clientId: owner.id } as any,
          [feeItem],
          { issueDate: paymentDate, dueDate: paymentDate }, // Due same day, but not auto-paid
          [], [],
          defaultAccount,
          { applicable: false }
        );
      }

      // 3. Record in Atrium Ledger — full rent received
      const targetUnitId = overrideUnitId || property.id;
      const tenantContact = matterState.contacts.find(c => 
        (c.email && c.email === property.rentalDetails?.tenantEmail) || 
        (c.phone && c.phone === property.rentalDetails?.tenantPhone) ||
        (c.name && c.name === property.rentalDetails?.tenantName)
      );

      if (targetUnitId) {
        await addLedgerEntry({
          firmId: property.firmId || coreState.firmDetails?.id || '',
          propertyId: property.id,
          unitId: targetUnitId,
          tenantId: tenantContact?.id || 'tenant-legacy', 
          amount: amountValue, // Full rent amount
          type: 'rent',
          status: 'cleared',
          description: `Rent collection for ${unitDisplayLabel}`,
          period: `${periodStart} to ${periodEnd}`,
          channel: transactionRef,
        });

        // If there's a management fee, record it as a separate payable entry
        if (feeAmount > 0 && feePercentage > 0) {
          await addLedgerEntry({
            firmId: property.firmId || coreState.firmDetails?.id || '',
            propertyId: property.id,
            unitId: targetUnitId,
            tenantId: owner.id, // Payable TO the firm, FROM the landlord
            amount: feeAmount,
            type: 'management_fee',
            status: 'pending', // Not yet paid — landlord owes this
            description: `Management fee (${feePercentage}%) for ${unitDisplayLabel}`,
            period: `${periodStart} to ${periodEnd}`,
            channel: transactionRef, // Linked to the same transaction
          });
        }
      }

      logActivity(
        `Collected rent for ${unitDisplayLabel}${feeAmount > 0 ? `. Mgmt fee invoice: ${formatNaira(feeAmount)}` : ''}`,
        'Contact',
        property.id,
        unitDisplayLabel
      );

      // 4. Automatically trigger receipt generation — FULL amount, no deductions
      handleDownloadTenantReceipt(true);

      addToast(`Rent receipt issued for ${formatNaira(amountValue)}${feeAmount > 0 ? `. Management fee invoice of ${formatNaira(feeAmount)} generated.` : ''}`, { type: 'success' });
      onClose();
    } catch (error: any) {
      console.error("Failed to collect rent:", error);
      addToast(`Failed to process rent collection: ${error.message || 'Unknown error'}`, { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTenantReceipt = (isSilentOrPayment: boolean | RentPayment = false) => {
    const isSilent = typeof isSilentOrPayment === 'boolean' ? isSilentOrPayment : false;
    const payment = typeof isSilentOrPayment === 'object' ? isSilentOrPayment : null;

    try {

      if (!isSilent) console.log("[CollectRentModal] Generating tenant receipt...");
      
      // Receipt ALWAYS reflects the FULL amount paid — no deductions
      const receiptAmount = payment ? payment.amount : amountValue;
      const receiptDate = payment ? (payment.paidDate || payment.dueDate) : paymentDate;
      const receiptNumber = payment?.receiptNumber || generateReceiptNumber({
        firmName: coreState.firmDetails?.name,
        users: coreState.users || [],
        existingInvoiceCount: financeState.invoices?.length || 0,
      });

      // Find actual tenant contact for the receipt
      const tenantContact = matterState.contacts.find(c => 
        (c.email && c.email === property.rentalDetails?.tenantEmail) || 
        (c.phone && c.phone === property.rentalDetails?.tenantPhone) ||
        (c.name && c.name === property.rentalDetails?.tenantName)
      );

      const mockInvoice: any = {
        id: uuidv4(),
        invoiceNumber: receiptNumber,
        client: tenantContact || { id: 'tenant-legacy', name: tenantName || 'The Tenant' },
        matter: { id: property.id, title: `Rent Payment: ${unitDisplayLabel}` },
        lineItems: [{
          id: uuidv4(),
          description: `Rent for ${unitDisplayLabel}`,
          hours: 1,
          rate: receiptAmount,
          total: receiptAmount // FULL amount — receipt reflects what was actually paid
        }],
        status: InvoiceStatus.Paid,
        issueDate: receiptDate,
        dueDate: receiptDate,
        paidDate: receiptDate,
        paymentDetails: coreState.firmDetails?.bankAccounts?.[0] || { 
          bankName: 'PracticePro Default', 
          accountNumber: '0000000000',
          accountName: coreState.firmDetails?.name || 'Firm'
        },
        subTotal: receiptAmount,
        taxAmount: 0,
        total_amount: receiptAmount
      };

      const pStart = payment ? payment.periodStart : periodStart;
      const pEnd = payment ? payment.periodEnd : periodEnd;
      
      const tenancyPeriod = (pStart && pEnd)
        ? `${formatDateWithOrdinal(pStart)} to ${formatDateWithOrdinal(pEnd)}`
        : property.rentalDetails?.leaseStart && property.rentalDetails?.leaseEnd 
          ? `${formatDateWithOrdinal(property.rentalDetails.leaseStart)} to ${formatDateWithOrdinal(property.rentalDetails.leaseEnd)}`
          : undefined;

      generateReceiptPdf(mockInvoice, coreState.firmDetails, (tenantContact || { name: tenantName || 'The Tenant' }) as any, { tenancyPeriod });
      if (!isSilent) addToast("Tenant receipt generated.", { type: 'success' });
    } catch (error: any) {
      console.error("[CollectRentModal] Receipt generation failed:", error);
      if (!isSilent) addToast("Failed to generate receipt PDF.", { type: 'error' });
    }
  };

  return (
    <div className="p-1 sm:p-4">
      <div className="mb-6 flex items-start gap-4">
        <div className="p-3 bg-green-100 rounded-2xl text-green-600">
          <Receipt className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-800 dark:text-zinc-100 tracking-tight">Issue Rent Receipt</h3>
          <p className="text-sm text-slate-500">Record rent collection for:</p>
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-300 break-words">{unitDisplayLabel}</p>
        </div>
        {lastPayment && (
          <button
            onClick={() => handleDownloadTenantReceipt(lastPayment)}
            className="flex-shrink-0 px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 rounded-lg flex items-center gap-2 border border-slate-200 dark:border-zinc-700"
            title={lastPayment.paidDate ? `Last paid: ${new Date(lastPayment.paidDate).toLocaleDateString('en-GB')} for ${formatNaira(lastPayment.amount)}` : undefined}
          >
            <DownloadIcon className="w-4 h-4" /> Download Last Receipt
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left: Input Form */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-4">
            <div className="space-y-1.5">
              <label className="text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">Rent Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold"><NairaSymbol /></span>
                <input autoComplete="off" data-lpignore="true" 
                  type="text"
                  value={displayAmount}
                  onChange={e => handleAmountChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">Date Paid</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input autoComplete="off" data-lpignore="true" 
                    type="date"
                    value={paymentDate}
                    onChange={e => {
                      setPaymentDate(e.target.value);
                      if (!periodStart) setPeriodStart(e.target.value);
                    }}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs font-black text-slate-400 uppercase tracking-widest ml-1">Method</label>
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Cash</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-black text-primary-600 uppercase tracking-widest ml-1">Period Start</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <input autoComplete="off" data-lpignore="true" 
                    type="date"
                    value={periodStart}
                    onChange={e => setPeriodStart(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-primary-200 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-2xs font-black text-primary-600 uppercase tracking-widest ml-1">Period End</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                  <input autoComplete="off" data-lpignore="true" 
                    type="date"
                    value={periodEnd}
                    onChange={e => setPeriodEnd(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-primary-200 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-2xl border border-primary-100">
            <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
              <OfficeBuildingIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-bold text-primary-600 uppercase tracking-tight">Property / Unit</p>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 break-words">{unitDisplayLabel}</p>
            </div>
          </div>
        </div>

        {/* Right: Receipt Summary & Accounting Breakdown */}
        <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col shadow-xl">
          <div className="flex items-center gap-2 mb-6 opacity-60">
            <CalculatorIcon className="w-4 h-4" />
            <span className="text-2xs font-black uppercase tracking-[0.2em]">Receipt Summary</span>
          </div>

          <div className="space-y-4 flex-grow">
            {/* Receipt amount — always the FULL amount */}
            <div className="p-4 bg-white dark:bg-zinc-900/5 rounded-2xl border border-white/10">
              <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">Amount Received (Full)</p>
              <p className="text-3xl font-black text-white"><NairaSymbol />{formatNaira(amountValue)}</p>
              <p className="text-3xs text-slate-500 mt-1">Receipt reflects full payment — no deductions</p>
            </div>

            {/* Management fee breakdown — informational only */}
            {feePercentage > 0 && feeAmount > 0 && (
              <div className="p-3 bg-primary-500/10 rounded-xl border border-primary-500/20">
                <div className="flex justify-between items-start text-sm mb-2">
                  <div>
                    <span className="text-slate-300 font-semibold">Management Fee</span>
                    <span className="ml-2 text-3xs px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded font-bold uppercase">{feePercentage}%</span>
                  </div>
                  <span className="font-bold text-primary-400"><NairaSymbol />{formatNaira(feeAmount)}</span>
                </div>
                <p className="text-3xs text-slate-500 leading-relaxed">
                  Fee is invoiced separately to the landlord. Receipt remains at full amount for proper accounting.
                </p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10 text-2xs">
                  <span className="text-slate-400">Landlord retains (after fee)</span>
                  <span className="font-bold text-emerald-400"><NairaSymbol />{formatNaira(amountValue - feeAmount)}</span>
                </div>
              </div>
            )}

            {/* Zero-fee properties */}
            {feePercentage <= 0 && (
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-2xs text-emerald-400 font-semibold">No management fee configured</p>
                <p className="text-3xs text-slate-500 mt-0.5">Full amount is remitted to the landlord.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-2xs text-slate-400">
                <UserIcon className="w-3 h-3" />
                <span>Client: <strong className="text-white">{owner?.name || 'Unknown'}</strong></span>
              </div>
              {tenantName && (
                <div className="flex items-center gap-2 text-2xs text-slate-400">
                  <UserIcon className="w-3 h-3 opacity-50" />
                  <span>Tenant: <strong className="text-white/80">{tenantName}</strong></span>
                </div>
              )}
            </div>
            <button
              onClick={handleCollect}
              disabled={isProcessing || amountValue <= 0}
              className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-900/20 group"
            >
              {isProcessing ? 'Processing...' : 'Confirm & Issue Receipt'}
            </button>
            <button
              onClick={() => handleDownloadTenantReceipt()}
              type="button"
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-2xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-white/5"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              Preview Receipt
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <XIcon className="w-4 h-4" /> Cancel
        </button>
      </div>
    </div>
  );
};

export default CollectRentModal;
