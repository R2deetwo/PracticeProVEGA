import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Matter, WorkflowDefinition, Task, ChecklistTemplate, ChecklistItem, TaskPriority, TaskStatus } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { TrashIcon, PlusIcon } from '../../constants';
import { inputClassic } from '../../utils/formStyles';

interface StageChecklistFormProps {
  matter: Matter;
  stage: string;
  workflow: WorkflowDefinition | undefined;
  checklistTemplates: ChecklistTemplate[];
  onClose: () => void;
}

export const StageChecklistForm: React.FC<StageChecklistFormProps> = ({
  matter,
  stage,
  workflow,
  checklistTemplates,
  onClose,
}) => {
  const { handleApplyStageChecklist, handleApplyCustomStageChecklist } = useDataActions();
  const { addToast } = useUI();
  
  const [activeTab, setActiveTab] = useState<'template' | 'create'>('template');

  // State for "Use Template" tab
  const suggestedTemplateIds = useMemo(() => {
    if (!workflow) return [];
    const stageSuggestions = workflow.subCategories?.[matter.subCategory || '']?.suggestions?.[stage] || workflow.default.suggestions[stage];
    return stageSuggestions?.checklistTemplateIds || [];
  }, [workflow, matter.subCategory, stage]);
  const [templateId, setTemplateId] = useState(suggestedTemplateIds[0] || '');
  
  // State for "Create New" tab
  const [newChecklistName, setNewChecklistName] = useState(`[${stage}] Checklist`);
  const [newChecklistItems, setNewChecklistItems] = useState<{ text: string }[]>([{ text: '' }]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const itemRefs = useRef<(HTMLInputElement | null)[]>([]);


  useEffect(() => {
    const lastItemIndex = newChecklistItems.length - 1;
    if (lastItemIndex >= 0 && itemRefs.current[lastItemIndex]) {
      itemRefs.current[lastItemIndex]?.focus();
    }
  }, [newChecklistItems.length]);

  const [shareWithClient, setShareWithClient] = useState(false);
  
  const selectedTemplate = useMemo(() => checklistTemplates.find(t => t.id === templateId), [templateId, checklistTemplates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'template') {
        if (!templateId) {
            addToast("Please select a template to apply.", { type: 'error' });
            return;
        }
        await handleApplyStageChecklist(matter.id, stage, templateId, shareWithClient);
    } else { // 'create' tab
        const finalItems = newChecklistItems.filter(i => i.text.trim());
        if (!newChecklistName.trim() || finalItems.length === 0) {
            addToast("Please provide a name and at least one item for the new checklist.", { type: 'error' });
            return;
        }
        await handleApplyCustomStageChecklist(matter.id, stage, newChecklistName, finalItems, saveAsTemplate, shareWithClient);
    }
    onClose();
  };
  
  const handleItemChange = (index: number, text: string) => {
    const newItems = [...newChecklistItems];
    newItems[index] = { text };
    setNewChecklistItems(newItems);
  };
  const addItem = () => setNewChecklistItems([...newChecklistItems, { text: '' }]);
  const removeItem = (index: number) => newChecklistItems.length > 1 && setNewChecklistItems(newChecklistItems.filter((_, i) => i !== index));

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addItem();
    }
  };

  const suggestedTemplates = checklistTemplates.filter(t => suggestedTemplateIds.includes(t.id));
  const otherTemplates = checklistTemplates.filter(t => !suggestedTemplateIds.includes(t.id));

    // inputClassic is now imported at top level
  const commonInputClass = "text-sm " + inputClassic;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex p-1 bg-gray-200 dark:bg-zinc-800 dark:bg-zinc-900 rounded-lg">
            <button type="button" onClick={() => setActiveTab('template')} className={`w-1/2 py-1.5 text-sm font-semibold rounded-md ${activeTab === 'template' ? 'bg-white dark:bg-zinc-900 dark:bg-zinc-700 shadow' : ''}`}>Use Template</button>
            <button type="button" onClick={() => setActiveTab('create')} className={`w-1/2 py-1.5 text-sm font-semibold rounded-md ${activeTab === 'create' ? 'bg-white dark:bg-zinc-900 dark:bg-zinc-700 shadow' : ''}`}>Create New</button>
        </div>

        {activeTab === 'template' ? (
            <div className="space-y-3">
                <div>
                    <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Checklist Template</label>
                    <select id="templateId" value={templateId} onChange={e => setTemplateId(e.target.value)} className={commonInputClass} required>
                        <option value="" disabled>-- Select a template --</option>
                        {suggestedTemplates.length > 0 && <optgroup label="Suggested Templates">{suggestedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
                        {otherTemplates.length > 0 && <optgroup label="Other Templates">{otherTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>}
                    </select>
                </div>
                {selectedTemplate && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Preview</h4>
                        <ul className="text-sm list-disc list-inside p-3 border rounded-md border-gray-200 dark:border-zinc-700 dark:border-gray-700 bg-gray-50 dark:bg-zinc-800/50 dark:bg-zinc-900/50 max-h-40 overflow-y-auto">
                            {selectedTemplate.items.map(item => <li key={item.id}>{item.text}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        ) : (
            <div className="space-y-3">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checklist Name</label>
                    <input autoComplete="off" data-lpignore="true"  type="text" value={newChecklistName} onChange={e => setNewChecklistName(e.target.value)} className={commonInputClass} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checklist Items</label>
                    <div className="space-y-2 p-2 border rounded-md border-gray-200 dark:border-zinc-700 dark:border-gray-700 max-h-40 overflow-y-auto">
                        {newChecklistItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input autoComplete="off" data-lpignore="true" 
                                    ref={el => { itemRefs.current[index] = el; }}
                                    type="text"
                                    value={item.text}
                                    onChange={e => handleItemChange(index, e.target.value)}
                                    onKeyDown={handleItemKeyDown}
                                    className="text-sm w-full bg-white dark:bg-zinc-900 dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 rounded p-1"
                                    placeholder="Enter checklist item..."
                                />
                                <button type="button" onClick={() => removeItem(index)} className="text-red-500 dark:text-red-400 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addItem} className="text-sm font-semibold text-primary-600 dark:text-primary-300 hover:underline mt-2 flex items-center gap-1"><PlusIcon className="w-4 h-4" /> Add Item</button>
                </div>
                 <label className="flex items-center gap-2 text-sm p-1 cursor-pointer">
                    <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                    Save this checklist as a new template
                </label>
            </div>
        )}

        <div className="p-3 bg-primary-50 dark:bg-primary-900/30 dark:bg-primary-900/40 rounded-lg border border-primary-200 dark:border-primary-800">
            <label className="flex items-center space-x-3 cursor-pointer">
                <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={shareWithClient} onChange={(e) => setShareWithClient(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-primary-600 dark:text-primary-300 focus:ring-primary-500" />
                <div>
                    <span className="font-semibold text-primary-800 dark:text-primary-200">Share with Client</span>
                    <p className="text-xs text-primary-700 dark:text-primary-300">Adds these items to the client's "Action Items" list in their portal.</p>
                </div>
            </label>
        </div>

        <div className="pt-4 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">Apply Checklist</button>
        </div>
    </form>
  );
};