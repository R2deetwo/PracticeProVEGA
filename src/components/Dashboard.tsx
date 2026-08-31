
import React, { useMemo, useState, useEffect } from 'react';
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
import BroadcastBanner from './BroadcastBanner';
import CompleteSetupBanner from './CompleteSetupBanner';
import ErrorBoundary from './ErrorBoundary';
// CRO AUDIT Track B — B8: trial nudge engine (in-app milestone banners).
import TrialNudgeBanner from './TrialNudgeBanner';



// CRO AUDIT Track C — C3: First-run welcome banner + auto-open create modal.
// Shown only on the very first dashboard load (when the user has zero matters
// AND zero properties). Dismissible with one click; auto-dismisses after 30s.
const FirstRunWelcome: React.FC<{
  firstName: string;
  productName: 'Vega' | 'Atrium' | 'Komplete' | string;
  hasRecords: boolean;
  onCreateFirst: () => void;
  onDismiss: () => void;
}> = ({ firstName, productName, hasRecords, onCreateFirst, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || hasRecords) return null;

  const cta = productName === 'Atrium' ? '+ Add Your First Property'
            : productName === 'Vega' ? '+ Create Your First Matter'
            : '+ Create Your First Record';

  return (
    <div className="bg-gradient-to-r from-primary-50 via-white to-primary-50 dark:from-primary-900/20 dark:via-zinc-800 dark:to-primary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6 animate-fade-in shadow-lg shadow-primary-500/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-black">
              {firstName?.[0]?.toUpperCase() || 'P'}
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-primary-600 dark:text-primary-400">Welcome to {productName}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
            Welcome, {firstName}! Here's how to get started in 60 seconds:
          </h3>
          <ol className="space-y-1.5 text-sm text-slate-600 dark:text-zinc-300">
            {productName === 'Atrium' ? (
              <>
                <li><span className="font-bold text-primary-600">1.</span> Add your first property (name, address, units).</li>
                <li><span className="font-bold text-primary-600">2.</span> Add a tenant and link them to a unit.</li>
                <li><span className="font-bold text-primary-600">3.</span> Record your first rent payment — done!</li>
              </>
            ) : productName === 'Vega' ? (
              <>
                <li><span className="font-bold text-primary-600">1.</span> Create your first matter (client + matter type).</li>
                <li><span className="font-bold text-primary-600">2.</span> Add a task with a due date to track deadlines.</li>
                <li><span className="font-bold text-primary-600">3.</span> Log your first time entry — done!</li>
              </>
            ) : (
              <>
                <li><span className="font-bold text-primary-600">1.</span> Add your first property OR create your first matter.</li>
                <li><span className="font-bold text-primary-600">2.</span> Link them together to see the Komplete bridge in action.</li>
                <li><span className="font-bold text-primary-600">3.</span> Invite a teammate — done!</li>
              </>
            )}
          </ol>
        </div>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors flex-shrink-0"
          aria-label="Dismiss welcome"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        onClick={() => { onCreateFirst(); onDismiss(); }}
        className="mt-4 w-full sm:w-auto px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-primary-600/20 transition-all hover:-translate-y-0.5 active:scale-95"
      >
        {cta}
      </button>
    </div>
  );
};


