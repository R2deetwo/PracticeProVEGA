
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useConvex } from 'convex/react';
import { InvoiceStatus, InvoiceStatus as Status, AppState } from '../types';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { computeInvoiceTotals, normalizeTaxRate, invoiceOutstanding } from '../utils/invoiceFinancials';
import { api } from '../../convex/_generated/api';

/**
 * Hook for managing financial operations: Invoices, Ledgers, and Service Charges.
 */
export const useFinance = (appState: AppState, actions: any) => {
    const { currentUser, bearerToken } = useAuth();
    const { addToast } = useUI();
    const { isAtrium } = useProduct();
    const convex = useConvex();

    /**
     * Generate a new invoice from matter data.
     */
    const handleGenerateInvoice = useCallback(async (matter: any, items: any[], details: any, timeIds: string[], expenseIds: string[], payment: any, tax: any) => {
        if (!matter) throw new Error("Matter is required for invoice generation.");
        
        const clientName = appState.contacts.find(c => c.id === matter.clientId)?.name || 'Unknown Client';

        // ─── V2 TAX CONTRACT (V-FIN-2/V-FIN-15): one explicit contract.
        //    `tax` now carries { applicable, ratePct } from the generating
        //    form (rate as a PERCENTAGE). The pre-V2 code required
        //    `tax.applicable`, which the form never sent — VAT was silently
        //    zero on every generated invoice. These figures are display /
        //    intent hints only: the SERVER recomputes every total inside
        //    createItem (invoiceFence) — the client can no longer publish
        //    authoritative money values.
        const taxApplicable = tax?.applicable === true;
        const taxRatePct = normalizeTaxRate(tax?.ratePct ?? appState.firmDetails?.taxSettings?.vatRate);
        const totals = computeInvoiceTotals(items || [], { applicable: taxApplicable, ratePct: taxRatePct });

        // ─── V2 NUMBERING (V-FIN-6): the invoice number is issued
        //    SERVER-SIDE (atomic per-firm sequence) — the client-side
        //    count-based generator collided under concurrent creation and
        //    is no longer used here.

        const invoice: any = {
            id: uuidv4(),
            firmId: currentUser?.firmId,
            client: { id: matter.clientId || 'unknown', name: clientName },
            matter: { id: matter.id || 'general', title: matter.title || 'General Management' },
            lineItems: items || [],
            status: details?.status || InvoiceStatus.Sent,
            issueDate: details?.issueDate || new Date().toISOString(),
            dueDate: details?.dueDate || new Date().toISOString(),
            paymentDetails: payment || appState.firmDetails?.bankAccounts?.[0] || { bankName: 'Default', accountNumber: '0000000000' },
            subTotal: totals.subTotal,
            taxAmount: totals.taxAmount,
            total_amount: totals.total_amount,
            taxApplicable: totals.taxApplicable,
            taxRate: totals.taxRate,
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
     * Revert a recorded payment — the AUDITED undo (V2, V-FIN-7).
     *
     * The pre-V2 revert claimed it would "create a credit note" and "mark
     * time/expenses as unbilled" while actually performing a bare status
     * flip to 'Reversed' — two promises that were never implemented. The
     * truth: this records that the payment(s) on this invoice should not
     * have been recorded. It requires a reason, clears amountPaid and
     * paidDate together, restores the open state, and writes the full
     * before/after into the append-only financial_audit_log.
     */
    const handleRevertPayment = useCallback(async (id: string, reason: string) => {
        const clean = reason.trim();
        if (clean.length < 3) {
            addToast('A reason is required to revert a payment — it becomes part of the audit trail.', { type: 'warning' });
            return;
        }
        try {
            await convex.mutation(api.financialIntegrity.revertInvoicePayment, {
                invoiceId: id,
                reason: clean,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            });
            addToast('Payment reverted — the invoice is open again and the reversal is recorded in the audit log.', { type: 'success', duration: 6000 });
        } catch (e: any) {
            addToast(e?.message || 'Failed to revert the payment. Nothing was changed.', { type: 'error', duration: 7000 });
        }
    }, [convex, currentUser, bearerToken, addToast]);

    /**
     * Record a payment against an invoice — the audited way money lands
     * (V2, V-FIN-9). Handles full AND partial payments: a partial amount
     * transitions the invoice to 'Partially Paid' with the true remainder
     * visible everywhere; the full amount stamps Paid + paidDate. Every
     * recording lands in the financial audit log.
     */
    const handleRecordInvoicePayment = useCallback(async (id: string, amount: number, opts?: { paymentMethod?: string; reference?: string; note?: string; paymentDate?: string }) => {
        try {
            const result = await convex.mutation(api.financialIntegrity.recordInvoicePayment, {
                invoiceId: id,
                amount,
                paymentMethod: opts?.paymentMethod,
                reference: opts?.reference,
                note: opts?.note,
                paymentDate: opts?.paymentDate,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            });
            addToast(
                result?.status === 'Paid'
                    ? `Payment recorded — invoice fully settled (₦${Number(result?.amountPaid || 0).toLocaleString('en-NG')} total).`
                    : `Partial payment recorded — ₦${Number(result?.outstanding || 0).toLocaleString('en-NG')} still outstanding.`,
                { type: 'success', duration: 6000 },
            );
            return result;
        } catch (e: any) {
            addToast(e?.message || 'Failed to record the payment. Nothing was changed.', { type: 'error', duration: 7000 });
            throw e;
        }
    }, [convex, currentUser, bearerToken, addToast]);

    /**
     * VOID an invoice through the audited financial lifecycle
     * (convex/financialIntegrity.voidInvoice) — the accounting-correct
     * retirement: the record stays in the books with its WHO/WHEN/WHY
     * (reason is mandatory) and drops out of every total. This replaces
     * deletion as the way to retire a booked invoice.
     */
    const handleVoidInvoice = useCallback(async (id: string, reason: string) => {
        const clean = reason.trim();
        if (clean.length < 3) {
            addToast('A reason is required to void an invoice — it becomes part of the audit trail.', { type: 'warning' });
            return;
        }
        try {
            await convex.mutation(api.financialIntegrity.voidInvoice, {
                invoiceId: id,
                reason: clean,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            });
            addToast('Invoice voided — kept in the books for the audit trail, excluded from all totals.', { type: 'success', duration: 6000 });
        } catch (e: any) {
            addToast(e?.message || 'Failed to void the invoice. Nothing was changed.', { type: 'error', duration: 7000 });
        }
    }, [convex, currentUser, bearerToken, addToast]);

    /**
     * Reinstate a voided invoice (audited, restores the pre-void status).
     */
    const handleReinstateInvoice = useCallback(async (id: string, reason: string) => {
        const clean = reason.trim();
        if (clean.length < 3) {
            addToast('A reason is required to reinstate an invoice — it becomes part of the audit trail.', { type: 'warning' });
            return;
        }
        try {
            await convex.mutation(api.financialIntegrity.reinstateInvoice, {
                invoiceId: id,
                reason: clean,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            });
            addToast('Invoice reinstated to its prior status.', { type: 'success' });
        } catch (e: any) {
            addToast(e?.message || 'Failed to reinstate the invoice. Nothing was changed.', { type: 'error', duration: 7000 });
        }
    }, [convex, currentUser, bearerToken, addToast]);

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
                sessionToken: (bearerToken ?? undefined),
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
        handleUpdateInvoiceStatus,
        handleRevertPayment,
        handleRecordInvoicePayment,
        handleVoidInvoice,
        handleReinstateInvoice,
        handleSendInvoiceReminder,
        handleDeleteInvoice,
    };
};
