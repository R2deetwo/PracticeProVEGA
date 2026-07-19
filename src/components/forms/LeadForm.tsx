import React, { useState, useEffect } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { UserGeneratorIcon, MailIcon, SaveIcon, XIcon } from '../../constants';
import { inputModern } from '../../utils/formStyles';
import { ContactType } from '../../types';

interface LeadFormProps {
    onClose: () => void;
    initialContext?: { name?: string; email?: string; isClientRequest?: boolean };
}

const LeadForm: React.FC<LeadFormProps> = ({ onClose, initialContext }) => {
    const { handleAddLead } = useDataActions();
    const { addToast } = useUI();
    const [name, setName] = useState(initialContext?.name || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [email, setEmail] = useState(initialContext?.email || '');
    const [clientType, setClientType] = useState<ContactType>(ContactType.Individual);
    const isClientRequest = initialContext?.isClientRequest || false;

    useEffect(() => {
        if (initialContext) {
            setName(initialContext.name || '');
            setEmail(initialContext.email || '');
        }
    }, [initialContext]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        if (!name.trim() || !email.trim()) {
            addToast("Name and Email are required.", { type: 'info' });
            return;
        }
        setIsSubmitting(true);
        try {
            handleAddLead({ name, email }, isClientRequest);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const commonInputClass = inputModern;
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    const normalForm = (
        <div className="space-y-2 sm:space-y-3">
            <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
                <div className="flex items-center gap-4 mb-2 px-1">
                    <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                        <UserGeneratorIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-primary-600/70 uppercase tracking-widest leading-none mb-0.5">Details</p>
                        <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Lead Information</h3>
                    </div>
                </div>

                <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 leading-relaxed px-1">
                    Add a new lead to your pipeline. This will create a contact record and allow you to track the inquiry.
                </p>

                <div className="space-y-3">
                    <div className="space-y-2 group">
                        <label htmlFor="leadName" className={labelClass}>Full Name*</label>
                        <div className="relative">
                            <UserGeneratorIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input autoComplete="off" data-lpignore="true"  type="text" id="leadName" value={name} onChange={e => setName(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="e.g. John Doe" required autoFocus={!isClientRequest} />
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="leadEmail" className={labelClass}>Email*</label>
                        <div className="relative">
                            <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input autoComplete="off" data-lpignore="true"  type="email" id="leadEmail" value={email} onChange={e => setEmail(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="name@example.com" required />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const clientRequestForm = (
        <div className="space-y-2 sm:space-y-3">
            <div className="p-3 sm:p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 space-y-3">
                <div className="flex items-center gap-4 mb-2 px-1">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm ring-2 ring-indigo-500/10">
                        <MailIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest leading-none mb-0.5">Request</p>
                        <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Service Details</h3>
                    </div>
                </div>

                <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 leading-relaxed px-1">
                    Confirm your request for additional services. We will process your inquiry shortly.
                </p>

                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-50 dark:border-zinc-800 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name</span>
                        <span className="text-sm font-black text-slate-700 dark:text-white">{name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</span>
                        <span className="text-sm font-black text-primary-600 truncate ml-4">{email}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 -m-2">
            <div className="pb-6">
                {isClientRequest ? clientRequestForm : normalForm}
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-3.5 h-3.5" /> Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-xl sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <SaveIcon className="w-3.5 h-3.5" /> {isClientRequest ? 'Confirm Request' : 'Save Lead'}
                </button>
            </div>
        </form>
    );
};

export default LeadForm;