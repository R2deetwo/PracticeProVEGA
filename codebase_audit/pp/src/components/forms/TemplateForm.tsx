import React, { useState, useEffect } from 'react';
import { FolderIcon, SaveIcon, XIcon, PlusIcon, InfoIcon, BriefcaseIcon } from '../../constants';
import { FileText as FileTextIcon } from 'lucide-react';
import { inputClassic } from '../../utils/formStyles';
import { DocumentTemplate, DocumentTemplateCategory } from '../../types';
import { TEMPLATE_PLACEHOLDERS } from '../../constants';
import Tooltip from '../Tooltip';
import { useCoreState } from '../../contexts/CoreContext';

interface TemplateFormProps {
  onAddTemplate?: (template: Omit<DocumentTemplate, 'id'>) => void;
  onUpdateTemplate?: (template: DocumentTemplate) => void;
  onDelete?: () => void;
  onClose: () => void;
  templateToEdit?: DocumentTemplate;
  documentTemplateCategories: DocumentTemplateCategory[];
}

const TemplateForm: React.FC<TemplateFormProps> = ({ onAddTemplate, onUpdateTemplate, onDelete, onClose, templateToEdit, documentTemplateCategories }) => {
  const { coreState, isDataLoaded } = useCoreState();
    const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const isEditing = !!templateToEdit;

  useEffect(() => {
    if (isEditing && templateToEdit) {
      setName(templateToEdit.name);
      setContent(templateToEdit.content);
      setCategoryId(templateToEdit.categoryId || '');
    } else if (documentTemplateCategories.length > 0) {
        setCategoryId(documentTemplateCategories[0].id);
    }
  }, [isEditing, templateToEdit, documentTemplateCategories]);

  const handleCopyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim() || !categoryId) {
      alert("Please provide a template name, content, and select a category.");
      return;
    }

    if (isEditing && onUpdateTemplate && templateToEdit) {
      onUpdateTemplate({ ...templateToEdit, name: name.trim(), content: content.trim(), categoryId });
    } else if (onAddTemplate) {
      /* Added firmId to satisfy Omit<DocumentTemplate, "id"> interface */
      onAddTemplate({ firmId: coreState.firmDetails.id, name: name.trim(), content: content.trim(), categoryId, createdAt: new Date().toISOString() });
    }
    onClose();
  };

    const commonInputClass = inputClassic;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <form onSubmit={handleSubmit} className="space-y-3 md:col-span-2">
            <div>
                <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                <input autoComplete="off" data-lpignore="true" 
                type="text"
                id="templateName"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Letter Before Action"
                className={commonInputClass}
                required
                />
            </div>
             <div>
                <label htmlFor="templateCategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select id="templateCategory" value={categoryId} onChange={e => setCategoryId(e.target.value)} className={commonInputClass} required>
                    <option value="" disabled>-- Select a category --</option>
                    {documentTemplateCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="templateContent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Content</label>
                <textarea
                id="templateContent"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={12}
                placeholder="Enter your template content here. Use placeholders from the list on the right."
                className={`${commonInputClass} font-mono text-sm`}
                required
                />
            </div>
            <div className="pt-4 flex justify-between items-center">
                 <div>
                    {isEditing && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors"
                        >
                            Delete Template
                        </button>
                    )}
                </div>
                <div className="space-x-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">{isEditing ? 'Save Changes' : 'Create Template'}</button>
                </div>
            </div>
        </form>
        <div className="md:col-span-1 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Placeholders</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Click a placeholder to copy it.</p>
            <div className="space-y-2 max-h-[20rem] overflow-y-auto pr-2">
                {TEMPLATE_PLACEHOLDERS.map(p => (
                    <Tooltip key={p.placeholder} text={p.description}>
                        <button 
                            type="button" 
                            onClick={() => handleCopyPlaceholder(p.placeholder)}
                            className="w-full text-left p-2 bg-white dark:bg-gray-700 rounded-md font-mono text-xs text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors"
                        >
                            {p.placeholder}
                        </button>
                    </Tooltip>
                ))}
            </div>
             {copied && <p className="text-center text-xs text-green-600 font-semibold mt-4">Copied to clipboard!</p>}
        </div>
    </div>
  );
};

export default TemplateForm;
