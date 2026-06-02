import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUI } from './UIContext';

export type AppContextType = 'matter' | 'property' | 'global';

interface AppContextState {
    activeContext: AppContextType;
    setActiveContext: (context: AppContextType) => void;
    contextId: string | null;
}

const AppContext = createContext<AppContextState | undefined>(undefined);

export const AppContextProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { view, selectedId } = useUI();
    const [activeContext, setActiveContext] = useState<AppContextType>('global');
    const [contextId, setContextId] = useState<string | null>(null);

    useEffect(() => {
        if (view === 'propertyDetail' || view === 'properties' || view === 'atriumEngine') {
            setActiveContext('property');
            setContextId(selectedId || null);
        } else if (view === 'matterDetail' || view === 'matters' || view === 'vegaEngine') {
            setActiveContext('matter');
            setContextId(selectedId || null);
        } else {
            setActiveContext('global');
            setContextId(null);
        }
    }, [view, selectedId]);

    return (
        <AppContext.Provider value={{ activeContext, setActiveContext, contextId }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within an AppContextProvider");
    }
    return context;
};
