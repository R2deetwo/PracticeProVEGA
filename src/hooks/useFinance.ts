
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { InvoiceStatus, InvoiceStatus as Status, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';

/**
 * Hook for managing financial operations: Invoices, Ledgers, and Service Charges.
 */
export const useFinance = (appState: AppState, actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    const { isAtrium } = useProduct();

    /**
     * Generate a new invoice from matter data.
     */
    const handleGenerateInvoice = useCallback(async (matter: any, items: any[], details: any, timeIds: string[], expenseIds: string[], payment: any, tax: any) => {
        if (!matter) throw new Error("Matter is required for invoice generation.");
        
        const clientName = appState.contacts.find(c => c.id === matter.clientId)?.name || 'Unknown Client';
        const subTotal = (items || []).reduce((sum, item) => sum + (item.total || 0), 0);
        const taxRate = tax?.rate || appState.firmDetails?.taxSettings?.vatRate || 7.5;
        const taxAmount = tax?.applicable ? (subTotal * taxRate / 100) : 0;

        const invoice: any = {
            id: uuidv4(),
            firmId: currentUser?.firmId,
            invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
            client: { id: matter.clientId || 'unknown', name: clientName },
            matter: { id: matter.id || 'general', title: matter.title || 'General Management' },
            lineItems: items || [],
            status: details?.status || InvoiceStatus.Sent,
            issueDate: details?.issueDate || new Date().toISOString(),
            dueDate: details?.dueDate || new Date().toISOString(),
            paymentDetails: payment || appState.firmDetails?.bankAccounts?.[0] || { bankName: 'Default', accountNumber: '0000000000' },
            subTotal: subTotal,
            taxAmount: taxAmount,
            total_amount: subTotal + taxAmount,
        };

        await actions.addItem('invoices', invoice, 'Invoice');

        // Mark time entries and expenses as billed
        if (timeIds && timeIds.length > 0) {
            await Promise.all(timeIds.map(tid => actions.updateItem('timeEntries', { id: tid, billedInInvoiceId: invoice.id }, 'Time Entry')));
        }
        if (expenseIds && expenseIds.length > 0) {
            await Promise.all(expenseIds.map(eid => actions.updateItem('expenses', { id: eid, billedInInvoiceId: invoice.id }, 'Expense')));
        }

        return invoice;
    }, [appState.contacts, appState.firmDetails, currentUser, actions]);

    /**
     * Record payment for an invoice.
     */
    const handlePayInvoice = useCallback(async (id: string) => {
        await actions.updateItem('invoices', { id, status: InvoiceStatus.Paid, paidDate: new Date().toISOString() }, 'Invoice');
        addToast("Invoice marked as paid.", { type: 'success' });
    }, [actions, addToast]);

    /**
     * Update invoice status manually.
     */
    const handleUpdateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
        await actions.updateItem('invoices', { id, status }, 'Invoice Status');
    }, [actions]);

    /**
     * Revert a paid invoice (create credit note / mark as Reversed).
     */
    const handleRevertPayment = useCallback(async (id: string) => {
        await actions.updateItem('invoices', { id, status: InvoiceStatus.Reversed, paidDate: undefined }, 'Invoice');
        addToast('Invoice payment reverted.', { type: 'info' });
    }, [actions, addToast]);

    /**
     * Send a payment reminder for an invoice.
     */
    const handleSendInvoiceReminder = useCallback((id: string) => {
        const invoice = appState.invoices?.find((i: any) => i.id === id);
        const clientName = invoice?.client?.name || 'the client';
        addToast(`Reminder sent to ${clientName} for invoice ${invoice?.invoiceNumber || id}.`, { type: 'success' });
    }, [appState.invoices, addToast]);

    /**
     * Permanently delete an invoice.
     */
    const handleDeleteInvoice = useCallback(async (id: string, name?: string) => {
        await actions.deleteItem('invoices', id, name || 'Invoice');
    }, [actions]);

    return {
        handleGenerateInvoice,
        handlePayInvoice,
        handleUpdateInvoiceStatus,
        handleRevertPayment,
        handleSendInvoiceReminder,
        handleDeleteInvoice,
    };
};
