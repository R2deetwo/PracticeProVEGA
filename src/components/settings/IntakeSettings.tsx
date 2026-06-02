
import React, { useState } from 'react';
import { IntakeFormTemplate, FormField } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { PlusIcon, TrashIcon, EditIcon, LinkIcon, FormIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

const FieldEditor: React.FC<{ field: FormField, onChange: (updated: FormField) => void, onDelete: () => void }> = ({ field, onChange, onDelete }) => (
    <div className="flex gap-2 items-center p-2 bg-slate-50 dark:bg-zinc-700/50 rounded border border-slate-200 dark:border-zinc-600 mb-2">
        <input autoComplete="off" data-lpignore="true" 
            type="text"
            value={field.label}
            onChange={e => onChange({ ...field, label: e.target.value })}
            className="flex-grow p-1 text-sm bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded"
            placeholder="Field Label"
        />
        <select
            value={field.type}
            onChange={e => onChange({ ...field, type: e.target.value as any })}
            className="p-1 text-sm bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded w-24"
        >
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="textarea">Long Text</option>
            <option value="date">Date</option>
        </select>
        <label className="flex items-center gap-1 text-xs">
            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked })} /> Req.
        </label>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
    </div>
);

const IntakeFormBuilder: React.FC<{ form?: IntakeFormTemplate, onSave: (form: IntakeFormTemplate) => void, onCancel: () => void }> = ({ form, onSave, onCancel }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast } = useUI();
    const [name, setName] = useState(form?.name || '');
    const [description, setDescription] = useState(form?.description || '');
    const [fields, setFields] = useState<FormField[]>(form?.fields || []);

    const handleAddField = () => {
        setFields([...fields, { id: `f_${Date.now()}`, label: 'New Field', type: 'text', required: false }]);
    };

    const handleUpdateField = (index: number, updated: FormField) => {
        const newFields = [...fields];
        newFields[index] = updated;
        setFields(newFields);
    };

    const handleDeleteField = (index: number) => {
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
    };

    const handleSave = () => {
        if (!name.trim()) {
            addToast("Form name is required", { type: 'info' });
            return;
        }
        const template: IntakeFormTemplate = {
            id: form?.id || `new_${Date.now()}`,
            firmId: coreState.firmDetails.id,
            name,
            description,
            fields,
            publicLink: `https://practicepro.ng/intake/${Date.now()}`,
            responsesCount: form?.responsesCount || 0,
            isEnabled: true
        };
        onSave(template);
    };

    return (
        <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 space-y-4">
            <h4 className="font-bold text-lg">{form ? 'Edit Intake Form' : 'Create New Intake Form'}</h4>
            <input autoComplete="off" data-lpignore="true" 
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2 rounded border dark:bg-zinc-800 dark:border-zinc-600"
                placeholder="Form Name (e.g. New Client Intake)"
            />
            <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-2 rounded border dark:bg-zinc-800 dark:border-zinc-600"
                placeholder="Description shown to client..."
                rows={2}
            />

            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold">Form Fields</label>
                    <button onClick={handleAddField} className="text-xs font-semibold text-primary-600 flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add Field</button>
                </div>
                <div className="space-y-1">
                    {fields.map((field, idx) => (
                        <FieldEditor
                            key={field.id}
                            field={field}
                            onChange={(updated) => handleUpdateField(idx, updated)}
                            onDelete={() => handleDeleteField(idx)}
                        />
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded text-sm font-semibold">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded text-sm font-semibold hover:bg-primary-700">Save Form</button>
            </div>
        </div>
    );
};

export const IntakeSettings: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { handleUpdateIntakeForm, handleDeleteIntakeForm } = useDataActions();
    const { addToast, openModal, closeModal } = useUI();
    const [editingForm, setEditingForm] = useState<IntakeFormTemplate | null | 'new'>(null);
    const [enforceRules, setEnforceRules] = useState(true);

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        addToast("Public link copied to clipboard!", { type: 'success' });
    };

    return (
        <div className="space-y-6">
            <SettingsCard title="Enterprise Intake Configuration" id="enterprise-intake-config">
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                    Configure how PracticePro's procedural intelligence guides attorneys during matter creation.
                </p>
                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg">
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-white">Enforce Statutory Jurisdiction Rules</h4>
                        <p className="text-xs text-slate-500 mt-0.5 max-w-prose">When creating a new matter, automatically map the selected originating process to the appropriate court rules and enforce territorial and capacity checks.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                        <input autoComplete="off" data-lpignore="true"  type="checkbox" className="sr-only peer" checked={enforceRules} onChange={e => setEnforceRules(e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>
            </SettingsCard>

            <SettingsCard title="Public Intake Forms" id="intake-settings">
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                    Create branded intake forms to share with prospective clients. Responses automatically create a Lead in your funnel.
                </p>

                {!editingForm ? (
                    <>
                        <button
                            onClick={() => setEditingForm('new')}
                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 dark:border-zinc-600 rounded-lg text-slate-500 hover:border-primary-500 hover:text-primary-600 transition-colors font-semibold mb-6"
                        >
                            <PlusIcon className="w-5 h-5" /> Create New Form
                        </button>

                        <div className="space-y-3">
                            {coreState.intakeForms.map(form => (
                                <div key={form.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
                                            <FormIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-white">{form.name}</h4>
                                            <div className="flex gap-4 text-xs text-slate-500 mt-0.5">
                                                <span>{form.fields.length} Fields</span>
                                                <span>{form.responsesCount} Responses</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => copyLink(form.publicLink)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full" title="Copy Public Link">
                                            <LinkIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingForm(form)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full">
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                openModal('deleteConfirmation', form.id, {
                                                    title: "Delete Intake Form?",
                                                    message: `Are you sure you want to delete "${form.name}"? Existing links will stop working.`,
                                                    onConfirm: () => {
                                                        handleDeleteIntakeForm(form.id);
                                                        closeModal();
                                                    },
                                                    confirmText: "Delete Form",
                                                    confirmButtonClass: 'bg-red-600 hover:bg-red-700'
                                                });
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <IntakeFormBuilder
                        form={editingForm === 'new' ? undefined : editingForm}
                        onSave={(f) => { handleUpdateIntakeForm(f); setEditingForm(null); }}
                        onCancel={() => setEditingForm(null)}
                    />
                )}
            </SettingsCard>
        </div>
    );
};

export default IntakeSettings;
