
import React, { useState, useEffect, useRef } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { ModalType } from '../../types';
import { DismissIcon } from '../../constants';

// Import forms directly
import { MatterForm } from '../forms/MatterForm';
import { DocumentForm } from '../forms/DocumentForm';
import TaskForm from '../forms/TaskForm';
import ContactForm from '../forms/ContactForm';
import LeadForm from '../forms/LeadForm';
import { EventForm } from '../forms/EventForm';
import TaskDetailModal from './TaskDetailModal';
import WorkflowForm from '../forms/WorkflowForm'; // Added WorkflowForm
import ChecklistTemplateForm from '../forms/ChecklistTemplateForm'; // Added Checklist

export const DockedModal: React.FC = () => {
    const { dockedModalType, modalContext, editingId, closeModal, getModalTitle, navigateTo, openModal } = useUI(); // Destructure openModal
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const dataHandlers = useDataActions();
    const { currentUser, appMode } = useAuth();
    
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (dockedModalType) {
            setShouldRender(true);
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [dockedModalType]);

    if (!shouldRender) return null;
    
    let content: React.ReactNode = null;
    let title = dockedModalType ? getModalTitle(dockedModalType as ModalType) : '';
    
    // Determine if this was opened by ALOA (Side Drawer) or User (Center Modal)
    const isAloaTriggered = modalContext?.openedByAloa === true;
    
    // Common props for forms
    if (dockedModalType) {
        switch(dockedModalType) {
            case 'newMatter':
            case 'editMatter': {
                const matter = matterState.matters.find(m => m.id === editingId);
                content = (
                    <MatterForm
                        matters={matterState.matters} users={coreState.users} contacts={matterState.contacts} workflows={executionState.workflows}
                        onAddMatter={dataHandlers.onAddMatter} onUpdateMatter={dataHandlers.handleUpdateMatter}
                        onClose={closeModal} matterToEdit={matter} currentUser={currentUser!} appMode={appMode}
                        handleAddWorkflow={dataHandlers.handleAddWorkflow} handleAddWorkflowSubCategory={dataHandlers.handleAddWorkflowSubCategory}
                        onNavigate={navigateTo} initialContext={modalContext}
                        openModal={openModal} 
                        isCompact={true} // Force compact for side drawer
                    />
                );
                break;
            }
            case 'newDocument':
            case 'editDocument':
            case 'newDraft': {
                const doc = documentState.documents.find(d => d.id === editingId);
                let ctx = modalContext;
                if (dockedModalType === 'newDraft' && (modalContext?.fields || modalContext)) {
                     const aiFields = modalContext.fields || modalContext;
                     ctx = {
                         ...modalContext,
                         draftTitle: aiFields.title || aiFields.draftTitle || 'New Draft',
                         draftContent: aiFields.content || aiFields.body || aiFields.draftContent || ''
                     };
                }

                content = <DocumentForm 
                    documents={documentState.documents} matters={matterState.matters} contacts={matterState.contacts} documentCategories={coreState.documentCategories} documentTemplates={coreState.documentTemplates} documentTemplateCategories={coreState.documentTemplateCategories} firmDetails={coreState.firmDetails} 
                    onAddDocument={dataHandlers.handleAddDocumentAndAnalyze} onUpdateDocument={(d) => dataHandlers.updateItem('documents', d, d.title)} onClose={closeModal} documentToEdit={doc} currentUser={currentUser!} onNavigate={navigateTo} initialContext={ctx} 
                    isCompact={true}
                />;
                break;
            }
            case 'viewTask': {
                 const task = executionState.tasks.find(t => t.id === editingId);
                 if (task && currentUser) {
                     content = <TaskDetailModal
                        task={task}
                        users={coreState.users}
                        matters={matterState.matters}
                        documents={documentState.documents}
                        onEdit={() => {
                            openModal('newTask', task.id, modalContext);
                        }}
                        onDelete={() => {
                             dataHandlers.deleteItem('tasks', task.id, task.title);
                             closeModal();
                        }}
                        onUpdateTask={(t) => dataHandlers.updateItem('tasks', t, t.title)}
                        onViewInTasks={(id, color) => { closeModal(); }}
                        currentUser={currentUser}
                        onNavigateToMatter={(mId) => { closeModal(); navigateTo('matterDetail', mId); }}
                        openedFrom={modalContext?.openedFrom}
                    />;
                 }
                 break;
            }
            case 'newTask': {
                 const taskToEdit = editingId ? executionState.tasks.find(t => t.id === editingId) : undefined;
                 if (taskToEdit) title = 'Edit Task'; 

                 content = <TaskForm 
                    matters={matterState.matters} 
                    tasks={executionState.tasks} 
                    users={coreState.users} 
                    documents={documentState.documents} 
                    checklistTemplates={coreState.checklistTemplates} 
                    onAddTask={dataHandlers.handleAddTask} 
                    onUpdateTask={(t) => dataHandlers.updateItem('tasks', t, t.title)}
                    onClose={closeModal} 
                    initialContext={modalContext} 
                    currentUser={currentUser!} 
                    appMode={appMode} 
                    isCompact={true}
                    taskToEdit={taskToEdit}
                />;
                break;
            }
            case 'newContact':
            case 'editContact': {
                const contact = matterState.contacts.find(c => c.id === editingId);
                content = <ContactForm 
                    onAddContact={dataHandlers.handleAddContact} onUpdateContact={dataHandlers.handleUpdateContact} onClose={closeModal} contactToEdit={contact} contactCategories={coreState.contactCategories} initialContext={modalContext?.fields || modalContext} 
                    isCompact={true}
                />;
                break;
            }
            case 'newLead': {
                content = <LeadForm onClose={closeModal} initialContext={modalContext?.fields || modalContext} />;
                break;
            }
            case 'newEvent':
            case 'editEvent': {
                const event = executionState.events.find(e => e.id === editingId);
                content = <EventForm 
                    matters={matterState.matters} users={coreState.users} appMode={appMode} eventTypes={coreState.eventTypes} onSave={(e) => dataHandlers.addItem('events', e, e.title)} onUpdateEvent={(e) => dataHandlers.updateItem('events', e, e.title)} onClose={closeModal} onNavigate={navigateTo} currentUser={currentUser!} eventToEdit={event} initialContext={modalContext?.fields || modalContext} 
                    isCompact={true}
                />;
                break;
            }
            // FIX: Added Workflow cases to support ALOA workflow creation in Docked Modal
            case 'newWorkflow':
            case 'editWorkflow': {
                 const wf = executionState.workflows.find(w => w.id === editingId);
                 content = <WorkflowForm 
                    onAddWorkflow={(w) => dataHandlers.handleAddWorkflow(w)} 
                    onUpdateWorkflow={dataHandlers.handleUpdateWorkflow} 
                    onDelete={() => { /* Handle delete workflow */ }} 
                    onClose={closeModal} 
                    workflowToEdit={wf} 
                    workflows={executionState.workflows} 
                    context={modalContext} 
                 />;
                 break;
            }
            case 'newChecklistTemplate':
            case 'editChecklistTemplate': {
                 const ct = coreState.checklistTemplates.find(t => t.id === editingId);
                 content = <ChecklistTemplateForm 
                    onAddTemplate={(t) => dataHandlers.addItem('checklistTemplates', t, t.name)} 
                    onUpdateTemplate={(t) => dataHandlers.updateItem('checklistTemplates', t, t.name)} 
                    onDelete={() => dataHandlers.deleteItem('checklistTemplates', editingId!, 'Checklist Template')} 
                    onClose={closeModal} 
                    templateToEdit={ct} 
                    workflows={executionState.workflows} 
                 />;
                 break;
            }
            default:
                content = (
                    <div className="text-center p-10 flex flex-col items-center justify-center h-full">
                         <p className="text-gray-500 mb-4">This form type ({dockedModalType}) is not yet supported in the docked panel.</p>
                         <button onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg">Close</button>
                    </div>
                );
        }
    }

    // Always render as side drawer when there's a docked modal type
    if (dockedModalType) {
        return (
            <>
                <div 
                    className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[110] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                    onClick={() => closeModal()}
                />
                <div
                    className={`
                        fixed top-0 right-0 h-full w-[480px] max-w-[90vw] z-[120] flex flex-col 
                        bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl 
                        border-l border-slate-200 dark:border-zinc-700 
                        transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isVisible ? 'translate-x-0' : 'translate-x-full'}
                    `}
                >
                    <header className="flex-shrink-0 flex justify-between items-center px-6 h-16 border-b border-slate-200/50 dark:border-zinc-700/50 bg-slate-50/80 dark:bg-zinc-900/80">
                        <div className="text-base font-bold text-slate-800 dark:text-white truncate max-w-xs">{title}</div>
                        <button onClick={() => closeModal()} className="p-2 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                            <DismissIcon className="w-5 h-5" />
                        </button>
                    </header>
                    <main className="flex-grow overflow-y-auto custom-scrollbar relative">
                        {content}
                    </main>
                </div>
            </>
        );
    }

    return null;
};
