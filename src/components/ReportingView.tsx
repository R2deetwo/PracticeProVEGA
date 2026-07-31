import React, { useState } from 'react';
/* Added AppMode to imports */
import { ReportDateRangeOption, TimesheetData, UtilizationData, MatterStatusReportData, ProfitLossData, ArAgingData, InvoiceStatus, AppMode, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { generateTimesheetReport, generateUtilizationReport, generateMatterStatusReport, generateProfitLossReport, generateArAgingReport } from '../services/reportGenerator';
import { parseDateString } from '../utils/calendarUtils';
import { useFeatures } from '../hooks/useFeatures';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useCoreState } from '../contexts/CoreContext';
import { LockClosedIcon } from '../constants';

import BusinessIntelligenceReports from './reports/BusinessIntelligenceReports';
import FinancialReports from './reports/FinancialReports';

type MainTab = 'dashboard' | 'generator';
type DashboardTab = 'bi' | 'financial';
type ReportType = 'timesheet' | 'utilization' | 'matter_status' | 'profit_loss' | 'ar_aging';

const ReportGenerator: React.FC = () => {
    const { currentUser, appMode } = useAuth();
    const { addToast } = useUI();
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { financeState } = useFinanceState();
    // Only include internal team members in reports — portal users (Tenant/Client) should never appear in timesheets or utilization reports
    const activeUsers = coreState.users.filter(u =>
        u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.ExternalCounsel && u.role !== UserRole.Pending
    );
    const [reportType, setReportType] = useState<ReportType>('timesheet');
    const [dateRange, setDateRange] = useState<ReportDateRangeOption>('last_30');
    const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = () => {
        setIsLoading(true);
        try {
            const { start, end } = getDateRange(dateRange);
            const timeEntriesInRange = financeState.timeEntries.filter(t => {
                const entryDate = parseDateString(t.date);
                return entryDate >= start && entryDate <= end;
            });
            const expensesInRange = financeState.expenses.filter(e => {
                const expenseDate = parseDateString(e.date);
                return expenseDate >= start && expenseDate <= end;
            });
            const paidInvoicesInRange = financeState.invoices.filter(i => {
                if (i.status !== 'Paid' || !i.paidDate) return false;
                const paidDate = parseDateString(i.paidDate);
                return paidDate >= start && paidDate <= end;
            });

            switch (reportType) {
                case 'timesheet': {
                    const user = activeUsers.find(u => u.id === selectedUserId);
                    if (!user) throw new Error("Selected user not found");

                    const data: TimesheetData = {
                        user: { id: user.id, name: user.name, role: user.role },
                        entries: timeEntriesInRange
                            .filter(t => {
                                const matter = matterState.matters.find(m => m.id === t.matterId);
                                return matter?.assignedUsers.includes(selectedUserId) ?? false;
                            })
                            .map(t => ({
                                date: t.date,
                                matterTitle: matterState.matters.find(m => m.id === t.matterId)?.title || 'N/A',
                                clientName: matterState.contacts.find(c => c.id === matterState.matters.find(m => m.id === t.matterId)?.clientId)?.name || 'N/A',
                                duration: t.duration,
                                description: t.description,
                            })),
                    };
                    generateTimesheetReport(data, coreState.firmDetails, dateRange);
                    break;
                }
                case 'utilization': {
                    const data: UtilizationData = {
                        users: activeUsers.map(user => {
                            const userEntries = timeEntriesInRange.filter(t => {
                                const matter = matterState.matters.find(m => m.id === t.matterId);
                                return matter?.assignedUsers.includes(user.id) ?? false;
                            });
                            const billableHours = userEntries.filter(t => t.billable).reduce((sum, t) => sum + t.duration, 0);
                            const totalHours = userEntries.reduce((sum, t) => sum + t.duration, 0);
                            return {
                                user: { id: user.id, name: user.name, role: user.role },
                                totalHours,
                                billableHours,
                                utilizationRate: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
                            };
                        }),
                    };
                    generateUtilizationReport(data, coreState.firmDetails, dateRange);
                    break;
                }
                case 'matter_status': {
                    const data: MatterStatusReportData = {
                        matters: matterState.matters.map(m => ({
                            title: m.title,
                            clientName: matterState.contacts.find(c => c.id === m.clientId)?.name || 'N/A',
                            status: m.status,
                            currentStage: m.stage,
                            assignedTeam: (m.assignedUsers || []).map(id => activeUsers.find(u => u.id === id)?.name).filter(Boolean).join(', '),
                        })),
                    };
                    generateMatterStatusReport(data, coreState.firmDetails);
                    break;
                }
                case 'profit_loss': {
                    const revenueItems = paidInvoicesInRange.map(i => ({ description: `Invoice ${i.invoiceNumber} - ${i.matter.title}`, amount: (i.lineItems || []).reduce((s, li) => s + li.total, 0) }));
                    const totalRevenue = revenueItems.reduce((sum, item) => sum + item.amount, 0);
                    const expenseItems = expensesInRange.map(e => ({ description: e.description, amount: e.amount }));
                    const totalExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);

                    const data: ProfitLossData = {
                        revenue: revenueItems,
                        expenses: expenseItems,
                        totalRevenue,
                        totalExpenses,
                        netProfit: totalRevenue - totalExpenses
                    };
                    generateProfitLossReport(data, coreState.firmDetails, dateRange);
                    break;
                }
                case 'ar_aging': {
                    const outstandingInvoices = financeState.invoices.filter(i => i.status === InvoiceStatus.Unpaid || i.status === InvoiceStatus.Overdue || i.status === InvoiceStatus.Sent);
                    const today = new Date();
                    const data: ArAgingData = {
                        buckets: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
                        total: 0,
                        entries: outstandingInvoices.map(i => {
                            const dueDate = parseDateString(i.dueDate);
                            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
                            const amount = (i.lineItems || []).reduce((s, li) => s + li.total, 0);

                            if (daysOverdue <= 30) data.buckets['0-30'] += amount;
                            else if (daysOverdue <= 60) data.buckets['31-60'] += amount;
                            else if (daysOverdue <= 90) data.buckets['61-90'] += amount;
                            else data.buckets['90+'] += amount;
                            data.total += amount;

                            return {
                                clientName: i.client.name,
                                invoiceNumber: i.invoiceNumber,
                                dueDate: i.dueDate,
                                daysOverdue: Math.max(0, daysOverdue),
                                amount: amount,
                            };
                        })
                    };
                    generateArAgingReport(data, coreState.firmDetails);
                    break;
                }
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            addToast("An error occurred while generating the report. Please check the console for details.", { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const getDateRange = (option: ReportDateRangeOption): { start: Date, end: Date } => {
        const end = new Date();
        const start = new Date();
        switch (option) {
            case 'last_30': start.setDate(end.getDate() - 30); break;
            case 'last_90': start.setDate(end.getDate() - 90); break;
            case 'this_year': start.setMonth(0); start.setDate(1); break;
            case 'all_time': start.setFullYear(2000); break;
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
            <h3 className="text-xl font-bold mb-4">Generate Report</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Report Type</label>
                    <select id="reportType" value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="w-full p-2 bg-gray-50 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md">
                        <optgroup label="Financial">
                            <option value="profit_loss">Profit & Loss</option>
                            <option value="ar_aging">A/R Aging</option>
                        </optgroup>
                        <optgroup label="Operational">
                            <option value="timesheet">Timesheet (Daynotes)</option>
                            <option value="utilization">Utilization Report</option>
                            <option value="matter_status">Matter Status</option>
                        </optgroup>
                    </select>
                </div>
                <div>
                    <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                    <select id="dateRange" value={dateRange} onChange={e => setDateRange(e.target.value as ReportDateRangeOption)} className="w-full p-2 bg-gray-50 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md" disabled={reportType === 'matter_status' || reportType === 'ar_aging'}>
                        <option value="last_30">Last 30 Days</option>
                        <option value="last_90">Last 90 Days</option>
                        <option value="this_year">This Year</option>
                        <option value="all_time">All Time</option>
                    </select>
                </div>
                {reportType === 'timesheet' && appMode === AppMode.Multi && (
                    <div>
                        <label htmlFor="userSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label>
                        <select id="userSelect" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md">
                            {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                )}
                <div className={reportType === 'timesheet' ? 'w-full' : 'w-full md:col-start-4'}>
                    <button onClick={handleGenerateReport} disabled={isLoading} className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-primary-400">
                        {isLoading ? 'Generating...' : 'Download PDF Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const ReportingView: React.FC = () => {
    const { currentHistoryEntry, navigateTo } = useUI();
    const context = currentHistoryEntry?.context || {};

    const [activeMainTab, setActiveMainTab] = useState<MainTab>(context.activeMainTab || 'dashboard');
    const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>(context.activeDashboardTab || 'financial');
    const { canUseAdvancedReporting, canUseReportGenerator } = useFeatures();

    React.useEffect(() => {
        if (context.activeMainTab) setActiveMainTab(context.activeMainTab);
        if (context.activeDashboardTab) setActiveDashboardTab(context.activeDashboardTab);
    }, [context.activeMainTab, context.activeDashboardTab]);

    const renderDashboardContent = () => {
        switch (activeDashboardTab) {
            case 'bi':
                if (!canUseAdvancedReporting) {
                    return (
                        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-12 flex flex-col items-center justify-center text-center border border-slate-200 dark:border-zinc-700 animate-fade-in">
                            <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                                <LockClosedIcon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Advanced Analytics Locked</h3>
                            <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-6">
                                Business Intelligence reports including Case Velocity, Utilization Rates, and Client Acquisition data are available on the Pro plan and above.
                            </p>
                            <button
                                onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-lg"
                            >
                                Upgrade to Pro
                            </button>
                        </div>
                    );
                }
                return <BusinessIntelligenceReports />;
            case 'financial': return <FinancialReports />;
            default: return null;
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Analytics</h2>
                <div className="p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg flex gap-1 border border-slate-200 dark:border-zinc-700">
                    <button
                        onClick={() => setActiveMainTab('dashboard')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeMainTab === 'dashboard' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveMainTab('generator')}
                        className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeMainTab === 'generator' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                    >
                        Report Generator
                    </button>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8">

                {activeMainTab === 'dashboard' && (
                    <div>
                        <div className="mb-6 border-b border-gray-200 dark:border-zinc-700">
                            <nav className="-mb-px flex space-x-6 overflow-x-auto">
                                {(['financial', 'bi'] as DashboardTab[]).map(tab => {
                                    const label = { bi: 'Business Intelligence', financial: 'Financial' }[tab];
                                    const isLocked = tab === 'bi' && !canUseAdvancedReporting;

                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveDashboardTab(tab)}
                                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 ${activeDashboardTab === tab ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {label}
                                            {isLocked && <LockClosedIcon className="w-3 h-3 text-slate-400" />}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                        {renderDashboardContent()}
                    </div>
                )}

                {activeMainTab === 'generator' && (
                    canUseReportGenerator ? (
                        <ReportGenerator />
                    ) : (
                        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-12 flex flex-col items-center justify-center text-center border border-slate-200 dark:border-zinc-700 animate-fade-in">
                            <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-4">
                                <LockClosedIcon className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Report Generator Locked</h3>
                            <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-6">
                                Generate professional PDF reports including Timesheets, P&L, A/R Aging, and Matter Status when you upgrade to Growth or above.
                            </p>
                            <button
                                onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                                className="px-6 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors shadow-lg"
                            >
                                Upgrade to Growth
                            </button>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default ReportingView;