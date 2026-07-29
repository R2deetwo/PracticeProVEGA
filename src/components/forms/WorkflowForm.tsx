import React, { useState, useEffect } from 'react';
import { WorkflowDefinition, MatterType } from '../../types';
import { GavelIconLarge, PlusIcon, TrashIcon, ChevronDownIcon, SaveIcon, XIcon, ZapIcon, InfoIcon, ListIcon } from '../../constants';
import { ChevronUp as ChevronUpIcon } from 'lucide-react';
import { inputModern } from '../../utils/formStyles';
import { useCoreState } from '../../contexts/CoreContext';
import { useProduct } from '../../contexts/ProductContext';
import { useUI } from '../../contexts/UIContext';
import { v4 as uuidv4 } from 'uuid';

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

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
            <div className="space-y-2 sm:space-y-3 pb-6">
                {/* Core Identity Section */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
                    <div className="flex items-center gap-4 mb-2 px-1">
                        <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                            <PlusIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <p className="text-2xs font-bold text-primary-600 dark:text-primary-300/70 uppercase tracking-widest leading-none mb-0.5">Details</p>
                            <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{isProperty ? 'Category' : 'Practice Area'}</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2 group">
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
                            <div className="space-y-2 group">
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
                    {isSubmitting && <div className="text-center text-2xs font-black text-primary-500 uppercase tracking-widest animate-pulse">Saving Workflow...</div>}
                </div>

                {/* Stages Section */}
                <div className="p-3 sm:p-4 bg-slate-50/50 dark:bg-zinc-800/30 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-4">
                            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                                <PlusIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-2xs font-bold text-indigo-600 dark:text-indigo-300/70 uppercase tracking-widest leading-none mb-0.5">Process</p>
                                <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Workflow Stages</h3>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {stages.map((stage, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm group">
                                    <span className="text-2xs font-black text-slate-300 dark:text-zinc-700 w-8 text-center">{String(idx + 1).padStart(2, '0')}</span>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="text"
                                        value={stage}
                                        onChange={e => handleStageChange(idx, e.target.value)}
                                        className="flex-grow bg-transparent border-none text-sm text-slate-700 dark:text-zinc-200 placeholder:text-slate-300 focus:ring-0 outline-none"
                                        placeholder={`Enter stage ${idx + 1} name...`}
                                    />
                                    {stages.length > 1 && (
                                        <button type="button" onClick={() => removeStage(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                        <PlusIcon className="w-3.5 h-3.5 rotate-45" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addStage} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-2xs font-black text-slate-400 uppercase tracking-widest hover:border-primary-500 hover:text-primary-600 transition-all flex items-center justify-center gap-2">
                            <PlusIcon className="w-3.5 h-3.5" /> Add Stage
                        </button>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap sm:justify-between items-center gap-2 sm:gap-4 z-50">
                <div>
                    {isEditing && onDelete && (
                        <button type="button" onClick={onDelete} className="text-2xs font-black text-rose-500 uppercase tracking-widest hover:underline px-2">Delete Workflow</button>
                    )}
                </div>
                <div className="flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 flex-1 sm:flex-none">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        Save {isSubCategoryMode ? 'Sub-category' : 'Workflow'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default WorkflowForm;
