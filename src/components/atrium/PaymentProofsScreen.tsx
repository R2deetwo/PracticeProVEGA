/**
 * PaymentProofsScreen — Financials → Payment Proofs.
 *
 * MESSAGES OVERHAUL (task 25): this replaces the old AtriumInbox, which was
 * a FULL second inbox ("WhatsApp & Email" threads + Audit Trail + Payment
 * Proofs sub-tabs) duplicating surfaces that already live in Messages.
 * Property managers were bouncing between two inboxes and four send-history
 * views. Now:
 *   - resident conversations (WhatsApp/email/portal) live ONLY in
 *     Messages → Conversations
 *   - every sent message is recorded ONLY in Messages → Sent
 *   - THIS screen does exactly one job: reviewing the rent payments
 *     residents submitted via the portal — approve or reject, with proof.
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { PaymentProofsTab } from './PaymentProofsTab';
import { Receipt as ReceiptIcon, Inbox as InboxIcon, Send as SendIcon } from 'lucide-react';

export const PaymentProofsScreen: React.FC = () => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const { navigateTo } = useUI() as any;
  const firmId = coreState.firmDetails?.id || currentUser?.firmId;

  // Badge counts only the submissions awaiting action, so a reviewed pile
  // doesn't shout (carried over from the old AtriumInbox behaviour).
  const paymentProofs = useQuery(
    api.portals.getPaymentProofsByFirm,
    firmId ? { firmId } : 'skip'
  );
  const pendingProofs = (paymentProofs || []).filter(
    (p: any) => !['approved', 'verified', 'rejected', 'declined'].includes(p.status)
  ).length;

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white sm:overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
            <ReceiptIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Payment Proofs</h2>
            <p className="text-2xs text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-medium">
              Rent payments submitted by residents — approve or reject
            </p>
          </div>
        </div>
        {pendingProofs > 0 && (
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {pendingProofs} awaiting review
          </span>
        )}
      </div>

      {/* Where-did-it-go strip — tells anyone looking for the old tabs
          exactly where those things now live (one line, no hunting). */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-6 py-2 border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60 text-xs text-slate-500 dark:text-zinc-400">
        <button
          onClick={() => navigateTo('messaging' as any)}
          className="inline-flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400 font-semibold transition-colors"
        >
          <InboxIcon className="w-3.5 h-3.5" /> Resident messages → Messages → Conversations
        </button>
        <button
          onClick={() => navigateTo('messaging' as any, undefined, { initialTab: 'outbox' } as any)}
          className="inline-flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400 font-semibold transition-colors"
        >
          <SendIcon className="w-3.5 h-3.5" /> Sent-message history → Messages → Sent
        </button>
      </div>

      {/* Proof review list */}
      <PaymentProofsTab
        firmId={firmId || undefined}
        userEmail={currentUser?.email || undefined}
        properties={coreState.properties || []}
      />
    </div>
  );
};
