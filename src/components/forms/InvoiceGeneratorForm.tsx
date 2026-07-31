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
import { generateInvoiceNumber } from '../../utils/invoiceHelpers';

interface InvoiceGeneratorFormProps {
    matter: Matter;
    unbilledTimeEntries: TimeEntry[];
    unbilledExpenses: Expense[];
    bankAccounts: BankAccount[];
    onGenerateInvoice: (matter: Matter, lineItems: InvoiceLineItem[], invoiceDetails: { invoiceNumber: string, issueDate: string, dueDate: string }, billedTimeEntryIds: string[], billedExpenseIds: string[], paymentDetails: BankAccount, taxDetails?: { subTotal: number, taxAmount: number }) => void;
    onClose: () => void;
}

export const InvoiceGeneratorForm: React.FC<InvoiceGeneratorFormProps> = ({ matter, unbilledTimeEntries, unbilledExpenses, bankAccounts, onGenerateInvoice, onClose }) => {
    const { financeState } = useFinanceState();
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();

    // Pre-fill with dynamic firm-branded invoice number
    const suggestedInvoiceNumber = useMemo(() =>
        generateInvoiceNumber({
            firmName: coreState.firmDetails?.name,
            users: coreState.users || [],
            existingInvoiceCount: financeState.invoices?.length || 0,
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coreState.firmDetails?.name, coreState.users?.length, financeState.invoices?.length]);

    const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState<Set<string>>(new Set());
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
    const [invoiceNumber, setInvoiceNumber] = useState(suggestedInvoiceNumber);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]);

    const defaultAccount = bankAccounts?.find(acc => acc.isDefault) || bankAccounts?.[0];
    const [paymentAccountId, setPaymentAccountId] = useState<string>(defaultAccount?.id || '');
    const [applyVat, setApplyVat] = useState(true);

    const vatRate = coreState.firmDetails.taxSettings?.vatRate || 0.075; // Default 7.5%
    const vatPercentage = (vatRate * 100).toFixed(1);

    const fixedFeeItem = useMemo(() => {
        if (matter.billingModel === 'Fixed Fee' && matter.fixedFeeAmount) {
            const hasBeenInvoiced = financeState.invoices.some(inv =>
                inv.matter.id === matter.id &&
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

    const subTotal = timeTotal + expenseTotal + fixedFeeTotal;
    const taxAmount = applyVat ? subTotal * vatRate : 0;
    const totalAmount = subTotal + taxAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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

        await onGenerateInvoice(matter, finalLineItems, { invoiceNumber, issueDate, dueDate }, Array.from(selectedTimeEntryIds), Array.from(selectedExpenseIds), paymentDetails, { subTotal, taxAmount });
    };

    const commonInputClass = inputClassic;

    return (
        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Matter</label>
                <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white">{matter.title}</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unbilled Items</label>
                <div className="space-y-2 sm:space-y-3 max-h-60 overflow-y-auto pr-2 border rounded-md p-2 border-gray-200 dark:border-zinc-700 dark:border-gray-700">
                    {fixedFeeItem && (
                        <>
                            <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Fixed Fee</div>
                            <div className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={isFixedFeeSelected} onChange={() => setIsFixedFeeSelected(p => !p)} className="h-4 w-4 rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                                <div className="flex-grow text-sm text-gray-800 dark:text-gray-200">{fixedFeeItem.description}</div>
                                <div className="text-sm font-semibold w-24 text-right text-gray-900 dark:text-gray-100"><NairaSymbol />{formatNaira(fixedFeeItem.amount)}</div>
                            </div>
                        </>
                    )}
                    {unbilledTimeEntries.length > 0 && (
                        <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-zinc-700 dark:border-gray-700">Professional Fees</div>
                    )}
                    {unbilledTimeEntries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={selectedTimeEntryIds.has(entry.id)} onChange={() => handleToggleSelection(entry.id, 'time')} className="h-4 w-4 rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                            <div className="flex-grow text-sm text-gray-800 dark:text-gray-200">{entry.description}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{entry.duration}h</div>
                            <div className="text-sm font-semibold w-24 text-right text-gray-900 dark:text-gray-100"><NairaSymbol />{formatNaira(entry.duration * entry.rate)}</div>
                        </div>
                    ))}
                    {unbilledExpenses.length > 0 && (
                        <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-zinc-700 dark:border-gray-700">Disbursements</div>
                    )}
                    {unbilledExpenses.map(expense => (
                        <div key={expense.id} className="flex items-center gap-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={selectedExpenseIds.has(expense.id)} onChange={() => handleToggleSelection(expense.id, 'expense')} className="h-4 w-4 rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                            <div className="flex-grow text-sm text-gray-800 dark:text-gray-200">{expense.description}</div>
                            <div className="text-sm font-semibold w-24 text-right text-gray-900 dark:text-gray-100"><NairaSymbol />{formatNaira(expense.amount)}</div>
                        </div>
                    ))}
                    {(unbilledTimeEntries.length === 0 && unbilledExpenses.length === 0 && !fixedFeeItem) && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No unbilled items for this matter.</p>}
                </div>
            </div>

            <div className="flex flex-col items-end space-y-1 pt-2 border-t border-gray-200 dark:border-zinc-700">
                <div className="flex justify-between w-full max-w-xs text-sm">
                    <span className="text-gray-600 dark:text-zinc-400">Subtotal:</span>
                    <span className="font-semibold"><NairaSymbol />{formatNaira(subTotal)}</span>
                </div>
                <div className="flex justify-between w-full max-w-xs items-center">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 cursor-pointer">
                        <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} className="rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                        Apply VAT ({vatPercentage}%)
                    </label>
                    <span className="font-semibold"><NairaSymbol />{formatNaira(taxAmount)}</span>
                </div>
                <div className="flex justify-between w-full max-w-xs text-lg font-bold text-primary-600 dark:text-primary-300 dark:text-primary-400 mt-2 border-t border-gray-200 dark:border-zinc-700 pt-2">
                    <span>Total:</span>
                    <span><NairaSymbol />{formatNaira(totalAmount)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 border-t pt-4 border-gray-200 dark:border-zinc-700 dark:border-gray-700">
                <div>
                    <label htmlFor="paymentAccount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Account</label>
                    <select id="paymentAccount" value={paymentAccountId} onChange={e => setPaymentAccountId(e.target.value)} className={commonInputClass} required>
                        {bankAccounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.accountName ? `${acc.accountName} (${acc.bankName})` : acc.bankName} - (...{acc.accountNumber.slice(-4)})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="invNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice Number</label>
                    <input autoComplete="off" data-lpignore="true"  type="text" id="invNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={commonInputClass} required />
                </div>
                <div>
                    <label htmlFor="invIssueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Date</label>
                    <input autoComplete="off" data-lpignore="true"  type="date" id="invIssueDate" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={commonInputClass} required />
                </div>
                <div>
                    <label htmlFor="invDueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                    <input autoComplete="off" data-lpignore="true"  type="date" id="invDueDate" value={dueDate} onChange={e => setDueDate(e.target.value)} className={commonInputClass} required />
                </div>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">Generate Invoice</button>
            </div>
        </form>
    );
};