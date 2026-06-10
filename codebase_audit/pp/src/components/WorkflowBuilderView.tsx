import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { WorkflowDefinition, MatterStage, ModalType } from '../types';

const StageCard: React.FC<{
    stage: MatterStage,
    index: number,
    onUpdate: (index: number, newName: string) => void,
    onDelete: (index: number) => void
}> = ({ stage, index, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(stage);

    useEffect(() => {
        setName(stage);
        // Automatically enter edit mode for new, empty stages
        if (stage === '') {
            setIsEditing(true);
        }
    }, [stage]);

    const handleSave = () => {
        if (name.trim() && name.trim() !== stage) {
            onUpdate(index, name.trim());
        } else if (!name.trim()) {
            // If the user leaves it blank, delete it
            onDelete(index);
        } else {
            setName(stage);
        }
        setIsEditing(false);
    };

    return (
        <Draggable draggableId={`${stage}-${index}`} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`flex items-center p-3 mb-2 rounded-lg shadow-sm border-l-4 transition-all ${snapshot.isDragging ? 'bg-primary-100 dark:bg-primary-900/50 border-primary-500' : 'bg-white dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'}`}
                >
                    <div {...provided.dragHandleProps} className="p-2 cursor-grab text-gray-400 hover:text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </div>
                    <span className="font-bold text-gray-500 dark:text-gray-400 mr-3">{index + 1}.</span>
                    {isEditing ? (
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            className="flex-grow bg-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 rounded-md p-1"
                            autoFocus
                        />
                    ) : (
                        <p onClick={() => setIsEditing(true)} className="flex-grow cursor-pointer p-1 text-gray-800 dark:text-gray-200">{stage}</p>
                    )}
                    <button onClick={() => onDelete(index)} className="p-1 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            )}
        </Draggable>
    );
};

interface WorkflowBuilderViewProps {
    workflows: WorkflowDefinition[];
    onUpdateWorkflow: (updatedWorkflow: WorkflowDefinition) => void;
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    initialSelectedWorkflowId?: string | null;
    initialSelectedSubCategory?: string | null;
}

