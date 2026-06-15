import React, { useState } from 'react';
import { Matter } from '../../types';
import { inputLarge } from '../../utils/formStyles';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';

interface RequestFinancialDocumentFormProps {
    matter: Matter;
}

const documentTypes = [
    "Statement of Account",
    "Copy of All Invoices",
    "Detailed Billing Report",
    "Payment History",
];

const RequestFinancialDocumentForm: React.FC<RequestFinancialDocumentFormProps> = ({ matter }) => {
    const { handleRequestFinancialDocument } = useDataActions();
    const { closeModal } = useUI();
    const { isProperty } = useProduct();
    const [docType, setDocType] = useState(documentTypes[0]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleRequestFinancialDocument(matter.id, docType);
    };

    const commonInputClass = inputLarge;

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
                Select the financial document you would like to request for the matter "<strong>{matter.title}</strong>". A notification will be sent to {isProperty ? 'your property team' : 'your legal team'}.
            </p>
            <div>
                <label htmlFor="docType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Type</label>
                <select
                    id="docType"
                    value={docType}
                    onChange={e => setDocType(e.target.value)}
                    className={commonInputClass}
                >
                    {documentTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="pt-4 flex justify-end space-x-2">
                {/* FIX: Wrapped closeModal in an arrow function to match the event handler type. */}
                <button type="button" onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                    Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">
                    Submit Request
                </button>
            </div>
        </form>
    );
};

export default RequestFinancialDocumentForm;