const TierAccessBanner: React.FC<{ plan: SubscriptionPlan, onUpgrade: () => void }> = ({ plan, onUpgrade }) => (
    <div className="bg-slate-100 dark:bg-zinc-800 border-l-4 border-slate-500 rounded-r-lg p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
        <div className="flex gap-3 min-w-0">
            <div className="p-2 bg-slate-200 dark:bg-zinc-700 rounded-full h-fit mt-0 sm:mt-1 flex-shrink-0">
                <LockClosedIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
            </div>
            <div className="min-w-0">
                <h4 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base">Team Access Paused</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    Your firm has moved to the <strong>{plan}</strong> plan. Upgrade to <strong>Pro</strong> to restore full team collaboration.
                </p>
            </div>
        </div>
        <button
            onClick={onUpgrade}
            className="active-press touch-target whitespace-nowrap px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg flex-shrink-0"
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
    const { isLegal, isUnified, hasPropertyFeatures } = useProduct();
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
    // Occupancy rate: percentage of properties that are occupied
    const occupancyRate = safeProperties.length > 0
        ? Math.round((activeLeasesCount / safeProperties.length) * 100)
        : 0;

    const handleUpgrade = () => {
        navigateTo('settings', null, { settingsTargetId: 'subscription-management' });
    };

    // CRO AUDIT Track C — C3: First-run detection + auto-open create modal.
    // If the user has zero matters AND zero properties, show the welcome banner
    // AND auto-open the appropriate "create" modal ONCE per session.
    // The flag is stored in sessionStorage so it doesn't re-fire on every dashboard
    // re-render within the same session.
    const hasAnyRecords = safeMatters.length > 0 || safeProperties.length > 0;
    const productNameStr = hasPropertyFeatures && !isLegal ? 'Atrium'
                         : isLegal && !hasPropertyFeatures ? 'Vega'
                         : isUnified ? 'Komplete'
                         : (firmDetails?.product === 'property' ? 'Atrium' : 'Vega');
    const [welcomeDismissed, setWelcomeDismissed] = useState(false);

    useEffect(() => {
        // Only auto-open the create modal if:
        //   1. Data is loaded (not still fetching)
        //   2. User has zero records (first run)
        //   3. We haven't already auto-opened in this session
        if (isDataLoaded && !hasAnyRecords && !sessionStorage.getItem('practicepro_autoopen_create')) {
            sessionStorage.setItem('practicepro_autoopen_create', '1');
            // Small delay to let the dashboard settle
            const t = setTimeout(() => {
                if (hasPropertyFeatures && !isLegal) {
                    openModal('newProperty');
                } else {
                    openModal('newMatter');
                }
            }, 800);
            return () => clearTimeout(t);
        }
    }, [isDataLoaded, hasAnyRecords, hasPropertyFeatures, isLegal, openModal]);

    if (!currentUser) return null; // Avoid crash before auth is ready

    return (
        <div className="h-full overflow-y-auto custom-scrollbar scroll-smooth-ios bg-slate-50 dark:bg-zinc-900">
            <header className="sticky top-0 z-30 glass py-3 sm:py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0 pt-safe">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">Overview</h2>
                    <p className="text-2xs sm:text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                        Good day, {currentUser.name?.split(' ')[0] || 'User'}.
                    </p>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 animate-fade-in pb-24 md:pb-8">
                {/* Downgrade Banner */}
                {isDowngradedState && <TierAccessBanner plan={plan} onUpgrade={handleUpgrade} />}

                {/* CRO AUDIT Track C — C3: First-run welcome banner */}
                {!welcomeDismissed && (
                  <FirstRunWelcome
                    firstName={currentUser.name?.split(' ')[0] || 'User'}
                    productName={productNameStr}
                    hasRecords={hasAnyRecords}
                    onCreateFirst={() => {
                      if (hasPropertyFeatures && !isLegal) openModal('newProperty');
                      else openModal('newMatter');
                    }}
                    onDismiss={() => setWelcomeDismissed(true)}
                  />
                )}

                {/* Broadcast Banner — glassmorphic, in-content placement.
                    Sits below Overview header, above the operational grid.
                    Never overlaps the left sidebar or top navigation.
                    HOTFIX 2026-08-31: contained in a local ErrorBoundary with
                    fallback={null} — a failing broadcasts query (backend
                    error) must NEVER take down the whole Dashboard again. */}
                <ErrorBoundary fallback={null}>
                    <BroadcastBanner />
                </ErrorBoundary>

                {/* Complete Setup Banner — drives users to finish their onboarding
                    checklist. Renders only when checklist has incomplete items and
                    the user hasn't dismissed it. Higher-contrast than the sidebar
                    checklist widget so it catches attention on first dashboard load. */}
                <CompleteSetupBanner />

                {/* CRO AUDIT Track B — B8: trial nudge engine (in-app milestone banners).
                    Shows contextual value-driven messages on Days 0, 1, 3, 5, 7, 10, 13.
                    Dismissible per-day via localStorage. */}
                <TrialNudgeBanner />

                <div className="grid grid-cols-1 gap-4 sm:gap-8">
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
                <div className="flex-shrink-0">
                    <StatsWidget
                        activeMattersCount={isDowngradedState ? 0 : activeMattersCount}
                        overdueTasksCount={isDowngradedState ? 0 : overdueTasksCount}
                        outstandingRevenue={isDowngradedState ? 0 : outstandingRevenue}
                        contactsCount={isDowngradedState ? 0 : safeContacts.length}
                        propertyCount={isDowngradedState ? 0 : propertyCount}
                        propertyRevenue={isDowngradedState ? 0 : outstandingRentLedger}
                        activeLeasesCount={isDowngradedState ? 0 : activeLeasesCount}
                        occupancyRate={isDowngradedState ? 0 : occupancyRate}
                        navigateTo={navigateTo}
                        isLoading={isLoading}
                        currentUser={currentUser}
                    />
                </div>

                {/* Main Content Grid */}
                {!isDowngradedState ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 pb-20 md:pb-4">
                        {/* Column 1: Recent Matters / Properties */}
                        <div className="lg:col-span-1 h-auto min-h-[20rem] sm:min-h-[24rem] lg:h-[28rem] flex flex-col gap-2">
                            {isUnified && (
                                <div className="flex border border-slate-200/60 dark:border-zinc-700/60 bg-white dark:bg-zinc-800 rounded-lg p-1 shadow-sm flex-shrink-0">
                                    <button
                                        onClick={() => setActiveUnifiedTab('matters')}
                                        className={`active-press flex-1 text-center py-2 px-2 sm:px-4 rounded-lg text-2xs sm:text-xs font-bold transition-all ${
                                            activeUnifiedTab === 'matters'
                                                ? 'bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-white shadow-inner'
                                                : 'text-slate-500 dark:text-zinc-400'
                                        }`}
                                    >
                                        Legal Matters
                                    </button>
                                    <button
                                        onClick={() => setActiveUnifiedTab('properties')}
                                        className={`active-press flex-1 text-center py-2 px-2 sm:px-4 rounded-lg text-2xs sm:text-xs font-bold transition-all ${
                                            activeUnifiedTab === 'properties'
                                                ? 'bg-slate-100 dark:bg-zinc-700 text-slate-800 dark:text-white shadow-inner'
                                                : 'text-slate-500 dark:text-zinc-400'
                                        }`}
                                    >
                                        Real Estate
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
                        <div className="lg:col-span-1 h-auto min-h-[20rem] sm:min-h-[24rem] lg:h-[28rem]">
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
                        <div className="lg:col-span-1 h-80 sm:h-96 lg:h-[28rem]">
                            <CalendarWidget
                                events={[...(events || []), ...(hasPropertyFeatures ? computeAtriumVirtualEvents(safeProperties) : [])]}
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
