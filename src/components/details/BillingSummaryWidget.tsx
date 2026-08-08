
import React from 'react';
import { Matter, TimeEntry, Expense, Invoice, ModalType, View, InvoiceStatus } from '../../types';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { PlusIcon, EditIcon, TrashIcon, BillingIcon, ClockIcon, CalculatorIcon } from '../../constants';
import Tooltip from '../Tooltip';
import { useCoreState } from '../../contexts/CoreContext';
import { useFeatures } from '../../hooks/useFeatures';
import { useUI } from '../../contexts/UIContext';

interface BillingSummaryWidgetProps {
    matter: Matter;
    timeEntries: TimeEntry[];
    expenses: Expense[];
    invoices: Invoice[];
    openModal: (modalType: ModalType, id: string | null, context?: any) => void;
    onDeleteTimeEntry: (entryId: string, entryDescription: string) => void;
    onDeleteExpense: (expenseId: string, expenseDescription: string) => void;
    navigateTo: (view: View, id: string | null, context?: any) => void;
}

// Modified Stat component to handle overflow
const Stat: React.FC<{ label: string; value: React.ReactNode; rawValue?: string }> = ({ label, value, rawValue }) => (
    <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg overflow-hidden border border-slate-100 dark:border-zinc-700 shadow-sm">
        <p className="text-2xs font-bold uppercase text-slate-400 dark:text-zinc-500 truncate tracking-widest">{label}</p>
        <Tooltip text={rawValue || ""}>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 truncate flex items-center gap-1">
                {value}
            </p>
        </Tooltip>
    </div>
);

