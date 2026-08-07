
import React, { useMemo, useCallback, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { NoteNotebook, NotePage, ModalType, User, Matter, View } from '../types';
import { NotesIcon, MATTERS_NOTEBOOK_ID, PRACTICE_NOTES_NOTEBOOK_ID } from '../constants';
import { NoteColumn } from './notes/NoteColumn';
import { NoteEditor } from './notes/NoteEditor';
import { useCoreState } from '../contexts/CoreContext';
import { useMatterState } from '../contexts/MatterContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useAuth } from '../contexts/AuthContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import ProTip from './ProTip';

const NotesPlaceholder: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-zinc-500 p-8">
        <NotesIcon className="w-24 h-24 text-slate-300 dark:text-zinc-700" />
        <p className="mt-4 text-lg font-semibold">Select a note to view</p>
        <p className="mt-1 text-sm">Or, create a new page.</p>
    </div>
);

export const NotesView: React.FC<{ noBox?: boolean }> = ({ noBox }) => {
    const { coreState, coreActions } = useCoreState();
    const { documentState, documentActions } = useDocumentState();
    const { matterState } = useMatterState();
    const { currentUser } = useAuth();
    const { openModal, closeModal, navigateTo, currentHistoryEntry, updateCurrentHistoryEntry } = useUI();

    
    // De-structure state
    const { noteNotebooks } = coreState;
    const { notePages } = documentState;
    const { matters } = matterState;
    const { handleUpdatePageContent, handleDeleteNotebook, onDeletePage } = documentActions;

    const selectionPath = currentHistoryEntry.notesSelectionPath || [];
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

    const setSelectionPath = useCallback((path: string[]) => {
        updateCurrentHistoryEntry({ notesSelectionPath: path });
    }, [updateCurrentHistoryEntry]);

    const userNotebooks = noteNotebooks.filter(nb =>
        nb.scope === 'firm' || (nb.scope === 'private' && nb.userId === currentUser?.id)
    );
    
    const sortedUserNotebooks = useMemo(() => {
        return [...userNotebooks].sort((a,b) => (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0) || a.name.localeCompare(b.name));
    }, [userNotebooks]);

    // --- Selection Logic ---
    const selectedNotebookId = selectionPath[0]?.split(/_(.*)/s)[1];
    const selectedNotebook = sortedUserNotebooks.find(nb => nb.id === selectedNotebookId);
    const isMatterNotebook = selectedNotebookId === MATTERS_NOTEBOOK_ID;

    // Determine active Matter (if in Matter Notebook)
    const selectedMatterId = isMatterNotebook && selectionPath.length > 1 ? selectionPath[1].split(/_(.*)/s)[1] : null;
    const selectedMatter = selectedMatterId ? matters.find(m => m.id === selectedMatterId) : null;

    // Determine active Page for Editor
    const lastPathSegment = selectionPath[selectionPath.length - 1];
    const pageIdForEditor = lastPathSegment?.startsWith('page_') ? lastPathSegment.split(/_(.*)/s)[1] : null;
    const pageForEditor = notePages.find(p => p.id === pageIdForEditor);

    // Breadcrumbs for Editor
    const breadcrumbItems = useMemo(() => {
        if (!pageForEditor) return [];
        const items: { name: string; path: string[] }[] = [];
        
        if (selectedNotebook) {
             const notebookPath = [`notebook_${selectedNotebook.id}`];
             items.push({ name: selectedNotebook.name, path: notebookPath });

             if (selectedMatter) {
                 items.push({ name: selectedMatter.title, path: [...notebookPath, `matter_${selectedMatter.id}`] });
             }
        }
        
        items.push({ name: pageForEditor.title, path: selectionPath });
        return items;
    }, [pageForEditor, selectedNotebook, selectedMatter, selectionPath]);
    

    const handleSelect = (level: number, id: string) => {
        const newPath = selectionPath.slice(0, level);
        newPath.push(id);
        setSelectionPath(newPath);
    };

    const handleBreadcrumbNav = (path: string[]) => setSelectionPath(path);

    // Responsive Mobile State Logic
    const isMobileCol1 = !selectedNotebook;
    const isMobileCol2 = selectedNotebook && (!isMatterNotebook ? !pageForEditor : !selectedMatter);
    const isMobileCol3 = isMatterNotebook ? (selectedMatter && !pageForEditor) : !!pageForEditor;
    const isMobileCol4 = isMatterNotebook && !!pageForEditor;

    const handleBackCol2 = () => setSelectionPath([]);
    const handleBackCol3 = () => setSelectionPath([`notebook_${selectedNotebookId}`]);
    const handleBackCol4 = () => isMatterNotebook ? setSelectionPath([`notebook_${selectedNotebookId}`, `matter_${selectedMatterId}`]) : setSelectionPath([`notebook_${selectedNotebookId}`]);

    // --- Drag & Drop ---
    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;
    };

    const confirmDeleteNotebook = (notebook: NoteNotebook) => {
        openModal('deleteConfirmation', notebook.id, {
            title: 'Delete Notebook?',
            message: `Are you sure you want to delete "${notebook.name}"?`,
            onConfirm: () => {
                if (selectionPath[0] === `notebook_${notebook.id}`) setSelectionPath([]);
                handleDeleteNotebook(notebook.id, notebook.name);
                closeModal();
            }
        });
    };
    
    const confirmDeletePage = (pageId: string) => {
         const page = notePages.find(p => p.id === pageId);
         if (!page) return;
         openModal('deleteConfirmation', pageId, {
            title: 'Delete Page?',
            message: `Delete "${page.title}"? This cannot be undone.`,
            onConfirm: () => {
                const identifier = `page_${pageId}`;
                if (selectionPath.includes(identifier)) setSelectionPath(selectionPath.slice(0, selectionPath.indexOf(identifier)));
                onDeletePage(pageId);
                closeModal();
            }
        });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 overflow-hidden">
            {!noBox && (
                <header className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Firm Knowledge</h2>
                </header>
            )}

            <div className={`flex-grow flex flex-col overflow-hidden ${noBox ? '' : 'p-4 sm:p-6 lg:p-8'}`}>
                {!noBox && (
                    <div className="mb-6 hidden md:block">
                        <ProTip id="notes_nav_tip">
                            PracticePro Notes are context-aware. Use 'Matter Notes' to browse notes by case, or 'Practice Notes' for general firm knowledge.
                        </ProTip>
                    </div>
                )}

            <DragDropContext onDragEnd={onDragEnd}>
                <div className={`flex-grow flex relative ${noBox ? '' : 'bg-white dark:bg-zinc-800 md:rounded-xl md:shadow-md md:border border-black/5 dark:border-white/5'} overflow-hidden`}>
                    
                    {/* Column 1: Notebooks */}
                    <div className={`w-full md:w-72 flex-shrink-0 h-full md:border-r border-gray-200 dark:border-gray-700 ${isMobileCol1 ? 'block' : 'hidden md:block'}`}>
                        <NoteColumn 
                            title="Practice Notes" 
                            level={0} 
                            items={sortedUserNotebooks} 
                            type="notebook" 
                            selectionPath={selectionPath} 
                            onSelect={handleSelect} 
                            showBackButton={false} 
                            onAddNotebook={() => openModal('newNotebook')} 
                            onDeleteNotebook={confirmDeleteNotebook} 
                            onRenamePage={documentActions.handleRenamePage} 
                            onDeletePage={confirmDeletePage} 
                            allPages={notePages} 
                            noteNotebooks={sortedUserNotebooks} 
                            expandedPages={expandedPages} 
                            setExpandedPages={setExpandedPages} 
                        />
                    </div>

                    {/* Column 2: Context (Matters or Top-Level Pages) */}
                    {selectedNotebook && (
                        <div className={`w-full md:w-72 flex-shrink-0 h-full md:border-r border-gray-200 dark:border-gray-700 ${isMobileCol2 ? 'block' : 'hidden md:block'}`}>
                             {isMatterNotebook ? (
                                <NoteColumn 
                                    key={`matters-list`}
                                    title="Browse by Matter" 
                                    level={1} 
                                    items={[...matters].sort((a, b) => a.title.localeCompare(b.title))} 
                                    type="matter" 
                                    notebookId={selectedNotebookId} 
                                    selectionPath={selectionPath} 
                                    onSelect={handleSelect}
                                    onBack={handleBackCol2}
                                    showBackButton={true}
                                    allPages={notePages}
                                    noteNotebooks={sortedUserNotebooks}
                                    expandedPages={expandedPages} 
                                    setExpandedPages={setExpandedPages}
                                    onRenamePage={documentActions.handleRenamePage}
                                    onDeletePage={confirmDeletePage}
                                />
                             ) : (
                                <NoteColumn 
                                    key={`pages-list-${selectedNotebook.id}`}
                                    title={`Pages in ${selectedNotebook.name}`} 
                                    level={1} 
                                    items={notePages.filter(p => p.notebookId === selectedNotebook.id && p.parentId === null).sort((a, b) => a.order - b.order)} 
                                    type="page" 
                                    notebookId={selectedNotebook.id} 
                                    selectionPath={selectionPath} 
                                    onSelect={handleSelect}
                                    onBack={handleBackCol2}
                                    showBackButton={true}
                                    onAddPage={(nbId) => openModal('newPage', null, { notebookId: nbId })} 
                                    onRenamePage={documentActions.handleRenamePage}
                                    onDeletePage={confirmDeletePage}
                                    allPages={notePages}
                                    noteNotebooks={sortedUserNotebooks}
                                    expandedPages={expandedPages} 
                                    setExpandedPages={setExpandedPages}
                                />
                             )}
                        </div>
                    )}

                    {/* Column 3 & 4 Wrapper */}
                    <div className={`flex-1 min-w-0 h-full md:flex ${isMobileCol3 || isMobileCol4 ? 'block' : 'hidden md:flex'}`}>
                        {isMatterNotebook && selectedMatter ? (
                             <div className={`w-full md:w-72 flex-shrink-0 h-full md:border-r border-gray-200 dark:border-gray-700 ${isMobileCol3 ? 'block' : 'hidden md:block'}`}>
                                <NoteColumn 
                                    key={`matter-pages-${selectedMatter.id}`}
                                    title={`Notes for ${selectedMatter.title}`} 
                                    level={2} 
                                    items={notePages.filter(p => p.matterId === selectedMatter.id && p.parentId === null).sort((a, b) => a.order - b.order)} 
                                    type="page" 
                                    notebookId={MATTERS_NOTEBOOK_ID} 
                                    selectionPath={selectionPath} 
                                    onSelect={handleSelect}
                                    onBack={handleBackCol3}
                                    showBackButton={true}
                                    onAddPage={(nbId, pId, mId) => openModal('newPage', null, { notebookId: nbId, parentId: pId, matterId: selectedMatter.id })} 
                                    onRenamePage={documentActions.handleRenamePage}
                                    onDeletePage={confirmDeletePage}
                                    allPages={notePages}
                                    noteNotebooks={sortedUserNotebooks}
                                    expandedPages={expandedPages} 
                                    setExpandedPages={setExpandedPages}
                                />
                             </div>
                        ) : !isMatterNotebook && pageForEditor ? (
                             <div className={`flex-1 h-full ${isMobileCol3 ? 'block' : 'hidden md:block'}`}>
                                <NoteEditor
                                    key={`editor-${pageForEditor.id}`}
                                    page={pageForEditor}
                                    matter={matters.find(m => m.id === pageForEditor.matterId)}
                                    onSave={(id, title, content) => documentActions.handleUpdatePageContent(id, title, content)}
                                    onDelete={confirmDeletePage}
                                    onCopy={(pageId) => openModal('newPage', null, { copyFromPageId: pageId })}
                                    onNavigateToMatter={(matterId) => navigateTo('matterDetail', matterId, { initialTab: 'endorsements' })}
                                    onBack={handleBackCol3}
                                    showBackButton={true}
                                    breadcrumbItems={breadcrumbItems}
                                    onBreadcrumbNav={handleBreadcrumbNav}
                                />
                             </div>
                        ) : !isMatterNotebook && !pageForEditor && selectedNotebook ? (
                             <div className="flex-1 h-full hidden md:block"><NotesPlaceholder /></div>
                        ) : null}

                        {/* Column 4: Editor (Only for Matter Notebook when page selected) */}
                        {isMatterNotebook && selectedMatter && (
                            <div className={`flex-1 h-full md:border-l border-gray-200 dark:border-gray-700 ${isMobileCol4 ? 'block' : 'hidden md:block'}`}>
                                {pageForEditor ? (
                                     <NoteEditor
                                        key={`editor-${pageForEditor.id}`}
                                        page={pageForEditor}
                                        matter={selectedMatter}
                                        onSave={(id, title, content) => documentActions.handleUpdatePageContent(id, title, content)}
                                        onDelete={confirmDeletePage}
                                        onCopy={(pageId) => openModal('newPage', null, { copyFromPageId: pageId })}
                                        onNavigateToMatter={(matterId) => navigateTo('matterDetail', matterId, { initialTab: 'endorsements' })}
                                        onBack={handleBackCol4}
                                        showBackButton={true}
                                        breadcrumbItems={breadcrumbItems}
                                        onBreadcrumbNav={handleBreadcrumbNav}
                                    />
                                ) : (
                                    <div className="hidden md:block"><NotesPlaceholder /></div>
                                )}
                            </div>
                        )}
                </div>
            </div>
        </DragDropContext>
        </div>
    </div>
);
};

export default NotesView;
