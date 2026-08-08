/**
 * TrustAccountTab — Trust Account Ledger for Legal Firms
 *
 * Shows when firmDetails.trustAccountingEnabled === true.
 * Displays:
 *   - Current trust account balance (prominent card)
 *   - Transaction list (deposits, withdrawals, transfers)
 *   - "Record Deposit" and "Record Withdrawal" buttons
 *   - Each transaction shows: type, amount, description, client, date, running balance
 *
 * Design matches the app's card-based layout with emerald accents.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { PlusIcon, TrashIcon } from '../../constants';
import { formatNaira } from '../../utils/formatting';
import { useConfirm } from '../ui/ConfirmDialog';
import NairaSymbol from '../NairaSymbol';

// Inline arrow icons (not all available in constants)
const ArrowDownIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
);
const ArrowUpIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
);
const ArrowRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
);

const TrustAccountTab: React.FC = () => {
    const { currentUser } = useAuth();
    const { coreState } = useCoreState();
    const { addToast } = useUI();
    const { confirm, ConfirmDialog } = useConfirm();
    const { matterState } = useMatterState();
    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

    const [showDepositForm, setShowDepositForm] = useState(false);
    const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);

    // ─── Queries ────────────────────────────────────────────────────────
    const trustBalance = useQuery(api.trustAccount.getTrustBalance, firmId ? { firmId } : 'skip');
    const transactions = useQuery(api.trustAccount.getTrustTransactions, firmId ? { firmId } : 'skip');

    // ─── Mutations ──────────────────────────────────────────────────────
    const recordTransaction = useMutation(api.trustAccount.recordTrustTransaction);
    const deleteTransaction = useMutation(api.trustAccount.deleteTrustTransaction);

    const matters = matterState.matters || [];

    return (
        <>
        <div className="space-y-5">
            {/* Balance Hero Card */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Trust Account Balance</p>
                        <div className="flex items-center gap-1">
                            <NairaSymbol className="text-3xl font-black" />
                            <span className="text-3xl font-black">{trustBalance !== undefined ? formatNaira(trustBalance) : '—'}</span>
                        </div>
                    </div>
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => { setShowDepositForm(true); setShowWithdrawalForm(false); }}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowDownIcon className="w-4 h-4" /> Record Deposit
                </button>
                <button
                    onClick={() => { setShowWithdrawalForm(true); setShowDepositForm(false); }}
                    className="flex-1 px-4 py-2.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowUpIcon className="w-4 h-4" /> Record Withdrawal
                </button>
            </div>

            {/* Deposit Form */}
            {showDepositForm && (
                <TrustTransactionForm
                    type="deposit"
                    matters={matters}
                    onSubmit={async (data) => {
                        try {
                            await recordTransaction({
                                firmId,
                                matterId: data.matterId,
                                clientName: data.clientName,
                                type: 'deposit',
                                amount: data.amount,
                                description: data.description,
                                reference: data.reference,
                                recordedBy: currentUser?.id,
                                recordedByName: currentUser?.name,
                            });
                            addToast('Trust deposit recorded.', { type: 'success' });
                            setShowDepositForm(false);
                        } catch (err: any) {
                            addToast(err.message || 'Failed to record deposit.', { type: 'error' });
                        }
                    }}
                    onCancel={() => setShowDepositForm(false)}
                />
            )}

            {/* Withdrawal Form */}
            {showWithdrawalForm && (
                <TrustTransactionForm
                    type="withdrawal"
                    matters={matters}
                    onSubmit={async (data) => {
                        try {
                            await recordTransaction({
                                firmId,
                                matterId: data.matterId,
                                clientName: data.clientName,
                                type: data.transferToOperating ? 'transfer' : 'withdrawal',
                                amount: data.amount,
                                description: data.description,
                                reference: data.reference,
                                recordedBy: currentUser?.id,
                                recordedByName: currentUser?.name,
                            });
                            addToast('Trust withdrawal recorded.', { type: 'success' });
                            setShowWithdrawalForm(false);
                        } catch (err: any) {
                            addToast(err.message || 'Failed to record withdrawal.', { type: 'error' });
                        }
                    }}
                    onCancel={() => setShowWithdrawalForm(false)}
                />
            )}

            {/* Transaction List */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft border border-slate-200 dark:border-zinc-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Transaction History</h3>
                </div>
                {transactions && transactions.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                        {transactions.map((tx: any) => (
                            <div key={tx._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors group">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    tx.type === 'deposit' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    : tx.type === 'transfer' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                                }`}>
                                    {tx.type === 'deposit' ? <ArrowDownIcon className="w-4 h-4" />
                                    : tx.type === 'transfer' ? <ArrowRightIcon className="w-4 h-4" />
                                    : <ArrowUpIcon className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{tx.type}</span>
                                        {tx.clientName && <span className="text-xs text-slate-400 truncate">· {tx.clientName}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{tx.description}</p>
                                    <p className="text-2xs text-slate-400">{new Date(tx.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className={`text-sm font-bold ${tx.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {tx.type === 'deposit' ? '+' : '−'}<NairaSymbol className="text-xs" />{formatNaira(tx.amount)}
                                    </div>
                                    <div className="text-2xs text-slate-400">Bal: <NairaSymbol className="text-3xs" />{formatNaira(tx.balanceAfter)}</div>
                                </div>
                                <button
                                    onClick={async () => {
                                        const ok = await confirm({
                                            title: 'Delete Transaction',
                                            message: 'Delete this transaction? Running balances will be recalculated.',
                                            confirmLabel: 'Delete',
                                            danger: true,
                                        });
                                        if (!ok) return;
                                        try {
                                            await deleteTransaction({ transactionId: tx._id, firmId });
                                            addToast('Transaction deleted.', { type: 'success' });
                                        } catch (err: any) {
                                            addToast(err.message || 'Failed to delete.', { type: 'error' });
                                        }
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-4 py-12 text-center">
                        <p className="text-sm text-slate-400">No trust transactions yet. Record your first deposit above.</p>
                    </div>
                )}
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    <strong>What is Trust Accounting?</strong> Trust accounts hold client funds separately from your firm's operating money. Use this ledger to track deposits (client money received), withdrawals (money paid out for the client's matter), and transfers (moving earned fees to your operating account). Always ensure the trust balance never goes negative.
                </p>
            </div>
        </div>
        {ConfirmDialog}
        </>
    );
};

// ─── Transaction Form ────────────────────────────────────────────────────

const TrustTransactionForm: React.FC<{
    type: 'deposit' | 'withdrawal';
    matters: any[];
    onSubmit: (data: { matterId?: string; clientName?: string; amount: number; description: string; reference?: string; transferToOperating?: boolean }) => void;
    onCancel: () => void;
}> = ({ type, matters, onSubmit, onCancel }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [matterId, setMatterId] = useState('');
    const [reference, setReference] = useState('');
    const [transferToOperating, setTransferToOperating] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(amount.replace(/,/g, ''));
        if (!amt || amt <= 0) return;
        const selectedMatter = matters.find(m => m.id === matterId);
        onSubmit({
            matterId: matterId || undefined,
            clientName: selectedMatter?.clientName,
            amount: amt,
            description: description.trim(),
            reference: reference.trim() || undefined,
            transferToOperating,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-800 rounded-2xl p-4 space-y-3 border border-slate-200 dark:border-zinc-700 shadow-soft">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                {type === 'deposit' ? 'Record Trust Deposit' : 'Record Trust Withdrawal'}
            </h4>

            <div>
                <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Amount (₦)</label>
                <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                />
            </div>

            <div>
                <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Linked Matter (optional)</label>
                <select
                    value={matterId}
                    onChange={(e) => setMatterId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                >
                    <option value="">No specific matter</option>
                    {matters.map(m => (
                        <option key={m.id} value={m.id}>{m.title} {m.clientName ? `· ${m.clientName}` : ''}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={type === 'deposit' ? 'e.g. Retainer deposit from client' : 'e.g. Filing fees paid on behalf of client'}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                />
            </div>

            <div>
                <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Reference (optional)</label>
                <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. Bank transfer ref / cheque number"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                />
            </div>

            {type === 'withdrawal' && (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={transferToOperating}
                        onChange={(e) => setTransferToOperating(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500/30"
                    />
                    <span className="text-xs text-slate-600 dark:text-zinc-400">Transfer to operating account (earned fees)</span>
                </label>
            )}

            <div className="flex gap-2 pt-2">
                <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors">
                    Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors">
                    Record {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                </button>
            </div>
        </form>
    );
};

export default TrustAccountTab;
