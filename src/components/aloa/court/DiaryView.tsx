/**
 * Round 19 — the Court Mode diary: My diary | Firm diary segmented toggle
 * (persisted), search (title / suit no. / lawyer), day-grouped hearing rows
 * (whole-card Buttons, min-h 56px, focus ring), NEEDS A NEW DATE cards and
 * the collapsed NO DATE RECORDED section. Skeleton rows while the firm data
 * loads (isDataLoaded); empty states per spec.
 */
import React from "react";
import { CalendarDays, Scale, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, EmptyState, Input, SkeletonList } from "../../ui";
import type { CourtDiary, DiaryEntry, DiaryScope } from "../courtModeUtils";
import { dayLabelOf } from "./format";
import { SegmentedToggle } from "./SegmentedToggle";
import { DiaryMatterCard } from "./DiaryMatterCard";

interface DiaryViewProps {
  diary: CourtDiary;
  query: string;
  onQueryChange: (query: string) => void;
  scope: DiaryScope;
  onScopeChange: (scope: DiaryScope) => void;
  onOpenMatter: (matterId: string) => void;
  onShowFirmDiary: () => void;
  onAddCourtDate: () => void;
  isDataLoaded: boolean;
  hasAnyCourtMatters: boolean;
  viewerId: string;
  /** Round 21: counsel names for the collapsed cards (id → name). */
  userNames: Record<string, string>;
  /** Round 21: documents per matter for the collapsed cards. */
  documentCountByMatter: Record<string, number>;
  headingRef: React.RefObject<HTMLHeadingElement>;
}

const DIARY_ROW_CLASSES = "min-h-14 justify-start gap-3 px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-primary-500";

/** One diary hearing row: time + courtroom / title / suit · court / lawyers + last order. */
const DiaryRow: React.FC<{
  entry: DiaryEntry;
  showColleagueBadge: boolean;
  onOpen: (matterId: string) => void;
}> = ({ entry, showColleagueBadge, onOpen }) => {
  const who = entry.isMine ? "You" : entry.lawyerNames.join(", ");
  return (
    <Button
      variant="outline"
      size="md"
      type="button"
      minTouchTarget
      fullWidth
      onClick={() => onOpen(entry.matterId)}
      className={DIARY_ROW_CLASSES}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-primary-700 dark:text-primary-300">{entry.timeLabel ?? ""}</span>
          <span className="truncate text-2xs font-semibold text-subtle">{entry.courtRoom ?? ""}</span>
        </span>
        <span className="mt-0.5 block line-clamp-2 break-words text-sm font-bold leading-snug">{entry.matterTitle}</span>
        <span className="block truncate text-xs font-medium text-subtle">
          {[entry.suitNumber, entry.court].filter(Boolean).join(" · ")}
        </span>
        {who || entry.lastOrderSnippet ? (
          <span className="mt-0.5 block truncate text-xs text-subtle">
            {who ? `${who} · ` : ""}
            {/* ROUND 23 (owner vocabulary): Last endorsement — never "Last order". */}
            {entry.lastOrderSnippet ? `Last endorsement: "${entry.lastOrderSnippet}"` : ""}
          </span>
        ) : null}
      </span>
      {showColleagueBadge ? <Badge tone="neutral">Colleague</Badge> : null}
    </Button>
  );
};

/** A matter without a tappable date — the collapsed summary card lives in
 *  DiaryMatterCard (title, suit · court · division, counsel, doc count). */

