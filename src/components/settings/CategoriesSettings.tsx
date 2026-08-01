import React, { useState, useEffect } from 'react';
import { CustomEventType, ContactCategory, DocumentCategory, ModalType, UserRole } from '../../types';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import { EditIcon, TrashIcon, LockClosedIcon } from '../../constants';
import Tooltip from '../Tooltip';
import { useUI } from '../../contexts/UIContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-900 dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

export type CategorySubTab = 'events' | 'contacts' | 'documents';

interface CategoriesSettingsProps {
    eventTypes: CustomEventType[];
    contactCategories: ContactCategory[];
    documentCategories: DocumentCategory[];
    folderPermissions: Record<string, UserRole[]>;
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    onDeleteContactCategory: (categoryId: string) => void;
    onDeleteDocumentCategory: (categoryId: string) => void;
    activeTab: CategorySubTab | null;
}

const CategoryList: React.FC<{ items: any[], onEdit: (id: string) => void, onDelete: (id: string) => void, renderItem: (item: any) => React.ReactNode, canDelete?: (item: any) => boolean }> = ({ items, onEdit, onDelete, renderItem, canDelete }) => (
    <ul className="space-y-2">
        {items.map(item => (
            <li key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                {renderItem(item)}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(item.id)} className="text-gray-500 hover:text-primary-600 p-1 rounded-full"><EditIcon className="w-4 h-4" /></button>
                    {(!canDelete || canDelete(item)) && <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><TrashIcon className="w-4 h-4" /></button>}
                </div>
            </li>
        ))}
    </ul>
);

const DocumentCategoryList: React.FC<{ categories: DocumentCategory[], parentId: string | null, onEdit: any, onDelete: any, onPermissions: any, onAddSub: any }> = ({ categories, parentId, onEdit, onDelete, onPermissions, onAddSub }) => {
    const children = categories.filter(c => c.parentId === parentId);
    if (children.length === 0) return null;

    return (
        <ul className="space-y-1" style={{ marginLeft: parentId ? '1.5rem' : 0 }}>
            {children.map(cat => (
                <li key={cat.id} className="group">
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <span>{cat.name} {cat.isCore && <span className="text-xs text-gray-400">(Core)</span>}</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!cat.isCore && <button onClick={() => onAddSub(cat.id)} className="text-gray-500 hover:text-primary-600 text-xs font-semibold">Add Sub</button>}
                            <Tooltip text="Permissions"><button onClick={() => onPermissions(cat.id)} className="text-gray-500 hover:text-primary-600 p-1 rounded-full"><LockClosedIcon className="w-4 h-4" /></button></Tooltip>
                            {!cat.isCore && <button onClick={() => onEdit(cat.id)} className="text-gray-500 hover:text-primary-600 p-1 rounded-full"><EditIcon className="w-4 h-4" /></button>}
                            {!cat.isCore && <button onClick={() => onDelete(cat.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><TrashIcon className="w-4 h-4" /></button>}
                        </div>
                    </div>
                    <DocumentCategoryList categories={categories} parentId={cat.id} onEdit={onEdit} onDelete={onDelete} onPermissions={onPermissions} onAddSub={onAddSub} />
                </li>
            ))}
        </ul>
    );
};

const CategoriesSettings: React.FC<CategoriesSettingsProps> = (props) => {
    const { closeModal } = useUI();
    const { openModal, onDeleteContactCategory, onDeleteDocumentCategory, activeTab } = props;
    const [localActiveTab, setLocalActiveTab] = useState<CategorySubTab>('events');

    useEffect(() => {
        if (activeTab) {
            setLocalActiveTab(activeTab);
        }
    }, [activeTab]);

    const renderContent = () => {
        switch (localActiveTab) {
            case 'events':
                return (
                    <SettingsCard title="Event Type Management" id="event-type-management">
                        <button onClick={() => openModal('newEventType')} className="w-full text-center px-4 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-zinc-600 mb-4">Add Event Type</button>
                        <CategoryList
                            items={props.eventTypes}
                            onEdit={(id: string) => openModal('editEventType', id)}
                            onDelete={(id: string) => openModal('deleteConfirmation', id, { onConfirm: () => { onDeleteContactCategory(id); closeModal(); } })} // Assuming a generic delete handler
                            renderItem={(item: CustomEventType) => (
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventTypeBadgeClass(item.color)}`}>{item.name}</span>
                            )}
                        />
                    </SettingsCard>
                );
            case 'contacts':
                return (
                    <SettingsCard title="Contact Category Management" id="contact-category-management">
                        <button onClick={() => openModal('newContactCategory')} className="w-full text-center px-4 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-zinc-600 mb-4">Add Contact Category</button>
                        <CategoryList
                            items={props.contactCategories}
                            onEdit={(id: string) => openModal('editContactCategory', id)}
                            onDelete={(id: string) => openModal('deleteConfirmation', id, { onConfirm: () => { onDeleteContactCategory(id); closeModal(); } })}
                            renderItem={(item: ContactCategory) => <span>{item.name}</span>}
                        />
                    </SettingsCard>
                );
            case 'documents':
                return (
                    <SettingsCard title="Document Folder Management" id="document-category-management">
                        <button onClick={() => openModal('newDocumentCategory')} className="w-full text-center px-4 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-zinc-600 mb-4">Add Top-Level Folder</button>
                        <DocumentCategoryList
                            categories={props.documentCategories}
                            parentId={null}
                            onEdit={(id: string) => openModal('editDocumentCategory', id)}
                            onDelete={(id: string) => openModal('deleteConfirmation', id, { onConfirm: () => { onDeleteDocumentCategory(id); closeModal(); } })}
                            onPermissions={(id: string) => openModal('folderPermissions', id)}
                            onAddSub={(parentId: string) => openModal('newDocumentCategory', null, { parentId })}
                        />
                    </SettingsCard>
                );
            default:
                return <SettingsCard title="Categories & Types"><p className="text-slate-500">Select a category to begin.</p></SettingsCard>;
        }
    }

    return (
        <div>
            <div className="mb-6 border-b border-gray-200 dark:border-zinc-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {(['events', 'contacts', 'documents'] as CategorySubTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setLocalActiveTab(tab)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${localActiveTab === tab
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </nav>
            </div>
            {renderContent()}
        </div>
    );
}

export default CategoriesSettings;
