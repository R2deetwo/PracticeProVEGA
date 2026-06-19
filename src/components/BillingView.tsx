
import React, { useState, useMemo, useRef } from 'react';
import { Invoice, InvoiceStatus, ModalType, AppState } from '../types';
import { CheckCircleIcon, MailIcon, RevertIcon, BillingIcon, PlusIcon } from '../constants';
import Tooltip from './Tooltip';
import StatCard from './StatCard';
import { formatNaira } from '../utils/formatting';
import NairaSymbol from './NairaSymbol';
import { useHighlight } from '../hooks/useHighlight';
import { useUI } from '../contexts/UIContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useProduct } from '../contexts/ProductContext';
import { useFeatures } from '../hooks/useFeatures';
import EmptyState from './EmptyState';
import { BillingMonitorView } from './BillingMonitorView';
// Atrium revenue modules — conditionally rendered for property/unified firms
import ServiceChargeMonitor from './atrium/ServiceChargeMonitor';
import LedgerManager from './atrium/LedgerManager';
import VacancyPipeline from './atrium/VacancyPipeline';
import AutomationCenter from './atrium/AutomationCenter';

const getStatusBadgeClass = (status: InvoiceStatus) => {
    switch (status) {
        case InvoiceStatus.Paid: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case InvoiceStatus.Unpaid: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case InvoiceStatus.Overdue: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case InvoiceStatus.Reversed: return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 line-through';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
};

const InvoiceRow: React.FC<{
    invoice: Invoice,
    onViewDetails: (id: string) => void,
    onSendReminder: (id: string) => void,
    onMarkAsPaid: (id: string) => void,
    onRevertPayment: (id: string) => void,
}> = React.memo(({ invoice, onViewDetails, onSendReminder, onMarkAsPaid, onRevertPayment }) => {
    // Safety check: ensure lineItems exists before reducing
    const total = (invoice.lineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);

    return (
        <tr
            data-item-id={invoice.id}
            onClick={() => onViewDetails(invoice.id)}
            className="relative overflow-hidden hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-all duration-300 cursor-pointer group"
        >
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{invoice.client?.name || 'Unknown Client'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{new Date(invoice.issueDate).toLocaleDateString('en-GB')}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white"><NairaSymbol />{formatNaira(total)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(invoice.status)}`}>{invoice.status}</span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                    {invoice.status === InvoiceStatus.Unpaid || invoice.status === InvoiceStatus.Overdue ? (
                        <>
                            <Tooltip text="Send Reminder"><button onClick={(e) => { e.stopPropagation(); onSendReminder(invoice.id); }} className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-zinc-600"><MailIcon className="w-4 h-4 text-blue-600" /></button></Tooltip>
                            <Tooltip text="Mark as Paid"><button onClick={(e) => { e.stopPropagation(); onMarkAsPaid(invoice.id); }} className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-zinc-600"><CheckCircleIcon className="w-4 h-4 text-green-600" /></button></Tooltip>
                        </>
                    ) : invoice.status === InvoiceStatus.Paid ? (
                        <Tooltip text="Revert Payment"><button onClick={(e) => { e.stopPropagation(); onRevertPayment(invoice.id); }} className="p-2 rounded-full hover:bg-yellow-100 dark:hover:bg-zinc-600"><RevertIcon className="w-4 h-4 text-yellow-600" /></button></Tooltip>
                    ) : null}
                </div>
            </td>
        </tr>
    );
});

