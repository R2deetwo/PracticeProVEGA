/**
 * AloaUsageCenter — Founder view showing privacy-safe ALOA/AI usage analytics.
 *
 * Shows:
 * - Platform-wide AI message counts (today/7d/30d)
 * - Error rate across the platform
 * - Active AI firms (used ALOA in last 7 days)
 * - Tool action distribution (what lawyers actually do with AI)
 * - Model distribution (which Gemini models are used)
 * - Per-firm leaderboard (top 50 firms by usage)
 *
 * PRIVACY: This view shows AGGREGATE COUNTS ONLY. No message content,
 * tool results, or error details are ever displayed. The founder can see
 * HOW MUCH AI is being used, not WHAT is being said.
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useFounderAuth, useFounderToast } from '../FounderContexts';

const CARD = 'bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 p-5 shadow-sm';

const AloaUsageCenter: React.FC = () => {
  const { currentUser } = useFounderAuth();
  const tokenIdentifier = currentUser?.email || currentUser?.tokenIdentifier || '';
  const [activeTab, setActiveTab] = useState<'overview' | 'firms' | 'tools'>('overview');
  const [queryError, setQueryError] = useState<string | null>(null);

  // useQuery MUST be called unconditionally (Rules of Hooks).
  // Do NOT wrap in try/catch — Convex useQuery never throws synchronously.
  // If the backend query throws (e.g. auth failure), useQuery returns
  // undefined forever and we show a loading state. To handle errors
  // gracefully, we use a timeout to detect "stuck loading" and show
  // an error message instead of spinning forever.
  const stats = useQuery(api.founderMetrics.getAloaUsageStats,
    tokenIdentifier ? { tokenIdentifier } : 'skip');

  // Detect stuck loading — if stats is still undefined after 8 seconds,
  // the query likely threw an error on the backend (e.g. requireFounder
  // failed). Show an error message instead of spinning forever.
  useEffect(() => {
    if (stats === undefined && !queryError) {
      const timer = setTimeout(() => {
        setQueryError('Query timed out. You may not have founder permissions, or the backend needs to be deployed.');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [stats, queryError]);

  const isLoading = stats === undefined && !queryError;
  const hasError = queryError !== null || stats === null;
  const errorMessage = queryError || 'Failed to load AI usage data. The backend may need to be deployed.';
  const data = stats as any || { platform: {}, toolActionDistribution: [], modelDistribution: [], perFirm: [] };
  const platform: any = data?.platform || {};
  const toolActions: any[] = data?.toolActionDistribution || [];
  const models: any[] = data?.modelDistribution || [];
  const perFirm: any[] = data?.perFirm || [];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-20">
      {/* Header */}
      <div style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">AI Usage Center</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Privacy-safe aggregate analytics — counts only, no message content
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-slate-400">Loading AI usage data...</div>
          </div>
        ) : hasError ? (
          <div className={CARD}>
            <p className="text-sm text-rose-500">{errorMessage}</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['overview', 'firms', 'tools'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                  }`}
                >
                  {tab === 'firms' ? 'Top Firms' : tab}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className={CARD}>
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Messages Today</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {platform.messagesToday || 0}
                    </p>
                  </div>
                  <div className={CARD}>
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Messages (7d)</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {platform.messages7d || 0}
                    </p>
                  </div>
                  <div className={CARD}>
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Active AI Firms</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {platform.activeAiFirms || 0}
                      <span className="text-sm text-slate-400 font-medium ml-1">/ {platform.totalAiFirms || 0}</span>
                    </p>
                  </div>
                  <div className={CARD}>
                    <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Error Rate</p>
                    <p className={`text-3xl font-black mt-1 ${
                      (platform.errorRate || 0) > 5 ? 'text-rose-500' : 'text-emerald-500'
                    }`}>
                      {platform.errorRate || 0}%
                    </p>
                  </div>
                </div>

                {/* Tool Action Distribution */}
                <div className={CARD}>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">What Lawyers Do With AI</h3>
                  {toolActions?.length > 0 ? (
                    <div className="space-y-2">
                      {toolActions.map((tool: any, i: number) => {
                        const maxCount = toolActions[0]?.count || 1;
                        const pct = Math.round((tool.count / maxCount) * 100);
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 w-40 truncate">{tool.action}</span>
                            <div className="flex-1 h-6 bg-slate-100 dark:bg-zinc-700 rounded-lg overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg flex items-center justify-end px-2"
                                style={{ width: `${pct}%` }}>
                                <span className="text-xs font-bold text-white">{tool.count}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No tool actions recorded yet.</p>
                  )}
                </div>

                {/* Model Distribution */}
                <div className={CARD}>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">AI Models Used</h3>
                  {models?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {models.map((m: any, i: number) => (
                        <div key={i} className="px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50 rounded-lg">
                          <span className="text-xs font-bold text-violet-700 dark:text-violet-400">{m.model}</span>
                          <span className="text-xs text-violet-500 ml-2">{m.count} calls</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No model data available.</p>
                  )}
                </div>
              </div>
            )}

            {/* Top Firms Tab */}
            {activeTab === 'firms' && (
              <div className={CARD}>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Top AI-Engaged Firms</h3>
                {perFirm?.length > 0 ? (
                  <div className="space-y-2">
                    {perFirm.map((firm: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-900/50 rounded-xl">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{firm.firmName}</span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                              firm.product === 'atrium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                            }`}>{firm.product}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-500 dark:text-zinc-400">{firm.messageCount} messages</span>
                            <span className="text-xs text-slate-500 dark:text-zinc-400">{firm.conversationCount} conversations</span>
                            {firm.errorRate > 0 && (
                              <span className="text-xs text-rose-500">{firm.errorRate.toFixed(1)}% error</span>
                            )}
                            {firm.lastActivityAgo !== null && (
                              <span className="text-xs text-slate-400">
                                {firm.lastActivityAgo < 60 ? `${firm.lastActivityAgo}m ago` :
                                 firm.lastActivityAgo < 1440 ? `${Math.round(firm.lastActivityAgo / 60)}h ago` :
                                 `${Math.round(firm.lastActivityAgo / 1440)}d ago`}
                              </span>
                            )}
                          </div>
                          {firm.topToolActions?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {firm.topToolActions.map((ta: any, j: number) => (
                                <span key={j} className="text-xs text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  {ta.action}: {ta.count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No AI usage recorded yet. Once firms start using ALOA, their usage will appear here.</p>
                )}
              </div>
            )}

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div className={CARD}>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Agent & Tool Activity</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                  Which AI agents and tools are being used across the platform. This helps identify which features
                  drive engagement and which may need improvement.
                </p>
                {toolActions?.length > 0 ? (
                  <div className="space-y-3">
                    {toolActions.map((tool: any, i: number) => {
                      const total = toolActions.reduce((s: number, t: any) => s + t.count, 0);
                      const pct = total > 0 ? Math.round((tool.count / total) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{tool.action}</span>
                            <span className="text-xs text-slate-500">{tool.count} calls ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No tool activity recorded yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AloaUsageCenter;
