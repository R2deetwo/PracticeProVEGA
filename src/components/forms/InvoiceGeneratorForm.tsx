import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyDollarIcon, UserIcon, CalendarIcon, PlusIcon, TrashIcon, SaveIcon, XIcon, BriefcaseIcon, InfoIcon } from '../../constants';
import { FileText as FileTextIcon } from 'lucide-react';
import { inputClassic } from '../../utils/formStyles';
import { Matter, TimeEntry, InvoiceLineItem, Expense, BankAccount } from '../../types';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { computeInvoiceTotals, normalizeTaxRate } from '../../utils/invoiceFinancials';

interface InvoiceGeneratorFormProps {
    matter: Matter;
    unbilledTimeEntries: TimeEntry[];
    unbilledExpenses: Expense[];
    bankAccounts: BankAccount[];
    onGenerateInvoice: (matter: Matter, lineItems: InvoiceLineItem[], invoiceDetails: { invoiceNumber: string, issueDate: string, dueDate: string }, billedTimeEntryIds: string[], billedExpenseIds: string[], paymentDetails: BankAccount, taxDetails?: { applicable: boolean, ratePct: number, subTotal: number, taxAmount: number }) => void;
    onClose: () => void;
}

export const InvoiceGeneratorForm: React.FC<InvoiceGeneratorFormProps> = ({ matter, unbilledTimeEntries, unbilledExpenses, bankAccounts, onGenerateInvoice, onClose }) => {
    const { financeState } = useFinanceState();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();

    const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState<Set<string>>(new Set());
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
    // V2 (V-FIN-6): the number is issued server-side on save (atomic
    // per-firm sequence). The old client generator (count+1) collided on
    // concurrent creation; this field no longer feeds the invoice.
    const [invoiceNumberHint] = useState('');
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]);

    const defaultAccount = bankAccounts?.find(acc => acc.isDefault) || bankAccounts?.[0];
    const [paymentAccountId, setPaymentAccountId] = useState<string>(defaultAccount?.id || '');
    const [applyVat, setApplyVat] = useState(true);
    // UX-04 (double-submit guard): a second click during the awaited
    // generation created duplicate invoices — the button disables itself.
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ─── V2 TAX CONTRACT (V-FIN-15): percentages at the boundary; the firm
    //    setting (legacy fraction storage) is normalized once, here. The
    //    pre-V2 fraction multiplication billed a firm that saved 7.5 at 750%.
    const vatRatePct = normalizeTaxRate(coreState.firmDetails.taxSettings?.vatRate);
    const vatPercentage = vatRatePct.toFixed(1);

    const fixedFeeItem = useMemo(() => {
        if (matter.billingModel === 'Fixed Fee' && matter.fixedFeeAmount) {
            // V3 (V-MATTER-14): the dedup check resolves EITHER convention —
            // the new matterId column or the legacy matter-snapshot id.
            const hasBeenInvoiced = financeState.invoices.some(inv =>
                ((inv as any).matterId === matter.id || inv.matter?.id === matter.id) &&
                (inv.lineItems || []).some(li => li.description.startsWith('Fixed Fee for'))
            );
            if (!hasBeenInvoiced) {
                return {
                    id: `fixed_${matter.id}`,
                    description: `Fixed Fee for: ${matter.title}`,
                    amount: matter.fixedFeeAmount,
                };
            }
        }
        return null;
    }, [matter, financeState.invoices]);

    const [isFixedFeeSelected, setIsFixedFeeSelected] = useState(!!fixedFeeItem);

    // ─── R28 — SCALE / PERCENTAGE FEE ITEM (claims-audit V-3) ──────────────
    // "Fee notes show figures; add the derivation note." A percentage-billed
    // matter (billingPercentage + billingBase) now gets a pre-built line item
    // whose DESCRIPTION carries the full derivation — "₦X = {p}% of {base}
    // assessed at ₦{value}" — so the narrative rides the line item onto the
    // invoice detail, the fee-note PDF and the client portal unchanged.
    // The assessed value comes from the matter's transaction/property value
    // (billingBase 'Rent'/'Value'); without a value the item is not offered
    // (never invent an assessment basis).
    const scaleFeeItem = useMemo(() => {
        if (matter.billingModel === 'Percentage' && matter.billingPercentage && matter.billingPercentage > 0) {
            const assessedValue =
                matter.billingBase === 'Rent' || matter.billingBase === 'Value'
                    ? (matter as any).transactionValue || matter.propertyValue || 0
                    : 0;
            if (assessedValue > 0) {
                const pct = matter.billingPercentage;
                const fee = Math.round(assessedValue * (pct / 100));
                const baseLabel = matter.billingBase === 'Rent' ? 'annual rent' : matter.billingBase === 'Value' ? 'transaction value' : 'assessed value';
                return {
                    id: `scale_${matter.id}`,
                    description: `Scale fee — ${pct}% of ${baseLabel} assessed at ${(assessedValue).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })} (basis: ${matter.billingBase}; matter: ${matter.title})`,
                    amount: fee,
                };
            }
        }
        return null;
    }, [matter]);
    const [isScaleFeeSelected, setIsScaleFeeSelected] = useState(!!scaleFeeItem);

    useEffect(() => {
        setSelectedTimeEntryIds(new Set(unbilledTimeEntries.map(e => e.id)));
        setSelectedExpenseIds(new Set(unbilledExpenses.map(e => e.id)));
        setIsFixedFeeSelected(!!fixedFeeItem);
    }, [unbilledTimeEntries, unbilledExpenses, fixedFeeItem]);

    const handleToggleSelection = (id: string, type: 'time' | 'expense') => {
        const updater = type === 'time' ? setSelectedTimeEntryIds : setSelectedExpenseIds;
        updater(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const selectedTimeItems = unbilledTimeEntries.filter(e => selectedTimeEntryIds.has(e.id));
    const selectedExpenseItems = unbilledExpenses.filter(e => selectedExpenseIds.has(e.id));

    const timeTotal = selectedTimeItems.reduce((sum, entry) => sum + (entry.duration * entry.rate), 0);
    const expenseTotal = selectedExpenseItems.reduce((sum, entry) => sum + entry.amount, 0);
    const fixedFeeTotal = isFixedFeeSelected && fixedFeeItem ? fixedFeeItem.amount : 0;
    const scaleFeeTotal = isScaleFeeSelected && scaleFeeItem ? scaleFeeItem.amount : 0;

    // V2: one kobo-exact computation, the same contract the server applies.
    const genTotals = computeInvoiceTotals(
        [
            ...selectedTimeItems.map(e => ({ total: e.duration * e.rate })),
            ...selectedExpenseItems.map(x => ({ total: x.amount })),
            ...(isFixedFeeSelected && fixedFeeItem ? [{ total: fixedFeeItem.amount }] : []),
            ...(isScaleFeeSelected && scaleFeeItem ? [{ total: scaleFeeItem.amount }] : []),
        ],
        { applicable: applyVat, ratePct: vatRatePct },
    );
    const subTotal = timeTotal + expenseTotal + fixedFeeTotal + scaleFeeTotal;
    const taxAmount = genTotals.taxAmount;
    const totalAmount = genTotals.total_amount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        const timeLineItems: InvoiceLineItem[] = selectedTimeItems.map(entry => ({
            id: `li_te_${entry.id}`,
            description: entry.description,
            hours: entry.duration,
            rate: entry.rate,
            total: entry.duration * entry.rate,
            timeEntryId: entry.id
        }));

        const expenseLineItems: InvoiceLineItem[] = selectedExpenseItems.map(expense => ({
            id: `li_ex_${expense.id}`,
            description: expense.description,
            hours: 0,
            rate: 0,
            total: expense.amount,
            expenseId: expense.id
        }));

        let finalLineItems = [...timeLineItems, ...expenseLineItems];

        if (isFixedFeeSelected && fixedFeeItem) {
            finalLineItems.push({
                id: `li_${fixedFeeItem.id}`,
                description: fixedFeeItem.description,
                hours: 0,
                rate: 0,
                total: fixedFeeItem.amount,
            });
        }

        // R28 (V-3) — the Scale/percentage fee line, derivation in the description.
        if (isScaleFeeSelected && scaleFeeItem) {
            finalLineItems.push({
                id: `li_${scaleFeeItem.id}`,
                description: scaleFeeItem.description,
                hours: 0,
                rate: 0,
                total: scaleFeeItem.amount,
            });
        }

        if (finalLineItems.length === 0) {
            addToast("Please select at least one item to include in the invoice.", { type: 'info' });
            return;
        }

        const selectedAccount = bankAccounts.find(acc => acc.id === paymentAccountId);
        if (!selectedAccount) {
            addToast("Please select a payment account.", { type: 'info' });
            return;
        }
        const paymentDetails = selectedAccount;

        setIsSubmitting(true);
        try {
            // V2 (V-FIN-2): the tax statement travels EXPLICITLY — { applicable,
            // ratePct }. The pre-V2 { subTotal, taxAmount } payload carried no
            // `applicable` flag, so the receiving hook's `tax?.applicable` check
            // silently zeroed VAT on every generated invoice.
            await onGenerateInvoice(matter, finalLineItems, { invoiceNumber: invoiceNumberHint, issueDate, dueDate }, Array.from(selectedTimeEntryIds), Array.from(selectedExpenseIds), paymentDetails, { applicable: applyVat, ratePct: vatRatePct, subTotal, taxAmount });
        } finally {
            setIsSubmitting(false);
        }
    };

    const commonInputClass = inputClassic;

    return (
        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-1">Matter</label>
                <p className="p-2 bg-slate-100 dark:bg-dim-700 rounded-md text-slate-900 dark:text-white">{matter.title}</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-2">Unbilled Items</label>
                <div className="space-y-2 sm:space-y-3 max-h-60 overflow-y-auto pr-2 border rounded-md p-2 border-slate-200 dark:border-dim-700">
                    {fixedFeeItem && (
                        <>
                            <div className="text-xs font-bold uppercase text-slate-500 dark:text-dim-400">Fixed Fee</div>
                            <div className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-dim-700/50">
                                <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={isFixedFeeSelected} onChange={() => setIsFixedFeeSelected(p => !p)} className="h-4 w-4 rounded border-dim-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                                <div className="flex-grow text-sm text-slate-800 dark:text-dim-200">{fixedFeeItem.description}</div>
                                <div className="text-sm font-semibold w-24 text-right text-slate-900 dark:text-dim-100"><NairaSymbol />{formatNaira(fixedFeeItem.amount)}</div>
                            </div>
                        </>
                    )}
                    {scaleFeeItem && (
                        <>
                            <div className="text-xs font-bold uppercase text-slate-500 dark:text-dim-400 pt-2 border-t border-slate-200 dark:border-dim-700">Scale / Percentage Fee</div>
                            <div className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-dim-700/50">
                                <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={isScaleFeeSelected} onChange={() => setIsScaleFeeSelected(p => !p)} className="h-4 w-4 rounded border-dim-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                                <div className="flex-grow text-sm text-slate-800 dark:text-dim-200">{scaleFeeItem.description}</div>
                                <div className="text-sm font-semibold w-24 text-right text-slate-900 dark:text-dim-100"><NairaSymbol />{formatNaira(scaleFeeItem.amount)}</div>
                            </div>
                        </>
                    )}
                    {unbilledTimeEntries.length > 0 && (
                        <div className="text-xs font-bold uppercase text-slate-500 dark:text-dim-400 pt-2 border-t border-slate-200 dark:border-dim-700">Professional Fees</div>
                    )}
                    {unbilledTimeEntries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-dim-700/50">
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={selectedTimeEntryIds.has(entry.id)} onChange={() => handleToggleSelection(entry.id, 'time')} className="h-4 w-4 rounded border-dim-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                            <div className="flex-grow text-sm text-slate-800 dark:text-dim-200">{entry.description}</div>
                            <div className="text-xs text-slate-500 dark:text-dim-400">{entry.duration}h</div>
                            <div className="text-sm font-semibold w-24 text-right text-slate-900 dark:text-dim-100"><NairaSymbol />{formatNaira(entry.duration * entry.rate)}</div>
                        </div>
                    ))}
                    {unbilledExpenses.length > 0 && (
                        <div className="text-xs font-bold uppercase text-slate-500 dark:text-dim-400 pt-2 border-t border-slate-200 dark:border-dim-700">Disbursements</div>
                    )}
                    {unbilledExpenses.map(expense => (
                        <div key={expense.id} className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-dim-700/50">
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={selectedExpenseIds.has(expense.id)} onChange={() => handleToggleSelection(expense.id, 'expense')} className="h-4 w-4 rounded border-dim-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                            <div className="flex-grow text-sm text-slate-800 dark:text-dim-200">{expense.description}</div>
                            <div className="text-sm font-semibold w-24 text-right text-slate-900 dark:text-dim-100"><NairaSymbol />{formatNaira(expense.amount)}</div>
                        </div>
                    ))}
                    {(unbilledTimeEntries.length === 0 && unbilledExpenses.length === 0 && !fixedFeeItem) && <p className="text-sm text-slate-500 dark:text-dim-400 text-center py-4">No unbilled items for this matter.</p>}
                </div>
            </div>

            <div className="flex flex-col items-end space-y-1 pt-2 border-t border-slate-200 dark:border-zinc-700">
                <div className="flex justify-between w-full max-w-xs text-sm">
                    <span className="text-slate-600 dark:text-zinc-400">Subtotal:</span>
                    <span className="font-semibold"><NairaSymbol />{formatNaira(subTotal)}</span>
                </div>
                <div className="flex justify-between w-full max-w-xs items-center">
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 cursor-pointer">
                        <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} className="rounded border-dim-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                        Apply VAT ({vatPercentage}%)
                    </label>
                    <span className="font-semibold"><NairaSymbol />{formatNaira(taxAmount)}</span>
                </div>
                <div className="flex justify-between w-full max-w-xs text-lg font-bold text-primary-600 dark:text-primary-300 dark:text-primary-400 mt-2 border-t border-slate-200 dark:border-zinc-700 pt-2">
                    <span>Total:</span>
                    <span><NairaSymbol />{formatNaira(totalAmount)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 border-t pt-4 border-slate-200 dark:border-dim-700">
                <div>
                    <label htmlFor="paymentAccount" className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-1">Payment Account</label>
                    <select id="paymentAccount" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className={commonInputClass} required>
                        {bankAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.accountName ? `${acc.accountName} (${acc.bankName})` : acc.bankName} - (...{acc.accountNumber.slice(-4)})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="invNumber" className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-1">Invoice Number</label>
                    <input autoComplete="off" data-lpignore="true"  type="text" id="invNumber" value="Assigned automatically on save" readOnly disabled className={`${commonInputClass} opacity-70`} />
                </div>
                <div>
                    <label htmlFor="invIssueDate" className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-1">Issue Date</label>
                    <input autoComplete="off" data-lpignore="true"  type="date" id="invIssueDate" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={commonInputClass} required />
                </div>
                <div>
                    <label htmlFor="invDueDate" className="block text-sm font-medium text-slate-700 dark:text-dim-300 mb-1">Due Date</label>
                    <input autoComplete="off" data-lpignore="true"  type="date" id="invDueDate" value={dueDate} onChange={e => setDueDate(e.target.value)} className={commonInputClass} required />
                </div>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-dim-600 text-slate-800 dark:text-dim-200 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-zinc-700 dark:hover:bg-dim-500 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? 'Generating…' : 'Generate Invoice'}</button>
            </div>
        </form>
    );
};