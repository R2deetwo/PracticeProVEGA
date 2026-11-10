/**
 * QuickActionConfirmCard — Round G (§3): the explicit confirmation UI for
 * MAJOR quick actions proposed by ARIA/ALOA.
 *
 * When the model calls execute_quick_action with a major action
 * (delete_item on anything; update_status/archive on properties — see
 * utils/quickActionPolicy.ts), NOTHING executes. Instead the chat shows
 * this card: a plain-English description of exactly what will happen,
 * a Confirm button and a Cancel button. Only the Confirm click runs the
 * mutation. Cancel marks the proposal declined and tells the model.
 *
 * The card is deliberately dumb: it renders state and calls back. All
 * execution lives in AloaChat (executeConfirmedQuickAction), which uses
 * the same authed mutations the immediate path uses.
 */
import React from 'react';
import { Button } from '../ui';
import {
    TrashIcon,
    RefreshIcon,
    CheckIcon,
    XIcon,
} from '../../constants';

export interface QuickActionProposal {
    action: string;
    targetType: string;
    targetId: string;
    value?: string;
}

interface QuickActionConfirmCardProps {
    proposal: QuickActionProposal;
    /** Plain-English description of what Confirm will do. */
    description: string;
    /** Confirm button label from the policy module. */
    confirmLabel: string;
    /** 'pending' → buttons; 'done' → executed; 'declined' → cancelled. */
    status: 'pending' | 'done' | 'declined';
    onConfirm: () => void;
    onCancel: () => void;
    /** Failure message from the executed mutation, if any. */
    error?: string | null;
}

export const QuickActionConfirmCard: React.FC<QuickActionConfirmCardProps> = ({
    proposal,
    description,
    confirmLabel,
    status,
    onConfirm,
    onCancel,
    error,
}) => {
    const isDestructive = proposal.action === 'delete_item';

    return (
        <div
            className={`mt-2 p-4 rounded-2xl border ${
                status === 'pending'
                    ? isDestructive
                        ? 'border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20'
                        : 'border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
            }`}
            data-testid="quick-action-confirm-card"
        >
            <div className="text-2xs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2"
                 style={{ color: isDestructive && status === 'pending' ? '#b91c1c' : undefined }}>
                {isDestructive ? (
                    <TrashIcon className="w-3 h-3" />
                ) : (
                    <RefreshIcon className="w-3 h-3" />
                )}
                {status === 'pending'
                    ? 'Confirm before I make this change'
                    : status === 'done'
                        ? 'Change applied'
                        : 'Cancelled — nothing was changed'}
            </div>

            <p className="text-xs font-medium text-slate-700 dark:text-zinc-200 leading-relaxed mb-3">
                {description}
            </p>

            {status === 'pending' && (
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        className="flex-1 !text-xs"
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <XIcon className="w-3.5 h-3.5" />
                            Cancel
                        </span>
                    </Button>
                    <Button
                        variant={isDestructive ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        className="flex-1 !text-xs"
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <CheckIcon className="w-3.5 h-3.5" />
                            {confirmLabel}
                        </span>
                    </Button>
                </div>
            )}

            {status === 'done' && (
                <p className="text-2xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" /> The change was applied successfully.
                </p>
            )}
            {status === 'done' && error && (
                <p className="text-2xs text-red-600 dark:text-red-400 font-medium mt-1">{error}</p>
            )}
            {status === 'declined' && (
                <p className="text-2xs text-slate-500 dark:text-zinc-400 italic">
                    You declined this — the record was left untouched.
                </p>
            )}
        </div>
    );
};
