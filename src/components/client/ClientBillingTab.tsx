
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
                // TRUST MODEL FIX: Do NOT auto-flip invoice to Paid here.
                // Previously, this called handlePayInvoice(id) after a 500ms timeout,
                // which untrustedly marked the invoice as Paid from the client side.
                // Now, the client only confirms the bank transfer was made — the firm
                // must verify and mark as Paid manually (or via Paystack webhook when
                // Paystack is activated). This prevents clients from self-marking
                // invoices as paid without verification.
                setTimeout(() => {
                    setProcessingId(null);
                    addToast("Payment confirmation submitted. Your firm will verify the transfer and mark the invoice as paid.", { type: 'success' });
                }, 500);
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-xl font-bold mb-4">Outstanding Invoices</h3>
                {outstandingInvoices.length > 0 ? (
                    <ul className="space-y-3">
                        {outstandingInvoices.map(inv => {
                            const total = (inv.lineItems || []).reduce((s, li) => s + li.total, 0);
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

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-xl font-bold mb-4">Financial Records</h3>
                <div className="space-y-4">
                    {lastReceipt ? (
                         <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-700/50 rounded-lg">
                            <div>
                                <p className="font-semibold">Your Most Recent Payment</p>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(lastReceipt.paidDate!).toLocaleDateString('en-GB')}</p>
                            </div>
                            <button
                                onClick={() => {
                                    // FIX: navigated to 'receiptDetail' — a view the client
                                    // routing swallows back to the dashboard (dead button).
                                    // Print the receipt directly from the invoice data instead.
                                    const inv: any = lastReceipt;
                                    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
                                    const total = typeof inv.total_amount === 'number' ? inv.total_amount : (inv.subTotal || (inv.lineItems || []).reduce((sm: number, li: any) => sm + (li?.total || 0), 0)) + (inv.taxAmount || 0);
                                    const win = window.open('', '_blank');
                                    if (!win) return;
                                    win.document.write(`
                                    <html><head><title>Receipt ${esc(inv.invoiceNumber || inv.id || '')}</title>
                                    <style>body{font-family:Georgia,serif;max-width:420px;margin:40px auto;padding:24px;border:1px solid #ccc}
                                    h2{margin:0 0 2px}small{color:#666}hr{border:none;border-top:1px dashed #ccc}
                                    .row{display:flex;justify-content:space-between;margin:8px 0;font-size:14px}
                                    .total{font-weight:bold;font-size:18px;color:#059669;margin-top:12px}
                                    .paid{color:#059669;font-weight:bold;letter-spacing:2px;text-align:center;margin:10px 0}</style></head><body>
                                    <h2>${esc(inv.matter?.title || 'Professional Services')}</h2>
                                    <small>Receipt — ${esc(inv.invoiceNumber || '')}</small><hr/>
                                    <div class="row"><span>Paid</span><span>${new Date(inv.paidDate || Date.now()).toLocaleDateString('en-GB')}</span></div>
                                    ${(inv.lineItems || []).map((li: any) => `<div class="row"><span>${esc(li.description || li.name || 'Service')}</span><span>&#8358;${(li?.total || 0).toLocaleString('en-NG')}</span></div>`).join('')}
                                    ${inv.taxAmount ? `<div class="row"><span>VAT</span><span>&#8358;${Number(inv.taxAmount).toLocaleString('en-NG')}</span></div>` : ''}
                                    <hr/><div class="row total"><span>Total Paid</span><span>&#8358;${Number(total).toLocaleString('en-NG')}</span></div>
                                    <div class="paid">— PAID —</div>
                                    </body></html>`);
                                    win.document.close();
                                    win.print();
                                }}
                                className="px-3 py-1 bg-slate-200 dark:bg-zinc-600 text-slate-700 dark:text-zinc-200 rounded-md font-semibold text-xs hover:bg-slate-300 dark:hover:bg-zinc-500"
                            >
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
