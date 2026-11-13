/**
 * statusClasses — the shared soft occupancy-chip palette (unchanged
 * vocabulary from the old card, minus the keyline washes).
 */
export const STATUS_CLASS: Record<string, string> = {
    'Occupied': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    'Vacant': 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600',
    'Maintenance': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    'Listed': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
};