const InvoiceMobileCard: React.FC<{
    invoice: Invoice,
    onViewDetails: (id: string) => void,
}> = React.memo(({ invoice, onViewDetails }) => {
    const total = (invoice.lineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);

    return (
        <div
            data-item-id={invoice.id}
            onClick={() => onViewDetails(invoice.id)}
            className="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 mb-3 cursor-pointer active:bg-slate-50 dark:active:bg-zinc-700"
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="font-bold text-slate-900 dark:text-white">{invoice.client?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{invoice.invoiceNumber}</p>
                </div>
                <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusBadgeClass(invoice.status)}`}>{invoice.status}</span>
            </div>
            <div className="flex justify-between items-end">
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                    <p>Due: {new Date(invoice.dueDate).toLocaleDateString('en-GB')}</p>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(total)}</p>
            </div>
        </div>
    );
});


// Sub-component for the main invoice list logic
const InvoicesContent: React.FC<{ invoices: Invoice[], openModal: any, onViewDetails: any, handleUpdateInvoiceStatus: any, handleSendInvoiceReminder: any, handleRevertPayment: any, closeModal: any, openConfirmationModal: any }> = ({ invoices, openModal, onViewDetails, handleUpdateInvoiceStatus, handleSendInvoiceReminder, handleRevertPayment, closeModal, openConfirmationModal }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useHighlight(containerRef, 'billing');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
    const { isProperty } = useProduct();

    const onMarkAsPaid = (id: string) => {
        openConfirmationModal('deleteConfirmation', id, {
            title: 'Confirm Payment?',
            message: `This will mark the invoice as paid.`,
            onConfirm: () => { handleUpdateInvoiceStatus(id, InvoiceStatus.Paid); closeModal(); },
            confirmText: 'Confirm Payment',
            confirmButtonClass: 'bg-green-600 hover:bg-green-700'
        });
    };

    const onRevert = (id: string) => {
        openConfirmationModal('deleteConfirmation', id, {
            title: 'Revert Payment?',
            message: `This will mark the invoice as 'Reversed'.`,
            onConfirm: () => { handleRevertPayment(id); closeModal(); },
            confirmText: 'Yes, Revert',
            confirmButtonClass: 'bg-yellow-600 hover:bg-yellow-700'
        });
    };

    const financialSummary = useMemo(() => {
        const safeInvoices = invoices || [];
        const totalBilled = safeInvoices.reduce((sum, i) => sum + (i.lineItems || []).reduce((s, li) => s + (li.total || 0), 0), 0);
        const totalPaid = safeInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (i.lineItems || []).reduce((s, li) => s + (li.total || 0), 0), 0);
        const outstanding = totalBilled - totalPaid;
        const overdue = safeInvoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + (i.lineItems || []).reduce((s, li) => s + (li.total || 0), 0), 0);
        return { totalBilled, totalPaid, outstanding, overdue };
    }, [invoices]);

    const filteredInvoices = useMemo(() => {
        let items = [...(invoices || [])];
        if (statusFilter !== 'All') {
            items = items.filter(i => i.status === statusFilter);
        }
        if (filter) {
            const lowerFilter = filter.toLowerCase();
            items = items.filter(i =>
                (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(lowerFilter)) ||
                (i.client && i.client.name && i.client.name.toLowerCase().includes(lowerFilter)) ||
                (i.matter && i.matter.title && i.matter.title.toLowerCase().includes(lowerFilter))
            );
        }
        return items.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    }, [invoices, filter, statusFilter]);

    return (
        <div ref={containerRef}>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
                <StatCard title="Total Outstanding" value={<><NairaSymbol />{formatNaira(financialSummary.outstanding)}</>} icon={<div />} colorClass="text-yellow-500" scrollOnOverflow={true} />
                <StatCard title="Total Overdue" value={<><NairaSymbol />{formatNaira(financialSummary.overdue)}</>} icon={<div />} colorClass="text-red-500" scrollOnOverflow={true} />
                <StatCard title="Total Paid (All Time)" value={<><NairaSymbol />{formatNaira(financialSummary.totalPaid)}</>} icon={<div />} colorClass="text-green-500" scrollOnOverflow={true} />
                <StatCard title="Total Billed (All Time)" value={<><NairaSymbol />{formatNaira(financialSummary.totalBilled)}</>} icon={<div />} colorClass="text-blue-500" scrollOnOverflow={true} />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <input autoComplete="off" data-lpignore="true" 
                    type="search"
                    placeholder={`Search by invoice #, client, or ${isProperty ? 'property' : 'matter'}...`}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="w-full md:w-1/3 px-4 py-2 bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
            </div>

            <div className="transition-all duration-300">
                {filteredInvoices.length > 0 ? (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg bg-white dark:bg-zinc-800 shadow-md border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice #</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Issue Date</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {filteredInvoices.map(invoice => (
                                            <InvoiceRow
                                                key={invoice.id}
                                                invoice={invoice}
                                                onViewDetails={onViewDetails}
                                                onSendReminder={handleSendInvoiceReminder}
                                                onMarkAsPaid={onMarkAsPaid}
                                                onRevertPayment={onRevert}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredInvoices.map(invoice => (
                                <InvoiceMobileCard
                                    key={invoice.id}
                                    invoice={invoice}
                                    onViewDetails={onViewDetails}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <EmptyState
                        title="No Invoices Found"
                        description="Create an invoice to start billing your clients and tracking payments."
                        icon={<div className="flex items-center justify-center w-full h-full text-6xl text-slate-300 dark:text-zinc-600 font-serif"><NairaSymbol /></div>}
                        actionLabel="Create Invoice"
                        onAction={() => openModal('newInvoice')}
                    />
                )}
            </div>
        </div>
    );
}


export const BillingView: React.FC = () => {
    const { financeState } = useFinanceState();
    const { openModal, navigateTo, closeModal } = useUI();
    const { handleUpdateInvoiceStatus, handleSendInvoiceReminder, handleRevertPayment } = useDataActions();
    const features = useFeatures();
    const { isProperty, isUnified, product } = useProduct();
    const { coreState } = useCoreState();

    // Unified Financials tab state. Tabs are conditionally shown based on
    // the firm's product (legal vs property vs unified) and tier.
    //
    // LEGAL (Vega) firms see:
    //   - Invoices & Demands (their existing invoice list)
    //   - Billing Monitor (premium — automated retainer outbox)
    //
    // PROPERTY (Atrium) firms see:
    //   - Invoices & Demands (their existing invoice list — rent demands etc.)
    //   - Revenue Monitor (defaulters / service charge dashboard)
    //   - Payments & Receipts (ledger manager)
    //   - Vacancies (vacancy pipeline)
    //   - Automations (rent reminder automation center)
    //
    // UNIFIED (Komplete) firms see ALL of the above — clearly marked with
    // Legal/Property badges so users always know which context they're in.
    type FinancialsTab = 'invoices' | 'revenue' | 'payments' | 'vacancies' | 'automations' | 'monitor';
    const [activeTab, setActiveTab] = useState<FinancialsTab>('invoices');

    // Build the tab list based on product + tier
    //
    // Nomenclature audit:
    //   - "Invoices & Demands" = the invoice list (legal invoices + property rent demands)
    //   - "Service Charges" = the defaulters / service charge dashboard (was "Revenue Monitor")
    //   - "Payments & Receipts" = ledger manager (property payment records)
    //   - "Vacancies" = vacancy pipeline (available units)
    //   - "Reminder Rules" = automation center (rent reminder rule config — was "Automations")
    //   - "Billing Monitor" = automated retainer billing outbox (premium, legal)
    //
    // The "Reminder Rules" name makes it clear these are the RULES that generate
    // the messages you see in Messages > WhatsApp & Email. Avoids conceptual
    // overlap with the messaging automations.
    const tabs: { id: FinancialsTab; label: string; badge?: string; productTag?: 'Legal' | 'Property' }[] = [
        { id: 'invoices', label: 'Invoices & Demands' },
    ];
    if (isProperty || isUnified) {
        tabs.push(
            { id: 'revenue', label: 'Service Charges', productTag: 'Property' },
            { id: 'payments', label: 'Payments & Receipts', productTag: 'Property' },
            { id: 'vacancies', label: 'Vacancies', productTag: 'Property' },
            { id: 'automations', label: 'Reminder Rules', productTag: 'Property' },
        );
    }
    if (features.canUseRetainerAutoBilling) {
        tabs.push({ id: 'monitor', label: 'Billing Monitor', productTag: 'Legal' });
    }

    // KPI strip — unified metrics across legal + property
    const kpiData = useMemo(() => {
        const invoices = financeState.invoices || [];
        const ledgerEntries = (coreState as any).ledgerEntries || [];
        const serviceCharges = (coreState as any).serviceCharges || [];

        const paidThisMonth = invoices.filter(i => {
            if (i.status !== InvoiceStatus.Paid || !i.paidDate) return false;
            const d = new Date(i.paidDate);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, i) => s + (i.total_amount || i.subTotal || 0), 0);

        const outstanding = invoices
            .filter(i => i.status === InvoiceStatus.Unpaid || i.status === InvoiceStatus.Overdue || i.status === InvoiceStatus.Sent)
            .reduce((s, i) => s + (i.total_amount || i.subTotal || 0), 0);

        const propertyCollected = ledgerEntries
            .filter((e: any) => e.status === 'cleared')
            .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        const propertyOutstanding = ledgerEntries
            .filter((e: any) => e.status === 'pending')
            .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        const criticalDefaulters = serviceCharges.filter((d: any) => d.isDefaulter && (d.daysOverdue ?? 0) > 14).length;

        return {
            collected: paidThisMonth + propertyCollected,
            outstanding: outstanding + propertyOutstanding,
            defaults: criticalDefaulters,
            invoiceCount: invoices.length,
        };
    }, [financeState.invoices, (coreState as any).ledgerEntries, (coreState as any).serviceCharges]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financials</h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {isUnified ? 'Unified revenue & billing — Legal + Property' : isProperty ? 'Property revenue & billing' : 'Legal billing & invoices'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openModal('newInvoice')}
                        className="p-1 px-3 sm:p-2 sm:px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                    >
                        <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4" /> New
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {/* KPI Strip — unified across legal + property */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800/30 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Collected</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatNaira(kpiData.collected)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-800/30 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Outstanding</p>
                        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatNaira(kpiData.outstanding)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-800/30 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Defaults</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-400">{kpiData.defaults}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Invoices</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{kpiData.invoiceCount}</p>
                    </div>
                </div>

                {/* Tab Bar — matches the Analytics page pattern */}
                <div className="mb-6 border-b border-gray-200 dark:border-zinc-700">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
                                }`}
                            >
                                {tab.label}
                                {tab.productTag && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                                        tab.productTag === 'Legal'
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    }`}>
                                        {tab.productTag}
                                    </span>
                                )}
                                {tab.id === 'monitor' && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                        Premium
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'invoices' && (
                    <InvoicesContent
                        invoices={financeState.invoices}
                        openModal={openModal}
                        onViewDetails={(id: string) => navigateTo('invoiceDetail', id)}
                        handleUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                        handleSendInvoiceReminder={handleSendInvoiceReminder}
                        handleRevertPayment={handleRevertPayment}
                        closeModal={closeModal}
                        openConfirmationModal={openModal}
                    />
                )}

                {activeTab === 'revenue' && (isProperty || isUnified) && (
                    <div className="min-h-[500px]">
                        <ServiceChargeMonitor />
                    </div>
                )}

                {activeTab === 'payments' && (isProperty || isUnified) && (
                    <div className="min-h-[500px]">
                        <LedgerManager />
                    </div>
                )}

                {activeTab === 'vacancies' && (isProperty || isUnified) && (
                    <div className="min-h-[500px]">
                        <VacancyPipeline />
                    </div>
                )}

                {activeTab === 'automations' && (isProperty || isUnified) && (
                    <div className="min-h-[500px]">
                        <AutomationCenter />
                    </div>
                )}

                {activeTab === 'monitor' && <BillingMonitorView />}
            </div>
        </div>
    );
};

