import React, { useState, useEffect } from 'react';
import { DocumentTemplateCategory } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { inputClassic } from '../../utils/formStyles';

interface TemplateCategoryFormProps {
  onAdd?: (category: Omit<DocumentTemplateCategory, 'id'>) => void;
  onUpdate?: (category: DocumentTemplateCategory) => void;
  onDelete?: () => void;
  onClose: () => void;
  categoryToEdit?: DocumentTemplateCategory;
}

const TemplateCategoryForm: React.FC<TemplateCategoryFormProps> = ({ onAdd, onUpdate, onDelete, onClose, categoryToEdit }) => {
  const { coreState, isDataLoaded } = useCoreState();
  const { addToast } = useUI();
    const [name, setName] = useState('');
  
  const isEditing = !!categoryToEdit;

  useEffect(() => {
    if (isEditing && categoryToEdit) {
      setName(categoryToEdit.name);
    }
  }, [isEditing, categoryToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Please provide a name for the category.", { type: 'error' });
      return;
    }
    
    if (isEditing && onUpdate && categoryToEdit) {
        /* Added firmId to satisfy DocumentTemplateCategory interface */
        onUpdate({ id: categoryToEdit.id, firmId: coreState.firmDetails.id, name: name.trim() });
    } else if (onAdd) {
        /* Added firmId to satisfy Omit<DocumentTemplateCategory, "id"> interface */
        onAdd({ firmId: coreState.firmDetails.id, name: name.trim() });
    }
    onClose();
  };

    const commonInputClass = inputClassic;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Name</label>
        <input autoComplete="off" data-lpignore="true"  type="text" id="categoryName" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Letters" className={commonInputClass} required />
      </div>

      <div className="pt-4 flex justify-between items-center">
        <div>
            {isEditing && onDelete && (
                <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors"
                >
                    Delete Category
                </button>
            )}
        </div>
        <div className="space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Create Category'}</button>
        </div>
      </div>
    </form>
  );
};

export default TemplateCategoryForm;
