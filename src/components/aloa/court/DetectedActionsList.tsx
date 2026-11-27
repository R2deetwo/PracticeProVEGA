/**
 * DetectedActionsList — ROUND 25 (ALOA Vox intelligence overhaul, owner spec
 * 2026-11-28, FEATURE 5). The composer's "Detected actions" block: the
 * extracted courtroom directives rendered as one-tap rows — party deadlines
 * ("the defendants are to file their response" → [Create task]) and personal
 * reminders ("remind me to prepare the written address" → [Create
 * reminder]) — auto-associated with the active matter. The detected NEXT
 * DATE itself surfaces through the one-tap banner in the Next date section.
 * Pure presentation; creation lives in useCourtroomActions.
 */
import React from "react";
import { Check, FileText } from "lucide-react";
import { Button, SectionErrorBoundary } from "../../ui";
import type { CourtroomAction } from "../../../services/voice/courtroomExtraction";
import type { CreatedActionState } from "./useCourtroomActions";
import { formatDayKeyFull } from "./format";

interface DetectedActionsListProps {
  tasks: CourtroomAction[];
  reminders: CourtroomAction[];
  createdActions: Record<string, CreatedActionState>;
  onCreate: (action: CourtroomAction) => void;
}

/** One actionable item — [Create task] / [Create reminder] → "Created". */
const DetectedActionRow: React.FC<{
  action: CourtroomAction;
  state: CreatedActionState | undefined;
  onCreate: () => void;
}> = ({ action, state, onCreate }) => (
  <div className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-2 px-3 py-2">
    <span className="flex min-w-0 flex-1 items-start gap-2">
      {action.kind === "reminder" ? (
        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-subtle" aria-hidden="true" />
      ) : (
        <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-subtle" aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-strong">{action.title}</span>
        <span className="block text-2xs text-subtle">
          {action.kind === "reminder" ? "Reminder" : "Task"}
          {action.dueDayKey ? ` · due ${formatDayKeyFull(action.dueDayKey)}` : ""}
        </span>
      </span>
    </span>
    {state === "done" ? (
      <span className="flex items-center gap-1 text-2xs font-bold text-status-success">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Created
      </span>
    ) : (
      <Button
        variant="secondary"
        size="sm"
        type="button"
        loading={state === "pending"}
        disabled={state === "pending"}
        onClick={onCreate}
      >
        {action.kind === "reminder" ? "Create reminder" : "Create task"}
      </Button>
    )}
  </div>
);

export const DetectedActionsList: React.FC<DetectedActionsListProps> = ({
  tasks,
  reminders,
  createdActions,
  onCreate,
}) => {
  if (tasks.length === 0 && reminders.length === 0) return null;
  return (
    <SectionErrorBoundary sectionName="Detected actions">
      <div className="space-y-2 rounded-sm border border-hairline bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-2xs font-black uppercase tracking-widest text-subtle">Detected actions</p>
        {tasks.map((action) => (
          <DetectedActionRow
            key={`task-${action.title}`}
            action={action}
            state={createdActions[action.title.toLowerCase()]}
            onCreate={() => onCreate(action)}
          />
        ))}
        {reminders.map((action) => (
          <DetectedActionRow
            key={`reminder-${action.title}`}
            action={action}
            state={createdActions[action.title.toLowerCase()]}
            onCreate={() => onCreate(action)}
          />
        ))}
      </div>
    </SectionErrorBoundary>
  );
};

export default DetectedActionsList;
