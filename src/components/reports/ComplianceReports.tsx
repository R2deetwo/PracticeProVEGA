import React from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';
import ProTip from '../ProTip';

interface ComplianceReportsProps {}

const ComplianceReports: React.FC<ComplianceReportsProps> = () => {
    const { coreState } = useCoreState();
    const { users } = coreState;
    const { currentUser } = useAuth();
    
    const teamStandards = users.filter(u => u.role !== 'Admin').map(user => ({
        ...user,
        ...(user.professionalStandards || {
            lastPracticingFeePaidYear: 0,
            nbaStampStatus: 'Pending',
            completedCpdHours: 0
        })
    }));

    return (
        <div className="space-y-6">
            <div className="mb-6">
                 <ProTip id="compliance_reporting_tip">
                   To update data on this report, visit the relevant sections. Professional Standards for team members can be updated by an Admin in 'Settings &gt; Firm Settings', and you can update your own in 'Settings &gt; My Profile'.
                </ProTip>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-4">Team Professional Standards</h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase">
                            <tr>
                                <th className="py-2 px-4">Team Member</th>
                                <th className="py-2 px-4">Last Practicing Fee</th>
                                <th className="py-2 px-4">NBA Stamp</th>
                                <th className="py-2 px-4">CPD Hours (Current Year)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                            {teamStandards.map(user => {
                                const isFeePaid = user.lastPracticingFeePaidYear === new Date().getFullYear();
                                return (
                                    <tr key={user.id}>
                                        <td className="py-3 px-4 font-medium flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs ${getUserColor(user.id)}`}>
                                                {getInitials(user.name)}
                                            </div>
                                            {user.name}
                                        </td>
                                        <td className={`py-3 px-4 ${!isFeePaid ? 'text-red-500 font-semibold' : ''}`}>{user.lastPracticingFeePaidYear}</td>
                                        <td className={`py-3 px-4 ${user.nbaStampStatus === 'Pending' ? 'text-yellow-600 font-semibold' : ''}`}>{user.nbaStampStatus}</td>
                                        <td className={`py-3 px-4 ${user.completedCpdHours < 16 ? 'text-yellow-600 font-semibold' : ''}`}>{user.completedCpdHours} / 16</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ComplianceReports;