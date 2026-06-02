
import React, { useState, useEffect, useMemo } from 'react';
import { WorkflowDefinition, ChecklistTemplate, DocumentTemplate, DocumentTemplateCategory, ModalType, CustomEventType, ContactCategory, DocumentCategory, UserRole, AutomationRule } from '../../types';
import WorkflowBuilderView from '../WorkflowBuilderView';
import AutomationSettings from './AutomationSettings';
import { InfoIcon, ClipboardListIcon, TagIcon, EditIcon, TrashIcon, LockClosedIcon, ZapIcon } from '../../constants';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

const CategoryList: React.FC<{ items: any[], onEdit: (id: string) => void, onDelete: (id: string) => void, renderItem: (item: any) => React.ReactNode, canDelete?: (item: any) => boolean }> = ({ items, onEdit, onDelete, renderItem, canDelete }) => (
    <ul className="space-y-2">
        {items.map(item => (
            <li key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-700/50 group">
                {renderItem(item)}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(item.id)} className="text-slate-500 hover:text-primary-600 p-1 rounded-full"><EditIcon className="w-4 h-4" /></button>
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
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-700/50">
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{cat.name} {cat.isCore && <span className="text-xs text-slate-400 font-normal ml-1">(Core)</span>}</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!cat.isCore && <button onClick={() => onAddSub(cat.id)} className="text-slate-500 hover:text-primary-600 text-xs font-bold">Add Sub</button>}
                            <Tooltip text="Permissions"><button onClick={() => onPermissions(cat.id)} className="text-slate-500 hover:text-primary-600 p-1 rounded-full"><LockClosedIcon className="w-4 h-4" /></button></Tooltip>
                            {!cat.isCore && <button onClick={() => onEdit(cat.id)} className="text-slate-500 hover:text-primary-600 p-1 rounded-full"><EditIcon className="w-4 h-4" /></button>}
                            {!cat.isCore && <button onClick={() => onDelete(cat.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><TrashIcon className="w-4 h-4" /></button>}
                        </div>
                    </div>
                    <DocumentCategoryList categories={categories} parentId={cat.id} onEdit={onEdit} onDelete={onDelete} onPermissions={onPermissions} onAddSub={onAddSub} />
                </li>
            ))}
        </ul>
    );
};

export type TemplateSubTab = 'workflows' | 'checklists' | 'documents';
export type CategorySubTab = 'events' | 'contacts' | 'documents_folders';

interface TemplatesSettingsProps {
    workflows: WorkflowDefinition[];
    checklistTemplates: ChecklistTemplate[];
    documentTemplates: DocumentTemplate[];
    documentTemplateCategories: DocumentTemplateCategory[];
    onUpdateWorkflow: (updatedWorkflow: WorkflowDefinition) => void;
    onDeleteDocumentTemplate: (id: string, name: string) => void;
    onDeleteDocumentTemplateCategory: (id: string, name: string) => void;
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    activeTab: TemplateSubTab | CategorySubTab | 'automations' | null;
    selectedWorkflowId?: string | null;
    selectedSubCategory?: string | null;
    // Categories Props
    eventTypes: CustomEventType[];
    contactCategories: ContactCategory[];
    documentCategories: DocumentCategory[];
    folderPermissions: Record<string, UserRole[]>;
    onDeleteContactCategory: (categoryId: string) => void;
    onDeleteDocumentCategory: (categoryId: string) => void;
    // Automation Props
    automationRules: AutomationRule[];
}

