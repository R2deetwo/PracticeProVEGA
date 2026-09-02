import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
    Receipt as ReceiptIcon,
    Check as CheckIcon,
    X as XIcon,
    Eye as EyeIcon,
    Paperclip as PaperclipIcon,
    Landmark as LandmarkIcon,
    CreditCard as CreditCardIcon,
} from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { translateError } from '../../utils/errorTranslator';

/**
 * PaymentProofsTab — firm-side review of tenant payment proof submissions.
 *
 * Round-4 audit item: tenants have been able to upload payment proofs
 * (receipts / transfer slips) from the Tenant Portal since the unified
 * payment pipeline, but the firm had NO surface to see them —
 * `portals.getPaymentProofsByFirm` / `updatePaymentProofStatus` existed
 * with zero frontend callers, so submitted proofs piled up invisibly.
 *
 * This tab lives inside AtriumInbox (Financials → Inbox → Payment Proofs).
 * Approving a proof tells the tenant their payment is confirmed (the
 * tenant's Payment History shows the admin note); rejecting asks them to
 * resubmit.
 */

type ProofStatus =
    | 'pending_review' | 'pending_verification'
    | 'verified' | 'approved'
    | 'rejected' | 'declined'
    | string;

interface PaymentProof {
    _id: string;
    firmId?: string;
    tenantId?: string;
    tenantName?: string;
    tenantEmail?: string;
    propertyId?: string;
    unitId?: string;
    amount?: number;
    period?: string;
    description?: string;
    storageIds?: string[];
    paymentMethod?: string;
    paystackReference?: string;
    status?: ProofStatus;
    adminNote?: string;
    reviewedAt?: number;
    reviewedBy?: string;
    createdAt: number;
}

/** Normalize the messy status vocabulary to 3 visual states. */
function statusGroup(s?: string): 'pending' | 'approved' | 'rejected' {
    if (s === 'approved' || s === 'verified') return 'approved';
    if (s === 'rejected' || s === 'declined') return 'rejected';
    return 'pending';
}

const STATUS_BADGE: Record<'pending' | 'approved' | 'rejected', string> = {
    pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    rejected: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
};

const STATUS_LABEL: Record<'pending' | 'approved' | 'rejected', string> = {
    pending: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
};

const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

const fmtNaira = (n?: number) =>
    n != null && n > 0 ? `₦${n.toLocaleString()}` : '';

interface PaymentProofsTabProps {
    firmId?: string;
    /** Firm user's email — passed to the mutation for firm-ownership auth. */
    userEmail?: string;
    /** Properties list for resolving the property address of a proof. */
    properties: { id: string; address?: string }[];
}