const WorkflowBuilderView: React.FC<WorkflowBuilderViewProps> = ({ workflows, onUpdateWorkflow, openModal, initialSelectedWorkflowId, initialSelectedSubCategory }) => {
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
    const [activeTabName, setActiveTabName] = useState<string>('Default');

    useEffect(() => {
        if (initialSelectedWorkflowId) {
            setSelectedWorkflowId(initialSelectedWorkflowId);
            const workflow = workflows.find(w => w.id === initialSelectedWorkflowId);
            const targetTab = (workflow && initialSelectedSubCategory && workflow.subCategories?.[initialSelectedSubCategory])
                ? initialSelectedSubCategory
                : 'Default';
            setActiveTabName(targetTab);
        } else if (workflows.length > 0 && !selectedWorkflowId) {
            setSelectedWorkflowId(workflows[0].id);
            setActiveTabName('Default');
        }
    }, [initialSelectedWorkflowId, initialSelectedSubCategory, workflows, selectedWorkflowId]);


    const selectedWorkflow = useMemo(() => workflows.find(w => w.id === selectedWorkflowId), [workflows, selectedWorkflowId]);

    const handleWorkflowSelection = (id: string) => {
        setSelectedWorkflowId(id);
        setActiveTabName('Default'); // Reset to default when user manually selects a workflow
    };

    const handleUpdate = (updater: (wf: WorkflowDefinition) => WorkflowDefinition) => {
        if (selectedWorkflow) {
            onUpdateWorkflow(updater(selectedWorkflow));
        }
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination || !selectedWorkflow) return;
        const { source, destination } = result;

        const currentWorkflow = activeTabName === 'Default' ? selectedWorkflow.default : selectedWorkflow.subCategories?.[activeTabName];
        if (!currentWorkflow) return;

        const items: MatterStage[] = [...(currentWorkflow?.stages || [])];
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);

        handleUpdate(wf => {
            const newWf = { ...wf };
            if (activeTabName === 'Default') {
                newWf.default = { ...newWf.default!, stages: items };
            } else {
                newWf.subCategories = { ...newWf.subCategories, [activeTabName]: { ...currentWorkflow, stages: items } };
            }
            return newWf;
        });
    };

    const handleAddStage = () => {
        if (selectedWorkflow) {
            handleUpdate(wf => {
                const newWf = { ...wf };
                const current = activeTabName === 'Default' ? newWf.default : newWf.subCategories?.[activeTabName];
                if (current) {
                    const newStages = [...current.stages, ''];
                    if (activeTabName === 'Default') newWf.default = { ...current, stages: newStages };
                    else newWf.subCategories = { ...newWf.subCategories, [activeTabName]: { ...current, stages: newStages } };
                }
                return newWf;
            });
        }
    };

    const handleUpdateStage = (index: number, newName: string) => {
        handleUpdate(wf => {
            const newWf = { ...wf };
            const current = activeTabName === 'Default' ? newWf.default : newWf.subCategories?.[activeTabName];
            if (current) {
                const newStages = [...current.stages];
                newStages[index] = newName;
                if (activeTabName === 'Default') newWf.default = { ...current, stages: newStages };
                else newWf.subCategories = { ...newWf.subCategories, [activeTabName]: { ...current, stages: newStages } };
            }
            return newWf;
        });
    };

    const handleDeleteStage = (index: number) => {
        handleUpdate(wf => {
            const newWf = { ...wf };
            const current = activeTabName === 'Default' ? newWf.default : newWf.subCategories?.[activeTabName];
            if (current) {
                const newStages = current.stages.filter((_: any, i: number) => i !== index);
                if (activeTabName === 'Default') newWf.default = { ...current, stages: newStages };
                else newWf.subCategories = { ...newWf.subCategories, [activeTabName]: { ...current, stages: newStages } };
            }
            return newWf;
        });
    };

    const currentStages = selectedWorkflow ? (activeTabName === 'Default' ? selectedWorkflow.default?.stages : selectedWorkflow.subCategories?.[activeTabName]?.stages) : [];

    return (
        <div className="flex flex-col md:flex-row gap-6 h-auto md:h-[35rem]">
            {/* Workflow List */}
            <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 pr-4 mb-4 md:mb-0 flex flex-col max-h-64 md:max-h-full">
                <ul className="overflow-y-auto space-y-1 flex-grow">
                    {workflows.map(wf => (
                        <li key={wf.id}>
                            <button onClick={() => handleWorkflowSelection(wf.id)} className={`w-full text-left p-2 rounded-md font-semibold text-sm transition-colors ${selectedWorkflowId === wf.id ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                                {wf.type}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            {/* Builder */}
            <div className="md:w-2/3 flex flex-col">
                {selectedWorkflow ? (
                    <>
                        <div className="pb-2 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editing Workflow: <span className="text-primary-600 dark:text-primary-400">{selectedWorkflow.type}</span></h3>
                        </div>
                        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <nav className="-mb-px flex space-x-4 overflow-x-auto">
                                <button onClick={() => setActiveTabName('Default')} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTabName === 'Default' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Default</button>
                                {Object.keys(selectedWorkflow.subCategories || {}).map(sub => (
                                    <button key={sub} onClick={() => setActiveTabName(sub)} className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTabName === sub ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{sub}</button>
                                ))}
                                <button onClick={() => openModal('editWorkflow', selectedWorkflow.id, { isNewSub: true })} className="py-2 px-1 text-sm font-medium text-primary-600 hover:text-primary-800">+ Add Sub-category</button>
                            </nav>
                        </div>
                        <div className="flex-grow overflow-y-auto pt-4 pr-2">
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="stages">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef}>
                                            {(currentStages || []).map((stage: string, index: number) => (
                                                <StageCard key={`${stage}-${index}`} stage={stage} index={index} onUpdate={handleUpdateStage} onDelete={handleDeleteStage} />
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                            <button onClick={handleAddStage} className="mt-4 w-full p-2 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary-500 hover:text-primary-600">
                                + Add Stage
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-gray-500">Select a workflow to edit</div>
                )}
            </div>
        </div>
    );
};

export default WorkflowBuilderView;