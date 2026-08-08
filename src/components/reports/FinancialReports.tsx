import React, { useState, useMemo } from 'react';
import { InvoiceStatus } from '../../types';
import { useMatterState } from '../../contexts/MatterContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useCoreState } from '../../contexts/CoreContext';
import { formatNaira, formatLargeNumber } from '../../utils/formatting';
import StatCard from '../StatCard';
import TaxDisclaimer from './TaxDisclaimer';
import NairaSymbol from '../NairaSymbol';
import ProTip from '../ProTip';
import { parseDateString } from '../../utils/calendarUtils';
import { ChartBarIcon, ClockIcon } from '../../constants';

// --- Icons ---
const TrendingUpIconStyled = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
const AlertIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;

type DateRangeOption = 'all_time' | 'this_year' | 'last_90' | 'last_30';

const RevenueVelocityChart: React.FC<{ data: { month: string; value: number }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1000);

    return (
        <div className="h-64 flex gap-2 sm:gap-4 pt-8 pb-2">
            {data.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative h-full">
                    <div className="relative w-full bg-slate-100 dark:bg-zinc-700/50 rounded-t-lg flex items-end overflow-hidden flex-grow">
                        <div
                            className="w-full bg-primary-500 dark:bg-primary-600 group-hover:bg-primary-400 transition-all duration-700 ease-out rounded-t-lg relative"
                            style={{ height: `${(item.value / maxValue) * 100}%` }}
                        >
                            {/* Shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-2xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-lg pointer-events-none">
                        <NairaSymbol />{formatLargeNumber(item.value)}
                    </div>
                    <span className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 font-medium truncate w-full text-center">{item.month}</span>
                </div>
            ))}
        </div>
    );
};

const TargetTracker: React.FC<{ current: number, target: number }> = ({ current, target }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const remaining = Math.max(target - current, 0);

    return (
        <div className="bg-slate-50 dark:bg-zinc-700/30 rounded-lg p-6 border border-slate-100 dark:border-zinc-700/50 relative overflow-hidden">
            {percentage >= 100 && <div className="absolute top-0 right-0 p-2"><span className="text-2xl">🎉</span></div>}
            <div className="flex justify-between items-end mb-2 relative z-10">
                <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Monthly Revenue Goal</h4>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(current)}</span>
                        <span className="text-sm text-slate-400">/ <NairaSymbol />{formatLargeNumber(target)}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-2xl font-bold ${percentage >= 100 ? 'text-green-600' : 'text-primary-600'}`}>{Math.round(percentage)}%</span>
                </div>
            </div>

            <div className="h-3 w-full bg-slate-200 dark:bg-zinc-600 rounded-full overflow-hidden relative z-10">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${percentage >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                    style={{ width: `${percentage}%` }}
                >
                    {/* Animated stripes */}
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress-stripes_1s_linear_infinite] opacity-30"></div>
                </div>
            </div>

            <p className="text-xs text-slate-500 mt-2 text-right relative z-10">
                {remaining > 0 ? <><NairaSymbol />{formatNaira(remaining)} to go</> : 'Target Hit! Excellent work.'}
            </p>
        </div>
    );
};

const BarChart: React.FC<{ data: { label: string; value: number }[]; color: string }> = ({ data, color }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-3">
            {data.map(item => (
                <div key={item.label} className="flex items-center gap-3 text-sm group">
                    <span className="w-24 text-right truncate text-slate-500 dark:text-zinc-400 font-medium">{item.label}</span>
                    <div className="flex-grow bg-slate-100 dark:bg-zinc-700/50 rounded-full h-5 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${color} transition-all duration-1000 ease-out relative group-hover:opacity-90`}
                            style={{ width: `${(item.value / maxValue) * 100}%` }}
                        >
                            {item.value > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-3xs text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity"><NairaSymbol />{formatLargeNumber(item.value)}</span>}
                        </div>
                    </div>
                    <span className="font-bold w-28 text-left text-slate-700 dark:text-slate-300"><NairaSymbol />{formatNaira(item.value)}</span>
                </div>
            ))}
        </div>
    );
};

