import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NotePage, User, ModalType, UserRole, TaskStatus, TaskPriority } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { CalendarIcon, TasksIcon, TrashIcon, PlusIcon, EditIcon, CheckIcon, XIcon, MicrophoneIcon, SparklesIcon, DocumentIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useMatterState } from '../../contexts/MatterContext';
import { sanitize } from '../../utils/sanitization';
import { useFieldDictation } from '../../hooks/useFieldDictation';
import { useEndorsementNotify } from '../../hooks/useEndorsementNotify';
import { extractDatedMention, formatDatedMention, endorsementTitleFrom } from '../../utils/endorsementDateParser';
import { formatEndorsement } from '../../services/voice/voiceCaptureService';
import {
    endorsementCounselOf,
    endorsementOrderMs,
    endorsementSittingDayKey,
    formatEndorsementJacket,
} from '../aloa/courtModeUtils';
import { Button, Input } from '../ui';

/** Notes authored elsewhere (DraftPro, ALOA drafts) can carry rich HTML.
 *  Rendered as sanitized rich text in the timeline — raw tags never show. */
const looksLikeHtml = (s: string) =>
    /<\/(p|h[1-6]|ol|ul|li|strong|em|b|i|div|blockquote|table)\s*>|<br\s*\/?>/i.test(s || '');

/** Coerce a spoken/event type against the firm's real event-type names —
 * same rules as TriageCard's identical helper. */
function coerceEventType(type: string | undefined, eventTypeNames: string[]): string {
    if (!type) return eventTypeNames[0] || 'Meeting';
    const exact = eventTypeNames.find((t) => t.toLowerCase() === type.toLowerCase());
    if (exact) return exact;
    const partial = eventTypeNames.find(
        (t) => t.toLowerCase().includes(type.toLowerCase()) || type.toLowerCase().includes(t.toLowerCase())
    );
    return partial || eventTypeNames[0] || 'Meeting';
}

