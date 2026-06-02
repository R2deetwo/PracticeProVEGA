
import React, { useEffect, useRef } from 'react';
import { useUI } from '../contexts/UIContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { EditIcon, TrashIcon, PlusIcon, DownloadIcon, ShareIcon, ArchiveIcon, CheckIcon } from '../constants';
import { TaskStatus } from '../types';

const MenuItem: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    onClick: () => void; 
    shortcut?: string;
    danger?: boolean;
}> = ({ icon, label, onClick, shortcut, danger }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors ${danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-slate-200'}`}
    >
        <div className="w-4 h-4 opacity-70">{icon}</div>
        <span className="flex-grow">{label}</span>
        {shortcut && <span className="text-xs text-slate-400 font-mono">{shortcut}</span>}
    </button>
);

const Divider = () => <div className="h-px bg-slate-200 dark:bg-zinc-700 my-1" />;

const ContextMenu: React.FC = () => {
    const { contextMenu, setContextMenu, closeContextMenu, openModal, navigateTo } = useUI();
    const { 
        deleteItem, 
        updateItem, 
        archiveItem, 
        handleUpdateTaskStatus,
        handleDeleteMatter,
        handleDeleteTimeEntry,
        handleDeleteExpense
    } = useDataActions();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const contextType = target.closest('[data-context-type]')?.getAttribute('data-context-type');
            const itemId = target.closest('[data-item-id]')?.getAttribute('data-item-id');

            if (contextType && itemId) {
                e.preventDefault();
                setContextMenu({
                    isOpen: true,
                    x: e.clientX,
                    y: e.clientY,
                    type: contextType,
                    itemId: itemId
                });
            } else {
                closeContextMenu();
            }
        };

        const handleClick = () => closeContextMenu();
        const handleScroll = () => closeContextMenu();

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('click', handleClick);
        document.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('click', handleClick);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [setContextMenu, closeContextMenu]);

    // Adjustment to keep menu on screen
    const style: React.CSSProperties = {
        top: contextMenu.y,
        left: contextMenu.x,
    };
    
    if (menuRef.current) {
        if (contextMenu.x + 200 > window.innerWidth) {
            style.left = contextMenu.x - 200;
        }
        if (contextMenu.y + 300 > window.innerHeight) {
            style.top = contextMenu.y - 200; // Flip up
        }
    }

    if (!contextMenu.isOpen) return null;

    return (
        <div 
            ref={menuRef}
            style={style}
            className="fixed z-[9999] w-56 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 animate-fade-in overflow-hidden backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
        >
            {contextMenu.type === 'matter' && (
                <>
                    <MenuItem icon={<div className="font-bold text-xs">Open</div>} label="Open Details" onClick={() => navigateTo('matterDetail', contextMenu.itemId)} />
                    <MenuItem icon={<EditIcon />} label="Edit Matter" onClick={() => openModal('editMatter', contextMenu.itemId)} />
                    <MenuItem icon={<PlusIcon />} label="Add Task" onClick={() => openModal('newTask', null, { matterId: contextMenu.itemId })} />
                    <Divider />
                    <MenuItem icon={<ArchiveIcon />} label="Archive" onClick={() => openModal('archiveMatter', contextMenu.itemId)} />
                    <MenuItem 
                        icon={<TrashIcon />} 
                        label="Delete" 
                        danger 
                        onClick={() => openModal('deleteConfirmation', contextMenu.itemId, {
                            title: 'Delete Matter?',
                            message: (
                                <div className="space-y-2">
                                    <p>Are you sure you want to permanently delete this matter?</p>
                                    <p className="text-red-600 dark:text-red-400 font-bold text-xs">This action cannot be undone.</p>
                                </div>
                            ),
                            onConfirm: () => handleDeleteMatter(contextMenu.itemId!, 'Matter'),
                            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
                        })} 
                    />
                </>
            )}

            {contextMenu.type === 'document' && (
                <>
                     <MenuItem icon={<div className="font-bold text-xs">View</div>} label="View Document" onClick={() => navigateTo('documentDetail', contextMenu.itemId)} />
                     <MenuItem icon={<EditIcon />} label="Rename / Properties" onClick={() => openModal('editDocument', contextMenu.itemId)} />
                     <MenuItem icon={<EditIcon />} label="Open in Editor" onClick={() => navigateTo('editor', contextMenu.itemId)} />
                     <MenuItem icon={<DownloadIcon />} label="Download" onClick={() => {}} />
                     <Divider />
                     <MenuItem icon={<ShareIcon />} label="Share" onClick={() => openModal('shareDocument', contextMenu.itemId)} />
                     <MenuItem icon={<TrashIcon />} label="Delete" danger onClick={() => openModal('deleteConfirmation', contextMenu.itemId, { onConfirm: () => deleteItem('documents', contextMenu.itemId!, 'Document') })} />
                </>
            )}

             {contextMenu.type === 'task' && (
                <>
                     <MenuItem icon={<EditIcon />} label="Edit Task" onClick={() => openModal('viewTask', contextMenu.itemId)} />
                     <MenuItem icon={<CheckIcon />} label="Mark Complete" onClick={() => handleUpdateTaskStatus(contextMenu.itemId!, TaskStatus.Done)} />
                     <Divider />
                     <MenuItem icon={<TrashIcon />} label="Delete" danger onClick={() => deleteItem('tasks', contextMenu.itemId!, 'Task')} />
                </>
            )}
            
             {contextMenu.type === 'contact' && (
                <>
                     <MenuItem icon={<div className="font-bold text-xs">View</div>} label="View Profile" onClick={() => navigateTo('contactDetail', contextMenu.itemId)} />
                     <MenuItem icon={<EditIcon />} label="Edit Contact" onClick={() => openModal('editContact', contextMenu.itemId)} />
                     <Divider />
                     <MenuItem icon={<TrashIcon />} label="Delete" danger onClick={() => openModal('deleteConfirmation', contextMenu.itemId, { onConfirm: () => deleteItem('contacts', contextMenu.itemId!, 'Contact') })} />
                </>
            )}
        </div>
    );
};

export default ContextMenu;
