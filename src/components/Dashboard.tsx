
import React, { useMemo, useState } from 'react';
import { Matter, Task, Invoice, CalendarEvent, CustomEventType, TimeEntry, Expense, InvoiceStatus, AppMode, User, UserRole, FirmActivity, Contact, Document, View, ModalType, FirmDetails, SubscriptionPlan } from '../types';
import TasksWidget from './dashboard/TasksWidget';
import RecentMattersWidget from './dashboard/FocusMatterWidget';
import DailyFocusView from './DailyFocusView';
import StatsWidget from './dashboard/StatsWidget';
import CalendarWidget from './dashboard/CalendarWidget';
import RecentPropertiesWidget from './dashboard/RecentPropertiesWidget';
import { useUI } from '../contexts/UIContext';
import { useCoreState } from '../contexts/CoreContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useProduct } from '../contexts/ProductContext';
import { LockClosedIcon, PlusIcon, CloudArrowUpIcon } from '../constants';
import { Skeleton } from './toolkit/Skeleton';
import { computeAtriumVirtualEvents } from '../utils/calendarUtils';



const TierAccessBanner: React.FC<{ plan: SubscriptionPlan, onUpgrade: () => void }> = ({ plan, onUpgrade }) => (
    <div className="bg-slate-100 dark:bg-zinc-800 border-l-4 border-slate-500 rounded-r-lg p-4 mb-6 flex items-start justify-between shadow-sm animate-fade-in">
        <div className="flex gap-3">
            <div className="p-2 bg-slate-200 dark:bg-zinc-700 rounded-full h-fit mt-1">
                <LockClosedIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
            </div>
            <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Team Access Paused</h4>
                <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-xl">
                    Your firm has moved to the <strong>{plan}</strong> plan, which supports single-user access.
                    Shared matters and team data are safely archived but currently hidden.
                    Upgrade to <strong>Pro</strong> to restore full team collaboration.
                </p>
            </div>
        </div>
        <button
            onClick={onUpgrade}
            className="whitespace-nowrap px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
            Restore Access
        </button>
    </div>
);

