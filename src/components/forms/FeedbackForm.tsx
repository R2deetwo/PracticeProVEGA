import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw } from 'lucide-react';

const FeedbackForm: React.FC = () => {
    const { addToast, closeModal } = useUI();
    const { currentUser } = useAuth();
    
    // Form State
    const [ticketType, setTicketType] = useState('General Feedback');
    const [title, setTitle] = useState('');
    const [feedback, setFeedback] = useState('');

    // Data Restore specific state
    const [restoreFirmName, setRestoreFirmName] = useState('');
    const [restoreNewEmail, setRestoreNewEmail] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const submitFeedback = useMutation(api.feedback.submitFeedback);
    const submitDataRestoreRequest = useMutation(api.feedback.submitDataRestoreRequest);

    const ticketOptions = ['General Feedback', 'Bug Report', 'Feature Request', 'Support Ticket', 'Data Restoration Request'];

    const isRestoreTicket = ticketType === 'Data Restoration Request';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isRestoreTicket) {
            // Dedicated restore flow
            const email = currentUser?.email || restoreNewEmail.trim();
            if (!email) {
                addToast('Please enter your email address.', { type: 'error' });
                return;
            }
            setIsSubmitting(true);
            try {
                await submitDataRestoreRequest({
                    email: email.toLowerCase(),
                    previousFirmName: restoreFirmName.trim() || undefined,
                    newAccountEmail: restoreNewEmail.trim() || email,
                    notes: feedback.trim() || undefined,
                    source: 'feedback_form',
                });
                addToast('Restoration request submitted! We will contact you within 24 hours.', { type: 'success' });
                closeModal();
            } catch (error) {
                console.error('Restore request failed:', error);
                addToast('Failed to submit. Please email practiceprosystems@gmail.com directly.', { type: 'error' });
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Standard feedback flow
        if (!feedback.trim()) {
            addToast('Please enter a message before submitting.', { type: 'error' });
            return;
        }
        if (!title.trim() && ticketType !== 'General Feedback') {
            addToast('Please enter a heading/title for your ticket.', { type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            if (currentUser) {
                await submitFeedback({
                    firmId: currentUser.firmId || 'none',
                    userId: currentUser.id || 'unknown',
                    userName: currentUser.name || 'Unknown User',
                    userEmail: currentUser.email || '',
                    type: ticketType,
                    title: title.trim() || 'Untitled Feedback',
                    message: feedback,
                });
            }
            addToast(ticketType === 'Support Ticket' ? 'Ticket submitted! Our team will be in touch.' : 'Thank you for your input! We appreciate you helping us build a better app.', { type: 'success' });
            closeModal();
        } catch (error) {
            console.error("Feedback submission failed:", error);
            addToast('Something went wrong. Please try again later.', { type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
                Contact the PracticePro team. Use the options below to report bugs, request features, or ask for support.
            </p>
            
            {/* Ticket Type Selector (Pills) */}
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
                {ticketOptions.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => setTicketType(opt)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${
                            ticketType === opt 
                            ? opt === 'Data Restoration Request'
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 dark:hover:bg-zinc-700'
                        }`}
                    >
                        {opt === 'Data Restoration Request' ? <div className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> {opt}</div> : opt}
                    </button>
                ))}
            </div>

            {/* Data Restoration Request — special form */}
            {isRestoreTicket ? (
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl">
                    <div className="flex items-start gap-2">
                        <div className="text-lg leading-none mt-0.5"><RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin-slow" /></div>
                        <div>
                            <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Request Workspace Data Restoration</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                                As part of our Beta upgrade, your workspace may not appear on this account yet. Fill in the details below and we will restore your data within <strong>24 hours</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Your Email (Old Account) <span className="text-red-500 dark:text-red-400">*</span>
                            </label>
                            <input autoComplete="off" data-lpignore="true" 
                                type="email"
                                value={currentUser?.email || restoreNewEmail}
                                onChange={e => setRestoreNewEmail(e.target.value)}
                                readOnly={!!currentUser?.email}
                                placeholder="Enter your email address"
                                className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 read-only:bg-slate-100 dark:bg-zinc-800 dark:read-only:bg-zinc-900 read-only:text-slate-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Previous Firm / Workspace Name <span className="text-slate-400">(helps us locate your data)</span>
                            </label>
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={restoreFirmName}
                                onChange={e => setRestoreFirmName(e.target.value)}
                                placeholder="e.g. Adenike & Associates"
                                className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Additional Notes <span className="text-slate-400">(optional)</span>
                            </label>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                rows={3}
                                placeholder="Any other details that may help us find your data (e.g. approx. date you last used the app, number of matters, team size...)"
                                className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 border-t border-blue-200 dark:border-blue-800 pt-3">
                        Alternatively, email us directly at <strong>practiceprosystems@gmail.com</strong> with "Workspace Restore" in the subject line.
                    </p>
                </div>
            ) : (
                <>
                    {ticketType !== 'General Feedback' && (
                        <div>
                            <label htmlFor="ticketTitle" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Heading / Subject
                            </label>
                            <input autoComplete="off" data-lpignore="true" 
                                id="ticketTitle"
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white transition-all"
                                placeholder={`E.g., Issue with billing page`}
                                required={ticketType !== 'General Feedback'}
                                autoFocus
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="feedbackText" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Message
                        </label>
                        <textarea
                            id="feedbackText"
                            value={feedback}
                            onChange={e => setFeedback(e.target.value)}
                            rows={5}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white transition-all resize-none custom-scrollbar"
                            placeholder={`Describe your ${ticketType.toLowerCase()}...`}
                            required
                        />
                    </div>
                </>
            )}

            <div className="pt-2 flex justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-6 py-2 text-white rounded-lg font-bold transition-colors shadow-sm disabled:opacity-50 ${
                        isRestoreTicket ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                >
                    {isSubmitting ? 'Sending...' : isRestoreTicket ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Submit Restoration Request</span> : 'Submit Ticket'}
                </button>
            </div>
        </form>
    );
};

export default FeedbackForm;