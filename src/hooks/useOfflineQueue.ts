/**
 * useOfflineQueue — localStorage-based offline mutation queue.
 *
 * Supports any registered mutation via a mutation registry. When the device
 * is offline, mutations are queued in localStorage. When the connection
 * returns, the queue is replayed automatically.
 *
 * Registered mutations (extend the registry below to add more):
 *   - createItem            (api.myFunctions.createItem)
 *   - updateItem            (api.myFunctions.updateItem)
 *   - deleteItem            (api.myFunctions.deleteItem)
 *   - addLedgerEntry        (api.sentry.addLedgerEntry)            — Atrium ledger
 *   - markChargeAsPaid      (api.sentry.markChargeAsPaid)          — service charge mark-paid
 *   - recordTrustTransaction (api.trustAccount.recordTrustTransaction) — trust deposit/withdrawal
 *   - createTask            (api.myFunctions.createTask)           — task creation
 *   - updateTask            (api.myFunctions.updateTask)            — task edits
 *   - updateTaskStatus      (api.myFunctions.updateTaskStatus)     — task status changes
 *   - createMaintenanceTicket (api.portals.createMaintenanceTicket) — tenant maintenance ticket
 *   - cancelMaintenanceTicket (api.portals.cancelMaintenanceTicket) — tenant ticket cancellation
 *
 * USAGE — new API (any registered mutation):
 *   const { queueMutation, isOnline } = useOfflineQueue();
 *
 *   const handleCollect = async () => {
 *     if (!isOnline) {
 *       queueMutation({
 *         mutationName: 'addLedgerEntry',
 *         args: { firmId, propertyId, amount, type: 'rent', ... },
 *         label: 'Rent collection — 12 Marina Rd',
 *       });
 *       addToast('Saved offline. Will sync when you reconnect.', { type: 'info' });
 *       return;
 *     }
 *     await addLedgerEntry({ ... });
 *   };
 *
 * USAGE — legacy API (still supported, maps to createItem; used by MatterForm.tsx):
 *   queueMutation({
 *     table: 'matters',
 *     data: matterData,
 *     itemName: 'Matter',
 *     userEmail: currentUser?.email,
 *   });
 *
 * Queue is checked every 30s when online and on the 'online' event with a
 * 2-second grace period for Convex to re-establish its WebSocket.
 * Network errors keep retrying; validation errors are dropped (will never
 * succeed) and surfaced to the user so they know their action was lost.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUI } from '../contexts/UIContext';

const QUEUE_KEY = 'practicepro_offline_queue';

// All mutations this hook knows how to replay.
// Add new entries here when extending offline coverage to new flows.
const MUTATION_NAMES = [
    'createItem',
    'updateItem',
    'deleteItem',
    'addLedgerEntry',
    'markChargeAsPaid',
    'recordTrustTransaction',
    // Tier-2 additions:
    'createTask',           // useTasks.ts — task creation in the field
    'updateTask',           // useTasks.ts — task edits
    'updateTaskStatus',     // useTasks.ts — status changes (mobile field use)
    'createMaintenanceTicket',  // portals.ts — tenant submitting a maintenance ticket
    'cancelMaintenanceTicket',   // portals.ts — tenant cancelling their own ticket
    'settleUnitPeriods',         // sentry.ts — OnboardUnitLedgerModal historical period settlement
] as const;
type MutationName = (typeof MUTATION_NAMES)[number];

interface QueuedMutation {
    id: string;
    timestamp: number;
    mutationName: MutationName;
    args: Record<string, any>;
    label: string;
}

// Polymorphic input — new shape OR legacy shape (auto-detected at queue time).
type QueueInput =
    | { mutationName: MutationName; args: Record<string, any>; label: string }
    | { table: string; data: any; itemName: string; userEmail?: string };

function readQueue(): QueuedMutation[] {
    try {
        const stored = localStorage.getItem(QUEUE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        // Migrate legacy entries (table/data/itemName shape) to the new shape
        // so old queued items still replay after the upgrade.
        return parsed.map((item: any): QueuedMutation => {
            if (item.mutationName) {
                return {
                    id: item.id,
                    timestamp: item.timestamp,
                    mutationName: item.mutationName,
                    args: item.args ?? {},
                    label: item.label ?? item.mutationName,
                };
            }
            // Legacy shape: { table, data, itemName, userEmail }
            return {
                id: item.id,
                timestamp: item.timestamp,
                mutationName: 'createItem',
                args: {
                    table: item.table,
                    data: item.data,
                    userEmail: item.userEmail,
                },
                label: item.itemName || item.table || 'Item',
            };
        });
    } catch {
        return [];
    }
}

function writeQueue(queue: QueuedMutation[]) {
    try {
        if (queue.length === 0) {
            localStorage.removeItem(QUEUE_KEY);
        } else {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        }
    } catch {
        // localStorage might be full or unavailable — nothing we can do
    }
}

// Classify errors: network errors keep retrying; validation/logic errors
// will never succeed so we drop them and surface to the user.
function isNetworkError(e: any): boolean {
    const msg = ((e?.message as string) || '').toLowerCase();
    if (!msg) return true; // treat unknown errors as retryable — safer default
    return (
        msg.includes('network') ||
        msg.includes('fetch') ||
        msg.includes('websocket') ||
        msg.includes('failed to fetch') ||
        msg.includes('connection') ||
        msg.includes('aborted') ||
        msg.includes('timeout') ||
        // Convex transient error indicators
        msg.includes('auth token is expired') === false &&
            (msg.includes('could not reach') || msg.includes('server'))
    );
    // Note: validation errors typically have messages like "Field X is required"
    // or "Document not found" — those return false here and get dropped.
}

function makeId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useOfflineQueue() {
    const { isOnline, addToast } = useUI();

    // Mutation registry — one useMutation per registered name.
    // These are stable refs from Convex (memoized), so the `mutations` object
    // identity changes per render but the underlying function refs do not.
    const createItemMutation = useMutation(api.myFunctions.createItem);
    const updateItemMutation = useMutation(api.myFunctions.updateItem);
    const deleteItemMutation = useMutation(api.myFunctions.deleteItem);
    const addLedgerEntryMutation = useMutation(api.sentry.addLedgerEntry);
    const markChargeAsPaidMutation = useMutation(api.sentry.markChargeAsPaid);
    const recordTrustTransactionMutation = useMutation(api.trustAccount.recordTrustTransaction);
    // Tier-2 mutations:
    const createTaskMutation = useMutation(api.myFunctions.createTask);
    const updateTaskMutation = useMutation(api.myFunctions.updateTask);
    const updateTaskStatusMutation = useMutation(api.myFunctions.updateTaskStatus);
    const createMaintenanceTicketMutation = useMutation(api.portals.createMaintenanceTicket);
    const cancelMaintenanceTicketMutation = useMutation(api.portals.cancelMaintenanceTicket);
    const settleUnitPeriodsMutation = useMutation(api.sentry.settleUnitPeriods);

    // Build the dispatch map. Wrapped in a ref so the replay closure stays stable.
    const mutationsRef = useRef<Record<MutationName, (args: any) => Promise<any>>>({
        createItem: createItemMutation,
        updateItem: updateItemMutation,
        deleteItem: deleteItemMutation,
        addLedgerEntry: addLedgerEntryMutation,
        markChargeAsPaid: markChargeAsPaidMutation,
        recordTrustTransaction: recordTrustTransactionMutation,
        createTask: createTaskMutation,
        updateTask: updateTaskMutation,
        updateTaskStatus: updateTaskStatusMutation,
        createMaintenanceTicket: createMaintenanceTicketMutation,
        cancelMaintenanceTicket: cancelMaintenanceTicketMutation,
        settleUnitPeriods: settleUnitPeriodsMutation,
    });
    // Keep the ref current whenever any mutation ref changes (defensive — Convex
    // mutations are stable, but this is cheap insurance).
    mutationsRef.current = {
        createItem: createItemMutation,
        updateItem: updateItemMutation,
        deleteItem: deleteItemMutation,
        addLedgerEntry: addLedgerEntryMutation,
        markChargeAsPaid: markChargeAsPaidMutation,
        recordTrustTransaction: recordTrustTransactionMutation,
        createTask: createTaskMutation,
        updateTask: updateTaskMutation,
        updateTaskStatus: updateTaskStatusMutation,
        createMaintenanceTicket: createMaintenanceTicketMutation,
        cancelMaintenanceTicket: cancelMaintenanceTicketMutation,
        settleUnitPeriods: settleUnitPeriodsMutation,
    };

    const isReplaying = useRef(false);

    // Polymorphic queueMutation — accepts new shape OR legacy shape.
    const queueMutation = useCallback((mutation: QueueInput) => {
        const queue = readQueue();
        let item: QueuedMutation;
        if ('mutationName' in mutation) {
            item = {
                id: makeId(),
                timestamp: Date.now(),
                mutationName: mutation.mutationName,
                args: mutation.args,
                label: mutation.label,
            };
        } else {
            // Legacy shape — map to createItem
            item = {
                id: makeId(),
                timestamp: Date.now(),
                mutationName: 'createItem',
                args: {
                    table: mutation.table,
                    data: mutation.data,
                    userEmail: mutation.userEmail,
                },
                label: mutation.itemName,
            };
        }
        queue.push(item);
        writeQueue(queue);
    }, []);

    const replayQueue = useCallback(async () => {
        if (isReplaying.current) return;
        if (typeof navigator === 'undefined' || !navigator.onLine) return;

        const queue = readQueue();
        if (queue.length === 0) return;

        isReplaying.current = true;
        let successCount = 0;
        let droppedCount = 0;
        const remaining: QueuedMutation[] = [];

        for (const item of queue) {
            const mutationFn = mutationsRef.current[item.mutationName];
            if (!mutationFn) {
                // Unknown mutation name — drop silently (shouldn't happen)
                droppedCount++;
                continue;
            }
            try {
                await mutationFn(item.args);
                successCount++;
            } catch (e: any) {
                if (isNetworkError(e)) {
                    // Transient — keep in queue for next retry
                    remaining.push(item);
                } else {
                    // Validation/logic error — will never succeed, drop it
                    // but surface to the user so they know their action was lost.
                    console.error(
                        `[OfflineQueue] Dropping failed mutation "${item.mutationName}" (${item.label}):`,
                        e
                    );
                    addToast(
                        `Could not sync "${item.label}" — ${(e?.message as string) || 'validation error'}. The change was not saved.`,
                        { type: 'error', duration: 8000 }
                    );
                    droppedCount++;
                }
            }
        }

        writeQueue(remaining);

        if (successCount > 0 && droppedCount === 0) {
            addToast(
                `Synced ${successCount} item${successCount > 1 ? 's' : ''} from offline queue.`,
                { type: 'success', duration: 4000 }
            );
        } else if (successCount > 0 && droppedCount > 0) {
            addToast(
                `Synced ${successCount} item${successCount > 1 ? 's' : ''}; ${droppedCount} could not be saved and was dropped.`,
                { type: 'warning', duration: 6000 }
            );
        }

        isReplaying.current = false;
    }, [addToast]);

    // Replay on 'online' event (with 2s grace period for Convex reconnect)
    useEffect(() => {
        if (isOnline) {
            const timer = setTimeout(() => replayQueue(), 2000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, replayQueue]);

    // Periodic retry every 30 seconds when online
    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(() => {
            const queue = readQueue();
            if (queue.length > 0) {
                replayQueue();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [isOnline, replayQueue]);

    const getQueueLength = useCallback(() => readQueue().length, []);

    return {
        queueMutation,
        replayQueue,
        getQueueLength,
        isOnline,
    };
}
