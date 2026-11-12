/**
 * Table — the shared table grammar for data surfaces (UX-48).
 *
 * Before this primitive the codebase hand-rolled 31 distinct <table>
 * sites with four competing header styles (px-6 py-3 text-xs bold,
 * px-4 py-2.5 text-2xs black, px-4 py-3 inherited, py-2 px-2 bare),
 * so reading dense financial data cost different effort on different
 * screens. Every migrated surface now composes these primitives:
 *
 *   <Table density="compact">          w-full text-sm (density flows to
 *                                      heads/cells via context)
 *     <TableHeader sticky>             surface-tinted head row
 *       <tr><TableHead align="right">… head cell — uppercase label
 *   …grammar, align left|right|center, sortable via onClick
 *   <TableBody>                        hairline row dividers
 *     <TableRow hover>…                row — hover tint is opt-in so
 *                                      behaviour-preserving migrations
 *                                      keep their current look
 *       <TableCell align="right" …>    body cell — text-body, density
 *                                      padding
 *
 * Densities mirror the two dominant pre-primitive patterns:
 *   comfortable  px-6 py-3 / px-6 py-4, text-xs heads   (main lists)
 *   compact      px-4 py-2.5, text-2xs heads            (in-panel tables)
 * Any prop passes through to the native element; `className` is
 * appended so a site can always extend, never fight, the grammar.
 */
import React, { createContext, useContext } from 'react';

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

type Density = 'comfortable' | 'compact';
const DensityCtx = createContext<Density>('comfortable');

type Align = 'left' | 'center' | 'right';
const alignClass = (a: Align | undefined) =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: Density;
}

export const Table: React.FC<TableProps> = ({ density = 'comfortable', className, ...rest }) => (
  <DensityCtx.Provider value={density}>
    <table className={cx('w-full text-sm', className)} {...rest} />
  </DensityCtx.Provider>
);

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ sticky, className, ...rest }) => (
  <thead
    className={cx(
      'bg-surface dark:bg-zinc-800/60',
      sticky && 'sticky top-0',
      className,
    )}
    {...rest}
  />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...rest }) => (
  <tbody
    className={cx('divide-y divide-hairline dark:divide-zinc-700/50', className)}
    {...rest}
  />
);

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({ hover, className, ...rest }) => (
  <tr
    className={cx(
      hover && 'hover:bg-surface-2/60 dark:hover:bg-zinc-800/40 transition-colors',
      className,
    )}
    {...rest}
  />
);

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  /** Adds the sortable affordance; pass onClick for the sort action. */
  sortable?: boolean;
}

export const TableHead: React.FC<TableHeadProps> = ({ align, sortable, className, scope = 'col', ...rest }) => {
  const density = useContext(DensityCtx);
  return (
    <th
      scope={scope}
      className={cx(
        density === 'comfortable' ? 'px-6 py-3 text-xs font-semibold' : 'px-4 py-2.5 text-2xs font-bold',
        'text-muted dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap',
        alignClass(align),
        sortable && 'cursor-pointer select-none hover:text-body dark:hover:text-zinc-200',
        className,
      )}
      {...rest}
    />
  );
};

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export const TableCell: React.FC<TableCellProps> = ({ align, className, ...rest }) => {
  const density = useContext(DensityCtx);
  return (
    <td
      className={cx(
        density === 'comfortable' ? 'px-6 py-4' : 'px-4 py-2.5',
        // Colour intentionally NOT defaulted: cells inherit from the
        // row/table context, and money surfaces set explicit per-cell
        // colours that must not fight a default (same-property Tailwind
        // conflicts resolve by stylesheet order, not class order).
        alignClass(align),
        className,
      )}
      {...rest}
    />
  );
};
