
import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Matter, MatterStage, WorkflowDefinition, MatterType, Contact, User, UserRole, ModalType } from '../types';
import ScrollArrows from './ScrollArrows';
import Tooltip from './Tooltip';
import { formatDueDate, getDueDateColor, getDueDateBorderColor } from '../utils/colorUtils';
import { useProduct, useTerminology } from '../contexts/ProductContext';
import { ShieldCheckIcon, PlusIcon } from '../constants';
import InlineMatterReview from './InlineMatterReview';

// Define local interface for enriched matter (consistent with List view logic, but passed down)
interface EnrichedMatter extends Matter {
    hasExternalAccess: boolean;
    nextDeadline: { date: string; title: string } | null;
}

// --- Sub-Components ---
const MatterCard: React.FC<{ matter: EnrichedMatter; index: number; workflow: WorkflowDefinition | undefined, contacts: Contact[], onViewDetails: (id: string) => void; }> = ({ matter, index, workflow, contacts, onViewDetails }) => {
    const { isProperty } = useProduct();
    const terminology = useTerminology();
    const client = contacts.find(c => c.id === matter.clientId);

    const matterWorkflow = workflow
        ? matter.subCategory
            ? workflow.subCategories?.[matter.subCategory]
            : workflow.default
        : undefined;

    const totalStages = matterWorkflow?.stages.length || 1;
    const rawStageIndex = matterWorkflow?.stages.indexOf(matter.stage) ?? -1;
    // FIX: indexOf returns -1 when stage not found — clamp to 0 to prevent
    // negative progress bar widths for matters in "Other" (off-workflow) column
    const currentStageIndex = rawStageIndex < 0 ? 0 : rawStageIndex;
    const progressPercent = totalStages > 1 ? (currentStageIndex / (totalStages - 1)) * 100 : 100;

    // Determine visual urgency based on deadline if it exists, otherwise default border
    const urgencyBorderClass = matter.nextDeadline ? getDueDateBorderColor(matter.nextDeadline.date) : 'border-gray-200 dark:border-gray-700';

    return (
        <Draggable draggableId={matter.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onViewDetails(matter.id)}
                    className={`bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border-l-4 mb-3 transition-all duration-200 cursor-pointer ${urgencyBorderClass} ${snapshot.isDragging ? 'shadow-2xl scale-105' : 'hover:shadow-md'}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <Tooltip text={matter.title} checkForTruncation>
                            <p className="font-bold text-sm text-gray-800 dark:text-white truncate pr-2">{matter.title}</p>
                        </Tooltip>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <InlineMatterReview matter={matter} />
                            {matter.hasExternalAccess && (
                                <Tooltip text={isProperty ? 'Shared with External Partner' : 'Shared with External Counsel'}>
                                    <ShieldCheckIcon className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    <Tooltip text={client?.name || `Unknown ${terminology.client}`} checkForTruncation>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate mb-2">{client?.name || `Unknown ${terminology.client}`}</p>
                    </Tooltip>

                    {matter.nextDeadline ? (
                        <div className="mb-2 text-xs bg-slate-50 dark:bg-zinc-700/50 p-1.5 rounded border border-gray-100 dark:border-gray-700">
                            <span className="font-semibold text-2xs uppercase text-gray-400 block">Next Deadline</span>
                            <div className="flex justify-between items-center mt-0.5">
                                <span className="truncate max-w-[120px] text-gray-700 dark:text-gray-300" title={matter.nextDeadline.title}>{matter.nextDeadline.title}</span>
                                <span className={`font-bold ${getDueDateColor(matter.nextDeadline.date)}`}>{formatDueDate(matter.nextDeadline.date)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-2 h-1"></div> // Spacer
                    )}

                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1">
                            <div className="bg-primary-500 h-1 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

const MatterColumn: React.FC<{
    stage: MatterStage;
    matters: EnrichedMatter[];
    workflow: WorkflowDefinition | undefined,
    contacts: Contact[],
    onViewDetails: (id: string) => void;
}> = ({ stage, matters, workflow, contacts, onViewDetails }) => {
    return (
        <div className="flex flex-col w-80 flex-shrink-0 bg-slate-100 dark:bg-zinc-800 rounded-lg p-2">
            <div className="p-3 mb-2 border-b-2 border-gray-300 dark:border-slate-700">
                <h4 className="font-bold text-lg text-gray-800 dark:text-white flex justify-between items-center">
                    {stage}
                    <span className="text-sm font-semibold bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full px-2 py-0.5">{matters.length}</span>
                </h4>
            </div>
            <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-grow overflow-y-auto px-1 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary-100 dark:bg-primary-900/40' : ''}`}
                    >
                        {matters.map((matter, index) => (
                            <MatterCard key={matter.id} matter={matter} index={index} workflow={workflow} contacts={contacts} onViewDetails={onViewDetails} />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

interface MatterBoardViewProps {
    matters: EnrichedMatter[];
    workflows: WorkflowDefinition[];
    contacts: Contact[];
    users: User[];
    onUpdateStage: (matterId: string, newStage: string) => void;
    onViewDetails: (id: string) => void;
    openModal: (type: ModalType, id?: string | null, context?: any) => void;
}

const MatterBoardView: React.FC<MatterBoardViewProps> = ({ matters, workflows, contacts, onUpdateStage, onViewDetails, users, openModal }) => {
    const terminology = useTerminology();

    // Determine primary workflow
    const dominantType = matters.length > 0 ? matters[0].type : workflows[0]?.type;
    const activeWorkflow = workflows.find(w => w.type === dominantType);

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId) return;

        const newStage = destination.droppableId;
        const matter = matters.find(m => m.id === draggableId);

        // Automation Check
        if (matter) {
            const subCat = matter.subCategory;
            // Check if there are checklist templates associated with this stage in the workflow
            const suggestions = activeWorkflow?.subCategories?.[subCat || '']?.suggestions?.[newStage]
                || activeWorkflow?.default.suggestions?.[newStage];

            if (suggestions?.checklistTemplateIds && suggestions.checklistTemplateIds.length > 0) {
                openModal('stageChecklist', matter.id, { stage: newStage, workflow: activeWorkflow });
            }
        }

        onUpdateStage(draggableId, newStage);
    };

    const stages = useMemo(() => {
        const uniqueStages = new Set<string>();
        if (activeWorkflow?.default?.stages) {
            activeWorkflow.default.stages.forEach(s => uniqueStages.add(s));
        }
        matters.forEach(m => {
            if (m.stage) uniqueStages.add(m.stage);
        });
        return Array.from(uniqueStages);
    }, [activeWorkflow, matters]);

    const mattersByStage = useMemo(() => {
        const grouped: { [key: string]: EnrichedMatter[] } = {};
        stages.forEach(stage => {
            grouped[stage] = [];
        });

        matters.forEach(matter => {
            if (grouped[matter.stage]) {
                grouped[matter.stage].push(matter);
            } else {
                if (!grouped['Other']) grouped['Other'] = [];
                grouped['Other'].push(matter);
            }
        });
        return grouped;
    }, [stages, matters]);

    // Display ALL stages including 'Other' — previously the logic was:
    //   Object.keys(mattersByStage['Other']?.length ? { ...mattersByStage, 'Other': [] } : mattersByStage)
    // which CLEARED the 'Other' array if it had items, hiding matters with
    // off-workflow stages. Now we just show all stages as-is.
    const displayStages = Object.keys(mattersByStage);

    return (
        <div className="flex flex-col h-full p-4 sm:p-6 lg:p-8 pb-0">
            <div className="sticky top-0 bg-slate-50 dark:bg-zinc-900 z-20 py-4 -mt-4 -mx-4 px-4 shadow-sm border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center mb-4">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{terminology.matters}</h2>
                <button
                    onClick={() => openModal('newMatter')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-primary-700 flex items-center justify-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" /> {terminology.newMatter}
                </button>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
                <ScrollArrows>
                    <div className="flex gap-4 pb-4 min-h-[65vh]">
                        {displayStages.map(stage => (
                            <MatterColumn
                                key={stage}
                                stage={stage}
                                matters={mattersByStage[stage] || []}
                                workflow={activeWorkflow}
                                contacts={contacts}
                                onViewDetails={onViewDetails}
                            />
                        ))}
                    </div>
                </ScrollArrows>
            </DragDropContext>
        </div>
    );
};

export default MatterBoardView;
