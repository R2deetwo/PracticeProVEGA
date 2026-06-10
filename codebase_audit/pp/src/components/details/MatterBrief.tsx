import React, { useState, useMemo } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { Matter, User, Document, ModalType, View, MatterType } from '../../types';
import { GavelIconLarge } from '../../constants';
import ActivityLogTab from './ActivityLogTab';
import FilingDeadlineNotice from './FilingDeadlineNotice';
import { DocumentsTab } from './DocumentsTab';
import MatterProcessTracking from './MatterProcessTracking';
import { EnterpriseMatterDashboard } from './EnterpriseWidgets';
import { ProceduralComplianceReport } from './ProceduralComplianceReport';

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; badgeCount?: number }> = ({ label, isActive, onClick, badgeCount }) => (
    <button
        onClick={onClick}
        className={`flex-none text-center relative whitespace-nowrap py-3 px-6 border-b-2 font-bold text-sm transition-all outline-none ${isActive
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-600'
            }`}
    >
        {label}
        {badgeCount !== undefined && badgeCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                {badgeCount}
            </span>
        )}
    </button>
);

const SlimDetailItem: React.FC<{ label: string, value: React.ReactNode, icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex flex-col justify-center min-w-0">
        <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest truncate mb-0.5 leading-none">{label}</span>
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 truncate w-full leading-tight">
            {icon && <span className="opacity-60 flex-shrink-0 -mt-0.5 scale-90">{icon}</span>}
            <span className="truncate">{value}</span>
        </div>
    </div>
);

// Matter types that involve court proceedings
const CONTENTIOUS_MATTER_TYPES: string[] = [
    MatterType.CivilLitigation,
    MatterType.CriminalDefense,
    MatterType.FamilyLaw,
    MatterType.EmploymentLabor,
];

interface MatterBriefProps {
    matter: Matter;
    client?: any;
    users: User[];
    currentUser: User;
    documents: Document[];
    tasks: any[];
    openModal: (modalType: ModalType, id?: string | null, context?: any) => void;
    onViewDocumentDetails: (id: string) => void;
    handleDraftDocument: () => void;
    onUpdateMatter: (m: Matter) => void;
    lastViewedAt: number;
}

export const MatterBrief: React.FC<MatterBriefProps> = ({
    matter,
    client,
    users,
    currentUser,
    documents,
    tasks,
    openModal,
    onViewDocumentDetails,
    handleDraftDocument,
    onUpdateMatter,
    lastViewedAt
}) => {
    const { coreState } = useCoreState();
    const [showActivity, setShowActivity] = useState(false);

    const activities = useMemo(() => {
        return coreState.firmActivity.filter(a =>
            a.matterId === matter.id ||
            (a.targetType === 'Matter' && a.targetId === matter.id) ||
            (a.targetType === 'Document' && documents.find(d => d.id === a.targetId)) ||
            (a.targetType === 'Task' && tasks.find(t => t.id === a.targetId))
        ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [coreState.firmActivity, matter.id, documents, tasks]);

    const isContentious = CONTENTIOUS_MATTER_TYPES.includes(matter.type);

    const [subTab, setSubTab] = useState<'processes' | 'documents'>(isContentious ? 'processes' : 'documents');

    const formattedDate = matter.createdAt
        ? new Date(matter.createdAt).toLocaleDateString('en-GB')
        : 'Unknown';

    const processBadgeCount = matter.processTracking?.activeProcesses?.filter(p => !p.responseReceived).length || 0;

    // Only show the enterprise specialty widget if the user actually filled in specialty data.
    // We must NOT infer it just from matter.type — that caused fake "Title Perfection Matrix"
    // and "Federal High Court" to appear on tenancy/real estate matters.
    const hasSpecialtyData = matter.specialtyData &&
        Object.values(matter.specialtyData).some(v => v && typeof v === 'object' && Object.keys(v as any).length > 0);

    return (
        <div className="space-y-6 pb-20">
            {/* Top Summary Strip */}
            <div className="-mx-4 -mt-4 mb-4 bg-slate-50/50 dark:bg-zinc-800/30 border-b border-slate-200 dark:border-zinc-700 px-4 py-2 grid grid-cols-2 md:flex md:items-center md:justify-between gap-y-2 gap-x-4">
                <SlimDetailItem label="Client" value={client?.name || 'Unknown'} />
                <SlimDetailItem label="Practice Area" value={matter.type} />
                {/* Court is only relevant for contentious/litigation matters */}
                {isContentious && (matter.court || matter.suitNumber) && (
                    <SlimDetailItem
                        label="Court"
                        value={matter.court || matter.suitNumber}
                        icon={<GavelIconLarge className="w-3 h-3 text-slate-400" />}
                    />
                )}
                <SlimDetailItem label="Created" value={formattedDate} />
            </div>

            {/* Filing Deadline Notice */}
            <div className="w-full">
                <FilingDeadlineNotice tasks={tasks} onViewTask={(tid) => openModal('viewTask', tid, { openedFrom: 'matterDetail' })} />
            </div>

            {/* Procedural Compliance Layer */}
            <ProceduralComplianceReport matter={matter} tasks={tasks} documents={documents} />

            {/* Enterprise specialty widget — ONLY if user filled in specialty data */}
            {hasSpecialtyData && (
                <EnterpriseMatterDashboard matter={matter} />
            )}

            {/* Activity Log */}
            {activities.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-700 overflow-hidden">
                    <button
                        onClick={() => setShowActivity(!showActivity)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Activity History</span>
                            <span className="bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{activities.length}</span>
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${showActivity ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showActivity && (
                        <div className="border-t border-slate-100 dark:border-zinc-700 p-2">
                            <ActivityLogTab matterId={matter.id} hideHeader={true} />
                        </div>
                    )}
                </div>
            )}

            {/* Documents & Processes Section */}
            <div className="flex flex-col min-h-[500px]">
                <div className="flex w-full overflow-x-auto custom-scrollbar border-b border-slate-200 dark:border-zinc-700">
                    {isContentious && (
                        <TabButton
                            label="Filed Processes"
                            isActive={subTab === 'processes'}
                            onClick={() => setSubTab('processes')}
                            badgeCount={processBadgeCount}
                        />
                    )}
                    <TabButton
                        label="Document Repository"
                        isActive={subTab === 'documents'}
                        onClick={() => setSubTab('documents')}
                        badgeCount={documents.filter(doc =>
                            new Date(doc.dateFiled).getTime() > lastViewedAt && doc.uploadedBy !== currentUser?.id
                        ).length}
                    />
                </div>

                <div className="flex-grow py-6 bg-transparent">
                    <div className="max-w-5xl">
                        {subTab === 'processes' && isContentious ? (
                            <MatterProcessTracking
                                matter={matter}
                                onUpdate={onUpdateMatter}
                                hideSuggestions={true}
                                documents={documents}
                                onViewDocumentDetails={onViewDocumentDetails}
                            />
                        ) : (
                            <div className="min-h-[400px]">
                                <DocumentsTab
                                    documents={documents}
                                    matterId={matter.id}
                                    openModal={openModal}
                                    onViewDocumentDetails={onViewDocumentDetails}
                                    users={users}
                                    onDraftDocument={handleDraftDocument}
                                    variant="embedded"
                                    lastViewedAt={lastViewedAt}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
