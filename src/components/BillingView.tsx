
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Invoice, InvoiceStatus, ModalType, AppState } from '../types';
import { CheckCircleIcon, MailIcon, RevertIcon, BillingIcon, PlusIcon, ExclamationTriangleIcon } from '../constants';
import { Clock, AlertCircle, CheckCircle, FileText, Ban, Undo2 } from 'lucide-react';
import Tooltip from './Tooltip';
import { Select, FinancialStatusBadge } from './ui';
// SIMPLIFY FIX: StatCard import removed with the duplicate KPI row.
import { formatNaira } from '../utils/formatting';
import { isActiveFinancialRecord } from '../utils/financialLifecycle';
import { computeClientFinancialSummary, invoiceOutstanding, invoiceTotalAmount } from '../utils/invoiceFinancials';
import { partitionInvoicesByOrigin, invoiceBusinessOrigin, invoiceOriginBadge } from '../utils/invoiceOrigin';
import { useMatterState } from '../contexts/MatterContext';
import NairaSymbol from './NairaSymbol';
import { useHighlight } from '../hooks/useHighlight';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useProduct } from '../contexts/ProductContext';
import { useFeatures } from '../hooks/useFeatures';
import EmptyState from './EmptyState';
import { BillingMonitorView } from './BillingMonitorView';
import TrustAccountTab from './details/TrustAccountTab';
// Atrium revenue modules — conditionally rendered for property/unified firms
import ServiceChargeMonitor from './atrium/ServiceChargeMonitor';
import LedgerManager from './atrium/LedgerManager';
import VacancyPipeline from './atrium/VacancyPipeline';
import AutomationCenter from './atrium/AutomationCenter';
import { MaintenanceQueue } from './atrium/MaintenanceQueue';
// ROUND E (Wave E2): the firm-wide resident directory (the tenancy-ledger roster).
import ResidentDirectory from './atrium/ResidentDirectory';
// ROUND F (Wave F1): the financial overview console + the resident bill statement panel.
import FinancialOverview from './atrium/FinancialOverview';
import { ResidentBillPanel } from './atrium/ResidentBillPanel';
// ROUND F (Wave F2): the interactive reconciliation workflow console.
import ReconciliationConsole from './atrium/ReconciliationConsole';
// ROUND F (Wave F3): the report suite + CSV export.
import FinancialReportsConsole from './atrium/FinancialReportsConsole';
// MESSAGES OVERHAUL: the unified composer is hosted here so the Service
// Charges tab's per-charge WhatsApp button opens it (prefilled) — one
// compose experience across the whole app.
import { ComposeModal, ComposeModalPrefill } from './atrium/ComposeModal';
// SIMPLIFY FIX: AtriumInbox moved here from the deleted 'atriumEngine' view
// (RevenueMonitor) — it was the only one of that view's 5 tabs that didn't
// already exist as a Financials tab.
// MESSAGES OVERHAUL: replaced by PaymentProofsScreen — the duplicate inbox
// and audit trail now live ONLY in Messages (Conversations / Sent).
import { PaymentProofsScreen } from './atrium/PaymentProofsScreen';

// UX-02/UX-20: the invoice status palette converges on FinancialStatusBadge
// (semantic status tokens, theme-aware) instead of this file's private
// green/teal/yellow/red hue map — the same status now renders identically
// on every money screen. The old private hue map is deleted.

// UX-22: the audited retirement modal now lives in modals/VoidInvoiceModal
// (shared with the invoice DETAIL view — one retirement path). Re-exported
// here for existing importers; imported locally for the list's own renders.
import { VoidInvoiceModal } from './modals/VoidInvoiceModal';
export { VoidInvoiceModal };


