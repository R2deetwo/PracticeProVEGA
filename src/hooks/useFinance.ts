
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useConvex } from 'convex/react';
import { InvoiceStatus, InvoiceStatus as Status, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { generateInvoiceNumber } from '../utils/invoiceHelpers';
import { api } from '../../convex/_generated/api';

/**
 * Hook for managing financial operations: Invoices, Ledgers, and Service Charges.
 */
export const useFinance = (appState: AppState, actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    const { isAtrium } = useProduct();
    const convex = useConvex();

    /**
     * Generate a new invoice from matter data.
     */
    const handleGenerateInvoice = useCallback(async (matter: any, items: any[], details: any, timeIds: string[], expenseIds: string[], payment: any, tax: any) => {
        if (!matter) throw new Error("Matter is required for invoice generation.");
        
        const clientName = appState.contacts.find(c => c.id === matter.clientId)?.name || 'Unknown Client';
        const subTotal = (items || []).reduce((sum, item) => sum + (item.total || 0), 0);
        const taxRate = tax?.rate || appState.firmDetails?.taxSettings?.vatRate || 7.5;
        const taxAmount = tax?.applicable ? (subTotal * taxRate / 100) : 0;

        // Generate dynamic firm-branded invoice number (computed once, persisted as string)
        const invoiceNumber = generateInvoiceNumber({
            firmName: appState.firmDetails?.name,
            users: appState.users || [],
            existingInvoiceCount: (appState.invoices || []).length,
        });

        const invoice: any = {
            id: uuidv4(),
            firmId: currentUser?.firmId,
            invoiceNumber,
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
     * FIX: when an invoice transitions to Paid, also stamp `paidDate`.
     * Previously only `status` was written, so the "Collected (This Month)"
     * KPI (which filters on i.paidDate) stayed ₦0 forever and receipts
     * rendered "Payment Date: N/A" even for invoices the firm had marked paid.
     */
    const handleUpdateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
        const patch: any = { id, status };
        if (status === InvoiceStatus.Paid) {
            // Only stamp when not already paid (avoid overwriting a real paidDate
            // when toggling e.g. Partially Paid → Paid after a partial payment date).
            const existing = appState.invoices?.find((i: any) => i.id === id);
            if (!existing?.paidDate) patch.paidDate = new Date().toISOString();
        }
        if (status === InvoiceStatus.Reversed || status === InvoiceStatus.Overdue) {
            patch.paidDate = undefined;
        }
        await actions.updateItem('invoices', patch, 'Invoice Status');
    }, [actions, appState.invoices]);

    /**
     * Revert a paid invoice (create credit note / mark as Reversed).
     */
    const handleRevertPayment = useCallback(async (id: string) => {
        await actions.updateItem('invoices', { id, status: InvoiceStatus.Reversed, paidDate: undefined }, 'Invoice');
        addToast('Invoice payment reverted.', { type: 'info' });
    }, [actions, addToast]);

    /**
     * Send a payment reminder for an invoice.
     * FIX: previously a stub that only toasted "not sent — email integration
     * not configured", even though communications.sendEmail is live (Brevo).
     * Now it resolves the client's email and sends a real reminder; if no
     * email is on file it says so honestly instead of pretending to fail.
     */
    const handleSendInvoiceReminder = useCallback(async (id: string) => {
        const invoice = appState.invoices?.find((i: any) => i.id === id);
        const clientName = invoice?.client?.name || 'the client';
        const clientContact = appState.contacts?.find((c: any) => c.id === invoice?.client?.id);
        const clientEmail = (clientContact as any)?.email;
        const invoiceNumber = invoice?.invoiceNumber || id;
        const amount = invoice?.total_amount ?? (invoice?.subTotal || 0) + (invoice?.taxAmount || 0);
        const dueDate = invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the due date';

        if (!clientEmail) {
            addToast(`No email on file for ${clientName} — add one on their contact card, or use WhatsApp from the messaging view.`, { type: 'warning' });
            return;
        }

        addToast(`Sending payment reminder to ${clientEmail}...`, { type: 'info' });
        try {
            if (!convex) throw new Error('Backend client unavailable.');
            const result = await convex.action(api.communications.sendEmail, {
                to: clientEmail,
                subject: `Payment Reminder — Invoice ${invoiceNumber}`,
                htmlContent: `<p>Dear ${clientName},</p><p>This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for <strong>₦${Number(amount || 0).toLocaleString('en-NG')}</strong> was due on ${dueDate}.</p><p>Please arrange payment at your earliest convenience. If you have already made payment, kindly disregard this notice.</p><p>Thank you for your business.</p>`,
                firmId: currentUser?.firmId || '',
                recordLog: true,
            });
            if (result?.success) {
                addToast(`Payment reminder sent to ${clientName} (${clientEmail}).`, { type: 'success' });
            } else {
                addToast(`Reminder failed: ${result?.error || 'email provider error'} — you can also message the client via WhatsApp.`, { type: 'warning' });
            }
        } catch (e: any) {
            addToast(e?.message || 'Failed to send reminder.', { type: 'error' });
        }
    }, [appState.invoices, appState.contacts, currentUser, convex, addToast]);

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
