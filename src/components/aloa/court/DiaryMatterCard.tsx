/**
 * Round 21 — the collapsed matter summary card (the diary's NEEDS A NEW DATE
 * and NO DATE RECORDED lists): title / suit · court · division / responsible
 * counsel / document count, straight from current matter data.
 */
import React from "react";
import { Badge, Button } from "../../ui";
import type { CourtMatter } from "../courtModeUtils";

const DIARY_ROW_CLASSES = "min-h-14 justify-start gap-3 px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-primary-500";

export const DiaryMatterCard: React.FC<{
  courtMatter: CourtMatter;
  showColleagueBadge: boolean;
  userNames: Record<string, string>;
  documentCountByMatter: Record<string, number>;
  onOpen: (matterId: string) => void;
}> = ({ courtMatter, showColleagueBadge, userNames, documentCountByMatter, onOpen }) => {
  const matter = courtMatter.matter;
  const counsel = (matter.assignedUsers || []).map((id) => userNames[id] ?? id);
  const docCount = documentCountByMatter[matter.id] ?? 0;
  return (
    <Button
      variant="outline"
      size="md"
      type="button"
      minTouchTarget
      fullWidth
      onClick={() => onOpen(matter.id)}
      className={DIARY_ROW_CLASSES}
    >
      <span className="min-w-0 flex-1">
        <span className="block line-clamp-2 break-words text-sm font-bold leading-snug">{matter.title}</span>
        <span className="block truncate text-xs font-medium text-subtle">
          {[matter.suitNumber, matter.court, matter.judicialDivision].filter(Boolean).join(" · ")}
        </span>
        {counsel.length ? (
          <span className="mt-0.5 block truncate text-xs text-subtle">{counsel.join(", ")}</span>
        ) : null}
        <span className="mt-0.5 block text-2xs text-subtle">
          {docCount} document{docCount === 1 ? "" : "s"}
        </span>
      </span>
      {showColleagueBadge ? <Badge tone="neutral">Colleague</Badge> : null}
    </Button>
  );
};

export default DiaryMatterCard;
