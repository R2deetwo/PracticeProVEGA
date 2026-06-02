import React, { useState, useMemo } from 'react';
import { Contact, InvoiceStatus } from '../../types';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import StatCard from '../StatCard';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';
import ProTip from '../ProTip';
import { ContactsIcon } from '../../constants';
import Tooltip from '../Tooltip';

type DateRangeOption = 'all_time' | 'this_year' | 'last_90' | 'last_30';
type SortKey = 'name' | 'totalMatters' | 'activeMatters' | 'totalBilled' | 'outstanding';

const BarChart: React.FC<{ data: { label: string; value: number }[]; color: string }> = ({ data, color }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-2">
            {data.map(item => {
                const fullValueText = `₦${formatNaira(item.value)}`;
                return (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                        <span className="w-32 text-right truncate text-slate-500 dark:text-zinc-400" title={item.label}>{item.label}</span>
                        <div className="flex-grow bg-slate-200 dark:bg-zinc-700 rounded-full h-4">
                            <Tooltip text={fullValueText}>
                                <div
                                    className={`h-4 rounded-full ${color} flex items-center justify-end pr-2 text-white text-[10px] font-bold overflow-hidden whitespace-nowrap`}
                                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                                >
                                    <NairaSymbol/>{formatNaira(item.value)}
                                </div>
                            </Tooltip>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

interface ClientReportsProps {}

interface ClientReportData extends Contact {
    totalMatters: number;
    activeMatters: number;
    totalBilled: number;
    outstanding: number;
}

const ClientReports: React.FC<ClientReportsProps> = () => {
    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('all_time');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'totalBilled', direction: 'desc' });
    
    const { kpis, chartData, tableData } = useMemo(() => {
        const { matters, contacts } = matterState;
        const { invoices } = financeState;
        
        const clientContacts = contacts.filter(c => c.category === 'Client');
        const clientData = new Map<string, ClientReportData>(clientContacts.map(c => [c.id, {
            ...c, totalMatters: 0, activeMatters: 0, totalBilled: 0, outstanding: 0
        }]));

        matters.forEach(matter => {
            const client = clientData.get(matter.clientId);
            if(client) {
                client.totalMatters += 1;
                if(matter.status === 'Active') client.activeMatters += 1;
            }
        });
        
        invoices.forEach(invoice => {
            const client = clientData.get(invoice.client.id);
            if(client) {
                const invoiceTotal = invoice.lineItems.reduce((sum, li) => sum + li.total, 0);
                client.totalBilled += invoiceTotal;
                if(invoice.status !== InvoiceStatus.Paid) {
                    client.outstanding += invoiceTotal;
                }
            }
        });

        const tableData: ClientReportData[] = Array.from(clientData.values());

        // KPIs
        const activeClients = tableData.filter(c => c.activeMatters > 0).length;
        const totalBilled = tableData.reduce((sum, c) => sum + c.totalBilled, 0);
        const clientsWithBilling = tableData.filter(c => c.totalBilled > 0);
        const avgBilled = clientsWithBilling.length > 0 ? totalBilled / clientsWithBilling.length : 0;
        const topClient = [...clientsWithBilling].sort((a,b) => b.totalBilled - a.totalBilled)[0];

        // Chart Data
        const revenueByClientChartData = [...clientsWithBilling]
            .sort((a,b) => b.totalBilled - a.totalBilled)
            .slice(0, 10)
            .map(c => ({ label: c.name, value: c.totalBilled }));

        // Sorting Table
        tableData.sort((a, b) => {
            const { key, direction } = sortConfig;
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return {
            kpis: {
                activeClients, totalBilled, avgBilled, topClient
            },
            chartData: {
                revenueByClient: revenueByClientChartData
            },
            tableData
        };
    }, [matterState, financeState, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="space-y-6">
             <div className="mb-6">
                <ProTip id="client_reporting_tip">
                   This report helps you understand your client portfolio. Identify your most valuable clients, see who has outstanding balances, and analyze revenue concentration.
                </ProTip>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Active Clients" value={kpis.activeClients} icon={<ContactsIcon />} colorClass="text-primary-500" />
                <StatCard title="Avg. Billed Per Client" value={<><NairaSymbol/>{formatNaira(kpis.avgBilled)}</>} icon={<div/>} colorClass="text-blue-500" />
                <StatCard title="Total Billed" value={<><NairaSymbol/>{formatNaira(kpis.totalBilled)}</>} icon={<div/>} colorClass="text-green-500" />
                <StatCard title="Top Client" value={kpis.topClient?.name || 'N/A'} icon={<div/>} colorClass="text-purple-500" />
            </div>
             <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-4">Revenue by Client (Top 10)</h3>
                <BarChart data={chartData.revenueByClient} color="bg-primary-500" />
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-4">All Clients</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase">
                           <tr>
                                {(['name', 'totalMatters', 'activeMatters', 'totalBilled', 'outstanding'] as SortKey[]).map(key => (
                                    <th key={key} onClick={() => requestSort(key as SortKey)} className="py-2 px-4 cursor-pointer">
                                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                        {sortConfig.key === key && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                            {tableData.map(client => (
                                <tr key={client.id}>
                                    <td className="py-3 px-4 font-medium">{client.name}</td>
                                    <td className="py-3 px-4 text-center">{client.totalMatters}</td>
                                    <td className="py-3 px-4 text-center">{client.activeMatters}</td>
                                    <td className="py-3 px-4 text-right"><NairaSymbol/>{formatNaira(client.totalBilled)}</td>
                                    <td className="py-3 px-4 text-right"><NairaSymbol/>{formatNaira(client.outstanding)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ClientReports;