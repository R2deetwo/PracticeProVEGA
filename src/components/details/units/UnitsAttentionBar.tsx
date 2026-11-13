/**
 * UnitsAttentionBar — the triage layer (UNITS_PAGE_REDESIGN.md §3.3).
 * One calm sentence that answers "what needs me today?", computed from the
 * same health rubric as the rows. Review → filters to Action units and
 * places the keyboard cursor on the first one. Dismissible for the session.
 * This single element replaces the old per-card red soup: alarms are
 * aggregated, not scattered.
 */
import React from 'react';
import { Button } from '../../ui';
import { AlertCircle, X } from 'lucide-react';

export interface AttentionBreakdown {
    total: number;
    expired: number;
    arrears: number;
    unrecorded: number;
    incomplete: number;
    staleTickets: number;
    eviction: number;
}

interface UnitsAttentionBarProps {
    breakdown: AttentionBreakdown;
    onReview: () => void;
    onDismiss: () => void;
}

const UnitsAttentionBar: React.FC<UnitsAttentionBarProps> = ({ breakdown, onReview, onDismiss }) => {
    if (breakdown.total === 0) return null;
    const parts: string[] = [];
    if (breakdown.expired > 0) parts.push(`${breakdown.expired} expired lease${breakdown.expired > 1 ? 's' : ''}`);
    if (breakdown.arrears > 0) parts.push(`${breakdown.arrears} in arrears`);
    if (breakdown.unrecorded > 0) parts.push(`${breakdown.unrecorded} tenanc${breakdown.unrecorded > 1 ? 'ies' : 'y'} unrecorded`);
    if (breakdown.incomplete > 0) parts.push(`${breakdown.incomplete} with incomplete records`);
    if (breakdown.eviction > 0) parts.push(`${breakdown.eviction} in eviction`);
    if (breakdown.staleTickets > 0) parts.push(`${breakdown.staleTickets} with stale tickets`);

    return (
        <div
            className="flex items-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 px-4 py-2.5"
            role="status"
            aria-live="polite"
        >
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-200 font-semibold min-w-0 flex-1">
                {breakdown.total} unit{breakdown.total > 1 ? 's' : ''} need{breakdown.total > 1 ? '' : 's'} attention
                <span className="font-normal text-rose-600/90 dark:text-rose-300/90"> — {parts.join(' · ')}</span>
            </p>
            <Button size="sm" variant="primary" onClick={onReview} className="flex-shrink-0">
                Review →
            </Button>
            <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={X}
                onClick={onDismiss}
                aria-label="Dismiss for this session"
                title="Dismiss for this session"
                className="flex-shrink-0 text-rose-400 hover:text-rose-600"
            />
        </div>
    );
};

export default UnitsAttentionBar;