/** Local YYYY-MM-DD for an <Input type="date"> value (today by default). */
const todayKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** "26 Nov" (en-GB) for a sitting-day key or an ISO date. */
const shortDateOf = (value: string): string => {
    if (!value) return '';
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return '';
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** ROUND 23 — who the record itself names as the attending counsel. Order of
 *  authority: the note's authorId (the recording counsel), then the jacket's
 *  first Appearances line, then the legacy "Endorsement by {name}" title.
 *  "System" is NEVER shown — no name on record renders the card unnamed. */
const authorNameOf = (note: NotePage, users: User[]): string | null => {
    const byId = users.find((u) => u.id === note.authorId);
    if (byId?.name) return byId.name;
    const fromJacket = endorsementCounselOf(note.content || '');
    if (fromJacket) return fromJacket;
    const fromTitle = /^Endorsement by (.+)$/i.exec(note.title || '');
    return fromTitle ? fromTitle[1].trim() : null;
};

/** The date label for one timeline entry: the jacket's SITTING date when the
 *  record carries one, else the save moment. */
const sittingDateLabelOf = (note: NotePage): string =>
    shortDateOf(endorsementSittingDayKey(note.content || '') || note.createdAt || '') || shortDateOf(note.createdAt || '');

interface TeamDiscussionTabProps {
    matterId: string;
    notes: NotePage[];
    users: User[];
    currentUser: User;
    onAddNote: (matterId: string, title: string, content: string, type?: 'user' | 'endorsement') => void | Promise<void>;
    onUpdateNote: (note: NotePage) => void | Promise<void>;
    onDeleteNote: (noteId: string, noteTitle: string) => void;
    openModal: (type: ModalType, id: string | null, context?: any) => void;
    lastViewedAt: number;
    filterType?: 'all' | 'user' | 'endorsement';
}

const EndorsementTimelineItem: React.FC<{
    note: NotePage;
    users: User[];
    currentUser: User;
    onDelete: (noteId: string, noteTitle: string) => void;
    onUpdate: (note: NotePage) => void | Promise<void>;
    isLast: boolean;
}> = ({ note, users, currentUser, onDelete, onUpdate, isLast }) => {

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);
    const canManage = currentUser.id === note.authorId || currentUser.role === UserRole.Admin;

    const authorName = authorNameOf(note, users);
    // The institutional record marks its own edit history: an updatedAt
    // meaningfully after the create is an edit (existing schema fields only).
    const wasEdited =
        new Date(note.updatedAt || note.createdAt || '').getTime() - new Date(note.createdAt || '').getTime() >
        60_000;

    const handleSave = async () => {
        if (!editContent.trim()) return;
        await onUpdate({ ...note, content: editContent, updatedAt: new Date().toISOString() });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(note.content);
        setIsEditing(false);
    };

    return (
        <div className="flex gap-3 relative group">
            {/* Timeline Line — tighter between cards (ROUND 23) */}
            {!isLast && (
                <div className="absolute left-[17px] top-9 bottom-[-6px] w-px bg-slate-200 dark:bg-zinc-700 z-0"></div>
            )}

            {/* Avatar — the ATTENDING COUNSEL's moniker (e.g. "CU"); never "System". */}
            <div className={`
                relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-2xs shadow-sm ring-4 ring-slate-50 dark:ring-zinc-900 flex-shrink-0
                ${authorName ? getUserColor(authorName) : 'bg-slate-400 dark:bg-zinc-600'}
            `}>
                {authorName ? getInitials(authorName) : <DocumentIcon className="w-4 h-4" />}
            </div>

            {/* Content Bubble — tighter padding and spacing (ROUND 23) */}
            <div className="flex-grow pb-3 min-w-0">
                <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg rounded-tl-none p-3 shadow-sm relative hover:shadow-md transition-shadow">

                    <div className="flex justify-between items-start mb-1.5">
                        <div className="flex flex-col gap-0.5">
                            {/* Plain notes lead with their TITLE; endorsements
                                carry no meaningful title — the record itself is
                                the content (kept distinct, owner spec §2). */}
                            {note.type !== 'endorsement' && note.title ? (
                                <span className="text-sm font-bold text-slate-900 dark:text-white break-words">
                                    {note.title}
                                </span>
                            ) : null}
                            {authorName ? (
                                <span className={`text-sm ${note.type !== 'endorsement' ? 'font-medium text-slate-500 dark:text-zinc-400' : 'font-bold text-slate-900 dark:text-white'}`}>
                                    {authorName}
                                </span>
                            ) : null}
                            <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium">
                                {sittingDateLabelOf(note)}
                                {wasEdited ? ' · edited' : ''}
                            </span>
                        </div>

                        {canManage && !isEditing && (
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-slate-400 hover:text-primary-600 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                                    title="Edit Endorsement"
                                >
                                    <EditIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => onDelete(note.id, note.title)}
                                    className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                                    title="Delete Endorsement"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    {isEditing ? (
                        <div className="space-y-2.5">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 focus:ring-2 focus:ring-primary-500 min-h-[100px] outline-none"
                            />
                            <p className="text-2xs text-slate-400 dark:text-zinc-500">
                                Edit the record and its dates directly — saving logs your name, the matter and the time to the firm activity trail and notifies everyone on the matter.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button onClick={handleCancel} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <XIcon className="w-3.5 h-3.5" /> Cancel
                                </button>
                                <button onClick={() => void handleSave()} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-700 transition-all flex items-center gap-1.5">
                                    <CheckIcon className="w-3.5 h-3.5" /> Save Changes
                                </button>
                            </div>
                        </div>
                    ) : looksLikeHtml(note.content) ? (
                        /* Rich notes (DraftPro/ALOA-authored) render as sanitized
                         * HTML — headings and lists read as written, never as
                         * a wall of tags. */
                        <div
                            className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed break-words prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:mb-2 prose-headings:mt-3 prose-li:my-0.5"
                            dangerouslySetInnerHTML={{ __html: sanitize(note.content) }}
                        />
                    ) : (
                        <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                            {note.content}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TeamDiscussionTab: React.FC<TeamDiscussionTabProps> = ({ matterId, notes, users, currentUser, onAddNote, onUpdateNote, openModal, onDeleteNote, filterType = 'all' }) => {
    // ROUND 23 (owner spec §2): the entry box is NOT always open — court and
    // outcome entries normally arrive through the court/outcome workflows, so
    // the timeline stays clean by default and the header's NEW ENDORSEMENT
    // trigger drops the compose box down on demand.
    const [composerOpen, setComposerOpen] = useState(false);
    const [sittingDate, setSittingDate] = useState(todayKey());
    const [content, setContent] = useState('');
    const [formatting, setFormatting] = useState(false);
    const { addToast } = useUI();
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    const { addItem, handleAddTask, logActivity } = useDataActions();
    const notifyEndorsement = useEndorsementNotify();

    // The composer value mirrored in a ref — formatting applies its result
    // only when the field still holds exactly what was sent, so the
    // lawyer's fresher keystrokes are never overwritten mid-flight.
    const contentRef = useRef(content);
    useEffect(() => { contentRef.current = content; }, [content]);
    // Double-trigger guard: auto-format-on-stop and the manual Format
    // button share one in-flight slot.
    const formattingRef = useRef(false);

    // ── ALOA VOX in the composer (owner brief 2026-11-24: "when you say
    //    post endorsement… we should have the ability to use Aloa Vox").
    //    The mic dictates straight into the endorsement box — the same
    //    Whisper→Gemini transcription engine the rest of the app uses,
    //    appending near-live every ~10 seconds. On stop, once the final
    //    drain settles and words actually landed, the dictated endorsement
    //    auto-formats (the same engine as the manual Format button).
    const dictation = useFieldDictation({
        onAppend: (text) => {
            setContent((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${text}` : text));
        },
        onError: (message, opts) => addToast(message, opts),
        onFinish: ({ appended }) => {
            if (appended) void runFormat();
        },
    });

    const eventTypeNames = useMemo(
        () => (coreState.eventTypes || []).map((t: any) => t.name).filter(Boolean) as string[],
        [coreState.eventTypes]
    );
    const matter = useMemo(
        () => (matterState.matters || []).find((m: any) => m.id === matterId || m._id === matterId),
        [matterState.matters, matterId]
    );
    const matterTitle: string | undefined = matter?.title;
    const matterSuitNumber: string | undefined = matter?.suitNumber;

    // ── FORMAT THE ENDORSEMENT (owner brief 2026-11-24 + audit follow-up
    //    2026-11-25): one shared engine for the manual Format button and the
    //    auto-format that fires when dictation stops. Filler out, structure
    //    in — every fact frozen exactly as dictated (the backend prompt
    //    forbids inventing dates, coram, amounts or citations). Guards:
    //    (a) one in-flight call at a time (no double-trigger), (b) the
    //    result applies only when the field still holds the snapshot that
    //    was sent — fresher user edits win.
    const runFormat = async () => {
        if (formattingRef.current) return;
        const snapshot = contentRef.current;
        if (!snapshot.trim()) return;
        formattingRef.current = true;
        setFormatting(true);
        try {
            const { formatted } = await formatEndorsement({
                endorsementText: snapshot,
                matterTitle,
                matterSuitNumber,
            });
            if (contentRef.current === snapshot) {
                setContent(formatted);
                addToast('Endorsement formatted — check it before posting.', { type: 'success', duration: 5000 });
            }
        } catch (e: any) {
            addToast(e?.message || 'Formatting failed — your words are unchanged.', { type: 'error' });
        } finally {
            formattingRef.current = false;
            setFormatting(false);
        }
    };

    // ROUND 23 — one choke point for posting an endorsement note. The record
    // saves as the standard Nigerian file jacket: Date (the SITTING date, so a
    // missed sitting backdates cleanly into chronological order), Appearances
    // (from the matter's own parties), the lawyer's words, and no
    // Next-Adjourned-Date line (a next date is set through the outcome flow).
    const postEndorsementNote = async (): Promise<void> => {
        const assignedUsers = matter?.assignedUsers || [];
        const isColleaguesMatter = assignedUsers.length > 0 && !assignedUsers.includes(currentUser.id);
        const title =
            `Endorsement — ${matterTitle || 'Matter'}` +
            (isColleaguesMatter ? ` (brief held by ${currentUser.name})` : '');
        const jacket = formatEndorsementJacket({
            matter: matter as any,
            viewerName: currentUser.name,
            bodyText: content,
            nowISO: sittingDate || todayKey(),
            nextDate: null,
        });
        await onAddNote(matterId, title, jacket, 'endorsement');
        // ROUND 23 (owner spec §4): the matter's attached users are notified
        // — best-effort, never blocks or alarms.
        notifyEndorsement({ matterId, action: 'created', snippet: content.trim().slice(0, 90) });
    };

    const closeComposer = () => {
        setComposerOpen(false);
        setContent('');
        setSittingDate(todayKey());
    };

    const handlePost = async () => {
        if (!content.trim()) return;
        try {
            await postEndorsementNote();
            closeComposer();
        } catch {
            /* addItem already surfaced the server's verbatim rejection —
             * the composer stays open with the text intact. */
        }
    };

    // ROUND 23 — editing an endorsement also writes the institutional audit
    // row and notifies the matter's attached users (legal record standards).
    const handleUpdateNoteWithAudit = async (note: NotePage) => {
        await onUpdateNote(note);
        if (note.type === 'endorsement') {
            logActivity('Edited an endorsement', 'Matter', matterId, matterTitle || 'Matter', matterId);
            notifyEndorsement({
                matterId,
                noteId: note.id,
                action: 'edited',
                snippet: (note.content || '').trim().slice(0, 90),
            });
        }
    };

    // ── ONE-CLICK TASK (owner brief 2026-11-24: "Should this not be
    //    automatically recorded? Must there be some extra step… before it
    //    can be logged as something that will enter the calendar…?").
    //    The endorsement is posted AND the task is created directly — no
    //    form round-trip. The first line becomes the task title; a spoken
    //    date ("file before 12/03/2026") becomes the due date. No date →
    //    no due date (never fabricate a legal deadline). handleAddTask is
    //    the same pipeline TaskForm uses (offline queue, notifications).
    const handleCreateTask = async () => {
        if (!content.trim()) {
            addToast(`Please type or dictate the endorsement first to convert it to a task.`, { type: 'error' });
            return;
        }
        const dated = extractDatedMention(content);
        const title = endorsementTitleFrom(content);
        try {
            await handleAddTask({
                title,
                description: content,
                status: TaskStatus.Todo,
                dueDate: dated ? dated.date.toISOString() : null,
                assignedUsers: [currentUser.id],
                assigneeType: 'team',
                isSharedWithPortal: false,
                matterId,
                priority: TaskPriority.Medium,
            });
            await postEndorsementNote();
            closeComposer();
            if (dated) {
                addToast(`Task due ${formatDatedMention(dated)} — read from the endorsement.`, { type: 'success', duration: 6000 });
            } else if (matterTitle) {
                addToast(`Task created for ${matterTitle} (no date in the endorsement — open it in Tasks to add a due date).`, { type: 'info', duration: 6000 });
            }
        } catch (e: any) {
            addToast(e?.message || 'Could not create the task — the endorsement was not posted.', { type: 'error' });
        }
    };

    // ── ONE-CLICK EVENT: posted + on the calendar immediately. A spoken
    //    date lands the event on that date (time-of-day if spoken, else
    //    09:00 — the court convention); no date → today 09:00, stated
    //    plainly in the toast so nothing happens silently.
    //    ROUND 23 (parity): the event carries the matter's court, judicial
    //    division and its team as attendees — the same wiring the Court
    //    Mode outcome flow uses, so the item shows on the main calendar
    //    AND in the court diary/date picker (shared date-key wiring).
    const handleCreateEvent = async () => {
        if (!content.trim()) {
            addToast(`Please type or dictate the endorsement first to convert it to an event.`, { type: 'error' });
            return;
        }
        const dated = extractDatedMention(content);
        const title = endorsementTitleFrom(content);
        const base = dated ? dated.date : new Date();
        const timeMinutes = dated?.timeMinutes ?? 9 * 60;
        const hours = Math.floor(timeMinutes / 60);
        const minutes = timeMinutes % 60;
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        try {
            await addItem('events', {
                title,
                description: content,
                matterTitle,
                type: coerceEventType('Mention', eventTypeNames),
                date: start.toISOString(),
                endDate: end.toISOString(),
                matterId,
                status: 'Active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                court: matter?.court,
                judicialDivision: matter?.judicialDivision,
                assignedUsers: (matter?.assignedUsers || []).length > 0 ? matter!.assignedUsers : [currentUser.id],
            }, `Event: ${title}`);
            await postEndorsementNote();
            closeComposer();
            const when = start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
            addToast(
                dated
                    ? `Added to the diary for ${formatDatedMention(dated)} — tap it on the calendar to adjust.`
                    : `No date found in the endorsement — added for ${when}. Tap it on the calendar to move it.`,
                { type: 'success', duration: 6000 }
            );
        } catch (e: any) {
            addToast(e?.message || 'Could not create the event — the endorsement was not posted.', { type: 'error' });
        }
    };

    // ROUND 23 — chronological order by the SITTING date (the jacket's Date
    // line), falling back to the save moment: a missed or earlier
    // endorsement posted today slots cleanly BETWEEN the existing records.
    const matterNotes = (Array.isArray(notes) ? notes : [])
        .filter(n => n.matterId === matterId && (n.type === 'endorsement' || n.type === 'user'));
    const endorsements = matterNotes
        .filter(n => filterType !== 'user' && n.type === 'endorsement')
        .sort((a, b) => endorsementOrderMs(b) - endorsementOrderMs(a) || (b.id || '').localeCompare(a.id || ''));
    const plainNotes = matterNotes
        .filter(n => filterType !== 'endorsement' && n.type === 'user')
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

    const lastEndorsement = endorsements[0] || null;
    const previousEndorsements = endorsements.slice(1);

    const timelineItem = (note: NotePage, isLast: boolean) => (
        <EndorsementTimelineItem
            key={note.id}
            note={note}
            users={users}
            currentUser={currentUser}
            onDelete={onDeleteNote}
            onUpdate={handleUpdateNoteWithAudit}
            isLast={isLast}
        />
    );

    return (
        <div className="max-w-3xl mx-auto py-2">
            {/* 1. Header row — the section label + the NEW ENDORSEMENT trigger
             *    (owner spec §2: the entry box is never permanently open). */}
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-primary-500 rounded-full" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                        {filterType === 'user' ? 'Notes' : 'Endorsements'}
                    </h3>
                </div>
                {filterType !== 'user' ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={PlusIcon}
                        onClick={() => setComposerOpen(true)}
                    >
                        New Endorsement
                    </Button>
                ) : null}
            </div>

            {/* 2. The entry box — dropped down on demand only. */}
            {composerOpen ? (
                <div className="mb-6 bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-slate-200 dark:border-zinc-700 overflow-hidden ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="p-1">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write or dictate the endorsement… (tap the mic below to dictate)"
                            className="w-full border-none focus:ring-0 resize-none p-4 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 bg-transparent min-h-[120px]"
                        />
                    </div>

                    {/* Toolbar */}
                    <div className="bg-slate-50 dark:bg-zinc-900/50 px-3 py-2 flex flex-wrap gap-3 items-center justify-between border-t border-slate-100 dark:border-zinc-700">
                        <div className="flex gap-1 flex-wrap items-center">
                            {/* Sitting date — the jacket's Date line. Defaults to
                             * today; backdate a missed sitting and it slots into
                             * chronological order (owner spec §2). */}
                            <Input
                                type="date"
                                label="Sitting date"
                                value={sittingDate}
                                onChange={(e) => setSittingDate(e.target.value || todayKey())}
                                aria-label="Sitting date"
                                className="w-40"
                                containerClassName="!mb-0"
                            />
                            {/* ALOA VOX mic — dictates into this box. Recording
                                state is unmistakable (red pulse + timer). */}
                            {dictation.supported ? (
                                <Button
                                    variant="bare"
                                    size="sm"
                                    onClick={dictation.toggle}
                                    aria-label={dictation.isRecording ? 'Stop dictation' : 'Dictate endorsement with Aloa Vox'}
                                    title={dictation.isRecording ? 'Stop dictation' : 'Dictate with Aloa Vox'}
                                    aria-pressed={dictation.isRecording}
                                    className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-semibold transition-all ${
                                        dictation.isRecording
                                            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700'
                                    }`}
                                >
                                    <span className="relative flex items-center justify-center">
                                        {dictation.isRecording && (
                                            <span
                                                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <MicrophoneIcon className={`w-4 h-4 relative ${dictation.isRecording ? 'text-red-500' : ''}`} />
                                    </span>
                                    {dictation.isRecording ? (
                                        <span className="tabular-nums whitespace-nowrap">
                                            {dictation.elapsedSeconds >= 60
                                                ? `${Math.floor(dictation.elapsedSeconds / 60)}:${String(dictation.elapsedSeconds % 60).padStart(2, '0')}`
                                                : `${dictation.elapsedSeconds}s`}
                                            {dictation.status === 'processing' ? ' · transcribing…' : ' · recording'}
                                        </span>
                                    ) : (
                                        <span className="whitespace-nowrap">Vox</span>
                                    )}
                                </Button>
                            ) : null}
                            <button
                                onClick={handleCreateTask}
                                title="Post endorsement & create the task immediately — a spoken date becomes the due date"
                                className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                            >
                                <TasksIcon className="w-4 h-4" /> <span>+ Task</span>
                            </button>
                            <button
                                onClick={handleCreateEvent}
                                title="Post endorsement & put it on the calendar immediately — a spoken date becomes the event date"
                                className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                            >
                                <CalendarIcon className="w-4 h-4" /> <span>+ Event</span>
                            </button>
                            {/* FORMAT — tidy the dictated endorsement: filler out,
                                facts kept exactly as dictated. Same engine the
                                auto-format-on-stop uses; the in-flight guard makes
                                double-triggering a no-op. */}
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={SparklesIcon}
                                onClick={() => void runFormat()}
                                disabled={!content.trim() || formatting}
                                title="Tidy the endorsement — filler out, every fact kept exactly as dictated"
                                className="!px-2.5 whitespace-nowrap text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700 rounded-lg"
                            >
                                {formatting ? 'Formatting…' : 'Format'}
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={closeComposer}
                            >
                                Close
                            </Button>
                            <button
                                onClick={() => void handlePost()}
                                disabled={!content.trim()}
                                className="bg-slate-900 dark:bg-zinc-800 text-white dark:text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                            >
                                Post Endorsement
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* 3. The Endorsements timeline — LAST endorsement (with its date
             *    and Edit action alongside it), then PREVIOUS endorsements,
             *    tightly spaced, in clear chronological order. */}
            {filterType !== 'user' ? (
                <div className="space-y-0 px-2">
                    {lastEndorsement ? (
                        <>
                            <div className="flex items-center justify-between gap-2 pb-2">
                                <p className="text-2xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                                    Last endorsement · {sittingDateLabelOf(lastEndorsement)}
                                </p>
                            </div>
                            {timelineItem(lastEndorsement, previousEndorsements.length === 0)}
                            {previousEndorsements.length ? (
                                <>
                                    <p className="text-2xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 pt-2 pb-2">
                                        Previous endorsements ({previousEndorsements.length})
                                    </p>
                                    {previousEndorsements.map((note, index) =>
                                        timelineItem(note, index === previousEndorsements.length - 1),
                                    )}
                                </>
                            ) : null}
                        </>
                    ) : composerOpen ? null : (
                        <div className="text-center py-12 opacity-60">
                            <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                <PlusIcon className="w-5 h-5 text-slate-400" />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-semibold">No Endorsements Yet</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Record today&apos;s outcome in Court Mode — or log a missed one here.
                            </p>
                        </div>
                    )}
                </div>
            ) : null}

            {/* 4. Plain NOTES — kept distinct from endorsements (never lumped
             *    into an awkward "and notes" label). */}
            {filterType !== 'endorsement' && plainNotes.length ? (
                <div className="mt-4 px-2">
                    <p className="text-2xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 pb-2">
                        Notes ({plainNotes.length})
                    </p>
                    {plainNotes.map((note, index) => timelineItem(note, index === plainNotes.length - 1))}
                </div>
            ) : null}
        </div>
    );
};

export default TeamDiscussionTab;
