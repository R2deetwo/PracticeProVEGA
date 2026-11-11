import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { Matter, Contact, ClientMessage } from '../types';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { v4 as uuidv4 } from 'uuid';

export interface MatterState {
    matters: Matter[];
    contacts: Contact[];
    clientMessages: ClientMessage[];
}

export interface MatterActions {
    onAddMatter: (matterData: any, clientData: { data: any, createPortal: boolean } | null) => Promise<any>;
    updateMatter: (matter: Partial<Matter> & { id: string }) => Promise<void>;
    deleteMatter: (id: string, name?: string) => Promise<void>;
    handleReopenMatter: (id: string) => Promise<any>;
    handleCloseMatter: (id: string, closingNote?: string) => Promise<any>;
    handleAddContact: (contact: Omit<Contact, 'id'>, createPortal: boolean) => Promise<Contact | null>;
    handleSendClientMessage: (matterId: string, content: string) => void;
}

import { useDataState, useDataActions } from './DataContext';

const MatterContext = createContext<{ matterState: MatterState; matterActions: MatterActions } | undefined>(undefined);

export const MatterProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState } = useDataState();
    const actions = useDataActions();
    
    const matterState: MatterState = useMemo(() => ({
        matters: appState.matters,
        contacts: appState.contacts,
        clientMessages: appState.clientMessages
    }), [appState.matters, appState.contacts, appState.clientMessages]);

    const matterActions: MatterActions = useMemo(() => ({
        onAddMatter: actions.onAddMatter,
        updateMatter: (item) => actions.updateItem('matters', item, 'Matter'),
        // V3 (V-MATTER-8/17): delegates to the hardened cascade path in
        // useMatters. The old local copy swallowed cascade failures and
        // "fell back" to a plain deleteItem that the FK guard silently
        // blocked — a fake-success path that left the matter in place.
        deleteMatter: (id, name) => actions.handleDeleteMatter(id, name || 'Matter'),
        handleReopenMatter: actions.handleReopenMatter,
        handleCloseMatter: actions.handleCloseMatter,
        handleAddContact: actions.handleAddContact,
        handleSendClientMessage: actions.handleSendClientMessage
    }), [actions]);

    const value = useMemo(() => ({ matterState, matterActions }), [matterState, matterActions]);

    return (
        <MatterContext.Provider value={value}>
            {children}
        </MatterContext.Provider>
    );
};


export const useMatterState = () => {
    const context = useContext(MatterContext);
    if (!context) throw new Error('useMatterState must be used within MatterProvider');
    return context;
};
