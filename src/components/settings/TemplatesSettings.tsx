
import React, { useState, useEffect, useMemo } from 'react';
import { WorkflowDefinition, ChecklistTemplate, DocumentTemplate, DocumentTemplateCategory, ModalType, CustomEventType, ContactCategory, DocumentCategory, UserRole, AutomationRule } from '../../types';
import WorkflowBuilderView from '../WorkflowBuilderView';
import AutomationSettings from './AutomationSettings';
import { InfoIcon, ClipboardListIcon, TagIcon, EditIcon, TrashIcon, LockClosedIcon, ZapIcon, XIcon } from '../../constants';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
// PRACTICE-PROFILE ENGINE — retroactive entry: lets an existing firm pick
// its practice areas / portfolio composition and pre-populate workflows,
// contact types, document folders, event types and checklists (additive,
// idempotent — existing configuration is never touched).
import { PracticeProfileSetup } from '../PracticeProfileSetup';
import { useDataState, useDataActions } from '../../contexts/DataContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-md p-6 ${className || ''}`}>
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
    activeTab: TemplateSubTab | CategorySubTab | 'automations' | 'practice-blueprint' | null;
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
    const { closeModal, addToast } = useUI();
    const { isLegal, isProperty } = useProduct();
    const [topLevelTab, setTopLevelTab] = useState<'workflows' | 'categories' | 'automations'>(
        isLegal ? 'workflows' : 'categories'
    );
    const [workflowSubTab, setWorkflowSubTab] = useState<TemplateSubTab>('workflows');
    const [categorySubTab, setCategorySubTab] = useState<CategorySubTab>('events');

    // ── PRACTICE-PROFILE ENGINE (retroactive entry) ─────────────────────
    // Card at the top of Firm/Portfolio Configuration + the setup wizard
    // modal it opens. Uses RAW appState (DB rows) for the engine's
    // existing-collections so dedupe is exact — coreState's product-mode
    // fallback lists would produce false "duplicates".
    const [blueprintOpen, setBlueprintOpen] = useState(false);
    const { appState } = useDataState();
    const { addItem, updateItem, handleUpdateFirmDetails } = useDataActions();
    const { coreState } = useCoreState();
    const firmProfile = (coreState.firmDetails as any)?.practiceProfile || {};
    const configuredAreas: string[] = firmProfile.practiceAreas || (coreState.firmDetails as any)?.firmSpecialties || [];
    const configuredPortfolio: string[] = firmProfile.portfolioTypes || [];
    const configuredFocus: string[] = firmProfile.focusAreas || [];
    const blueprintApplied = !!firmProfile.blueprintAppliedAt;

    // Deep-link support: Settings → target 'practice-blueprint' (used by the
    // Getting Started checklist's "Pre-configure your practice" item).
    useEffect(() => {
        if (activeTab === 'practice-blueprint') setBlueprintOpen(true);
    }, [activeTab]);

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
                            className="w-full text-center px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 rounded-lg font-bold hover:border-primary-500 hover:text-primary-600 transition-all mb-6"
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
            {/* ── PRACTICE BLUEPRINT card ────────────────────────────────── */}
            {/* Pre-populates matter types (sub-categories + stages), contact */}
            {/* types, document folders, event types and checklists from the */}
            {/* firm's practice areas / portfolio composition. Additive and  */}
            {/* idempotent — re-running only adds what's missing.            */}
            <div id="practice-blueprint" className="relative overflow-hidden bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-md">
                <div className="relative z-10 p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-[240px]">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                                {isProperty && !isLegal ? 'Portfolio Blueprint' : 'Practice Blueprint'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xl">
                                {isLegal && isProperty
                                    ? 'Pick your areas of law and portfolio composition — we set up matching matter types with sub-categories and stages, contact types, document folders, event types and starter checklists for both sides.'
                                    : isProperty
                                        ? 'Pick your portfolio composition and services — we set up matching contact types, document folders, event types and starter checklists.'
                                        : 'Pick your areas of law — we set up matching matter types with sub-categories and stages, contact types, document folders, event types and starter checklists.'}
                                {' '}Everything is editable afterwards, and re-running only adds what is missing.
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {blueprintApplied ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-2xs font-bold rounded-full border border-emerald-200">Configured</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-2xs font-bold rounded-full border border-amber-200">Not configured yet</span>
                                )}
                                {configuredAreas.slice(0, 6).map(a => (
                                    <span key={a} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-2xs font-bold rounded-full border border-indigo-100">{a}</span>
                                ))}
                                {configuredPortfolio.map(pt => (
                                    <span key={pt} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-2xs font-bold rounded-full border border-teal-100">{pt}</span>
                                ))}
                                {configuredFocus.slice(0, 4).map(f => (
                                    <span key={f} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-2xs font-bold rounded-full border border-amber-100">{f}</span>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => setBlueprintOpen(true)}
                            data-tour-id="practice-blueprint-cta"
                            className="flex-shrink-0 px-4 py-2.5 bg-primary-600 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-primary-700 transition-colors"
                        >
                            {blueprintApplied ? 'Adjust / Re-run' : 'Configure Now'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-4 border-b border-slate-200 dark:border-zinc-700">
                {isLegal && (
                    <button
                        onClick={() => setTopLevelTab('workflows')}
                        className={`flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${topLevelTab === 'workflows' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                    >
                        <ClipboardListIcon className="w-4 h-4" /> Workflows
                    </button>
                )}
                <button
                    onClick={() => setTopLevelTab('categories')}
                    className={`flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${topLevelTab === 'categories' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                >
                    <TagIcon className="w-4 h-4" /> Categories
                </button>
                <button
                    onClick={() => setTopLevelTab('automations')}
                    className={`flex-shrink-0 pb-3 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${topLevelTab === 'automations' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
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
                                className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all ${workflowSubTab === tab ? 'bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
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
                                className={`py-1.5 px-3 rounded-full text-xs font-bold transition-all ${categorySubTab === tab ? 'bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
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

            {/* ── PRACTICE BLUEPRINT modal ───────────────────────────────── */}
            {blueprintOpen && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Practice blueprint setup"
                    onClick={() => setBlueprintOpen(false)}
                >
                    <div
                        className="min-h-full flex items-start justify-center p-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-premium my-8 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
                                <div>
                                    <p className="text-2xs font-black text-primary-500 uppercase tracking-widest">
                                        {isProperty && !isLegal ? 'Portfolio Blueprint' : 'Practice Blueprint'}
                                    </p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                                        Pre-configure your workspace
                                    </p>
                                </div>
                                <button
                                    onClick={() => setBlueprintOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                    aria-label="Close"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <PracticeProfileSetup
                                product={isProperty && !isLegal ? 'atrium' : isLegal && isProperty ? 'unified' : 'vega'}
                                initialAreas={configuredAreas}
                                initialPortfolioTypes={configuredPortfolio}
                                initialFocusAreas={configuredFocus}
                                firmId={coreState.firmDetails?.id || ''}
                                onClose={() => setBlueprintOpen(false)}
                                contactCategories={(appState as any).contactCategories || []}
                                documentCategories={(appState as any).documentCategories || []}
                                eventTypes={(appState as any).eventTypes || []}
                                workflows={workflows}
                                checklistTemplates={(appState as any).checklistTemplates || []}
                                addItem={addItem as any}
                                updateItem={updateItem as any}
                                onApplied={async ({ areas, portfolioTypes, focusAreas, result }) => {
                                    // Persist the selection so the card reflects the
                                    // firm's profile and the Getting-Started checklist
                                    // item (hasPracticeProfile) ticks off.
                                    try {
                                        const fd: any = coreState.firmDetails;
                                        await handleUpdateFirmDetails({
                                            id: fd?.id,
                                            ...(areas.length > 0 ? { firmSpecialties: areas } : {}),
                                            practiceProfile: {
                                                ...(fd?.practiceProfile || {}),
                                                practiceAreas: areas.length > 0 ? areas : (fd?.practiceProfile || {}).practiceAreas,
                                                portfolioTypes: portfolioTypes.length > 0 ? portfolioTypes : (fd?.practiceProfile || {}).portfolioTypes,
                                                focusAreas: focusAreas.length > 0 ? focusAreas : (fd?.practiceProfile || {}).focusAreas,
                                                blueprintAppliedAt: result.created + result.merged > 0
                                                    ? new Date().toISOString()
                                                    : (fd?.practiceProfile || {}).blueprintAppliedAt,
                                            },
                                        });
                                        addToast?.(
                                            `Blueprint applied: ${result.created} additions created, ${result.merged} workflows enriched, ${result.skipped} already present.`,
                                            { type: 'success', duration: 6000 },
                                        );
                                    } catch (e) {
                                        console.warn('[TemplatesSettings] failed to persist practice profile:', e);
                                        addToast?.('Blueprint items were created, but saving your practice profile failed. You can retry from Firm Details.', { type: 'info', duration: 6000 });
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TemplatesSettings;