const TemplatesSettings: React.FC<TemplatesSettingsProps> = (props) => {
    const { openModal, activeTab, onDeleteContactCategory, onDeleteDocumentCategory, automationRules, workflows } = props;
    const { closeModal } = useUI();
    const { isLegal, isProperty } = useProduct();
    const [topLevelTab, setTopLevelTab] = useState<'workflows' | 'categories' | 'automations'>(
        isLegal ? 'workflows' : 'categories'
    );
    const [workflowSubTab, setWorkflowSubTab] = useState<TemplateSubTab>('workflows');
    const [categorySubTab, setCategorySubTab] = useState<CategorySubTab>('events');

    useEffect(() => {
        if (activeTab) {
            if (['workflows', 'checklists', 'documents'].includes(activeTab)) {
                if (isLegal) {
                    setTopLevelTab('workflows');
                    setWorkflowSubTab(activeTab as TemplateSubTab);
                } else {
                    setTopLevelTab('categories');
                }
            } else if (['events', 'contacts', 'documents_folders'].includes(activeTab)) {
                setTopLevelTab('categories');
                setCategorySubTab(activeTab as CategorySubTab);
            } else if (activeTab === 'automations') {
                setTopLevelTab('automations');
            }
        }
    }, [activeTab, isLegal]);

    const templatesByCategory = useMemo(() => {
        const grouped: Record<string, DocumentTemplate[]> = {};
        (props.documentTemplates || []).forEach(t => {
            if (t && t.categoryId) {
                if (!grouped[t.categoryId]) {
                    grouped[t.categoryId] = [];
                }
                grouped[t.categoryId].push(t);
            }
        });
        return grouped;
    }, [props.documentTemplates]);

    const renderWorkflowsContent = () => {
        switch (workflowSubTab) {
            case 'workflows':
                return (
                    <SettingsCard title="Workflow Management" id="workflow-management">
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 flex gap-3">
                            <InfoIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                                <p className="font-bold mb-1">{isProperty ? 'Standardize Your Operations' : 'Standardize Your Practice'}</p>
                                <p>{isProperty 
                                    ? 'Workflows define the lifecycle of different property management stages. Standardizing ensures consistency across all records and helps your team stay synchronized.' 
                                    : 'Workflows define the lifecycle of different matter types. Standardizing ensures consistency across all cases and helps your team stay synchronized.'}</p>
                            </div>
                        </div>
                        <button
                            id="add-workflow-btn"
                            onClick={() => openModal('newWorkflow')}
                            className="w-full text-center px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 rounded-xl font-bold hover:border-primary-500 hover:text-primary-600 transition-all mb-6"
                        >
                            + Add New Workflow
                        </button>
                        <WorkflowBuilderView workflows={props.workflows || []} onUpdateWorkflow={props.onUpdateWorkflow} openModal={props.openModal} initialSelectedWorkflowId={props.selectedWorkflowId} initialSelectedSubCategory={props.selectedSubCategory} />
                    </SettingsCard>
                );
            case 'checklists':
                return (
                    <SettingsCard title="Checklist Template Management" id="checklist-template-management">
                        <button onClick={() => openModal('newChecklistTemplate')} className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-200 transition-all mb-4">Add Checklist Template</button>
                        <ul className="space-y-2">
                            {(props.checklistTemplates || []).map(t => t ? (
                                <li key={t.id} onClick={() => openModal('editChecklistTemplate', t.id)} className="p-3 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-700/50 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-zinc-600">
                                    <p className="font-bold text-slate-800 dark:text-white">{t.name}</p>
                                    <p className="text-xs text-slate-500">{t.items?.length || 0} items</p>
                                </li>
                            ) : null)}
                        </ul>
                    </SettingsCard>
                );
            case 'documents':
                return (
                    <SettingsCard title="Document Template Management" id="document-template-management">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <button onClick={() => openModal('newTemplate')} className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-200 transition-all">Add Template</button>
                            <button onClick={() => openModal('newTemplateCategory')} className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-200 transition-all">Add Category</button>
                        </div>
                        {(props.documentTemplateCategories || []).map(cat => cat ? (
                            <div key={cat.id} className="mb-6 last:mb-0">
                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-100 dark:border-zinc-700">
                                    <h4 className="font-bold text-slate-800 dark:text-white">{cat.name}</h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal('editTemplateCategory', cat.id)} className="text-xs font-bold text-primary-600 hover:underline">Edit</button>
                                        <button onClick={() => props.onDeleteDocumentTemplateCategory(cat.id, cat.name)} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                                    </div>
                                </div>
                                <ul className="space-y-1">
                                    {(templatesByCategory[cat.id] || []).map(t => (
                                        <li key={t.id} onClick={() => openModal('editTemplate', t.id)} className="p-2 px-3 rounded-md hover:bg-slate-50 dark:hover:bg-zinc-700/50 cursor-pointer text-sm font-medium text-slate-600 dark:text-zinc-300">
                                            {t.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null)}
                    </SettingsCard>
                );
        }
    };

    const renderCategoriesContent = () => {
        switch (categorySubTab) {
            case 'events':
                return (
                    <SettingsCard title="Event Type Management" id="event-type-management">
                        <button onClick={() => openModal('newEventType')} className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-200 transition-all mb-4">Add Event Type</button>
                        <CategoryList
                            items={props.eventTypes}
                            onEdit={(id: string) => openModal('editEventType', id)}
                            onDelete={(id: string) => openModal('deleteConfirmation', id, { onConfirm: () => { onDeleteContactCategory(id); closeModal(); } })} 
                            renderItem={(item: CustomEventType) => (
                                <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${getEventTypeBadgeClass(item.color)} text-white`}>{item.name}</span>
                            )}
                        />
                    </SettingsCard>
                );
            case 'contacts':
                return (
                    <SettingsCard title="Contact Category Management" id="contact-category-management">
                        <button onClick={() => openModal('newContactCategory')} className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-200 transition-all mb-4">Add Contact Category</button>
                        <CategoryList
                            items={props.contactCategories}
                            onEdit={(id: string) => openModal('editContactCategory', id)}
                            onDelete={(id: string) => openModal('deleteConfirmation', id, { onConfirm: () => { onDeleteContactCategory(id); closeModal(); } })}
                            renderItem={(item: ContactCategory) => <span className="text-sm font-bold text-slate-700 dark:text-white">{item.name}</span>}
                        />
                    </SettingsCard>
                );
            case 'documents_folders':
                return (
                    <SettingsCard title="Document Folder Management" id="document-category-management">
                        <button onClick={() => openModal('newDocumentCategory')} className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg font-bold hover:bg-slate-200 transition-all mb-4">Add Top-Level Folder</button>
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
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-slate-200 dark:border-zinc-700">
                {isLegal && (
                    <button
                        onClick={() => setTopLevelTab('workflows')}
                        className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${topLevelTab === 'workflows' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                    >
                        <ClipboardListIcon className="w-4 h-4" /> Workflows
                    </button>
                )}
                <button
                    onClick={() => setTopLevelTab('categories')}
                    className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${topLevelTab === 'categories' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                >
                    <TagIcon className="w-4 h-4" /> Categories
                </button>
                <button
                    onClick={() => setTopLevelTab('automations')}
                    className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${topLevelTab === 'automations' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                >
                    <ZapIcon className="w-4 h-4" /> Automations
                </button>
            </div>

            {topLevelTab === 'workflows' && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="mb-4 flex space-x-4">
                        {(['workflows', 'checklists', 'documents'] as TemplateSubTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setWorkflowSubTab(tab)}
                                className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all ${workflowSubTab === tab ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    {renderWorkflowsContent()}
                </div>
            )}
            
            {topLevelTab === 'categories' && (
                <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                     <div className="mb-4 flex space-x-4">
                        {(['events', 'contacts', 'documents_folders'] as CategorySubTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setCategorySubTab(tab)}
                                className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all ${categorySubTab === tab ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            >
                                {tab === 'documents_folders' ? 'Documents' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    {renderCategoriesContent()}
                </div>
            )}

            {topLevelTab === 'automations' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <AutomationSettings rules={automationRules} workflows={workflows} />
                </div>
            )}
        </div>
    );
}

export default TemplatesSettings;
