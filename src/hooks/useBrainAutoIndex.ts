
import { useEffect, useRef } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { useDataState } from '../contexts/DataContext';
import { brain } from '../services/brainService';
import { getGeminiApiKey } from '../utils/aiUtils';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * useBrainAutoIndex — The "Zero Friction" Indexing Hook
 * 
 * Automatically ensures the firm's data is indexed in the brain.
 * Runs silently in the background on app start.
 * 1. Checks if a full index is needed (firm change or > 24h since last run).
 * 2. If needed, runs brain.seedFirm using the user's existing Gemini key.
 * 3. Does not bother the user with popups, just logs to console.
 */
export const useBrainAutoIndex = () => {
    const { appState } = useDataState();
    const { addToast } = useUI();
    const convex = useConvex();
    const mutation = useMutation; // Note: we call this with (api.xxx)
    const isRunning = useRef(false);
    const { appMode } = useAuth();

    useEffect(() => {
        const firmId = appState.firmDetails?.id;
        if (!firmId || isRunning.current) return;

        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            if (import.meta.env.DEV) console.warn('[Brain] Auto-index skipped: No API key found in settings.');
            return;
        }

        const runAutoIndex = async () => {
            const STORAGE_KEY = `brain_last_index_${firmId}`;
            const lastIndexTime = localStorage.getItem(STORAGE_KEY);
            const now = Date.now();

            // Run if never indexed or if it's been more than 24 hours
            const needsIndex = !lastIndexTime || (now - parseInt(lastIndexTime)) > (24 * 60 * 60 * 1000);

            if (needsIndex) {
                if (import.meta.env.DEV) console.log('[Brain] Starting silent background index');
                isRunning.current = true;

                try {
                    // We use brain.seedFirm which fetches all chunks and embeds them
                    const result = await brain.seedFirm({
                        firmId,
                        scope: (appState.firmDetails?.product === 'atrium' || appState.firmDetails?.product === 'property') ? 'property' : 'legal',
                        convexQuery: (name: any, args: any) => convex.query(name, args),
                        convexMutation: (name: any, args: any) => convex.mutation(name, args)
                    });

                    localStorage.setItem(STORAGE_KEY, now.toString());
                    if (import.meta.env.DEV) console.log(`[Brain] Silent index complete: ${result.indexed} chunks stored.`);
                } catch (e) {
                    if (import.meta.env.DEV) console.error('[Brain] Silent index failed:', e);
                } finally {
                    isRunning.current = false;
                }
            }
        };

        runAutoIndex();
    }, [appState.firmDetails?.id]);
};
