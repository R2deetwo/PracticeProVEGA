import { useMemo } from 'react';
import { useProduct } from '../contexts/ProductContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useCoreState } from '../contexts/CoreContext';
import { InvoiceStatus } from '../types';

type InsightSeverity = 'critical' | 'warning' | 'info';

export interface AIInsight {
  severity: InsightSeverity;
  headline: string;
  detail: string;
  actionLabel: string;
  actionView: string;
  actionContext?: Record<string, any>;
  agentName: string;
  hasData: boolean;
}

/**
 * useAIInsight — Analyses live state to produce a single, highest-priority
 * actionable AI intelligence card for the dashboard hero section.
 * Zero hardcoded strings. All data comes from real context state.
 */
export function useAIInsight(): AIInsight {
  const { isProperty, isVega } = useProduct();
  const { matterState } = useMatterState();
  const { executionState } = useExecutionState();
  const { financeState } = useFinanceState();
  const { coreState } = useCoreState();

  return useMemo<AIInsight>(() => {
    const now = new Date();
    const agentName = isProperty ? 'ARIA' : 'ALOA';

    // ─── PROPERTY OS (Atrium) Insights ─────────────────────────────────
    if (isProperty) {
      // Priority 1: Critical service charge defaulters (>14 days)
      const criticalDefaulters = (coreState.serviceCharges || []).filter(
        c => c.isDefaulter && (c.daysOverdue ?? 0) > 14
      );
      if (criticalDefaulters.length > 0) {
        const units = criticalDefaulters.map(c => {
          const prop = (coreState.properties || []).find(p => p.id === c.unitId);
          return prop?.address || 'Unknown Unit';
        });
        const displayUnit = units[0];
        const extra = criticalDefaulters.length > 1 ? ` and ${criticalDefaulters.length - 1} others` : '';
        return {
          severity: 'critical',
          agentName,
          hasData: true,
          headline: `${criticalDefaulters.length} critical service charge default${criticalDefaulters.length > 1 ? 's' : ''} require immediate action.`,
          detail: `${agentName} flagged ${displayUnit}${extra} for non-payment exceeding 14 days. Late penalty enforcement and access restriction notices are ready.`,
          actionLabel: 'Review Defaulters',
          actionView: 'atriumEngine',
          actionContext: { activeTab: 'defaulters' },
        };
      }

      // Priority 2: Any service charge defaulters
      const allDefaulters = (coreState.serviceCharges || []).filter(c => c.isDefaulter);
      if (allDefaulters.length > 0) {
        return {
          severity: 'warning',
          agentName,
          hasData: true,
          headline: `${allDefaulters.length} ${allDefaulters.length === 1 ? 'property has an' : 'properties have'} outstanding service charge defaults.`,
          detail: `${agentName} recommends sending automated WhatsApp reminders now to recover ₦${allDefaulters.reduce((s, c) => s + c.amount, 0).toLocaleString('en-NG')} in overdue service charges.`,
          actionLabel: 'Manage Charges',
          actionView: 'atriumEngine',
          actionContext: { activeTab: 'defaulters' },
        };
      }

      // Priority 3: Overdue invoices in finance
      const overdueInvoices = (financeState.invoices || []).filter(i => i.status === InvoiceStatus.Overdue);
      if (overdueInvoices.length > 0) {
        const total = overdueInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);
        return {
          severity: 'warning',
          agentName,
          hasData: true,
          headline: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} totalling ₦${total.toLocaleString('en-NG')} require follow-up.`,
          detail: `${agentName} detected unpaid invoices that may impact your monthly revenue target. Automated reminders via the Automation Center can recover these.`,
          actionLabel: 'View Finance',
          actionView: 'billing',
          actionContext: { filter: 'overdue' },
        };
      }

      // Priority 4: Vacant units in pipeline
      const vacancies = (coreState.leadsPipeline || []).filter(l => l.stage !== 'Closed');
      if (vacancies.length > 0) {
        return {
          severity: 'info',
          agentName,
          hasData: true,
          headline: `${vacancies.length} unit${vacancies.length > 1 ? 's' : ''} currently available in the vacancy pipeline.`,
          detail: `${agentName} has identified active leads and vacant units. Review and progress your pipeline to minimise void periods and protect rental income.`,
          actionLabel: 'View Pipeline',
          actionView: 'atriumEngine',
          actionContext: { activeTab: 'pipeline' },
        };
      }

      // Priority 5: Unread inbox messages
      const pendingTasks = (executionState.tasks || []).filter(t => t.status !== 'done');
      if (pendingTasks.length > 0) {
        const overdueTasks = pendingTasks.filter(t => {
          if (!t.dueDate) return false;
          return new Date(t.dueDate) < now;
        });
        return {
          severity: overdueTasks.length > 0 ? 'warning' : 'info',
          agentName,
          hasData: true,
          headline: `${pendingTasks.length} pending task${pendingTasks.length > 1 ? 's' : ''}${overdueTasks.length > 0 ? `, ${overdueTasks.length} overdue` : ''} across your portfolio.`,
          detail: `${agentName} recommends completing overdue property tasks to maintain operational efficiency and tenant satisfaction.`,
          actionLabel: 'View Tasks',
          actionView: 'tasks',
          actionContext: {},
        };
      }

      // All clear
      return {
        severity: 'info',
        agentName,
        hasData: false,
        headline: 'Your portfolio is running cleanly.',
        detail: `${agentName} has scanned your properties, charges, and pipeline. No critical issues detected. You are in a strong position today.`,
        actionLabel: 'Open Revenue Monitor',
        actionView: 'atriumEngine',
        actionContext: {},
      };
    }

    // ─── LEGAL OS (Vega) Insights ───────────────────────────────────────
    // Priority 1: Overdue invoices
    const overdueInvoices = (financeState.invoices || []).filter(i => i.status === InvoiceStatus.Overdue);
    if (overdueInvoices.length > 0) {
      const total = overdueInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);
      return {
        severity: 'critical',
        agentName,
        hasData: true,
        headline: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} — ₦${total.toLocaleString('en-NG')} at risk.`,
        detail: `${agentName} has identified unpaid invoices past their due date. Recovering this revenue should be your immediate priority to maintain firm cash flow.`,
        actionLabel: 'View Overdue Invoices',
        actionView: 'billing',
        actionContext: { filter: 'overdue' },
      };
    }

    // Priority 2: Tasks with upcoming deadlines this week
    const in7Days = new Date(now.getTime() + 7 * 86400000);
    const urgentTasks = (executionState.tasks || []).filter(t => {
      if (t.status === 'done' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d <= in7Days;
    });
    if (urgentTasks.length > 0) {
      const overdueTasks = urgentTasks.filter(t => new Date(t.dueDate!) < now);
      const topTask = urgentTasks[0];
      const relatedMatter = topTask.matterId
        ? (matterState.matters || []).find(m => m.id === topTask.matterId)
        : null;
      const matterRef = relatedMatter ? ` on "${relatedMatter.title}"` : '';
      return {
        severity: overdueTasks.length > 0 ? 'critical' : 'warning',
        agentName,
        hasData: true,
        headline: `${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} due within 7 days${overdueTasks.length > 0 ? ` — ${overdueTasks.length} already overdue` : ''}.`,
        detail: `${agentName} flagged "${topTask.title}"${matterRef} as the highest priority. ${overdueTasks.length > 0 ? 'Overdue tasks are impacting your matter health score.' : 'Act now to stay ahead of your deadlines.'}`,
        actionLabel: 'Review Tasks',
        actionView: 'tasks',
        actionContext: { status: 'urgent' },
      };
    }

    // Priority 3: Stale active matters (no activity in 21+ days)
    const staleMatters = (matterState.matters || []).filter(m => {
      if (m.status !== 'Active') return false;
      const last = new Date(m.stageLastUpdated || m.createdAt);
      return (now.getTime() - last.getTime()) > 21 * 86400000;
    });
    if (staleMatters.length > 0) {
      return {
        severity: 'warning',
        agentName,
        hasData: true,
        headline: `${staleMatters.length} active matter${staleMatters.length > 1 ? 's' : ''} with no recent activity.`,
        detail: `${agentName} detected stale matters that haven't been updated in over 21 days. These may be at risk of missing deadlines or losing client confidence.`,
        actionLabel: 'Review Stale Matters',
        actionView: 'matters',
        actionContext: {},
      };
    }

    // Priority 4: Active matters — general health
    const activeMatters = (matterState.matters || []).filter(m => m.status === 'Active');
    if (activeMatters.length > 0) {
      const pendingTasks = (executionState.tasks || []).filter(t => t.status !== 'done').length;
      return {
        severity: 'info',
        agentName,
        hasData: true,
        headline: `${activeMatters.length} active matter${activeMatters.length > 1 ? 's' : ''}, ${pendingTasks} pending task${pendingTasks !== 1 ? 's' : ''}.`,
        detail: `${agentName} has reviewed your current caseload. Everything is tracking within normal parameters. Stay on top of your task queue to maintain momentum.`,
        actionLabel: 'View Matters',
        actionView: 'matters',
        actionContext: {},
      };
    }

    // All clear
    return {
      severity: 'info',
      agentName,
      hasData: false,
      headline: 'Your firm dashboard is clear.',
      detail: `${agentName} has analysed your matters, tasks, and billing. No critical issues found. This is a good time to review your pipeline or draft new invoices.`,
      actionLabel: 'View Matters',
      actionView: 'matters',
      actionContext: {},
    };
  }, [isProperty, matterState, executionState, financeState, coreState]);
}
