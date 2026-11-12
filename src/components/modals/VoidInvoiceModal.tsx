import React, { useState } from 'react';
import { Ban, Undo2 } from 'lucide-react';
import type { Invoice } from '../../types';

// ── Void / Reinstate Invoice Modal (accounting-integrity round) ──────────
// The audited retirement path: a reason is REQUIRED and becomes part of the
// financial_audit_log. Replaces deletion as the way to retire a booked
// invoice — the record stays for forensics, excluded from all totals.
// UX-22: EXPORTED — the invoice DETAIL view renders the same audited
// retirement path instead of its own raw permanent Delete (the two
// retirement paths had diverged; the detail page could punch a hole in
// the audit trail the list view promises).
export const VoidInvoiceModal: React.FC<{
    invoice: Invoice;
    mode: 'void' | 'reinstate' | 'revert';
    onClose: () => void;
    onConfirm: (id: string, reason: string) => void;
}> = ({ invoice, mode, onClose, onConfirm }) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const isVoid = mode === 'void';
    const isRevert = mode === 'revert';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    {isVoid
                        ? <><Ban className="w-5 h-5 text-rose-500" /> Void invoice {invoice.invoiceNumber}?</>
                        : isRevert
                            ? <><Undo2 className="w-5 h-5 text-amber-500" /> Revert payment on {invoice.invoiceNumber}?</>
                            : <><Undo2 className="w-5 h-5 text-emerald-500" /> Reinstate invoice {invoice.invoiceNumber}?</>}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
                    {isVoid
                        ? 'Voiding keeps the invoice in the books for the audit trail but excludes it from every total (collected, outstanding, counts). This is the accounting-correct way to retire a booked invoice — nothing is deleted.'
                        : isRevert
                            ? 'Records that the payment(s) on this invoice should not have been recorded: the invoice returns to unpaid, the recorded payment amount is cleared, and the full before/after lands in the financial audit log. (This does NOT create a credit note and does not unbill time or expenses.)'
                            : 'Restores the invoice to the status it had before it was voided. Both the void and this reinstatement stay in the audit trail.'}
                </p>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1.5">
                    Reason <span className="text-rose-500">(required — part of the audit trail)</span>
                </label>
                <textarea
                    autoFocus
                    rows={3}
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
                    placeholder={isVoid
                        ? 'e.g. Issued to the wrong client in error'
                        : isRevert
                            ? 'e.g. Payment recorded on the wrong invoice — client paid INV-0009 instead'
                            : 'e.g. Client paid after all — verified against bank statement'}
                    className="w-full border border-slate-300 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
                {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-sm font-semibold hover:bg-slate-300 dark:hover:bg-zinc-600">Cancel</button>
                    <button
                        onClick={() => {
                            const clean = reason.trim();
                            if (clean.length < 3) { setError('A reason is required — this is the audit trail.'); return; }
                            onConfirm(invoice.id, clean);
                            onClose();
                        }}
                        className={`flex-1 py-2.5 text-white rounded-lg text-sm font-bold ${isVoid ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                        {isVoid ? 'Void Invoice' : 'Reinstate Invoice'}
                    </button>
                </div>
            </div>
        </div>
    );
};
