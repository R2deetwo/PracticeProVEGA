/**
 * FirmHealth — per-firm health dashboard showing adoption, activity, churn risk.
 */

import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm overflow-hidden';
const LABEL = 'text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest';
const SECTION_TITLE = 'text-sm font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-3';

export const FirmHealth: React.FC = () => {
    const { currentUser } = useFounderAuth();
    const tokenIdentifier = currentUser?.email || '';
    const [firmId, setFirmId] = useState<string | null>(null);

    const firms = useQuery(api.founderMetrics.getAllFirmsForAdmin,
        tokenIdentifier ? { tokenIdentifier } : "skip");
    const health = useQuery(api.founderMetrics.getFirmHealthDetails,
        tokenIdentifier && firmId ? { tokenIdentifier, firmId } : "skip");

    const safeFirms = (firms as any[]) || [];
    const isFirmsLoading = firms === undefined;

    if (!firmId) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
                <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Firm Health</h2>
                    <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{isFirmsLoading ? 'Loading...' : 'Select a firm to view health metrics'}</p>
                </div>
                <div className="px-4 sm:px-6 lg:px-8 space-y-2">
                    {isFirmsLoading && (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
                        </div>
                    )}
                    {!isFirmsLoading && safeFirms.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No firms found.</p>}
                    {safeFirms.map((f: any) => (
                        <button key={f.id} onClick={() => setFirmId(f.id)} className={`${CARD} w-full text-left hover:border-primary-400 transition-colors`}>
                            <div className="flex items-center justify-between min-w-0">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{f.firmName}</p>
                                    <p className="text-xs text-slate-500 truncate">{f.product} · {f.plan} · {f.userCount} users</p>
                                </div>
                                <span className="text-xs font-bold text-primary-600 flex-shrink-0">View →</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (!health) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <div className="w-8 h-8 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    const h = health as any;
    const churnColor = h.churnRiskScore >= 60 ? 'text-red-600' : h.churnRiskScore >= 30 ? 'text-amber-600' : 'text-emerald-600';
    const churnBg = h.churnRiskScore >= 60 ? 'bg-red-50 dark:bg-red-900/20' : h.churnRiskScore >= 30 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20';

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
                <div className="flex items-center gap-3">
                    <button onClick={() => setFirmId(null)} className="text-xs font-bold text-slate-500 hover:text-primary-600 flex-shrink-0">← Back</button>
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">{h.firmName}</h2>
                </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 space-y-4">
                {/* Firm Overview — plan, product, joined date, total matters */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Firm Overview</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500">Plan</span><span className="font-bold text-slate-700 dark:text-zinc-200">{h.plan || '—'}</span></div>
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500">Product</span><span className="font-bold text-slate-700 dark:text-zinc-200">{h.product || '—'}</span></div>
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500">Total Matters</span><span className="font-bold text-slate-700 dark:text-zinc-200">{h.totalMatters ?? '—'}</span></div>
                        <div className="flex justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg"><span className="text-slate-500">Joined</span><span className="font-bold text-slate-700 dark:text-zinc-200">{h.joinedAt ? new Date(h.joinedAt).toLocaleDateString('en-GB') : '—'}</span></div>
                    </div>
                </div>

                {/* Churn Risk Score */}
                <div className={`${CARD} ${churnBg}`}>
                    <p className={LABEL}>Churn Risk Score</p>
                    <p className={`text-3xl font-black ${churnColor} mt-1`}>{h.churnRiskScore}/100</p>
                    <p className="text-xs text-slate-500 mt-1">{h.churnRiskScore >= 60 ? 'HIGH RISK' : h.churnRiskScore >= 30 ? 'MEDIUM RISK' : 'LOW RISK'}</p>
                </div>

                {/* Seats — corrected: null = unlimited, not 999999 */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>User Seats</p>
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{h.seatsUsed}</p>
                            <p className="text-2xs text-slate-400">Used</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                                {h.maxSeats == null ? '∞' : h.maxSeats}
                            </p>
                            <p className="text-2xs text-slate-400">Max</p>
                        </div>
                        {/* Usage percentage bar */}
                        {h.usagePercentages?.seats != null && (
                            <div className="flex-1">
                                <div className="flex justify-between text-2xs text-slate-400 mb-1">
                                    <span>Usage</span>
                                    <span className={h.usagePercentages.seats >= 100 ? 'text-red-500 font-bold' : h.usagePercentages.seats >= 80 ? 'text-amber-500 font-bold' : ''}>
                                        {h.usagePercentages.seats}%
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${
                                            h.usagePercentages.seats >= 100 ? 'bg-red-500' :
                                            h.usagePercentages.seats >= 80 ? 'bg-amber-500' :
                                            'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min(100, h.usagePercentages.seats)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-2xs text-slate-400 mt-2">
                        {h.maxSeats == null
                            ? 'Unlimited seats (Pro/Enterprise/Komplete tier)'
                            : `${h.plan} tier: ${h.maxSeats} seat${h.maxSeats !== 1 ? 's' : ''} max`}
                    </p>
                </div>

                {/* Usage Limits — shows tier limits vs. current usage with progress bars */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Usage Limits ({h.plan} · {h.product === 'property' ? 'Atrium' : h.product === 'unified' ? 'Komplete' : 'Vega'})</p>
                    <div className="space-y-3">
                        {/* Seats usage */}
                        <UsageBar
                            label="User Seats"
                            used={h.usage?.seatsUsed ?? h.seatsUsed}
                            max={h.tierLimits?.maxUsers ?? h.maxSeats}
                            percent={h.usagePercentages?.seats}
                        />

                        {/* Atrium: Property Units */}
                        {h.product === 'property' && (
                            <UsageBar
                                label="Property Units"
                                used={h.usage?.unitsUsed ?? 0}
                                max={h.tierLimits?.maxUnits ?? null}
                                percent={h.usagePercentages?.units}
                            />
                        )}

                        {/* Atrium: Managed Properties */}
                        {h.product === 'property' && (
                            <UsageBar
                                label="Managed Properties"
                                used={h.usage?.propertiesCount ?? 0}
                                max={h.tierLimits?.maxManagedProperties ?? null}
                                percent={h.usagePercentages?.units}
                            />
                        )}

                        {/* Atrium: Active Tenants */}
                        {h.product === 'property' && (
                            <UsageBar
                                label="Active Tenants"
                                used={h.usage?.tenantsCount ?? 0}
                                max={h.tierLimits?.maxActiveTenants ?? null}
                                percent={h.usagePercentages?.tenants}
                            />
                        )}

                        {/* Atrium: WhatsApp Limit */}
                        {h.product === 'property' && h.tierLimits?.whatsappLimit != null && (
                            <UsageBar
                                label="WhatsApp / month"
                                used={0}
                                max={h.tierLimits.whatsappLimit}
                                percent={null}
                            />
                        )}

                        {/* Vega: Active Matters */}
                        {h.product === 'legal' && (
                            <UsageBar
                                label="Active Matters"
                                used={h.usage?.activeMattersCount ?? 0}
                                max={h.tierLimits?.maxActiveMatters ?? null}
                                percent={h.usagePercentages?.matters}
                            />
                        )}

                        {/* Vega: Case File Storage */}
                        {h.product === 'legal' && h.tierLimits?.maxCaseFileStorageGb != null && (
                            <UsageBar
                                label="Case File Storage (GB)"
                                used={0}
                                max={h.tierLimits.maxCaseFileStorageGb}
                                percent={null}
                            />
                        )}
                    </div>
                </div>

                {/* Feature Adoption */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>Feature Adoption</p>
                    <div className="grid grid-cols-2 gap-3">
                        <AdoptionBadge label="E-Signature" used={h.featureAdoption.hasUsedEsign} />
                        <AdoptionBadge label="Voice Dictation" used={h.featureAdoption.hasUsedVoiceDictation} />
                        <AdoptionBadge label="DraftPro" used={h.featureAdoption.hasUsedDraftPro} />
                        <AdoptionBadge label="Research" used={h.featureAdoption.hasUsedResearch} />
                    </div>
                </div>

                {/* User Activity */}
                <div className={CARD}>
                    <p className={SECTION_TITLE}>User Activity ({h.userHealth.length})</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {h.userHealth.map((u: any) => (
                            <div key={u.userId} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-900 rounded-lg min-w-0">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{u.name}</p>
                                    <p className="text-2xs text-slate-400 truncate">{u.email} · {u.role}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className={`text-xs font-bold ${u.daysSinceLogin > 14 ? 'text-red-500' : u.daysSinceLogin > 7 ? 'text-amber-500' : 'text-emerald-500'}`}>{u.daysSinceLogin}d ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Activity Count */}
                <div className={CARD}>
                    <p className={LABEL}>Recent Activity (7 days)</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{h.recentActivityCount}</p>
                    <p className="text-xs text-slate-400 mt-1">events in the last week</p>
                </div>
            </div>
        </div>
    );
};

const AdoptionBadge: React.FC<{ label: string; used: boolean }> = ({ label, used }) => (
    <div className={`p-3 rounded-lg ${used ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-zinc-900'}`}>
        <p className={`text-xs font-bold ${used ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-2xs ${used ? 'text-emerald-500' : 'text-slate-400'}`}>{used ? '✓ Adopted' : 'Not yet adopted'}</p>
    </div>
);

// UsageBar — shows a metric (used / max) with a colored progress bar.
// max=null means unlimited — shows "Unlimited" with no bar.
// percent is pre-computed by the backend (null = unlimited).
// Color logic: green < 80%, amber 80-99%, red >= 100%.
const UsageBar: React.FC<{
    label: string;
    used: number;
    max: number | null;
    percent: number | null;
}> = ({ label, used, max, percent }) => {
    const isUnlimited = max === null || max === undefined;
    const pct = percent;
    const colorClass = pct == null ? 'bg-slate-300' :
                       pct >= 100 ? 'bg-red-500' :
                       pct >= 80 ? 'bg-amber-500' :
                       'bg-emerald-500';
    const textColor = pct == null ? 'text-slate-400' :
                      pct >= 100 ? 'text-red-500' :
                      pct >= 80 ? 'text-amber-500' :
                      'text-slate-600 dark:text-zinc-300';

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">{label}</span>
                <span className={`text-2xs font-bold ${textColor}`}>
                    {used}{isUnlimited ? '' : ` / ${max}`}
                    {pct != null && ` (${pct}%)`}
                </span>
            </div>
            {!isUnlimited && (
                <div className="h-1.5 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${colorClass}`}
                        style={{ width: `${Math.min(100, pct || 0)}%` }}
                    />
                </div>
            )}
            {isUnlimited && (
                <p className="text-2xs text-slate-400">Unlimited</p>
            )}
        </div>
    );
};