const Dashboard: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const isLoading = !isDataLoaded;

    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { financeState } = useFinanceState();
    const { currentUser } = useAuth();
    const { navigateTo, openModal, setHighlightTarget } = useUI();
    const { isLegal, isUnified } = useProduct();
    const [activeUnifiedTab, setActiveUnifiedTab] = useState<'matters' | 'properties'>('matters');
    
    // De-structure state
    const { matters, contacts } = matterState;
    const { invoices, timeEntries, expenses } = financeState;
    const { tasks, events, workflows } = executionState;
    const { users, firmDetails, eventTypes, firmActivity, properties } = coreState;

    const onNavigateAndHighlight = (v: View, filter: any, context?: any, color?: any) => {
        setHighlightTarget({ view: v, filter, color: color || 'blue' });
        navigateTo(v, null, context);
    };

    // Safety check for nulls
    // Safety check for nulls and clean data
    const safeTasks = useMemo(() => (tasks || []).filter(t => t && t.id), [tasks]);

    // FILTER OUT GHOST RECORDS (Missing title or client link)
    const safeMatters = useMemo(() => {
        return (matters || []).filter(m => m && m.title && m.id);
    }, [matters]);
    const safeInvoices = invoices || [];
    const safeContacts = contacts || [];

    const aiEnabled = firmDetails?.aiSettings?.enableAllAiFeatures;
    const plan = firmDetails?.subscriptionPlan || SubscriptionPlan.Core;

    // Check for "Downgrade State": Core plan but multiple internal users exist in DB
    // Portal users (Tenant/Client) must NOT count toward this check
    const internalUsers = users.filter(u =>
        u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.ExternalCounsel && u.role !== UserRole.Pending
    );
    const isDowngradedState = plan === SubscriptionPlan.Core && internalUsers.length > 1;

    const overdueTasksCount = safeTasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const activeMattersCount = safeMatters.filter(m => m.status === 'Active').length;
    const outstandingRevenue = safeInvoices
        .filter(i => i.status === InvoiceStatus.Unpaid || i.status === InvoiceStatus.Overdue)
        .reduce((sum, i) => sum + (i.lineItems || []).reduce((s, li) => s + (li.total || 0), 0), 0);

    // Atrium (property) stats
    const safeProperties = properties || [];
    const propertyCount = safeProperties.length;
    /** Pending/defaulted rent from ledger — not collected revenue */
    const outstandingRentLedger = safeProperties.reduce((total, p) => {
        const rentDue = (coreState.ledgerEntries || [])
            .filter(rp => (rp.propertyId === p.id || rp.unitId === p.id) && (rp.status === 'pending' || rp.status === 'defaulted'))
            .reduce((sum, rp) => sum + (rp.amount || 0), 0);
        return total + rentDue;
    }, 0);
    const activeLeasesCount = safeProperties.filter(p => p.status === 'Occupied').length;

    const handleUpgrade = () => {
        navigateTo('settings', null, { settingsTargetId: 'subscription-management' });
    };

    if (!currentUser) return null; // Avoid crash before auth is ready

    return (
        <div className="h-full overflow-y-auto custom-scrollbar scroll-smooth-ios bg-slate-50 dark:bg-zinc-900">
            <header className="sticky top-0 z-30 glass py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0">
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Overview</h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1">
                        Good day, {currentUser.name?.split(' ')[0] || 'User'}. Here's what's happening.
                    </p>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
                {/* Downgrade Banner */}
                {isDowngradedState && <TierAccessBanner plan={plan} onUpgrade={handleUpgrade} />}

                <div className="grid grid-cols-1 gap-8">
                    {isLoading ? (
                        <div className="w-full max-w-xl mx-auto">
                            <Skeleton height={32} width="100%" className="rounded-full" />
                        </div>
                    ) : aiEnabled && (
                        <div className="w-full max-w-2xl mx-auto">
                            <DailyFocusView currentUser={currentUser} />
                        </div>
                    )}
                </div>

                {/* Stats Row */}
                <div className="mb-6 flex-shrink-0">
                    <StatsWidget
                        activeMattersCount={isDowngradedState ? 0 : activeMattersCount}
                        overdueTasksCount={isDowngradedState ? 0 : overdueTasksCount}
                        outstandingRevenue={isDowngradedState ? 0 : outstandingRevenue}
                        contactsCount={isDowngradedState ? 0 : safeContacts.length}
                        propertyCount={isDowngradedState ? 0 : propertyCount}
                        propertyRevenue={isDowngradedState ? 0 : outstandingRentLedger}
                        activeLeasesCount={isDowngradedState ? 0 : activeLeasesCount}
                        navigateTo={navigateTo}
                        isLoading={isLoading}
                        currentUser={currentUser}
                    />
                </div>

                {/* Main Content Grid */}
                {!isDowngradedState ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-32 md:pb-20">
                        {/* Column 1: Recent Matters / Properties */}
                        <div className="lg:col-span-1 h-auto min-h-[24rem] lg:h-[28rem] flex flex-col gap-2">
                            {isUnified && (
                                <div className="flex border border-slate-200/60 dark:border-zinc-700/60 bg-white dark:bg-zinc-800 rounded-xl p-1 shadow-sm flex-shrink-0">
                                    <button
                                        onClick={() => setActiveUnifiedTab('matters')}
                                        className={`flex-1 text-center py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                                            activeUnifiedTab === 'matters'
                                                ? 'bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-white shadow-inner'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        Legal Matters
                                    </button>
                                    <button
                                        onClick={() => setActiveUnifiedTab('properties')}
                                        className={`flex-1 text-center py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                                            activeUnifiedTab === 'properties'
                                                ? 'bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-white shadow-inner'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                        }`}
                                    >
                                        Real Estate Properties
                                    </button>
                                </div>
                            )}
                            <div className="flex-grow min-h-0">
                                {(!isUnified && isLegal) || (isUnified && activeUnifiedTab === 'matters') ? (
                                    <RecentMattersWidget
                                        matters={safeMatters}
                                        contacts={safeContacts}
                                        firmActivity={firmActivity}
                                        users={users}
                                        currentUser={currentUser}
                                        onNavigateToDetail={navigateTo}
                                        openModal={openModal}
                                        isLoading={isLoading}
                                    />
                                ) : (
                                    <RecentPropertiesWidget
                                        properties={safeProperties}
                                        firmActivity={firmActivity}
                                        users={users}
                                        currentUser={currentUser}
                                        onNavigateToDetail={navigateTo}
                                        openModal={openModal}
                                        isLoading={isLoading}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Column 2: Tasks */}
                        <div className="lg:col-span-1 h-auto min-h-[24rem] lg:h-[28rem]">
                            <TasksWidget
                                tasks={safeTasks}
                                matters={safeMatters}
                                currentUser={currentUser}
                                onNavigateAndHighlight={onNavigateAndHighlight}
                                openModal={openModal}
                                isLoading={isLoading}
                            />
                        </div>

                        {/* Column 3: Calendar */}
                        <div className="lg:col-span-1 h-96 lg:h-[28rem]">
                            <CalendarWidget
                                events={[...(events || []), ...(!isLegal ? computeAtriumVirtualEvents(safeProperties) : [])]}
                                eventTypes={eventTypes || []}
                                onEventSelect={(eventId, date) => openModal('viewEvent', eventId, { openedFrom: 'dashboard', instanceDate: date })}
                                onViewFullCalendar={(date) => navigateTo('calendar', null, { date })}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                        <LockClosedIcon className="w-16 h-16 text-slate-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 dark:text-zinc-300">Data Hidden</h3>
                        <p className="max-w-md text-slate-500">Your dashboard data is currently hidden due to plan restrictions. It will reappear once you upgrade.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(Dashboard);