const InvoiceRow: React.FC<{
    invoice: Invoice,
    onViewDetails: (id: string) => void,
    onSendReminder: (id: string) => void,
    onMarkAsPaid: (id: string) => void,
    onRevertPayment: (id: string) => void,
    onVoidInvoice: (invoice: Invoice) => void,
    origin?: 'legal' | 'property',
}> = React.memo(({ invoice, onViewDetails, onSendReminder, onMarkAsPaid, onRevertPayment, onVoidInvoice, origin }) => {
    // Safety check: ensure lineItems exists before reducing
    const total = (invoice.lineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const isVoidedRecord = invoice.recordStatus === 'voided' || invoice.status === InvoiceStatus.Void;
    const originBadge = origin ? invoiceOriginBadge(origin) : null;

    return (
        <tr
            data-item-id={invoice.id}
            onClick={() => onViewDetails(invoice.id)}
            className={`relative overflow-hidden hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-all duration-300 cursor-pointer group ${isVoidedRecord ? 'opacity-60' : ''}`}
        >
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                    {invoice.invoiceNumber}
                    {originBadge && (
                        <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${originBadge.className}`} title={`Originating business operation: ${originBadge.label}`}>
                            {originBadge.label}
                        </span>
                    )}
                </div>
                {invoice.voidReason && (
                    <div className="text-xs text-rose-500 dark:text-rose-400 mt-0.5 max-w-48 truncate" title={`Voided by ${invoice.voidedByEmail || 'unknown'}${invoice.voidedAt ? ' on ' + new Date(invoice.voidedAt).toLocaleDateString('en-GB') : ''}: "${invoice.voidReason}"`}>
                        {invoice.voidReason}
                    </div>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-dim-300">{invoice.client?.name || 'Unknown Client'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-dim-300">{new Date(invoice.issueDate).toLocaleDateString('en-GB')}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-dim-300">{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(total)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                <FinancialStatusBadge status={invoice.status} size="md" />
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                    {isVoidedRecord ? (
                        <Tooltip text="Voided — kept for the audit trail"><span className="p-2"><Ban className="w-4 h-4 text-rose-400" /></span></Tooltip>
                    ) : invoice.status === InvoiceStatus.Unpaid || invoice.status === InvoiceStatus.Overdue ? (
                        <>
                            <Tooltip text="Send Reminder"><button onClick={(e) => { e.stopPropagation(); onSendReminder(invoice.id); }} className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-zinc-600"><MailIcon className="w-4 h-4 text-blue-600" /></button></Tooltip>
                            <Tooltip text="Mark as Paid"><button onClick={(e) => { e.stopPropagation(); onMarkAsPaid(invoice.id); }} className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-zinc-600"><CheckCircleIcon className="w-4 h-4 text-green-600" /></button></Tooltip>
                            <Tooltip text="Void (audited) — retires the invoice, keeps the record"><button onClick={(e) => { e.stopPropagation(); onVoidInvoice(invoice); }} className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-600"><Ban className="w-4 h-4 text-rose-500" /></button></Tooltip>
                        </>
                    ) : invoice.status === InvoiceStatus.Paid ? (
                        <>
                            <Tooltip text="Revert Payment"><button onClick={(e) => { e.stopPropagation(); onRevertPayment(invoice.id); }} className="p-2 rounded-full hover:bg-yellow-100 dark:hover:bg-zinc-600"><RevertIcon className="w-4 h-4 text-yellow-600" /></button></Tooltip>
                            <Tooltip text="Void (audited) — retires the invoice, keeps the record"><button onClick={(e) => { e.stopPropagation(); onVoidInvoice(invoice); }} className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-600"><Ban className="w-4 h-4 text-rose-500" /></button></Tooltip>
                        </>
                    ) : invoice.status === InvoiceStatus.Sent || invoice.status === InvoiceStatus.Reversed ? (
                        <Tooltip text="Void (audited) — retires the invoice, keeps the record"><button onClick={(e) => { e.stopPropagation(); onVoidInvoice(invoice); }} className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-600"><Ban className="w-4 h-4 text-rose-500" /></button></Tooltip>
                    ) : null}
                </div>
            </td>
        </tr>
    );
});

const InvoiceMobileCard: React.FC<{
    invoice: Invoice,
    onViewDetails: (id: string) => void,
    onVoidInvoice?: (invoice: Invoice) => void,
    origin?: 'legal' | 'property',
}> = React.memo(({ invoice, onViewDetails, onVoidInvoice, origin }) => {
    const total = (invoice.lineItems || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const isVoidedRecord = invoice.recordStatus === 'voided' || invoice.status === InvoiceStatus.Void;
    const originBadge = origin ? invoiceOriginBadge(origin) : null;

    return (
        <div
            data-item-id={invoice.id}
            onClick={() => onViewDetails(invoice.id)}
            className={`bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 mb-3 cursor-pointer active:bg-slate-50 dark:active:bg-zinc-700 ${isVoidedRecord ? 'opacity-60' : ''}`}
        >
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {invoice.client?.name || 'Unknown'}
                        {originBadge && (
                            <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${originBadge.className}`} title={`Originating business operation: ${originBadge.label}`}>
                                {originBadge.label}
                            </span>
                        )}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{invoice.invoiceNumber}</p>
                    {invoice.voidReason && (
                        <p className="text-xs text-rose-500 dark:text-rose-400 mt-0.5" title={`Voided by ${invoice.voidedByEmail || 'unknown'}: "${invoice.voidReason}"`}>Voided — {invoice.voidReason}</p>
                    )}
                </div>
                <FinancialStatusBadge status={invoice.status} size="sm" />
            </div>
            <div className="flex justify-between items-end">
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                    <p>Due: {new Date(invoice.dueDate).toLocaleDateString('en-GB')}</p>
                </div>
                <div className="flex items-center gap-2">
                    {!isVoidedRecord && onVoidInvoice && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onVoidInvoice(invoice); }}
                            title="Void (audited) — retires the invoice, keeps the record"
                            className="p-2 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-600"
                        >
                            <Ban className="w-4 h-4 text-rose-500" />
                        </button>
                    )}
                    <p className="text-lg font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(total)}</p>
                </div>
            </div>
        </div>
    );
});


