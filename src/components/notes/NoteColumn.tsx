
import React, { useMemo, useState, useEffect } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { NoteNotebook, NotePage, Matter } from '../../types';
import { MATTERS_NOTEBOOK_ID } from '../../constants';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';
import { ZapIcon, CogIcon, DocumentIcon, CheckCircleIcon, UserCircleIcon } from '../../constants';

// Note: @hello-pangea/dnd works natively with React 18 StrictMode.
// The old StrictModeDroppable workaround is no longer needed.
const StrictModeDroppable = ({ children, ...props }: any) => {
    return <Droppable {...props}>{children}</Droppable>;
};

const BackIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);
const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 h-4"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
);
const ChevronDown: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 h-4"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
);
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 h-4"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
);
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 h-4"} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
);
const DragHandleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
);

interface NoteColumnProps {
    title: string;
    level: number;
    items: (NoteNotebook | NotePage | Matter)[];
    type: 'notebook' | 'page' | 'matter';
    selectionPath: string[];
    onSelect: (level: number, id: string) => void;
    onBack?: () => void;
    showBackButton?: boolean;
    onAddNotebook?: () => void;
    onAddPage?: (notebookId: string, parentId: string | null, matterId?: string) => void;
    onDeleteNotebook?: (notebook: NoteNotebook) => void;
    onRenamePage: (pageId: string, newTitle: string) => void;
    onDeletePage: (pageId: string) => void;
    notebookId?: string;
    allPages: NotePage[];
    noteNotebooks: NoteNotebook[];
    expandedPages: Set<string>;
    setExpandedPages: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const EditableTitle: React.FC<{ initialTitle: string; onSave: (newTitle: string) => void; }> = ({ initialTitle, onSave }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [title, setTitle] = React.useState(initialTitle);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => { setTitle(initialTitle); }, [initialTitle]);

    React.useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (title.trim() && title.trim() !== initialTitle) {
            onSave(title.trim());
        } else {
            setTitle(initialTitle);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <input autoComplete="off" data-lpignore="true" 
                ref={inputRef} type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-white dark:bg-zinc-700 p-0 rounded-sm border border-primary-500 text-sm font-medium"
            />
        );
    }
    return <span className="truncate" onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>{title}</span>;
};

const SystemIcon: React.FC<{ iconType?: string }> = ({ iconType }) => {
    switch (iconType) {
        case 'stage': return <ZapIcon className="w-3.5 h-3.5 text-purple-500" />;
        case 'document': return <DocumentIcon className="w-3.5 h-3.5 text-blue-500" />;
        case 'task': return <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />;
        default: return <CogIcon className="w-3.5 h-3.5 text-slate-500" />;
    }
};

