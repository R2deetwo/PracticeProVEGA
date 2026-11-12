/**
 * Skeleton — THE loading-placeholder family (UX-47).
 *
 * One source of truth for skeleton loading states. Before this
 * consolidation the codebase carried three systems (this file's
 * composites, DataSkeleton.tsx, and ~44 hand-rolled
 * `animate-pulse bg-…` block clusters); perceptual performance varied
 * arbitrarily between screens. Everything now lives here:
 *
 *   <Skeleton>            the pulse block primitive (text/circular/rect)
 *   <SkeletonText>        one-or-more text lines
 *   <SkeletonCard>        bordered card with pulse lines (list/grid items)
 *   <SkeletonList>        avatar + two lines + trailing width (rows)
 *   <SkeletonTable>       header row + body rows (ledgers, invoices)
 *   <SkeletonDetail>      heading + KPI grid + block (detail panels)
 *   <TabContentSkeleton>  heading + action + list (tab panes)
 *   …plus the per-screen composites that were already here
 *   (DashboardSkeleton, TasksSkeleton, MattersSkeleton, ContactsSkeleton,
 *   DocumentsSkeleton, GenericSkeleton).
 *
 * `animate-pulse` is reserved for this file and for SEMANTIC attention
 * states elsewhere (live dots, unread badges, recording indicators);
 * scripts/check-design-tokens.mjs ratchets the raw count so new
 * hand-rolled skeleton blocks cannot creep back in.
 */
import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  variant = 'rectangular'
}) => {
  const baseClasses = "animate-pulse bg-slate-200 dark:bg-zinc-700/50";
  const variantClasses = {
    text: "rounded-md",
    circular: "rounded-full",
    rectangular: "rounded-lg"
  };

  const style = {
    width: width,
    height: height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
      style={style}
    />
  );
};

/** One-or-more skeleton text lines. lines/lastWidth mirror real prose. */
export const SkeletonText: React.FC<{ lines?: number; className?: string; lastWidth?: string }> = ({
  lines = 3,
  className,
  lastWidth = 'w-2/3',
}) => (
  <div className={`space-y-2 ${className || ''}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} variant="text" className={`h-3 ${i === lines - 1 ? lastWidth : 'w-full'}`} />
    ))}
  </div>
);

/** Bordered card placeholder — list/grid items (notices, properties, matters). */
export const SkeletonCard: React.FC<{ count?: number; className?: string }> = ({ count = 3, className }) => (
  <div className={`space-y-3 ${className || ''}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-zinc-700 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" className="h-5 w-2/3" />
          <Skeleton variant="circular" className="h-4 w-16" />
        </div>
        <Skeleton variant="text" className="h-3 w-full" />
        <Skeleton variant="text" className="h-3 w-4/5" />
        <div className="flex items-center gap-3 pt-1">
          <Skeleton variant="text" className="h-3 w-20" />
          <Skeleton variant="text" className="h-3 w-24" />
        </div>
      </div>
    ))}
  </div>
);

/** Row placeholder — avatar + two lines + trailing width (messages, tasks). */
export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({ count = 5, className }) => (
  <div className={`space-y-3 ${className || ''}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-3">
        <Skeleton variant="circular" className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="h-4 w-3/4" />
          <Skeleton variant="text" className="h-3 w-1/2" />
        </div>
        <Skeleton variant="text" className="h-3 w-12 flex-shrink-0" />
      </div>
    ))}
  </div>
);

/** Table placeholder — header row + body rows (ledger, invoices). */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({ rows = 5, cols = 4, className }) => (
  <div className={`space-y-2 ${className || ''}`}>
    <div className="flex gap-4 pb-2 border-b border-slate-200 dark:border-zinc-700">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} variant="text" className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, row) => (
      <div key={row} className="flex gap-4 py-3">
        {Array.from({ length: cols }).map((_, col) => (
          <Skeleton key={col} variant="text" className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

/** Detail-panel placeholder — heading + KPI grid + one block. */
export const SkeletonDetail: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`p-6 space-y-6 ${className || ''}`}>
    <div className="space-y-3">
      <Skeleton variant="text" className="h-8 w-2/3" />
      <Skeleton variant="text" className="h-4 w-1/3" />
    </div>
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-zinc-700 space-y-2">
          <Skeleton variant="text" className="h-3 w-16" />
          <Skeleton variant="text" className="h-6 w-20" />
        </div>
      ))}
    </div>
    <Skeleton className="h-40 w-full" />
  </div>
);

/** Tab-pane placeholder — heading + action + list rows. */
export const TabContentSkeleton: React.FC = () => (
  <div className="p-4 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton variant="text" className="h-6 w-40" />
      <Skeleton className="h-8 w-28" />
    </div>
    <SkeletonList count={4} />
  </div>
);

// ── Per-screen composites (kept from the original family) ──────────────

// Aliases for the names the absorbed DataSkeleton.tsx exported — its
// importers (and src/components/ui/index.ts) keep working unchanged.
export const ListItemSkeleton = SkeletonList;
export const CardSkeleton = SkeletonCard;
export const TableSkeleton = SkeletonTable;
export const DetailSkeleton = SkeletonDetail;

export const DashboardSkeleton: React.FC = () => (
    <div className="space-y-8 animate-fade-in p-6">
        <div className="flex justify-between items-center pb-6 border-b border-slate-200 dark:border-zinc-700">
            <div className="space-y-2">
                <Skeleton width={200} height={32} />
                <Skeleton width={150} height={16} />
            </div>
             <Skeleton width={40} height={40} variant="circular" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-32 bg-white dark:bg-zinc-800 rounded-lg p-6 border border-slate-200 dark:border-zinc-700">
                    <Skeleton width={100} height={12} className="mb-4" />
                    <Skeleton width={60} height={36} />
                 </div>
            ))}
        </div>
    </div>
);

export const TasksSkeleton: React.FC = () => (
  <div className="flex flex-col h-full animate-fade-in p-6">
    <div className="flex justify-between items-center mb-6">
      <Skeleton width={150} height={36} />
      <Skeleton width={120} height={36} />
    </div>
    <div className="flex gap-4 pb-4 h-full overflow-hidden">
        {[1, 2, 3].map(i => (
             <div key={i} className="w-80 flex-shrink-0 flex flex-col space-y-4">
                 <Skeleton width="100%" height={200} />
                 <Skeleton width="100%" height={150} />
             </div>
        ))}
    </div>
  </div>
);

export const MattersSkeleton: React.FC = () => (
  <div className="flex flex-col h-full animate-fade-in p-6">
    <Skeleton width={200} height={40} className="mb-8" />
    <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} width="100%" height={64} />
        ))}
    </div>
  </div>
);

export const ContactsSkeleton: React.FC = () => (
  <div className="flex flex-col h-full animate-fade-in p-6">
      <Skeleton width={150} height={32} className="mb-6" />
      <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} width="100%" height={50} />
          ))}
      </div>
  </div>
);

export const DocumentsSkeleton: React.FC = () => (
     <div className="flex flex-col h-full bg-white dark:bg-zinc-900 animate-fade-in p-6">
        <div className="flex justify-between mb-6">
            <Skeleton width={150} height={32} />
            <Skeleton width={100} height={36} />
        </div>
        <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} height={120} />)}
        </div>
     </div>
);

export const GenericSkeleton: React.FC = () => (
    <div className="flex flex-col h-full animate-fade-in p-6">
        <Skeleton width={200} height={32} className="mb-6" />
        <div className="space-y-6">
            <Skeleton width="100%" height={200} />
            <Skeleton width="100%" height={100} />
        </div>
    </div>
);