export const DiaryView: React.FC<DiaryViewProps> = ({
  diary,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  onOpenMatter,
  onShowFirmDiary,
  onAddCourtDate,
  isDataLoaded,
  hasAnyCourtMatters,
  viewerId,
  userNames,
  documentCountByMatter,
  headingRef,
}) => {
  const hasResults = diary.groups.length > 0 || diary.needsNewDate.length > 0 || diary.noDate.length > 0;

  // Full-screen empty states: loading, no qualifying matters at all, and
  // the untouched My-diary-empty case. A SEARCH that matches nothing keeps
  // the search box mounted (the user must be able to refine the query).
  if (!isDataLoaded) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <SkeletonList count={5} />
      </div>
    );
  }
  if (!hasAnyCourtMatters) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6">
        <EmptyState
          icon={<Scale className="h-6 w-6 text-slate-400" aria-hidden="true" />}
          title="Nothing here yet"
          description="Matters appear here once they carry a suit number, court or hearing date"
          actionLabel="Add a court date"
          onAction={onAddCourtDate}
        />
      </div>
    );
  }
  if (!hasResults && scope === "mine" && !query.trim()) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6">
        <EmptyState
          icon={<CalendarDays className="h-6 w-6 text-slate-400" aria-hidden="true" />}
          title="Your diary is clear"
          description="Nothing in your diary for the next 14 days"
          actionLabel="Show firm diary"
          onAction={onShowFirmDiary}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {scope === "mine" ? "My court diary" : "Firm court diary"}
      </h2>
      <div className="space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <SegmentedToggle
          label="Diary scope"
          options={[{ value: "mine", label: "My diary" }, { value: "firm", label: "Firm diary" }]}
          value={scope}
          onChange={(value) => onScopeChange(value as DiaryScope)}
        />
        {/* Round 21: the relationship made explicit — what you record lands
            in the firm diary too. One place to write, two views to read. */}
        <p className="-mt-1 text-2xs text-subtle">
          What you record lands in the firm diary too — no double entry.
        </p>

        <Input
          type="search"
          label="Search diary"
          placeholder="Search title, suit no., lawyer"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />

        {query.trim() && !hasResults ? (
          <EmptyState
            icon={<Search className="h-6 w-6 text-slate-400" aria-hidden="true" />}
            title="No results"
            description={`No matters match '${query.trim()}'`}
          />
        ) : null}

        {diary.groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-center gap-2 border-b border-hairline bg-surface px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-2xs font-black uppercase tracking-widest text-subtle">
                {/* Today/Tomorrow carry no date in the label — append it. */}
                {group.label === "Today" || group.label === "Tomorrow"
                  ? `${group.label.toUpperCase()} · ${dayLabelOf(group.key)}`
                  : group.label.toUpperCase()}
              </h3>
            </div>
            <div className="space-y-2">
              {group.entries.map((entry) => (
                <DiaryRow
                  key={entry.hearingId}
                  entry={entry}
                  showColleagueBadge={scope === "firm" && !entry.isMine}
                  onOpen={onOpenMatter}
                />
              ))}
            </div>
          </section>
        ))}

        {diary.needsNewDate.length > 0 ? (
          <section aria-label="Needs a new date">
            <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-center gap-2 border-b border-hairline bg-surface px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-2xs font-black uppercase tracking-widest text-subtle">
                Needs a new date ({diary.needsNewDate.length})
              </h3>
              <Badge tone="warning">Last hearing past</Badge>
            </div>
            <div className="space-y-2">
              {diary.needsNewDate.map((courtMatter) => (
                <DiaryMatterCard
                  key={courtMatter.matter.id}
                  courtMatter={courtMatter}
                  showColleagueBadge={scope === "firm" && !courtMatter.matter.assignedUsers.includes(viewerId)}
                  userNames={userNames}
                  documentCountByMatter={documentCountByMatter}
                  onOpen={onOpenMatter}
                />
              ))}
            </div>
          </section>
        ) : null}

        {diary.noDate.length > 0 ? (
          <Accordion type="single">
            <AccordionItem value="no-date" className="rounded-sm border border-hairline bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <AccordionTrigger className="px-1 text-xs">
                No date recorded ({diary.noDate.length})
              </AccordionTrigger>
              <AccordionContent className="space-y-2">
                {diary.noDate.map((courtMatter) => (
                  <DiaryMatterCard
                    key={courtMatter.matter.id}
                    courtMatter={courtMatter}
                    showColleagueBadge={false}
                    userNames={userNames}
                    documentCountByMatter={documentCountByMatter}
                    onOpen={onOpenMatter}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </div>
    </div>
  );
};

export default DiaryView;
