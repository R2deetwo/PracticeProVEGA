import React from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';
import ProTip from '../ProTip';
import { useProduct } from '../../contexts/ProductContext';

interface ComplianceReportsProps {}

const ComplianceReports: React.FC<ComplianceReportsProps> = () => {
    const { coreState } = useCoreState();
    const { users } = coreState;
    const { currentUser } = useAuth();
    const { isProperty } = useProduct();

    // OWNER BRIEF 2026-11-25: the standalone Compliance nav item retired —
    // this report is the team-facing view of the firm's compliance tracking,
    // gated on the SAME firm toggle that gates each member's Professional
    // Standards card (Settings → Firm Details). Off (the default) shows an
    // honest explanation, never an empty-looking table.
    const complianceTrackingEnabled = !!(coreState.firmDetails as any)?.complianceTrackingEnabled;

    if (!complianceTrackingEnabled) {
        return (
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-2">Team Professional Standards</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Compliance & Professional Standards tracking is currently <span className="font-bold">off</span> for this workspace.
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2 leading-relaxed">
                    An admin can turn it on in Settings → Firm Details → Compliance &amp; Professional Standards. When on, each member fills their own
                    record (practicing fee, NBA status, CPD hours, Stamp &amp; Seal slot) in Settings → My Profile, and this report makes it visible to the team
                    for internal verification and trust.
                </p>
            </div>
        );
    }
    
    // Only show internal team members (Lawyers, Paralegals, External Counsel)
    // Portal users (Tenants, Clients) must never appear in compliance reports.
    // SIMPLIFY FIX: include Admin — a solo-admin firm (the default Vega user)
    // previously saw an empty compliance table even after filling their own
    // Practicing Fee / NBA / CPD details in My Profile.
    const INTERNAL_ROLES = [UserRole.Admin, UserRole.Lawyer, UserRole.Paralegal, UserRole.ExternalCounsel];
    const teamStandards = users.filter(u => INTERNAL_ROLES.includes(u.role)).map(user => ({
        ...user,
        ...(user.professionalStandards || {
            lastPracticingFeePaidYear: 0,
            nbaStampStatus: 'Pending' as const,
            completedCpdHours: 0,
            stampAndSealStatus: undefined as 'not_submitted' | 'submitted' | 'verified' | undefined,
        })
    }));

    return (
        <div className="space-y-6">
            <div className="mb-6">
                 <ProTip id="compliance_reporting_tip">
                   To update data on this report, visit the relevant sections. Professional Standards for team members can be updated by an Admin in 'Settings &gt; Firm Details', and you can update your own in 'Settings &gt; My Profile'.
                </ProTip>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-4">Team Professional Standards</h3>
                {teamStandards.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-slate-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">No team members with professional standards yet.</p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">{isProperty ? 'Add managers or staff to your practice' : 'Add lawyers or paralegals to your firm'} to start tracking compliance.</p>
                    </div>
                ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase">
                            <tr>
                                <th className="py-2 px-4">Team Member</th>
                                <th className="py-2 px-4">Last Practicing Fee</th>
                                <th className="py-2 px-4">NBA Status</th>
                                <th className="py-2 px-4">CPD Hours (Current Year)</th>
                                <th className="py-2 px-4">Stamp &amp; Seal</th>
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
                                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{user.stampAndSealStatus === 'verified' ? 'Verified' : user.stampAndSealStatus === 'submitted' ? 'Submitted' : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                )}
            </div>
        </div>
    );
};

export default ComplianceReports;