const BillingSummaryWidget: React.FC<BillingSummaryWidgetProps> = ({ matter, timeEntries, expenses, invoices, openModal, onDeleteTimeEntry, onDeleteExpense, navigateTo }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { openModal: openUIModal, closeModal } = useUI(); // Use openModal to trigger upgrade

    const unbilledTime = timeEntries.filter(te => te.billable && !te.billedInInvoiceId);
    const unbilledExpenses = expenses.filter(ex => ex.isBillable && !ex.billedInInvoiceId);
    const canGenerateInvoice = unbilledTime.length > 0 || unbilledExpenses.length > 0 || (matter.billingModel === 'Fixed Fee' && !invoices.some(inv => inv.matter?.id === matter.id && (inv.lineItems || []).some(li => li?.description?.startsWith('Fixed Fee'))));

    const totalUnbilledValue = unbilledTime.reduce((sum, te) => sum + (te.duration * te.rate), 0);
    const totalUnbilledExpenses = unbilledExpenses.reduce((sum, ex) => sum + ex.amount, 0);

    const matterInvoices = invoices.filter(inv => inv.matter?.id === matter.id);
    const totalBilled = matterInvoices.reduce((sum, inv) => sum + (inv.lineItems || []).reduce((s, li) => s + (li.total || 0), 0), 0);
    const totalPaid = matterInvoices.filter(inv => inv.status === InvoiceStatus.Paid).reduce((sum, inv) => sum + (inv.lineItems || []).reduce((s, li) => s + (li.total || 0), 0), 0);
    const outstanding = totalBilled - totalPaid;

    const handleDeleteTime = (e: React.MouseEvent, entry: TimeEntry) => {
        e.stopPropagation();
        openModal('deleteConfirmation', entry.id, {
            title: 'Delete Time Entry?',
            message: `Are you sure you want to delete the time entry: "${entry.description}"?`,
            onConfirm: () => {
                onDeleteTimeEntry(entry.id, entry.description);
                closeModal();
            }
        });
    };

    const handleDeleteExpenseClick = (e: React.MouseEvent, expense: Expense) => {
        e.stopPropagation();
        openModal('deleteConfirmation', expense.id, {
            title: 'Delete Expense?',
            message: `Are you sure you want to delete the expense: "${expense.description}"?`,
            onConfirm: () => {
                onDeleteExpense(expense.id, expense.description);
                closeModal();
            }
        });
    };

    const handleUpgrade = () => openUIModal('upgradePlan', null, { featureName: 'Advanced Billing & Analytics' });

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Unbilled" value={<><NairaSymbol />{formatNaira(totalUnbilledValue + totalUnbilledExpenses)}</>} rawValue={formatNaira(totalUnbilledValue + totalUnbilledExpenses)} />
                <Stat label="Billed" value={<><NairaSymbol />{formatNaira(totalBilled)}</>} rawValue={formatNaira(totalBilled)} />
                <Stat label="Paid" value={<><NairaSymbol />{formatNaira(totalPaid)}</>} rawValue={formatNaira(totalPaid)} />
                <Stat label="Outstanding" value={<><NairaSymbol />{formatNaira(outstanding)}</>} rawValue={formatNaira(outstanding)} />
            </div>

            {/* Quick Actions Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    onClick={() => openModal('newTimeEntry', matter.id)}
                    className="flex-1 px-4 py-3 bg-primary-600 text-white border border-transparent rounded-lg font-bold hover:bg-primary-700 shadow-md transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                    <PlusIcon className="w-5 h-5 text-teal-100" /> Log Time
                </button>
                <button
                    onClick={() => openModal('newExpense', matter.id)}
                    className="flex-1 px-4 py-3 bg-primary-600 text-white border border-transparent rounded-lg font-bold hover:bg-primary-700 shadow-md transition-all flex items-center justify-center gap-2 transform active:scale-95"
                >
                    <PlusIcon className="w-5 h-5 text-teal-100" /> Log Expense
                </button>
                <div className="flex-1">
                    <Tooltip text={!canGenerateInvoice ? "No unbilled items to generate an invoice for." : "Generate a new invoice"}>
                        <button
                            onClick={() => openModal('generateInvoice', matter.id)}
                            className="w-full px-4 py-3 bg-slate-800 dark:bg-zinc-800 text-white dark:text-white rounded-lg font-bold hover:opacity-90 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:text-slate-500 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2"
                            disabled={!canGenerateInvoice}
                        >
                            <span className="text-lg leading-none">+</span> Generate Invoice
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Time Entries Column */}
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Time Entries
                            <span className="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full">{timeEntries.length}</span>
                        </h4>
                    </div>
                    <div className="flex-grow bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden flex flex-col shadow-sm min-h-[300px]">
                        {timeEntries.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {timeEntries.map(entry => (
                                    <div key={entry.id} className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-700/30 border border-slate-100 dark:border-zinc-700/50 group hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{entry.description}</p>
                                            <p className="text-sm font-bold whitespace-nowrap ml-2"><NairaSymbol />{formatNaira(entry.duration * entry.rate)}</p>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(entry.date).toLocaleDateString('en-GB')} • {entry.duration}h @ <NairaSymbol />{formatNaira(entry.rate)}/hr</p>
                                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                <Tooltip text="Edit"><button onClick={() => openModal('editTimeEntry', entry.id)} className="p-1.5 rounded bg-white dark:bg-zinc-600 hover:bg-primary-50 dark:hover:bg-primary-900/50 text-slate-400 hover:text-primary-600 transition-colors"><EditIcon className="w-3.5 h-3.5" /></button></Tooltip>
                                                <Tooltip text="Delete"><button onClick={(e) => handleDeleteTime(e, entry)} className="p-1.5 rounded bg-white dark:bg-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/50 text-slate-400 hover:text-red-600 transition-colors"><TrashIcon className="w-3.5 h-3.5" /></button></Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-3">
                                    <ClockIcon className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No time recorded</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 max-w-[200px]">Track billable hours to ensure accurate invoicing.</p>
                                <button onClick={() => openModal('newTimeEntry', matter.id)} className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-lg transition-colors border border-primary-100 dark:border-primary-800">
                                    + Log First Entry
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expenses Column */}
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Expenses
                            <span className="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full">{expenses.length}</span>
                        </h4>
                    </div>
                    <div className="flex-grow bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden flex flex-col shadow-sm min-h-[300px]">
                        {expenses.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {expenses.map(expense => (
                                    <div key={expense.id} className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-700/30 border border-slate-100 dark:border-zinc-700/50 group hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{expense.description}</p>
                                            <p className="text-sm font-bold whitespace-nowrap ml-2"><NairaSymbol />{formatNaira(expense.amount)}</p>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(expense.date).toLocaleDateString('en-GB')}</p>
                                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                <Tooltip text="Edit"><button onClick={() => openModal('editExpense', expense.id)} className="p-1.5 rounded bg-white dark:bg-zinc-600 hover:bg-primary-50 dark:hover:bg-primary-900/50 text-slate-400 hover:text-primary-600 transition-colors"><EditIcon className="w-3.5 h-3.5" /></button></Tooltip>
                                                <Tooltip text="Delete"><button onClick={(e) => handleDeleteExpenseClick(e, expense)} className="p-1.5 rounded bg-white dark:bg-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/50 text-slate-400 hover:text-red-600 transition-colors"><TrashIcon className="w-3.5 h-3.5" /></button></Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-3">
                                    <CalculatorIcon className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No expenses logged</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 max-w-[200px]">Keep track of disbursements and filing fees here.</p>
                                <button onClick={() => openModal('newExpense', matter.id)} className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-lg transition-colors border border-primary-100 dark:border-primary-800">
                                    + Add Expense
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Invoices */}
            <div className="flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        Invoices
                        <span className="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs px-2 py-0.5 rounded-full">{matterInvoices.length}</span>
                    </h4>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm">
                    {matterInvoices.length > 0 ? (
                        <div className="max-h-80 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {matterInvoices.map(invoice => (
                                <div key={invoice.id} onClick={() => navigateTo('invoiceDetail', invoice.id)} className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-700/30 border border-slate-100 dark:border-zinc-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all group flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{invoice.invoiceNumber}</p>
                                            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${invoice.status === 'Paid' ? 'bg-green-100 text-green-700' : invoice.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {invoice.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">Due: {new Date(invoice.dueDate).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira((invoice.lineItems || []).reduce((s, li) => s + (li.total || 0), 0))}</p>
                                        <span className="text-xs font-semibold text-primary-600 group-hover:underline">View Invoice</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 p-4 text-center">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-3">
                                <BillingIcon className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">No invoices generated</p>
                            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-[250px]">Use the "Generate Invoice" button above to create a bill from your logged time and expenses.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
};

export default BillingSummaryWidget;