// Sub-component for the main invoice list logic
const InvoicesContent: React.FC<{ invoices: Invoice[], showOriginBadges?: boolean, originEvidence?: { matters: any[]; properties: any[] }, openModal: any, onViewDetails: any, handleUpdateInvoiceStatus: any, handleSendInvoiceReminder: any, handleRevertPayment: any, handleRecordInvoicePayment: any, onRevertPaymentRequest: any, handleVoidInvoice: any, closeModal: any, openConfirmationModal: any }> = ({ invoices, showOriginBadges, originEvidence, openModal, onViewDetails, handleUpdateInvoiceStatus, handleSendInvoiceReminder, handleRevertPayment, handleRecordInvoicePayment, onRevertPaymentRequest, handleVoidInvoice, closeModal, openConfirmationModal }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useHighlight(containerRef, 'billing');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
    const { isProperty } = useProduct();

    // V2 (V-FIN-7/9): mark-paid records a REAL payment through the audited
    // lifecycle (financialIntegrity.recordInvoicePayment) — an amount, a
    // method and an audit-trail entry — instead of a bare status flip. The
    // recorded amount is what is actually outstanding on the invoice, so a
    // partially-paid invoice settles only its remainder.
    const onMarkAsPaid = (id: string) => {
        const invoice = (invoices || []).find((i) => i.id === id);
        const outstanding = invoice ? invoiceOutstanding(invoice as any) : 0;
        openConfirmationModal('deleteConfirmation', id, {
            title: 'Record Full Payment?',
            message: outstanding > 0
                ? `This records a payment of ${formatNaira(outstanding)} against the invoice (bank transfer / cash confirmation) with a permanent audit-trail entry, and marks it Paid.`
                : `This marks the invoice as Paid with a permanent audit-trail entry.`,
            onConfirm: async () => {
                try {
                    await handleRecordInvoicePayment(id, outstanding > 0 ? outstanding : (invoice ? invoiceTotalAmount(invoice as any) : 0), {
                        paymentMethod: 'manual',
                        note: 'Full payment confirmed from Billing list',
                    });
                } catch { /* the hook toasts the failure */ }
                closeModal();
            },
            confirmText: 'Record Payment',
            confirmButtonClass: 'bg-green-600 hover:bg-green-700'
        });
    };

    // V2 (V-FIN-7): the revert is AUDITED and requires a reason — the
    // pre-V2 flow flipped the status to 'Reversed' with zero record (and
    // the detail view's dialog promised a credit note that never existed).
    const onRevert = (id: string) => {
        const invoice = (invoices || []).find((i) => i.id === id);
        if (invoice) onRevertPaymentRequest(invoice);
    };


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
            {/* SIMPLIFY FIX: the invoice tab's own 4 StatCards (Total Outstanding /
                Total Overdue / Total Paid / Total Billed — lineItems-based) were
                removed. The page-level KPI strip directly above (Collected /
                Outstanding / Defaults / Invoices) already covers this, and the two
                "Outstanding" numbers used DIFFERENT formulas (lineItems vs
                total_amount||subTotal) so they regularly disagreed with each other. */}

            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <input autoComplete="off" data-lpignore="true" 
                    type="search"
                    placeholder={`Search by invoice #, client, or ${isProperty ? 'property' : 'matter'}...`}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="w-full md:w-1/3 px-4 py-2 bg-white dark:bg-zinc-700 text-slate-900 dark:text-dim-300 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
                {/* UX-25 (Phase 1): the status filter now has a control. The
                    statusFilter state and the filteredInvoices logic always
                    existed — only the toolbar never rendered anything but
                    search, so Unpaid/Overdue filtering was unreachable.
                    ui/Select (ADR-0004) in 'bare' mode carrying the toolbar's
                    legacy look until Phase 2 consolidates this surface. */}
                <Select
                    id="invoice-status-filter"
                    aria-label="Filter invoices by status"
                    styleVariant="bare"
                    selectClassName="w-full md:w-auto px-4 py-2 bg-white dark:bg-zinc-700 text-slate-900 dark:text-dim-300 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as 'All' | InvoiceStatus)}
                >
                    <option value="All">All statuses</option>
                    {(Object.values(InvoiceStatus) as InvoiceStatus[]).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </Select>
            </div>

            <div className="transition-all duration-300">
                {filteredInvoices.length > 0 ? (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg bg-white dark:bg-zinc-800 shadow-md border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <div className="overflow-x-auto table-wrapper">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-dim-700">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-dim-300 uppercase tracking-wider">Invoice #</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-dim-300 uppercase tracking-wider">Client</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-dim-300 uppercase tracking-wider">Issue Date</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-dim-300 uppercase tracking-wider">Due Date</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-dim-300 uppercase tracking-wider">Amount</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-dim-300 uppercase tracking-wider">Status</th>
                                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-dim-700">
                                        {filteredInvoices.map(invoice => (
                                            <InvoiceRow
                                                key={invoice.id}
                                                invoice={invoice}
                                                origin={showOriginBadges ? invoiceBusinessOrigin(invoice as any, originEvidence) : undefined}
                                                onViewDetails={onViewDetails}
                                                onSendReminder={handleSendInvoiceReminder}
                                                onMarkAsPaid={onMarkAsPaid}
                                                onRevertPayment={onRevert}
                                                onVoidInvoice={handleVoidInvoice}
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
                                    origin={showOriginBadges ? invoiceBusinessOrigin(invoice as any, originEvidence) : undefined}
                                    onViewDetails={onViewDetails}
                                    onVoidInvoice={handleVoidInvoice}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <EmptyState
                        title="No Invoices Found"
                        description="Create an invoice to start billing your clients and tracking payments."
                        icon={<div className="flex items-center justify-center text-slate-400 dark:text-zinc-500"><NairaSymbol /></div>}
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
    const { currentUser } = useAuth();
    const { openModal, navigateTo, closeModal, addToast, currentHistoryEntry } = useUI();
    const { handleUpdateInvoiceStatus, handleSendInvoiceReminder, handleRevertPayment, handleRecordInvoicePayment, handleVoidInvoice: confirmVoidInvoice, handleReinstateInvoice: confirmReinstateInvoice } = useDataActions();
    const features = useFeatures();
    const { isProperty, isUnified, product } = useProduct();
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();

    // Void/Reinstate modal state (accounting-integrity round): the row action
    // opens the reason prompt; confirm dispatches to the audited lifecycle
    // mutation (convex/financialIntegrity), never to a raw status flip.
    const [voidModal, setVoidModal] = useState<{ invoice: Invoice; mode: 'void' | 'reinstate' } | null>(null);
    // V2: the audited payment-revert flow (reason required, part of the trail)
    const [revertModal, setRevertModal] = useState<{ invoice: Invoice } | null>(null);

    // ─── Product scope toggle (Legal / Properties / Combined) ───────
    type ProductScope = 'legal' | 'property' | 'combined';
    const [productScope, setProductScope] = useState<ProductScope>(isUnified ? 'combined' : isProperty ? 'property' : 'legal');

    type FinancialsTab = 'overview' | 'invoices' | 'revenue' | 'payments' | 'vacancies' | 'automations' | 'inbox' | 'reconcile' | 'reports' | 'monitor' | 'trust' | 'maintenance' | 'residents';
    const [activeTab, setActiveTab] = useState<FinancialsTab>(() => {
        const t = currentHistoryEntry.context?.billingTab as FinancialsTab | undefined;
        return t || 'invoices';
    });
    // Unified composer state — opened by ServiceChargeMonitor's per-charge
    // WhatsApp button (MESSAGES OVERHAUL: one compose experience app-wide).
    const [scComposePrefill, setScComposePrefill] = useState<ComposeModalPrefill | undefined>(undefined);
    // SIMPLIFY FIX: deep links can select a specific Financials tab directly
    // (e.g. the dashboard "Outstanding Rent" card opens Service Charges).
    useEffect(() => {
        const t = currentHistoryEntry.context?.billingTab as FinancialsTab | undefined;
        if (t) setActiveTab(t);
    }, [currentHistoryEntry.context?.billingTab]);

    const allTabs: { id: FinancialsTab; label: string; badge?: string; productTag?: 'Legal' | 'Property' }[] = [
        // ROUND F (Wave F1): the unified money console — first tab for property firms.
        { id: 'overview', label: 'Overview', productTag: 'Property' },
        { id: 'invoices', label: 'Invoices & Demands' },
    ];
    if (isProperty || isUnified) {
        allTabs.push(
            { id: 'revenue', label: 'Service Charges', productTag: 'Property' },
            { id: 'payments', label: 'Payments & Receipts', productTag: 'Property' },
            { id: 'vacancies', label: 'Vacancies', productTag: 'Property' },
            { id: 'automations', label: 'Reminder Rules', productTag: 'Property' },
            { id: 'inbox', label: 'Payment Proofs', productTag: 'Property' },
            // ROUND F (Wave F2): the reconciliation workflow — the unallocated
            // queue, match-to-obligation, authorized reversal, checker history.
            { id: 'reconcile', label: 'Reconciliation', productTag: 'Property' },
            // ROUND F (Wave F3): the report suite + CSV export.
            { id: 'reports', label: 'Reports', productTag: 'Property' },
            // ROUND D (D7): the firm-wide maintenance queue — the staff triage
            // surface that never existed (getMaintenanceTicketsByFirm was
            // orphaned; ticket actions only lived inside message threads).
            { id: 'maintenance', label: 'Maintenance', productTag: 'Property' },
            // ROUND E (Wave E2): the resident directory — the tenancy-ledger
            // roster with the consolidated profile per resident.
            { id: 'residents', label: 'Residents', productTag: 'Property' },
        );
    }
    if (features.canUseRetainerAutoBilling) {
        allTabs.push({ id: 'monitor', label: 'Billing Monitor', productTag: 'Legal' });
    }
    if (coreState.firmDetails?.trustAccountingEnabled) {
        allTabs.push({ id: 'trust', label: 'Trust Account', productTag: 'Legal' });
    }

    const tabs = useMemo(() => {
        if (productScope === 'combined') return allTabs;
        if (productScope === 'legal') return allTabs.filter(t => !t.productTag || t.productTag === 'Legal');
        if (productScope === 'property') return allTabs.filter(t => !t.productTag || t.productTag === 'Property');
        return allTabs;
    }, [productScope, isProperty, isUnified, features.canUseRetainerAutoBilling, coreState.firmDetails?.trustAccountingEnabled]);

    useEffect(() => {
        if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
            setActiveTab('invoices');
        }
    }, [tabs, activeTab]);

    // K-4 (invoice product attribution): the evidence the legacy-row
    // classifier needs (matters for the realEstate link, properties for
    // the property pseudo-matter convention).
    const originEvidence = useMemo(() => ({
        matters: matterState.matters || [],
        properties: coreState.properties || [],
    }), [matterState.matters, coreState.properties]);

    // KPI strip — unified metrics across legal + property
    // FINANCIAL LIFECYCLE (accounting-integrity round): voided and
    // test-marked records are annotations, not money — they never enter a
    // total. Same predicate as the server queries (equivalence-tested).
    // K-4: every invoice figure is now ORIGIN-SCOPED — legal KPIs count
    // legal-origin invoices only; property KPIs include the
    // property-origin invoices (management fees) alongside the rent
    // ledger. No row is counted on both sides: origins partition the set.
    const kpiData = useMemo(() => {
        const invoices = (financeState.invoices || []).filter(i => isActiveFinancialRecord(i.recordStatus));
        const { legal: legalInvoices, property: propertyInvoices } = partitionInvoicesByOrigin(invoices as any, originEvidence);
        const ledgerEntries = ((coreState as any).ledgerEntries || []).filter((e: any) => isActiveFinancialRecord(e.recordStatus));
        const serviceCharges = (coreState as any).serviceCharges || [];

        // Legal-side KPIs (legal-origin invoices) — V2 (V-FIN-10): the ONE contract.
        //    The pre-V2 formulas drifted: `total_amount || subTotal` turned a
        //    true ₦0 total into subTotal, partially-paid invoices vanished
        //    from Outstanding entirely, and line-item sums elsewhere ignored
        //    VAT. Every surface now derives from the same helpers the
        //    server uses (equivalence-tested against convex/invoiceFinancials).
        const legalSummary = computeClientFinancialSummary(legalInvoices as any);
        const paidThisMonth = legalInvoices.filter(i => {
            if (i.status !== InvoiceStatus.Paid || !i.paidDate) return false;
            const d = new Date(i.paidDate);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, i) => s + invoiceTotalAmount(i as any), 0);

        const outstanding = legalSummary.outstandingBalance;

        // Property-side KPIs (ledger + service charges + property-origin
        // invoices — management fees are property revenue, not legal).
        const propertyCollected = ledgerEntries
            .filter((e: any) => e.status === 'cleared')
            .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        const propertyLedgerOutstanding = ledgerEntries
            .filter((e: any) => e.status === 'pending')
            .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        const propertyInvoiceOutstanding = computeClientFinancialSummary(propertyInvoices as any).outstandingBalance;

        const criticalDefaulters = serviceCharges.filter((d: any) => d.isDefaulter && (d.daysOverdue ?? 0) > 14).length;

        // ─── Filter KPIs by product scope ───────────────────────────
        // Legal: legal-origin invoice numbers only
        // Property: ledger + service-charge + property-origin invoice numbers
        // Combined: the sum of both (each money row counted exactly once —
        // origins partition the invoices, the ledger is property-only)
        if (productScope === 'legal') {
            return {
                collected: paidThisMonth,
                outstanding,
                defaults: 0,
                invoiceCount: legalInvoices.length,
            };
        } else if (productScope === 'property') {
            return {
                collected: propertyCollected,
                outstanding: propertyLedgerOutstanding + propertyInvoiceOutstanding,
                defaults: criticalDefaulters,
                invoiceCount: propertyInvoices.length,
            };
        }
        // Combined (default)
        return {
            collected: paidThisMonth + propertyCollected,
            outstanding: outstanding + propertyLedgerOutstanding + propertyInvoiceOutstanding,
            defaults: criticalDefaulters,
            invoiceCount: legalInvoices.length + propertyInvoices.length,
        };
    }, [financeState.invoices, (coreState as any).ledgerEntries, (coreState as any).serviceCharges, productScope, originEvidence]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-2.5 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-2">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financials</h2>
                    <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {productScope === 'legal' ? 'Legal billing & invoices'
                         : productScope === 'property' ? 'Property revenue & billing'
                         : isUnified ? 'Unified revenue & billing — Legal + Property'
                         : isProperty ? 'Property revenue & billing'
                         : 'Legal billing & invoices'}
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {isUnified && (
                        <div className="flex bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-slate-200 dark:border-zinc-700">
                            {(['legal', 'property', 'combined'] as ProductScope[]).map((scope) => (
                                <button
                                    key={scope}
                                    onClick={() => setProductScope(scope)}
                                    className={`px-2.5 sm:px-3 py-1.5 rounded-md text-2xs sm:text-xs font-bold transition-all ${
                                        productScope === scope
                                            ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                                    }`}
                                    title={scope === 'legal' ? 'Show legal tabs only' : scope === 'property' ? 'Show property tabs only' : 'Show all tabs'}
                                >
                                    {scope === 'legal' ? 'Legal' : scope === 'property' ? 'Properties' : 'Combined'}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => openModal('newInvoice')}
                        className="p-1 px-3 sm:p-2 sm:px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm flex items-center gap-2 text-2xs sm:text-xs font-bold uppercase tracking-wider"
                    >
                        <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4" /> New
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">
                {/* KPI Strip — unified across legal + property */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800/30 shadow-sm">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Collected</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatNaira(kpiData.collected)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-800/30 shadow-sm">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Outstanding</p>
                        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatNaira(kpiData.outstanding)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-800/30 shadow-sm">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Defaults</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-400">{kpiData.defaults}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Invoices</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{kpiData.invoiceCount}</p>
                    </div>
                </div>

                {/* Tab Bar — matches the Analytics page pattern */}
                <div className="mb-6 border-b border-slate-200 dark:border-zinc-700">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-shrink-0 whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
                                }`}
                            >
                                {tab.label}
                                {tab.productTag && productScope === 'combined' && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${
                                        tab.productTag === 'Legal'
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    }`}>
                                        {tab.productTag}
                                    </span>
                                )}
                                {tab.id === 'monitor' && (
                                    <span className="px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                        Premium
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <FinancialOverview firmId={coreState.firmDetails?.id || currentUser?.firmId || ''} />
                )}
                {activeTab === 'invoices' && (
                    <InvoicesContent
                        // K-4: the invoice LIST is now origin-scoped like the
                        // tabs — legal scope shows legal-origin invoices,
                        // property scope shows property-origin invoices
                        // (management fees), combined shows both with an
                        // origin badge on each row. The old list was never
                        // filtered, so the Legal toggle still showed the
                        // landlord's property invoices (and vice versa).
                        invoices={(() => {
                            const active: Invoice[] = (financeState.invoices || []).filter(i => isActiveFinancialRecord(i.recordStatus));
                            if (productScope === 'combined') return active;
                            const { legal, property } = partitionInvoicesByOrigin(active, originEvidence);
                            return productScope === 'legal' ? legal : property;
                        })()}
                        showOriginBadges={isUnified}
                        originEvidence={originEvidence}
                        openModal={openModal}
                        onViewDetails={(id: string) => navigateTo('invoiceDetail', id)}
                        handleUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                        handleSendInvoiceReminder={handleSendInvoiceReminder}
                        handleRevertPayment={handleRevertPayment}
                        handleRecordInvoicePayment={handleRecordInvoicePayment}
                        onRevertPaymentRequest={(inv: Invoice) => setRevertModal({ invoice: inv })}
                        handleVoidInvoice={(inv: Invoice) => setVoidModal({ invoice: inv, mode: inv.recordStatus === 'voided' || inv.status === InvoiceStatus.Void ? 'reinstate' : 'void' })}
                        closeModal={closeModal}
                        openConfirmationModal={openModal}
                    />
                )}

                {activeTab === 'revenue' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <ServiceChargeMonitor onComposeCharge={(p) => setScComposePrefill(p)} />
                    </div>
                )}

                {activeTab === 'payments' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <LedgerManager />
                    </div>
                )}

                {activeTab === 'reconcile' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <ReconciliationConsole firmId={coreState.firmDetails?.id || currentUser?.firmId || ''} />
                )}
                {activeTab === 'reports' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <FinancialReportsConsole firmId={coreState.firmDetails?.id || currentUser?.firmId || ''} />
                )}
                {activeTab === 'vacancies' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <VacancyPipeline />
                    </div>
                )}

                {activeTab === 'automations' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <AutomationCenter />
                    </div>
                )}

                {activeTab === 'inbox' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <PaymentProofsScreen />
                    </div>
                )}

                {/* ROUND D (D7): the firm-wide maintenance queue. */}
                {activeTab === 'maintenance' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <MaintenanceQueue />
                    </div>
                )}

                {/* ROUND E (Wave E2): the firm-wide resident directory. */}
                {activeTab === 'residents' && (isProperty || isUnified) && productScope !== 'legal' && (
                    <div className="min-h-[500px]">
                        <ResidentDirectory />
                    </div>
                )}

                {activeTab === 'monitor' && productScope !== 'property' && <BillingMonitorView />}

                {/* MESSAGES OVERHAUL: the ONE unified composer, hosted here for
                    the Service Charges tab's per-charge WhatsApp button. */}
                {scComposePrefill && (
                    <ComposeModal
                        firmId={coreState.firmDetails?.id || currentUser?.firmId || ''}
                        prefill={scComposePrefill}
                        onClose={() => setScComposePrefill(undefined)}
                        onToast={(msg) => addToast(msg, { type: /error|failed/i.test(msg) ? 'error' : 'success' })}
                    />
                )}

                {activeTab === 'trust' && coreState.firmDetails?.trustAccountingEnabled && productScope !== 'property' && (
                    <div className="max-w-3xl mx-auto">
                        <TrustAccountTab />
                    </div>
                )}

                {/* Audited void / reinstate (accounting-integrity round) — the
                    reason entered here becomes part of the financial audit log. */}
                {voidModal && (
                    <VoidInvoiceModal
                        invoice={voidModal.invoice}
                        mode={voidModal.mode}
                        onClose={() => setVoidModal(null)}
                        onConfirm={(id, reason) => {
                            if (voidModal.mode === 'void') confirmVoidInvoice(id, reason);
                            else confirmReinstateInvoice(id, reason);
                        }}
                    />
                )}
                {revertModal && (
                    <VoidInvoiceModal
                        invoice={revertModal.invoice}
                        mode="revert"
                        onClose={() => setRevertModal(null)}
                        onConfirm={async (id, reason) => {
                            await handleRevertPayment(id, reason);
                            setRevertModal(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