interface FinancialReportsProps {}

const FinancialReports: React.FC<FinancialReportsProps> = () => {
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { financeState } = useFinanceState();
    const { coreState } = useCoreState();

    const financialSummary = useMemo(() => {
        const { invoices, expenses, timeEntries } = financeState;
        const { firmDetails } = coreState;
        const { matters } = matterState;

        const totalRevenue = invoices
            .filter(i => i.status === InvoiceStatus.Paid)
            .reduce((sum, i) => sum + (i.lineItems?.reduce((s, li) => s + li.total, 0) || 0), 0);

        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        const outstandingInvoices = invoices.filter(i => i.status === InvoiceStatus.Unpaid || i.status === InvoiceStatus.Overdue || i.status === InvoiceStatus.Sent);
        const today = new Date();
        const arAging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
        const overdueInvoicesList: { id: string, number: string, client: string, amount: number, days: number }[] = [];

        outstandingInvoices.forEach(i => {
            const dueDate = parseDateString(i.dueDate);
            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
            const amount = i.lineItems?.reduce((s, li) => s + li.total, 0) || 0;
            const daysPos = Math.max(0, daysOverdue);

            if (daysPos <= 30) arAging['0-30'] += amount;
            else if (daysPos <= 60) arAging['31-60'] += amount;
            else if (daysPos <= 90) arAging['61-90'] += amount;
            else arAging['90+'] += amount;

            if (daysPos > 0) {
                overdueInvoicesList.push({ id: i.id, number: i.invoiceNumber, client: i.client?.name || 'N/A', amount, days: daysPos });
            }
        });

        // Revenue Forecasting
        // 1. Unbilled Time
        const unbilledTimeValue = timeEntries
            .filter(t => t.billable && !t.billedInInvoiceId)
            .reduce((sum, t) => sum + (t.duration * t.rate), 0);

        // 2. Unbilled Expenses
        const unbilledExpensesValue = expenses
            .filter(e => e.isBillable && !e.billedInInvoiceId)
            .reduce((sum, e) => sum + e.amount, 0);

        // 3. Active Fixed Fee Matters (Simplified: Assume 50% recognized if active)
        const potentialFixedFees = matters
            .filter(m => m.billingModel === 'Fixed Fee' && m.status === 'Active' && m.fixedFeeAmount)
            .reduce((sum, m) => sum + (m.fixedFeeAmount || 0), 0);

        const forecastTotal = unbilledTimeValue + unbilledExpensesValue + (potentialFixedFees * 0.5); // Conservative estimate

        // Velocity Data (Last 6 months)
        const velocityData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthName = d.toLocaleString('default', { month: 'short' });
            const year = d.getFullYear();

            const monthlyTotal = invoices
                .filter(inv => {
                    // Include all billed amounts (Sent, Paid, Overdue)
                    if (inv.status === InvoiceStatus.Draft || inv.status === InvoiceStatus.Void) return false;

                    const invDate = parseDateString(inv.issueDate);
                    return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === year;
                })
                .reduce((sum, inv) => sum + (inv.lineItems?.reduce((s, li) => s + li.total, 0) || 0), 0);

            velocityData.push({ month: monthName, value: monthlyTotal });
        }

        // Current Month Revenue for Target
        const currentMonthRevenue = velocityData[velocityData.length - 1].value;

        return {
            totalBilled: invoices.reduce((sum, i) => sum + (i.lineItems?.reduce((s, li) => s + li.total, 0) || 0), 0),
            totalPaid: totalRevenue,
            outstanding: outstandingInvoices.reduce((sum, i) => sum + (i.lineItems?.reduce((s, li) => s + li.total, 0) || 0), 0),
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            arAging,
            overdueInvoicesList: overdueInvoicesList.sort((a, b) => b.days - a.days).slice(0, 5), // Top 5 worst offenders
            velocityData,
            currentMonthRevenue,
            monthlyTarget: firmDetails.monthlyRevenueTarget || 5000000,
            forecast: {
                unbilledTime: unbilledTimeValue,
                unbilledExpenses: unbilledExpensesValue,
                potentialFixed: potentialFixedFees * 0.5,
                total: forecastTotal
            }
        };
    }, [financeState, coreState, matterState, executionState]);

    const arAgingChartData = [
        { label: 'Current (0-30)', value: financialSummary.arAging['0-30'] },
        { label: '31-60 Days', value: financialSummary.arAging['31-60'] },
        { label: '61-90 Days', value: financialSummary.arAging['61-90'] },
        { label: '90+ Days', value: financialSummary.arAging['90+'] },
    ];

    const forecastChartData = [
        { label: 'Unbilled Time', value: financialSummary.forecast.unbilledTime },
        { label: 'Disbursements', value: financialSummary.forecast.unbilledExpenses },
        { label: 'Fixed Fees (Est)', value: financialSummary.forecast.potentialFixed },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="mb-6">
                <ProTip id="financial_reporting_tip">
                    The Financial Command Center gives you a real-time pulse on your firm's economic health. Use the Revenue Forecast to predict cash flow for the coming month based on work-in-progress.
                </ProTip>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Velocity Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                            <ChartBarIcon className="w-5 h-5 text-primary-500" /> Revenue Velocity (6 Months)
                        </h3>
                    </div>
                    <RevenueVelocityChart data={financialSummary.velocityData} />
                </div>

                {/* Target Tracker & Quick Stats */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <TargetTracker current={financialSummary.currentMonthRevenue} target={financialSummary.monthlyTarget} />

                    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-zinc-700 flex-grow">
                        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Profitability</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-700">
                                <span className="text-sm text-slate-500 dark:text-zinc-400">Total Billed</span>
                                <span className="font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatLargeNumber(financialSummary.totalBilled)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-700">
                                <span className="text-sm text-slate-500 dark:text-zinc-400">Total Expenses</span>
                                <span className="font-bold text-red-600"><NairaSymbol />{formatLargeNumber(financialSummary.totalExpenses)}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-zinc-700">
                                <span className="text-sm text-slate-500 dark:text-zinc-400">Net Profit Margin</span>
                                <span className="font-bold text-green-600">{financialSummary.totalBilled > 0 ? Math.round((financialSummary.netProfit / financialSummary.totalBilled) * 100) : 0}%</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm text-slate-500 dark:text-zinc-400">Collection Rate</span>
                                <span className="font-bold text-blue-600">{financialSummary.totalBilled > 0 ? Math.round((financialSummary.totalPaid / financialSummary.totalBilled) * 100) : 0}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Forecast */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <TrendingUpIconStyled />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Revenue Forecast (Pipeline)</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">Estimated incoming revenue from WIP.</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1"><NairaSymbol />{formatNaira(financialSummary.forecast.total)}</p>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Projected Total</p>
                    </div>

                    <BarChart data={forecastChartData} color="bg-purple-500" />
                </div>

                {/* A/R Aging Chart */}
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                            <ClockIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">A/R Aging Analysis</h3>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">Breakdown of outstanding invoices by age.</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1"><NairaSymbol />{formatNaira(financialSummary.outstanding)}</p>
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Total Outstanding</p>
                    </div>

                    <BarChart data={arAgingChartData} color="bg-orange-500" />
                </div>
            </div>

            {/* A/R Deep Dive Table */}
            {financialSummary.overdueInvoicesList.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertIcon />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Top Overdue Invoices</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase bg-slate-50 dark:bg-zinc-900/50">
                                <tr>
                                    <th className="py-3 px-4 rounded-l-lg">Client</th>
                                    <th className="py-3 px-4">Invoice #</th>
                                    <th className="py-3 px-4 text-right">Amount</th>
                                    <th className="py-3 px-4 text-right rounded-r-lg">Days Overdue</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                                {financialSummary.overdueInvoicesList.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors group">
                                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">{item.client}</td>
                                        <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{item.number}</td>
                                        <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-200"><NairaSymbol />{formatNaira(item.amount)}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${item.days > 90 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'}`}>
                                                {item.days} Days
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tax Intelligence Removed as per user request */}
        </div>
    );
};

export default FinancialReports;
