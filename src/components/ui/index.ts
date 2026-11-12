/**
 * ui/ — shared UI primitives (design-system Chunk A, ADR-0004).
 *
 * The adoption rule: NEW code uses these primitives instead of hand-rolled
 * <button>/<input>/<select> class strings. EXISTING code migrates screen by
 * screen (the same discipline as the token batches) — each migration must
 * be a zero-visual-change refactor, which is why the class constants here
 * mirror the dominant measured patterns in the codebase.
 *
 * Old files that predate this layer:
 *   - ConfirmDialog.tsx      (in-app confirm replacement — stable, adopted)
 *   - FinancialStatusBadge.tsx (status-string → tone mapping — stable)
 * Both are re-exported here so there is ONE import path for UI primitives.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputProps, InputStyle } from './Input';

export { Textarea } from './Textarea';
export type { TextareaProps, TextareaStyle } from './Textarea';

export { Select } from './Select';
export type { SelectProps, SelectStyle, SelectOption } from './Select';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { useToastFeedback } from './useToastFeedback';
export type { ToastFeedback, ToastFeedbackOptions } from './useToastFeedback';

// Pre-existing primitives, re-exported for one import path.
export { default as ConfirmDialog } from './ConfirmDialog';
export { useConfirm } from './ConfirmDialog';
export type { ConfirmOptions } from './ConfirmDialog';
export { default as FinancialStatusBadge } from './FinancialStatusBadge';

// EmptyState already exists one level up with 11 adopters — re-export
// rather than duplicate (single source of truth).
export { default as EmptyState } from '../EmptyState';
export { SectionErrorBoundary } from './SectionErrorBoundary';

// ── UX-19: the toolkit/ layer is RETIRED ────────────────────────────────
// The dead shadcn-era primitives (toolkit Button/Input/Select/Icon/
// FieldLabel/PlatinumSkeleton — 0 importers) and components.json (pointing
// at a non-existent src/app/globals.css) are deleted; the six live
// survivors moved here so ui/ is the ONE primitives layer. The file-kebab
// Accordion lives on as CollapsibleAccordion (the root-level Accordion.tsx
// is a different component used by HelpView).
export { Skeleton, DashboardSkeleton, TasksSkeleton, MattersSkeleton, ContactsSkeleton, DocumentsSkeleton, GenericSkeleton } from './Skeleton';
export { ListItemSkeleton, CardSkeleton, TabContentSkeleton, DetailSkeleton, TableSkeleton } from './DataSkeleton';
export { AutoExpandingChatInput } from './AutoExpandingChatInput';
export type { AutoExpandingChatInputProps, PendingAttachment } from './AutoExpandingChatInput';
export { ChatMessageBubble } from './ChatMessageBubble';
export type { ChatMessageBubbleProps } from './ChatMessageBubble';
export { PresenceAvatars } from './PresenceAvatars';
export type { PresenceAvatarsProps } from './PresenceAvatars';
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './CollapsibleAccordion';
