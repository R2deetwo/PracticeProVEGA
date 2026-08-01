import React, { useState, useEffect } from 'react';
import { NoteNotebook, User, AppMode, NoteScope } from '../../types';
import { PALETTE_COLORS } from '../../constants';
import { inputClassic } from '../../utils/formStyles';
import { getEventTypeBadgeClass } from '../../utils/colorUtils';
import { useUI } from '../../contexts/UIContext';

interface NotebookFormProps {
  onAdd: (notebook: Omit<NoteNotebook, 'id' | 'createdAt' | 'userId' | 'isCore'>) => void;
  onUpdate: (notebook: NoteNotebook) => void;
  onClose: () => void;
  notebookToEdit?: NoteNotebook;
  currentUser: User;
  appMode: AppMode;
}

const NotebookForm: React.FC<NotebookFormProps> = ({ onAdd, onUpdate, onClose, notebookToEdit, currentUser, appMode }) => {
  const { addToast } = useUI();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE_COLORS[0]);
  const [scope, setScope] = useState<NoteScope>(NoteScope.Firm);

  const isEditing = !!notebookToEdit;

  useEffect(() => {
    if (isEditing && notebookToEdit) {
      setName(notebookToEdit.name);
      setColor(notebookToEdit.color);
      setScope(notebookToEdit.scope);
    }
  }, [isEditing, notebookToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Please provide a name for the notebook.", { type: 'info' });
      return;
    }

    if (isEditing && notebookToEdit) {
      await onUpdate({ ...notebookToEdit, name, color, scope });
    } else {
      await onAdd({ name, color, scope: appMode === 'solo' ? NoteScope.Private : scope });
    }
    onClose();
  };

    const commonInputClass = inputClassic;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="notebookName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notebook Name</label>
        <input autoComplete="off" data-lpignore="true"  type="text" id="notebookName" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} required />
      </div>
      {appMode === 'multi' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visibility</label>
          <div className="flex space-x-4 rounded-lg bg-gray-100 dark:bg-zinc-800 dark:bg-gray-700 p-1">
            <button type="button" onClick={() => setScope(NoteScope.Firm)} className={`w-full text-center px-4 py-2 rounded-md text-sm font-semibold transition-colors ${scope === NoteScope.Firm ? 'bg-white dark:bg-zinc-900 dark:bg-gray-800 shadow' : 'text-gray-600 dark:text-gray-300'}`}>
              Firm
            </button>
            <button type="button" onClick={() => setScope(NoteScope.Private)} className={`w-full text-center px-4 py-2 rounded-md text-sm font-semibold transition-colors ${scope === NoteScope.Private ? 'bg-white dark:bg-zinc-900 dark:bg-gray-800 shadow' : 'text-gray-600 dark:text-gray-300'}`}>
              Private
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {scope === 'firm' ? 'Visible to everyone in the firm.' : 'Visible only to you.'}
          </p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
        <div className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-zinc-800 dark:bg-gray-700 rounded-lg">
          {PALETTE_COLORS.map(c => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all duration-150 ${getEventTypeBadgeClass(c, 'bg')} ${color === c ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800' : ''}`}
              aria-label={`Select ${c} color`}
            />
          ))}
        </div>
      </div>
      <div className="pt-4 flex justify-end space-x-2">
        <button type="button" onClick={() => onClose()} className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-gray-500 transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Create Notebook'}</button>
      </div>
    </form>
  );
};

export default NotebookForm;