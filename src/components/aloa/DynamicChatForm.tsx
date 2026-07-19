import React, { useState, useCallback } from 'react';
import { InteractiveFormSchema, InteractiveFormField } from '../../types';
import { CheckIcon, XMarkIcon } from '../../constants';

// ─── Sub-components for each field type ─────────────────────────────────────

const ChipsField: React.FC<{
    field: InteractiveFormField;
    value: string;
    onChange: (v: string) => void;
}> = ({ field, value, onChange }) => (
    <div className="flex flex-wrap gap-2">
        {(field.options || []).map(opt => (
            <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    value === opt
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400'
                }`}
            >
                {opt}
            </button>
        ))}
    </div>
);

const CheckboxGroupField: React.FC<{
    field: InteractiveFormField;
    value: string[];
    onChange: (v: string[]) => void;
}> = ({ field, value, onChange }) => {
    const toggle = (opt: string) => {
        onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
    };
    return (
        <div className="flex flex-wrap gap-2">
            {(field.options || []).map(opt => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        value.includes(opt)
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                    }`}
                >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        value.includes(opt) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-zinc-600'
                    }`}>
                        {value.includes(opt) && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {opt}
                </button>
            ))}
        </div>
    );
};

const SliderField: React.FC<{
    field: InteractiveFormField;
    value: number;
    onChange: (v: number) => void;
}> = ({ field, value, onChange }) => {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-zinc-500">{min}%</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    {value}%
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-500">{max}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-slate-200 dark:bg-zinc-700">
                <div
                    className="absolute top-0 left-0 h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface DynamicChatFormProps {
    schema: InteractiveFormSchema;
    onSubmit: (values: Record<string, any>) => void;
}

export const DynamicChatForm: React.FC<DynamicChatFormProps> = ({ schema, onSubmit }) => {
    // Initialise form values from field defaults
    const initialValues = schema.fields.reduce<Record<string, any>>((acc, f) => {
        if (f.defaultValue !== undefined) {
            acc[f.id] = f.defaultValue;
        } else if (f.type === 'checkbox_group') {
            acc[f.id] = [];
        } else if (f.type === 'slider') {
            acc[f.id] = f.min ?? 0;
        } else if (f.type === 'number') {
            acc[f.id] = '';
        } else {
            acc[f.id] = '';
        }
        return acc;
    }, {});

    const [values, setValues] = useState<Record<string, any>>(initialValues);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);

    const setField = useCallback((id: string, val: any) => {
        setValues(prev => ({ ...prev, [id]: val }));
        setErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    }, []);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        schema.fields.forEach(f => {
            if (!f.required) return;
            const v = values[f.id];
            if (f.type === 'checkbox_group') {
                if (!v || v.length === 0) newErrors[f.id] = 'Select at least one option.';
            } else if (v === '' || v === null || v === undefined) {
                newErrors[f.id] = 'This field is required.';
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitted(true);
        onSubmit(values);
    };

    const renderField = (field: InteractiveFormField) => {
        const baseInput = `w-full px-3 py-2 rounded-xl text-sm border transition-all
            bg-white dark:bg-zinc-800 text-slate-900 dark:text-white
            border-slate-200 dark:border-zinc-700
            focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500
            placeholder-slate-400 dark:placeholder-zinc-500`;

        switch (field.type) {
            case 'chips':
                return (
                    <ChipsField
                        field={field}
                        value={values[field.id] || ''}
                        onChange={v => setField(field.id, v)}
                    />
                );
            case 'checkbox_group':
                return (
                    <CheckboxGroupField
                        field={field}
                        value={values[field.id] || []}
                        onChange={v => setField(field.id, v)}
                    />
                );
            case 'slider':
                return (
                    <SliderField
                        field={field}
                        value={values[field.id] ?? (field.min ?? 0)}
                        onChange={v => setField(field.id, v)}
                    />
                );
            case 'select':
                return (
                    <select
                        value={values[field.id] || ''}
                        onChange={e => setField(field.id, e.target.value)}
                        className={baseInput}
                        disabled={submitted}
                    >
                        <option value="" disabled>{field.placeholder || 'Select…'}</option>
                        {(field.options || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            case 'date':
                return (
                    <input
                        type="date"
                        value={values[field.id] || ''}
                        onChange={e => setField(field.id, e.target.value)}
                        className={baseInput}
                        disabled={submitted}
                    />
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={values[field.id] || ''}
                        onChange={e => setField(field.id, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className={baseInput}
                        disabled={submitted}
                    />
                );
            case 'text':
            default:
                return (
                    <input
                        type="text"
                        value={values[field.id] || ''}
                        onChange={e => setField(field.id, e.target.value)}
                        placeholder={field.placeholder || ''}
                        className={baseInput}
                        disabled={submitted}
                    />
                );
        }
    };

    // ── Submitted / locked view ──────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="mt-3 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-900/10 flex items-start gap-3 animate-in fade-in duration-300">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm shadow-emerald-500/30">
                    <CheckIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{schema.title} — Submitted</p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">Processing your response…</p>
                </div>
            </div>
        );
    }

    // ── Active form view ─────────────────────────────────────────────────────
    return (
        <form
            onSubmit={handleSubmit}
            className="mt-3 rounded-2xl border border-slate-200 dark:border-zinc-700/80 bg-slate-50/80 dark:bg-zinc-900/80 backdrop-blur-sm overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300"
            onClick={e => e.stopPropagation()} // prevent message list click-through
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-700/80 bg-white/70 dark:bg-zinc-800/70">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{schema.title}</h4>
                        {schema.description && (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{schema.description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Fields */}
            <div className="px-5 py-4 space-y-5">
                {schema.fields.map(field => (
                    <div key={field.id}>
                        <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                            {field.label}
                            {field.required && <span className="text-red-500 text-2xs font-black">*</span>}
                        </label>
                        {renderField(field)}
                        {errors[field.id] && (
                            <p className="mt-1 text-2xs text-red-500 font-semibold flex items-center gap-1">
                                <XMarkIcon className="w-3 h-3" />
                                {errors[field.id]}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer / Submit */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-700/80 bg-white/50 dark:bg-zinc-800/50 flex justify-end">
                <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                    <CheckIcon className="w-4 h-4" />
                    {schema.submitLabel || 'Confirm'}
                </button>
            </div>
        </form>
    );
};
