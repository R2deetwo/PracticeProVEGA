import React, { useState, useEffect } from 'react';
import { DocumentCategory } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { inputClassic } from '../../utils/formStyles';

interface DocumentCategoryFormProps {
  onAddCategory?: (newDocCat: Omit<DocumentCategory, 'id' | 'isCore'>) => void;
  onUpdateCategory?: (updatedDocCat: DocumentCategory) => void;
  onDelete?: () => void;
  onClose: () => void;
  categoryToEdit?: DocumentCategory;
  allCategories: DocumentCategory[];
  context?: { parentId?: string };
}

const DocumentCategoryForm: React.FC<DocumentCategoryFormProps> = ({ onAddCategory, onUpdateCategory, onDelete, onClose, categoryToEdit, allCategories, context }) => {
  const { coreState, isDataLoaded } = useCoreState();
  const { addToast } = useUI();
    const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  
  const isEditing = !!categoryToEdit;

  useEffect(() => {
    if (isEditing && categoryToEdit) {
      setName(categoryToEdit.name);
      setParentId(categoryToEdit.parentId);
    } else if (context?.parentId) {
        setParentId(context.parentId);
    }
  }, [isEditing, categoryToEdit, context]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Please provide a name for the document category.", { type: 'error' });
      return;
    }
    
    if (isEditing && onUpdateCategory && categoryToEdit) {
        const updatedDocCat: DocumentCategory = {
            ...categoryToEdit,
            name: name.trim(),
            parentId: parentId,
        };
        await onUpdateCategory(updatedDocCat);
    } else if (!isEditing && onAddCategory) {
        const newDocCat: Omit<DocumentCategory, 'id' | 'isCore'> = {
            firmId: coreState.firmDetails.id,
            name: name.trim(),
            parentId: parentId,
        };
        await onAddCategory(newDocCat);
    }
    onClose();
  };

    const commonInputClass = inputClassic;

  const renderCategoryOptions = (parentId: string | null, level = 0): React.ReactNode[] => {
    return allCategories
        .filter(c => c.parentId === parentId && c.id !== categoryToEdit?.id && !c.isCore)
        .flatMap(cat => [
            <option key={cat.id} value={cat.id}>
                {'--'.repeat(level)} {cat.name}
            </option>,
            ...renderCategoryOptions(cat.id, level + 1)
        ]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="docCatName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Name</label>
        <input autoComplete="off" data-lpignore="true"  
            type="text" 
            id="docCatName" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="e.g., Expert Reports" 
            className={commonInputClass} 
            required 
        />
      </div>
      <div>
        <label htmlFor="docCatParent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parent Category (optional)</label>
        <select 
            id="docCatParent"
            value={parentId || ''}
            onChange={e => setParentId(e.target.value || null)}
            className={commonInputClass}
        >
            <option value="">-- No Parent (Top Level) --</option>
            {renderCategoryOptions(null)}
        </select>
      </div>

      <div className="pt-4 flex justify-between items-center">
         <div>
            {isEditing && onDelete && (
                <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors"
                >
                    Delete Category
                </button>
            )}
        </div>
        <div className="space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Create Category'}</button>
        </div>
      </div>
    </form>
  );
};

export default DocumentCategoryForm;
