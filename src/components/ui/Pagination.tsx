/**
 * Pagination — ROUND E (Wave E4): the shared page-navigation primitive.
 * ─────────────────────────────────────────────────────────────────────────
 * The list-controls half of the owner brief (§5): search existed, but no
 * console offered pagination — a 300-unit estate rendered 300 rows in one
 * scroll. This primitive renders the standard footer the property and
 * resident consoles share:
 *
 *   ‹  ›   Showing 26–50 of 143   Rows per page [50 ▾]   Page 2 of 3
 *
 * Conventions (ADR-0004): Button + Select primitives ONLY — zero raw
 * interactive elements, so the ratchet never grows. Purely presentational:
 * the parent owns `page` / `pageSize` state (reset on filter change is the
 * parent's call — see the consoles for the reset-on-search contract).
 *
 *   <Pagination
 *     page={page} pageCount={pageCount} total={total} from={from} to={to}
 *     pageSize={pageSize}
 *     onPageChange={setPage}
 *     onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
 *   />
 */

import React from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
    /** 1-based current page (already clamped by applyListControls). */
    page: number;
    /** Total pages (0 when the roster is empty — footer still renders). */
    pageCount: number;
    /** Total rows after filter + search. */
    total: number;
    /** 1-based index of the first row on the page (0 when empty). */
    from: number;
    /** 1-based index of the last row on the page. */
    to: number;
    /** Rows per page; 0 = show all. */
    pageSize: number;
    /** Page-size options offered in the select. */
    pageSizeOptions?: number[];
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    /** Extra classes for the wrapping row. */
    className?: string;
}

const DEFAULT_PAGE_SIZES = [25, 50, 100, 0];

export const Pagination: React.FC<PaginationProps> = ({
    page,
    pageCount,
    total,
    from,
    to,
    pageSize,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    onPageChange,
    onPageSizeChange,
    className = '',
}) => {
    // Nothing to navigate — keep the footer hidden (empty states already
    // explain themselves) rather than rendering a disabled island.
    if (total === 0) return null;

    const sizeOptions = pageSizeOptions.map((s) => ({
        value: String(s),
        label: s === 0 ? 'Show all' : `${s} / page`,
    }));
    const currentSize = pageSizeOptions.includes(pageSize) ? String(pageSize) : String(pageSizeOptions[0] ?? 25);

    return (
        <div
            className={`flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-zinc-700 ${className}`}
            data-testid="pagination"
        >
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={ChevronLeft}
                        iconOnly
                        aria-label="Previous page"
                        disabled={page <= 1}
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={ChevronRight}
                        iconOnly
                        aria-label="Next page"
                        disabled={page >= pageCount}
                        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                    />
                </div>
                <p className="text-2xs text-slate-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                    Showing <span className="font-bold text-slate-700 dark:text-zinc-200">{from}–{to}</span> of{' '}
                    <span className="font-bold text-slate-700 dark:text-zinc-200">{total}</span>
                </p>
            </div>

            <div className="flex items-center gap-3">
                <p className="text-2xs text-slate-500 dark:text-zinc-400 font-medium whitespace-nowrap">
                    Page <span className="font-bold text-slate-700 dark:text-zinc-200">{page}</span> of{' '}
                    <span className="font-bold text-slate-700 dark:text-zinc-200">{pageCount}</span>
                </p>
                <div className="w-32">
                    <Select
                        aria-label="Rows per page"
                        styleVariant="modern"
                        value={currentSize}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            onPageSizeChange(Number.isFinite(next) ? next : 25);
                        }}
                        options={sizeOptions}
                        selectClassName="!py-1.5 text-2xs"
                    />
                </div>
            </div>
        </div>
    );
};
