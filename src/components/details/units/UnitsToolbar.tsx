/**
 * UnitsToolbar — filters, search, group-by, view toggle (§3.3).
 * The old dead-pixel stats chips become INTERACTIVE filters (multi-toggle;
 * occupancy chips combine with the Action / Watch health chips). Keyboard
 * hint + help entry live here too — the console is worked, not browsed.
 */
import React from 'react';
import { Button, Input, Select } from '../../ui';
import { Plus, Search, HelpCircle } from 'lucide-react';
import type { UnitGroupKey } from './useUnitHealth';

export type UnitsViewMode = 'console' | 'cards';
export type UnitFilter = 'occupied' | 'vacant' | 'maintenance' | 'listed' | 'action' | 'watch';

interface UnitsToolbarProps {
    counts: Record<'all' | UnitFilter, number>;
    activeFilters: UnitFilter[];
    onToggleFilter: (f: UnitFilter) => void;
    onClearFilters: () => void;
    search: string;
    onSearchChange: (q: string) => void;
    searchInputRef?: React.RefObject<HTMLInputElement | null>;
    groupBy: UnitGroupKey;
    onGroupChange: (g: UnitGroupKey) => void;
    view: UnitsViewMode;
    onViewChange: (v: UnitsViewMode) => void;
    onAddUnit: () => void;
    onHelp: () => void;
}

const FILTER_CHIPS: { key: UnitFilter; label: string; activeCls: string }[] = [
    { key: 'occupied', label: 'Occupied', activeCls: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800' },
    { key: 'vacant', label: 'Vacant', activeCls: 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-zinc-600' },
    { key: 'maintenance', label: 'Maintenance', activeCls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800' },
    { key: 'listed', label: 'Listed', activeCls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800' },
    { key: 'action', label: '● Action', activeCls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800' },
    { key: 'watch', label: '◐ Watch', activeCls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800' },
];

const UnitsToolbar: React.FC<UnitsToolbarProps> = ({
    counts, activeFilters, onToggleFilter, onClearFilters,
    search, onSearchChange, searchInputRef,
    groupBy, onGroupChange,
    view, onViewChange, onAddUnit, onHelp,
}) => {
    const allActive = activeFilters.length === 0;
    return (
        <div className="space-y-2.5">
            {/* Filter chips + Add Unit */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1.5 flex-1 flex-wrap" role="group" aria-label="Filter units">
                    <Button
                        size="sm"
                        variant={allActive ? 'primary' : 'secondary'}
                        onClick={onClearFilters}
                        aria-pressed={allActive}
                        className="rounded-full"
                    >
                        All {counts.all}
                    </Button>
                    {FILTER_CHIPS.map(chip => {
                        const active = activeFilters.includes(chip.key);
                        return (
                            <Button
                                key={chip.key}
                                size="sm"
                                variant="bare"
                                aria-pressed={active}
                                onClick={() => onToggleFilter(chip.key)}
                                className={`rounded-full border transition-colors ${
                                    active
                                        ? chip.activeCls
                                        : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                                }`}
                            >
                                {chip.label} {counts[chip.key]}
                            </Button>
                        );
                    })}
                </div>
                <Button size="sm" variant="primary" icon={Plus} onClick={onAddUnit} className="flex-shrink-0">
                    Add Unit
                </Button>
            </div>

            {/* Search + group + view toggle + help */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="w-full sm:w-56">
                    <Input
                        ref={searchInputRef as any}
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search units — press /"
                        aria-label="Search units"
                        inputClassName="text-xs py-1.5"
                        containerClassName="mb-0"
                    />
                </div>
                <div className="w-36">
                    <Select
                        value={groupBy}
                        onChange={(e) => onGroupChange(e.target.value as UnitGroupKey)}
                        aria-label="Group units by"
                        selectClassName="text-xs py-1.5"
                        containerClassName="mb-0"
                    >
                        <option value="none">Group: None</option>
                        <option value="floor">Group: Floor</option>
                        <option value="type">Group: Type</option>
                        <option value="occupancy">Group: Occupancy</option>
                        <option value="health">Group: Health</option>
                    </Select>
                </div>
                <div className="flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden flex-shrink-0" role="group" aria-label="Units view">
                    {(['console', 'cards'] as UnitsViewMode[]).map(v => (
                        <Button
                            key={v}
                            size="sm"
                            variant="bare"
                            aria-pressed={view === v}
                            onClick={() => onViewChange(v)}
                            className={`rounded-none px-3 text-2xs font-bold uppercase tracking-wide ${
                                view === v
                                    ? 'bg-primary-600 text-white'
                                    : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {v === 'console' ? 'Console' : 'Cards'}
                        </Button>
                    ))}
                </div>
                <Button
                    size="sm"
                    variant="secondary"
                    iconOnly
                    icon={HelpCircle}
                    onClick={onHelp}
                    aria-label="Units console help and keyboard shortcuts"
                    title="Units console help & shortcuts (?)"
                    className="flex-shrink-0"
                />
            </div>
        </div>
    );
};

export default UnitsToolbar;
