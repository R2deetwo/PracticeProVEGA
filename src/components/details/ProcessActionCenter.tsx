import React, { useState, useMemo } from 'react';
import { Matter, Task, TaskStatus, TaskPriority, MatterType, FirmSpecialty, CourtType } from '../../types';
import { ENTERPRISE_WORKFLOWS } from '../../utils/enterpriseWorkflows';
import { PROCEDURAL_RULES } from '../../utils/proceduralRules';
import { PenLine, Scale, ClipboardList, Mail, Landmark, ScrollText, AlertTriangle, FolderOpen, Droplet, Building, Cloud, PenTool, CheckCircle, FileText, Link } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ActionConfig {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    actionType: 'generate-document' | 'send-email' | 'file-with-court' | 'external-step';
    documentType?: string;
}

interface ProcessActionCenterProps {
    matter: Matter;
    tasks: Task[];
    openModal: (type: string, id: string | null, context?: any) => void;
    onUpdateStatus?: (taskId: string, status: TaskStatus) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION CATALOGUE — per specialty & stage
// ─────────────────────────────────────────────────────────────────────────────

const SPECIALTY_ACTIONS: Record<string, ActionConfig[]> = {
    [MatterType.MaritimeAdmiralty]: [
        {
            id: 'prepare-affidavit-urgency',
            title: 'Prepare Affidavit of Urgency',
            description: 'Draft the urgent affidavit required to obtain an urgent arrest warrant',
            icon: <PenLine className="w-5 h-5" />,
            priority: 'CRITICAL',
            actionType: 'generate-document',
            documentType: 'AffidavitOfUrgency',
        },
        {
            id: 'file-warrant-arrest',
            title: 'File Warrant of Arrest',
            description: 'File the in rem warrant with the Federal High Court Admiralty Registry',
            icon: <Scale className="w-5 h-5" />,
            priority: 'CRITICAL',
            actionType: 'file-with-court',
            documentType: 'WarrantOfArrest',
        },
        {
            id: 'prepare-writ-summons',
            title: 'Draft Writ of Summons In Rem',
            description: 'Originating process naming the vessel as defendant',
            icon: <ClipboardList className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'generate-document',
            documentType: 'WritOfSummons',
        },
        {
            id: 'demand-security',
            title: 'Issue Security Demand',
            description: 'Formal demand to the P&I Club or vessel owner for security/bond',
            icon: <Mail className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'send-email',
            documentType: 'SecurityDemand',
        },
        {
            id: 'file-notice-arrest',
            title: 'File Notice of Arrest',
            description: 'Notify court and opposing parties of the vessel arrest execution',
            icon: <Landmark className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'file-with-court',
            documentType: 'NoticeOfArrest',
        },
        {
            id: 'undertaking-damages',
            title: 'File Undertaking as to Damages',
            description: 'Plaintiff\'s undertaking submitted with the warrant application',
            icon: <ScrollText className="w-5 h-5" />,
            priority: 'MEDIUM',
            actionType: 'generate-document',
            documentType: 'UndertakingDamages',
        },
    ],
    [MatterType.Tax]: [
        {
            id: 'draft-notice-objection',
            title: 'Draft Notice of Objection',
            description: 'FIRS objection — must be filed within 30 days of assessment',
            icon: <AlertTriangle className="w-5 h-5" />,
            priority: 'CRITICAL',
            actionType: 'generate-document',
            documentType: 'NoticeOfObjection',
        },
        {
            id: 'file-tat-appeal',
            title: 'File TAT Appeal',
            description: 'Notice of Appeal to the Tax Appeal Tribunal',
            icon: <Scale className="w-5 h-5" />,
            priority: 'CRITICAL',
            actionType: 'file-with-court',
            documentType: 'TATNoticeOfAppeal',
        },
        {
            id: 'tcc-application',
            title: 'TCC Application',
            description: 'Apply for Tax Clearance Certificate from FIRS',
            icon: <Landmark className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'external-step',
        },
        {
            id: 'compile-receipts',
            title: 'Compile Client Tax Receipts',
            description: 'Collect all TCCs, ETCCs, and evidence of prior tax payments',
            icon: <FolderOpen className="w-5 h-5" />,
            priority: 'MEDIUM',
            actionType: 'generate-document',
            documentType: 'TaxRecordsSummary',
        },
    ],
    [MatterType.OilGas]: [
        {
            id: 'nuprc-application',
            title: 'Submit NUPRC Application',
            description: 'File license renewal or OML application with NUPRC portal',
            icon: <Droplet className="w-5 h-5" />,
            priority: 'CRITICAL',
            actionType: 'external-step',
        },
        {
            id: 'relinquishment-plan',
            title: 'File Relinquishment Plan',
            description: 'PIA-required relinquishment notice to NUPRC',
            icon: <ClipboardList className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'generate-document',
            documentType: 'RelinquishmentPlan',
        },
        {
            id: 'draft-joa',
            title: 'Draft Joint Operating Agreement',
            description: 'JOA for farm-in / farm-out transaction',
            icon: <PenLine className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'generate-document',
            documentType: 'JointOperatingAgreement',
        },
        {
            id: 'ministerial-consent',
            title: 'Apply for Ministerial Consent',
            description: 'NUPRC ministerial consent for assignment of OML interest',
            icon: <Landmark className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'external-step',
        },
    ],
    [MatterType.CorporateCommercial]: [
        {
            id: 'reserve-name-cac',
            title: 'Reserve Name at CAC',
            description: 'Submit name availability check and reservation on CAC portal',
            icon: <Building className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'external-step',
        },
        {
            id: 'draft-memart',
            title: 'Draft Memorandum & Articles',
            description: 'MemArt for new company incorporation',
            icon: <PenLine className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'generate-document',
            documentType: 'MemorandumAndArticles',
        },
        {
            id: 'file-cac-upload',
            title: 'Upload to CAC CRMS Portal',
            description: 'Upload all incorporation documents to CAC online portal',
            icon: <Cloud className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'external-step',
        },
        {
            id: 'board-resolution',
            title: 'Draft Board Resolution',
            description: 'Board resolution authorising the transaction',
            icon: <ClipboardList className="w-5 h-5" />,
            priority: 'MEDIUM',
            actionType: 'generate-document',
            documentType: 'BoardResolution',
        },
    ],
    [MatterType.RealEstate]: [
        {
            id: 'deed-assignment',
            title: 'Draft Deed of Assignment',
            description: 'Primary conveyancing instrument for property transfer',
            icon: <PenLine className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'generate-document',
            documentType: 'DeedOfAssignment',
        },
        {
            id: 'governors-consent',
            title: "Apply for Governor's Consent",
            description: "File consent application with the state Lands Bureau",
            icon: <Landmark className="w-5 h-5" />,
            priority: 'CRITICAL',
            actionType: 'external-step',
        },
        {
            id: 'stamp-duties',
            title: 'Pay Stamp Duties (FIRS)',
            description: 'Stamp the deed at FIRS before registering title',
            icon: <PenTool className="w-5 h-5" />,
            priority: 'HIGH',
            actionType: 'external-step',
        },
        {
            id: 'deed-of-lease',
            title: 'Draft Deed of Lease',
            description: 'Formal lease instrument for tenancy / leasehold transactions',
            icon: <ClipboardList className="w-5 h-5" />,
            priority: 'MEDIUM',
            actionType: 'generate-document',
            documentType: 'DeedOfLease',
        },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALTY COLOUR MAP
// ─────────────────────────────────────────────────────────────────────────────

const SPECIALTY_STYLES: Record<string, { accent: string; bg: string; border: string; label: string }> = {
    [FirmSpecialty.Maritime]:  { accent: '#00A8D8', bg: 'rgba(0,168,216,0.06)', border: 'rgba(0,168,216,0.15)', label: 'Maritime & Admiralty' },
    [FirmSpecialty.Tax]:       { accent: '#4ADE80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.15)', label: 'Tax Disputes' },
    [FirmSpecialty.OilGas]:    { accent: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', label: 'Oil & Gas' },
    [FirmSpecialty.Corporate]: { accent: '#64B5F6', bg: 'rgba(100,181,246,0.06)', border: 'rgba(100,181,246,0.15)', label: 'Corporate & Commercial' },
    [FirmSpecialty.RealEstate]:{ accent: '#D97706', bg: 'rgba(217,119,6,0.06)',   border: 'rgba(217,119,6,0.15)',   label: 'Real Estate & Property' },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY BADGE
// ─────────────────────────────────────────────────────────────────────────────

const PriorityBadge: React.FC<{ p: 'CRITICAL' | 'HIGH' | 'MEDIUM' }> = ({ p }) => {
    const cfg = {
        CRITICAL: 'bg-red-500/15 text-red-500 border-red-500/25',
        HIGH:     'bg-amber-500/15 text-amber-500 border-amber-500/25',
        MEDIUM:   'bg-slate-400/15 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-600',
    }[p];
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-3xs font-black uppercase tracking-wider border ${cfg}`}>
            {p}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BUTTON CARD
// ─────────────────────────────────────────────────────────────────────────────

const ActionCard: React.FC<{
    action: ActionConfig;
    accent: string;
    onExecute: (action: ActionConfig) => void;
}> = ({ action, accent, onExecute }) => (
    <div className="group flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/60 hover:border-slate-200 dark:hover:border-zinc-600 hover:shadow-md transition-all">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
            {action.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 leading-tight">{action.title}</p>
                <PriorityBadge p={action.priority} />
            </div>
            <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-2">{action.description}</p>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onExecute(action)}
                    className="px-3 py-1.5 rounded-lg text-2xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90 active:scale-95 shadow-sm flex items-center gap-1.5"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                >
                    {action.actionType === 'generate-document' ? <><FileText className="w-3.5 h-3.5" /> Generate</> :
                     action.actionType === 'file-with-court'   ? <><Landmark className="w-3.5 h-3.5" /> File</> :
                     action.actionType === 'send-email'        ? <><Mail className="w-3.5 h-3.5" /> Send</> : <><Link className="w-3.5 h-3.5" /> Open Portal</>}
                </button>
                <span className="text-2xs text-slate-400 dark:text-zinc-500 capitalize">
                    {action.actionType.replace(/-/g, ' ')}
                </span>
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS CHECKLIST  
// ─────────────────────────────────────────────────────────────────────────────

const ProcessChecklist: React.FC<{
    tasks: Task[];
    onUpdateStatus: (taskId: string, s: TaskStatus) => void;
    accent: string;
}> = ({ tasks, onUpdateStatus, accent }) => {
    const filtered = tasks.filter(t => t.priority === TaskPriority.High || t.priority === TaskPriority.Medium);
    if (filtered.length === 0) return null;

    const done = filtered.filter(t => t.status === TaskStatus.Done).length;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-700/50">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                    Procedure Checklist
                </span>
                <span className="text-2xs font-bold" style={{ color: accent }}>{done}/{filtered.length} complete</span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100 dark:bg-zinc-700">
                <div className="h-full transition-all duration-500 rounded-r-full"
                    style={{ width: `${filtered.length > 0 ? (done / filtered.length) * 100 : 0}%`, background: accent }} />
            </div>

            <div className="divide-y divide-slate-50 dark:divide-zinc-700/40">
                {filtered.map(task => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors">
                        <button
                            onClick={() => onUpdateStatus(task.id, task.status === TaskStatus.Done ? TaskStatus.Todo : TaskStatus.Done)}
                            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                task.status === TaskStatus.Done
                                    ? 'border-transparent text-white'
                                    : 'border-slate-300 dark:border-zinc-600 hover:border-slate-400'
                            }`}
                            style={task.status === TaskStatus.Done ? { background: accent, borderColor: accent } : {}}
                        >
                            {task.status === TaskStatus.Done && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-tight ${task.status === TaskStatus.Done ? 'line-through text-slate-400 dark:text-zinc-500' : 'text-slate-700 dark:text-zinc-200'}`}>
                                {task.title}
                            </p>
                            {task.dueDate && (
                                <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">
                                    Due {new Date(task.dueDate).toLocaleDateString('en-GB')}
                                </p>
                            )}
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === TaskPriority.High ? 'bg-red-400' : 'bg-amber-400'}`} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIC SUGGESTIONS LAYER (PIE)
// ─────────────────────────────────────────────────────────────────────────────

const StrategicSuggestions: React.FC<{
    matter: Matter;
    accent: string;
}> = ({ matter, accent }) => {
    const action = matter.originatingProcess as string;
    const court = matter.court as CourtType;
    const rule = action && court ? (PROCEDURAL_RULES[action] as any)?.[court] : null;

    // Derived logical overrides
    const dynamicSuggestions = useMemo(() => {
        const suggs = [...(rule?.strategicFlags || [])];
        
        // Example logic: if claim type is liquidated and not on undefended list
        const spec = matter.specialtyData?.maritime || matter.specialtyData?.tax || matter.specialtyData?.oilGas || matter.specialtyData?.corporate || matter.specialtyData?.realEstate;
        
        if (action === 'Writ of Summons' && (spec as any)?.claimType === 'Bunker Debt') {
            suggs.push("This matter qualifies for Summary Judgment under Order 13");
        }
        
        if (action === 'Writ of Summons' && (court as string) === 'Lagos High Court' && !matter.subCategory?.includes('Disputed')) {
            suggs.push("Consider Originating Summons instead of Writ if there's no substantial dispute of fact");
        }

        return suggs;
    }, [action, court, matter.specialtyData, matter.subCategory]);

    if (dynamicSuggestions.length === 0) return null;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700/60 overflow-hidden mb-4">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-zinc-700/50 bg-amber-500/5">
                <ShieldCheckIcon className="w-4 h-4 text-amber-500" />
                <span className="text-2xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Strategic Intelligence
                </span>
            </div>
            <div className="p-3 space-y-2">
                {dynamicSuggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 leading-tight">
                            {s}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ShieldCheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04m17.236 0a11.955 11.955 0 01-8.618 3.04V12m0 0v8.257c0 .194-.038.387-.112.568l-5.618-5.618m5.73 5.05a11.955 11.955 0 01-8.618-3.04" />
    </svg>
);

const TemplateGallery: React.FC<{
    matterType: string;
    accent: string;
    onSelect: (doc: string) => void;
}> = ({ matterType, accent, onSelect }) => {
    const templates = useMemo(() => {
        const wf = ENTERPRISE_WORKFLOWS[matterType as keyof typeof ENTERPRISE_WORKFLOWS];
        if (!wf) return [];
        // Collect processes from all sub-categories of this specialty
        const allProcesses = new Set<string>();
        Object.values(wf.subCategories).forEach((sub: any) => {
            sub.suggestions?.processes?.forEach((p: string) => allProcesses.add(p));
        });
        return Array.from(allProcesses).slice(0, 8);
    }, [matterType]);

    if (templates.length === 0) return null;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-700/50">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                    Document Templates
                </span>
            </div>
            <div className="p-3 flex flex-wrap gap-2">
                {templates.map(tpl => (
                    <button
                        key={tpl}
                        onClick={() => onSelect(tpl)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:shadow-sm active:scale-95"
                        style={{
                            background: `${accent}08`,
                            borderColor: `${accent}25`,
                            color: accent,
                        }}
                    >
                        <FileText className="w-3.5 h-3.5 inline mr-1" /> {tpl}
                    </button>
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const ProcessActionCenter: React.FC<ProcessActionCenterProps> = ({
    matter, tasks, openModal
}) => {
    const [activeSection, setActiveSection] = useState<'actions' | 'checklist' | 'templates'>('actions');
    const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

    // Derive specialty from specialtyData (Matter has no specialtyId field)
    const specialty: FirmSpecialty | undefined = matter.specialtyData?.maritime
        ? FirmSpecialty.Maritime
        : matter.specialtyData?.oilGas
            ? FirmSpecialty.OilGas
            : matter.specialtyData?.corporate
                ? FirmSpecialty.Corporate
                : matter.specialtyData?.tax
                    ? FirmSpecialty.Tax
                    : matter.specialtyData?.realEstate
                        ? FirmSpecialty.RealEstate
                        : undefined;
    const style = specialty ? SPECIALTY_STYLES[specialty] : null;
    const accent = style?.accent || '#6366f1';

    // Get available actions for this matter type
    const actions = useMemo(() => {
        const raw = SPECIALTY_ACTIONS[matter.type] || [];
        // Sort: CRITICAL first, then HIGH, then MEDIUM
        return [...raw].sort((a, b) => {
            const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
            return order[a.priority] - order[b.priority];
        });
    }, [matter.type]);

    const onExecuteAction = (action: ActionConfig) => {
        // Log action and mark taken
        setCompletedActions(prev => new Set([...prev, action.id]));

        if (action.actionType === 'generate-document') {
            openModal('newDraft', null, {
                matterId: matter.id,
                documentType: action.documentType,
                templateTitle: action.title,
                matterTitle: matter.title,
                prePopulate: {
                    maritime: matter.specialtyData?.maritime,
                    tax: matter.specialtyData?.tax,
                    oilGas: matter.specialtyData?.oilGas,
                    corporate: matter.specialtyData?.corporate,
                    realEstate: matter.specialtyData?.realEstate,
                },
            });
        } else if (action.actionType === 'send-email') {
            openModal('composeEmail', null, {
                matterId: matter.id,
                subject: `Re: ${matter.title} — ${action.title}`,
                documentType: action.documentType,
            });
        } else if (action.actionType === 'file-with-court') {
            openModal('newDocument', null, {
                matterId: matter.id,
                documentType: action.documentType,
                title: action.title,
                autoFilingContext: true,
            });
        } else {
            // External step — show instructions toast via task creation
            openModal('newTask', null, {
                matterId: matter.id,
                openedFrom: 'actionCenter',
                prefillTitle: action.title,
                prefillDescription: action.description,
            });
        }
    };

    const onUpdateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
        // Delegate to the parent's onUpdateStatus prop — previously this was
        // a no-op stub, so clicking checkboxes in the Procedure Checklist
        // did nothing.
        if (onUpdateStatus) {
            onUpdateStatus(taskId, newStatus);
        }
    };

    if (!style) {
        // Not an enterprise specialty — render nothing (parent handles legacy view)
        return null;
    }

    const completedCount = actions.filter(a => completedActions.has(a.id)).length;
    const criticalActions = actions.filter(a => a.priority === 'CRITICAL' && !completedActions.has(a.id));

    return (
        <div className="space-y-5">
            {/* Specialty Banner */}
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                <div>
                    <p className="text-2xs font-black uppercase tracking-widest mb-0.5" style={{ color: accent }}>
                        Action Center
                    </p>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{style.label}</p>
                    {matter.subCategory && (
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">{matter.subCategory}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black" style={{ color: accent }}>{completedCount}</p>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 font-semibold">of {actions.length} actions taken</p>
                </div>
            </div>

            {/* PIE Strategic Layer */}
            <StrategicSuggestions matter={matter} accent={accent} />

            {/* Critical warning if any */}
            {criticalActions.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700 dark:text-red-400">
                            {criticalActions.length} critical action{criticalActions.length > 1 ? 's' : ''} pending
                        </p>
                        <p className="text-2xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                            {criticalActions.map(a => a.title).join(' · ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Section Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg w-fit">
                {([
                    { id: 'actions',   label: 'Actions' },
                    { id: 'checklist', label: 'Checklist' },
                    { id: 'templates', label: 'Templates' },
                ] as const).map(sec => (
                    <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                        className={`px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                            activeSection === sec.id
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-slate-700 dark:text-zinc-100'
                                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                        }`}
                    >
                        {sec.label}
                    </button>
                ))}
            </div>

            {/* Actions */}
            {activeSection === 'actions' && (
                <div className="space-y-2.5">
                    {actions.length > 0 ? actions.map(action => (
                        <div key={action.id} className={`transition-opacity ${completedActions.has(action.id) ? 'opacity-50' : ''}`}>
                            <ActionCard action={action} accent={accent} onExecute={onExecuteAction} />
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <CheckCircle className="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-3" />
                            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No actions defined for this matter type</p>
                            <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">Add tasks manually from the Tasks tab</p>
                        </div>
                    )}
                </div>
            )}

            {/* Checklist */}
            {activeSection === 'checklist' && (
                <ProcessChecklist
                    tasks={tasks}
                    onUpdateStatus={onUpdateTaskStatus}
                    accent={accent}
                />
            )}

            {/* Templates */}
            {activeSection === 'templates' && (
                <TemplateGallery
                    matterType={matter.type}
                    accent={accent}
                    onSelect={(tpl) => openModal('newDraft', null, {
                        matterId: matter.id,
                        templateTitle: tpl,
                        matterTitle: matter.title,
                    })}
                />
            )}
        </div>
    );
};
