
import React, { useState } from 'react';
import { Matter, MatterProcess, ProcessSuggestion, Task, TaskStatus } from '../../types';
import {
    ClockIcon,
    CheckCircleIcon,
    InfoIcon as ExclamationCircleIcon,
    PlusIcon,
    CalendarIcon,
    BellIcon,
    XMarkIcon,
    DocumentTextIcon,
    ChevronRightIcon
} from '../../constants';
import { ProcessActionCenter } from './ProcessActionCenter';
import { useProduct } from '../../contexts/ProductContext';

interface MatterProcessTrackingProps {
    matter: Matter;
    onUpdate: (updatedMatter: Matter) => void;
    hideSuggestions?: boolean;
    documents?: import('../../types').Document[];
    onViewDocumentDetails?: (id: string) => void;
    tasks?: Task[];
    onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
    openModal?: (type: string, id: string | null, context?: any) => void;
}

const MatterProcessTracking: React.FC<MatterProcessTrackingProps> = ({ matter, onUpdate, hideSuggestions = false, documents = [], onViewDocumentDetails, tasks = [], onUpdateTaskStatus, openModal }) => {
    const { isProperty, terminology } = useProduct();
    // Enterprise detection: has any specialtyData subkey populated
    const isEnterpriseMatter = !!(matter.specialtyData && (
        matter.specialtyData.maritime || matter.specialtyData.oilGas ||
        matter.specialtyData.corporate || matter.specialtyData.tax ||
        matter.specialtyData.realEstate
    ));

    const [showAddModal, setShowAddModal] = useState(false);
    const [newProcess, setNewProcess] = useState<Partial<MatterProcess>>({
        processName: '',
        filedDate: new Date().toISOString().split('T')[0],
        responseExpectedBy: '',
        relatedDocumentId: ''
    });

    // Mock suggestions if none exist (for demo purposes)
    const suggestions: ProcessSuggestion[] = matter.processTracking?.suggestions || ([
        {
            id: 'sugg-1',
            type: 'deadline',
            title: isProperty ? 'Response overdue: Tenant Notice' : 'Response overdue: Motion to Dismiss',
            description: isProperty ? 'The response period for the Tenant Notice issued on Oct 10 has expired.' : 'The response period for the Motion to Dismiss filed on Oct 10 has expired.',
            dueDate: '2023-10-24',
            dismissed: false
        },
        {
            id: 'sugg-2',
            type: 'event',
            title: isProperty ? 'Schedule Property Inspection' : 'Schedule Case Management Conference',
            description: isProperty ? 'Lease renewal is approaching. Consider scheduling a property inspection.' : 'Pleadings have closed. Consider scheduling a CMC.',
            dismissed: false
        }
    ] as ProcessSuggestion[]).filter((s: ProcessSuggestion) => !s.dismissed);

    const activeProcesses = matter.processTracking?.activeProcesses || [];

    const handleAddProcess = () => {
        if (!newProcess.processName || !newProcess.filedDate) return;

        const process: MatterProcess = {
            id: crypto.randomUUID(),
            processName: newProcess.processName,
            filedDate: newProcess.filedDate,
            responseExpectedBy: newProcess.responseExpectedBy,
            responseReceived: false,
            notes: newProcess.notes,
            relatedDocumentId: newProcess.relatedDocumentId || undefined
        } as MatterProcess;

        const updatedTracking = {
            activeProcesses: [...(matter.processTracking?.activeProcesses || []), process],
            suggestions: matter.processTracking?.suggestions || [],
            suggestionsEnabled: matter.processTracking?.suggestionsEnabled ?? true
        };

        onUpdate({
            ...matter,
            processTracking: updatedTracking
        });

        setShowAddModal(false);
        setNewProcess({ processName: '', filedDate: new Date().toISOString().split('T')[0], responseExpectedBy: '', relatedDocumentId: '' });
    };

    const handleDismissSuggestion = (id: string) => {
        // In a real app, this would update the matter state
        // For now, we'll just log it or update local state if we were using it for suggestions

        // Update matter state to mark suggestion as dismissed
        const updatedSuggestions = (matter.processTracking?.suggestions || []).map(s =>
            s.id === id ? { ...s, dismissed: true } : s
        );

        // If suggestion not in matter (using mock), we can't really update it here without complex logic
        // But let's assume we are using the matter state
        if (matter.processTracking?.suggestions) {
            onUpdate({
                ...matter,
                processTracking: {
                    ...matter.processTracking,
                    suggestions: updatedSuggestions
                }
            });
        }
    };

    const handleMarkResponseReceived = (processId: string, status: 'sufficient' | 'insufficient' | 'pending_review') => {
        const updatedProcesses = activeProcesses.map(p =>
            p.id === processId ? {
                ...p,
                responseReceived: true,
                responseDate: new Date().toISOString().split('T')[0],
                responseStatus: status
            } : p
        );

        onUpdate({
            ...matter,
            processTracking: {
                ...(matter.processTracking || { suggestions: [], suggestionsEnabled: true }),
                activeProcesses: updatedProcesses
            }
        });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">

            {/* ── Enterprise Action Center (shown for specialty matters) ── */}
            {isEnterpriseMatter && openModal && (
                <ProcessActionCenter
                    matter={matter}
                    tasks={tasks}
                    openModal={openModal}
                    onUpdateStatus={onUpdateTaskStatus}
                />
            )}

            {/* ── Divider for Enterprise matters ── */}
            {isEnterpriseMatter && (
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
                    <span className="text-2xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{isProperty ? 'Tracked Processes' : 'Filed Processes'}</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
                </div>
            )}


            {/* Smart Suggestions */}
            {!hideSuggestions && suggestions.length > 0 && (
                <section className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BellIcon className="w-32 h-32 text-indigo-600" />
                    </div>

                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-300">
                            <BellIcon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-indigo-900 dark:text-white">Smart Suggestions</h3>
                        <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs font-bold px-2 py-0.5 rounded-full">
                            {suggestions.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {suggestions.map(suggestion => (
                            <div key={suggestion.id} className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 p-4 rounded-xl border border-indigo-100 dark:border-zinc-700 shadow-sm flex items-start justify-between group">
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${suggestion.type === 'deadline' ? 'bg-red-100 text-red-600' :
                                        suggestion.type === 'event' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        {suggestion.type === 'deadline' ? <ExclamationCircleIcon className="w-4 h-4" /> :
                                            suggestion.type === 'event' ? <CalendarIcon className="w-4 h-4" /> : <ClockIcon className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{suggestion.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{suggestion.description}</p>
                                        {suggestion.dueDate && (
                                            <div className="mt-2 text-xs font-medium text-slate-600 dark:text-zinc-300 flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3" />
                                                Due: {suggestion.dueDate}
                                            </div>
                                        )}
                                        <div className="mt-3 flex gap-2">
                                            <button className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline">
                                                {suggestion.type === 'event' ? 'Add to Calendar' : 'View Details'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDismissSuggestion(suggestion.id)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Processes List */}
            <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{isProperty ? 'Tracked Processes & Responses' : 'Filed Processes & Responses'}</h3>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex gap-2 text-xs font-medium text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Responded</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Pending</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Overdue</span>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg font-bold shadow-sm transition-all"
                        >
                            <PlusIcon className="w-4 h-4" />
                            {isProperty ? 'Record New Process' : 'Record New Filing'}
                        </button>
                    </div>
                </div>

                {activeProcesses.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <DocumentTextIcon className="w-8 h-8 text-slate-400" />
                        </div>
                        <h4 className="text-slate-900 dark:text-white font-bold mb-2">No processes tracked yet</h4>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">{isProperty ? `Start tracking your ${terminology.matter.toLowerCase()} processes and expected responses.` : 'Start tracking your court filings and expected responses.'}</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            {isProperty ? 'Record First Process' : 'Record First Filing'}
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-zinc-700">
                        {activeProcesses.map(process => {
                            const isOverdue = process.responseExpectedBy && !process.responseReceived && new Date(process.responseExpectedBy) < new Date();

                            return (
                                <div key={process.id} className="p-6 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${process.responseReceived ? 'bg-green-500' :
                                            isOverdue ? 'bg-red-500' : 'bg-orange-400'
                                            }`}>
                                            {process.responseReceived ? <CheckCircleIcon className="w-6 h-6" /> :
                                                <DocumentTextIcon className="w-5 h-5" />}
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-lg">{process.processName}</h4>
                                                <div className="flex items-center gap-2">
                                                    {process.responseReceived ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold border border-green-200 dark:border-green-800">
                                                            Response Received
                                                        </span>
                                                    ) : isOverdue ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold border border-red-200 dark:border-red-800 flex items-center gap-1">
                                                            <ExclamationCircleIcon className="w-3 h-3" /> Overdue
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold border border-orange-200 dark:border-orange-800">
                                                            Pending Response
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 mb-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    <span>Filed: <span className="font-medium text-slate-700 dark:text-zinc-200">{process.filedDate}</span></span>
                                                </div>
                                                {process.responseExpectedBy && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                                                        <ClockIcon className="w-4 h-4" />
                                                        <span>Response Due: <span className={`font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-zinc-200'}`}>{process.responseExpectedBy}</span></span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            {!process.responseReceived && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    <button
                                                        onClick={() => handleMarkResponseReceived(process.id, 'sufficient')}
                                                        className="px-3 py-1.5 bg-white dark:bg-zinc-900 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold text-slate-700 dark:text-zinc-300 hover:border-primary-500 hover:text-primary-600 transition-colors"
                                                    >
                                                        Mark Response Received
                                                    </button>
                                                </div>
                                            )}

                                            {/* Related Document */}
                                            {process.relatedDocumentId && documents && (
                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-700/50">
                                                    <div className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">Attached Document</div>
                                                    {(() => {
                                                        const doc = documents.find(d => d.id === process.relatedDocumentId);
                                                        if (!doc) return <div className="text-xs text-slate-500 italic">Document no longer available</div>;
                                                        return (
                                                            <div 
                                                                onClick={() => onViewDocumentDetails && onViewDocumentDetails(doc.id)}
                                                                className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 hover:border-primary-400 cursor-pointer w-max transition-colors"
                                                            >
                                                                <div className="p-1.5 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-700 rounded text-slate-500">
                                                                    <DocumentTextIcon className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">{doc.title}</div>
                                                                    <div className="text-2xs text-slate-500">{new Date(doc.dateFiled).toLocaleDateString('en-GB')}</div>
                                                                </div>
                                                                <ChevronRightIcon className="w-4 h-4 text-slate-400 ml-2" />
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Process Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-zinc-700 animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Record New Process</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Process Name</label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    value={newProcess.processName}
                                    onChange={e => setNewProcess({ ...newProcess, processName: e.target.value })}
                                    placeholder={isProperty ? 'e.g. Lease Renewal, Tenant Notice' : 'e.g. Motion to Dismiss, Statement of Defence'}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">{isProperty ? 'Date Initiated' : 'Date Filed'}</label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="date"
                                    value={newProcess.filedDate}
                                    onChange={e => setNewProcess({ ...newProcess, filedDate: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Response Expected By (Optional)</label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="date"
                                    value={newProcess.responseExpectedBy}
                                    onChange={e => setNewProcess({ ...newProcess, responseExpectedBy: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Leave blank if no response is required or deadline is unknown.</p>
                            </div>

                            {documents && documents.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">Attach Document from Repository (Optional)</label>
                                    <select
                                        value={newProcess.relatedDocumentId || ''}
                                        onChange={e => setNewProcess({ ...newProcess, relatedDocumentId: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    >
                                        <option value="">-- No Document --</option>
                                        {documents.map(doc => (
                                            <option key={doc.id} value={doc.id}>{doc.title}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">Upload the document to the repository first if it isn't listed.</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddProcess}
                                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-500/20 transition-all"
                            >
                                Record Process
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatterProcessTracking;
