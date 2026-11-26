import React, { useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * TaskBoardPreview — the interactive Tasks exhibits (2026-11-22 owner
 * direction, reworked 2026-11-25 for Stage 2C), rendered in the app's own
 * register inside the capture frame's seat (container-type: inline-size —
 * every size below is cqw).
 *
 * Owner direction (verbatim shape): "Remove redundant Task list alongside
 * Task board and render Task Board as a true Kanban board view instead of
 * a list. On Team Tasks, ensure tasks can visibly show multiple assignees
 * (not only a single user/avatar), using overlapping avatars in the
 * Assigned column whenever more than one person is assigned to a task."
 *
 * 2026-11-25 honesty correction (Stage 2C): the in-app Tasks view retired
 * its board (drag-and-drop reliability) and now renders a status-grouped
 * list — collapsible To Do / In Progress / Done sections with task rows.
 * This exhibit now mirrors THAT presentation so the marketing matches the
 * product: same sections, same cards, same one-tap status change (status
 * changes are real in-app behaviour; the board geography is not).
 *
 * THE TWO VIEWS:
 *   • view="taskboard" — the status-grouped task list: To Do · In
 *     Progress · Done sections stacked in reading order, rows carrying
 *     the matter chip, the due date, the priority pill and the assignee
 *     stack. Clicking a row advances it one status — the list is alive,
 *     not a picture.
 *   • view="teamtasks" — the per-counsel table: person filter pills
 *     (counts = the tasks each person owns, all statuses, matching the
 *     rows the filter shows), status-grouped sections, and the
 *     ASSIGNED column rendering OVERLAPPING AVATARS whenever a task has
 *     co-assignees.
 *
 * HONESTY: the app's task model carries assignedUsers[] and its task
 * list already renders overlapping stacks for co-assigned tasks — the
 * preview demonstrates the real behaviour, with the real demo firm's
 * task titles and people, under the same quiet Preview chip as every
 * other demo surface. All state is local; nothing leaves the browser.
 *
 * compact: the suite-panel seat (~560px wide) renders the same layout
 * at ~1.85× the relative type scale so it stays legible beside the
 * lightbox stage.
 */

type PreviewStatus = 'todo' | 'in_progress' | 'done';

interface DemoTask {
    id: string;
    title: string;
    matter: string | null;
    due: string;
    urgent: boolean;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    status: PreviewStatus;
    assignees: string[];
}

/** The roster — the people in the tasks captures (Seun, Kemi, Tunde),
 *  with the avatar fills the captures wear. */
const PEOPLE: { initials: string; name: string; avatarClass: string }[] = [
    { initials: 'SB', name: 'Seun', avatarClass: 'bg-indigo-600 text-white' },
    { initials: 'KO', name: 'Kemi', avatarClass: 'bg-orange-600 text-white' },
    { initials: 'TA', name: 'Tunde', avatarClass: 'bg-emerald-600 text-white' },
];

/** The board — the demo firm's real task titles (the tasks-status /
 *  tasks-team captures), with co-assignees on the shared files. */
const DEMO_TASKS: DemoTask[] = [
    { id: 't1', title: 'Weekly Report to Managing Partner', matter: null, due: 'Due tomorrow', urgent: true, priority: 'MEDIUM', status: 'todo', assignees: ['SB'] },
    { id: 't2', title: 'Review Portfolio Spreadsheets', matter: null, due: 'Due in 14 days', urgent: false, priority: 'LOW', status: 'todo', assignees: ['SB'] },
    { id: 't3', title: 'Client Meeting: Divorce Terms', matter: 'Family Matter', due: 'Due in 3 days', urgent: false, priority: 'HIGH', status: 'todo', assignees: ['KO', 'TA'] },
    { id: 't4', title: 'Halfway Point: Finalize Court Brief', matter: 'Industrial Corp v. State Authority', due: 'Due tomorrow', urgent: true, priority: 'HIGH', status: 'in_progress', assignees: ['SB', 'TA'] },
    { id: 't5', title: 'File Statement of Claim', matter: 'N.A. v. Z-Alpha Bank PLC', due: 'Due in 2 days', urgent: true, priority: 'HIGH', status: 'in_progress', assignees: ['KO'] },
    { id: 't6', title: 'Prepare Witness Statements', matter: 'Industrial Corp v. State Authority', due: 'Completed', urgent: false, priority: 'MEDIUM', status: 'done', assignees: ['TA', 'KO'] },
];