export const NoteColumn: React.FC<NoteColumnProps> = React.memo((props) => {
    const { title, level, items, type, selectionPath, onSelect, onBack, showBackButton = true, onAddNotebook, onAddPage, onDeleteNotebook, onRenamePage, onDeletePage, notebookId, allPages, noteNotebooks, expandedPages, setExpandedPages } = props;

    const handleExpandToggle = (id: string) => {
        setExpandedPages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    };
    
    const columnDroppableId = useMemo(() => {
        if (type === 'notebook') return 'notebooks_root';
        if (type === 'matter') return `notebook_${notebookId}`; // List of matters
        if (type === 'page') return `notebook_${notebookId}`; // List of top-level pages
        return `unknown_${level}`;
    }, [type, level, notebookId]);

    const renderTree = (
        treeItems: (NoteNotebook | NotePage | Matter)[],
        treeType: 'notebook' | 'page' | 'matter',
        currentLevel: number,
        droppableId: string,
        parentId: string | null = null,
        currentMatterId?: string
    ) => {
        // Only allow dragging pages, not matters or notebooks (for now, to simplify)
        const isDraggableList = treeType === 'page';
        
        return (
            <StrictModeDroppable droppableId={droppableId} type="page" isDropDisabled={!isDraggableList}>
                {(provided: any) => (
                    <ul {...provided.droppableProps} ref={provided.innerRef} className={`space-y-1 ${parentId ? 'pl-4' : 'p-2'}`}>
                        {treeItems.map((item, index) => {
                            const itemIdPrefix = treeType === 'notebook' ? 'notebook' : treeType === 'matter' ? 'matter' : 'page';
                            const itemId = `${itemIdPrefix}_${item.id}`;
                            const isSelected = selectionPath[currentLevel] === itemId;
                            const isPathActive = selectionPath.includes(itemId);
                            
                            const isMatter = treeType === 'matter';
                            const isNote = treeType === 'page';
                            const noteItem = isNote ? (item as NotePage) : null;
                            const isSystemNote = noteItem?.type === 'system';

                            let childrenToRender: NotePage[] = [];
                            if (isNote) {
                                childrenToRender = allPages.filter(p => p.parentId === item.id).sort((a,b) => a.order - b.order);
                            }
                            // Matters don't render children in the same tree list anymore; they open a new column.
                            
                            const isExpanded = expandedPages.has(item.id);
                            // Only allow adding subpages to user-created pages, not system logs or matters (matters handled via column header)
                            const canAddSubPage = isNote && !isSystemNote;
                            
                            const displayName = 'name' in item ? item.name : item.title;
                            const notebook = treeType === 'notebook' ? noteNotebooks.find(nb => nb.id === item.id) : null;
                            const colorClass = notebook ? getEventTypeBadgeClass(notebook.color, 'bg-opacity-20') : '';
                            const isCoreNotebook = notebook ? notebook.isCore : false;

                            const childDroppableId = `page_${item.id}`;
                            
                            return (
                                <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!isDraggableList || isSystemNote}>
                                    {(provided: any) => (
                                        <li ref={provided.innerRef} {...provided.draggableProps} className="group/item">
                                            <div
                                                onClick={() => onSelect(currentLevel, itemId)}
                                                className={`flex items-center gap-1 p-2 rounded-md cursor-pointer transition-colors ${isPathActive ? `bg-primary-100 dark:bg-primary-900/40 ${colorClass}` : `hover:bg-gray-100 dark:hover:bg-gray-700/50`}`}
                                            >
                                                <div {...provided.dragHandleProps} className={`cursor-grab text-gray-400 ${isDraggableList && !isSystemNote ? 'opacity-0 group-hover/item:opacity-100' : 'opacity-0 cursor-default'}`}><DragHandleIcon className="w-4 h-4"/></div>
                                                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                                                    {(childrenToRender.length > 0) && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleExpandToggle(item.id); }} className="p-1 -m-1">
                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                    {isSystemNote && <SystemIcon iconType={noteItem?.systemNoteIcon} />}
                                                    {!isSystemNote && !isExpanded && childrenToRender.length === 0 && treeType === 'notebook' && <div className={`w-2 h-2 rounded-full ${notebook ? getEventTypeBadgeClass(notebook.color, 'bg') : 'bg-slate-400'}`} />}
                                                </div>
                                                <div className={`font-medium text-sm flex-grow truncate ${isPathActive ? 'text-primary-800 dark:text-white' : ''} ${isSystemNote ? 'italic text-slate-600 dark:text-slate-400' : ''}`}>
                                                    {(isNote && !isSystemNote) ? (
                                                        <EditableTitle initialTitle={displayName} onSave={(newTitle) => onRenamePage(item.id, newTitle)} />
                                                    ) : (
                                                        <span className="truncate">{displayName}</span>
                                                    )}
                                                </div>
                                                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover/item:opacity-100">
                                                    {treeType === 'notebook' && !isCoreNotebook && onDeleteNotebook && (<button onClick={(e) => { e.stopPropagation(); onDeleteNotebook(item as NoteNotebook); }} className="p-1 rounded-full hover:bg-red-100"><TrashIcon className="w-4 h-4 text-red-500" /></button>)}
                                                    {canAddSubPage && onAddPage && (
                                                        <Tooltip text="Add Sub-page">
                                                            <button onClick={(e) => { e.stopPropagation(); onAddPage((item as NotePage).notebookId, item.id, (item as NotePage).matterId); }} className="p-1 rounded-full hover:bg-blue-100"><PlusIcon className="w-4 h-4 text-blue-500" /></button>
                                                        </Tooltip>
                                                    )}
                                                    {isNote && !isSystemNote && (<button onClick={(e) => { e.stopPropagation(); onDeletePage(item.id); }} className="p-1 rounded-full hover:bg-red-100"><TrashIcon className="w-4 h-4 text-red-500" /></button>)}
                                                </div>
                                            </div>
                                            {isExpanded && childrenToRender.length > 0 && renderTree(childrenToRender, 'page', currentLevel, childDroppableId, item.id, currentMatterId)}
                                        </li>
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                    </ul>
                )}
            </StrictModeDroppable>
        );
    };

    const renderAddButton = () => {
        const buttonClasses = "text-sm font-semibold text-primary-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed";

        if (level === 0 && onAddNotebook) { 
            return <button onClick={onAddNotebook} className={buttonClasses}>+ Notebook</button>;
        }
        
        // "Add Page" button only appears in columns that list pages, not notebooks or matters
        if (type === 'page' && onAddPage && notebookId) {
            // If we are in a matter's page list
            if (notebookId === MATTERS_NOTEBOOK_ID) {
                 // We are in column 3 (level 2) listing pages for a matter.
                 // The matter ID is passed via context or prop? It's passed in `onAddPage` call in `NotesView`.
                 // Wait, `onAddPage` prop handles the arguments.
                 // Here, we just trigger it. The parent knows the context (matterId) for this column instance.
                 return (
                    <button onClick={() => onAddPage(notebookId, null, undefined)} className={buttonClasses}>
                        + Add Page
                    </button>
                );
            } else {
                // Standard notebook page list
                return (
                    <button onClick={() => onAddPage(notebookId, null, undefined)} className={buttonClasses}>
                        + Add Page
                    </button>
                );
            }
        }

        return null;
    };
    
    return (
        <div className="w-full flex flex-col h-full border-r border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-800/50">
                {onBack && showBackButton && (
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700">
                        <BackIcon />
                    </button>
                )}
                <h3 className="font-bold text-gray-800 dark:text-white truncate flex-grow text-sm uppercase tracking-wide">{title}</h3>
                {renderAddButton()}
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar">
                {renderTree(items, type, level, columnDroppableId)}
            </div>
        </div>
    );
});
