import React, { useMemo, useState } from 'react';
import { NotePage, User, ModalType, UserRole, TaskStatus, TaskPriority } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { CalendarIcon, TasksIcon, TrashIcon, PlusIcon, EditIcon, CheckIcon, XIcon, MicrophoneIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useMatterState } from '../../contexts/MatterContext';
import { sanitize } from '../../utils/sanitization';
import { useFieldDictation } from '../../hooks/useFieldDictation';
import { extractDatedMention, formatDatedMention, endorsementTitleFrom } from '../../utils/endorsementDateParser';
import { Button } from '../ui';

/** Notes authored elsewhere (DraftPro, ALOA drafts) can carry rich HTML.
 *  Rendered as sanitized rich text in the timeline — raw tags never show. */
const looksLikeHtml = (s: string) =>
    /<\/(p|h[1-6]|ol|ul|li|strong|em|b|i|div|blockquote|table)\s*>|<br\s*\/?>/i.test(s || '');

/** Coerce a spoken/event type against the firm's real event-type names —
 *  same rules as TriageCard's identical helper. */
function coerceEventType(type: string | undefined, eventTypeNames: string[]): string {
    if (!type) return eventTypeNames[0] || 'Meeting';
    const exact = eventTypeNames.find((t) => t.toLowerCase() === type.toLowerCase());
    if (exact) return exact;
    const partial = eventTypeNames.find(
        (t) => t.toLowerCase().includes(type.toLowerCase()) || type.toLowerCase().includes(t.toLowerCase())
    );
    return partial || eventTypeNames[0] || 'Meeting';
}

interface TeamDiscussionTabProps {
    matterId: string;
    notes: NotePage[];
    users: User[];
    currentUser: User;
    onAddNote: (matterId: string, title: string, content: string, type?: string) => void;
    onUpdateNote: (note: NotePage) => void;
    onDeleteNote: (noteId: string, noteTitle: string) => void;
    openModal: (type: ModalType, id: string | null, context?: any) => void;
    lastViewedAt: number;
    filterType?: 'all' | 'user' | 'endorsement';
}

const EndorsementTimelineItem: React.FC<{
    note: NotePage;
    author?: User;
    currentUser: User;
    onDelete: (noteId: string, noteTitle: string) => void;
    onUpdate: (note: NotePage) => void;
    isLast: boolean;
}> = ({ note, author, currentUser, onDelete, onUpdate, isLast }) => {

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);
    const canManage = currentUser.id === note.authorId || currentUser.role === UserRole.Admin;

    const handleSave = () => {
        if (!editContent.trim()) return;
        onUpdate({ ...note, content: editContent, updatedAt: new Date().toISOString() });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(note.content);
        setIsEditing(false);
    };

    return (
        <div className="flex gap-4 relative group">
            {/* Timeline Line */}
            {!isLast && (
                <div className="absolute left-[19px] top-10 bottom-[-10px] w-px bg-slate-200 dark:bg-zinc-700 z-0"></div>
            )}

            {/* Avatar */}
            <div className={`
                relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ring-4 ring-slate-50 dark:ring-zinc-900 flex-shrink-0
                ${author ? getUserColor(author.name) : 'bg-dim-500'}
            `}>
                {author ? getInitials(author.name) : 'S'}
            </div>

            {/* Content Bubble */}
            <div className="flex-grow pb-8 min-w-0">
                <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg rounded-tl-none p-4 shadow-sm relative hover:shadow-md transition-shadow">

                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    {author?.name || 'System'}
                                </span>
                            </div>
                            <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium">
                                {new Date(note.createdAt || '').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
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
                        <div className="space-y-3">
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 focus:ring-2 focus:ring-primary-500 min-h-[100px] outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={handleCancel} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <XIcon className="w-3.5 h-3.5" /> Cancel
                                </button>
                                <button onClick={handleSave} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary-700 transition-all flex items-center gap-1.5">
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

const TeamDiscussionTab: React.FC<TeamDiscussionTabProps> = ({ matterId, notes, users, currentUser, onAddNote, onUpdateNote, openModal, onDeleteNote, filterType = 'user' }) => {
    const [content, setContent] = useState('');
    const { addToast } = useUI();
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    const { addItem, handleAddTask } = useDataActions();

    // ── ALOA VOX in the composer (owner brief 2026-11-24: "when you say
    //    post endorsement… we should have the ability to use Aloa Vox").
    //    The mic dictates straight into the endorsement box — the same
    //    Whisper→Gemini transcription engine the rest of the app uses,
    //    appending near-live every ~10 seconds.
    const dictation = useFieldDictation({
        onAppend: (text) => {
            setContent((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${text}` : text));
        },
        onError: (message, opts) => addToast(message, opts),
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

    const postEndorsementNote = () => {
        onAddNote(matterId, `Endorsement by ${currentUser.name}`, content, 'endorsement');
    };

    const handlePost = () => {
        if (!content.trim()) return;
        postEndorsementNote();
        setContent('');
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
            postEndorsementNote();
            setContent('');
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
                assignedUsers: [currentUser.id],
            }, `Event: ${title}`);
            postEndorsementNote();
            setContent('');
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

    const filteredNotes = (Array.isArray(notes) ? notes : [])
        .filter(n => n.matterId === matterId && (n.type === 'endorsement' || n.type === 'user'))
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

    return (
        <div className="max-w-3xl mx-auto py-2">
            {/* 1. Sleek Input Area */}
            <div className="mb-10 bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-slate-200 dark:border-zinc-700 overflow-hidden ring-1 ring-black/5">
                <div className="p-1">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Write a case endorsement or update… (or tap the mic below to dictate)"
                        className="w-full border-none focus:ring-0 resize-none p-4 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 bg-transparent min-h-[120px]"
                    />
                </div>

                {/* Toolbar */}
                <div className="bg-slate-50 dark:bg-zinc-900/50 px-3 py-2 flex flex-wrap gap-3 items-center justify-between border-t border-slate-100 dark:border-zinc-700">
                    <div className="flex gap-1 flex-wrap items-center">
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
                    </div>

                    <button
                        onClick={handlePost}
                        disabled={!content.trim()}
                        className="bg-slate-900 dark:bg-zinc-800 text-white dark:text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                        Post Endorsement
                    </button>
                </div>
            </div>

            {/* 2. Timeline List */}
            <div className="space-y-0 px-2">
                {filteredNotes.length > 0 ? (
                    filteredNotes.map((note, index) => {
                        const author = users.find(u => u.id === note.authorId);
                        return (
                            <EndorsementTimelineItem
                                key={note.id}
                                note={note}
                                author={author}
                                currentUser={currentUser}
                                onDelete={onDeleteNote}
                                onUpdate={onUpdateNote}
                                isLast={index === filteredNotes.length - 1}
                            />
                        );
                    })
                ) : (
                    <div className="text-center py-16 opacity-60">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <PlusIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-slate-900 dark:text-white font-semibold">No Endorsements Yet</h3>
                        <p className="text-sm text-slate-500 mt-1">Start by adding a case endorsement above.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamDiscussionTab;
