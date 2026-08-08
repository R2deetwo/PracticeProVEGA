import React, { useState, useRef } from 'react';
import { Matter } from '../../types';
import { UploadIcon, DocumentIcon, DismissIcon } from '../../constants';
import { inputLarge } from '../../utils/formStyles';
import { formatBytes } from '../../utils/formatting';
import { useUI } from '../../contexts/UIContext';

interface NewResearchNotebookFormProps {
    matters: Matter[];
    onSubmit: (data: { name: string; matterId?: string; files: File[] }) => void;
    onClose: () => void;
}

const NewResearchNotebookForm: React.FC<NewResearchNotebookFormProps> = ({ matters, onSubmit, onClose }) => {
    const { addToast } = useUI();
    const [name, setName] = useState('');
    const [matterId, setMatterId] = useState<string | undefined>(undefined);
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            addToast("Please enter a name for the notebook.", { type: 'error' });
            return;
        }
        onSubmit({ name: name.trim(), matterId: matterId || undefined, files });
        // The parent component handles closing after async operations
    };

    const commonInputClass = inputLarge;

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label htmlFor="notebookName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notebook Name</label>
                <input autoComplete="off" data-lpignore="true" 
                    type="text"
                    id="notebookName"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className={commonInputClass}
                    placeholder="e.g., Election Petition Research"
                    required
                    autoFocus
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sources (Optional)</label>
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors group"
                >
                    <UploadIcon className="w-8 h-8 mx-auto text-slate-400 group-hover:text-primary-500 mb-2" />
                    <p className="text-sm text-slate-600 dark:text-zinc-400 font-medium">Click to upload sources</p>
                    <p className="text-xs text-slate-400 mt-1">Compatible: PDF, TXT, Markdown, MP3 (Audio)</p>
                    <input autoComplete="off" data-lpignore="true"  
                        type="file" 
                        multiple 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".pdf,.txt,.md,.mp3,.wav"
                    />
                </div>
                
                {files.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <DocumentIcon className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                    <span className="truncate text-slate-700 dark:text-zinc-300">{file.name}</span>
                                    <span className="text-xs text-slate-400">({formatBytes(file.size)})</span>
                                </div>
                                <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 p-1">
                                    <DismissIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <label htmlFor="matterLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link to Matter (Optional)</label>
                <select
                    id="matterLink"
                    value={matterId || ''}
                    onChange={e => setMatterId(e.target.value)}
                    className={commonInputClass}
                >
                    <option value="">-- No Associated Matter --</option>
                    {matters.map(matter => (
                        <option key={matter.id} value={matter.id}>{matter.title}</option>
                    ))}
                </select>
            </div>

            <div className="pt-4 flex justify-end space-x-2 border-t border-gray-200 dark:border-zinc-700">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">
                    {files.length > 0 ? `Create & Add ${files.length} Sources` : 'Create Notebook'}
                </button>
            </div>
        </form>
    );
};

export default NewResearchNotebookForm;
