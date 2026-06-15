import React, { createContext, useContext, useCallback } from 'react';
import { Matter, Contact, ClientMessage } from '../types';
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
    handleReopenMatter: (id: string) => void;
    handleAddContact: (contact: Omit<Contact, 'id'>, createPortal: boolean) => Promise<Contact | null>;
    handleSendClientMessage: (matterId: string, content: string) => void;
}

import { useDataState, useDataActions } from './DataContext';

const MatterContext = createContext<{ matterState: MatterState; matterActions: MatterActions } | undefined>(undefined);

export const MatterProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { appState } = useDataState();
    const actions = useDataActions();
    const { currentUser } = useAuth();
    const deleteMatterCascadeMutation = useMutation(api.myFunctions.deleteMatterCascade);
    
    const matterState: MatterState = {
        matters: appState.matters,
        contacts: appState.contacts,
        clientMessages: appState.clientMessages
    };

    const matterActions: MatterActions = {
        onAddMatter: actions.onAddMatter,
        updateMatter: (item) => actions.updateItem('matters', item, 'Matter'),
        deleteMatter: async (id, name) => {
            // Use cascade delete to remove all child records (tasks, documents, etc.)
            try {
                await deleteMatterCascadeMutation({ matterId: id, firmId: currentUser?.firmId || '' });
            } catch (e) {
                console.error('[MatterContext] Cascade delete failed, falling back to simple delete:', e);
            }
            await actions.deleteItem('matters', id, name || 'Matter');
        },
        handleReopenMatter: actions.handleReopenMatter,
        handleAddContact: actions.handleAddContact,
        handleSendClientMessage: actions.handleSendClientMessage
    };

    return (
        <MatterContext.Provider value={{ matterState, matterActions }}>
            {children}
        </MatterContext.Provider>
    );
};


export const useMatterState = () => {
    const context = useContext(MatterContext);
    if (!context) throw new Error('useMatterState must be used within MatterProvider');
    return context;
};
