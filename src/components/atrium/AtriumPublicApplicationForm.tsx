import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Building2 as BuildingOfficeIcon, User as UserIcon, DollarSign as CurrencyDollarIcon, FileText as DocumentTextIcon, CheckCircle as CheckCircleIcon } from 'lucide-react';

/**
 * Public facing component for prospective tenants to apply for vacant units.
 * Wired to the addLeadToPipeline mutation in convex/sentry.ts.
 *
 * When a lead is submitted:
 *   1. A new row is inserted into the `leads_pipeline` table with stage "Inquiry"
 *   2. The property manager sees the lead in the VacancyPipeline Kanban board
 *   3. They can advance the lead through: Inquiry → Vetted → Lease_Generated → Closed
 */
export const AtriumPublicApplicationForm: React.FC<{ propertyId: string; propertyName: string }> = ({ propertyId, propertyName }) => {
    const [applicantName, setApplicantName] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [proposedRent, setProposedRent] = useState('');
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const addLead = useMutation(api.sentry.addLeadToPipeline);

    // Fetch the property to get its firmId (required for the lead pipeline)
    const property = useQuery(api.myFunctions.getPropertyById, { propertyId });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!applicantName.trim() || !contactInfo.trim()) {
            setError('Please enter your name and contact information.');
            return;
        }

        setIsSubmitting(true);
        try {
            const firmId = (property as any)?.firmId || '';
            if (!firmId) {
                setError('Unable to determine the property manager. Please try again later.');
                setIsSubmitting(false);
                return;
            }

            await addLead({
                firmId,
                unitId: propertyId,
                applicantName: applicantName.trim(),
                contactInfo: contactInfo.trim(),
                stage: 'Inquiry',
                proposedRent: proposedRent ? parseFloat(proposedRent) : undefined,
                notes: notes.trim() || undefined,
            });
            setSubmitted(true);
        } catch (err: any) {
            setError(err?.message || 'Failed to submit application. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="max-w-md mx-auto mt-10 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Application Received</h2>
                <p className="text-slate-600 dark:text-slate-400">
                    Thank you for your interest in {propertyName}. The property manager has been notified and will contact you shortly.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto mt-10 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-lg">
                    <BuildingOfficeIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tenancy Application</h2>
                    <p className="text-sm text-slate-500">Applying for: <span className="font-semibold text-slate-700 dark:text-slate-300">{propertyName}</span></p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <UserIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            required
                            type="text"
                            value={applicantName}
                            onChange={e => setApplicantName(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email or Phone</label>
                    <div className="relative">
                        <input
                            required
                            type="text"
                            value={contactInfo}
                            onChange={e => setContactInfo(e.target.value)}
                            className="block w-full pl-3 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="john@example.com or +234..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Proposed Annual Rent (₦)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CurrencyDollarIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            required
                            type="number"
                            value={proposedRent}
                            onChange={e => setProposedRent(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="e.g. 2500000"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Additional Notes / Employment Info</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                            <DocumentTextIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Briefly describe your employment status and intended use of the property..."
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                    <p className="mt-3 text-xs text-center text-slate-500">
                        By submitting, your data flows securely into the property manager's CRM for review.
                    </p>
                </div>
            </form>
        </div>
    );
};
