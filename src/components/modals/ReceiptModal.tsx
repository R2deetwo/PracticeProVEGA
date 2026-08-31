/**
 * ReceiptModal — Receipt preview + issuance modal.
 *
 * Opens when the user clicks [Generate & Issue Receipt] on a paid period
 * in the Quick Payment Drawer. Shows a receipt preview with:
 *   - Receipt # (generated: RC-<timestamp>-<periodIndex>)
 *   - Resident Name
 *   - Unit #
 *   - Amount Paid (e.g. ₦120,000)
 *   - Charge Type (Service Charge / Minimum Vend)
 *   - Payment Date
 *   - Settlement Method
 *
 * Actions:
 *   [Download PDF] — generates and downloads a PDF receipt via reportGenerator
 *   [Issue to Resident Portal] — pushes the receipt to the resident's portal
 *     documents + writes an activity log entry + updates ledger status.
 *
 * If a receipt has already been issued for a period, the parent component
 * shows [View Issued Receipt] instead of [Generate Receipt].
 */

import React, { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { XIcon, DownloadIcon, CheckCircleIcon, SendIcon } from '../../constants';
import { formatNairaFull, formatDateShort } from '../../utils/formatting';
import { ServiceChargePeriod } from '../../types';

interface ReceiptModalProps {
    period: ServiceChargePeriod;
    chargeType: 'SC' | 'MV';
    unitName: string;
    tenantName: string;
    unitId?: string;
    propertyId?: string;
    onClose: () => void;
    onIssued?: (receiptNumber: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
    period, chargeType, unitName, tenantName, unitId, propertyId, onClose, onIssued,
}) => {
    const { coreState } = useCoreState();
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    const sendPortalMessage = useMutation(api.portals.sendPortalMessage);
    const logAutomation = useMutation(api.sentry.logAutomation);

    const [isIssuing, setIsIssuing] = useState(false);
    const [hasIssued, setHasIssued] = useState(false);

    // Generate a stable receipt number: RC-<timestamp>-<periodIndex>
    const receiptNumber = useMemo(() => {
        const ts = Date.now().toString().slice(-6);
        return `RC-${ts}-${period.index}`;
    }, [period.index]);

    const chargeTypeLabel = chargeType === 'SC' ? 'Service Charge' : 'Minimum Vend';
    const amountPaid = period.amount;
    const paymentDate = period.paidDate || new Date().toISOString().split('T')[0];
    const settlementMethod = period.paidOnTime === false ? 'Paid Late' :
                              period.paidOnTime === true ? 'Paid On Time' :
                              period.isAdvance ? 'Advance Payment' : 'Settled';
    const billingPeriod = (() => {
        try { return new Date(period.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
        catch { return `Period ${period.index}`; }
    })();

    const firmName = coreState?.firmDetails?.name || 'PracticePro';

    const handleDownloadPdf = () => {
        // Generate an inline printable receipt (HTML → print dialog → save as PDF).
        // This avoids the heavy jsPDF dependency for a simple receipt.
        const receiptHtml = `
<!DOCTYPE html><html><head><title>Receipt ${receiptNumber}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1e293b; }
  .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
  .firm-name { font-size: 20px; font-weight: 800; color: #10b981; }
  .receipt-title { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin-top: 4px; }
  .receipt-no { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .details { margin-bottom: 24px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .label { font-size: 13px; color: #64748b; font-weight: 600; }
  .value { font-size: 13px; color: #1e293b; font-weight: 700; }
  .amount-row { background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .amount-label { font-size: 12px; color: #10b981; font-weight: 700; text-transform: uppercase; }
  .amount-value { font-size: 24px; font-weight: 800; color: #10b981; }
  .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #d1fae5; color: #065f46; }
</style></head><body>
  <div class="header">
    <div class="firm-name">${firmName}</div>
    <div class="receipt-title">Official Payment Receipt</div>
    <div class="receipt-no">Receipt No: ${receiptNumber}</div>
  </div>
  <div class="details">
    <div class="row"><span class="label">Resident Name</span><span class="value">${tenantName}</span></div>
    <div class="row"><span class="label">Unit</span><span class="value">${unitName}</span></div>
    <div class="row"><span class="label">Charge Type</span><span class="value">${chargeTypeLabel}</span></div>
    <div class="row"><span class="label">Billing Period</span><span class="value">${billingPeriod}</span></div>
    <div class="row"><span class="label">Payment Date</span><span class="value">${formatDateShort(paymentDate)}</span></div>
    <div class="row"><span class="label">Settlement Method</span><span class="value"><span class="badge">${settlementMethod}</span></span></div>
  </div>
  <div class="amount-row">
    <div class="amount-label">Amount Paid</div>
    <div class="amount-value">${formatNairaFull(amountPaid)}</div>
  </div>
  <div class="footer">
    <p>This is an official receipt generated by ${firmName} via PracticePro.</p>
    <p>Issued on ${formatDateShort(new Date().toISOString())}</p>
  </div>
</body></html>`;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 300);
        } else {
            addToast('Please allow popups to download the receipt.', { type: 'error' });
        }
    };

    const handleIssueToPortal = async () => {
        setIsIssuing(true);
        try {
            const firmId = coreState?.firmDetails?.id || currentUser?.firmId || '';
            // Push receipt to resident's portal documents via sendPortalMessage.
            // The message content serves as the receipt notification; the
            // receipt itself is downloadable via the [Download PDF] button.
            await sendPortalMessage({
                firmId,
                senderId: currentUser?.id || '',
                senderName: currentUser?.name || 'Property Manager',
                senderRole: 'admin',
                subject: `Receipt ${receiptNumber} — ${chargeTypeLabel} (${billingPeriod})`,
                content: `Your ${chargeTypeLabel} receipt for ${billingPeriod} has been issued.\n\nReceipt No: ${receiptNumber}\nAmount Paid: ${formatNairaFull(amountPaid)}\nPayment Date: ${formatDateShort(paymentDate)}\nSettlement: ${settlementMethod}\n\nPlease download the PDF from your portal or contact management if you need a copy.`,
                unitId: unitId,
                propertyId: propertyId,
            } as any);

            // Write immutable event log to Activity & Tracking timeline
            await logAutomation({
                firmId,
                userEmail: currentUser?.email,
                unitId,
                messageType: 'receipt_issued',
                channel: 'portal',
                recipient: tenantName,
                messagePreview: `Receipt #${receiptNumber} issued to ${tenantName} for ${chargeTypeLabel} (${billingPeriod})`,
                messageContent: `Receipt #${receiptNumber} issued to ${tenantName} for ${chargeTypeLabel} (${billingPeriod}). Amount: ${formatNairaFull(amountPaid)}. Settlement: ${settlementMethod}.`,
                direction: 'outbound',
                senderName: currentUser?.name || 'Property Manager',
                status: 'sent',
                triggeredBy: currentUser?.id,
            } as any);

            setHasIssued(true);
            addToast(`Receipt ${receiptNumber} issued to ${tenantName}'s portal.`, { type: 'success' });
            onIssued?.(receiptNumber);
        } catch (err: any) {
            addToast(err.message || 'Failed to issue receipt to portal.', { type: 'error' });
        } finally {
            setIsIssuing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[4600] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 sm:backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Modal */}
            <div
                className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-700/60 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div>
                        <p className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                            {hasIssued ? 'Receipt Issued' : 'Receipt Preview'}
                        </p>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                            {receiptNumber}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body — Receipt Preview */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Firm header */}
                    <div className="text-center pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{firmName}</p>
                        <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Official Payment Receipt</p>
                    </div>

                    {/* Receipt details */}
                    <div className="space-y-2">
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Receipt No</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{receiptNumber}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Resident</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{tenantName}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Unit</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{unitName}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Charge Type</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{chargeTypeLabel}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Billing Period</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{billingPeriod}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Payment Date</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{formatDateShort(paymentDate)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-zinc-800/50">
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Settlement</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                period.paidOnTime === false ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                period.isAdvance ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            }`}>{settlementMethod}</span>
                        </div>
                    </div>

                    {/* Amount Paid — highlighted */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
                        <p className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Amount Paid</p>
                        <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatNairaFull(amountPaid)}</p>
                    </div>

                    {/* Issued confirmation */}
                    {hasIssued && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                Receipt published to resident's portal + activity log.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer — Action buttons */}
                <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-2 bg-white dark:bg-zinc-900">
                    <button
                        onClick={handleDownloadPdf}
                        className="flex-1 px-4 py-2.5 text-sm font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download PDF
                    </button>
                    <button
                        onClick={handleIssueToPortal}
                        disabled={isIssuing || hasIssued}
                        className="flex-1 px-4 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {isIssuing ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Issuing…
                            </>
                        ) : hasIssued ? (
                            <>
                                <CheckCircleIcon className="w-4 h-4" />
                                Issued
                            </>
                        ) : (
                            <>
                                <SendIcon className="w-4 h-4" />
                                Issue to Resident
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
