/**
 * MaintenanceQueue — the firm-wide maintenance ticket console.
 *
 * ROUND D (D7): the entire staff triage surface was orphaned. Tenants could
 * create and cancel tickets, the property view showed per-property tickets,
 * and MessagesView could advance a ticket linked to a conversation — but
 * getMaintenanceTicketsByFirm (the firm-wide queue, gated since Round A C2)
 * had ZERO callers. A firm had no way to SEE all its tickets in one place,
 * let alone triage them; tickets that never generated a conversation were
 * invisible to staff forever.
 *
 * This console closes the loop on the existing (properly gated) API:
 *   - getMaintenanceTicketsByFirm — the queue (status/property/tenant overview)
 *   - updateMaintenanceTicketStatus — status transitions + priority + resolution
 *   - assignTicketToTeamMember — delegation with notification
 *
 * Built on ui/ primitives per ADR-0004 (the raw-element ratchet must not grow).
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { InlineTicketReply } from '../messaging/InlineTicketReply';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';

interface MaintenanceTicket {
    _id: string;
    firmId: string;
    propertyId: string;
    unitId?: string;
    tenantId?: string;
    tenantName?: string;
    subject: string;
    description: string;
    category: string;
    requestTypeKey?: string;
    requestTypeLabel?: string;
    status: TicketStatus;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string;
    resolution?: string;
    cancellationNote?: string;
    conversationId?: string;
    createdAt: number;
    updatedAt: number;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
    open: '🟡 Received',
    in_progress: '🔵 In Progress',
    resolved: '🟢 Addressed',
    closed: '⚪ Closed',
    cancelled: '✖ Cancelled',
};

const PRIORITY_TONES: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
    urgent: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'neutral',
};

const STAFF_ROLES = ['Admin', 'Founder', 'Lawyer', 'Paralegal', 'ExternalCounsel'];

export const MaintenanceQueue: React.FC = () => {
    const { currentUser, bearerToken } = useAuth();
    const { coreState } = useCoreState();
    const { addToast } = useUI();
    const firmId = coreState.firmDetails?.id || (currentUser as any)?.firmId || '';

    const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
    const [search, setSearch] = useState('');
    const [resolutionDraft, setResolutionDraft] = useState<Record<string, string>>({});

    const tickets = useQuery(
        api.portals.getMaintenanceTicketsByFirm,
        firmId ? { firmId, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
    ) as MaintenanceTicket[] | undefined;

    const updateStatus = useMutation(api.portals.updateMaintenanceTicketStatus);
    const assignTicket = useMutation(api.portals.assignTicketToTeamMember);
    // UX-33: guards can reply where they triage — the same composer the
    // MessagesView threads use, embedded in the queue row.
    const sendAdminReply = useMutation(api.portals.sendAdminReply);
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

    const properties = useMemo(() => (coreState.properties || []) as Array<{ id: string; address: string; units?: Array<{ id: string; label?: string; name?: string }> }>, [coreState.properties]);
    const staffUsers = useMemo(
        () => ((coreState as any).users || []).filter((u: any) => STAFF_ROLES.includes(u.role)),
        [(coreState as any).users]
    );

    const propertyName = (propertyId: string, unitId?: string) => {
        const prop = properties.find((p) => p.id === propertyId);
        const unit = unitId ? prop?.units?.find((u) => u.id === unitId) : undefined;
        const unitLabel = unit ? ` · ${unit.label || unit.name || unitId}` : unitId ? ` · ${unitId}` : '';
        return prop ? `${prop.address}${unitLabel}` : `${propertyId}${unitLabel}`;
    };

    const staffName = (userId?: string) => {
        if (!userId) return null;
        const u = staffUsers.find((x: any) => x.id === userId);
        return u?.name || userId;
    };

    const filtered = useMemo(() => {
        if (!tickets) return [];
        let rows = tickets;
        if (statusFilter !== 'all') rows = rows.filter((t) => t.status === statusFilter);
        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter((t) =>
                t.subject?.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.tenantName?.toLowerCase().includes(q) ||
                propertyName(t.propertyId, t.unitId).toLowerCase().includes(q)
            );
        }
        return rows;
    }, [tickets, statusFilter, search, properties]);

    const counts = useMemo(() => {
        const c = { open: 0, in_progress: 0, done: 0, cancelled: 0 } as Record<string, number>;
        for (const t of tickets || []) {
            if (t.status === 'open') c.open++;
            else if (t.status === 'in_progress') c.in_progress++;
            else if (t.status === 'resolved' || t.status === 'closed') c.done++;
            else c.cancelled++;
        }
        return c;
    }, [tickets]);

    const handleStatusChange = async (ticket: MaintenanceTicket, newStatus: 'open' | 'in_progress' | 'resolved' | 'closed') => {
        const needsResolution = newStatus === 'resolved' || newStatus === 'closed';
        const resolution = needsResolution ? (resolutionDraft[ticket._id] || ticket.resolution || '').trim() : undefined;
        if (needsResolution && !resolution) {
            addToast('Add a short resolution note before closing the ticket (it is shown to the resident).', { type: 'info' });
            return;
        }
        try {
            await updateStatus({
                ticketId: ticket._id as any,
                status: newStatus,
                resolution: resolution || undefined,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            });
            addToast(`Ticket "${ticket.subject}" → ${STATUS_LABELS[newStatus]}.`, { type: 'success' });
            setResolutionDraft((prev) => { const next = { ...prev }; delete next[ticket._id]; return next; });
        } catch (err: any) {
            addToast(err?.message || 'Failed to update ticket status.', { type: 'error' });
        }
    };

    const handleAssign = async (ticket: MaintenanceTicket, userId: string) => {
        if (!userId) return;
        const user = staffUsers.find((u: any) => u.id === userId);
        try {
            await assignTicket({
                requestKind: 'maintenance',
                requestId: ticket._id,
                assignedToUserId: userId,
                assignedToName: user?.name || 'Team Member',
                assignedBy: String((currentUser as any)?.id || ''),
                firmId,
                userEmail: currentUser?.email,
                sessionToken: (bearerToken ?? undefined),
            });
            addToast(`Ticket assigned to ${user?.name || 'team member'} — the resident has been notified.`, { type: 'success' });
        } catch (err: any) {
            addToast(err?.message || 'Failed to assign ticket.', { type: 'error' });
        }
    };

    if (tickets === undefined) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* KPI chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Received</p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{counts.open}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">In Progress</p>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{counts.in_progress}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Addressed / Closed</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{counts.done}</p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700">
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Cancelled</p>
                    <p className="text-2xl font-black text-slate-500 dark:text-zinc-400">{counts.cancelled}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-56">
                    <Select
                        label="Status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)}
                        options={[
                            { value: 'all', label: 'All statuses' },
                            { value: 'open', label: '🟡 Received' },
                            { value: 'in_progress', label: '🔵 In Progress' },
                            { value: 'resolved', label: '🟢 Addressed' },
                            { value: 'closed', label: '⚪ Closed' },
                            { value: 'cancelled', label: '✖ Cancelled' },
                        ]}
                    />
                </div>
                <div className="flex-1">
                    <Input
                        label="Search"
                        placeholder="Subject, property, or resident…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Queue */}
            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-10 text-center">
                    <p className="text-sm text-slate-400">
                        {tickets.length === 0
                            ? 'No maintenance tickets yet — residents submit them from the tenant portal.'
                            : 'No tickets match the current filters.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((t) => {
                        const needsResolutionDraft = (t.status === 'open' || t.status === 'in_progress') && !t.resolution;
                        return (
                            <div key={t._id} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{t.subject}</p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                            {propertyName(t.propertyId, t.unitId)}
                                            {t.tenantName ? ` · ${t.tenantName}` : ''}
                                            {` · ${t.requestTypeLabel || t.category}`}
                                            {` · ${new Date(t.createdAt).toLocaleDateString()}`}
                                        </p>
                                        {t.description && (
                                            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 line-clamp-2">{t.description}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <Badge tone={t.status === 'open' ? 'warning' : t.status === 'in_progress' ? 'info' : t.status === 'cancelled' ? 'neutral' : 'success'}>
                                            {STATUS_LABELS[t.status]}
                                        </Badge>
                                        {t.priority && (
                                            <Badge tone={PRIORITY_TONES[t.priority] || 'neutral'}>{t.priority}</Badge>
                                        )}
                                    </div>
                                </div>

                                {(t.resolution || t.cancellationNote) && (
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/50 rounded-md px-3 py-2">
                                        {t.resolution ? `Resolution: ${t.resolution}` : `Cancelled by resident: ${t.cancellationNote}`}
                                    </p>
                                )}

                                {t.status !== 'cancelled' && (
                                    <div className="flex flex-wrap items-end gap-3">
                                        <div className="w-44">
                                            <Select
                                                label="Status"
                                                value={t.status}
                                                onChange={(e) => handleStatusChange(t, e.target.value as any)}
                                                options={[
                                                    { value: 'open', label: '🟡 Received' },
                                                    { value: 'in_progress', label: '🔵 In Progress' },
                                                    { value: 'resolved', label: '🟢 Addressed' },
                                                    { value: 'closed', label: '⚪ Closed' },
                                                ]}
                                            />
                                        </div>
                                        <div className="w-52">
                                            <Select
                                                label="Assigned to"
                                                value={t.assignedTo || ''}
                                                onChange={(e) => handleAssign(t, e.target.value)}
                                                placeholder="Assign…"
                                                options={staffUsers.map((u: any) => ({ value: u.id, label: u.name || u.email || u.id }))}
                                            />
                                        </div>
                                        {t.assignedTo && (
                                            <p className="text-2xs text-slate-400 pb-2">Assigned: {staffName(t.assignedTo) || t.assignedTo}</p>
                                        )}
                                    </div>
                                )}

                                {needsResolutionDraft && (
                                    <div className="flex flex-col sm:flex-row items-end gap-2">
                                        <div className="flex-1 w-full">
                                            <Textarea
                                                label="Resolution note"
                                                hint="Required when marking Addressed or Closed — the resident sees it."
                                                rows={2}
                                                value={resolutionDraft[t._id] || ''}
                                                onChange={(e) => setResolutionDraft((prev) => ({ ...prev, [t._id]: e.target.value }))}
                                            />
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleStatusChange(t, 'resolved')}
                                        >
                                            Mark Addressed
                                        </Button>
                                    </div>
                                )}

                                {t.status !== 'cancelled' && t.conversationId && (
                                    activeReplyId === t._id ? (
                                        <InlineTicketReply
                                            ticketId={t._id}
                                            conversationId={t.conversationId}
                                            firmId={firmId}
                                            adminId={currentUser?.id || ''}
                                            adminName={currentUser?.name || 'Admin'}
                                            sendAdminReply={sendAdminReply}
                                            addToast={addToast}
                                            onSent={() => setActiveReplyId(null)}
                                            onCancel={() => setActiveReplyId(null)}
                                        />
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setActiveReplyId(t._id)}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                            </svg>
                                            Reply to resident
                                        </Button>
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MaintenanceQueue;
