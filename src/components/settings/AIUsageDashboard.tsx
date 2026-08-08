'use client';

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useDataState } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Activity,
  Zap,
  Clock,
  AlertTriangle,
  BarChart3,
  Cpu,
  Bot,
  Gauge,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AgentBreakdownEntry {
  requests: number;
  tokens: number;
}

interface ModelBreakdownEntry {
  requests: number;
  tokens: number;
}

interface AIUsageData {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorCount: number;
  byAgent: Record<string, AgentBreakdownEntry>;
  byModel: Record<string, ModelBreakdownEntry>;
  daily: Record<string, { requests: number; tokens: number }>;
}

interface RateLimitData {
  used: number;
  limit: number;
  windowMinutes: number;
  resetsAt: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT DISPLAY CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ARIA: {
    label: 'AI Assistant',
    color: 'text-blue-400',
    icon: <Bot className="w-3.5 h-3.5" />,
  },
  ALOA: {
    label: 'ALOA™',
    color: 'text-emerald-400',
    icon: <Cpu className="w-3.5 h-3.5" />,
  },
  ALDIA: {
    label: 'ALDIA',
    color: 'text-violet-400',
    icon: <Gauge className="w-3.5 h-3.5" />,
  },
  Ingestion: {
    label: 'Ingestion',
    color: 'text-amber-400',
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  Jurisdiction: {
    label: 'Jurisdiction',
    color: 'text-cyan-400',
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
  Drafting: {
    label: 'Drafting',
    color: 'text-rose-400',
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  Research: {
    label: 'Research',
    color: 'text-teal-400',
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
};

function getAgentDisplay(agentKey: string) {
  return AGENT_CONFIG[agentKey] || {
    label: agentKey,
    color: 'text-gray-400',
    icon: <Bot className="w-3.5 h-3.5" />,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatResetsAt(timestamp: number | null): string {
  if (!timestamp) return '—';
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'Resets now';
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `Resets in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  return `Resets in ${hours}h ${remainMins}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const MetricCardSkeleton: React.FC = () => (
  <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-lg bg-[#1e293b]" />
      <div className="h-3 w-20 rounded bg-[#1e293b]" />
    </div>
    <div className="h-7 w-24 rounded bg-[#1e293b] mb-1" />
    <div className="h-2.5 w-16 rounded bg-[#1e293b]" />
  </div>
);

const ListSkeleton: React.FC = () => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-[#1e293b]" />
          <div className="h-3 w-20 rounded bg-[#1e293b]" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-3 w-12 rounded bg-[#1e293b]" />
          <div className="h-3 w-16 rounded bg-[#1e293b]" />
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// METRIC CARD
// ─────────────────────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: { label: string; positive: boolean };
}> = ({ title, value, subtitle, icon, iconBg, iconColor, trend }) => (
  <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5 transition-shadow hover:shadow-lg hover:shadow-black/20 group">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </span>
    </div>
    <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{value}</p>
    <div className="flex items-center gap-2">
      {subtitle && (
        <span className="text-xs text-gray-500">{subtitle}</span>
      )}
      {trend && (
        <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${
          trend.positive
            ? 'text-emerald-400 bg-emerald-400/10'
            : 'text-red-400 bg-red-400/10'
        }`}>
          {trend.label}
        </span>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT BAR
// ─────────────────────────────────────────────────────────────────────────────

const RateLimitBar: React.FC<{ used: number; limit: number; resetsAt: number | null }> = ({
  used,
  limit,
  resetsAt,
}) => {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isWarning = percentage >= 80 && percentage < 100;
  const isCritical = percentage >= 100;

  const barColor = isCritical
    ? 'bg-red-500'
    : isWarning
      ? 'bg-amber-500'
      : 'bg-blue-500';

  const barBgColor = isCritical
    ? 'bg-red-500/20'
    : isWarning
      ? 'bg-amber-500/20'
      : 'bg-blue-500/20';

  return (
    <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10">
            <Gauge className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
            Rate Limit
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {formatResetsAt(resetsAt)}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl font-bold text-white">{used}</span>
        <span className="text-sm text-gray-500">/</span>
        <span className="text-sm font-medium text-gray-400">
          {isUnlimited ? '∞' : limit.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500 ml-1">requests / hour</span>
      </div>

      <div className={`w-full h-2.5 rounded-full ${barBgColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${isUnlimited ? 0 : percentage}%` }}
        />
      </div>

      {isWarning && (
        <p className="text-2xs text-amber-400 mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Approaching rate limit — {Math.round(percentage)}% used
        </p>
      )}
      {isCritical && (
        <p className="text-2xs text-red-400 mt-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Rate limit reached — requests will be throttled
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BREAKDOWN LIST
// ─────────────────────────────────────────────────────────────────────────────

const BreakdownList: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: Record<string, { requests: number; tokens: number }>;
  getDisplay: (key: string) => { label: string; color: string; icon: React.ReactNode };
  totalRequests: number;
}> = ({ title, icon, items, getDisplay, totalRequests }) => {
  const sortedEntries = Object.entries(items).sort(
    ([, a], [, b]) => b.requests - a.requests
  );

  if (sortedEntries.length === 0) {
    return (
      <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1e293b]">
            <span className="text-gray-400">{icon}</span>
          </div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
            {title}
          </span>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1e293b]">
          <span className="text-gray-400">{icon}</span>
        </div>
        <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </span>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b border-[#1e293b]">
        <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 w-1/3">Name</span>
        <div className="flex items-center gap-6 w-2/3 justify-end">
          <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 w-16 text-right">Requests</span>
          <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 w-20 text-right">Tokens</span>
          <span className="text-2xs font-bold uppercase tracking-wider text-gray-500 w-12 text-right">Share</span>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-0.5">
        {sortedEntries.map(([key, data]) => {
          const display = getDisplay(key);
          const share = totalRequests > 0 ? Math.round((data.requests / totalRequests) * 100) : 0;

          return (
            <div
              key={key}
              className="flex items-center justify-between px-1 py-2.5 rounded-lg hover:bg-[#111827] transition-colors group"
            >
              <div className="flex items-center gap-2.5 w-1/3 min-w-0">
                <span className={display.color}>{display.icon}</span>
                <span className={`text-sm font-medium truncate ${display.color}`}>
                  {display.label}
                </span>
              </div>
              <div className="flex items-center gap-6 w-2/3 justify-end">
                <span className="text-sm font-mono text-gray-300 w-16 text-right tabular-nums">
                  {formatNumber(data.requests)}
                </span>
                <span className="text-sm font-mono text-gray-400 w-20 text-right tabular-nums">
                  {formatNumber(data.tokens)}
                </span>
                <div className="w-12 flex items-center justify-end gap-1.5">
                  <div className="w-8 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500/60 transition-all duration-500"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="text-2xs text-gray-500 tabular-nums w-7 text-right">
                    {share}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center py-20 px-6">
    <div className="w-16 h-16 rounded-2xl bg-[#0f1629] border border-[#1e293b] flex items-center justify-center mb-5">
      <BarChart3 className="w-8 h-8 text-gray-600" />
    </div>
    <h3 className="text-lg font-bold text-white mb-2">No AI Usage Recorded Yet</h3>
    <p className="text-sm text-gray-500 max-w-sm">
      Usage metrics will appear here once your team starts interacting with AI agents like ARIA, ALOA™, or ALDIA.
    </p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const AIUsageDashboard: React.FC = () => {
  const { appState } = useDataState();
  const { currentUser } = useAuth();
  const firmId = appState?.firmDetails?.id || currentUser?.firmId || '';

  // ── Convex Queries ──────────────────────────────────────────────────────
  // NOTE: api.ai.getAIUsageForFirm and api.ai.getRateLimitStatus don't exist
  // in convex/ai.ts yet. Rather than crashing with "function not found", we
  // gracefully skip these queries and show a "no data" state. When the
  // backend queries are implemented, re-enable them here.
  const usageData: any = null; // useQuery(api.ai.getAIUsageForFirm, firmId ? { firmId } : 'skip');
  const rateLimitData: any = null; // useQuery(api.ai.getRateLimitStatus, firmId ? { firmId } : 'skip');

  // ── Derived State ───────────────────────────────────────────────────────
  const isLoading = false; // Not loading since queries are disabled
  const hasNoData = true; // No usage tracking data available yet
  const hasData = false;

  const successRate = hasData && usageData.totalRequests > 0
    ? Math.round(((usageData.totalRequests - usageData.errorCount) / usageData.totalRequests) * 100)
    : 0;

  // ── Loading State ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5 animate-pulse">
            <div className="h-4 w-24 rounded bg-[#1e293b] mb-4" />
            <ListSkeleton />
          </div>
          <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5 animate-pulse">
            <div className="h-4 w-24 rounded bg-[#1e293b] mb-4" />
            <ListSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State ─────────────────────────────────────────────────────────
  if (hasNoData || !usageData) {
    return <EmptyState />;
  }

  // ── Data State ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-400" />
            AI Usage Dashboard
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Usage metrics for the last 30 days across all AI agents and models.
          </p>
        </div>
      </div>

      {/* Metric Cards — Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={formatNumber(usageData.totalRequests)}
          subtitle="Last 30 days"
          icon={<Activity className="w-4 h-4" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
        />

        <MetricCard
          title="Tokens Consumed"
          value={formatNumber(usageData.totalTokens)}
          subtitle={`${formatNumber(usageData.totalInputTokens)} in / ${formatNumber(usageData.totalOutputTokens)} out`}
          icon={<Zap className="w-4 h-4" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
        />

        <MetricCard
          title="Avg Latency"
          value={formatLatency(usageData.avgLatencyMs)}
          subtitle="Per request"
          icon={<Clock className="w-4 h-4" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
          trend={
            usageData.avgLatencyMs > 3000
              ? { label: 'Slow', positive: false }
              : usageData.avgLatencyMs > 0
                ? { label: 'Normal', positive: true }
                : undefined
          }
        />

        <MetricCard
          title="Errors"
          value={usageData.errorCount.toString()}
          subtitle={
            usageData.totalRequests > 0
              ? `${successRate}% success rate`
              : 'No requests'
          }
          icon={<AlertTriangle className="w-4 h-4" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-400"
          trend={
            usageData.errorCount > 0 && usageData.totalRequests > 0
              ? {
                  label: `${((usageData.errorCount / usageData.totalRequests) * 100).toFixed(1)}% error rate`,
                  positive: usageData.errorCount / usageData.totalRequests < 0.05,
                }
              : usageData.totalRequests > 0
                ? { label: 'Clean', positive: true }
                : undefined
          }
        />
      </div>

      {/* Rate Limit + Agent Breakdown — Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Rate Limit — spans 2 columns */}
        <div className="lg:col-span-2">
          {rateLimitData ? (
            <RateLimitBar
              used={rateLimitData.used}
              limit={rateLimitData.limit}
              resetsAt={rateLimitData.resetsAt}
            />
          ) : (
            <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5">
              <p className="text-sm text-gray-500">Rate limit data unavailable</p>
            </div>
          )}
        </div>

        {/* Agent Breakdown — spans 3 columns */}
        <div className="lg:col-span-3">
          <BreakdownList
            title="By Agent"
            icon={<Bot className="w-4 h-4" />}
            items={usageData.byAgent}
            getDisplay={getAgentDisplay}
            totalRequests={usageData.totalRequests}
          />
        </div>
      </div>

      {/* Model Breakdown — Full Width */}
      <BreakdownList
        title="By Model"
        icon={<Cpu className="w-4 h-4" />}
        items={usageData.byModel}
        getDisplay={(key) => ({
          label: key.replace('models/', ''),
          color: 'text-gray-300',
          icon: <Cpu className="w-3.5 h-3.5" />,
        })}
        totalRequests={usageData.totalRequests}
      />

      {/* Daily Activity Mini-Chart (text-based) */}
      {Object.keys(usageData.daily).length > 0 && (
        <div className="bg-[#0f1629] border border-[#1e293b] rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1e293b]">
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-gray-400">
              Daily Activity
            </span>
            <span className="text-2xs text-gray-600 ml-auto">
              Last {Object.keys(usageData.daily).length} days with activity
            </span>
          </div>

          <div className="flex items-end gap-[3px] h-20 overflow-x-auto custom-scrollbar pb-1">
            {Object.entries(usageData.daily)
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-30)
              .map(([day, data]) => {
                const maxRequests = Math.max(
                  ...Object.values(usageData.daily).map((d) => d.requests),
                  1
                );
                const heightPct = Math.max((data.requests / maxRequests) * 100, 4);
                const isToday = day === new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={day}
                    className="flex flex-col items-center gap-1 group relative flex-shrink-0"
                    title={`${day}: ${data.requests} requests, ${formatNumber(data.tokens)} tokens`}
                  >
                    <div
                      className={`w-4 rounded-sm transition-all duration-300 ${
                        isToday
                          ? 'bg-blue-500'
                          : 'bg-blue-500/30 group-hover:bg-blue-500/50'
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: '4px' }}
                    />
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10">
                      <div className="bg-[#1e293b] border border-[#2d3a4f] rounded-lg px-2.5 py-1.5 text-2xs whitespace-nowrap shadow-xl">
                        <p className="font-semibold text-white">{data.requests} req</p>
                        <p className="text-gray-400">{formatNumber(data.tokens)} tokens</p>
                      </div>
                      <div className="w-2 h-2 bg-[#1e293b] rotate-45 -mt-1 border-r border-b border-[#2d3a4f]" />
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Date labels */}
          <div className="flex justify-between mt-2">
            <span className="text-2xs text-gray-600">
              {Object.keys(usageData.daily).sort()[0]?.slice(5)}
            </span>
            <span className="text-2xs text-gray-600">
              {Object.keys(usageData.daily).sort().slice(-1)[0]?.slice(5)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIUsageDashboard;
