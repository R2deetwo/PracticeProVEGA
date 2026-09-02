import React, { useState, useEffect } from 'react';
import { WorkflowDefinition, MatterType } from '../../types';
import { PlusIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { useUI } from '../../contexts/UIContext';

interface WorkflowFormProps {
    onAddWorkflow?: (newWorkflow: Omit<WorkflowDefinition, 'id'>) => Promise<any> | any;
    onUpdateWorkflow?: (updatedWorkflow: WorkflowDefinition) => Promise<any> | any;
    onDelete?: () => void;
    onClose: () => void;
    workflowToEdit?: WorkflowDefinition;
    workflows: WorkflowDefinition[];
    context?: {
        isNewSub?: boolean;
        parentType?: string;
        subCategoryName?: string;
        matterType?: string;
        generatedStages?: string[]; // Added: AI Generated Stages
    };
}

const WorkflowForm: React.FC<WorkflowFormProps> = ({
    onAddWorkflow,
    onUpdateWorkflow,
    onDelete,
    onClose,
    workflowToEdit,
    workflows,
    context
}) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { isProperty } = useProduct();
    const { addToast } = useUI();
    const [type, setType] = useState('');
    const [subCategoryName, setSubCategoryName] = useState('');
    const [stages, setStages] = useState<string[]>(['']);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Determine if we are adding a sub-category or editing/creating a root workflow
    const isSubCategoryMode = context?.isNewSub || !!context?.subCategoryName;
    const isEditing = !!workflowToEdit && !isSubCategoryMode;

    useEffect(() => {
        if (workflowToEdit) {
            setType(workflowToEdit.type);
            if (!isSubCategoryMode) {
                // Editing root default stages
                setStages(workflowToEdit.default.stages);
            }
        } else if (context?.matterType) {
            // Pre-fill type from context (AI or user selection)
            setType(context.matterType);
        }

        if (isSubCategoryMode) {
            if (context?.subCategoryName) setSubCategoryName(context.subCategoryName);
            if (context?.generatedStages) setStages(context.generatedStages);
            else setStages(['Intake', 'Drafting', 'Review', 'Execution', 'Closed']); // Default
        } else if (!workflowToEdit && !context?.generatedStages) {
            setStages(['Intake', 'Drafting', 'Review', 'Execution', 'Closed']);
        }
    }, [workflowToEdit, context, isSubCategoryMode]);

    const handleStageChange = (index: number, val: string) => {
        const newStages = [...stages];
        newStages[index] = val;
        setStages(newStages);
    };

    const addStage = () => setStages([...stages, '']);
    const removeStage = (index: number) => {
        if (stages.length > 1) {
            setStages(stages.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!type.trim()) {
            addToast(`Please provide a workflow type (${isProperty ? 'Category' : 'Practice Area'}).`, { type: 'error' });
            return;
        }
        const finalStages = stages.filter(s => s.trim() !== '');
        if (finalStages.length === 0) {
            addToast("Please provide at least one stage.", { type: 'error' });
            return;
        }

        setIsSubmitting(true);

        try {
            // CASE 1: Adding a Sub-Category (e.g. "Company Registration" under "Corporate")
            if (isSubCategoryMode) {
                if (!subCategoryName.trim()) {
                    addToast("Sub-category name is required.", { type: 'error' });
                    setIsSubmitting(false);
                    return;
                }

                // Find existing parent or create new parent container
                let parentWorkflow = workflowToEdit || workflows.find(w => w.type && w.type.toLowerCase() === type.toLowerCase());

                if (parentWorkflow && onUpdateWorkflow) {
                    const updatedWorkflow = {
                        ...parentWorkflow,
                        subCategories: {
                            ...(parentWorkflow.subCategories || {}),
                            [subCategoryName]: { stages: finalStages, suggestions: {} }
                        }
                    };
                    await onUpdateWorkflow(updatedWorkflow);
                } else if (onAddWorkflow) {
                    // No parent found — create a new workflow with the sub-category
                    const newWorkflow: any = {
                        firmId: coreState.firmDetails.id,
                        type: type as MatterType,
                        default: { stages: finalStages, suggestions: {} },
                        subCategories: {
                            [subCategoryName]: { stages: finalStages, suggestions: {} }
                        }
                    };
                    await onAddWorkflow(newWorkflow);
                }
            }
            // CASE 2: Editing Existing Root Workflow
            else if (isEditing && workflowToEdit && onUpdateWorkflow) {
                await onUpdateWorkflow({
                    ...workflowToEdit,
                    type: type as MatterType,
                    default: { ...workflowToEdit.default, stages: finalStages }
                });
            }
            // CASE 3: Creating New Root Workflow
            else if (onAddWorkflow) {
                await onAddWorkflow({
                    firmId: coreState.firmDetails.id,
                    type: type as MatterType,
                    default: { stages: finalStages, suggestions: {} },
                    subCategories: {}
                });
            }

            addToast('Workflow saved successfully.', { type: 'success' });
            onClose();
        } catch (e: any) {
            console.error("Workflow save failed", e);
            addToast(`Failed to save workflow: ${e.message || 'Unknown error'}`, { type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const commonInputClass = inputModern;
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    // ROUND 9 — SLIM FORM FACTOR: the modal chrome (title "New/Edit Workflow")
    // already tells the user what this is, so the two heavy icon+header card
    // blocks ("Details / Practice Area", "Process / Workflow Stages") were
    // redundant visual weight. The form is now a single compact column:
    // labeled inputs, inline stage list, compact footer. Radii follow the
    // STYLE_GUIDE scale (rounded-md for inputs/rows/buttons, not rounded-2xl).
    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 -m-2">
            <div className="space-y-3 pb-4">
                {/* Identity — one compact row (type + optional sub-category) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>{isProperty ? 'Category' : 'Practice Area'}</label>
                        <input autoComplete="off" data-lpignore="true"
                            type="text"
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className={commonInputClass}
                            placeholder={isProperty ? 'e.g. Property Management' : 'e.g. Civil Litigation'}
                            required
                            readOnly={!!workflowToEdit}
                        />
                    </div>
                    {isSubCategoryMode && (
                        <div>
                            <label className={labelClass}>Category Name</label>
                            <input autoComplete="off" data-lpignore="true"
                                type="text"
                                value={subCategoryName}
                                onChange={e => setSubCategoryName(e.target.value)}
                                className={commonInputClass}
                                placeholder={isProperty ? 'e.g. Lease Renewal' : 'e.g. Divorce Petition'}
                                required
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Stages — compact numbered list */}
                <div>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                            Workflow Stages
                            <span className="ml-1.5 text-2xs font-normal text-slate-400 dark:text-zinc-500">
                                ({stages.filter(s => s.trim() !== '').length} {stages.length === 1 ? 'stage' : 'stages'})
                            </span>
                        </label>
                        <button type="button" onClick={addStage} className="text-2xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 uppercase tracking-widest px-1.5 py-0.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                            + Add Stage
                        </button>
                    </div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {stages.map((stage, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-zinc-800 rounded-md border border-slate-200 dark:border-zinc-700 group">
                                <span className="text-2xs font-black text-slate-300 dark:text-zinc-600 w-6 text-center flex-shrink-0 tabular-nums">{idx + 1}</span>
                                <input autoComplete="off" data-lpignore="true"
                                    type="text"
                                    value={stage}
                                    onChange={e => handleStageChange(idx, e.target.value)}
                                    className="flex-grow bg-transparent border-none text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-300 focus:ring-0 outline-none min-w-0"
                                    placeholder={`Stage ${idx + 1} name...`}
                                />
                                {stages.length > 1 && (
                                    <button type="button" onClick={() => removeStage(idx)} className="p-1.5 text-slate-300 dark:text-zinc-600 hover:text-rose-500 transition-colors rounded-md flex-shrink-0" aria-label={`Remove stage ${idx + 1}`}>
                                        <PlusIcon className="w-3.5 h-3.5 rotate-45" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {isSubmitting && <div className="text-center text-2xs font-black text-primary-500 uppercase tracking-widest animate-pulse">Saving Workflow...</div>}
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-3 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 z-50 pb-safe-extra">
                {isEditing && onDelete ? (
                    <button type="button" onClick={onDelete} className="text-2xs font-black text-rose-500 uppercase tracking-widest hover:underline px-1 flex-shrink-0">Delete Workflow</button>
                ) : <span />}
                <div className="flex gap-2.5 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-md hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-primary-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving…' : `Save ${isSubCategoryMode ? 'Sub-category' : 'Workflow'}`}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default WorkflowForm;
