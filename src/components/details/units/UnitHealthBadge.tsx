/**
 * UnitHealthBadge — the health dot + label + reasons tooltip (§3.1/§3.2).
 * One dot, one word, one tooltip listing the reasons. Shared by console
 * rows and cards. Color is spent ONLY here (and in the arrears tokens) —
 * the rest of the row stays quiet by design.
 */
import React from 'react';
import Tooltip from '../../Tooltip';
import type { UnitHealth, UnitHealthLevel } from './useUnitHealth';

const DOT_CLASS: Record<UnitHealthLevel, string> = {
    action: 'bg-rose-500',
    watch: 'bg-amber-500',
    ok: 'bg-emerald-500',
    none: 'bg-slate-300 dark:bg-zinc-600',
};

const LABEL_CLASS: Record<UnitHealthLevel, string> = {
    action: 'text-rose-600 dark:text-rose-400',
    watch: 'text-amber-600 dark:text-amber-400',
    ok: 'text-emerald-600 dark:text-emerald-400',
    none: 'text-slate-400 dark:text-zinc-500',
};

const LABEL_TEXT: Record<UnitHealthLevel, string> = {
    action: 'Action',
    watch: 'Watch',
    ok: 'OK',
    none: '—',
};

interface UnitHealthBadgeProps {
    health: UnitHealth;
    /** Show the word next to the dot (rows hide it when narrow). */
    withLabel?: boolean;
    size?: 'sm' | 'md';
}

const UnitHealthBadge: React.FC<UnitHealthBadgeProps> = ({ health, withLabel = true, size = 'md' }) => {
    const dot = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
    const tip = health.level === 'none'
        ? 'No tenancy health — occupancy only'
        : health.reasons.length > 0
            ? health.reasons.join('\n')
            : LABEL_TEXT[health.level];
    return (
        <Tooltip text={tip} allowWrap>
            <span
                className="inline-flex items-center gap-1.5 cursor-help"
                aria-label={`Health: ${LABEL_TEXT[health.level]} — ${health.reasons.join('; ')}`}
                role="img"
            >
                <span className={`${dot} rounded-full flex-shrink-0 ${DOT_CLASS[health.level]} ${health.level === 'action' ? 'animate-pulse' : ''}`} />
                {withLabel && (
                    <span className={`text-2xs font-black uppercase tracking-wide ${LABEL_CLASS[health.level]}`}>
                        {LABEL_TEXT[health.level]}
                    </span>
                )}
            </span>
        </Tooltip>
    );
};

export default UnitHealthBadge;