const NEXT_STATUS: Record<PreviewStatus, PreviewStatus> = {
    todo: 'in_progress',
    in_progress: 'done',
    done: 'todo',
};

const STATUS_LABEL: Record<PreviewStatus, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    done: 'Done',
};
const STATUS_PILL: Record<PreviewStatus, string> = {
    todo: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
};
const STATUS_DOT: Record<PreviewStatus, string> = {
    todo: 'bg-slate-400',
    in_progress: 'bg-blue-500',
    done: 'bg-green-500',
};
const PRIORITY_PILL: Record<DemoTask['priority'], string> = {
    HIGH: 'bg-red-100 text-red-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-blue-100 text-blue-700',
};

const personByInitials = (i: string) => PEOPLE.find((p) => p.initials === i)!;

/** The overlapping assignee stack — the multi-assignee display the owner
 *  asked for: one circle per assignee, ringed white, gently overlapped. */
const AssigneeStack: React.FC<{ initials: string[]; size: number; max?: number }> = ({ initials, size, max = 3 }) => {
    const shown = initials.slice(0, max);
    const extra = initials.length - shown.length;
    return (
        <span className="relative flex items-center" style={{ height: `${size}cqw` }} aria-label={initials.map((i) => personByInitials(i).name).join(', ')}>
            {shown.map((i, idx) => {
                const p = personByInitials(i);
                return (
                    <span
                        key={i}
                        title={p.name}
                        className={`relative flex items-center justify-center rounded-full ring-2 ring-white shadow-sm font-bold ${p.avatarClass}`}
                        style={{
                            height: `${size}cqw`, width: `${size}cqw`,
                            marginLeft: idx === 0 ? 0 : `${-size * 0.3}cqw`,
                            fontSize: `${size * 0.42}cqw`,
                            zIndex: shown.length - idx,
                        }}
                    >
                        {i}
                    </span>
                );
            })}
            {extra > 0 && (
                <span
                    className="relative flex items-center justify-center rounded-full bg-slate-700 text-white ring-2 ring-white font-bold"
                    style={{
                        height: `${size}cqw`, width: `${size}cqw`,
                        marginLeft: `${-size * 0.3}cqw`,
                        fontSize: `${size * 0.38}cqw`,
                        zIndex: 0,
                    }}
                >
                    +{extra}
                </span>
            )}
        </span>
    );
};

const PreviewChip: React.FC<{ scale: (v: number) => number }> = ({ scale }) => (
    <span
        className="font-mono font-semibold uppercase tracking-[0.14em] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full"
        style={{ fontSize: `${scale(0.72)}cqw`, padding: `${scale(0.22)}cqw ${scale(0.7)}cqw` }}
    >
        Preview
    </span>
);

