import React, { useState } from 'react';
import { NotePage, User, ModalType, UserRole } from '../../types';
import { getInitials, getUserColor, timeAgo } from '../../utils/colorUtils';
import { CalendarIcon, TasksIcon, TrashIcon, PlusIcon, EditIcon, CheckIcon, XIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';

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
                ${author ? getUserColor(author.name) : 'bg-gray-500'}
            `}>
                {author ? getInitials(author.name) : 'S'}
            </div>

            {/* Content Bubble */}
            <div className="flex-grow pb-8 min-w-0">
                <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl rounded-tl-none p-4 shadow-sm relative hover:shadow-md transition-shadow">

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
                                className="w-full text-sm p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 focus:ring-2 focus:ring-primary-500 min-h-[100px] outline-none"
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

    const handlePost = () => {
        if (!content.trim()) return;
        onAddNote(matterId, `Endorsement by ${currentUser.name}`, content, 'endorsement');
        setContent('');
    };

    const handleCreateTask = () => {
        if (!content.trim()) {
            addToast(`Please type the endorsement first to convert it to a task.`, { type: 'error' });
            return;
        }
        onAddNote(matterId, `Endorsement by ${currentUser.name}`, content, 'endorsement');
        openModal('newTask', null, { matterId, description: content, openedFrom: 'matterDetail' });
        setContent('');
    };

    const handleCreateEvent = () => {
        if (!content.trim()) {
            addToast(`Please type the endorsement first to convert it to an event.`, { type: 'error' });
            return;
        }
        onAddNote(matterId, `Endorsement by ${currentUser.name}`, content, 'endorsement');
        openModal('newEvent', null, { matterId, fromNoteContent: content, openedFrom: 'matterDetail' });
        setContent('');
    };

    const filteredNotes = (Array.isArray(notes) ? notes : [])
        .filter(n => n.matterId === matterId && (n.type === 'endorsement' || n.type === 'user'))
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

    return (
        <div className="max-w-3xl mx-auto py-2">
            {/* 1. Sleek Input Area */}
            <div className="mb-10 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-2xl shadow-md border border-slate-200 dark:border-zinc-700 overflow-hidden ring-1 ring-black/5">
                <div className="p-1">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Write a case endorsement or update..."
                        className="w-full border-none focus:ring-0 resize-none p-4 text-sm text-slate-700 dark:text-zinc-200 placeholder-slate-400 bg-transparent min-h-[120px]"
                    />
                </div>

                {/* Toolbar */}
                <div className="bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900/50 px-3 py-2 flex flex-wrap gap-3 items-center justify-between border-t border-slate-100 dark:border-zinc-700">
                    <div className="flex gap-1 flex-wrap items-center">
                        <button
                            onClick={handleCreateTask}
                            title="Post & Create Task"
                            className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                        >
                            <TasksIcon className="w-4 h-4" /> <span>+ Task</span>
                        </button>
                        <button
                            onClick={handleCreateEvent}
                            title="Post & Create Event"
                            className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                        >
                            <CalendarIcon className="w-4 h-4" /> <span>+ Event</span>
                        </button>
                    </div>

                    <button
                        onClick={handlePost}
                        disabled={!content.trim()}
                        className="bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
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
