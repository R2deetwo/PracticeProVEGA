
import React, { useState } from 'react';
import { Matter, Invoice, InvoiceStatus, ModalType } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useDataState } from '../../contexts/DataContext';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { ScalesIcon, CheckIcon } from '../../constants';

interface ClientBillingTabProps {
    matter: Matter;
    invoices: Invoice[];
}

export const ClientBillingTab: React.FC<ClientBillingTabProps> = ({ matter, invoices }) => {
    const { navigateTo, openModal, addToast } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const { handlePayInvoice } = useDataActions();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const outstandingInvoices = invoices.filter(inv => inv.status === InvoiceStatus.Unpaid || inv.status === InvoiceStatus.Overdue);
    const paidInvoices = invoices.filter(inv => inv.status === InvoiceStatus.Paid).sort((a, b) => new Date(b.paidDate!).getTime() - new Date(a.paidDate!).getTime());
    const lastReceipt = paidInvoices[0];
    
    const handlePaymentClick = (id: string, amount: number, type: 'invoice', title: string) => {
        openModal('paymentGateway', null, {
            amount: amount,
            title: `Pay Invoice #${title}`,
            description: 'Professional Legal Services',
            onConfirm: () => {
                setProcessingId(id);
                setTimeout(() => {
                    handlePayInvoice(id);
                    setProcessingId(null);
                    addToast("Payment processed successfully.", { type: 'success' });
                }, 500);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-xl font-bold mb-4">Outstanding Invoices</h3>
                {outstandingInvoices.length > 0 ? (
                    <ul className="space-y-3">
                        {outstandingInvoices.map(inv => {
                            const total = inv.lineItems.reduce((s, li) => s + li.total, 0);
                            return (
                                <li key={inv.id} className="p-3 bg-slate-50 dark:bg-zinc-700/50 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div>
                                        <p className="font-semibold">{inv.invoiceNumber}</p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">Due: {new Date(inv.dueDate).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-slate-900 dark:text-white"><NairaSymbol/>{formatNaira(total)}</p>
                                            <p className={`text-xs font-semibold ${inv.status === 'Overdue' ? 'text-red-500' : 'text-yellow-600'}`}>{inv.status}</p>
                                        </div>
                                         <button 
                                            onClick={() => handlePaymentClick(inv.id, total, 'invoice', inv.invoiceNumber)}
                                            disabled={!!processingId}
                                            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 disabled:opacity-50 transition-all w-28 flex justify-center"
                                        >
                                            {processingId === inv.id ? (
                                                <span className="animate-pulse">Paying...</span>
                                            ) : 'Pay Now'}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="text-center py-8 bg-slate-50 dark:bg-zinc-900/50 rounded-lg">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-slate-600 dark:text-zinc-300 font-medium">All clear!</p>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">You have no outstanding invoices.</p>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-xl font-bold mb-4">Financial Records</h3>
                <div className="space-y-4">
                    {lastReceipt ? (
                         <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-700/50 rounded-lg">
                            <div>
                                <p className="font-semibold">Your Most Recent Payment</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(lastReceipt.paidDate!).toLocaleDateString('en-GB')}</p>
                            </div>
                            <button onClick={() => navigateTo('receiptDetail', lastReceipt.id)} className="px-3 py-1 bg-slate-200 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200 rounded-md font-semibold text-xs hover:bg-slate-300 dark:hover:bg-zinc-500">
                                View Receipt
                            </button>
                        </div>
                    ) : (
                         <p className="text-sm text-slate-500 dark:text-zinc-400">No payment history found for this matter.</p>
                    )}
                     <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                        <h4 className="font-semibold mb-2">Request a Document</h4>
                         <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">Need a specific financial document? Send a request to your legal team.</p>
                        <button onClick={() => openModal('requestFinancialDocument', matter.id)} className="px-4 py-2 bg-slate-200 dark:bg-zinc-700 rounded-lg font-semibold text-sm hover:bg-slate-300 dark:hover:bg-zinc-600">
                            Make a Request
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