export const PaymentProofsTab: React.FC<PaymentProofsTabProps> = ({
    firmId,
    userEmail,
    properties,
}) => {
    const { addToast } = useUI();
    const proofs = useQuery(
        api.portals.getPaymentProofsByFirm,
        firmId ? { firmId } : 'skip'
    ) as any[] | undefined;

    const updateStatus = useMutation(api.portals.updatePaymentProofStatus);

    // Review actions
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');

    // Attachment viewing — resolve one storageId at a time on demand.
    const [viewStorageId, setViewStorageId] = useState<string | null>(null);
    const fileUrl = useQuery(
        api.myFunctions.getFileUrl,
        viewStorageId ? { storageId: viewStorageId } : 'skip'
    );

    React.useEffect(() => {
        if (viewStorageId && fileUrl) {
            if (typeof fileUrl === 'string' && fileUrl) window.open(fileUrl, '_blank', 'noopener');
            else addToast('File is no longer available.', { type: 'info' });
            setViewStorageId(null);
        }
    }, [fileUrl, viewStorageId]); // eslint-disable-line react-hooks/exhaustive-deps

    const addressById = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of properties || []) {
            if (p.id) m.set(p.id, p.address || '');
        }
        return m;
    }, [properties]);

    const pending = ((proofs || []) as any[]).filter(p => statusGroup(p.status) === 'pending');
    const reviewed = ((proofs || []) as any[]).filter(p => statusGroup(p.status) !== 'pending');

    const act = async (proof: PaymentProof, status: 'approved' | 'rejected', adminNote?: string) => {
        setBusyId(proof._id);
        try {
            await updateStatus({
                proofId: proof._id as any,
                status,
                adminNote: adminNote?.trim() || undefined,
                userEmail: userEmail || undefined,
            });
            addToast(
                status === 'approved'
                    ? `Approved${proof.tenantName ? ` — ${proof.tenantName}` : ''} will see it in their Payment History.`
                    : 'Rejected. The tenant will be asked to resubmit.',
                { type: 'success' }
            );
            setRejectingId(null);
            setRejectNote('');
        } catch (e: any) {
            addToast(translateError(e, 'update payment proof'), { type: 'error' });
        } finally {
            setBusyId(null);
        }
    };

    if (proofs === undefined) {
        return (
            <div className="p-6 space-y-3">
                {[1, 2].map(i => (
                    <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                            <div className="flex-1">
                                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-2" />
                                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-32" />
                            </div>
                            <div className="h-6 w-20 bg-slate-200 dark:bg-zinc-700 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (proofs.length === 0) {
        return (
            <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
                    <ReceiptIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No payment proofs yet</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
                    When tenants upload receipts or transfer slips from their portal, they will appear here for your review.
                </p>
            </div>
        );
    }

    const renderProof = (proof: PaymentProof) => {
        const group = statusGroup(proof.status);
        const isRejecting = rejectingId === proof._id;
        const propertyLabel = proof.propertyId
            ? (addressById.get(proof.propertyId) || '')
            : '';

        return (
            <div
                key={proof._id}
                className={`bg-white dark:bg-zinc-800 rounded-lg border p-4 ${
                    group === 'pending'
                        ? 'border-amber-200 dark:border-amber-900/50'
                        : 'border-slate-200 dark:border-zinc-700'
                }`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
                            group === 'approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                            : group === 'rejected' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        }`}>
                            <ReceiptIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-800 dark:text-zinc-200 truncate">
                                {proof.tenantName || proof.tenantEmail || 'Tenant'}
                                {proof.unitId ? <span className="text-slate-400 font-normal"> · {proof.unitId}</span> : null}
                            </p>
                            {propertyLabel && (
                                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{propertyLabel}</p>
                            )}
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                {fmtNaira(proof.amount) || 'No amount stated'}
                                {proof.period ? ` · ${proof.period}` : ''} · {fmtDate(proof.createdAt)}
                            </p>
                            {proof.description && (
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 italic line-clamp-2">{proof.description}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-2xs font-bold whitespace-nowrap ${STATUS_BADGE[group]}`}>
                            {STATUS_LABEL[group]}
                        </span>
                        <span className="flex items-center gap-1 text-2xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-tight">
                            {proof.paymentMethod === 'paystack'
                                ? <><CreditCardIcon className="w-3 h-3" /> Paystack</>
                                : <><LandmarkIcon className="w-3 h-3" /> Transfer</>}
                        </span>
                    </div>
                </div>

                {/* Attachments */}
                {proof.storageIds && proof.storageIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {proof.storageIds.map((sid, i) => (
                            <button
                                key={sid}
                                onClick={() => setViewStorageId(sid)}
                                className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-100 dark:bg-zinc-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-2xs font-bold text-slate-600 dark:text-zinc-300 rounded-md transition-colors"
                            >
                                <PaperclipIcon className="w-3 h-3" />
                                File {proof.storageIds!.length > 1 ? i + 1 : ''}
                                <EyeIcon className="w-3 h-3 text-primary-500" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Reviewer note (shown once reviewed) */}
                {group !== 'pending' && proof.adminNote && (
                    <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400 italic bg-slate-50 dark:bg-zinc-900 rounded-md p-2">
                        Note: {proof.adminNote}
                        {proof.reviewedBy ? <span className="text-slate-400"> · by {proof.reviewedBy}</span> : null}
                    </p>
                )}

                {/* Pending actions */}
                {group === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-700/60">
                        {!isRejecting ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => act(proof, 'approved')}
                                    disabled={busyId === proof._id}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <CheckIcon className="w-3.5 h-3.5" />
                                    {busyId === proof._id ? 'Working…' : 'Approve'}
                                </button>
                                <button
                                    onClick={() => { setRejectingId(proof._id); setRejectNote(''); }}
                                    disabled={busyId === proof._id}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                    Reject
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <textarea
                                    value={rejectNote}
                                    onChange={e => setRejectNote(e.target.value)}
                                    rows={2}
                                    placeholder="Optional note to the tenant (e.g. amount does not match — please resubmit)"
                                    className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                                />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => act(proof, 'rejected', rejectNote)}
                                        disabled={busyId === proof._id}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <XIcon className="w-3.5 h-3.5" />
                                        {busyId === proof._id ? 'Working…' : 'Confirm rejection'}
                                    </button>
                                    <button
                                        onClick={() => { setRejectingId(null); setRejectNote(''); }}
                                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 pb-24 md:pb-6">
            {pending.length > 0 && (
                <section>
                    <h3 className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                        Awaiting your review ({pending.length})
                    </h3>
                    <div className="space-y-3">{pending.map(renderProof)}</div>
                </section>
            )}
            {reviewed.length > 0 && (
                <section>
                    <h3 className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                        Reviewed ({reviewed.length})
                    </h3>
                    <div className="space-y-3">{reviewed.map(renderProof)}</div>
                </section>
            )}
        </div>
    );
};
