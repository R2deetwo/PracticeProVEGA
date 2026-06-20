/**
 * useOfflineQueue — localStorage-based offline mutation queue.
 *
 * When the device is offline, mutations that would normally go directly
 * to Convex are instead queued in localStorage. When the connection
 * returns, the queue is replayed automatically.
 *
 * Usage:
 *   const { queueMutation, isOnline } = useOfflineQueue();
 *   
 *   const handleCreate = async () => {
 *     if (!isOnline) {
 *       queueMutation({
 *         table: 'matters',
 *         data: matterData,
 *         itemName: 'Matter',
 *       });
 *       addToast('Saved offline. Will sync when you reconnect.', { type: 'info' });
 *       return;
 *     }
 *     // Normal online flow
 *     await createMatter(matterData);
 *   };
 *
 * The queue is checked every 5 seconds and on the 'online' event.
 * Successfully replayed mutations are removed from the queue.
 * Failed replays stay in the queue for the next attempt.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUI } from '../contexts/UIContext';

const QUEUE_KEY = 'practicepro_offline_queue';

interface QueuedMutation {
    id: string;
    timestamp: number;
    table: string;
    data: any;
    itemName: string;
    userEmail?: string;
}

function readQueue(): QueuedMutation[] {
    try {
        const stored = localStorage.getItem(QUEUE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
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
        // localStorage might be full or unavailable
    }
}

export function useOfflineQueue() {
    const { isOnline, addToast } = useUI();
    const createItemMutation = useMutation(api.myFunctions.createItem);
    const isReplaying = useRef(false);

    const queueMutation = useCallback((mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) => {
        const queue = readQueue();
        const item: QueuedMutation = {
            ...mutation,
            id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
        };
        queue.push(item);
        writeQueue(queue);
    }, []);

    const replayQueue = useCallback(async () => {
        if (isReplaying.current) return;
        if (!navigator.onLine) return;

        const queue = readQueue();
        if (queue.length === 0) return;

        isReplaying.current = true;
        let successCount = 0;
        let failCount = 0;
        const remaining: QueuedMutation[] = [];

        for (const item of queue) {
            try {
                await createItemMutation({
                    table: item.table,
                    data: item.data,
                    userEmail: item.userEmail,
                });
                successCount++;
            } catch (e) {
                // If it's a network error, keep it in the queue
                // If it's a validation error, drop it (it'll never succeed)
                const errorMsg = (e as any)?.message || '';
                if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('WebSocket')) {
                    remaining.push(item);
                }
                failCount++;
            }
        }

        writeQueue(remaining);

        if (successCount > 0) {
            addToast(`Synced ${successCount} item${successCount > 1 ? 's' : ''} from offline queue.`, { type: 'success', duration: 4000 });
        }

        isReplaying.current = false;
    }, [createItemMutation, addToast]);

    // Replay on 'online' event
    useEffect(() => {
        if (isOnline) {
            // Small delay to let Convex reconnect
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
