
import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { AutomationRule, TaskPriority, WorkflowDefinition, MatterType, AutomationAction, AutomationTriggerType } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { PlusIcon, TrashIcon, ZapIcon, LockClosedIcon, MailIcon, CalendarIcon, CheckCircleIcon, ChevronRightIcon, EditIcon, ArchiveIcon, DocumentIcon, ChatAltIcon } from '../../constants';
import { useFeatures } from '../../hooks/useFeatures';
import { useUI } from '../../contexts/UIContext';
import { v4 as uuidv4 } from 'uuid';
import { SectionErrorBoundary } from '../ui/SectionErrorBoundary';
import { getProfilesForAreas } from '../../config/practiceProfileLibrary';
import { getAtriumProfilesForPortfolio } from '../../config/atriumProfileLibrary';

// --- TYPES & CONSTANTS ---

type RuleView = 'list' | 'builder';

interface Recipe {
    id: string;
    title: string;
    description: string;
    icon: React.ReactElement;
    triggerType: AutomationTriggerType;
    triggerValue: string;
    action: Partial<AutomationAction>;
    color: string;
}

const RECIPES: Recipe[] = [
    {
        id: 'recipe_welcome',
        title: 'Client Welcome Protocol',
        description: 'Send a welcome email when a new Matter is created.',
        icon: <MailIcon className="w-5 h-5" />,
        triggerType: 'matter_created',
        triggerValue: 'any',
        action: { type: 'send_email', emailSubject: 'Welcome to PracticePro Firm', emailBody: 'Dear [Client Name],\n\nWe are pleased to welcome you...' },
        color: 'bg-blue-500'
    },
    {
        id: 'recipe_payment_chaser',
        title: 'Payment Chaser',
        description: 'Send a reminder email when an invoice becomes overdue.',
        icon: <MailIcon className="w-5 h-5" />,
        triggerType: 'invoice_overdue',
        triggerValue: 'any',
        action: { type: 'send_email', emailSubject: 'Overdue Invoice Reminder', emailBody: 'Dear Client,\n\nThis is a friendly reminder that invoice...' },
        color: 'bg-red-500'
    },
    {
        id: 'recipe_hot_lead',
        title: 'Hot Lead Follow-up',
        description: 'Create a high priority task to call a new lead immediately.',
        icon: <CheckCircleIcon className="w-5 h-5" />,
        triggerType: 'lead_created',
        triggerValue: 'any',
        action: { type: 'create_task', taskTitle: 'Call New Lead', priority: TaskPriority.High, dueInDays: 0, description: 'New lead received. Call immediately to qualify.' },
        color: 'bg-orange-500'
    },
    {
        id: 'recipe_court_prep',
        title: 'Court Hearing Prep',
        description: 'Create a preparation task when a hearing is scheduled.',
        icon: <CalendarIcon className="w-5 h-5" />,
        triggerType: 'event_created',
        triggerValue: 'hearing',
        action: { type: 'create_task', taskTitle: 'Prepare for Hearing', priority: TaskPriority.High, dueInDays: -3, description: 'Review case file and prepare binder.' },
        color: 'bg-indigo-500'
    },
    {
        id: 'recipe_closure',
        title: 'Case Closure Cleanup',
        description: 'Create a task to archive physical files when a matter is closed.',
        icon: <ArchiveIcon className="w-5 h-5" />,
        triggerType: 'matter_stage_change',
        triggerValue: 'Closed',
        action: { type: 'create_task', taskTitle: 'Archive Physical Files', priority: TaskPriority.Low, dueInDays: 7, description: 'Scan and archive all physical documents for the closed matter.' },
        color: 'bg-slate-500'
    },
    {
        id: 'recipe_task_rescue',
        title: 'Overdue Task Escalation',
        description: 'Create a high-priority follow-up task when a task becomes overdue.',
        icon: <ZapIcon className="w-5 h-5" />,
        triggerType: 'task_overdue',
        triggerValue: 'High',
        action: { type: 'create_task', taskTitle: 'Escalate Overdue Task', priority: TaskPriority.High, dueInDays: 0, description: 'A high-priority task is overdue and requires immediate attention.' },
        color: 'bg-rose-500'
    },
    {
        id: 'recipe_doc_review',
        title: 'New Document Review',
        description: 'Create a review task when a client uploads a document.',
        icon: <DocumentIcon className="w-5 h-5" />,
        triggerType: 'document_uploaded',
        triggerValue: 'client_portal',
        action: { type: 'create_task', taskTitle: 'Review Client Document', priority: TaskPriority.Medium, dueInDays: 1, description: 'Client uploaded a new document. Please review.' },
        color: 'bg-cyan-500'
    },
    {
        id: 'recipe_whatsapp_update',
        title: 'WhatsApp Status Update',
        description: 'Send a WhatsApp message when a matter moves to "Trial".',
        icon: <ChatAltIcon className="w-5 h-5" />,
        triggerType: 'matter_stage_change',
        triggerValue: 'Trial',
        action: { type: 'send_whatsapp', whatsappMessage: 'Your matter has moved to the Trial stage. We will be in touch shortly.' },
        color: 'bg-green-600'
    }
];

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string, headerColor?: string }> = ({ title, children, id, className, headerColor }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-900 dark:bg-[#1f2937] border border-slate-200 dark:border-dim-700 rounded-lg shadow-md ${className || ''}`}>
        {headerColor && <div className={`absolute top-0 left-0 right-0 h-1.5 ${headerColor}`}></div>}
        <div className="p-6 relative z-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

const RuleBuilder: React.FC<{
    initialRule?: AutomationRule,
    workflows: WorkflowDefinition[],
    onSave: (rule: Omit<AutomationRule, 'id'>) => void,
    onCancel: () => void
}> = ({ initialRule, workflows, onSave, onCancel }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const [name, setName] = useState(initialRule?.name || '');
    const [triggerType, setTriggerType] = useState<AutomationTriggerType>(initialRule?.triggerType || 'matter_stage_change');
    const [triggerValue, setTriggerValue] = useState(initialRule?.triggerValue || '');
    const [actionType, setActionType] = useState<AutomationAction['type']>(initialRule?.actions[0]?.type || 'create_task');

    // Action State
    const [taskTitle, setTaskTitle] = useState(initialRule?.actions[0]?.taskTitle || '');
    const [dueInDays, setDueInDays] = useState(initialRule?.actions[0]?.dueInDays || 0);
    const [priority, setPriority] = useState<TaskPriority>(initialRule?.actions[0]?.priority || TaskPriority.Medium);
    const [emailSubject, setEmailSubject] = useState(initialRule?.actions[0]?.emailSubject || '');
    const [emailBody, setEmailBody] = useState(initialRule?.actions[0]?.emailBody || '');
    const [whatsappMessage, setWhatsappMessage] = useState(initialRule?.actions[0]?.whatsappMessage || '');
    const [templateId, setTemplateId] = useState(initialRule?.actions[0]?.templateId || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            firmId: coreState.firmDetails.id,
            name,
            triggerType,
            triggerValue: ['matter_created', 'invoice_overdue', 'lead_created', 'task_overdue', 'document_uploaded', 'client_onboarding_incomplete'].includes(triggerType) ? 'any' : triggerValue,
            actions: [{
                type: actionType,
                taskTitle,
                dueInDays,
                priority,
                emailSubject,
                emailBody,
                whatsappMessage,
                templateId
            }],
            isEnabled: true
        });
    };

    const stageOptions = useMemo(() => {
        const allStages = new Set<string>();
        workflows.forEach(w => {
            w.default.stages.forEach(s => allStages.add(s));
            Object.values(w.subCategories || {}).forEach((sub: any) => sub.stages.forEach((s: string) => allStages.add(s)));
        });
        return Array.from(allStages);
    }, [workflows]);

    const inputClass = "w-full p-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-md text-sm";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-lg border border-slate-200 dark:border-zinc-700">
            <div>
                <label className="block text-sm font-bold mb-1">Rule Name</label>
                <input autoComplete="off" data-lpignore="true"  type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Discovery Task on Stage Change" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="font-bold text-sm text-slate-500 uppercase">When...</h4>
                    <div>
                        <label className="block text-xs mb-1">Trigger Event</label>
                        <select value={triggerType} onChange={e => setTriggerType(e.target.value as any)} className={inputClass}>
                            <option value="matter_stage_change">Matter moves to stage...</option>
                            <option value="matter_created">New Matter is created</option>
                            <option value="invoice_overdue">Invoice becomes overdue</option>
                            <option value="lead_created">New Lead is created</option>
                            <option value="task_overdue">Task becomes overdue</option>
                            <option value="document_uploaded">Document is uploaded</option>
                            <option value="client_onboarding_incomplete">Client onboarding incomplete (24h)</option>
                            <option value="event_created">Calendar Event Created</option>
                        </select>
                    </div>
                    {triggerType === 'matter_stage_change' && (
                        <div>
                            <label className="block text-xs mb-1">Select Stage</label>
                            <select value={triggerValue} onChange={e => setTriggerValue(e.target.value)} className={inputClass}>
                                <option value="">-- Select Stage --</option>
                                {stageOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                    {triggerType === 'event_created' && (
                        <div>
                            <label className="block text-xs mb-1">Event Type</label>
                            <select value={triggerValue} onChange={e => setTriggerValue(e.target.value)} className={inputClass}>
                                <option value="any">Any Event</option>
                                <option value="hearing">Court Hearing</option>
                                <option value="deadline">Filing Deadline</option>
                                <option value="meeting">Client Meeting</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-sm text-slate-500 uppercase">Then...</h4>
                    <div>
                        <label className="block text-xs mb-1">Action</label>
                        <select value={actionType} onChange={e => setActionType(e.target.value as any)} className={inputClass}>
                            <option value="create_task">Create a Task</option>
                            <option value="send_email">Send Email (Template)</option>
                            <option value="send_whatsapp">Send WhatsApp Message</option>

                            <option value="generate_document">Generate Document from Template</option>
                        </select>
                    </div>

                    {actionType === 'create_task' && (
                        <>
                            <input autoComplete="off" data-lpignore="true"  type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task Title" className={inputClass} required />
                            <div className="flex gap-2">
                                <input autoComplete="off" data-lpignore="true"  type="number" value={dueInDays} onChange={e => setDueInDays(parseInt(e.target.value))} placeholder="Due in (days)" className={inputClass} />
                                <select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputClass}>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>
                        </>
                    )}

                    {actionType === 'send_email' && (
                        <>
                            <input autoComplete="off" data-lpignore="true"  type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email Subject" className={inputClass} required />
                            <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Email Body" className={`${inputClass} h-24`} required />
                        </>
                    )}

                    {actionType === 'send_whatsapp' && (
                        <>
                            <textarea value={whatsappMessage} onChange={e => setWhatsappMessage(e.target.value)} placeholder="WhatsApp Message" className={`${inputClass} h-24`} required />
                            <p className="text-2xs text-slate-500">Requires integrated WhatsApp Business API.</p>
                        </>
                    )}



                    {actionType === 'generate_document' && (
                        <>
                            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inputClass}>
                                <option value="">-- Select Template --</option>
                                <option value="temp_retainer">Retainer Agreement</option>
                                <option value="temp_nda">Non-Disclosure Agreement</option>
                                <option value="temp_letter">Standard Letter</option>
                            </select>
                        </>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-700">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md text-sm font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-bold shadow-sm">Save Rule</button>
            </div>
        </form>
    );
};

interface AutomationSettingsProps {
    rules: AutomationRule[];
    workflows: WorkflowDefinition[];
}

const AutomationSettings: React.FC<AutomationSettingsProps> = ({ rules, workflows }) => {
    const { handleAddAutomationRule, handleDeleteAutomationRule, handleToggleAutomationRule } = useDataActions();
    const { coreState, isDataLoaded } = useCoreState();
    const { canUseAutomation } = useFeatures();
    const { openModal } = useUI();
    const { currentUser, bearerToken } = useAuth();
    const [view, setView] = useState<RuleView>('list');
    const firmId = coreState.firmDetails?.id || '';
    const auth = { userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || undefined };

    // ── BLUEPRINT RECIPE WIRING (Task 48) ─────────────────────────────
    // The firm's Practice/Portfolio Blueprint already knows what they do
    // (practiceProfile.practiceAreas / portfolioTypes). Each curated
    // profile carries suggested-automation strings — surface them here as
    // ready-to-build ideas so the rule engine meets the firm's actual
    // practice, not a generic template list.
    const blueprintIdeas = useMemo(() => {
        const fp = (coreState.firmDetails as any)?.practiceProfile || {};
        const areas: string[] = fp.practiceAreas || (coreState.firmDetails as any)?.firmSpecialties || [];
        const portfolioTypes: string[] = fp.portfolioTypes || [];
        const focusAreas: string[] = fp.focusAreas || [];
        const ideas: { source: string; text: string }[] = [];
        for (const p of getProfilesForAreas(areas)) {
            for (const a of p.automations) ideas.push({ source: p.label, text: a });
        }
        try {
            const { profiles, overlays } = getAtriumProfilesForPortfolio(portfolioTypes, focusAreas);
            for (const p of profiles) for (const a of p.automations) ideas.push({ source: p.label, text: a });
            for (const o of overlays) for (const a of (o.automations || [])) ideas.push({ source: o.label, text: a });
        } catch { /* portfolio library is optional for pure-legal firms */ }
        const seen = new Set<string>();
        return ideas.filter((i) => {
            const k = i.text.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 8);
    }, [coreState.firmDetails]);

    const handleCreateRule = (ruleData: Omit<AutomationRule, 'id'>) => {
        handleAddAutomationRule({ ...ruleData, id: uuidv4() });
        setView('list');
    };

    const handleApplyRecipe = (recipe: Recipe) => {
        const rule: Omit<AutomationRule, 'id'> = {
            firmId: coreState.firmDetails.id,
            name: recipe.title,
            triggerType: recipe.triggerType,
            triggerValue: recipe.triggerValue,
            actions: [recipe.action as AutomationAction],
            isEnabled: true
        };
        handleAddAutomationRule({ ...rule, id: uuidv4() });
    };

    if (!canUseAutomation) {
        return (
            <SettingsCard title="Automation Studio" id="automation-settings">
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700">
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4">
                        <LockClosedIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Automate Your Workflow</h3>
                    <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-6">
                        Unlock powerful automation rules to create tasks, send emails, and update records automatically when triggers occur. Available on the Enterprise plan.
                    </p>
                    <button
                        onClick={() => openModal('upgradePlan', null, { featureName: 'Automation Rules' })}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow-md hover:bg-emerald-700 transition-transform hover:scale-105"
                    >
                        Upgrade to Enterprise
                    </button>
                </div>
            </SettingsCard>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <ZapIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Automation Studio</h2>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 ml-14">Build "If This, Then That" rules to put your firm on autopilot.</p>
                <p className="text-2xs text-slate-500 dark:text-zinc-500 ml-14 mt-1 leading-relaxed">
                    Rules run automatically — the instant a matching matter, lead, event or document change
                    happens, and every morning for overdue invoices, overdue tasks and untouched matters.
                    Each rule fires once per record, never twice. Message actions go out through Scheduled
                    Messages (with unsubscribe + opt-out protection); task actions land in the assignee's task list.
                </p>
            </div>

            {view === 'list' && (
                <SettingsCard title="Quick Start Templates">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {RECIPES.map(recipe => (
                            <button
                                key={recipe.id}
                                onClick={() => handleApplyRecipe(recipe)}
                                className="flex flex-col items-start p-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:border-primary-500 hover:shadow-md transition-all text-left"
                            >
                                <div className={`p-2 rounded-lg ${recipe.color} text-white mb-3 shadow-sm`}>
                                    {recipe.icon}
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-white mb-1">{recipe.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">{recipe.description}</p>
                            </button>
                        ))}
                    </div>
                </SettingsCard>
            )}

            <SettingsCard title="Your Rules" id="automation-settings" headerColor="bg-slate-200 dark:bg-slate-700">
                {view === 'list' ? (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button
                                onClick={() => setView('builder')}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white dark:bg-zinc-900 text-white dark:text-slate-900 rounded-lg font-bold text-sm shadow-sm hover:opacity-90"
                            >
                                <PlusIcon className="w-4 h-4" /> Create Custom Rule
                            </button>
                        </div>

                        {rules.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg">
                                <p className="text-slate-400">No active rules. Pick a template above or create a custom rule.</p>
                            </div>
                        ) : (
                            <SectionErrorBoundary sectionName="Rule activity">
                                <RulesListWithActivity
                                    rules={rules}
                                    firmId={firmId}
                                    auth={auth}
                                    onToggle={handleToggleAutomationRule}
                                    onDelete={handleDeleteAutomationRule}
                                />
                            </SectionErrorBoundary>
                        )}
                        {blueprintIdeas.length > 0 && (
                            <div className="mt-6 p-4 bg-indigo-50/60 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                                <div className="flex items-center gap-2 mb-2">
                                    <ZapIcon className="w-3.5 h-3.5 text-indigo-500" />
                                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Ideas from your Practice Blueprint</p>
                                </div>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-2 leading-relaxed">
                                    Based on the practice areas you picked in your Blueprint — build any of these as a custom rule above.
                                </p>
                                <ul className="space-y-1">
                                    {blueprintIdeas.map((idea, i) => (
                                        <li key={i} className="text-2xs text-slate-600 dark:text-zinc-300 flex gap-2">
                                            <span className="text-indigo-400 flex-shrink-0">•</span>
                                            <span><span className="font-bold">{idea.source}:</span> {idea.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <RuleBuilder
                        workflows={workflows}
                        onSave={handleCreateRule}
                        onCancel={() => setView('list')}
                    />
                )}
            </SettingsCard>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// RulesListWithActivity — the rules list + live engine activity badges.
//
// Extracted into its own component (Task 48) so its getRuleActivity query
// is the ONLY thing that can fail here (same isolation pattern as the
// Scheduled tab's UpcomingProjection, 2026-09-14 incident): if the Convex
// backend is a version behind (function not yet promoted), the
// SectionErrorBoundary degrades this one card instead of killing the
// whole Settings page.
// ─────────────────────────────────────────────────────────────────────────────
const OUTCOME_LABELS: Record<string, string> = {
    enqueued_task: 'task created',
    enqueued_email: 'email queued',
    enqueued_whatsapp: 'whatsapp queued',
    skipped_no_recipient: 'no recipient',
    skipped_unsupported: 'action not yet automated',
    no_action: 'no action',
    error: 'error (see console)',
};

const RulesListWithActivity: React.FC<{
    rules: AutomationRule[];
    firmId: string;
    auth: { userEmail?: string; sessionToken?: string };
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
}> = ({ rules, firmId, auth, onToggle, onDelete }) => {
    const activity = useQuery(
        api.automationRules.getRuleActivity,
        firmId && auth.userEmail ? { firmId, ...auth } : 'skip'
    );

    const renderActivity = (ruleId: string) => {
        if (!activity) {
            return <span className="text-2xs text-slate-300 dark:text-zinc-600">checking activity…</span>;
        }
        const a = (activity as Record<string, { lastFiredAt: number; total: number; lastOutcome: string }>)[ruleId];
        if (!a) {
            return (
                <span className="inline-flex items-center gap-1 text-2xs text-slate-400 dark:text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
                    hasn't fired yet
                </span>
            );
        }
        const when = a.lastFiredAt
            ? new Date(a.lastFiredAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'unknown';
        const label = OUTCOME_LABELS[a.lastOutcome] || a.lastOutcome;
        return (
            <span className="inline-flex items-center gap-1 text-2xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                fired {a.total} {a.total === 1 ? 'time' : 'times'} · last {when} · {label}
            </span>
        );
    };

    return (
        <div className="space-y-3">
            {rules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-sm">
                    <div className="flex items-center gap-4 min-w-0">
                        <div
                            onClick={() => onToggle(rule.id)}
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors flex-shrink-0 ${rule.isEnabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-zinc-600'}`}
                        >
                            <div className={`w-4 h-4 bg-white dark:bg-zinc-900 rounded-full shadow-sm transform transition-transform ${rule.isEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 dark:text-white truncate">{rule.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                Trigger: <span className="font-mono bg-slate-100 dark:bg-zinc-700 px-1 rounded">{rule.triggerType}</span>
                                &rarr;
                                Action: <span className="font-mono bg-slate-100 dark:bg-zinc-700 px-1 rounded">{rule.actions[0]?.type}</span>
                            </p>
                            <div className="mt-1">{renderActivity(rule.id)}</div>
                        </div>
                    </div>
                    <button onClick={() => onDelete(rule.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors flex-shrink-0">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default AutomationSettings;
