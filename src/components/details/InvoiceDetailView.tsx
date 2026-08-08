
import React, { useState } from 'react';
import { Invoice, FirmDetails, Contact, ModalType, View, InvoiceStatus } from '../../types';
import { PrinterIcon, MailIcon, CheckCircleIcon, TrashIcon, RevertIcon, ZoomInIcon, ZoomOutIcon } from '../../constants';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { generateInvoicePdf } from '../../services/reportGenerator';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useMatterState } from '../../contexts/MatterContext';
import Tooltip from '../Tooltip';
import { Breadcrumbs } from '../Breadcrumbs';
import ErrorBoundary from '../ErrorBoundary';

const InvoiceDetailViewContent: React.FC = () => {
    const { financeState } = useFinanceState();
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    const { handleUpdateInvoiceStatus, handleRevertPayment, handleSendInvoiceReminder, deleteItem: onDeleteInvoice } = useDataActions();
    const { closeModal, navigateTo, openModal, addToast, selectedId: invoiceId, currentHistoryEntry } = useUI();

    const invoice = financeState.invoices.find((i: any) => i.id === invoiceId);
    const firmDetails = coreState.firmDetails;
    const client = invoice ? matterState.contacts.find((c: any) => c.id === invoice.client?.id) : null;
    const previousViewName = (currentHistoryEntry.previousView as string) || 'billing';

    const onGoBack = () => navigateTo(previousViewName as any);
    const onViewReceipt = (id: string) => navigateTo('receiptDetail', id);

    // NOTE: All hooks must run BEFORE any conditional return (Rules of Hooks).
    // Previously, `if (!invoice) return (...)` was placed BEFORE useState(zoom),
    // causing a "Rendered fewer hooks than expected" crash when the invoice
    // resolved from undefined to a value. Now the hook runs unconditionally.
    const [zoom, setZoom] = useState(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 800) {
            return Math.max(0.3, window.innerWidth / 850);
        }
        return 0.85;
    });
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.05, 1.5));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.05, 0.3));

    if (!invoice) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <p className="text-lg font-medium">Invoice not found</p>
        </div>
    );


    // Calculate totals if not present in old data — guard against missing lineItems
    const calculatedSubTotal = (invoice.lineItems || []).reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const subTotal = invoice.subTotal !== undefined ? invoice.subTotal : calculatedSubTotal;
    const taxAmount = invoice.taxAmount !== undefined ? invoice.taxAmount : 0;
    const totalAmount = subTotal + taxAmount;

    const isLocked = invoice.status === InvoiceStatus.Paid || invoice.status === InvoiceStatus.Reversed;

    const handleDelete = () => {
        openModal('deleteConfirmation', invoice.id, {
            title: `Delete Invoice ${invoice.invoiceNumber}?`,
            message: 'Are you sure you want to permanently delete this invoice? This action cannot be undone.',
            onConfirm: () => {
                onDeleteInvoice('invoices', invoice.id, invoice.invoiceNumber);
                closeModal();
            }
        });
    };

    const handleMarkAsPaid = () => {
        openModal('deleteConfirmation', invoice.id, {
            title: 'Confirm Invoice Payment?',
            message: `This will mark invoice ${invoice.invoiceNumber} as paid, create a permanent financial record (including a receipt), and lock the invoice from future edits. This action cannot be undone.`,
            onConfirm: () => {
                handleUpdateInvoiceStatus(invoice.id, InvoiceStatus.Paid);
                closeModal();
            },
            confirmText: 'Confirm Payment',
            confirmButtonClass: 'bg-green-600 hover:bg-green-700'
        });
    };

    const handleRevert = () => {
        openModal('deleteConfirmation', invoice.id, {
            title: `Revert Payment for Invoice ${invoice.invoiceNumber}?`,
            message: (
                <div>
                    <p>This will create a <strong>Credit Note</strong> to cancel the original invoice and mark the associated time/expenses as unbilled again, so you can create a corrected invoice if needed.</p>
                    <p className="font-bold mt-2">This is an accounting action and cannot be undone.</p>
                </div>
            ),
            onConfirm: () => {
                handleRevertPayment(invoice.id);
                closeModal();
            },
            confirmText: 'Confirm and Revert',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    }

    const handleDownloadPdf = () => {
        if (client) {
            generateInvoicePdf(invoice, firmDetails, client);
        } else {
            addToast("Client details could not be found to generate the PDF.", { type: 'error' });
        }
    };

    const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const headerTextColor = firmDetails.headerTextColor || '#111827'; // Default to slate-900

    return (
        <div className="h-full flex flex-col bg-slate-100 dark:bg-zinc-900 relative overflow-hidden">
            {/* Top Bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700 z-20">
                <Breadcrumbs items={[
                    { label: 'Billing', onClick: () => navigateTo('billing') },
                    { label: invoice.invoiceNumber }
                ]} />
                <div className="flex items-center gap-1 sm:gap-2">
                    <Tooltip text="Zoom Out"><button onClick={handleZoomOut} className="p-1 sm:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500"><ZoomOutIcon className="w-4 h-4 sm:w-5 sm:h-5" /></button></Tooltip>
                    <span className="text-2xs sm:text-xs font-mono text-slate-400 w-8 sm:w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <Tooltip text="Zoom In"><button onClick={handleZoomIn} className="p-1 sm:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-500"><ZoomInIcon className="w-4 h-4 sm:w-5 sm:h-5" /></button></Tooltip>
                    <div className="hidden sm:block h-6 w-px bg-slate-200 dark:border-zinc-700 mx-1 sm:mx-2"></div>

                    <button onClick={handleDownloadPdf} className="flex items-center justify-center sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 rounded-lg font-medium text-xs sm:text-sm transition-colors shadow-sm ml-1">
                        <PrinterIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    {invoice.status === InvoiceStatus.Unpaid || invoice.status === InvoiceStatus.Overdue || invoice.status === InvoiceStatus.Sent || invoice.status === InvoiceStatus.Draft ? (
                        <>
                            <button onClick={() => handleSendInvoiceReminder(invoice.id)} className="flex items-center justify-center sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 rounded-lg font-medium text-xs sm:text-sm transition-colors shadow-sm">
                                <MailIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Reminder</span>
                            </button>
                            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:border-zinc-700 mx-1 sm:mx-2"></div>
                            <button onClick={handleMarkAsPaid} className="flex items-center justify-center sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs sm:text-sm transition-colors shadow-sm whitespace-nowrap">
                                <CheckCircleIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Mark as Paid</span>
                            </button>
                        </>
                    ) : invoice.status === InvoiceStatus.Paid ? (
                        <>
                            <button onClick={() => onViewReceipt(invoice.id)} className="flex items-center justify-center sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg font-bold text-xs sm:text-sm transition-colors shadow-sm whitespace-nowrap">
                                <CheckCircleIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">View Receipt</span>
                            </button>
                            <Tooltip text="Revert Payment"><button onClick={handleRevert} className="p-1.5 sm:p-2 rounded-lg hover:bg-yellow-100 text-yellow-600 border border-transparent hover:border-yellow-200 transition-all"><RevertIcon className="w-4 h-4 sm:w-5 sm:h-5" /></button></Tooltip>
                        </>
                    ) : null}

                    {!isLocked && (
                        <>
                            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:border-zinc-700 mx-1 sm:mx-2"></div>
                            <button onClick={handleDelete} className="flex items-center justify-center sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 border border-transparent hover:border-red-200 dark:hover:border-red-800 rounded-lg font-medium text-xs sm:text-sm transition-colors ml-1">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Preview Area - Simulates A4 Paper */}
            <div className="flex-grow overflow-auto bg-slate-200/50 dark:bg-zinc-900 flex justify-center items-start lg:items-start p-2 sm:p-8 pt-4 pb-24">
                <div
                    className="bg-white dark:bg-zinc-900 text-black shadow-2xl transition-transform duration-200 origin-top flex-shrink-0 relative overflow-hidden"
                    style={{
                        width: '210mm',
                        minWidth: '210mm',
                        minHeight: '297mm',
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                        marginBottom: `${297 * (1 - zoom)}mm`, 
                    }}
                >
                    {/* Letterhead Background Image (Absolute Positioned) */}
                    {firmDetails.letterheadUrl && (
                        <img
                            src={firmDetails.letterheadUrl}
                            alt="Letterhead"
                            className="absolute inset-0 w-[210mm] max-w-none h-full object-cover z-0 pointer-events-none"
                        />
                    )}

                    {/* Content Container (Relative Z-10) */}
                    <div className="relative z-10 p-[15mm] h-full flex flex-col">

                        {/* Header Section */}
                        <header className="mb-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    {firmDetails.logoUrl && !firmDetails.letterheadUrl && (
                                        <img src={firmDetails.logoUrl} alt="Firm Logo" className="h-24 w-auto object-contain" />
                                    )}
                                </div>
                                <div className="text-right ml-auto" style={{ color: headerTextColor }}>
                                    <h2 className="text-3xl font-bold mb-1" style={{ color: 'inherit' }}>{firmDetails.name}</h2>
                                    <p className="text-xs whitespace-pre-line" style={{ color: 'inherit', opacity: 0.9 }}>{firmDetails.address}</p>
                                </div>
                            </div>
                            <div className="py-6 border-b border-gray-200"></div>
                        </header>

                        <div className="flex justify-between mb-12">
                            <div className="max-w-[50%]">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billed To</p>
                                <p className="font-bold text-gray-900 text-lg truncate">{client?.name}</p>
                                {client?.address && <p className="text-sm text-gray-600 whitespace-pre-line mt-1">{client.address}</p>}
                            </div>
                            <div className="text-right">
                                <h1 className="text-4xl font-bold text-gray-900 mb-2">INVOICE</h1>
                                <div className="text-sm">
                                    <p><span className="font-semibold text-gray-600">Invoice #:</span> {invoice.invoiceNumber}</p>
                                    <p><span className="font-semibold text-gray-600">Date:</span> {new Date(invoice.issueDate).toLocaleDateString('en-GB', dateOptions)}</p>
                                    <p><span className="font-semibold text-gray-600">Due Date:</span> {new Date(invoice.dueDate).toLocaleDateString('en-GB', dateOptions)}</p>
                                </div>
                            </div>
                        </div>

                        <table className="w-full mb-8 table-fixed">
                            <thead>
                                <tr className="bg-primary-600 text-white">
                                    <th className="py-2 px-3 text-left text-sm font-bold uppercase w-1/2">Description</th>
                                    <th className="py-2 px-3 text-right text-sm font-bold uppercase w-1/6">Hours</th>
                                    <th className="py-2 px-3 text-right text-sm font-bold uppercase w-1/6">Rate</th>
                                    <th className="py-2 px-3 text-right text-sm font-bold uppercase w-1/6">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-gray-700">
                                {(invoice.lineItems || []).map((item: any, idx: number) => (
                                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50 dark:bg-zinc-800/50'}>
                                        <td className="py-3 px-3 border-b border-slate-100 whitespace-pre-wrap break-words">{item.description}</td>
                                        <td className="py-3 px-3 text-right border-b border-slate-100 whitespace-nowrap">{item.hours > 0 ? item.hours.toFixed(2) : '-'}</td>
                                        <td className="py-3 px-3 text-right border-b border-slate-100 whitespace-nowrap">{item.rate > 0 ? <><NairaSymbol />{formatNaira(item.rate)}</> : '-'}</td>
                                        <td className="py-3 px-3 text-right border-b border-slate-100 font-medium whitespace-nowrap"><NairaSymbol />{formatNaira(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end">
                            <div className="w-1/2">
                                <div className="flex justify-between py-2 text-sm">
                                    <span className="font-medium text-gray-600">Subtotal</span>
                                    <span className="whitespace-nowrap text-right"><NairaSymbol />{formatNaira(subTotal)}</span>
                                </div>
                                {taxAmount > 0 && (
                                    <div className="flex justify-between py-2 text-sm border-b border-gray-200">
                                        <span className="font-medium text-gray-600">VAT (7.5%)</span>
                                        <span className="whitespace-nowrap text-right"><NairaSymbol />{formatNaira(taxAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between py-3 text-xl font-bold text-gray-900 mt-2">
                                    <span>Total</span>
                                    <span className="whitespace-nowrap text-right" title={`₦${formatNaira(totalAmount)}`}><NairaSymbol />{formatNaira(totalAmount)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-12">
                            <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-2">Payment Details</h4>
                            <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-slate-200 text-sm text-gray-700">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-xs text-gray-500">Bank Name</span>
                                        <span className="font-semibold">{invoice.paymentDetails?.bankName || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-500">Account Number</span>
                                        <span className="font-semibold">{invoice.paymentDetails?.accountNumber || 'N/A'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-xs text-gray-500">Account Name</span>
                                        <span className="font-semibold">{invoice.paymentDetails?.accountName || firmDetails.name}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-center text-xs text-gray-400 mt-8">Thank you for your business.</p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export const InvoiceDetailView: React.FC = () => (
    <ErrorBoundary>
        <InvoiceDetailViewContent />
    </ErrorBoundary>
);
