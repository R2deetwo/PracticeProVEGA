import React, { useState, useEffect } from 'react';
import { ChecklistTemplate, MatterType, WorkflowDefinition } from '../../types';
import { TrashIcon } from '../../constants';
import { inputClassic } from '../../utils/formStyles';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';

interface ChecklistTemplateFormProps {
  templateToEdit?: ChecklistTemplate;
  workflows: WorkflowDefinition[];
  onAddTemplate?: (template: Omit<ChecklistTemplate, 'id'>) => void;
  onUpdateTemplate?: (template: ChecklistTemplate) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const ChecklistTemplateForm: React.FC<ChecklistTemplateFormProps> = ({ templateToEdit, workflows, onAddTemplate, onUpdateTemplate, onDelete, onClose }) => {
  const { coreState, isDataLoaded } = useCoreState();
    const { addToast, openModal, closeModal } = useUI();
  const [name, setName] = useState('');
  const [items, setItems] = useState<{ id: string; text: string }[]>([{ id: `item_${Date.now()}`, text: '' }]);
  const [relevantMatterTypes, setRelevantMatterTypes] = useState<Set<MatterType>>(new Set());

  const isEditing = !!templateToEdit;
  const matterTypes = workflows.map(w => w.type);

  useEffect(() => {
    if (isEditing && templateToEdit) {
      setName(templateToEdit.name);
      setItems(templateToEdit.items);
      setRelevantMatterTypes(new Set(templateToEdit.relevantMatterTypes || []));
    }
  }, [isEditing, templateToEdit]);

  const handleItemChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], text };
    setItems(newItems);
  };
  const addItem = () => setItems([...items, { id: `item_${Date.now()}`, text: '' }]);
  const removeItem = (index: number) => items.length > 1 && setItems(items.filter((_, i) => i !== index));

  const handleMatterTypeToggle = (type: MatterType) => {
    setRelevantMatterTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) newSet.delete(type);
      else newSet.add(type);
      return newSet;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || items.some(i => !i.text.trim())) {
      addToast("Please provide a name and fill out all checklist items.", { type: 'info' });
      return;
    }
    /* Added firmId to satisfy Omit<ChecklistTemplate, "id"> interface */
    const templateData: Omit<ChecklistTemplate, 'id'> = {
      firmId: coreState.firmDetails.id,
      name: name.trim(),
      items: items.filter(i => i.text.trim()),
      relevantMatterTypes: Array.from(relevantMatterTypes),
    };
    if (isEditing && templateToEdit && onUpdateTemplate) {
      onUpdateTemplate({ ...templateToEdit, ...templateData });
    } else if (onAddTemplate) {
      onAddTemplate(templateData);
    }
    onClose();
  };

    // inputClassic is now imported at top level
  const commonInputClass = "text-sm " + inputClassic;
  const itemInputClass = "text-sm text-gray-900 dark:text-gray-300 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-1 focus:ring-primary-500 focus:border-primary-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
        <input autoComplete="off" data-lpignore="true"  type="text" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checklist Items</label>
        <div className="space-y-2 p-2 border rounded-md border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <input autoComplete="off" data-lpignore="true"  type="text" value={item.text} onChange={e => handleItemChange(index, e.target.value)} className={itemInputClass} placeholder="Enter checklist item..." />
              <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="text-sm font-semibold text-primary-600 hover:underline mt-2">Add Item</button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relevant Matter Types (Optional)</label>
        <div className="flex flex-wrap gap-2 p-2 border rounded-md border-gray-200 dark:border-gray-700">
          {matterTypes.map(type => (
            <label key={type} className="flex items-center gap-2 text-sm p-1 cursor-pointer">
              <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={relevantMatterTypes.has(type)} onChange={() => handleMatterTypeToggle(type)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              {type}
            </label>
          ))}
        </div>
      </div>
      <div className="pt-4 flex justify-between items-center">
        <div>{isEditing && onDelete && (
          <button
            type="button"
            onClick={() => {
              openModal('deleteConfirmation', templateToEdit!.id, {
                title: "Delete Checklist Template?",
                message: "Are you sure you want to delete this template? This cannot be undone.",
                onConfirm: () => { onDelete(); closeModal(); },
                confirmText: "Delete Template",
                confirmButtonClass: 'bg-red-600 hover:bg-red-700'
              });
            }}
            className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors"
          >
            Delete
          </button>
        )}</div>
        <div className="space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Create Template'}</button>
        </div>
      </div>
    </form>
  );
};

export default ChecklistTemplateForm;
