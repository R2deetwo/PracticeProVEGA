
import React, { useState } from 'react';
import { ResearchNotebook, CaseResult, Matter } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { inputLarge } from '../../utils/formStyles';

interface AddCaseToNotebookModalProps {
    caseData: CaseResult;
    notebooks: ResearchNotebook[];
    matters: Matter[];
    onAdd: (notebookId: string, caseData: CaseResult) => void;
    onCreateNotebook: (notebookData: Pick<ResearchNotebook, 'name' | 'matterId'>) => ResearchNotebook;
    onClose: () => void;
}

const AddCaseToNotebookModal: React.FC<AddCaseToNotebookModalProps> = ({ caseData, notebooks, matters, onAdd, onCreateNotebook, onClose }) => {
    const { addToast } = useUI();
    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
    const [selectedNotebookId, setSelectedNotebookId] = useState<string>(notebooks[0]?.id || '');

    // New Notebook State
    const [newNotebookName, setNewNotebookName] = useState('');
    const [newNotebookMatterId, setNewNotebookMatterId] = useState<string>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (activeTab === 'existing') {
            if (!selectedNotebookId) {
                addToast("Please select a notebook.", { type: 'error' });
                return;
            }
            onAdd(selectedNotebookId, caseData);
        } else {
            if (!newNotebookName.trim()) {
                addToast("Please provide a name for the new notebook.", { type: 'error' });
                return;
            }
            // Create the notebook first
            const newNotebook = onCreateNotebook({
                name: newNotebookName.trim(),
                matterId: newNotebookMatterId || undefined
            });
            // Then add the case to it
            onAdd(newNotebook.id, caseData);
        }
        onClose();
    };

    const commonInputClass = inputLarge;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                Save "<strong>{caseData.parties}</strong>" to a research notebook for later reference.
            </p>

            <div className="flex p-1 bg-slate-200 dark:bg-zinc-900 rounded-lg mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('existing')}
                    className={`w-1/2 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'existing' ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}
                >
                    Existing Notebook
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className={`w-1/2 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'new' ? 'bg-white dark:bg-zinc-700 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700'}`}
                >
                    Create New
                </button>
            </div>

            {activeTab === 'existing' ? (
                <div className="animate-fade-in">
                    <label htmlFor="notebook-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Select Notebook
                    </label>
                    <select
                        id="notebook-select"
                        value={selectedNotebookId}
                        onChange={e => setSelectedNotebookId(e.target.value)}
                        className={commonInputClass}
                        required
                    >
                        {notebooks.length === 0 ? (
                            <option disabled value="">No notebooks available. Create one first.</option>
                        ) : (
                            notebooks.map(nb => (
                                <option key={nb.id} value={nb.id}>{nb.name}</option>
                            ))
                        )}
                    </select>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label htmlFor="new-notebook-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notebook Name
                        </label>
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            id="new-notebook-name"
                            value={newNotebookName}
                            onChange={e => setNewNotebookName(e.target.value)}
                            className={commonInputClass}
                            placeholder="e.g. Land Law Research"
                            required
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="link-matter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Link to Matter (Optional)
                        </label>
                        <select
                            id="link-matter"
                            value={newNotebookMatterId}
                            onChange={e => setNewNotebookMatterId(e.target.value)}
                            className={commonInputClass}
                        >
                            <option value="">-- No Associated Matter --</option>
                            {matters.map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="pt-4 flex justify-end space-x-2 border-t border-slate-200 dark:border-zinc-700 mt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={activeTab === 'existing' && !selectedNotebookId} className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-primary-700 transition-colors shadow-sm">
                    {activeTab === 'new' ? 'Create & Add' : 'Add to Notebook'}
                </button>
            </div>
        </form>
    );
};

export default AddCaseToNotebookModal;
