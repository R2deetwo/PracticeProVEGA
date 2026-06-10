import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type TipCategory = 'Pro-Tip' | 'Workflow' | 'Billing' | 'Task Management';

interface TipSettings {
    allTipsEnabled: boolean;
    categories: Record<TipCategory, boolean>;
}

const getStoredJSON = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage key “${key}”:`, error);
        return defaultValue;
    }
};

const defaultSettings: TipSettings = {
    allTipsEnabled: true,
    categories: {
        'Pro-Tip': true,
        'Workflow': true,
        'Billing': true,
        'Task Management': true,
    },
};

export const useTipManager = () => {
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState<TipSettings>(() => getStoredJSON('practicepro_tip_settings', defaultSettings));
    const [dismissedTips, setDismissedTips] = useState<Record<string, boolean>>(() => getStoredJSON('practicepro_dismissed_tips', {}));
    const [snoozedTips, setSnoozedTips] = useState<Record<string, number>>(() => getStoredJSON('practicepro_snoozed_tips', {}));
    
    useEffect(() => {
        try {
            localStorage.setItem('practicepro_tip_settings', JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save tip settings to localStorage:', error);
        }
    }, [settings]);

    useEffect(() => {
        try {
            localStorage.setItem('practicepro_dismissed_tips', JSON.stringify(dismissedTips));
        } catch (error) {
            console.error('Failed to save dismissed tips to localStorage:', error);
        }
    }, [dismissedTips]);
    
     useEffect(() => {
        try {
            localStorage.setItem('practicepro_snoozed_tips', JSON.stringify(snoozedTips));
        } catch (error) {
            console.error('Failed to save snoozed tips to localStorage:', error);
        }
    }, [snoozedTips]);

    const isTipVisible = useCallback((id: string, category: TipCategory): boolean => {
        if (!currentUser || !currentUser.showProTips) return false;
        if (!settings.allTipsEnabled) return false;
        if (!settings.categories[category]) return false;
        if (dismissedTips[id]) return false;
        
        const snoozedUntil = snoozedTips[id];
        if (snoozedUntil && snoozedUntil > Date.now()) {
            return false;
        }
        
        return true;
    }, [settings, dismissedTips, snoozedTips, currentUser]);

    const dismissTip = useCallback((id: string) => {
        setDismissedTips(prev => ({ ...prev, [id]: true }));
    }, []);
    
    const snoozeTip = useCallback((id: string, days: number) => {
        const snoozedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
        setSnoozedTips(prev => ({ ...prev, [id]: snoozedUntil }));
    }, []);

    const updateSettings = useCallback((newSettings: Partial<TipSettings> | ((current: TipSettings) => TipSettings)) => {
        setSettings(prev => {
            const updates = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
            
            const finalUpdates = { ...updates };
            if (finalUpdates.categories) {
                finalUpdates.categories = { ...prev.categories, ...finalUpdates.categories };
            }

            return { ...prev, ...finalUpdates };
        });
    }, []);
    
    const resetAllTips = useCallback((silent = false) => {
        setDismissedTips({});
        setSnoozedTips({});
        if (!silent) {
            alert("All dismissed and snoozed tips have been reset. They will reappear as you browse the app.");
        }
    }, []);

    return {
        settings,
        isTipVisible,
        dismissTip,
        snoozeTip,
        updateSettings,
        resetAllTips,
    };
};
