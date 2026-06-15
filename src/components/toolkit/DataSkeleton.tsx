/**
 * DataSkeleton — Professional skeleton loading components for data-heavy views.
 * Each skeleton matches the visual shape of the content it replaces.
 */
import React from 'react';

// ── Base pulse animation wrapper ──
const Pulse: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-zinc-700 rounded ${className || ''}`} style={style} />
);

// ── List item skeleton (used for messages, notices, tasks, etc.) ──
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-3">
        <Pulse className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-3/4" />
          <Pulse className="h-3 w-1/2" />
        </div>
        <Pulse className="h-3 w-12 flex-shrink-0" />
      </div>
    ))}
  </div>
);

// ── Card skeleton (used for notices, properties, matters) ──
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
        <div className="flex items-center gap-2">
          <Pulse className="h-5 w-2/3" />
          <Pulse className="h-4 w-16 rounded-full" />
        </div>
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-4/5" />
        <div className="flex items-center gap-3 pt-1">
          <Pulse className="h-3 w-20" />
          <Pulse className="h-3 w-24" />
        </div>
      </div>
    ))}
  </div>
);

// ── Tab content skeleton (for when a tab is loading) ──
export const TabContentSkeleton: React.FC = () => (
  <div className="p-4 space-y-4">
    <div className="flex items-center justify-between">
      <Pulse className="h-6 w-40" />
      <Pulse className="h-8 w-28 rounded-lg" />
    </div>
    <ListItemSkeleton count={4} />
  </div>
);

// ── Detail view skeleton (for matter/property/contact detail panels) ──
export const DetailSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="space-y-3">
      <Pulse className="h-8 w-2/3" />
      <Pulse className="h-4 w-1/3" />
    </div>
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
          <Pulse className="h-3 w-16" />
          <Pulse className="h-6 w-20" />
        </div>
      ))}
    </div>
    <Pulse className="h-40 w-full rounded-xl" />
  </div>
);

// ── Table skeleton (for ledger, invoices, etc.) ──
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-2">
    <div className="flex gap-4 pb-2 border-b border-slate-200 dark:border-zinc-700">
      {Array.from({ length: cols }).map((_, i) => (
        <Pulse key={i} className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, row) => (
      <div key={row} className="flex gap-4 py-3">
        {Array.from({ length: cols }).map((_, col) => (
          <Pulse key={col} className="h-4 flex-1" style={{ width: `${60 + Math.random() * 40}%` }} />
        ))}
      </div>
    ))}
  </div>
);

// ── Composite: export all skeletons as a namespace via default ──
const DataSkeleton = {
  ListItem: ListItemSkeleton,
  Card: CardSkeleton,
  TabContent: TabContentSkeleton,
  Detail: DetailSkeleton,
  Table: TableSkeleton,
};

export default DataSkeleton;
