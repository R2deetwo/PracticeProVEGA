import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, InvoiceLineItem, Contact, Matter, BankAccount, InvoiceStatus, ContactType } from '../../types';
import { CurrencyDollarIcon, UserIcon, CalendarIcon, PlusIcon, TrashIcon, SaveIcon, XIcon, BriefcaseIcon, InfoIcon, ClockIcon } from '../../constants';
import { FileText as FileTextIcon, Calculator as CalculatorIcon, CheckCircle as CheckCircleIcon } from 'lucide-react';
import { inputModern } from '../../utils/formStyles';
import { formatNumberWithCommas, parseFormattedNumber, formatNaira } from '../../utils/formatting';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useProduct } from '../../contexts/ProductContext';
import NairaSymbol from '../NairaSymbol';
import { generateInvoiceNumber } from '../../utils/invoiceHelpers';

interface InvoiceFormProps {
  clients: Contact[];
  matters: Matter[];
  bankAccounts: BankAccount[];
  invoiceToEdit?: Invoice;
  onAddInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onClose: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ clients, matters, bankAccounts, invoiceToEdit, onAddInvoice, onUpdateInvoice, onClose }) => {
  const { coreState, isDataLoaded } = useCoreState();
  const { financeState } = useFinanceState();
  const { isProperty, terminology } = useProduct();
    const { openModal, navigateTo, addToast } = useUI();

  const vatRate = coreState.firmDetails.taxSettings?.vatRate || 0.075;
  const vatPercentage = (vatRate * 100).toFixed(1);

  // Pre-fill with dynamic firm-branded invoice number
  const suggestedInvoiceNumber = useMemo(() =>
      generateInvoiceNumber({
          firmName: coreState.firmDetails?.name,
          users: coreState.users || [],
          existingInvoiceCount: financeState.invoices?.length || 0,
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [coreState.firmDetails?.name, coreState.users?.length, financeState.invoices?.length]);

  const [clientId, setClientId] = useState('');
  const [matterId, setMatterId] = useState('');
  const [lineItems, setLineItems] = useState<Partial<InvoiceLineItem>[]>([{ description: '', total: 0, hours: 0, rate: 0 }]);
  const [invoiceNumber, setInvoiceNumber] = useState(suggestedInvoiceNumber);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]);
  // P1 FIX: isSubmitting state to prevent double-submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // SAFE INITIALIZATION OF PAYMENT ACCOUNT
  const safeBankAccounts = bankAccounts || [];
  const defaultAccount = safeBankAccounts.find(acc => acc.isDefault) || safeBankAccounts[0];
  const [paymentAccountId, setPaymentAccountId] = useState<string>(defaultAccount?.id || '');

  const [applyVat, setApplyVat] = useState(true);
  const [applyWht, setApplyWht] = useState(false);
  const whtRate = 0.10;
  const whtPercentage = (whtRate * 100).toFixed(0);

  const isEditing = !!invoiceToEdit;
  const selectedClient = clients.find(c => c.id === clientId);
  const isCorporate = selectedClient?.contactType === ContactType.Company;

  useEffect(() => {
    if (isEditing && invoiceToEdit) {
      setClientId(invoiceToEdit.client.id);
      setMatterId(invoiceToEdit.matter.id);
      setLineItems(invoiceToEdit.lineItems);
      setInvoiceNumber(invoiceToEdit.invoiceNumber);
      setIssueDate(invoiceToEdit.issueDate);
      setDueDate(invoiceToEdit.dueDate);
      setPaymentAccountId(invoiceToEdit.paymentDetails.id);
      setApplyVat(invoiceToEdit.taxAmount !== undefined && invoiceToEdit.taxAmount > 0);
    } else if (clients.length > 0) {
      setClientId(clients[0].id);
    }

    // Fallback: If no payment account selected yet, select first available
    if (!paymentAccountId && safeBankAccounts.length > 0) {
      setPaymentAccountId(safeBankAccounts[0].id);
    }
  }, [isEditing, invoiceToEdit, clients, safeBankAccounts, paymentAccountId]);

  useEffect(() => {
    if (clientId) {
      const clientMatters = matters.filter(m => m.clientId === clientId);
      if (clientMatters.length > 0) {
        const newMatterId = clientMatters[0].id;
        setMatterId(newMatterId);
        
        // Intelligent auto-fill for new invoices
        if (!isEditing && lineItems.length <= 1 && (lineItems[0]?.total === 0 || !lineItems[0]?.description)) {
            const m = clientMatters[0];
            if (m.fixedFeeAmount && m.fixedFeeAmount > 0) {
                setLineItems([{
                    id: `li_${Date.now()}`,
                    description: `Professional Fees: ${m.title}`,
                    total: m.fixedFeeAmount,
                    hours: 0,
                    rate: 0
                }]);
            }
        }
      } else {
        setMatterId('');
      }
    }
  }, [clientId, matters, isEditing, lineItems]);

  useEffect(() => {
      if (matterId && !isEditing && lineItems.length <= 1 && (lineItems[0]?.total === 0 || !lineItems[0]?.description)) {
          const m = matters.find(mat => mat.id === matterId);
          if (m && m.fixedFeeAmount && m.fixedFeeAmount > 0) {
              setLineItems([{
                  id: `li_${Date.now()}`,
                  description: `Professional Fees: ${m.title}`,
                  total: m.fixedFeeAmount,
                  hours: 0,
                  rate: 0
              }]);
          }
      }
  }, [matterId, matters, isEditing, lineItems]);

  const handleLineItemChange = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const updatedItems = [...lineItems];
    const item = { ...updatedItems[index], [field]: value };
    if (field === 'hours' || field === 'rate') {
      item.total = (item.hours || 0) * (item.rate || 0);
    } else if (field === 'total') {
      item.hours = 0;
      item.rate = 0;
    }
    updatedItems[index] = item;
    setLineItems(updatedItems);
  };

  const addLineItem = () => setLineItems([...lineItems, { description: '', total: 0, hours: 0, rate: 0 }]);
  const removeLineItem = (index: number) => lineItems.length > 1 && setLineItems(lineItems.filter((_, i) => i !== index));

  const subTotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const vatAmount = applyVat ? subTotal * vatRate : 0;
  const whtAmount = applyWht ? subTotal * whtRate : 0;
  const invoiceTotal = subTotal + vatAmount;
  const netReceivable = subTotal + vatAmount - whtAmount;
  const selectedMatter = matters.find(m => m.id === matterId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // P1 FIX: Prevent double-submit
    if (isSubmitting) return;
    if (!clientId || !matterId) {
      addToast(`Please select a ${terminology.client.toLowerCase()} and ${terminology.matter.toLowerCase()}.`, { type: 'info' });
      return;
    }

    // P1 FIX: Validate dueDate > issueDate
    if (new Date(dueDate) <= new Date(issueDate)) {
      addToast('Due date must be after the issue date.', { type: 'error' });
      return;
    }

    const client = clients.find(c => c.id === clientId);
    const matter = matters.find(m => m.id === matterId);
    const paymentDetails = safeBankAccounts.find(b => b.id === paymentAccountId);

    if (!paymentDetails) {
      openModal('deleteConfirmation', 'noBankAccount', {
        title: "No Bank Account Selected",
        message: "No bank account is selected for this invoice. Do you want to go to settings to add one now?",
        onConfirm: () => {
          onClose();
          navigateTo('settings', null, { settingsTargetId: 'financial-config' });
        },
        confirmText: "Go to Settings"
      });
      return;
    }

    const finalLineItems = lineItems.map((li, index) => ({
      id: li.id || `li_${Date.now()}_${index}`,
      description: li.description || '',
      hours: li.hours || 0,
      rate: li.rate || 0,
      total: li.total || 0,
    }));

    if (finalLineItems.some(li => !li.description?.trim() || (li.total ?? 0) < 0)) {
      addToast("Please fix invalid line items.", { type: 'info' });
      return;
    }

    if (!matter || !client) {
      addToast(`Required ${terminology.matter.toLowerCase()} or ${terminology.client.toLowerCase()} information is missing.`, { type: 'info' });
      return;
    }

    const invoiceData: Omit<Invoice, 'id'> = {
      firmId: coreState.firmDetails.id,
      invoiceNumber,
      client: { id: client!.id, name: client!.name },
      matter: { id: matter!.id, title: matter!.title },
      lineItems: finalLineItems,
      status: invoiceToEdit?.status || InvoiceStatus.Unpaid,
      issueDate,
      dueDate,
      paymentDetails,
      subTotal,
      taxAmount: vatAmount
    };

    // P1 FIX: Set isSubmitting before async operations, clear on completion
    setIsSubmitting(true);
    try {
      if (isEditing && invoiceToEdit) await onUpdateInvoice({ ...invoiceToEdit, ...invoiceData });
      else await onAddInvoice(invoiceData);
      onClose();
    } catch (err: any) {
      addToast(`Failed to ${isEditing ? 'update' : 'create'} invoice: ${err.message}`, { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

    const commonInputClass = inputModern;
  const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";
  return (
    <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
      <div className="flex flex-col gap-4 -m-2">
        <div className="space-y-2 sm:space-y-3 pb-6">
          {/* Financial Header Section */}
          <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
              <div className="flex items-center gap-4 mb-2 px-1">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm ring-2 ring-emerald-500/10">
                      <CalculatorIcon className="w-4 h-4" />
                  </div>
                  <div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Client & Matter</h3>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2 group">
                      <label className={labelClass}>Client</label>
                      <select value={clientId} onChange={e => setClientId(e.target.value)} className={commonInputClass} required>
                          <option value="" disabled>Select client</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <div className="space-y-2 group">
                      <label className={labelClass}>{isProperty ? 'Property' : 'Matter'}</label>
                      <select value={matterId} onChange={e => setMatterId(e.target.value)} className={commonInputClass} required disabled={!clientId}>
                          <option value="" disabled>Select {isProperty ? 'property' : 'matter'}</option>
                          {matters.filter(m => m.clientId === clientId).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                  </div>
              </div>
          </div>

          {/* Line Items Section */}
          <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-3">
              <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-4">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                          <PlusIcon className="w-4 h-4" />
                      </div>
                      <div>
                          <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Items</h3>
                      </div>
                  </div>

              </div>

              <div className="space-y-3">
                  {lineItems.map((item, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-4 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm transition-all group">
                          <div className="flex-1 min-w-[200px]">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Description</label>
                              <input autoComplete="off" data-lpignore="true"  type="text" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} placeholder="What is this charge for?" className={commonInputClass} />
                          </div>
                          <div className="w-24">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Qty</label>
                              <input autoComplete="off" data-lpignore="true"  type="number" value={item.hours || ''} onChange={e => handleLineItemChange(index, 'hours', parseFloat(e.target.value))} placeholder="0.0" className={commonInputClass} />
                          </div>
                          <div className="w-32">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Rate</label>
                              <input autoComplete="off" data-lpignore="true"  type="text" value={formatNumberWithCommas(item.rate)} onChange={e => handleLineItemChange(index, 'rate', parseFormattedNumber(e.target.value))} placeholder="0.00" className={commonInputClass} />
                          </div>
                          <div className="w-32">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Amount</label>
                              <input autoComplete="off" data-lpignore="true"  type="text" value={formatNumberWithCommas(item.total)} onChange={e => handleLineItemChange(index, 'total', parseFormattedNumber(e.target.value))} className={`${commonInputClass} font-bold text-primary-600`} />
                          </div>
                          <button type="button" onClick={() => removeLineItem(index)} className="p-2 text-rose-400 hover:text-rose-600 transition-colors mt-5">
                              <TrashIcon className="w-4 h-4" />
                          </button>
                      </div>
                  ))}
                  
                  <button type="button" onClick={addLineItem} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-2xs font-black text-slate-400 uppercase tracking-widest hover:border-primary-500 hover:text-primary-600 transition-all flex items-center justify-center gap-2">
                      <PlusIcon className="w-3.5 h-3.5" /> Add Item
                  </button>
              </div>
          </div>

          {/* Totals & Parameters Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 px-1">
              <div className="p-3 sm:p-4 bg-slate-900 dark:bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col justify-between">
                  <div>
                      <p className="text-2xs font-bold text-emerald-500/70 uppercase tracking-widest leading-none mb-4">Summary</p>
                      <div className="space-y-3">
                          <div className="flex justify-between items-center text-zinc-400 gap-4">
                              <span className="text-2xs uppercase tracking-widest whitespace-nowrap">Subtotal</span>
                              <span className="text-sm font-bold text-white tabular-nums"><NairaSymbol />{formatNumberWithCommas(subTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                  <input autoComplete="off" data-lpignore="true"  type="checkbox" id="vat" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-primary-500 focus:ring-primary-500 flex-shrink-0" />
                                  <label htmlFor="vat" className="text-2xs uppercase tracking-widest text-zinc-400 cursor-pointer truncate">VAT ( {vatPercentage}%)</label>
                              </div>
                              <span className="text-sm font-bold text-white tabular-nums flex-shrink-0"><NairaSymbol />{formatNumberWithCommas(vatAmount)}</span>
                          </div>
                          {isCorporate && (
                              <div className="flex justify-between items-center gap-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                      <input autoComplete="off" data-lpignore="true"  type="checkbox" id="wht" checked={applyWht} onChange={e => setApplyWht(e.target.checked)} className="rounded border-zinc-700 bg-zinc-800 text-rose-500 focus:ring-rose-500 flex-shrink-0" />
                                      <label htmlFor="wht" className="text-2xs uppercase tracking-widest text-zinc-400 cursor-pointer truncate">Withholding ( {whtPercentage}%)</label>
                                  </div>
                                  <span className="text-sm font-bold text-rose-400 tabular-nums flex-shrink-0">-(<NairaSymbol />{formatNumberWithCommas(whtAmount)})</span>
                              </div>
                          )}
                      </div>
                  </div>
                  <div className="mt-8 pt-8 border-t border-zinc-800 flex justify-between items-end gap-4 overflow-hidden">
                      <div className="min-w-0">
                          <p className="text-2xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Total</p>
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter leading-none truncate"><NairaSymbol />{formatNumberWithCommas(invoiceTotal)}</h2>
                      </div>
                      {applyWht && (
                          <div className="text-right flex-shrink-0">
                              <p className="text-3xs font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Net</p>
                              <p className="text-base sm:text-lg font-black text-emerald-500 tracking-tight leading-none"><NairaSymbol />{formatNumberWithCommas(netReceivable)}</p>
                          </div>
                      )}
                  </div>
              </div>

              <div className="space-y-3">
                  <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-3">
                      <div>
                          <label className={labelClass}>Dates</label>
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                  <p className="text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Issue Date</p>
                                  <input autoComplete="off" data-lpignore="true"  type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={commonInputClass} required />
                              </div>
                              <div>
                                  <p className="text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Due Date</p>
                                  <input autoComplete="off" data-lpignore="true"  type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={commonInputClass} required />
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-3">
                      <div>
                          <label className={labelClass}>Bank Account</label>
                          {safeBankAccounts.length > 0 ? (
                              <select value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className={commonInputClass} required>
                                  {safeBankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (...{acc.accountNumber.slice(-4)})</option>)}
                              </select>
                          ) : (
                              <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-2xl flex items-center gap-2">
                                  <CheckCircleIcon className="w-4 h-4" />
                                  Add a bank account in settings first
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-50">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
              <XIcon className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSubmit} type="submit" disabled={isSubmitting || (!paymentAccountId && safeBankAccounts.length === 0)} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <SaveIcon className="w-4 h-4" /> {isEditing ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </form>
  );
};