export const TaskBoardPreview: React.FC<{
    view: 'taskboard' | 'teamtasks';
    /** The suite-panel seat renders at a larger relative type scale. */
    compact?: boolean;
}> = ({ view, compact = false }) => {
    const scale = (v: number) => (compact ? v * 1.85 : v);
    const s = (v: number) => `${scale(v).toFixed(3)}cqw`;

    const [tasks, setTasks] = useState<DemoTask[]>(DEMO_TASKS);
    const [personFilter, setPersonFilter] = useState<string | null>(null);

    const advance = (id: string) =>
        setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: NEXT_STATUS[t.status] } : t)));

    /* The pill count = the tasks each person OWNS (all statuses), so the
     * number always matches the rows the filter shows — the Done section
     * is part of a person's board, and a count that silently excluded it
     * read as a bug ("Kemi · 2" over three Kemi rows). */
    const taskCount = (initials: string | null) =>
        initials === null
            ? tasks.length
            : tasks.filter((t) => t.assignees.includes(initials)).length;

    /* The compact (suite-panel) seat caps what it shows — a row per section
     * truncates ugly at ~560px, so it pages the first two and points at
     * the full view; the lightbox stage shows everything. */
    const PER_SECTION = compact ? 2 : 99;

    /* ── THE STATUS-GROUPED TASK LIST (the app's live Tasks presentation —
        sections stacked in reading order, rows one tap from the next
        status). ── */
    if (view === 'taskboard') {
        const sections: PreviewStatus[] = ['todo', 'in_progress', 'done'];
        return (
            <div className="relative h-full w-full bg-white flex flex-col overflow-hidden" style={{ fontSize: s(1) }}>
                {/* The list header — the app's own furniture (title, the
                    group-by indicator), plus the quiet Preview chip. */}
                <div className="flex items-center justify-between gap-[1cqw] px-[1.4cqw] py-[0.9cqw] border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-baseline gap-[1cqw] min-w-0">
                        <span className="font-bold text-slate-900" style={{ fontSize: s(1.5) }}>Tasks</span>
                        <span className="font-mono uppercase tracking-widest text-slate-400" style={{ fontSize: s(0.78) }}>Grouped by status</span>
                    </div>
                    <PreviewChip scale={scale} />
                </div>
                {/* The sections — To Do / In Progress / Done stacked in
                    reading order (the app's collapsed-by-default groups,
                    shown open so the exhibit reads at a glance). The compact
                    seat reserves a bottom band (9cqw — the host's Expand chip
                    height) so nothing runs under it. */}
                <div className={`flex-1 min-h-0 overflow-hidden px-[1.4cqw] py-[1cqw] flex flex-col gap-[0.9cqw] ${compact ? 'pb-[9cqw]' : ''}`}>
                    {sections.map((section) => {
                        const all = tasks.filter((t) => t.status === section);
                        const rows = all.slice(0, PER_SECTION);
                        const extra = all.length - rows.length;
                        return (
                            <div key={section} className="min-w-0 flex flex-col gap-[0.5cqw]">
                                <div className="flex items-center gap-[0.6cqw] px-[0.3cqw]">
                                    <span className={`h-[0.7cqw] w-[0.7cqw] rounded-full ${STATUS_DOT[section]}`} aria-hidden="true" />
                                    <span className="font-mono uppercase tracking-widest font-semibold text-slate-500" style={{ fontSize: s(0.85) }}>
                                        {STATUS_LABEL[section]}
                                    </span>
                                    <span className="flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 font-bold" style={{ fontSize: s(0.75), width: s(1.5), height: s(1.5) }}>
                                        {all.length}
                                    </span>
                                </div>
                                {rows.map((t) => (
                                    <Button
                                        key={t.id}
                                        variant="bare"
                                        onClick={() => advance(t.id)}
                                        aria-label={`${t.title} — advance to ${STATUS_LABEL[NEXT_STATUS[t.status]]}`}
                                        className="group/card relative w-full text-left rounded-[0.6cqw] border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md active:scale-[0.98] transition-all flex flex-col gap-[0.55cqw] focus-visible:ring-2 focus-visible:ring-indigo-500"
                                        style={{ padding: s(0.85) }}
                                    >
                                        <span className="font-semibold text-slate-900 leading-snug" style={{ fontSize: s(1.05) }}>
                                            {t.title}
                                        </span>
                                        <span className="flex items-center gap-[0.7cqw] min-w-0">
                                            {t.matter ? (
                                                <span className="inline-block self-start rounded bg-slate-100 text-slate-500 font-medium truncate max-w-full" style={{ fontSize: s(0.8), padding: `${s(0.22)} ${s(0.6)}` }}>
                                                    {t.matter}
                                                </span>
                                            ) : (
                                                <span className="italic text-slate-400 truncate" style={{ fontSize: s(0.8) }}>No matter</span>
                                            )}
                                            <span className={`font-bold ${t.status === 'done' ? 'text-slate-400' : t.urgent ? 'text-amber-600' : 'text-slate-500'}`} style={{ fontSize: s(0.85) }}>
                                                {t.due}
                                            </span>
                                            <span className={`rounded-full font-bold uppercase tracking-wide ${PRIORITY_PILL[t.priority]}`} style={{ fontSize: s(0.72), padding: `${s(0.18)} ${s(0.6)}` }}>
                                                {t.priority}
                                            </span>
                                            <span className="ml-auto flex-shrink-0">
                                                <AssigneeStack initials={t.assignees} size={scale(1.6)} />
                                            </span>
                                        </span>
                                        {/* The advance affordance — visible on
                                            hover/focus, quiet at rest. */}
                                        <span
                                            aria-hidden="true"
                                            className="pointer-events-none absolute top-[0.5cqw] right-[0.5cqw] rounded-full bg-indigo-600 text-white font-semibold opacity-0 scale-95 group-hover/card:opacity-100 group-hover/card:scale-100 group-focus-visible/card:opacity-100 transition-all"
                                            style={{ fontSize: s(0.72), padding: `${s(0.2)} ${s(0.65)}` }}
                                        >
                                            Advance →
                                        </span>
                                    </Button>
                                ))}
                                {extra > 0 && (
                                    <span className="font-mono text-slate-400 truncate" style={{ fontSize: s(0.78) }}>
                                        +{extra} more — open the full view
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ── THE TEAM TABLE — per-counsel, with the overlapping
        multi-assignee stacks in the Assigned column. ── */
    const visible = personFilter === null ? tasks : tasks.filter((t) => t.assignees.includes(personFilter));
    const sections: PreviewStatus[] = ['todo', 'in_progress', 'done'];
    return (
        <div className="relative h-full w-full bg-white flex flex-col overflow-hidden" style={{ fontSize: s(1) }}>
            {/* The header — the person filter pills (counts computed from
                the data), plus the quiet Preview chip. */}
            <div className="flex items-center justify-between gap-[1cqw] px-[1.4cqw] py-[0.9cqw] border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-[0.6cqw] min-w-0 overflow-x-auto">
                    <Button
                        variant="bare"
                        aria-pressed={personFilter === null}
                        onClick={() => setPersonFilter(null)}
                        className={`flex-shrink-0 rounded-full border font-semibold transition-colors ${personFilter === null ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                        style={{ fontSize: s(0.88), padding: `${s(0.4)} ${s(1)}` }}
                    >
                        All Users · {taskCount(null)}
                    </Button>
                    {PEOPLE.map((p) => (
                        <Button
                            key={p.initials}
                            variant="bare"
                            aria-pressed={personFilter === p.initials}
                            onClick={() => setPersonFilter(personFilter === p.initials ? null : p.initials)}
                            className={`flex-shrink-0 inline-flex items-center gap-[0.5cqw] rounded-full border font-semibold transition-colors ${personFilter === p.initials ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                            style={{ fontSize: s(0.88), padding: `${s(0.4)} ${s(1)}` }}
                        >
                            <span className={`flex items-center justify-center rounded-full font-bold ${personFilter === p.initials ? 'bg-white/25 text-white' : p.avatarClass}`} style={{ width: s(1.35), height: s(1.35), fontSize: s(0.62) }}>
                                {p.initials}
                            </span>
                            {p.name} · {taskCount(p.initials)}
                        </Button>
                    ))}
                </div>
                <PreviewChip scale={scale} />
            </div>
            {/* The table — status-grouped sections, the Assigned column
                carrying the overlapping stacks. The compact seat caps rows
                per section and reserves a bottom band (9cqw) for the
                host's Expand chip. */}
            <div className={`flex-1 min-h-0 overflow-hidden px-[1.4cqw] py-[1cqw] flex flex-col gap-[0.9cqw] ${compact ? 'pb-[9cqw]' : ''}`}>
                {/* Column header row */}
                <div
                    className="grid items-center gap-[0.8cqw] font-mono uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-[0.5cqw]"
                    style={{ fontSize: s(0.78), gridTemplateColumns: '31cqw 15cqw 10cqw 11cqw 9cqw 12cqw' }}
                    aria-hidden="true"
                >
                    <span>Task</span>
                    <span>Matter</span>
                    <span className="text-center">Assigned</span>
                    <span>Due date</span>
                    <span>Priority</span>
                    <span>Status</span>
                </div>
                {sections.map((sec) => {
                    const all = visible.filter((t) => t.status === sec);
                    if (all.length === 0) return null;
                    const rows = all.slice(0, PER_SECTION);
                    const extra = all.length - rows.length;
                    return (
                        <div key={sec} className="flex flex-col gap-[0.5cqw]">
                            <div className="flex items-center gap-[0.6cqw]">
                                <span className={`h-[0.75cqw] w-[0.75cqw] rounded-sm ${STATUS_DOT[sec]}`} aria-hidden="true" />
                                <span className="font-mono uppercase tracking-widest font-semibold text-slate-500" style={{ fontSize: s(0.82) }}>
                                    {STATUS_LABEL[sec]} ({all.length})
                                </span>
                                {extra > 0 && (
                                    <span className="font-mono text-slate-400" style={{ fontSize: s(0.75) }}>
                                        +{extra} more in the full view
                                    </span>
                                )}
                            </div>
                            {rows.map((t) => (
                                <div
                                    key={t.id}
                                    className="grid items-center gap-[0.8cqw] rounded-[0.5cqw] border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                                    style={{ padding: `${s(0.55)} ${s(0.8)}`, gridTemplateColumns: '31cqw 15cqw 10cqw 11cqw 9cqw 12cqw' }}
                                >
                                    <span className="font-semibold text-slate-900 truncate" style={{ fontSize: s(1) }} title={t.title}>
                                        {t.title}
                                    </span>
                                    {t.matter ? (
                                        <span className="rounded bg-slate-100 text-slate-500 font-medium truncate" style={{ fontSize: s(0.8), padding: `${s(0.2)} ${s(0.55)}` }}>
                                            {t.matter}
                                        </span>
                                    ) : (
                                        <span className="italic text-slate-400" style={{ fontSize: s(0.85) }}>No matter</span>
                                    )}
                                    <span className="flex justify-center">
                                        <AssigneeStack initials={t.assignees} size={scale(1.7)} />
                                    </span>
                                    <span className={`font-bold ${t.status === 'done' ? 'text-slate-400' : t.urgent ? 'text-amber-600' : 'text-slate-500'}`} style={{ fontSize: s(0.88) }}>
                                        {t.due}
                                    </span>
                                    <span>
                                        <span className={`inline-block rounded-full font-bold uppercase tracking-wide ${PRIORITY_PILL[t.priority]}`} style={{ fontSize: s(0.72), padding: `${s(0.18)} ${s(0.6)}` }}>
                                            {t.priority}
                                        </span>
                                    </span>
                                    <span>
                                        <span className={`inline-block rounded-full font-bold uppercase tracking-wide ${STATUS_PILL[t.status]}`} style={{ fontSize: s(0.72), padding: `${s(0.18)} ${s(0.6)}` }}>
                                            {STATUS_LABEL[t.status]}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
