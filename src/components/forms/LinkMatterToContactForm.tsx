import React, { useState } from 'react';
import { Contact, Matter } from '../../types';
import { UserIcon, GavelIconLarge, InfoIcon, XIcon, SaveIcon, LinkIcon } from '../../constants';
import { Building2 as OfficeBuildingIcon, Link2Off as UnlinkIcon } from 'lucide-react';
import { inputLarge } from '../../utils/formStyles';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';

interface LinkMatterToContactFormProps {
    contact: Contact;
    matters: Matter[];
    onSave: (contactId: string, matterId: string, asClient: boolean) => void;
    onClose: () => void;
}

export const LinkMatterToContactForm: React.FC<LinkMatterToContactFormProps> = ({ contact, matters, onSave, onClose }) => {
    const { addToast } = useUI();
    // Product-aware terminology: Atrium firms link Properties, Vega/Komplete link Matters.
    const { terminology } = useProduct();
    const matterNoun = terminology.matter;       // 'Matter' or 'Property'
    const clientNoun = terminology.client;       // 'Client' or 'Resident'
    const [selectedMatterId, setSelectedMatterId] = useState<string>('');
    const [asClient, setAsClient] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMatterId) {
            addToast(`Please select a ${matterNoun.toLowerCase()} to link.`, { type: 'error' });
            return;
        }
        onSave(contact.id, selectedMatterId, asClient);
        onClose();
    };

    const commonInputClass = inputLarge;

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                Associate <strong>{contact.name}</strong> with an existing {matterNoun.toLowerCase()}.
            </p>

            <div>
                <label htmlFor="matter-select" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Select {matterNoun}
                </label>
                <select
                    id="matter-select"
                    value={selectedMatterId}
                    onChange={(e) => setSelectedMatterId(e.target.value)}
                    className={commonInputClass}
                    required
                >
                    <option value="" disabled>-- Select a {matterNoun} --</option>
                    {matters.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.title} ({m.referenceNumber || 'No Ref'})
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                <input autoComplete="off" data-lpignore="true"
                    type="checkbox"
                    id="as-client"
                    checked={asClient}
                    onChange={(e) => setAsClient(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <label htmlFor="as-client" className="text-sm text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
                    <span className="font-bold block">Set as Primary {clientNoun}</span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">If unchecked, they will be added as an associated contact.</span>
                </label>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-zinc-700 mt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                    Link {matterNoun}
                </button>
            </div>
        </form>
    );
};
